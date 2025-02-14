import { gql } from 'graphql-request'
import { RelayVaultService } from '@relay-protocol/client'
import OPstack from './op'
import Orbit from './orbit'
import networks from '@relay-protocol/networks'

const GET_ALL_TRANSACTIONS_TO_CLAIM = gql`
  query GetAllBridgeTransactionsToClaim($originTimestamp: BigInt!) {
    bridgeTransactions(where: { originTimestamp_lt: $originTimestamp }) {
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
        nativeBridgeProofTxHash
        nativeBridgeFinalizedTxHash
        loanEmittedTxHash
        originTimestamp
        originTxHash
      }
    }
  }
`

// Take all transactions that are ready to be claimed!
export const claimTransactions = async ({
  vaultService,
}: {
  vaultService: RelayVaultService
}) => {
  const { bridgeTransactions } = await vaultService.query(
    GET_ALL_TRANSACTIONS_TO_CLAIM,
    {
      originTimestamp: Math.floor(new Date().getTime() / 1000) - 60 * 60 * 24, // TODO:  move to config since some networks may have different rules?
    }
  )
  for (let i = 0; i < bridgeTransactions.items.length; i++) {
    const bridgeTransaction = bridgeTransactions.items[i]
    try {
      // TODO: use `proxyBridge` to identify which underlying bridge was actually used and
      // how to process it.

      const originNetwork = networks[bridgeTransaction.originChainId]
      if (!originNetwork) {
        console.error(
          `Unknown origin chainId ${bridgeTransaction.originChainId}`
        )
        continue
      } else if (originNetwork.stack === 'op') {
        await OPstack.claimWithdrawal(bridgeTransaction)
      } else if (originNetwork.stack === 'arb') {
        await Orbit.claimWithdrawal(bridgeTransaction)
      } else {
        console.log(originNetwork.stack)
      }
    } catch (error) {
      console.error(error)
      console.log(bridgeTransaction)
    }
  }
}
