/**
 * This indexer tracks and maintains the state of the Relay Lending Protocol across multiple chains.
 *
 * 1. Pool transaction tracking
 * 2. Yield strategy performance metrics
 *
 * Performance Considerations:
 * - Uses efficient upsert patterns for balance updates
 * - Maintains normalized data structure for quick queries
 * - Implements proper indexing via composite keys where needed
 *
 * Database Schema Design:
 * - Pool transactions are tracked in real-time
 * - Yield strategies track both actions and current balances
 *
 * @note This indexer assumes events are received in chronological order per chain
 */

import { ponder } from 'ponder:registry'
import Deposit from './handlers/RelayPool/Deposit'
import Withdraw from './handlers/RelayPool/Withdraw'
import PoolDeployed from './handlers/RelayPoolFactory/PoolDeployed'
import BridgeDeployed from './handlers/RelayBridgeFactory/BridgeDeployed'
import BridgeInitiated from './handlers/RelayBridge/BridgeInitiated'
import OriginAdded from './handlers/RelayPool/OriginAdded'

// ============= RelayPool Events =============

/**
 * Handles deposits into the RelayPool
 *
 * Efficient patterns used:
 * - Composite ID generation for unique records
 */
ponder.on('RelayPool:Deposit', Deposit)

/**
 * Handles withdrawals from the RelayPool
 */
ponder.on('RelayPool:Withdraw', Withdraw)

ponder.on('RelayPoolFactory:PoolDeployed', PoolDeployed)

ponder.on('RelayBridgeFactory:BridgeDeployed', BridgeDeployed)

ponder.on('RelayBridge:BridgeInitiated', BridgeInitiated)

ponder.on('RelayPool:OriginAdded', OriginAdded)
