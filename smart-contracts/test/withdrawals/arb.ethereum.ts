import { ethers } from 'hardhat'
import { ZeroAddress } from 'ethers'
import { expect } from 'chai'
import { constructArbProof, getEvent } from '@relay-protocol/helpers'

import { networks } from '@relay-protocol/networks'
import { getBalance } from '@relay-protocol/helpers'

const ETH_CHAIN_ID = 1n
const {
  bridges: {
    arb: { outbox: outboxAddress },
  },
  assets,
} = networks[ETH_CHAIN_ID.toString()]
const ARB_CHAIN_ID = 42161n

const recipientAddress = '0x246A13358Fb27523642D86367a51C2aEB137Ac6C'

describe('Arbitrum Orbit withdrawal', function () {
  it('works using native', async () => {
    const amount = ethers.parseEther('0.000001')

    // https://arbiscan.io/tx/0x650570bd55b1bf54cd64d8882b4cc8b58f06c475ec17fdba93f2fbfa23fca340
    const txHash =
      '0x650570bd55b1bf54cd64d8882b4cc8b58f06c475ec17fdba93f2fbfa23fca340'

    // construct the proof
    const {
      proof,
      arbBlockNum,
      caller,
      callvalue,
      data,
      destination,
      ethBlockNum,
      leaf,
      timestamp,
    } = await constructArbProof(txHash, ARB_CHAIN_ID, ETH_CHAIN_ID)

    const outboxArgs = [
      proof, // proof
      leaf, // index
      caller, // l2Sender
      destination, // to,
      arbBlockNum, // l2Block,
      ethBlockNum, // l1Block,
      timestamp, // l2Timestamp,
      callvalue, // value,
      data, // data,
    ]

    const balanceBefore = await getBalance(
      recipientAddress,
      ZeroAddress,
      ethers.provider
    )
    // do the claim
    const outbox = await ethers.getContractAt('IOutbox', outboxAddress)
    const tx = await outbox.executeTransaction(...outboxArgs)
    const receipt = await tx.wait()

    // Check for OutBoxTransactionExecuted event
    const { interface: iface } = await ethers.getContractAt(
      'IOutbox',
      ethers.ZeroAddress
    )
    const { event } = await getEvent(
      receipt!,
      'OutBoxTransactionExecuted',
      iface
    )
    expect(event).to.not.be.equal(undefined)
    const { args } = event
    expect(args?.to).to.equal(recipientAddress)
    expect(args?.l2Sender).to.be.equal(recipientAddress)
    expect(args?.zero).to.be.equal(0n)
    expect(args?.transactionIndex).to.be.equal(leaf)

    const balanceAfter = await getBalance(
      recipientAddress,
      ZeroAddress!,
      ethers.provider
    )
    expect(balanceAfter).to.equals(balanceBefore + amount)
  })

  it('works with ERC20 (ARB token)', async () => {
    // https://arbiscan.io/tx/0x8f1b720a0361d4433cdb5693d4bb1cad8867f8551a3bafce7254422b80f92154
    const txHash =
      '0x8f1b720a0361d4433cdb5693d4bb1cad8867f8551a3bafce7254422b80f92154'
    const amount = ethers.parseEther('0.0001')

    // construct the proof
    const {
      proof,
      arbBlockNum,
      caller,
      callvalue,
      data,
      destination,
      ethBlockNum,
      leaf,
      timestamp,
    } = await constructArbProof(txHash, ARB_CHAIN_ID, ETH_CHAIN_ID)

    const outboxArgs = [
      proof, // proof
      leaf, // index
      caller, // l2Sender
      destination, // to,
      arbBlockNum, // l2Block,
      ethBlockNum, // l1Block,
      timestamp, // l2Timestamp,
      callvalue, // value,
      data, // data,
    ]

    const balanceBefore = await getBalance(
      recipientAddress,
      assets.arb,
      ethers.provider
    )
    // do the claim
    const outbox = await ethers.getContractAt('IOutbox', outboxAddress)
    const tx = await outbox.executeTransaction(...outboxArgs)
    const receipt = await tx.wait()

    // Check for OutBoxTransactionExecuted event
    const { interface: iface } = await ethers.getContractAt(
      'IOutbox',
      ethers.ZeroAddress
    )
    const { event } = await getEvent(
      receipt!,
      'OutBoxTransactionExecuted',
      iface
    )
    expect(event).to.not.be.equal(undefined)
    const { args } = event
    expect(args?.to).to.equal(recipientAddress)
    expect(args?.l2Sender).to.be.equal(recipientAddress)
    expect(args?.zero).to.be.equal(0n)
    expect(args?.transactionIndex).to.be.equal(leaf)

    const balanceAfter = await getBalance(
      recipientAddress,
      assets.arb,
      ethers.provider
    )
    expect(balanceAfter).to.equals(balanceBefore + amount)
  })
})
