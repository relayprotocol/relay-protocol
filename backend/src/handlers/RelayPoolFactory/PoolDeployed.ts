import { Context, Event } from 'ponder:registry'
import { poolOrigin, relayPool, yieldPool } from 'ponder:schema'
import { erc4626Abi, erc20Abi } from 'viem'

export default async function ({
  event,
  context,
}: {
  event: Event<'RelayPoolFactory:PoolDeployed'>
  context: Context<'RelayPoolFactory:PoolDeployed'>
}) {
  const { pool, asset, creator, thirdPartyPool, origins } = event.args

  // First create or update the yield pool entry
  const [totalAssets, totalShares, name, symbol] = await Promise.all([
    context.client.readContract({
      abi: erc4626Abi,
      address: thirdPartyPool,
      functionName: 'totalAssets',
    }),
    context.client.readContract({
      abi: erc4626Abi,
      address: thirdPartyPool,
      functionName: 'totalSupply',
    }),
    context.client.readContract({
      abi: erc20Abi,
      address: thirdPartyPool,
      functionName: 'name',
    }),
    context.client.readContract({
      abi: erc20Abi,
      address: thirdPartyPool,
      functionName: 'symbol',
    }),
  ])

  // Use upsert pattern for yield pool
  await context.db
    .insert(yieldPool)
    .values({
      contractAddress: thirdPartyPool as `0x${string}`,
      asset: asset as `0x${string}`,
      name,
      totalAssets,
      totalShares,
      lastUpdated: BigInt(event.block.timestamp),
    })
    .onConflictDoUpdate({
      totalAssets,
      totalShares,
      lastUpdated: BigInt(event.block.timestamp),
    })

  // Create a pool for each of these!
  await context.db.insert(relayPool).values({
    contractAddress: pool as `0x${string}`,
    asset: asset as `0x${string}`,
    curator: creator as `0x${string}`,
    yieldPool: thirdPartyPool as `0x${string}`,
    outstandingDebt: BigInt(0),
    totalAssets: BigInt(0),
    totalShares: BigInt(0),
    chainId: context.network.chainId,
    createdAt: BigInt(new Date().getTime()),
    createdAtBlock: event.block.number,
    name,
    symbol,
  })

  // Create origins as well
  await Promise.all(
    origins.map(async ({ chainId, bridge, proxyBridge, maxDebt }) => {
      await context.db.insert(poolOrigin).values({
        chainId: context.network.chainId,
        pool: pool as `0x${string}`,
        proxyBridge: proxyBridge as `0x${string}`,
        originChainId: chainId,
        originBridge: bridge as `0x${string}`,
        maxDebt: maxDebt,
      })
    })
  )
}
