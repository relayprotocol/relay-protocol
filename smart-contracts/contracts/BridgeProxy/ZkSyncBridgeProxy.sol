// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BridgeProxy} from "./BridgeProxy.sol";
import {IL2SharedBridge} from "../interfaces/zksync/IL2SharedBridge.sol";
import {IBaseToken} from "../interfaces/zksync/IBaseToken.sol";

/// @title ZkSyncBridgeProxy
/// @author Relay Protocol
/// @notice Bridge proxy implementation for zkSync Era L2 to L1 bridging
/// @dev Handles bridging of native ETH and ERC20 tokens from zkSync Era to Ethereum L1
contract ZkSyncBridgeProxy is BridgeProxy {
  /// @notice The zkSync L2 shared bridge contract for ERC20 withdrawals
  /// @dev Handles the withdrawal of ERC20 tokens to L1
  IL2SharedBridge public immutable L2_SHARED_BRIDGE;

  /// @notice The zkSync base token system contract for native ETH withdrawals
  /// @dev Located at a fixed address on zkSync Era for handling native token operations
  IBaseToken public immutable L2_BASE_TOKEN =
    IBaseToken(0x000000000000000000000000000000000000800A);

  /// @notice Initializes the zkSync bridge proxy with the shared bridge address
  /// @param l2SharedBridge The address of zkSync's L2 shared bridge contract
  /// @param relayPoolChainId The chain ID where the relay pool is deployed
  /// @param relayPool The address of the relay pool
  /// @param l1BridgeProxy The corresponding bridge proxy on L1
  constructor(
    address l2SharedBridge,
    uint256 relayPoolChainId,
    address relayPool,
    address l1BridgeProxy
  ) BridgeProxy(relayPoolChainId, relayPool, l1BridgeProxy) {
    L2_SHARED_BRIDGE = IL2SharedBridge(l2SharedBridge);
  }

  /// @notice Bridges tokens from zkSync Era L2 to Ethereum L1
  /// @dev Uses different mechanisms for native ETH vs ERC20 tokens
  /// @param currency The L2 token address (address(0) for native ETH)
  /// @param /* l1Asset */ The L1 token address (unused in zkSync implementation)
  /// @param amount The amount of tokens to bridge
  /// @param /* txParams */ Transaction parameters (unused in zkSync implementation)
  /// @param /* extraData */ Extra bridge data (unused in zkSync implementation)
  function bridge(
    address currency,
    address /* l1Asset */,
    uint256 amount,
    bytes calldata /* txParams */,
    bytes calldata /* extraData */
  ) external payable override {
    // Check if this is a native token withdrawal
    if (currency == address(0)) {
      // For native ETH: use the base token system contract
      L2_BASE_TOKEN.withdraw{value: amount}(L1_BRIDGE_PROXY);
    } else {
      // For ERC20 tokens: use the shared bridge contract
      L2_SHARED_BRIDGE.withdraw(L1_BRIDGE_PROXY, currency, amount);
    }
  }

  /// @notice Receives native ETH for bridging operations
  /// @dev Required to receive ETH before withdrawing to L1
  receive() external payable {}
}
