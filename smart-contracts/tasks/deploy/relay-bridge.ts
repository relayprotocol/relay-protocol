import { task } from 'hardhat/config'
import { networks } from '@relay-protocol/networks'
import { AutoComplete, Input } from 'enquirer'
import { getEvent } from '@relay-protocol/helpers'

task('deploy:bridge', 'Deploy a bridge proxy')
  .addParam('factory', 'The Bridge Factory address')
  .addOptionalParam('proxyBridge', 'The Proxy bridge asset')
  .addOptionalParam('asset', 'An ERC20 asset')
  .setAction(
    async (
      { factory, asset: assetAddress, proxyBridge: proxyBridgeAddress },
      { ethers }
    ) => {
      const { chainId } = await ethers.provider.getNetwork()

      const { assets, bridges } = networks[chainId.toString()]

      if (!proxyBridgeAddress) {
        proxyBridgeAddress = await new Input({
          name: 'proxyBridgeAddress',
          message:
            'Please enter a proxy bridge address on this network or type enter to deploy a new one:',
        }).run()
        // Err, we need to deploy one here!
        if (!proxyBridgeAddress) {
          proxyBridgeAddress = await run('deploy:bridge-proxy', {})
        }
      }

      if (!assetAddress) {
        const asset = await new AutoComplete({
          name: 'asset',
          message:
            'Please choose the asset for your relay bridge (make sure it is supported by the proxy bridge you selected):',
          choices: ['native', ...Object.keys(assets)],
        }).run()
        if (asset === 'native') {
          assetAddress = ethers.ZeroAddress
        } else {
          assetAddress = assets[asset]
        }
      }

      const factoryContract = await ethers.getContractAt(
        'RelayBridgeFactory',
        factory
      )

      const tx = await factoryContract.deployBridge(
        assetAddress,
        proxyBridgeAddress
      )
      const receipt = await tx.wait()
      const event = await getEvent(
        receipt!,
        'BridgeDeployed',
        factoryContract.interface
      )
      const bridgeAddress = event.args.bridge

      await run('deploy:verify', {
        address: bridgeAddress,
        constructorArguments: [
          assetAddress,
          proxyBridgeAddress,
          await factoryContract.HYPERLANE_MAILBOX(),
        ],
      })

      console.log(`✅ RelayBridge deployed to: ${bridgeAddress}`)
    }
  )
