import {
  buildFinalizeOpWithdrawal,
  buildOpProveWithdrawal,
  buildLegacyOpProveWithdrawal,
} from '@relay-protocol/helpers'
import { Portal2 } from '@relay-protocol/helpers/abis'
import * as ABIs from '@relay-protocol/abis'

import networks from '@relay-protocol/networks'
import { AbiCoder, ethers } from 'ethers'
import { getSignerForNetwork } from '../signer'

export const submitProof = async ({
  originChainId,
  originTxHash,
  destinationPoolChainId,
}) => {
  const destinationNetwork = networks[destinationPoolChainId.toString()]
  const originNetwork = networks[originChainId.toString()]

  const signer = await getSignerForNetwork(destinationNetwork)

  if (destinationNetwork.bridges[originNetwork.slug].disputeGame) {
    const proveParams = await buildOpProveWithdrawal(
      originChainId,
      originTxHash,
      Number(destinationPoolChainId)
    )
    const portal = new ethers.Contract(
      proveParams.portalAddress,
      Portal2,
      signer
    )
    const tx = await portal.proveWithdrawalTransaction(
      proveParams.transaction,
      proveParams.disputeGameIndex,
      proveParams.outputRootProof,
      proveParams.withdrawalProof
    )
    await tx.wait()
    return tx.hash
  } else {
    const proveParams = await buildLegacyOpProveWithdrawal(
      originChainId,
      originTxHash,
      Number(destinationPoolChainId)
    )
    console.log(proveParams)
  }
}

export const claimWithdrawal = async (bridgeTransaction) => {
  const destinationNetwork = networks[bridgeTransaction.destinationPoolChainId]

  const signer = await getSignerForNetwork(destinationNetwork)
  const relayPool = new ethers.Contract(
    bridgeTransaction.destinationPoolAddress,
    ABIs.RelayPool,
    signer
  )

  const proveParams = await buildOpProveWithdrawal(
    bridgeTransaction.originChainId,
    bridgeTransaction.originTxHash,
    Number(bridgeTransaction.destinationPoolChainId)
  )
  const portal = new ethers.Contract(proveParams.portalAddress, Portal2, signer)

  if (!bridgeTransaction.opProofTxHash) {
    // Transaction not yet proven!
    throw new Error(
      `Transaction ${bridgeTransaction.originTxHash} on ${bridgeTransaction.originChainId} not yet proven`
    )
  }

  // Let's get the submitter by looking at the proof tx!
  const receipt = await signer.provider!.getTransactionReceipt(
    bridgeTransaction.opProofTxHash
  )
  if (!receipt) {
    throw new Error(
      `Proof transaction ${bridgeTransaction.opProofTxHash} for ${bridgeTransaction.originTxHash} on ${bridgeTransaction.originChainId} not found`
    )
  }
  // Check status of withdrawal!
  const ready = await portal
    .checkWithdrawal(proveParams.withdrawalHash, receipt.from)
    .catch((e) => {
      if (
        e.message.includes(
          'OptimismPortal: proven withdrawal has not matured yet'
        )
      ) {
        console.log(
          `Transaction ${bridgeTransaction.originTxHash} on ${bridgeTransaction.originChainId} not ready yet (proof: ${bridgeTransaction.opProofTxHash})`
        )
        return false
      } else {
        throw e
      }
    })
  if (!ready) {
    return // Not ready yet!
  }

  const finalizeParams = await buildFinalizeOpWithdrawal(
    bridgeTransaction.originChainId,
    bridgeTransaction.originTxHash
  )

  const claimParams = new AbiCoder().encode(
    ['bytes', 'address'],
    [finalizeParams, receipt.from] // Hum, we need to the submitted address (it should be us though)
  )

  const tx = await relayPool.claim(
    bridgeTransaction.originChainId,
    bridgeTransaction.originBridgeAddress,
    claimParams
  )
  console.log('Claim tx:', tx.hash)
}

export default {
  submitProof,
  claimWithdrawal,
}
