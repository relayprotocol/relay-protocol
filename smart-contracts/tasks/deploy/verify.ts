import { task } from 'hardhat/config'

task(
  'deploy:verify',
  'Verifies a contract utility, includes retries and wait times'
).setAction(async ({ address, constructorArguments }, { ethers }) => {
  const { chainId } = await ethers.provider.getNetwork()
  if (chainId === 31337n) {
    // Not verifying on hardhat
    return
  }

  // Wait for the transaction to be mined before verifying!
  let attempts = 0
  let verified = false
  console.log(`Verifying... ${address}`)

  while (!verified) {
    attempts += 1
    await run('verify:verify', {
      address,
      constructorArguments,
    })
      .then(() => {
        verified = true
      })
      .catch(async (e) => {
        console.error(e)
        if (attempts >= 10) {
          throw e
        }
        await new Promise((resolve) => setTimeout(resolve, 3000))
      })
  }
  console.log(`Verified ${address}`)
  return address
})
