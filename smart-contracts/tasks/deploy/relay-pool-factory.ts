import { task } from 'hardhat/config'

import { networks } from '@relay-protocol/networks'
import RelayPoolFactoryModule from '../../ignition/modules/RelayPoolFactoryModule'

task('deploy:pool-factory', 'Deploy a relay pool factory')
  .addOptionalParam('timelock', 'The Timelock contract to use')
  .setAction(async (_, { ethers, ignition, run }) => {
    // get args value
    const { chainId } = await ethers.provider.getNetwork()
    const {
      hyperlaneMailbox,
      name: networkName,
      assets: { weth },
    } = networks[chainId.toString()]
    console.log(`deploying on ${networkName} (${chainId})...`)

    // deploy the pool using ignition
    const parameters = {
      RelayPoolFactory: {
        hyperlaneMailbox,
        weth,
      },
    }

    const deploymentId = `RelayPoolFactory-${chainId.toString()}`
    const { relayPoolFactory, timelockTemplate } = await ignition.deploy(
      RelayPoolFactoryModule,
      {
        parameters,
        deploymentId,
      }
    )

    const poolFactoryAddress = await relayPoolFactory.getAddress()

    console.log(`relayPoolFactory deployed to: ${poolFactoryAddress}`)

    await run('deploy:verify', {
      address: await timelockTemplate.getAddress(),
      constructorArguments: [],
    })

    await run('deploy:verify', {
      address: poolFactoryAddress,
      constructorArguments: [
        hyperlaneMailbox,
        weth,
        await timelockTemplate.getAddress(),
      ],
    })
  })
