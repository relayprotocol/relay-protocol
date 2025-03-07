import { task } from 'hardhat/config'

// deploy a simple ERC4626 pool for testing purposes
task('deploy:dummy-yield-pool', 'Deploy a dummy yield pool')
  .addParam('asset', 'An ERC20 asset')
  .setAction(async ({ asset }, { ethers, run }) => {
    console.log({ asset })
    // parse asset metadata
    const assetContract = await ethers.getContractAt('MyToken', asset)
    const name = `${await assetContract.name()} Dummy Yield Pool`
    const symbol = `${await assetContract.symbol()}-YIELD`
    const yieldPool = await ethers.deployContract('MyYieldPool', [
      asset,
      name,
      symbol,
    ])
    const yieldPoolAddress = await yieldPool.getAddress()
    console.log(`Dummy yield pool deployed at ${yieldPoolAddress}`)

    await run('deploy:verify', {
      address: yieldPoolAddress,
      constructorArguments: [asset, name, symbol],
    })
    return yieldPoolAddress
  })
