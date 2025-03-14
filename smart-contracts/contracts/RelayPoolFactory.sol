// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import {RelayPool} from "./RelayPool.sol";

interface RelayPoolTimelock {
  function initialize(
    uint256 minDelay,
    address[] memory proposers,
    address[] memory executors,
    address admin
  ) external;
}

contract RelayPoolFactory {
  address public immutable HYPERLANE_MAILBOX;
  address public immutable WETH;
  address public immutable TIMELOCK_TEMPLATE;
  uint public immutable MIN_TIMELOCK_DELAY;

  mapping(address => address[]) public poolsByAsset; // Keeping track of pools by asset.

  event PoolDeployed(
    address indexed pool,
    address indexed creator,
    address indexed asset,
    string name,
    string symbol,
    address thirdPartyPool,
    address timelock
  );

  error InsufficientInitialDeposit(uint deposit);
  error InsufficientTimelockDelay(uint delay);

  constructor(
    address hMailbox,
    address weth,
    address timelock,
    uint minTimelockDelay
  ) {
    HYPERLANE_MAILBOX = hMailbox;
    WETH = weth;
    TIMELOCK_TEMPLATE = timelock;
    MIN_TIMELOCK_DELAY = minTimelockDelay;
  }

  function deployPool(
    ERC20 asset,
    string memory name,
    string memory symbol,
    address thirdPartyPool,
    uint timelockDelay,
    uint256 initialDeposit,
    address curator
  ) public returns (address) {
    // We require an initial deposit of 1 unit
    uint8 decimals = asset.decimals();
    if (initialDeposit < 10 ** decimals) {
      revert InsufficientInitialDeposit(initialDeposit);
    }

    if (timelockDelay < MIN_TIMELOCK_DELAY) {
      revert InsufficientTimelockDelay(timelockDelay);
    }

    address[] memory curators = new address[](1);
    curators[0] = curator;

    // clone timelock
    address timelock = Clones.clone(TIMELOCK_TEMPLATE);
    RelayPoolTimelock(timelock).initialize(
      timelockDelay,
      curators,
      curators,
      address(0) // No admin
    );

    RelayPool pool = new RelayPool(
      HYPERLANE_MAILBOX,
      asset,
      name,
      symbol,
      thirdPartyPool,
      WETH,
      timelock
    );

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

    // Transfer initial deposit to the pool to prevent inflation attack
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
