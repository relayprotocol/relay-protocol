import { expect } from 'chai'
import { ethers } from 'hardhat'
import { finalizeZksyncWithdrawal } from '@relay-protocol/helpers'
import { getBalance, getEvent } from '@relay-protocol/helpers'
import { ZeroAddress } from 'ethers'
import networks from '@relay-protocol/networks'

const {
  bridges: {
    zksync: { l1SharedDefaultBridge },
  },
  assets,
} = networks[1]

const ZKSYNC_MAINNET_CHAIN_ID = 324n

const account = '0x246A13358Fb27523642D86367a51C2aEB137Ac6C'

describe('ZkSync withdrawal finalization', () => {
  it('should work with native tokens', async () => {
    // native ETH
    // https://era.zksync.network/tx/0x44ee1a78cded74543cae05e70dd936043bbae441ec2c7f968af4a6e888ccb07f
    const amount = 100000000000000n
    const withdrawalHash =
      '0x44ee1a78cded74543cae05e70dd936043bbae441ec2c7f968af4a6e888ccb07f'

    const [signer] = await ethers.getSigners()
    const l1Bridge = await ethers.getContractAt(
      'IL1SharedBridge',
      l1SharedDefaultBridge
    )

    const balanceBefore = await getBalance(
      account,
      ZeroAddress,
      ethers.provider
    )

    // compute proof
    const proof = await finalizeZksyncWithdrawal(signer, withdrawalHash)

    expect(
      await l1Bridge.isWithdrawalFinalized(
        ZKSYNC_MAINNET_CHAIN_ID, // srcChainId
        proof.l1BatchNumber,
        proof.l2MessageIndex
      )
    ).to.equal(false)

    const args = [
      ZKSYNC_MAINNET_CHAIN_ID, // _chainId,
      proof.l1BatchNumber, // _l2BatchNumber,
      proof.l2MessageIndex, // _l2MessageIndex,
      proof.l2TxNumberInBlock, // _l2TxNumberInBatch,
      proof.message, // _message,
      proof.proof, // _merkleProof
    ]
    const tx = await l1Bridge.finalizeWithdrawal(...args)
    const receipt = await tx.wait()

    const { event } = await getEvent(
      receipt!,
      'WithdrawalFinalizedSharedBridge',
      l1Bridge.interface
    )

    expect(event.args.chainId).to.equal(ZKSYNC_MAINNET_CHAIN_ID)
    expect(event.args.to).to.equal(account)
    expect(event.args.l1Token).to.equal(
      '0x0000000000000000000000000000000000000001'
    )
    expect(event.args.amount).to.equal(amount)

    expect(await getBalance(account, ZeroAddress, ethers.provider)).to.equal(
      balanceBefore + amount
    )

    expect(
      await l1Bridge.isWithdrawalFinalized(
        ZKSYNC_MAINNET_CHAIN_ID, // srcChainId
        proof.l1BatchNumber,
        proof.l2MessageIndex
      )
    ).to.equal(true)
  })

  it.skip('should work with ERC20 token (USDC.e)', async () => {
    // USDC withdrawal
    // https://era.zksync.network/tx/0xcfc3f74fec4c803696b4daf8a15201d64046f5876c59832d19b34c2b0db18110
    const amount = ethers.parseUnits('0.5', 6)
    const withdrawalHash =
      '0xcfc3f74fec4c803696b4daf8a15201d64046f5876c59832d19b34c2b0db18110'
    const [signer] = await ethers.getSigners()
    const l1Bridge = await ethers.getContractAt(
      'IL1SharedBridge',
      l1SharedDefaultBridge
    )

    const balanceBefore = await getBalance(
      account,
      assets.USDC,
      ethers.provider
    )

    // compute proof
    const proof = await finalizeZksyncWithdrawal(signer, withdrawalHash)

    expect(
      await l1Bridge.isWithdrawalFinalized(
        ZKSYNC_MAINNET_CHAIN_ID, // srcChainId
        proof.l1BatchNumber,
        proof.l2MessageIndex
      )
    ).to.equal(false)

    const args = [
      ZKSYNC_MAINNET_CHAIN_ID, // _chainId,
      proof.l1BatchNumber, // _l2BatchNumber,
      proof.l2MessageIndex, // _l2MessageIndex,
      proof.l2TxNumberInBlock, // _l2TxNumberInBatch,
      proof.message, // _message,
      proof.proof, // _merkleProof
    ]
    const tx = await l1Bridge.finalizeWithdrawal(...args)
    const receipt = await tx.wait()

    const { event } = await getEvent(
      receipt!,
      'WithdrawalFinalizedSharedBridge',
      l1Bridge.interface
    )

    expect(event.args.chainId).to.equal(ZKSYNC_MAINNET_CHAIN_ID)
    expect(event.args.to).to.equal(account)
    expect(event.args.l1Token).to.equal(assets.USDC)
    expect(event.args.amount).to.equal(amount)

    expect(await getBalance(account, assets.USDC, ethers.provider)).to.equal(
      balanceBefore + amount
    )

    expect(
      await l1Bridge.isWithdrawalFinalized(
        ZKSYNC_MAINNET_CHAIN_ID, // srcChainId
        proof.l1BatchNumber,
        proof.l2MessageIndex
      )
    ).to.equal(true)
  })
})
