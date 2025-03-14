// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimelockControllerUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";

import {RelayPool} from "./RelayPool.sol";

interface RelayPoolTimelock {
  function initialize(
    uint256 minDelay,
    address[] memory proposers,
    address[] memory executors,
    address admin
  ) external;
}

contract RelayPoolFactory is Ownable {
  address public immutable HYPERLANE_MAILBOX;
  address public immutable WETH;
  address public immutable TIMELOCK_TEMPLATE;
  uint256 public immutable MIN_TIMELOCK_DELAY;

  mapping(address => address[]) public poolsByAsset; // Keeping track of pools by asset.

  error UnauthorizedCaller(address sender);

  event PoolDeployed(
    address indexed pool,
    address indexed creator,
    address indexed asset,
    string name,
    string symbol,
    address thirdPartyPool,
    address timelock
  );

  error InsufficientInitialDeposit(uint256 deposit);
  error InsufficientTimelockDelay(uint256 delay);

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

  function setTimelockDelayOnPools(
    uint256 newDelay,
    address[] calldata pools
  ) public onlyOwner {
    for (uint256 i = 0; i < pools.length; i++) {
      RelayPool pool = RelayPool(payable(pools[i]));
      TimelockControllerUpgradeable(payable(pool.owner())).updateDelay(
        newDelay
      );
    }
  }

  function deployPool(
    ERC20 asset,
    string memory name,
    string memory symbol,
    address thirdPartyPool,
    uint256 timelockDelay,
    uint256 initialDeposit,
    address curator
  ) public returns (address) {
    if (owner() != address(0) && msg.sender != owner()) {
      revert UnauthorizedCaller(msg.sender);
    }
    // We require an initial deposit of 1 unit
    uint8 decimals = asset.decimals();
    if (initialDeposit < 10 ** decimals) {
      revert InsufficientInitialDeposit(initialDeposit);
    }

    if (timelockDelay < MIN_TIMELOCK_DELAY && msg.sender != owner()) {
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
      address(this)
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
