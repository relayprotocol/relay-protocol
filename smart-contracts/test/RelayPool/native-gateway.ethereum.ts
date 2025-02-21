import { expect } from 'chai'
import { ethers, ignition } from 'hardhat'

import { networks } from '@relay-protocol/networks'
import { IWETH, RelayPool, RelayPoolNativeGateway } from '../../typechain-types'
import { getBalance } from '@relay-protocol/helpers'
import { reverts } from '../utils/errors'
const {
  assets: { weth: WETH },
  hyperlaneMailbox,
} = networks[1]
import RelayPoolModule from '../../ignition/modules/RelayPoolModule'

let weth: IWETH
let relayPool: RelayPool
let nativeGateway: RelayPoolNativeGateway
let relayPoolAddress: string
let thirdPartyPoolAddress: string

describe('RelayPoolNativeGateway', () => {
  before(async () => {
    weth = await ethers.getContractAt('IWETH', WETH)
  })

  describe('when using the native token', () => {
    before(async () => {
      const [user] = await ethers.getSigners()
      const userAddress = await user.getAddress()
      // deploy 3rd party pool
      const thirdPartyPool = await ethers.deployContract('MyYieldPool', [
        WETH,
        'My Yield Pool',
        'YIELD',
      ])
      thirdPartyPoolAddress = await thirdPartyPool.getAddress()

      // deploy the WETH pool
      const parameters = {
        RelayPool: {
          hyperlaneMailbox,
          asset: WETH,
          name: 'WETH RELAY POOL',
          symbol: 'WETH-REL',
          thirdPartyPool: thirdPartyPoolAddress,
          weth: WETH,
          curator: userAddress,
        },
      }
      ;({ relayPool } = await ignition.deploy(RelayPoolModule, {
        parameters,
      }))
      relayPoolAddress = await relayPool.getAddress()

      // deploy native wrapper
      nativeGateway = await ethers.deployContract('RelayPoolNativeGateway', [
        WETH,
      ])
    })

    it('should let user initiate the pool by using the wrapped native token', async () => {
      expect(await relayPool.decimals()).to.equal(18)
      expect(await relayPool.name()).to.equal('WETH RELAY POOL')
      expect(await relayPool.symbol()).to.equal('WETH-REL')
      expect(await relayPool.asset()).to.equal(WETH)
      expect(await relayPool.totalAssets()).to.equal(0)
      expect(await relayPool.totalSupply()).to.equal(0)
    })

    it('should let user deposit funds and receive shares', async () => {
      const [user] = await ethers.getSigners()
      const amount = ethers.parseUnits('1', 18)

      const userAddress = await user.getAddress()
      const totalAssets = await relayPool.totalAssets()
      const totalSupply = await relayPool.totalSupply()
      const sharesBalance = await relayPool.balanceOf(userAddress)
      const tokenBalance = await getBalance(
        await relayPool.getAddress(),
        WETH!,
        ethers.provider
      )

      // Preview the deposit
      const newShares = await relayPool.previewDeposit(amount)
      expect(newShares).to.equal(ethers.parseUnits('1', 18)) // 1 for 1

      // Deposit tokens to the RelayPool via the gateway
      await nativeGateway
        .connect(user)
        .deposit(relayPoolAddress, userAddress, { value: amount })

      // Total assets should have increased
      expect(await relayPool.totalAssets()).to.equal(totalAssets + amount)
      // Total supply should have increased
      expect(await relayPool.totalSupply()).to.equal(totalSupply + newShares)
      // Balance of shares for user should be correct
      expect(await relayPool.balanceOf(userAddress)).to.equal(
        sharesBalance + newShares
      )
      // Balance of assets for the pool should be correct!
      expect(
        await getBalance(thirdPartyPoolAddress, WETH, ethers.provider)
      ).to.equal(tokenBalance + amount)
    })

    it('should let user mint shares (by approving assets first)', async () => {
      const [user] = await ethers.getSigners()
      const newShares = ethers.parseUnits('1', 18)

      const userAddress = await user.getAddress()
      const totalAssets = await relayPool.totalAssets()
      const totalSupply = await relayPool.totalSupply()
      const sharesBalance = await relayPool.balanceOf(userAddress)

      // Preview the mint
      const amount = await relayPool.previewMint(newShares)
      expect(amount).to.equal(ethers.parseUnits('1', 18)) // 1 for 1!

      // Mint shares
      await nativeGateway
        .connect(user)
        .mint(relayPoolAddress, userAddress, { value: amount })

      // Total assets should have increased
      expect(await relayPool.totalAssets()).to.equal(totalAssets + amount)
      // Total supply should have increased
      expect(await relayPool.totalSupply()).to.equal(totalSupply + newShares)
      // Balance of shares for user should be correct
      expect(await relayPool.balanceOf(userAddress)).to.equal(
        sharesBalance + newShares
      )
      // Balance of assets for the pool should be correct!
      expect(await weth.balanceOf(thirdPartyPoolAddress)).to.equal(
        totalAssets + amount
      )
    })

    it('should let user redeem shares they received after a deposit', async () => {
      const [, secondUser] = await ethers.getSigners()
      const amount = ethers.parseUnits('1', 18)
      const userAddress = await secondUser.getAddress()
      const totalAssets = await relayPool.totalAssets()
      const totalSupply = await relayPool.totalSupply()
      const sharesBalance = await relayPool.balanceOf(userAddress)

      // Preview the deposit
      const newShares = await relayPool.previewDeposit(amount)
      expect(newShares).to.equal(ethers.parseUnits('1', 18)) // 1 for 1

      // Deposit tokens to the RelayPool
      await nativeGateway
        .connect(secondUser)
        .deposit(relayPoolAddress, userAddress, { value: amount })

      // Total assets should have increased
      expect(await relayPool.totalAssets()).to.equal(totalAssets + amount)
      // Total supply should have increased
      expect(await relayPool.totalSupply()).to.equal(totalSupply + newShares)
      // Balance of shares for user should be correct
      expect(await relayPool.balanceOf(userAddress)).to.equal(
        sharesBalance + newShares
      )

      // Burn shares (only half!)
      const sharesToBurn = ethers.parseUnits('0.5', 18)
      // Preview the redeem
      const assetsToReceive = await relayPool.previewRedeem(sharesToBurn)
      expect(assetsToReceive).to.equal(ethers.parseUnits('0.5', 18))

      // Approve shares to be withdraw by the Gateway
      await (
        await relayPool
          .connect(secondUser)
          .approve(await nativeGateway.getAddress(), amount)
      ).wait()

      // redeem
      await nativeGateway
        .connect(secondUser)
        .redeem(relayPoolAddress, sharesToBurn, userAddress)

      // Total assets should have decreased
      expect(await relayPool.totalAssets()).to.equal(
        totalAssets + amount - assetsToReceive
      )
      // Total supply should have decreased
      expect(await relayPool.totalSupply()).to.equal(
        totalSupply + newShares - sharesToBurn
      )
      // Balance of shares for user should be correct
      expect(await relayPool.balanceOf(userAddress)).to.equal(
        sharesBalance + newShares - sharesToBurn
      )
    })

    it('should let user redeem shares they minted', async () => {
      const [, secondUser] = await ethers.getSigners()
      const userAddress = await secondUser.getAddress()
      const totalAssets = await relayPool.totalAssets()
      const totalSupply = await relayPool.totalSupply()
      const sharesBalance = await relayPool.balanceOf(userAddress)

      const newShares = ethers.parseUnits('0.4', 18)

      // Preview the mint
      const amount = await relayPool.previewMint(newShares)
      expect(amount).to.equal(ethers.parseUnits('0.4', 18)) // 1 for 1

      // Deposit tokens to the RelayPool
      await nativeGateway
        .connect(secondUser)
        .mint(relayPoolAddress, userAddress, { value: amount })

      // Total assets should have increased
      expect(await relayPool.totalAssets()).to.equal(totalAssets + amount)
      // Total supply should have increased
      expect(await relayPool.totalSupply()).to.equal(totalSupply + newShares)
      // Balance of shares for user should be correct
      expect(await relayPool.balanceOf(userAddress)).to.equal(
        sharesBalance + newShares
      )

      // Burn shares (half of them!)
      const sharesToBurn = ethers.parseUnits('0.2', 18)

      // Preview the redeem
      const assetsToReceive = await relayPool.previewRedeem(sharesToBurn)
      expect(assetsToReceive).to.equal(ethers.parseUnits('0.2', 18))

      // Approve shares to be withdraw by the Gateway
      await (
        await relayPool
          .connect(secondUser)
          .approve(await nativeGateway.getAddress(), assetsToReceive)
      ).wait()

      await nativeGateway
        .connect(secondUser)
        .redeem(relayPoolAddress, sharesToBurn, userAddress)

      // Total assets should have increased
      expect(await relayPool.totalAssets()).to.equal(
        totalAssets + amount - assetsToReceive
      )
      // Total supply should have increased
      expect(await relayPool.totalSupply()).to.equal(
        totalSupply + newShares - sharesToBurn
      )
      // Balance of shares for user should be correct
      expect(await relayPool.balanceOf(userAddress)).to.equal(
        sharesBalance + newShares - sharesToBurn
      )
    })

    it('should let user withdraw assets they deposited', async () => {
      const [, secondUser] = await ethers.getSigners()
      const amount = ethers.parseUnits('1', 18)
      const userAddress = await secondUser.getAddress()
      const totalAssets = await relayPool.totalAssets()
      const totalSupply = await relayPool.totalSupply()
      const sharesBalance = await relayPool.balanceOf(userAddress)

      // Preview the deposit
      const newShares = await relayPool.previewDeposit(amount)
      expect(newShares).to.equal(ethers.parseUnits('1', 18)) // 1 for 1

      // Deposit tokens to the RelayPool
      await nativeGateway
        .connect(secondUser)
        .deposit(relayPoolAddress, userAddress, { value: amount })

      // Total assets should have increased
      expect(await relayPool.totalAssets()).to.equal(totalAssets + amount)
      // Total supply should have increased
      expect(await relayPool.totalSupply()).to.equal(totalSupply + newShares)
      // Balance of shares for user should be correct
      expect(await relayPool.balanceOf(userAddress)).to.equal(
        sharesBalance + newShares
      )

      const assetsToReceive = ethers.parseUnits('0.5', 18)

      // Preview the withdrawal
      const sharesToBeBurnt = await relayPool.previewWithdraw(assetsToReceive)
      expect(sharesToBeBurnt).to.equal(ethers.parseUnits('0.5', 18))

      // Approve shares to be withdraw by the Gateway
      await (
        await relayPool
          .connect(secondUser)
          .approve(await nativeGateway.getAddress(), amount)
      ).wait()

      await nativeGateway
        .connect(secondUser)
        .withdraw(relayPoolAddress, assetsToReceive, userAddress)

      expect(await relayPool.totalAssets()).to.equal(
        totalAssets + amount - assetsToReceive
      )
      expect(await relayPool.totalSupply()).to.equal(
        totalSupply + newShares - sharesToBeBurnt
      )
      // Balance of shares for user should be correct
      expect(await relayPool.balanceOf(userAddress)).to.equal(
        sharesBalance + newShares - sharesToBeBurnt
      )
    })

    it('should let user withdraw assets they deposited thru a mint', async () => {
      const [, secondUser] = await ethers.getSigners()
      const userAddress = await secondUser.getAddress()
      const totalAssets = await relayPool.totalAssets()
      const totalSupply = await relayPool.totalSupply()
      const sharesBalance = await relayPool.balanceOf(userAddress)

      const newShares = ethers.parseUnits('0.4', 18)

      // Preview the mint
      const amount = await relayPool.previewMint(newShares)
      expect(amount).to.equal(ethers.parseUnits('0.4', 18)) // 1 for 1

      // Deposit tokens to the RelayPool
      await nativeGateway
        .connect(secondUser)
        .mint(relayPoolAddress, userAddress, { value: amount })

      // Total assets should have increased
      expect(await relayPool.totalAssets()).to.equal(totalAssets + amount)
      // Total supply should have increased
      expect(await relayPool.totalSupply()).to.equal(totalSupply + newShares)
      // Balance of shares for user should be correct
      expect(await relayPool.balanceOf(userAddress)).to.equal(
        sharesBalance + newShares
      )

      const assetsToReceive = ethers.parseUnits('0.1', 18)

      // Preview the withdrawal
      const sharesToBeBurnt = await relayPool.previewWithdraw(assetsToReceive)

      expect(sharesToBeBurnt).to.equal(ethers.parseUnits('0.1', 18))

      // Approve shares to be withdraw by the Gateway
      await (
        await relayPool
          .connect(secondUser)
          .approve(await nativeGateway.getAddress(), amount)
      ).wait()

      await nativeGateway
        .connect(secondUser)
        .withdraw(relayPoolAddress, assetsToReceive, userAddress)

      expect(await relayPool.totalAssets()).to.equal(
        totalAssets + amount - assetsToReceive
      )
      expect(await relayPool.totalSupply()).to.equal(
        totalSupply + newShares - sharesToBeBurnt
      )
      // Balance of shares for user should be correct
      expect(await relayPool.balanceOf(userAddress)).to.equal(
        sharesBalance + newShares - sharesToBeBurnt
      )
    })

    it('should reject new assets being added to the pool through receive', async () => {
      const [user] = await ethers.getSigners()

      // send native tokens to the gateway
      await reverts(
        user.sendTransaction({
          to: await nativeGateway.getAddress(),
          value: ethers.parseUnits('1', 18),
        }),
        'OnlyWethCanSendEth()'
      )
    })

    it('should not allow any balance to get locked in the contract', async () => {
      const [, secondUser] = await ethers.getSigners()
      const userAddress = await secondUser.getAddress()

      const amount = ethers.parseUnits('1', 18)

      // Deposit tokens to the RelayPool
      await nativeGateway
        .connect(secondUser)
        .mint(relayPoolAddress, userAddress, { value: amount })

      // redeem the shares
      const shares = await relayPool.balanceOf(userAddress)
      await (
        await relayPool
          .connect(secondUser)
          .approve(await nativeGateway.getAddress(), shares)
      ).wait()
      await nativeGateway
        .connect(secondUser)
        .redeem(relayPoolAddress, shares, userAddress)

      expect(await weth.balanceOf(await nativeGateway.getAddress())).to.equal(0)
    })
  })
})
