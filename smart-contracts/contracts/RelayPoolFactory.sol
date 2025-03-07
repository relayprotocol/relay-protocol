// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "solmate/src/tokens/ERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import {RelayPool, OriginParam} from "./RelayPool.sol";

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

  constructor(address hMailbox, address weth, address timelock) {
    HYPERLANE_MAILBOX = hMailbox;
    WETH = weth;
    TIMELOCK_TEMPLATE = timelock;
  }

  function deployPool(
    ERC20 asset,
    string memory name,
    string memory symbol,
    address thirdPartyPool,
    uint timelockDelay,
    uint256 initialDeposit
  ) public returns (address) {
    address[] memory curator = new address[](1);
    curator[0] = msg.sender;

    // clone timelock
    address timelock = Clones.clone(TIMELOCK_TEMPLATE);
    RelayPoolTimelock(timelock).initialize(
      timelockDelay,
      curator,
      curator,
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
    asset.transferFrom(msg.sender, address(this), initialDeposit);
    asset.approve(address(pool), initialDeposit);
    pool.deposit(initialDeposit, timelock);

    return address(pool);
  }
}
