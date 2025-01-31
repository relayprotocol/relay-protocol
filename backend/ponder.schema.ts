import { index, onchainTable, primaryKey, relations } from 'ponder'

/**
 * Track yield pools
 * - contractAddress: Contract address
 * - asset: Asset (token) address
 * - name: Pool name
 * - totalAssets: Total assets in pool
 * - totalShares: Total shares issued
 * - lastUpdated: Last time the pool was updated
 */
export const yieldPool = onchainTable('yield_pool', (t) => ({
  contractAddress: t.hex().primaryKey(),
  asset: t.hex().notNull(),
  name: t.text().notNull(),
  totalAssets: t.bigint().notNull(),
  totalShares: t.bigint().notNull(),
  lastUpdated: t.bigint().notNull(),
}))

/**
 * Track relay pools
 * - contractAddress: Contract address
 * - curator: Address of the curator
 * - asset: Asset (token) address
 * - yieldPool: Yield pool address
 * - outstandingDebt: Current outstanding debt
 * - totalAssets: Total assets in pool
 * - totalShares: Total shares issued
 * - chainId: Chain ID where the pool is deployed
 * - createdAt: Block timestamp of creation
 * - createdAtBlock: Block number of creation
 */
export const relayPool = onchainTable(
  'relay_pool',
  (t) => ({
    contractAddress: t.hex().primaryKey(),
    curator: t.hex().notNull(),
    asset: t.hex().notNull(),
    yieldPool: t.hex().notNull(),
    outstandingDebt: t.bigint().notNull(),
    totalAssets: t.bigint().notNull(),
    totalShares: t.bigint().notNull(),
    chainId: t.integer().notNull(),
    createdAt: t.bigint().notNull(),
    createdAtBlock: t.bigint().notNull(),
    name: t.text().notNull(),
    symbol: t.text().notNull(),
  }),
  (table) => ({
    yieldPoolIdx: index().on(table.yieldPool),
  })
)

export const poolOrigin = onchainTable(
  'pool_origin',
  (t) => ({
    chainId: t.integer().notNull(),
    pool: t.hex().notNull(),
    proxyBridge: t.hex().notNull(),
    originChainId: t.integer().notNull(),
    originBridge: t.hex().notNull(),
    maxDebt: t.bigint().notNull(),
    bridgeFee: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [
        table.chainId,
        table.pool,
        table.originChainId,
        table.originBridge,
      ],
    }),
    poolIdx: index().on(table.chainId, table.pool),
    originIdx: index().on(table.originChainId, table.originBridge),
  })
)

export const poolOriginsRelation = relations(relayPool, ({ many }) => ({
  origins: many(poolOrigin),
}))

export const originPoolRelation = relations(poolOrigin, ({ one }) => ({
  pool: one(relayPool, {
    fields: [poolOrigin.pool],
    references: [relayPool.contractAddress],
  }),
}))

/**
 * Track pool deposits/withdrawals
 * - id: Unique ID (tx hash + log index)
 * - type: DEPOSIT or WITHDRAW
 * - user: User address
 * - relayPool: Pool address
 * - assets: Amount of assets
 * - shares: Amount of shares
 * - timestamp: Block timestamp
 * - blockNumber: Block number
 * - transactionHash: Transaction hash
 */
export const poolAction = onchainTable('pool_action', (t) => ({
  id: t.text().primaryKey(),
  type: t.text().notNull(),
  user: t.hex().notNull(),
  relayPool: t.hex().notNull(),
  assets: t.bigint().notNull(),
  shares: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  transactionHash: t.hex().notNull(),
}))

/**
 * Track user balances across all pools
 */
export const userBalance = onchainTable('user_balance', (t) => ({
  id: t.text().primaryKey(), // Composite ID: wallet-pool
  wallet: t.hex().notNull(),
  relayPool: t.hex().notNull(),
  shareBalance: t.bigint().notNull(),
  totalDeposited: t.bigint().notNull(),
  totalWithdrawn: t.bigint().notNull(),
  lastUpdated: t.bigint().notNull(),
}))

/**
 * Relations for user balance
 */
export const userBalanceRelations = relations(userBalance, ({ one }) => ({
  pool: one(relayPool, {
    fields: [userBalance.relayPool],
    references: [relayPool.contractAddress],
  }),
}))

/**
 * Relations for relay pool
 */
export const relayPoolRelations = relations(relayPool, ({ many }) => ({
  userBalances: many(userBalance),
}))

export const relayBridge = onchainTable('relay_bridge', (t) => ({
  chainId: t.integer().notNull(),
  contractAddress: t.hex().primaryKey(),
  asset: t.hex().notNull(),
  transferNonce: t.bigint().notNull(),
  createdAt: t.bigint().notNull(),
  createdAtBlock: t.bigint().notNull(),
}))

/**
 * Track bridge transactions across chains
 *
 * Bridge identification:
 * - originBridgeAddress: Bridge contract initiating the transfer
 * - nonce: Unique nonce from the origin bridge
 * - originChainId: Source chain ID
 *
 * Chain/Pool info:
 * - destinationPoolAddress: Destination pool that will receive funds
 * - destinationPoolChainId: Chain ID of the destination pool
 *
 * Transaction participants:
 * - originSender: User who initiated the bridge
 * - destinationRecipient: Address receiving the instant loan
 *
 * Asset details:
 * - asset: Asset contract address being bridged
 * - amount: Amount of asset being bridged
 *
 * Hyperlane:
 * - hyperlaneMessageId: ID of the fast Hyperlane message
 *
 * Bridge status:
 * - nativeBridgeStatus: INITIATED, PROVEN, FINALIZED
 * - nativeBridgeProofTxHash: Transaction hash of proof submission
 * - nativeBridgeFinalizedTxHash: Transaction hash of finalization
 *
 * Loan tracking:
 * - loanEmittedTxHash: Transaction hash of loan emission
 *
 * Origin transaction:
 * - originTimestamp: Block timestamp when bridge was initiated
 * - originTxHash: Transaction hash of the bridge initiation
 */
export const bridgeTransaction = onchainTable(
  'bridge_transaction',
  (t) => ({
    originBridgeAddress: t.hex().notNull(),
    nonce: t.bigint().notNull(),
    originChainId: t.integer().notNull(),
    destinationPoolAddress: t.hex().notNull(),
    destinationPoolChainId: t.integer().notNull(),
    originSender: t.hex().notNull(),
    destinationRecipient: t.hex().notNull(),
    asset: t.hex().notNull(),
    amount: t.bigint().notNull(),
    hyperlaneMessageId: t.hex(),
    nativeBridgeStatus: t.text().notNull(),
    nativeBridgeProofTxHash: t.hex(),
    nativeBridgeFinalizedTxHash: t.hex(),
    loanEmittedTxHash: t.hex(),
    originTimestamp: t.bigint().notNull(),
    originTxHash: t.hex().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.originChainId, table.originBridgeAddress, table.nonce],
    }),
    poolIdx: index().on(
      table.destinationPoolChainId,
      table.destinationPoolAddress
    ),
    senderIdx: index().on(table.originSender),
    assetIdx: index().on(table.asset),
  })
)

// relation between poolOrigin and bridgeTransaction
export const poolOriginBridgeTransactions = relations(
  poolOrigin,
  ({ many }) => ({
    transactions: many(bridgeTransaction),
  })
)

// reverse relation between bridgeTransaction and poolOrigin
export const bridgeTransactionOrigin = relations(
  bridgeTransaction,
  ({ one }) => ({
    origin: one(poolOrigin, {
      fields: [
        bridgeTransaction.destinationPoolChainId,
        bridgeTransaction.destinationPoolAddress,
        bridgeTransaction.originChainId,
        bridgeTransaction.originBridgeAddress,
      ],
      references: [
        poolOrigin.chainId,
        poolOrigin.pool,
        poolOrigin.originChainId,
        poolOrigin.originBridge,
      ],
    }),
  })
)
