import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract BridgeProxy {
  // errors
  error TokenNotBridged(address token);
  error NotAuthorized(address user, uint256 chainId);
  error BridgeNotImplemented();
  error TransferFailed(uint256 amount);

  uint256 public immutable RELAY_POOL_CHAIN_ID;
  address public immutable RELAY_POOL;
  address public immutable L1_BRIDGE_PROXY;

  constructor(
    uint256 relayPoolChainId,
    address relayPool,
    address l1BridgeProxy
  ) {
    RELAY_POOL_CHAIN_ID = relayPoolChainId;
    RELAY_POOL = relayPool;
    if (block.chainid == relayPoolChainId) {
      L1_BRIDGE_PROXY = address(this);
    } else {
      L1_BRIDGE_PROXY = l1BridgeProxy;
    }
  }

  // This should be called as delegateCall from the Bridging contract
  // We use `delegateCall` so that the the user can approve the Bridge contract
  // and not worry/care about The proxyBridge contract.
  function bridge(
    address /*sender*/,
    address /*currency*/,
    address /*l1Asset*/,
    uint256 /*amount*/,
    bytes calldata /*data*/
  ) external payable virtual {
    revert BridgeNotImplemented();
  }

  // This should be called by Pool contract as a way to claim funds received from
  // the bridge Implementations MUST use `onlyRelayPool` modifier to make sure only
  // the RelayPool can call this function.
  // "Finalization" of the bridge can be triggered by anyone (and should probably
  // have been triggered before calling this.)
  function claim(
    address currency
  ) external onlyRelayPool returns (uint256 balance) {
    if (currency == address(0)) {
      balance = address(this).balance;
      (bool success, ) = RELAY_POOL.call{value: balance}("");
      if (!success) {
        revert TransferFailed(balance);
      }
    } else {
      balance = IERC20(currency).balanceOf(address(this));
      IERC20(currency).transfer(RELAY_POOL, balance);
    }
  }

  // modifier to make sure only the pool can call the claim function!
  modifier onlyRelayPool() {
    if (msg.sender != RELAY_POOL && block.chainid != RELAY_POOL_CHAIN_ID) {
      revert NotAuthorized(msg.sender, block.chainid);
    }
    _;
  }
}
