// hardhat ignition is not supported rn
// https://github.com/NomicFoundation/hardhat-ignition/issues/825
import  { Deployer } from '@matterlabs/hardhat-zksync'
import { type JsonRpcResult } from 'ethers'
import networks from '@relay-protocol/networks'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

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
        contract,
        constructorArguments: deployArgs,
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
  const { deployer } = await zkSyncSetupDeployer(hre)
  const artifact = await deployer.loadArtifact(contractNameOrFullyQualifiedName)

  const deploymentFee = await deployer.estimateDeployFee(artifact, deployArgs)
  const parsedFee = hre.ethers.formatEther(deploymentFee.toString())
  console.log(`Deployment is estimated to cost ${parsedFee} ETH`)

  const contract = await deployer.deploy(artifact, deployArgs)

  await contract.waitForDeployment()
  const address = await contract.getAddress()
  const { hash } = await contract.deploymentTransaction()

  // verify
  await verifyContract({
    hre,
    address,
    contract: contractNameOrFullyQualifiedName,
    deployArgs,
  })
  return {
    contract,
    hash,
    address,
  }
}

async function zkSyncSetupDeployer(hre: HardhatRuntimeEnvironment) {
  // set deployer
  const wallet = await hre.zksyncEthers.getWallet(0)
  const deployer = new Deployer(hre, wallet)
  return { wallet, deployer }
}
