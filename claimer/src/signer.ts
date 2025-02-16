import { NetworkConfig } from '@relay-protocol/types'
import { ethers } from 'ethers'

// This is a singleton signer that is used to sign transactions
let signer: ethers.Wallet

export const getSignerForNetwork = async (network: NetworkConfig) => {
  if (!signer) {
    const provider = new ethers.JsonRpcProvider(network.rpc[0])
    signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)
    console.log(`Signer address: ${signer.address}`)
  } else {
    const provider = new ethers.JsonRpcProvider(network.rpc[0])
    signer.connect(provider)
  }
  return signer
}
