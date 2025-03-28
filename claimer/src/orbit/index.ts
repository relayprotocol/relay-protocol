import { constructArbProof } from '@relay-protocol/helpers'
import { ethers } from 'ethers'
import * as ABIs from '@relay-protocol/abis'
import { getSignerForNetwork } from '../signer'
import networks from '@relay-protocol/networks'

export const claimWithdrawal = async (bridgeTransaction) => {
  const destinationNetwork = networks[bridgeTransaction.destinationPoolChainId]
  const signer = await getSignerForNetwork(destinationNetwork)

  const {
    proof,
    leaf,
    caller,
    destination,
    arbBlockNum,
    ethBlockNum,
    timestamp,
    callvalue,
    data,
  } = await constructArbProof(
    bridgeTransaction.originTxHash,
    bridgeTransaction.originChainId
  )

  const relayPool = new ethers.Contract(
    bridgeTransaction.destinationPoolAddress,
    ABIs.RelayPool,
    signer
  )

  const abiCoder = relayPool.interface.getAbiCoder()
  const bridgeParams = abiCoder.encode(
    [
      'bytes32[]',
      'uint256',
      'address',
      'address',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'bytes',
    ],
    [
      proof,
      leaf, // position/index
      caller, //l2 sender
      destination, // to
      arbBlockNum, //l2block
      ethBlockNum, // l1block
      timestamp, //l2 ts
      callvalue, // value
      data,
    ]
  )

  await relayPool.claim(
    bridgeTransaction.originChainId,
    bridgeTransaction.originBridgeAddress,
    bridgeParams
  )
}

export default {
  claimWithdrawal,
}
