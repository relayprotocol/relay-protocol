import { Context, Event } from 'ponder:registry'
import { poolAction, relayPool, userBalance } from 'ponder:schema'

export default async function ({
  event,
  context,
}: {
  event: Event<'RelayPool:Withdraw'>
  context: Context<'RelayPool:Withdraw'>
}) {
  const { owner, receiver, assets, shares } = event.args
  const blockNumber = event.block.number
  const transactionHash = event.transaction.hash
  const timestamp = event.block.timestamp

  // Get the relay pool to find its yield pool
  const pool = await context.db.find(relayPool, {
    contractAddress: event.log.address,
    chainId: context.network.chainId,
  })

  if (!pool) {
    throw new Error(`Relay pool ${event.log.address} not found`)
  }

  // Fetch current state from relay pool
  const [relayTotalAssets, relayTotalShares] = await Promise.all([
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
  ])

  // Update states
  await Promise.all([
    // Update relay pool
    context.db
      .update(relayPool, {
        contractAddress: event.log.address,
        chainId: context.network.chainId,
      })
      .set({
        totalAssets: relayTotalAssets,
        totalShares: relayTotalShares,
      }),

    // Record pool action
    context.db.insert(poolAction).values({
      id: `${transactionHash}-${event.log.logIndex}`,
      type: 'WITHDRAW',
      user: owner,
      receiver,
      owner,
      relayPool: event.log.address,
      assets,
      shares,
      timestamp,
      blockNumber,
      transactionHash,
      chainId: context.network.chainId,
    }),
  ])

  // Get user balance
  const user = await context.db.find(userBalance, {
    wallet: owner,
    relayPool: event.log.address,
    chainId: context.network.chainId,
  })

  // Update user balance
  await context.db
    .update(userBalance, {
      wallet: owner,
      relayPool: event.log.address,
      chainId: context.network.chainId,
    })
    .set({
      shareBalance: user.shareBalance - shares,
      totalWithdrawn: user.totalWithdrawn + assets,
      lastUpdated: timestamp,
    })
}
