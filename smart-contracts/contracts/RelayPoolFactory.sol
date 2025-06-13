// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";

import {RelayPool} from "./RelayPool.sol";

/// @title RelayPoolTimelock
/// @author Relay Protocol
/// @notice Interface for initializing timelock contracts
/// @dev Used to initialize cloned timelock instances with proper access control
interface RelayPoolTimelock {
  /// @notice Initializes a timelock contract with the specified parameters
  /// @param minDelay The minimum delay in seconds for timelock operations
  /// @param proposers Array of addresses that can propose operations
  /// @param executors Array of addresses that can execute operations
  /// @param admin The admin address (use address(0) for no admin)
  function initialize(
    uint256 minDelay,
    address[] memory proposers,
    address[] memory executors,
    address admin
  ) external;
}

/// @title RelayPoolFactory
/// @author Relay Protocol
/// @notice Factory contract for deploying RelayPool instances with associated timelocks
/// @dev Deploys pools with timelock governance and tracks pools by asset
contract RelayPoolFactory is Ownable {
  /// @notice The Hyperlane mailbox address used by all deployed pools
  /// @dev Immutable to ensure consistency across all pools
  address public immutable HYPERLANE_MAILBOX;

  /// @notice The WETH contract address for native currency pools
  /// @dev Used when creating pools that handle native currency
  address public immutable WETH;

  /// @notice The timelock template contract to be cloned
  /// @dev Each pool gets its own timelock instance cloned from this template
  address public immutable TIMELOCK_TEMPLATE;

  /// @notice The minimum timelock delay enforced for non-owner deployments
  /// @dev Owner can deploy with shorter delays for testing/special cases
  uint256 public immutable MIN_TIMELOCK_DELAY;

  /// @notice Mapping from asset address to array of deployed pool addresses
  /// @dev Multiple pools can exist for the same asset
  mapping(address => address[]) public poolsByAsset;

  /// @notice Error when unauthorized address attempts restricted operation
  /// @param sender The address that attempted the unauthorized action
  error UnauthorizedCaller(address sender);

  /// @notice Error when initial deposit is insufficient
  /// @param deposit The insufficient deposit amount provided
  error InsufficientInitialDeposit(uint256 deposit);

  /// @notice Error when timelock delay is below minimum requirement
  /// @param delay The insufficient delay provided
  error InsufficientTimelockDelay(uint256 delay);

  /// @notice Emitted when a new pool is deployed
  /// @param pool The address of the deployed RelayPool
  /// @param creator The address that deployed the pool
  /// @param asset The underlying asset of the pool
  /// @param name The name of the pool's share token
  /// @param symbol The symbol of the pool's share token
  /// @param thirdPartyPool The yield pool where assets will be deposited
  /// @param timelock The timelock contract governing the pool
  event PoolDeployed(
    address indexed pool,
    address indexed creator,
    address indexed asset,
    string name,
    string symbol,
    address thirdPartyPool,
    address timelock
  );

  /// @notice Initializes the factory with required infrastructure addresses
  /// @param hMailbox The Hyperlane mailbox contract address
  /// @param weth The WETH contract address
  /// @param timelock The timelock template to be cloned for each pool
  /// @param minTimelockDelay The minimum delay for timelock operations
  constructor(
    address hMailbox,
    address weth,
    address timelock,
    uint256 minTimelockDelay
  ) Ownable(msg.sender) {
    HYPERLANE_MAILBOX = hMailbox;
    WETH = weth;
    TIMELOCK_TEMPLATE = timelock;
    MIN_TIMELOCK_DELAY = minTimelockDelay;
  }

  /// @notice Deploys a new RelayPool with associated timelock governance
  /// @dev Requires initial deposit to prevent inflation attacks, creates dedicated timelock
  /// @param asset The ERC20 asset for the pool
  /// @param name The name for the pool's share token
  /// @param symbol The symbol for the pool's share token
  /// @param thirdPartyPool The yield pool where idle assets will be deposited
  /// @param timelockDelay The delay in seconds for timelock operations
  /// @param initialDeposit The initial deposit amount (must be at least 1 unit of asset)
  /// @param curator The address that will control the pool through the timelock
  /// @return The address of the newly deployed RelayPool
  function deployPool(
    ERC20 asset,
    string memory name,
    string memory symbol,
    address thirdPartyPool,
    uint256 timelockDelay,
    uint256 initialDeposit,
    address curator
  ) public returns (address) {
    // Check authorization - either owner or permissionless if owner renounced
    if (owner() != address(0) && msg.sender != owner()) {
      revert UnauthorizedCaller(msg.sender);
    }

    // Require minimum initial deposit of 1 unit to prevent inflation attacks
    uint8 decimals = asset.decimals();
    if (initialDeposit < 10 ** decimals) {
      revert InsufficientInitialDeposit(initialDeposit);
    }

    // Enforce minimum timelock delay for non-owner deployments
    if (timelockDelay < MIN_TIMELOCK_DELAY && msg.sender != owner()) {
      revert InsufficientTimelockDelay(timelockDelay);
    }

    // Setup curator array for timelock initialization
    address[] memory curators = new address[](1);
    curators[0] = curator;

    // Clone timelock template and initialize with curator as proposer/executor
    address timelock = Clones.clone(TIMELOCK_TEMPLATE);
    RelayPoolTimelock(timelock).initialize(
      timelockDelay,
      curators,
      curators,
      address(0) // No admin
    );

    // Deploy the RelayPool with timelock as owner
    RelayPool pool = new RelayPool(
      HYPERLANE_MAILBOX,
      asset,
      name,
      symbol,
      thirdPartyPool,
      WETH,
      timelock
    );

    // Track the pool deployment
    poolsByAsset[address(asset)].push(address(pool));

    emit PoolDeployed(
      address(pool),
      msg.sender,
      address(asset),
      name,
      symbol,
      thirdPartyPool,
      timelock
    );

    // Transfer initial deposit to prevent inflation attack
    // Deposit is made to the timelock to ensure it holds the initial shares
    SafeERC20.safeTransferFrom(
      IERC20(address(asset)),
      msg.sender,
      address(this),
      initialDeposit
    );
    SafeERC20.safeIncreaseAllowance(
      IERC20(address(asset)),
      address(pool),
      initialDeposit
    );
    pool.deposit(initialDeposit, timelock);

    return address(pool);
  }
}
