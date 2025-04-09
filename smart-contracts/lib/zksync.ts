// hardhat ignition is not supported rn
// https://github.com/NomicFoundation/hardhat-ignition/issues/825
import { Deployer } from '@matterlabs/hardhat-zksync'
import { type JsonRpcResult } from 'ethers'
import networks from '@relay-protocol/networks'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { outputJSON } from 'fs-extra'
import path from 'path'

// add to ignition deployments folder
async function createIgnitionManifest(
  chainId: bigint,
  contractName: string,
  deployedAddress: string
) {
  const jsonFilePath = path.join(
    __dirname,
    '..',
    `ignition/deployments/${contractName}-${chainId.toString()}/deployed_addresses.json`
  )
  console.log(jsonFilePath)
  const key = `${contractName}#${contractName}`
  const data = {
    [key]: deployedAddress,
  }
  console.log(data)
  await outputJSON(jsonFilePath, data, { spaces: 2 })
}

export async function getZkSyncBridgeContracts(chainId: bigint) {
  const { rpc } = networks[chainId!.toString()]
  const rpcURL = rpc[0]
  const resp = await fetch(rpcURL, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'zks_getBridgeContracts',
      params: [],
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const { result } = (await resp.json()) as JsonRpcResult
  return result
}

export const verifyContract = async ({
  hre,
  address,
  deployArgs,
  contract,
}: {
  hre: HardhatRuntimeEnvironment
  address: string
  deployArgs?: any
  contract: string
}) => {
  const { run } = hre
  let tries = 0
  while (tries < 5) {
    try {
      await run('verify:verify', {
        address,
        constructorArguments: deployArgs,
        contract,
      })
      tries++
    } catch (error) {
      if (tries >= 5) {
        console.log(
          `FAIL: Verification failed for contract at ${address} with args : ${deployArgs.toString()} after 5 tries.`
        )
        console.log(error)
        return
      } else {
        console.log(
          `FAIL: Verification failed for contract at ${address} with args : ${deployArgs.toString()}. Retrying in 10 seconds`
        )
        await new Promise((resolve) => setTimeout(resolve, 10000))
      }
    }
  }
}

export async function deployContract(
  hre: HardhatRuntimeEnvironment,
  contractNameOrFullyQualifiedName: string,
  deployArgs = []
) {
  console.log('Deploying for zksync...')
  // recompile contracts for zksync beforehand
  await hre.run('compile', { zksync: true })

  const { deployer } = await zkSyncSetupDeployer(hre)
  const artifact = await deployer.loadArtifact(contractNameOrFullyQualifiedName)

  const deploymentFee = await deployer.estimateDeployFee(artifact, deployArgs)
  const parsedFee = hre.ethers.formatEther(deploymentFee.toString())
  console.log(`Deployment is estimated to cost ${parsedFee} ETH`)

  const contract = await deployer.deploy(artifact, deployArgs)
  await contract.waitForDeployment()
  const address = await contract.getAddress()

  const contractName = contractNameOrFullyQualifiedName.split(':')[0]
  const { chainId } = await hre.ethers.provider.getNetwork()
  await createIgnitionManifest(chainId, contractName, address)

  const { hash } = await contract.deploymentTransaction()

  // verify
  await verifyContract({
    address,
    contract: contractNameOrFullyQualifiedName,
    deployArgs,
    hre,
  })
  return {
    address,
    contract,
    hash,
  }
}

async function zkSyncSetupDeployer(hre: HardhatRuntimeEnvironment) {
  // set deployer
  const wallet = await hre.zksyncEthers.getWallet(0)
  const deployer = new Deployer(hre, wallet)
  return { deployer, wallet }
}
