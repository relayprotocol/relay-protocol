import { index, onchainTable, primaryKey, relations } from 'ponder'

/**
 * Track yield pools
 * - contractAddress: Contract address
 * - asset: Asset (token) address
 * - name: Yield pool name
 * - lastUpdated: Last time the yield pool was updated
 */
export const yieldPool = onchainTable(
  'yield_pool',
  (t) => ({
    contractAddress: t.hex().notNull(),
    asset: t.hex().notNull(),
    name: t.text().notNull(),
    lastUpdated: t.bigint().notNull(),
    chainId: t.integer().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainId, table.contractAddress],
    }),
    assetIdx: index().on(table.asset),
    chainIdIdx: index().on(table.chainId),
  })
)

/**
 * Track relay pools
 * - contractAddress: Contract address
 * - curator: Address of the curator
 * - asset: Asset (token) address
 * - yieldPool: Yield pool address
 * - outstandingDebt: Current outstanding debt
 * - totalAssets: Total assets in pool
 * - totalShares: Total shares issued
 * - totalBridgeFees: Total bridge fees accumulated
 * - chainId: Chain ID where the pool is deployed
 * - createdAt: Block timestamp of creation
 * - createdAtBlock: Block number of creation
 */
export const relayPool = onchainTable(
  'relay_pool',
  (t) => ({
    contractAddress: t.hex().notNull(),
    curator: t.hex().notNull(),
    asset: t.hex().notNull(),
    yieldPool: t.hex().notNull(),
    outstandingDebt: t.bigint().notNull(),
    totalAssets: t.bigint().notNull(),
    totalShares: t.bigint().notNull(),
    totalBridgeFees: t.bigint().notNull(),
    chainId: t.integer().notNull(),
    createdAt: t.bigint().notNull(),
    createdAtBlock: t.bigint().notNull(),
    name: t.text().notNull(),
    symbol: t.text().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainId, table.contractAddress],
    }),
    yieldPoolIdx: index().on(table.yieldPool),
    assetIdx: index().on(table.asset),
    curatorIdx: index().on(table.curator),
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
    currentOutstandingDebt: t.bigint().notNull(),
    curator: t.hex().notNull(),
    bridgeFee: t.integer().notNull(),
    coolDown: t.integer().notNull(),
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
  chainId: t.integer().notNull(),
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
    fields: [userBalance.relayPool, userBalance.chainId],
    references: [relayPool.contractAddress, relayPool.chainId], // TODO: Add chainId!
  }),
}))

/**
 * Relations for relay pool
 */
export const relayPoolRelations = relations(relayPool, ({ many }) => ({
  userBalances: many(userBalance),
  snapshots: many(vaultSnapshot),
}))

export const relayBridge = onchainTable(
  'relay_bridge',
  (t) => ({
    chainId: t.integer().notNull(),
    contractAddress: t.hex().notNull(),
    asset: t.hex().notNull(),
    transferNonce: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    createdAtBlock: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainId, table.contractAddress],
    }),
    assetIdx: index().on(table.asset),
  })
)

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
 * - nativeBridgeFinalizedTxHash: Transaction hash of finalization
 *
 * Loan tracking:
 * - loanEmittedTxHash: Transaction hash of loan emission
 *
 * Origin transaction:
 * - originTimestamp: Block timestamp when bridge was initiated
 * - originTxHash: Transaction hash of the bridge initiation
 *
 * OP Specifics:
 * - opWithdrawalHash: Withdrawal hash
 * - opProofTxHash: Transaction hash of proof submission
 *
 * ARB Specifics:
 * - arbTransactionIndex
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
    hyperlaneMessageId: t.hex().notNull(),
    nativeBridgeStatus: t.text().notNull(),
    opProofTxHash: t.hex(),
    nativeBridgeFinalizedTxHash: t.hex(),
    loanEmittedTxHash: t.hex(),
    originTimestamp: t.bigint().notNull(),
    originTxHash: t.hex().notNull(),
    opWithdrawalHash: t.hex(),
    arbTransactionIndex: t.bigint(),
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
    originTxHashIdx: index().on(table.originTxHash),
    opWithdrawalHashIdx: index().on(table.opWithdrawalHash),
    arbTransactionIndex: index().on(table.arbTransactionIndex),
  })
)

/**
 * Track vault share price snapshots over time
 * - id: Composite primary key in format vault-blockNumber
 * - vault: Vault (pool) contract address
 * - chainId: Chain ID of the vault
 * - blockNumber: Block number when the snapshot was taken
 * - timestamp: Block timestamp when the snapshot was taken
 * - sharePrice: Share price at snapshot time, computed via convertToAssets(1e18)
 */
export const vaultSnapshot = onchainTable(
  'vaultSnapshot',
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    chainId: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    sharePrice: t.numeric().notNull(),
    yieldPoolSharePrice: t.numeric().notNull(),
  }),
  (table) => ({
    vaultChainIdx: index().on(table.vault, table.chainId),
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

// Update the relation to include chainId in the join condition
export const vaultSnapshotRelations = relations(vaultSnapshot, ({ one }) => ({
  pool: one(relayPool, {
    fields: [vaultSnapshot.vault, vaultSnapshot.chainId],
    references: [relayPool.contractAddress, relayPool.chainId],
  }),
}))
