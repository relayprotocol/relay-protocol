/**
 * Vault Snapshot Handler
 *
 * This interval handler captures periodic snapshots of both the vault's share price and the
 * associated base yield pool's share price. For each vault (relay pool), it:
 * 1. Retrieves the vault's share price by reading the decimals and computing the share unit
 *    from the vault's contract.
 * 2. Retrieves the yield pool's share price via its contract address stored in the vault record.
 * 3. Creates a unique snapshot ID by combining the vault address, chain ID, and block number.
 * 4. Stores the snapshot with block metadata in the vaultSnapshot table.
 */

import { ponder } from 'ponder:registry'
import { vaultSnapshot, relayPool } from 'ponder:schema'
import { erc4626Abi, erc20Abi } from 'viem'

ponder.on('VaultSnapshot:block', async ({ event, context }) => {
  // Helper function to fetch share price using a contract's address
  async function fetchSharePrice(contractAddress: string) {
    // Retrieve the contract's decimals
    const decimals = await context.client.readContract({
      address: contractAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    })

    // Calculate the share unit using the contract's decimals
    const shareUnit = BigInt(10) ** BigInt(decimals)

    // Query the current share price from convertToAssets with the calculated share unit
    const sharePrice = await context.client.readContract({
      address: contractAddress,
      abi: erc4626Abi,
      functionName: 'convertToAssets',
      args: [shareUnit],
    })

    return sharePrice
  }

  // Retrieve all vaults from the relayPool table
  const vaults = await context.db.sql.select().from(relayPool).execute()

  for (const vault of vaults) {
    // Fetch vault and yield pool share prices concurrently (they are independent)
    const [vaultSharePrice, yieldPoolSharePrice] = await Promise.all([
      fetchSharePrice(vault.contractAddress), // vault's own share price
      fetchSharePrice(vault.yieldPool), // yield pool's share price
    ])

    const snapshot = {
      vault: vault.contractAddress,
      chainId: vault.chainId,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      sharePrice: vaultSharePrice.toString(),
      yieldPoolSharePrice: yieldPoolSharePrice.toString(),
    }

    await context.db.insert(vaultSnapshot).values(snapshot)
  }
})
