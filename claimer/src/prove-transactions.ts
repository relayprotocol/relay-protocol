import { gql } from 'graphql-request'
import { RelayVaultService } from '@relay-protocol/client'
import networks from '@relay-protocol/networks'
import OPstack from './op'
import { L2NetworkConfig } from '@relay-protocol/types'

const GET_ALL_TRANSACTIONS_TO_PROVE = gql`
  query GetAllBridgeTransactionsToProve(
    $nativeBridgeStatus: String!
    $originChainIds: [Int]
    $originTimestamp: BigInt!
  ) {
    bridgeTransactions(
      where: {
        nativeBridgeStatus: $nativeBridgeStatus
        originChainId_in: $originChainIds
        originTimestamp_lt: $originTimestamp
      }
    ) {
      items {
        originBridgeAddress
        nonce
        originChainId
        destinationPoolAddress
        destinationPoolChainId
        originSender
        destinationRecipient
        asset
        amount
        hyperlaneMessageId
        nativeBridgeStatus
        opProofTxHash
        nativeBridgeFinalizedTxHash
        loanEmittedTxHash
        originTimestamp
        originTxHash
      }
    }
  }
`

const OpChains: (number | bigint)[] = (
  Object.values(networks) as L2NetworkConfig[]
)
  .filter((n) => n.stack === 'op')
  .map((n) => n.chainId)

// Take all transactions that are initiated and attempts to prove them!
export const proveTransactions = async ({
  vaultService,
}: {
  vaultService: RelayVaultService
}) => {
  const { bridgeTransactions } = await vaultService.query(
    GET_ALL_TRANSACTIONS_TO_PROVE,
    {
      nativeBridgeStatus: 'INITIATED',
      originTimestamp: Math.floor(new Date().getTime() / 1000) - 60 * 30, // 30 minutes required for OP proofs: TODO:  move to config since some networks may have different rules?
      originChainIds: OpChains,
    }
  )
  for (let i = 0; i < bridgeTransactions.items.length; i++) {
    // try {
    const bridgeTransaction = bridgeTransactions.items[i]
    // TODO: use `proxyBridge` to identify which underlying bridge was actually used and
    // how to process it.
    // For now we use the chainId to identify the bridge (that won't work for USDC!)
    await OPstack.submitProof(bridgeTransaction)
    // } catch (error) {
    //   console.error(error)
    // }
  }
}
