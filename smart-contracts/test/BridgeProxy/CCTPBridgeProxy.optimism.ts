import { ethers, ignition } from 'hardhat'
import { expect } from 'chai'
import { parseUnits, TransactionReceipt, type Signer } from 'ethers'
import { mintUSDC } from '../utils/hardhat'
import { getBalance, getEvent } from '@relay-protocol/helpers'
import { networks } from '@relay-protocol/networks'
import { reverts } from '../utils/errors'

import { CCTPBridgeProxy } from '../../typechain-types'
import CCTPBridgeProxyModule from '../../ignition/modules/CCTPBridgeProxyModule'

const chainId = 10
const destinationChainId = 1
const {
  bridges: {
    cctp: { messenger, transmitter },
  },
  assets,
} = networks[chainId]

const relayPool = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const l1BridgeProxy = '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1'

describe('CCTPBridgeProxy', function () {
  let bridge: CCTPBridgeProxy
  let recipient: Signer

  before(async () => {
    ;[, recipient] = await ethers.getSigners()

    // deploy using ignition
    const parameters = {
      CCTPBridgeProxy: {
        messenger,
        transmitter,
        usdc: assets.usdc,
        relayPoolChainId: 1,
        relayPool,
        l1BridgeProxy,
      },
    }
    ;({ bridge } = await ignition.deploy(CCTPBridgeProxyModule, { parameters }))

    // const CCTPBridgeProxy = await ethers.getContractFactory('CCTPBridgeProxy')
    // setup all cctp domains
    // bridge = await CCTPBridgeProxy.deploy(messenger, transmitter, assets.usdc)
  })

  describe('errors', () => {
    it('fails if using sth that is not USDC', async () => {
      await reverts(
        bridge.bridge(
          await recipient.getAddress(),
          networks[10].assets.udt,
          networks[1].assets.udt,
          parseUnits('100', 6),
          '0x' //empty data
        ),
        'TokenNotBridged'
      )
    })
  })
  describe('sending usdc', () => {
    let balanceBefore: bigint
    const amount = parseUnits('100', 6)
    let receipt: TransactionReceipt | null

    before(async () => {
      // get some usdc
      await mintUSDC(assets.usdc, await recipient.getAddress(), amount)
      balanceBefore = await getBalance(
        await recipient.getAddress(),
        assets.usdc,
        ethers.provider
      )
      expect(balanceBefore).to.be.equal(amount)

      // approve bridge to manipulate our usdc tokens
      const usdc = await ethers.getContractAt('IUSDC', assets.usdc)
      await usdc.connect(recipient).approve(await bridge.getAddress(), amount)

      // send message to the bridge
      const tx = await bridge.bridge(
        await recipient.getAddress(),
        networks[10].assets.usdc,
        networks[1].assets.usdc,
        amount,
        '0x' //empty data
      )

      receipt = await tx.wait()
    })

    it('burnt the balance', async () => {
      expect(
        await getBalance(
          await recipient.getAddress(),
          assets.usdc,
          ethers.provider
        )
      ).to.be.equal(balanceBefore - amount)
    })

    it('burn event is emitted correctly', async () => {
      // parse interface to decode logs
      const { interface: iface } = await ethers.getContractAt(
        'ITokenMessenger',
        ethers.ZeroAddress
      )
      const { event } = await getEvent(receipt!, 'DepositForBurn', iface)
      expect(event).to.not.be.equal(undefined)
      const { args } = event
      expect(args?.burnToken).to.be.equal(assets.usdc)
      expect(args?.amount).to.be.equal(amount)
      expect(args?.destinationDomain).to.be.equal(
        networks[destinationChainId].bridges.cctp.domain
      )
      // expect(args?.mintRecipient).to.be.equal(await recipient.getAddress())
    })

    it('message transmitter send message correctly', async () => {
      // parse interface to decode logs
      const { interface: iface } = await ethers.getContractAt(
        'IMessageTransmitter',
        ethers.ZeroAddress
      )
      const { event } = await getEvent(receipt!, 'MessageSent', iface)
      expect(event).to.not.be.equal(undefined)
      expect(event?.args.message).to.not.be.equal(undefined)
    })
  })
})
