import { task } from 'hardhat/config'

import RelayPoolNativeGatewayModule from '../../ignition/modules/RelayPoolNativeGatewayModule'

task('deploy:native-gateway', 'Deploy a WETH/Native gateway for a relay vault')
  .addParam('pool', 'A realy pool address')
  .setAction(async ({ pool }, { ethers, ignition }) => {
    const { chainId } = await ethers.provider.getNetwork()

    const poolContract = new ethers.Contract(
      pool,
      ['function asset() view returns (address)'],
      ethers.provider
    )

    const weth = await poolContract.asset()

    // deploy the pool using ignition
    const parameters = {
      RelayPoolNativeGateway: {
        pool,
        weth,
      },
    }

    const { nativeGateway } = await ignition.deploy(
      RelayPoolNativeGatewayModule,
      {
        deploymentId: `RelayPoolNativeGateway-${chainId.toString()}`,
        parameters,
      }
    )
    console.log(
      `WETH/ETH native gateway deployed to: ${await nativeGateway.getAddress()}`
    )
  })
