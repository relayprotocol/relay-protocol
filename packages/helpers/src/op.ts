import { AbiCoder, ethers } from 'ethers'
import { getEvent } from './events'
import L2ToL1MessagePasserAbi from '../../lib/abis/L2ToL1MessagePasser.json'
import * as rlp from 'rlp'
import Portal2 from '../../lib/abis/op/Portal2.json'
import DisputeGameFactory from '../../lib/abis/op/DisputeGameFactory.json'

const providers = {
  10: 'https://rpc.unlock-protocol.com/10',
  1: 'https://rpc.unlock-protocol.com/1',
}
const outputRootProofVersion =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

const portalAddress = '0xbEb5Fc579115071764c7423A4f12eDde41f106Ed'
const disputeGameAddress = '0xe5965Ab5962eDc7477C8520243A95517CD252fA9'

export const getGame = async (minL2BlockNumber: number) => {
  const abiCoder = new AbiCoder()

  const disputeGameContract = new ethers.Contract(
    disputeGameAddress,
    DisputeGameFactory,
    new ethers.JsonRpcProvider(providers[1])
  )
  const portal2Contract = new ethers.Contract(
    portalAddress,
    Portal2,
    new ethers.JsonRpcProvider(providers[1])
  )

  const [gameCount, gameType] = await Promise.all([
    disputeGameContract.gameCount(),
    portal2Contract.respectedGameType(),
  ])

  return (
    await disputeGameContract.findLatestGames(
      gameType,
      BigInt(Math.max(0, Number(gameCount - 1n))),
      BigInt(Math.min(100, Number(gameCount)))
    )
  ).filter((game) => {
    const l2Block = abiCoder.decode(['uint256'], game[4])[0] as bigint
    return l2Block >= minL2BlockNumber
  })[0]
}

export const buildProveWithdrawal = async (
  network: number,
  withdrawalTx: string
) => {
  const abiCoder = new AbiCoder()
  const provider = new ethers.JsonRpcProvider(providers[network])

  // Get receipt
  const receipt = await provider.getTransactionReceipt(withdrawalTx)

  // Extract event
  const event = await getEvent(
    receipt!,
    'MessagePassed',
    new ethers.Interface(L2ToL1MessagePasserAbi)
  )

  const nonce = event.args.nonce // '1766847064778384329583297500742918515827483896875618958121606201292642338' // Get it from `MessagePassed` event's first arg
  const sender = event.args.sender //'0x4200000000000000000000000000000000000007' // Get it from `MessagePassed` event's second arg
  const target = event.args.target //'0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1' // Get it from `MessagePassed` event's third arg
  const value = event.args.value // '1000000000000000' // Get it from `MessagePassed` event's value
  const gasLimit = event.args.gasLimit // '491310' // Get it from `MessagePassed` event's gasLimit
  const data = event.args.data // ('0xd764ad0b0001000000000000000000000000000000000000000000000000000000005817000000000000000000000000420000000000000000000000000000000000001000000000000000000000000099c9fc46f92e8a1c0dec1b1747d010903e884be100000000000000000000000000000000000000000000000000038d7ea4c680000000000000000000000000000000000000000000000000000000000000030d4000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000c41635f5fd000000000000000000000000f5c28ce24acf47849988f147d5c75787c0103534000000000000000000000000f5c28ce24acf47849988f147d5c75787c010353400000000000000000000000000000000000000000000000000038d7ea4c680000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000b737570657262726964676500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000') // Get it from `MessagePassed` event's data
  const withdrawalHash = event.args.withdrawalHash

  // Get the slot
  const slot = ethers.keccak256(
    abiCoder.encode(['bytes32', 'uint256'], [withdrawalHash, 0n])
  )

  const game = await getGame(receipt!.blockNumber)

  // Get the block
  const gameBlockNumber = abiCoder.decode(['uint256'], game[4])[0] as bigint
  const block = await provider.getBlock(gameBlockNumber)

  // Get the storage proof
  const proof = await provider.send('eth_getProof', [
    '0x4200000000000000000000000000000000000016', // MessagePasser
    [slot],
    block!.hash,
  ])

  // encode the root proof
  const outputRootProof = abiCoder.encode(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32'],
    [outputRootProofVersion, block?.stateRoot, proof.storageHash, block?.hash]
  )

  const disputeGameIndex = game[0]

  // Ok so that is the next step that's wrong. We need to check both the params
  // and the implementation of the function to see if we can get the right values!
  const withdrawalProof = maybeAddProofNode(
    ethers.keccak256(slot),
    proof.storageProof[0].proof
  )

  return {
    transaction: {
      nonce,
      sender,
      target,
      value,
      gasLimit,
      data,
    },
    disputeGameIndex,
    outputRootProof: {
      version: outputRootProofVersion,
      stateRoot: block?.stateRoot,
      messagePasserStorageRoot: proof.storageHash,
      latestBlockhash: block?.hash,
    },
    withdrawalProof,
  }
}

export const buildFinalizeWithdrawal = async (
  network: number,
  withdrawalTx: string
) => {
  const abiCoder = new AbiCoder()
  const provider = new ethers.JsonRpcProvider(providers[network])

  // Get receipt
  const receipt = await provider.getTransactionReceipt(withdrawalTx)

  // Extract event
  const event = await getEvent(
    receipt!,
    'MessagePassed',
    new ethers.Interface(L2ToL1MessagePasserAbi)
  )

  const nonce = event.args.nonce // '1766847064778384329583297500742918515827483896875618958121606201292642338' // Get it from `MessagePassed` event's first arg
  const sender = event.args.sender //'0x4200000000000000000000000000000000000007' // Get it from `MessagePassed` event's second arg
  const target = event.args.target //'0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1' // Get it from `MessagePassed` event's third arg
  const value = event.args.value // '1000000000000000' // Get it from `MessagePassed` event's value
  const gasLimit = event.args.gasLimit // '491310' // Get it from `MessagePassed` event's gasLimit
  const data = event.args.data // ('0xd764ad0b0001000000000000000000000000000000000000000000000000000000005817000000000000000000000000420000000000000000000000000000000000001000000000000000000000000099c9fc46f92e8a1c0dec1b1747d010903e884be100000000000000000000000000000000000000000000000000038d7ea4c680000000000000000000000000000000000000000000000000000000000000030d4000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000c41635f5fd000000000000000000000000f5c28ce24acf47849988f147d5c75787c0103534000000000000000000000000f5c28ce24acf47849988f147d5c75787c010353400000000000000000000000000000000000000000000000000038d7ea4c680000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000b737570657262726964676500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000') // Get it from `MessagePassed` event's data
  // encode the transaction
  return abiCoder.encode(
    ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
    [nonce, sender, target, value, gasLimit, data]
  )
}

const main = async () => {
  await buildProveWithdrawal(
    10,
    '0x8a8ed32ec52267ba5c5656dc68f459a8be3cdd23d8a1128ed321a2c6df2e8ee3'
  )
}

/**
 * Fix for the case where the final proof element is less than 32 bytes and the element exists
 * inside of a branch node. Current implementation of the onchain MPT contract can't handle this
 * natively so we instead append an extra proof element to handle it instead.
 * @param key Key that the proof is for.
 * @param proof Proof to potentially modify.
 * @returns Modified proof.
 */
export const maybeAddProofNode = (key: string, proof: string[]) => {
  const modifiedProof = [...proof]
  const finalProofEl = modifiedProof[modifiedProof.length - 1]
  const finalProofElDecoded = rlp.decode(finalProofEl) as any
  if (finalProofElDecoded.length === 17) {
    for (const item of finalProofElDecoded) {
      // Find any nodes located inside of the branch node.
      if (Array.isArray(item)) {
        // Check if the key inside the node matches the key we're looking for. We remove the first
        // two characters (0x) and then we remove one more character (the first nibble) since this
        // is the identifier for the type of node we're looking at. In this case we don't actually
        // care what type of node it is because a branch node would only ever be the final proof
        // element if (1) it includes the leaf node we're looking for or (2) it stores the value
        // within itself. If (1) then this logic will work, if (2) then this won't find anything
        // and we won't append any proof elements, which is exactly what we would want.
        // const suffix = toHexString(item[0]).slice(3)
        const suffix = item[0].slice(3)
        if (key.endsWith(suffix)) {
          // modifiedProof.push(toHexString(rlp.encode(item)))
          modifiedProof.push(rlp.encode(item).toString('hex'))
        }
      }
    }
  }

  // Return the modified proof.
  return modifiedProof
}

// execute as standalone
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
