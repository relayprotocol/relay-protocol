import { Context, Event } from 'ponder:registry'
import { bridgeTransaction } from 'ponder:schema'
import * as ABIs from '@relay-protocol/helpers/abis'
import networks from '@relay-protocol/networks'
import { decodeEventLog } from 'viem'
import { L2NetworkConfig } from '@relay-protocol/types'

export default async function ({
  event,
  context,
}: {
  event: Event<'RelayBridge:BridgeInitiated'>
  context: Context<'RelayBridge:BridgeInitiated'>
}) {
  const networkConfig = networks[context.network.chainId] as L2NetworkConfig
  const { nonce, sender, recipient, asset, amount, poolChainId, pool } =
    event.args

  // Parse logs to find the DispatchId event and extract hyperlaneMessageId
  let hyperlaneMessageId
  let opWithdrawalHash
  let arbTransactionIndex
  const receipt = await context.client.getTransactionReceipt({
    hash: event.transaction.hash,
  })
  for (const log of receipt.logs) {
    if (
      // Hyperlane event
      log.address.toLowerCase() === networkConfig.hyperlaneMailbox.toLowerCase()
    ) {
      const event = decodeEventLog({
        abi: ABIs.Mailbox,
        data: log.data,
        topics: log.topics,
      })

      if (event.eventName === 'DispatchId') {
        hyperlaneMessageId = event.args.messageId
      }
    } else if (
      // OP event
      networkConfig.bridges.op?.messagePasser &&
      log.address.toLowerCase() ===
        networkConfig.bridges.op?.messagePasser.toLowerCase()
    ) {
      const event = decodeEventLog({
        abi: ABIs.L2ToL1MessagePasser,
        data: log.data,
        topics: log.topics,
      })

      if (event.eventName === 'MessagePassed') {
        opWithdrawalHash = event.args.withdrawalHash
      }
    } else if (
      // ARB event
      networkConfig.bridges.arb?.arbSys &&
      log.address.toLowerCase() ===
        networkConfig.bridges.arb?.arbSys.toLowerCase()
    ) {
      const event = decodeEventLog({
        abi: ABIs.IArbSys,
        data: log.data,
        topics: log.topics,
      })

      if (event.eventName === 'L2ToL1Tx') {
        arbTransactionIndex = event.args.position
      }
    }
  }

  // Record bridge initiation
  await context.db.insert(bridgeTransaction).values({
    // Bridge identification
    originBridgeAddress: event.log.address,
    nonce,

    // Chain information
    originChainId: context.network.chainId,
    destinationPoolAddress: pool,
    destinationPoolChainId: poolChainId,

    // Transaction participants
    originSender: sender,
    destinationRecipient: recipient,

    // Asset details
    asset,
    amount,

    // Hyperlane
    hyperlaneMessageId,

    // Bridge status
    nativeBridgeStatus: 'INITIATED',
    nativeBridgeFinalizedTxHash: null as any,

    // Instant loan tracking
    loanEmittedTxHash: null as any,

    // Origin transaction details
    originTimestamp: event.block.timestamp,
    originTxHash: event.transaction.hash,

    // OP Specifics
    opWithdrawalHash,
    opProofTxHash: null as any,

    // ARB Specifics
    arbTransactionIndex,
  })
}
