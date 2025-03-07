import { task } from 'hardhat/config'

import RelayBridgeFactoryModule from '../../ignition/modules/RelayBridgeFactoryModule'
import networks from '@relay-protocol/networks'
import { deployContract } from '../../lib/zksync'

task('deploy:bridge-factory', 'Deploy a relay bridge factory').setAction(
  async (_params, hre) => {
    const { ethers, ignition } = hre

    // get args value
    const { chainId } = await ethers.provider.getNetwork()
    const networkConfig = networks[chainId.toString()]
    if (!networkConfig) {
      throw new Error(
        `Unsupported network ${chainId}. Please add it to networks.ts`
      )
    }
    const { hyperlaneMailbox, name: networkName, isZKsync } = networkConfig

    console.log(`deploying on ${networkName} (${chainId})...`)

    let relayBridgeAddress: string
    if (isZKsync) {
      ;({ address: relayBridgeAddress } = await deployContract(
        hre,
        'RelayBridgeFactory',
        [hyperlaneMailbox]
      ))
    } else {
      // deploy the pool using ignition
      const parameters = {
        RelayBridgeFactory: {
          hyperlaneMailbox,
        },
      }

      const { relayBridgeFactory } = await ignition.deploy(
        RelayBridgeFactoryModule,
        {
          parameters,
          deploymentId: `RelayBridgeFactory-${chainId.toString()}`,
        }
      )
      relayBridgeAddress = await relayBridgeFactory.getAddress()
    }
    await run('deploy:verify', {
      address: relayBridgeAddress,
      constructorArguments: [hyperlaneMailbox],
    })
    console.log(`relayBridgeFactory deployed to: ${relayBridgeAddress}`)
  }
)
