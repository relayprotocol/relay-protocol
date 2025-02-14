import {
  buildFinalizeWithdrawal,
  buildProveWithdrawal,
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

  const signer = await getSignerForNetwork(destinationNetwork)
  const proveParams = await buildProveWithdrawal(
    originChainId,
    originTxHash,
    Number(destinationPoolChainId)
  )

  // TODO: check if already proven!
  // This will avoid wasting gas (and resetting the counter?)

  const portal = new ethers.Contract(proveParams.portalAddress, Portal2, signer)
  const tx = await portal.proveWithdrawalTransaction(
    proveParams.transaction,
    proveParams.disputeGameIndex,
    proveParams.outputRootProof,
    proveParams.withdrawalProof
  )
  await tx.wait()
  return tx.hash
}

export const claimWithdrawal = async (bridgeTransaction) => {
  const destinationNetwork = networks[bridgeTransaction.destinationPoolChainId]

  const signer = await getSignerForNetwork(destinationNetwork)
  const relayPool = new ethers.Contract(
    bridgeTransaction.destinationPoolAddress,
    ABIs.RelayPool,
    signer
  )

  const proveParams = await buildProveWithdrawal(
    bridgeTransaction.originChainId,
    bridgeTransaction.originTxHash,
    Number(bridgeTransaction.destinationPoolChainId)
  )
  const portal = new ethers.Contract(proveParams.portalAddress, Portal2, signer)

  if (!bridgeTransaction.nativeBridgeProofTxHash) {
    // Transaction not yet proven!
    return false
  }

  // Let's get the submitter by looking at the proof tx!
  const receipt = await signer.provider!.getTransactionReceipt(
    bridgeTransaction.nativeBridgeProofTxHash
  )
  if (!receipt) {
    throw new Error('Proof tx not found')
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
        return false
      } else {
        throw e
      }
    })
  if (!ready) {
    return // Not ready yet!
  }
  console.log({ ready })

  const finalizeParams = await buildFinalizeWithdrawal(
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
