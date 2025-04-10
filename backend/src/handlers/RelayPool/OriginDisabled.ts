import { Context, Event } from 'ponder:registry'
import { poolOrigin } from 'ponder:schema'

export default async function ({
  event,
  context,
}: {
  event: Event<'RelayPool:OriginDisabled'>
  context: Context<'RelayPool:OriginDisabled'>
}) {
  const poolAddress = event.log.address
  console.log(event, poolAddress)

  // uint32 chainId,
  // address bridge,
  // uint256 maxDebt,
  // uint256 outstandingDebt,
  // address proxyBridge

  // await context.db.delete(poolOrigin).where({
  //   originBridge: origin.bridge as `0x${string}`,
  //   originChainId: origin.chainId,
  //   pool: poolAddress as `0x${string}`,
  // })

  // Insert the pool origin
  // await context.db
  //   .insert(poolOrigin)
  //   .values({
  //     bridgeFee: origin.bridgeFee,
  //     chainId: context.network.chainId,
  //     coolDown: origin.coolDown,
  //     curator: origin.curator,
  //     currentOutstandingDebt: BigInt(0),
  //     maxDebt: origin.maxDebt,
  //     originBridge: origin.bridge as `0x${string}`,
  //     originChainId: origin.chainId,
  //     pool: poolAddress as `0x${string}`,
  //     proxyBridge: origin.proxyBridge as `0x${string}`,
  //   })
  //   .onConflictDoUpdate({
  //     bridgeFee: origin.bridgeFee,
  //     coolDown: origin.coolDown,
  //     curator: origin.curator,
  //     maxDebt: origin.maxDebt,
  //   })
}
