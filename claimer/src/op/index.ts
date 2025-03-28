import {
  buildProveWithdrawal,
  getWithdrawalHash,
} from '@relay-protocol/helpers'
import { Portal2 } from '@relay-protocol/helpers/abis'

import networks from '@relay-protocol/networks'
import { ethers } from 'ethers'
import { getSignerForNetwork } from '../signer'

export const submitProof = async ({
  originChainId,
  originTxHash,
  destinationPoolChainId,
}) => {
  console.log({ originChainId, originTxHash, destinationPoolChainId })
  const destinationNetwork = networks[destinationPoolChainId.toString()]

  const signer = await getSignerForNetwork(destinationNetwork)
  const finalizeParams = await buildProveWithdrawal(
    originChainId,
    originTxHash,
    Number(destinationPoolChainId)
  )

  if (destinationNetwork.bridges.op!.disputeGame) {
    const portal = new ethers.Contract(
      destinationNetwork.bridges.op!.portalProxy!,
      Portal2,
      signer
    )
    const tx = await portal.proveWithdrawalTransaction(
      finalizeParams.transaction,
      finalizeParams.disputeGameIndex,
      finalizeParams.outputRootProof,
      finalizeParams.withdrawalProof
    )
    await tx.wait()
    return tx.hash
  } else {
    console.log('OK I WAS HERE!')
  }
}

export default {
  submitProof,
}
