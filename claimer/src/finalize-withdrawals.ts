import { RelayVaultService } from '@relay-protocol/client'
import { gql } from 'graphql-request'
import { finalizeWithdrawal } from './relay'
import networks from '@relay-protocol/networks'
import { ChildNetworkConfig } from '@relay-protocol/types'

const SEVEN_DAYS = 60 * 60 * 24 * 7

const GET_ALL_TRANSACTIONS_TO_FINALIZE = gql`
  query GetAllBridgeTransactionsToProve(
    $originTimestamp: BigInt!
    $originChainId: Int!
  ) {
    bridgeTransactions(
      where: {
        originTimestamp_lt: $originTimestamp
        originChainId: $originChainId
      }
    ) {
      items {
        originChainId
        destinationPoolChainId
        asset
        amount
        originTxHash
      }
    }
  }
`

export const finalizeWithdrawals = async ({
  vaultService,
}: {
  vaultService: RelayVaultService
}) => {
  // query ready withdrawal for all chains
  const bridgeTransactions = await Promise.all(
    Object.values(networks)
      .filter(({ chainId }) => chainId !== 1)
      .map(async (network) => {
        const { bridgeTransactions } = await vaultService.query(
          GET_ALL_TRANSACTIONS_TO_FINALIZE,
          {
            // custom time for each chain
            originTimestamp:
              Math.floor(new Date().getTime() / 1000) -
                (network as ChildNetworkConfig).withdrawalDelay! || SEVEN_DAYS, // 7 days for most chains
          }
        )
        return bridgeTransactions.items
      })
      .flat()
  )

  for (let i = 0; i < bridgeTransactions.length; i++) {
    try {
      const bridgeTransaction = bridgeTransactions[i]
      await finalizeWithdrawal(bridgeTransaction)
    } catch (error) {
      console.error(error)
    }
  }
}
