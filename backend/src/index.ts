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
 * Updates:
 * - Pool total assets and shares
 * - User balance records
 * - Yield pool state
 * - Creates pool action record
 */
ponder.on('RelayPool:Deposit', Deposit)

/**
 * Handles withdrawals from the RelayPool
 * Updates:
 * - Pool total assets and shares
 * - User balance records
 * - Yield pool state
 * - Creates pool action record
 */
ponder.on('RelayPool:Withdraw', Withdraw)

/**
 * Handles the deployment of a new RelayPool
 * Creates:
 * - New relay pool record
 * - Associated yield pool record
 * - Initial origin configurations
 */
ponder.on('RelayPoolFactory:PoolDeployed', PoolDeployed)

/**
 * Handles the deployment of a new RelayBridge
 * Creates:
 * - New bridge contract record
 * - Initializes transfer nonce tracking
 */
ponder.on('RelayBridgeFactory:BridgeDeployed', BridgeDeployed)

/**
 * Handles the initiation of a RelayBridge transaction
 * Creates:
 * - Bridge transaction record
 * - Links origin and destination pools
 * - Tracks cross-chain message status
 */
ponder.on('RelayBridge:BridgeInitiated', BridgeInitiated)

/**
 * Handles the addition of a new origin to a RelayPool
 * Creates:
 * - New pool origin record
 * - Links bridge and proxy bridge contracts
 * - Sets initial debt limits
 */
ponder.on('RelayPool:OriginAdded', OriginAdded)
