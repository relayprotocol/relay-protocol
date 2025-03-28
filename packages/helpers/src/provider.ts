import { ethers, type JsonRpcResult } from 'ethers'
import { networks } from '@relay-protocol/networks'

export const getProvider = (chainId: bigint | string | number) => {
  const { rpc } = networks[chainId.toString()]
  const provider = new ethers.JsonRpcProvider(rpc[0]) // pick the first rpc endpoint
  return provider
}

// use for OP stack networks
export const fetchRawProof = async (
  slot: string,
  blockHash: string,
  chainId: bigint | string
) => {
  // here we need a RPC that implements the `eth_getProof` method
  // unlock (quicknode) does
  const rpc = `https://rpc.unlock-protocol.com/${chainId.toString()}`

  // const r = chainId === 10n ? 'https://optimism-rpc.publicnode.com' : rpc[0]
  const params = [
    '0x4200000000000000000000000000000000000016', // MessagePasser
    [slot],
    blockHash,
  ]
  // console.log({ params, r })
  const resp = await fetch(rpc, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_getProof',
      params,
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

export const fetchRawBlock = async (
  chainId: bigint | string,
  blockHash: string
) => {
  const { rpc } = networks[chainId.toString()]
  const resp = await fetch(rpc[0], {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_getBlockByHash',
      params: [blockHash, false],
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
