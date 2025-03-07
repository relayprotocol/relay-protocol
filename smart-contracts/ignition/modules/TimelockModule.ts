import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

export default buildModule('Timelock', (m) => {
  const timelock = m.contract('TimelockControllerUpgradeable', [])
  return { timelock }
})
