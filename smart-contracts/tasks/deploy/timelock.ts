import { task } from 'hardhat/config'
import TimelockModule from '../../ignition/modules/TimelockModule'

task('deploy:timelock', 'Deploy a timelock contract').setAction(
  async (_, { ethers, ignition }) => {
    const { chainId } = await ethers.provider.getNetwork()

    const deploymentId = `Timelock-${chainId.toString()}`
    const { timelock } = await ignition.deploy(TimelockModule, {
      deploymentId,
    })

    const poolFactoryAddress = await timelock.getAddress()

    console.log(`timelock deployed to: ${poolFactoryAddress}`)

    return run('deploy:verify', {
      address: await timelock.getAddress(),
    })
  }
)
