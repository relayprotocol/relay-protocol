import { gql } from 'graphql-request'

export const GET_ALL_POOLS = gql`
  query GetAllPools {
    relayPools(limit: 10) {
      items {
        contractAddress
        asset
        chainId
        name
        symbol
        outstandingDebt
        totalAssets
        totalShares
        curator
        origins(limit: 10) {
          totalCount
          items {
            proxyBridge
            originChainId
            originBridge
          }
        }
      }
    }
  }
`

export const GET_RELAY_POOL = gql`
  query GetRelayPool($contractAddress: String!) {
    relayPool(contractAddress: $contractAddress) {
      contractAddress
      curator
      asset
      yieldPool
      outstandingDebt
      totalAssets
      totalShares
      chainId
      createdAt
      createdAtBlock
    }
  }
`

export const GET_RELAY_BRIDGES_BY_NETWORK_AND_ASSET = gql`
  query GetRelayBridgesByNetworkAndAsset(
    $chainId: Int!
    $assetAddress: String!
  ) {
    relayBridges(where: { asset: $assetAddress, chainId: $chainId }) {
      items {
        contractAddress
        chainId
        asset
        transferNonce
        createdAt
        createdAtBlock
      }
    }
  }
`

export const GET_USER_BALANCES = gql`
  query GetUserBalances($walletAddress: String!) {
    userBalances(where: { wallet: $walletAddress }) {
      items {
        relayPool
        balance
        pool {
          contractAddress
          chainId
          asset
          totalAssets
          totalShares
          outstandingDebt
        }
      }
    }
  }
`

export const GET_USER_BALANCE_IN_POOL = gql`
  query GetUserBalanceInPool($walletAddress: String!, $poolAddress: String!) {
    userBalances(where: { wallet: $walletAddress, relayPool: $poolAddress }) {
      items {
        relayPool
        balance
        totalDeposited
        totalWithdrawn
        lastUpdated
        pool {
          contractAddress
          chainId
          asset
          totalAssets
          totalShares
          outstandingDebt
        }
      }
    }
  }
`

export const GET_POOLS_BY_CURATOR = gql`
  query GetPoolsByCurator($curatorAddress: String!) {
    relayPools(where: { curator: $curatorAddress }) {
      items {
        contractAddress
        asset
        chainId
        name
        symbol
        outstandingDebt
        totalAssets
        totalShares
        curator
        origins(limit: 10) {
          totalCount
          items {
            proxyBridge
            originChainId
            originBridge
          }
        }
      }
    }
  }
`

export const GET_ORIGINS_WITH_BRIDGE = gql`
  query OriginsWithBridge($originChainId: Int!, $originBridge: String!) {
    poolOrigins(
      where: { originChainId: $originChainId, originBridge: $originBridge }
    ) {
      items {
        pool {
          contractAddress
          chainId
          name
          asset
          curator
          totalAssets
          totalShares
        }
        proxyBridge
        maxDebt
      }
    }
  }
`

export const GET_ALL_BRIDGE_TRANSACTIONS_BY_TYPE = gql`
  query GetAllBridgeTransactionsByType($nativeBridgeStatus: String!) {
    bridgeTransactions(where: { nativeBridgeStatus: $nativeBridgeStatus }) {
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
