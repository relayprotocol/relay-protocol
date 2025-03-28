/**
 * Script used to claim bridged USDCfrom CCTP bridge
 */
import { task } from 'hardhat/config'
import {
  buildFinalizeOpWithdrawal,
  buildOpProveWithdrawal,
} from '@relay-protocol/helpers'
import { AbiCoder } from 'ethers'
import { networks } from '@relay-protocol/networks'
import { Portal2 } from '@relay-protocol/helpers/abis'

task('claim:native', 'Claim ETH from bridge for the pool')
  .addParam('txHash', 'Tx hash on origin chain')
  .addParam('origin', 'Origin chain id')
  .addParam('pool', 'The pool on dest chain')
  .setAction(async ({ txHash, origin, pool }, { ethers }) => {
    const finalizeParams = await buildFinalizeOpWithdrawal(origin, txHash)
    const claimParams = new AbiCoder().encode(
      ['bytes', 'address'],
      [finalizeParams, '0xA7c11bfB42f4221a7091a42f35022FE106bc9dEE']
    )

    const relayPool = await ethers.getContractAt('RelayPool', pool)

    const tx = await relayPool.claim(
      origin,
      ethers.zeroPadValue(pool, 32),
      claimParams
    )

    const receipt = await tx.wait()
    console.log(receipt)
  })

task('claim:native:prove', 'Prooves ETH was deposited on native bridge')
  .addParam('txHash', 'Tx hash on origin chain')
  .addParam('origin', 'Origin chain id')
  .addParam('pool', 'The pool on dest chain')
  .setAction(async ({ txHash, origin, pool }, { ethers }) => {
    const { chainId } = await ethers.provider.getNetwork()
    const [signer] = await ethers.getSigners()

    const proveParams = await buildOpProveWithdrawal(
      origin,
      txHash,
      Number(chainId)
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
    console.log(tx.hash)
    console.log('Ready to be claimed in 7 days!')
  })
