import { task } from 'hardhat/config'

import RelayPoolNativeGatewayModule from '../../ignition/modules/RelayPoolNativeGatewayModule'
import { networks } from '@relay-protocol/networks'

task(
  'deploy:native-gateway',
  'Deploy a WETH/Native gateway for a relay vault'
).setAction(async (_, { ethers, ignition }) => {
  const { chainId } = await ethers.provider.getNetwork()

  const {
    assets: { weth },
  } = networks[chainId.toString()]
  // deploy the pool using ignition
  const parameters = {
    RelayPoolNativeGateway: {
      weth,
    },
  }

  const { nativeGateway } = await ignition.deploy(
    RelayPoolNativeGatewayModule,
    {
      parameters,
      deploymentId: `RelayPoolNativeGateway-${chainId.toString()}`,
    }
  )

  const address = await nativeGateway.getAddress()
  await run('deploy:verify', {
    address: await nativeGateway.getAddress(),
    constructorArguments: [weth],
  })
  console.log(`✅ Pool Native Gateway deployed to: ${address}`)
})
