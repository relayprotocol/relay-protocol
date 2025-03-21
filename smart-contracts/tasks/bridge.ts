import { getBalance, checkAllowance, getEvent } from '@relay-protocol/helpers'
import { Mailbox, InterchainGasPaymaster } from '@relay-protocol/helpers/abis'
import { Select, Input } from 'enquirer'

import { task } from 'hardhat/config'
import { getBalance, checkAllowance } from '@relay-protocol/helpers'
import { networks } from '@relay-protocol/networks'

task('bridge:send', 'Send tokens to a pool across a relay bridge')
  .addOptionalParam('asset', 'The address of the asset you want to bridge')
  .addOptionalParam('bridge', 'The Relay Bridge contract address')
  .addOptionalParam('amount', 'the amount of tokens to send')
  .addOptionalParam('recipient', 'The recipient of the funds (default to self)')
  .addOptionalParam(
    'destChain',
    'the id of destination chain (default to eth mainnet)'
  )
  .setAction(
    async (
      {
        bridge: bridgeAddress,
        pool: poolAddress,
        amount,
        recipient,
        destChain = 11155111,
      },
      { ethers: rawEthers, zksyncEthers }
    ) => {
      const { chainId } = await rawEthers.provider.getNetwork()
      const net = networks[chainId.toString()]
      if (!net) {
        throw Error(
          `Unsupported network ${chainId}. Please add it to networks.ts`
        )
      }
      const ethers = net.isZksync ? zksyncEthers : rawEthers

      const [user] = await ethers.getSigners()
      const userAddress = await user.getAddress()

      if (!net) {
        throw Error(
          `Unsupported network ${chainId}. Please add it to networks.ts`
        )
      }
      const { assets, l1ChainId } = net

      if (!bridgeAddress) {
        // TODO: lookup!
      }

      const bridge = await ethers.getContractAt('RelayBridge', bridgeAddress)
      const assetAddress = await bridge.ASSET()

      let decimals = 18n
      if (assetAddress !== rawEthers.ZeroAddress) {
        const asset = await ethers.getContractAt('MyToken', assetAddress)
        decimals = await asset.decimals()
      }

      if (!amount) {
        const amountInDecimals = await new Input({
          default: '0.1',
          message: 'How much do you want to bridge?',
          name: 'amount',
        }).run()
        amount = ethers.parseUnits(amountInDecimals, decimals)
      }

      // parse default values
      if (!recipient) recipient = userAddress

      // TODO: check balance on pool as well and warn if insufficient balance on the pool!
      // TODO: check if the root actually works! (origin supported!)

      // check balance of asset to transfer
      const balance = await getBalance(
        userAddress,
        assetAddress,
        ethers.provider
      )

      if (balance < amount) {
        throw Error(
          `Insufficient balance (actual: ${balance}, expected: ${amount})`
        )
      }

      // check allowance
      if (assetAddress != rawEthers.ZeroAddress) {
        const asset = await ethers.getContractAt('MyToken', assetAddress)
        await checkAllowance(asset, bridgeAddress, amount, userAddress)
      }

      const hyperlaneFee = await bridge.getFee(amount, recipient)

      const value =
        assetAddress === rawEthers.ZeroAddress
          ? BigInt(amount) + hyperlaneFee
          : hyperlaneFee

      // check the balance of native to pay for value + hyperlaneFee
      const balanceNative = await getBalance(
        userAddress,
        rawEthers.ZeroAddress,
        ethers.provider
      )

      if (balanceNative < value) {
        throw Error(
          `Insufficient balance to cover for Hyperlane fee (actual: ${balanceNative}, expected: ${value})`
        )
      }

      let l1Asset = ethers.ZeroAddress
      if (assetAddress !== ethers.ZeroAddress) {
        throw Error('Not implemented yet')
      }

      const tx = await bridge.bridge(amount, recipient, l1Asset, {
        value,
      })

      // TODO: parse tx results
      const receipt = await tx.wait()

      const event = await getEvent(
        receipt!,
        'DispatchId',
        new ethers.Interface(Mailbox)
      )
      const dispatchId = event.args[0].substring(2)

      console.log(
        `Tx. ${tx.hash}. \nHyperlane message: https://explorer.hyperlane.xyz/message/${dispatchId} `
      )
    }
  )

task('bridge:pay-gas', 'Pay extra gas when a message is stuck')
  .addParam('messageId', 'The Hyperlane message id')
  .addParam('destChain', 'the chain destination of the pool')
  .addParam('gasAmount', 'the amount of tokens to send')
  .setAction(async ({ messageId, destChain, gasAmount }, { ethers }) => {
    const [user] = await ethers.getSigners()
    const { chainId } = await ethers.provider.getNetwork()
    const networkConfig = networks[chainId.toString()]
    const { hyperlaneHook } = networkConfig
    if (!hyperlaneHook) {
      throw Error('Hyperlane hook not found')
    }
    const paymaster = await new ethers.Contract(
      hyperlaneHook,
      InterchainGasPaymaster,
      user
    )
    const userAddress = await user.getAddress()
    const value = await paymaster.quoteGasPayment(destChain, gasAmount)
    const tx = await paymaster.payForGas(
      messageId,
      destChain,
      gasAmount,
      userAddress,
      {
        value,
      }
    )

    console.log(tx)

    // const receipt = await tx.wait()
    // console.log(receipt)
    // const ethers = isZksync ? zksyncEthers : rawEthers
    // const bridge = await ethers.getContractAt('BridgeProxy', bridgeAddress)
    // const [user] = await ethers.getSigners()
    // const userAddress = await user.getAddress()

    // // parse default values
    // if (!assetAddress) assetAddress = ethers.ZeroAddress
    // if (!recipient) recipient = userAddress
    // if (!destChain) destChain = 1

    // // check balance
    // const balance = await getBalance(
    //   userAddress,
    //   assetAddress,
    //   ethers.provider
    // )
    // if (balance < amount) {
    //   throw Error(
    //     `Insufficient balance (actual: ${balance}, expected: ${amount})`
    //   )
    // }

    // // check allowance
    // if (assetAddress != ethers.ZeroAddress) {
    //   const asset = await ethers.getContractAt('MyToken', assetAddress)
    //   await checkAllowance(asset, bridgeAddress, amount, userAddress)
    // }

    // // send tx
    // const tx = await bridge.bridge(
    //   userAddress, // sender
    //   destChain, // destinationChainId,
    //   recipient, // recipient
    //   assetAddress, // asset
    //   amount, // amount
    //   '0x', // data
    //   {
    //     value: assetAddress === ethers.ZeroAddress ? amount : 0,
    //   }
    // )

    // // parse tx results
    // const receipt = await tx.wait()
    // console.log(receipt?.logs)
    // // TODO: check for AssetsDepositedIntoYieldPool or similar
    // // const event = await getEvent(receipt, 'MessagePassed')
  })
