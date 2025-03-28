import { Provider, types, L1Signer } from 'zksync-ethers'
import { JsonRpcSigner } from 'ethers-v6'

/**
 * Finalizes a ZKSync withdrawal transaction
 * @param signer - The signer that will finalize the withdrawal
 * @param withdrawalHash - The hash of the withdrawal transaction to finalize
 * @param network - The network to use (defaults to Sepolia)
 * @returns The params
 */
export async function finalizeZksyncWithdrawal(
  signer: JsonRpcSigner,
  withdrawalHash: string,
  network: types.Network = types.Network.Mainnet
) {
  const zksyncProvider = Provider.getDefaultProvider(network)
  const l1Signer = L1Signer.from(signer, zksyncProvider)
  const params = await l1Signer.finalizeWithdrawalParams(withdrawalHash)
  return params
}
