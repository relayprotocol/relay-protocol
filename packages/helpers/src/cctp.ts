/**
 * Helpers for CCTP bridge
 */
import { ethers } from 'ethers-v6'
import { networks } from '@relay-protocol/networks'
import { getProvider } from './provider'

export async function getCCTPMessageBytes(
  transactionHash: string,
  chainId: bigint | string
) {
  // decode message on origin chain
  const provider = await getProvider(chainId)

  const transactionReceipt =
    await provider.getTransactionReceipt(transactionHash)
  const eventTopic = ethers.solidityPackedKeccak256(
    ['string'],
    ['MessageSent(bytes)']
  )
  const log = transactionReceipt?.logs.find((l) => l.topics[0] === eventTopic)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder()
  const messageBytes = abiCoder.decode(['bytes'], log!.data)[0]
  return messageBytes
}

export async function getCCTPAttestation(
  transactionHash: string,
  chainId: bigint | string
) {
  const messageBytes = await getCCTPMessageBytes(transactionHash, chainId)
  const messageHash = ethers.keccak256(messageBytes)

  // get attestation from Circle's servers
  const { isTestnet } = networks[chainId.toString()]
  const url = `https://${isTestnet ? 'iris-api-sandbox' : 'iris-api'}.circle.com/attestations/${messageHash}`
  const resp = await fetch(url)
  const { attestation, status } = (await resp.json()) as any
  return { attestation, messageBytes, messageHash, status }
}
