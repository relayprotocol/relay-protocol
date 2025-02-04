import { Context, Event } from 'ponder:registry'
import { poolAction, relayPool, userBalance, yieldPool } from 'ponder:schema'
import { erc4626Abi } from 'viem'

export default async function ({
  event,
  context,
}: {
  event: Event<'RelayPool:Deposit'>
  context: Context<'RelayPool:Deposit'>
}) {
  const { owner, assets, shares } = event.args
  const blockNumber = event.block.number
  const transactionHash = event.transaction.hash
  const timestamp = event.block.timestamp

  // Generate unique ID using transaction hash and log index
  const eventId = `${transactionHash}-${event.log.logIndex}`

  // Get the relay pool to find its yield pool
  const pool = await context.db.find(relayPool, {
    contractAddress: event.log.address,
  })

  if (!pool) {
    throw new Error(`Relay pool ${event.log.address} not found`)
  }

  // Fetch current state from both pools
  const [
    relayTotalAssets,
    relayTotalShares,
    yieldTotalAssets,
    yieldTotalShares,
  ] = await Promise.all([
    context.client.readContract({
      abi: context.contracts.RelayPool.abi,
      address: event.log.address,
      functionName: 'totalAssets',
    }),
    context.client.readContract({
      abi: context.contracts.RelayPool.abi,
      address: event.log.address,
      functionName: 'totalSupply',
    }),
    context.client.readContract({
      abi: erc4626Abi,
      address: pool.yieldPool,
      functionName: 'totalAssets',
    }),
    context.client.readContract({
      abi: erc4626Abi,
      address: pool.yieldPool,
      functionName: 'totalSupply',
    }),
  ])

  // Update both pools atomically
  await Promise.all([
    // Update relay pool
    context.db.update(relayPool, { contractAddress: event.log.address }).set({
      totalAssets: relayTotalAssets,
      totalShares: relayTotalShares,
    }),

    // Update yield pool
    context.db.update(yieldPool, { contractAddress: pool.yieldPool }).set({
      totalAssets: yieldTotalAssets,
      totalShares: yieldTotalShares,
      lastUpdated: BigInt(timestamp),
    }),

    // Record pool action
    context.db.insert(poolAction).values({
      id: eventId,
      type: 'DEPOSIT',
      user: owner,
      receiver: event.log.address,
      owner: event.log.address,
      relayPool: event.log.address,
      assets,
      shares,
      timestamp,
      blockNumber,
      transactionHash,
    }),
  ])

  // Update user balance - using owner for the balance tracking
  const balanceId = `${owner}-${event.log.address}` // wallet-pool format

  await context.db
    .insert(userBalance)
    .values({
      id: balanceId,
      wallet: owner,
      relayPool: event.log.address,
      shareBalance: shares,
      totalDeposited: assets,
      totalWithdrawn: 0n,
      lastUpdated: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      shareBalance: row.shareBalance + shares,
      totalDeposited: row.totalDeposited + assets,
      lastUpdated: timestamp,
    }))
}
