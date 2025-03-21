import { http } from 'viem'
import networks from '@relay-protocol/networks'

/**
 * Get the RPC URL for a given chain ID
 * @param chainId - The chain ID
 * @returns The RPC URL
 */
const getRpcUrl = (chainId: number): string => {
  const url = networks[chainId].rpc[0]
  if (!url) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return url
}

/**
 * Create a network config for a given chain ID
 * @param chainId - The chain ID
 * @returns The network config
 */
export const createNetworkConfig = (chainId: number) => ({
  chainId,
  transport: http(getRpcUrl(chainId)),
})
