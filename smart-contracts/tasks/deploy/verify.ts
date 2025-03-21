import { task } from 'hardhat/config'
import networks from '@relay-protocol/networks'
task(
  'deploy:verify',
  'Verifies a contract utility, includes retries and wait times'
).setAction(async ({ address, constructorArguments }, { config, ethers }) => {
  const { chainId } = await ethers.provider.getNetwork()
  const etherscanNetworkName =
    Number(chainId) == 1
      ? 'mainnet'
      : networks[chainId.toString()].name.toLowerCase()

  if (!config.etherscan.apiKey[etherscanNetworkName]) {
    console.error(
      `No Etherscan API key found for ${etherscanNetworkName}. Please add one to hardhat.config.ts`
    )
    return
  }

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
        if (attempts >= 10) {
          console.error(e)
          throw e
        }
        await new Promise((resolve) => setTimeout(resolve, 3000))
      })
  }
  console.log(`Verified ${address}`)
  return address
})
