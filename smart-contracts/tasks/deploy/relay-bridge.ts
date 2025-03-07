import { task } from 'hardhat/config'
import { networks } from '@relay-protocol/networks'
import { AutoComplete } from 'enquirer'
import { getAddresses } from '@relay-protocol/addresses'
import { getEvent } from '@relay-protocol/helpers'

task('deploy:bridge', 'Deploy a bridge proxy')
  .addOptionalParam('proxyBridge', 'The Proxy bridge asset')
  .addOptionalParam('asset', 'An ERC20 asset')
  .setAction(
    async (
      { asset: assetAddress, proxyBridge: proxyBridgeAddress },
      { ethers }
    ) => {
      const { chainId } = await ethers.provider.getNetwork()
      const deployedContracts = (await getAddresses())[chainId.toString()]

      if (!deployedContracts) {
        throw new Error(
          'This chain does not have any deployed contracts. Please deploy BridgeProxy and RelayBridgeFactory first.'
        )
      }

      const { RelayBridgeFactory } = deployedContracts

      const { assets, l1ChainId, bridges } = networks[chainId.toString()]

      if (!l1ChainId) {
        throw new Error('This chain does not have a corresponding L1 chain')
      }

      if (!RelayBridgeFactory) {
        throw new Error('This chain does not have a RelayBridgeFactory')
      }

      if (!proxyBridgeAddress) {
        // List proxyBirdges, and select one the!
        const proxyBridgeType = await new AutoComplete({
          name: 'proxyBridgeType',
          message: 'Please choose a proxy bridge type:',
          choices: Object.keys(bridges),
        }).run()
        // Err, we ned to deploy one here!
        proxyBridgeAddress = await run('deploy:bridge-proxy', {
          type: proxyBridgeType,
        })

        // proxyBridgeAddress = BridgeProxy[proxyBridgeType]
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
        RelayBridgeFactory
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

      console.log(`RelayBridge deployed to: ${event.args.bridge}`)
    }
  )
