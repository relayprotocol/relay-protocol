import { eq, and } from 'ponder'
import { Context, Event } from 'ponder:registry'
import { bridgeTransaction } from 'ponder:schema'

export default async function ({
  event,
  context,
}: {
  event: Event<'RelayBridge:WithdrawalProven'>
  context: Context<'RelayBridge:WithdrawalProven'>
}) {
  await context.db.sql
    .update(bridgeTransaction)
    .set({
      nativeBridgeStatus: 'PROVEN',
      opProofTxHash: event.transaction.hash,
    })
    .where(
      and(
        eq(bridgeTransaction.opWithdrawalHash, event.args.withdrawalHash),
        eq(bridgeTransaction.nativeBridgeStatus, 'INITIATED')
      )
    )
}
