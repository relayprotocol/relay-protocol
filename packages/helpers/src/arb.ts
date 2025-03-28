import { ethers, JsonRpcApiProvider } from 'ethers-v6'
import { networks } from '@relay-protocol/networks'
import { fetchRawBlock, getProvider } from './provider'
import { getEvent } from './events'

import OUTBOX_ABI from './abis/arb/Outbox.json'
import ROLLUP_MAINNET_ABI from './abis/arb/RollupMainnet.json'
import ROLLUP_SEPOLIA_ABI from './abis/arb/RollupSepolia.json'
import ARBSYS_ABI from './abis/arb/IArbSys.json'
import NODE_INTERFACE_ABI from './abis/arb/INodeInterface.json'

const NODE_INTERFACE_ADDRESS = '0x00000000000000000000000000000000000000C8'

const getLatestConfirmedBlockCoords = async function (chainId: bigint) {
  let rollupAddress: string
  const l1Provider = await getProvider(chainId)
  const {
    bridges: { arb: arbContracts },
    isTestnet,
  } = networks[chainId.toString()]
  if (arbContracts) {
    rollupAddress = arbContracts.rollup!
  }

  // get latest rollup assertion from L2
  const rollup = new ethers.Contract(
    // mainnet differs from other because it uses BolD
    // see https://docs.arbitrum.io/how-arbitrum-works/bold/gentle-introduction
    rollupAddress!,
    isTestnet ? ROLLUP_SEPOLIA_ABI : ROLLUP_MAINNET_ABI,
    l1Provider
  )
  const latestConfirmedAssertionId = await rollup.latestConfirmed.staticCall()

  // get block number from L2 assertion
  const { createdAtBlock } = isTestnet
    ? await rollup.getAssertion(latestConfirmedAssertionId)
    : await rollup.getNode(ethers.Typed.uint64(latestConfirmedAssertionId))

  // find creation block hash in assertion logs
  const eventFilter = isTestnet
    ? rollup.filters.AssertionCreated
    : rollup.filters.NodeCreated
  const fullFilter = {
    ...eventFilter,
    address: rollupAddress!,
    fromBlock: createdAtBlock,
    toBlock: createdAtBlock,
  }
  const logs = await l1Provider.getLogs(fullFilter)
  const parsedBlockLog = rollup.interface.parseLog(logs[0])

  // decode afterState
  const blockHash =
    parsedBlockLog?.args.assertion.afterState.globalState.bytes32Vals[0]
  const sendRoot =
    parsedBlockLog?.args.assertion.afterState.globalState.bytes32Vals[1]

  return {
    blockHash,
    sendRoot,
  }
}

export async function constructArbProof(
  l2TransactionHash: string,
  l2ChainId: bigint | string,
  l1ChainId = 11155111n, //default to sepolia
  l1Provider?: JsonRpcApiProvider
) {
  let outboxAddress: string

  if (!l1Provider) {
    l1Provider = await getProvider(l1ChainId)
  }

  const arbProvider = await getProvider(l2ChainId)
  const arbsysInterface = new ethers.Interface(ARBSYS_ABI)

  // decode message on origin chain
  const transactionReceipt =
    await arbProvider.getTransactionReceipt(l2TransactionHash)
  const {
    event: {
      args: {
        caller,
        destination,
        // hash,
        position: leaf,
        arbBlockNum,
        ethBlockNum,
        timestamp,
        callvalue,
        data,
      },
    },
  } = await getEvent(transactionReceipt!, 'L2ToL1Tx', arbsysInterface)

  // make sure its not already spent on L1
  const {
    bridges: { arb: arbContracts },
  } = networks[l1ChainId.toString()]
  if (arbContracts) {
    outboxAddress = arbContracts.outbox!
  }

  const outboxInterface = new ethers.Interface(OUTBOX_ABI)
  const outbox = new ethers.Contract(
    outboxAddress!,
    outboxInterface,
    l1Provider
  )

  // check if already spent
  const isSpent = await outbox.isSpent.staticCall(leaf)
  if (isSpent) {
    throw Error('Already spent')
  }

  // get merkle tree size
  // NB: calling `sendMerkleTreeState` on ArbSys returned a wrong value
  // that makes the merkle computation fails when claiming later from the outbox
  // so we have to get the size directly from the latest "rolled up" block
  const { blockHash: latestConfirmedBlockHash } =
    await getLatestConfirmedBlockCoords(l1ChainId)

  // fetch raw block
  // NB: we have to use a json rpc call as ethers will filter out
  // additional block params added by Arbitrum
  const latestConfirmededBlock = await fetchRawBlock(
    l2ChainId,
    latestConfirmedBlockHash
  )

  // TODO: make sure fetched block sendRoot if identical to the one in coords
  const sendRootSizeConfirmed = BigInt(latestConfirmededBlock.sendCount)

  // use Arb's NodeInterface precompiled to comppute proof
  const INodeInterface = new ethers.Interface(NODE_INTERFACE_ABI)
  const nodeInterface = new ethers.Contract(
    NODE_INTERFACE_ADDRESS,
    INodeInterface,
    arbProvider
  )

  // construct actual proof using
  const { /*send , root, */ proof } =
    await nodeInterface.constructOutboxProof.staticCall(
      sendRootSizeConfirmed,
      ethers.Typed.uint64(leaf) // position
    )

  return {
    arbBlockNum,
    caller,
    callvalue,
    data,
    destination,
    ethBlockNum,
    leaf,
    proof: proof.toArray(),
    timestamp,
  }
}
