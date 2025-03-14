import { expect } from 'chai'
import { ethers, ignition } from 'hardhat'
import { encodeData } from './hyperlane.hardhat'
import RelayPoolModule from '../../ignition/modules/RelayPoolModule'
import {
  MyOpStackPortal,
  MyToken,
  MyWeth,
  MyYieldPool,
  RelayPool,
} from '../../typechain-types'
import OPStackNativeBridgeProxyModule from '../../ignition/modules/OPStackNativeBridgeProxyModule'
import { reverts } from '../utils/errors'

const relayBridgeOptimism = '0x0000000000000000000000000000000000000010'
const relayBridgeBase = '0x0000000000000000000000000000000000008453'
const portalProxy = '0x49048044D57e1C92A77f79988d21Fa8fAF74E97e'

describe('RelayPool: claim for native ETH', () => {
  let relayPool: RelayPool
  let myWeth: MyWeth
  let thirdPartyPool: MyYieldPool
  let userAddress: string
  let myOpStackPortal: MyOpStackPortal

  before(async () => {
    const [user] = await ethers.getSigners()
    userAddress = await user.getAddress()

    myWeth = await ethers.deployContract('MyWeth')

    // deploy 3rd party pool
    thirdPartyPool = await ethers.deployContract('MyYieldPool', [
      await myWeth.getAddress(),
      'My Yield Pool',
      'YIELD',
    ])
    const thirdPartyPoolAddress = await thirdPartyPool.getAddress()
    // Initialize the pool with a little bit of funds
    const initialDeposit = ethers.parseEther('1')
    await myWeth.deposit({ value: initialDeposit })
    await myWeth.approve(thirdPartyPoolAddress, initialDeposit)
    await thirdPartyPool.deposit(initialDeposit, userAddress)

    myOpStackPortal = await ethers.deployContract('MyOpStackPortal')

    // deploy the pool using ignition
    const parameters = {
      RelayPool: {
        hyperlaneMailbox: userAddress, // networks[1].hyperlaneMailbox,
        asset: await myWeth.getAddress(),
        name: `${await myWeth.name()} Relay Pool`,
        symbol: `${await myWeth.symbol()}-REL`,
        thirdPartyPool: thirdPartyPoolAddress,
        weth: await myWeth.getAddress(),
        curator: userAddress,
      },
    }
    ;({ relayPool } = await ignition.deploy(RelayPoolModule, {
      parameters,
    }))
  })

  it('should fail to claim from an unauthorized origin', async () => {
    const originChain = 666
    const originBridge = ethers.ZeroAddress
    await expect(relayPool.claim(originChain, originBridge))
      .to.be.revertedWithCustomError(relayPool, 'UnauthorizedOrigin')
      .withArgs(originChain, originBridge)
  })

  describe('authorized claims', () => {
    let origin, anotherOrigin, bridgedAmount: bigint
    before(async () => {
      // Add origins (we use and OPStack origin here)
      const bridgeProxyParameters = {
        OPStackNativeBridgeProxy: {
          portalProxy,
          relayPoolChainId: 31337,
          relayPool: await relayPool.getAddress(),
          l1BridgeProxy: ethers.ZeroAddress,
        },
      }
      const { bridge: opBridgeProxy } = await ignition.deploy(
        OPStackNativeBridgeProxyModule,
        {
          parameters: bridgeProxyParameters,
        }
      )

      origin = {
        chainId: 10,
        bridge: relayBridgeOptimism, // should not matter
        maxDebt: ethers.parseEther('10'),
        proxyBridge: await opBridgeProxy.getAddress(),
        bridgeFee: 10,
        curator: userAddress,
        coolDown: 0,
      }

      relayPool.addOrigin(origin)

      const { bridge: baseBridgeProxy } = await ignition.deploy(
        OPStackNativeBridgeProxyModule,
        {
          parameters: bridgeProxyParameters,
        }
      )

      anotherOrigin = {
        chainId: 8453,
        bridge: relayBridgeBase, // should not matter
        maxDebt: ethers.parseEther('10'),
        proxyBridge: await baseBridgeProxy.getAddress(),
        bridgeFee: 10,
        curator: userAddress,
        coolDown: 0,
      }

      relayPool.addOrigin(anotherOrigin)

      // Fund the pool with some WETH
      await myWeth.deposit({ value: ethers.parseEther('3') })
      await myWeth.approve(await relayPool.getAddress(), ethers.parseEther('3'))
      await relayPool.deposit(ethers.parseEther('3'), userAddress)

      bridgedAmount = ethers.parseEther('0.2')
    })

    it('should claim ETH and wrap to WETH from the origin contract', async () => {
      const [user] = await ethers.getSigners()

      // Borrow from the pool so we can claim later
      await relayPool.handle(
        origin.chainId,
        ethers.zeroPadValue(origin.bridge, 32),
        encodeData(5n, userAddress, bridgedAmount)
      )

      // Send the funds to the bridgeProxy (simulate successful bridging)
      await user.sendTransaction({
        to: origin.proxyBridge,
        value: bridgedAmount,
      })

      expect(
        await ethers.provider.getBalance(origin.proxyBridge)
      ).to.be.greaterThan(0)

      await relayPool.claim(origin.chainId, origin.bridge)

      expect(await ethers.provider.getBalance(origin.proxyBridge)).to.equal(0)
      expect(
        await ethers.provider.getBalance(await relayPool.getAddress())
      ).to.equal(0)
    })

    it('should update the outstanding debts', async () => {
      const [user] = await ethers.getSigners()

      // Borrow from the pool so we can claim later
      await relayPool.handle(
        origin.chainId,
        ethers.zeroPadValue(origin.bridge, 32),
        encodeData(6n, userAddress, bridgedAmount)
      )

      const outstandingDebtBefore = await relayPool.outstandingDebt()
      expect(outstandingDebtBefore).to.greaterThan(0)
      const originSettingsBefore = await relayPool.authorizedOrigins(
        origin.chainId,
        origin.bridge
      )
      expect(originSettingsBefore.outstandingDebt).to.greaterThan(0)

      // Send the funds to the bridgeProxy (simulate successful bridging)
      await user.sendTransaction({
        to: origin.proxyBridge,
        value: bridgedAmount,
      })
      // Claim
      await relayPool.claim(origin.chainId, origin.bridge)
      const outstandingDebtAfter = await relayPool.outstandingDebt()
      const originSettingsAfter = await relayPool.authorizedOrigins(
        origin.chainId,
        origin.bridge
      )

      expect(outstandingDebtBefore - outstandingDebtAfter).to.equal(
        bridgedAmount
      )
      expect(
        originSettingsBefore.outstandingDebt -
          originSettingsAfter.outstandingDebt
      ).to.equal(bridgedAmount)
    })

    it('should desposit the funds in the 3rd party pool but total assets should remain unchanged', async () => {
      const [user] = await ethers.getSigners()

      // Borrow from the pool so we can claim later
      await relayPool.handle(
        origin.chainId,
        ethers.zeroPadValue(origin.bridge, 32),
        encodeData(7n, userAddress, bridgedAmount)
      )

      const streamingPeriod = await relayPool.streamingPeriod()
      await ethers.provider.send('evm_increaseTime', [
        Number(streamingPeriod * 2n),
      ])
      await relayPool.updateStreamedAssets()
      const poolAssetsBefore = await relayPool.totalAssets()

      const relayPoolBalanceBefore = await thirdPartyPool.balanceOf(
        await relayPool.getAddress()
      )

      // Send the funds to the bridgeProxy (simulate successful bridging)
      await user.sendTransaction({
        to: origin.proxyBridge,
        value: bridgedAmount,
      })

      await relayPool.claim(origin.chainId, origin.bridge)

      const poolAssetsAfter = await relayPool.totalAssets()

      const relayPoolBalanceAfter = await thirdPartyPool.balanceOf(
        await relayPool.getAddress()
      )
      // Assets remain unchanged (they were previously accounted for "in the bridge")
      expect(poolAssetsAfter).to.equal(poolAssetsBefore)

      // But the balance of the relay pool in the 3rd party pool should have increased
      expect(relayPoolBalanceAfter - relayPoolBalanceBefore).to.equal(
        bridgedAmount
      )
    })

    it('should not fail if there are extra funds in the bridge proxy contract', async () => {
      const [user] = await ethers.getSigners()

      // Borrow from the pool so we can claim later
      await relayPool.handle(
        origin.chainId,
        ethers.zeroPadValue(origin.bridge, 32),
        encodeData(8n, userAddress, bridgedAmount)
      )

      const streamingPeriod = await relayPool.streamingPeriod()
      await ethers.provider.send('evm_increaseTime', [
        Number(streamingPeriod * 2n),
      ])
      await relayPool.updateStreamedAssets()

      const outstandingDebtBefore = await relayPool.outstandingDebt()
      expect(outstandingDebtBefore).to.equal(bridgedAmount)

      // Send more funds funds to the bridgeProxy (simulate successful bridging and more!)
      await user.sendTransaction({
        to: origin.proxyBridge,
        value: bridgedAmount * 2n,
      })

      await relayPool.claim(origin.chainId, origin.bridge)

      const outstandingDebtAfter = await relayPool.outstandingDebt()
      expect(outstandingDebtAfter).to.equal(0)
    })

    it('should not fail if there are extra funds in the bridge proxy contract on multiple origins', async () => {
      const [user] = await ethers.getSigners()

      // Borrow from the pool so we can claim later
      await relayPool.handle(
        origin.chainId,
        ethers.zeroPadValue(origin.bridge, 32),
        encodeData(9n, userAddress, bridgedAmount)
      )

      await relayPool.handle(
        anotherOrigin.chainId,
        ethers.zeroPadValue(anotherOrigin.bridge, 32),
        encodeData(10n, userAddress, bridgedAmount)
      )

      const streamingPeriod = await relayPool.streamingPeriod()
      await ethers.provider.send('evm_increaseTime', [
        Number(streamingPeriod * 2n),
      ])
      await relayPool.updateStreamedAssets()

      const outstandingDebtBefore = await relayPool.outstandingDebt()
      expect(outstandingDebtBefore).to.equal(bridgedAmount * 2n)

      // Send funds funds to the bridgeProxy (simulate successful bridging twice!)
      await user.sendTransaction({
        to: origin.proxyBridge,
        value: bridgedAmount * 2n,
      })

      await user.sendTransaction({
        to: anotherOrigin.proxyBridge,
        value: bridgedAmount,
      })

      await relayPool.claim(origin.chainId, origin.bridge)

      expect(await relayPool.outstandingDebt()).to.equal(bridgedAmount)

      await relayPool.claim(anotherOrigin.chainId, anotherOrigin.bridge)

      expect(await relayPool.outstandingDebt()).to.equal(0)
    })
  })

  describe('unauthorized claims', () => {
    let origin: any
    let bridgedAmount: bigint
    it('should prevent from claiming from unauthorized chain', async () => {
      // add origin
      const bridgeProxyParameters = {
        OPStackNativeBridgeProxy: {
          portalProxy,
          relayPoolChainId: 100,
          relayPool: await relayPool.getAddress(),
          l1BridgeProxy: ethers.ZeroAddress,
        },
      }
      const { bridge: opBridgeProxy } = await ignition.deploy(
        OPStackNativeBridgeProxyModule,
        {
          parameters: bridgeProxyParameters,
        }
      )

      origin = {
        chainId: 10,
        bridge: relayBridgeOptimism, // should not matter
        maxDebt: ethers.parseEther('10'),
        proxyBridge: await opBridgeProxy.getAddress(),
        bridgeFee: 10,
        curator: userAddress,
        coolDown: 0,
      }

      relayPool.addOrigin(origin)

      // Fund the pool with some WETH
      await myWeth.deposit({ value: ethers.parseEther('3') })
      await myWeth.approve(await relayPool.getAddress(), ethers.parseEther('3'))
      await relayPool.deposit(ethers.parseEther('3'), userAddress)

      bridgedAmount = ethers.parseEther('0.2')

      // Borrow from the pool so we can claim later
      await relayPool.handle(
        origin.chainId,
        ethers.zeroPadValue(origin.bridge, 32),
        encodeData(10n, userAddress, bridgedAmount)
      )

      // Send the funds to the bridgeProxy (simulate successful bridging)
      const [user] = await ethers.getSigners()
      await user.sendTransaction({
        to: origin.proxyBridge,
        value: bridgedAmount,
      })

      expect(
        await ethers.provider.getBalance(origin.proxyBridge)
      ).to.be.greaterThan(0)

      // will revert here as block.chainid should be 100
      await reverts(
        relayPool.claim(origin.chainId, origin.bridge),
        `NotAuthorized("${await relayPool.getAddress()}", 31337)`
      )
    })
    it('should prevent from claiming from unauthorized caller', async () => {
      // add origin
      const bridgeProxyParameters = {
        OPStackNativeBridgeProxy: {
          portalProxy,
          relayPoolChainId: 31337,
          relayPool: await relayPool.getAddress(),
          l1BridgeProxy: ethers.ZeroAddress,
        },
      }
      const { bridge: opBridgeProxy } = await ignition.deploy(
        OPStackNativeBridgeProxyModule,
        {
          parameters: bridgeProxyParameters,
        }
      )

      origin = {
        chainId: 10,
        bridge: relayBridgeOptimism, // should not matter
        maxDebt: ethers.parseEther('10'),
        proxyBridge: await opBridgeProxy.getAddress(),
        bridgeFee: 10,
        curator: userAddress,
        coolDown: 0,
      }

      relayPool.addOrigin(origin)

      // Fund the pool with some WETH
      await myWeth.deposit({ value: ethers.parseEther('3') })
      await myWeth.approve(await relayPool.getAddress(), ethers.parseEther('3'))
      await relayPool.deposit(ethers.parseEther('3'), userAddress)

      bridgedAmount = ethers.parseEther('0.2')

      // Borrow from the pool so we can claim later
      await relayPool.handle(
        origin.chainId,
        ethers.zeroPadValue(origin.bridge, 32),
        encodeData(11n, userAddress, bridgedAmount)
      )

      // Send the funds to the bridgeProxy (simulate successful bridging)
      const [user] = await ethers.getSigners()
      await user.sendTransaction({
        to: origin.proxyBridge,
        value: bridgedAmount,
      })

      expect(
        await ethers.provider.getBalance(origin.proxyBridge)
      ).to.be.greaterThan(0)

      // will revert here as block.chainid should be
      const maliciousBridge = await ethers.deployContract('MaliciousBridge')
      await reverts(
        maliciousBridge.claim(origin.chainId, origin.bridge),
        `NotAuthorized("${await relayPool.getAddress()}", 31337)`
      )
    })
  })
})

describe('RelayPool: claim for an ERC20', () => {
  let relayPool: RelayPool
  let myWeth: MyWeth
  let myToken: MyToken

  let thirdPartyPool: MyYieldPool
  let userAddress: string
  let myOpStackPortal: MyOpStackPortal
  let origin, bridgedAmount: bigint

  before(async () => {
    const [user] = await ethers.getSigners()
    userAddress = await user.getAddress()

    myWeth = await ethers.deployContract('MyWeth')
    myToken = await ethers.deployContract('MyToken', ['My Token', 'TOKEN'])

    // deploy 3rd party pool
    thirdPartyPool = await ethers.deployContract('MyYieldPool', [
      await myToken.getAddress(),
      'My Yield Pool',
      'YIELD',
    ])
    const thirdPartyPoolAddress = await thirdPartyPool.getAddress()
    // Initialize the pool with a little bit of funds
    const initialDeposit = ethers.parseEther('1')
    await myToken.approve(thirdPartyPoolAddress, initialDeposit)
    await thirdPartyPool.deposit(initialDeposit, userAddress)

    myOpStackPortal = await ethers.deployContract('MyOpStackPortal')

    // deploy the pool using ignition
    const parameters = {
      RelayPool: {
        hyperlaneMailbox: userAddress, // networks[1].hyperlaneMailbox,
        asset: await myToken.getAddress(),
        name: `${await myToken.name()} Relay Pool`,
        symbol: `${await myToken.symbol()}-REL`,
        thirdPartyPool: thirdPartyPoolAddress,
        weth: await myWeth.getAddress(),
        curator: userAddress,
      },
    }
    ;({ relayPool } = await ignition.deploy(RelayPoolModule, {
      parameters,
    }))

    // Add origins (we use and OPStack origin here)
    const bridgeProxyParameters = {
      OPStackNativeBridgeProxy: {
        portalProxy,
        relayPoolChainId: 31337,
        relayPool: await relayPool.getAddress(),
        l1BridgeProxy: ethers.ZeroAddress,
      },
    }
    const { bridge } = await ignition.deploy(OPStackNativeBridgeProxyModule, {
      parameters: bridgeProxyParameters,
    })

    origin = {
      chainId: 10,
      bridge: relayBridgeOptimism, // should not matter
      maxDebt: ethers.parseEther('10'),
      proxyBridge: await bridge.getAddress(),
      bridgeFee: 10,
      curator: userAddress,
      coolDown: 0,
    }

    relayPool.addOrigin(origin)

    // Fund the pool with some tokens
    const initialDepositTokens = ethers.parseUnits(
      '3',
      await myToken.decimals()
    )
    await myToken.mint(initialDepositTokens)
    await myToken.approve(await relayPool.getAddress(), initialDepositTokens)
    await relayPool.deposit(initialDepositTokens, userAddress)

    bridgedAmount = ethers.parseEther('0.2')
  })

  it('should claim the ERC20 and wrap to WETH from the origin contract', async () => {
    // Borrow from the pool so we can claim later
    await relayPool.handle(
      origin.chainId,
      ethers.zeroPadValue(origin.bridge, 32),
      encodeData(5n, userAddress, bridgedAmount)
    )

    // Send the funds to the bridgeProxy (simulate successful bridging)
    await myToken.mintFor(bridgedAmount, origin.proxyBridge)

    expect(await myToken.balanceOf(origin.proxyBridge)).to.be.greaterThan(0)

    await relayPool.claim(origin.chainId, origin.bridge)

    expect(await myToken.balanceOf(origin.proxyBridge)).to.equal(0)
    expect(await myToken.balanceOf(await relayPool.getAddress())).to.equal(0)
  })

  it('should update the outstanding debts', async () => {
    const [user] = await ethers.getSigners()

    // Borrow from the pool so we can claim later
    await relayPool.handle(
      origin.chainId,
      ethers.zeroPadValue(origin.bridge, 32),
      encodeData(6n, userAddress, bridgedAmount)
    )

    const outstandingDebtBefore = await relayPool.outstandingDebt()
    expect(outstandingDebtBefore).to.greaterThan(0)
    const originSettingsBefore = await relayPool.authorizedOrigins(
      origin.chainId,
      origin.bridge
    )
    expect(originSettingsBefore.outstandingDebt).to.greaterThan(0)

    // Send the funds to the bridgeProxy (simulate successful bridging)
    await myToken.mintFor(bridgedAmount, origin.proxyBridge)

    // Claim
    await relayPool.claim(origin.chainId, origin.bridge)
    const outstandingDebtAfter = await relayPool.outstandingDebt()
    const originSettingsAfter = await relayPool.authorizedOrigins(
      origin.chainId,
      origin.bridge
    )

    expect(outstandingDebtBefore - outstandingDebtAfter).to.equal(bridgedAmount)
    expect(
      originSettingsBefore.outstandingDebt - originSettingsAfter.outstandingDebt
    ).to.equal(bridgedAmount)
  })

  it('should desposit the funds in the 3rd party pool but total assets should remain unchanged', async () => {
    const [user] = await ethers.getSigners()

    // Borrow from the pool so we can claim later
    await relayPool.handle(
      origin.chainId,
      ethers.zeroPadValue(origin.bridge, 32),
      encodeData(7n, userAddress, bridgedAmount)
    )

    const streamingPeriod = await relayPool.streamingPeriod()
    await ethers.provider.send('evm_increaseTime', [
      Number(streamingPeriod * 2n),
    ])
    await relayPool.updateStreamedAssets()
    const poolAssetsBefore = await relayPool.totalAssets()

    const relayPoolBalanceBefore = await thirdPartyPool.balanceOf(
      await relayPool.getAddress()
    )

    // Send the funds to the bridgeProxy (simulate successful bridging)
    await myToken.mintFor(bridgedAmount, origin.proxyBridge)

    await relayPool.claim(origin.chainId, origin.bridge)

    const poolAssetsAfter = await relayPool.totalAssets()

    const relayPoolBalanceAfter = await thirdPartyPool.balanceOf(
      await relayPool.getAddress()
    )
    // Assets remain unchanged (they were previously accounted for "in the bridge")
    expect(poolAssetsAfter).to.equal(poolAssetsBefore)

    // But the balance of the relay pool in the 3rd party pool should have increased
    expect(relayPoolBalanceAfter - relayPoolBalanceBefore).to.equal(
      bridgedAmount
    )
  })
})
