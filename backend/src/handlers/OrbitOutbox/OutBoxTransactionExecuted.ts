import { eq } from 'ponder'
import { Context, Event } from 'ponder:registry'
import { bridgeTransaction } from 'ponder:schema'

export default async function ({
  event,
  context,
}: {
  event: Event<'RelayBridge:OutBoxTransactionExecuted'>
  context: Context<'RelayBridge:OutBoxTransactionExecuted'>
}) {
  await context.db.sql
    .update(bridgeTransaction)
    .set({
      nativeBridgeStatus: 'FINALIZED',
    })
    .where(
      eq(bridgeTransaction.arbTransactionIndex, event.args.transactionIndex)
    )
}
