import { buildOpProveWithdrawal } from '@relay-protocol/helpers'
import networks from '@relay-protocol/networks'
import { Portal2 } from '@relay-protocol/helpers/abis'

import { expect } from 'chai'
import { ethers } from 'hardhat'

// These tests are not _actually_ for `RelayBridge` but required for RelayBridge to be able to process claims!
describe('RelayBridge: prove', () => {
  describe('OPstack', () => {
    it.skip('should succeed at submitting a proof for an OP1 withdrawal', async () => {
      const [signer] = await ethers.getSigners()

      const originChainId = 10
      const destinationPoolChainId = 1
      const withdrawlTxHash =
        '0x8a8ed32ec52267ba5c5656dc68f459a8be3cdd23d8a1128ed321a2c6df2e8ee3'
      const destinationNetwork = networks[destinationPoolChainId]

      const proveParams = await buildOpProveWithdrawal(
        originChainId,
        withdrawlTxHash,
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
      // TODO: add more checks on the tx, but for now the fact that it does not revert is enough!
      expect(tx.to).to.equal(destinationNetwork.bridges.op!.portalProxy)
    })

    it.skip('should succeed at submitting a proof for an Base withdrawal', async () => {
      const [signer] = await ethers.getSigners()

      const originChainId = 8453
      const destinationPoolChainId = 1
      const withdrawlTxHash =
        '0x0b10b5d4210436e32e5d4368c4bc3f5c6336c9f1a0635b9aa6ab3397ae8ca39f'
      const destinationNetwork = networks[destinationPoolChainId]

      const proveParams = await buildOpProveWithdrawal(
        originChainId,
        withdrawlTxHash,
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
      // TODO: add more checks on the tx, but for now the fact that it does not revert is enough!
      expect(tx.to).to.equal(destinationNetwork.bridges.base!.portalProxy)
    })
  })
})
