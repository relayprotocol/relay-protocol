// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BridgeProxy} from "./BridgeProxy.sol";
import {L2StandardBridge} from "../interfaces/L2StandardBridge.sol";
import {IOptimismMintableERC20} from "../interfaces/IOptimismMintableERC20.sol";

/// @title OPStackNativeBridgeProxy
/// @author Relay Protocol
/// @notice Bridge proxy implementation for OP Stack L2 to L1 bridging
/// @dev Handles bridging of native ETH and OP Stack mintable ERC20 tokens to L1
contract OPStackNativeBridgeProxy is BridgeProxy {
  /// @notice The OP Stack standard bridge predeploy address
  /// @dev This address is consistent across all OP Stack chains
  address public constant STANDARD_BRIDGE =
    address(0x4200000000000000000000000000000000000010);

  /// @notice Minimum gas limit for L1 execution
  /// @dev Ensures sufficient gas for L1 operations to complete
  uint32 public constant MIN_GAS_LIMIT = 200000;

  /// @notice Initializes the OP Stack bridge proxy
  /// @param relayPoolChainId The chain ID where the relay pool is deployed
  /// @param relayPool The address of the relay pool
  /// @param l1BridgeProxy The corresponding bridge proxy on L1
  constructor(
    uint256 relayPoolChainId,
    address relayPool,
    address l1BridgeProxy
  ) BridgeProxy(relayPoolChainId, relayPool, l1BridgeProxy) {}

  /// @notice Bridges tokens from OP Stack L2 to L1
  /// @dev Supports both native ETH and OP Stack mintable ERC20 tokens
  /// @param currency The L2 token address (address(0) for native ETH)
  /// @param l1Asset The expected L1 token address (address(0) for native ETH)
  /// @param amount The amount of tokens to bridge
  /// @param data Additional data to pass to the L1 recipient
  /// @param /* extraData */ Extra bridge data (unused in OP Stack implementation)
  function bridge(
    address currency,
    address l1Asset,
    uint256 amount,
    bytes calldata data,
    bytes calldata /* extraData */
  ) external payable override {
    if (currency == address(0)) {
      // Bridge native ETH using the standard bridge
      L2StandardBridge(STANDARD_BRIDGE).bridgeETHTo{value: amount}(
        L1_BRIDGE_PROXY,
        MIN_GAS_LIMIT,
        data
      );
    } else {
      // Bridge ERC20 tokens - must be OP Stack mintable tokens
      // Verify this is a bridged token by checking for remoteToken
      address l1Token = IOptimismMintableERC20(currency).remoteToken();
      if (l1Token == address(0)) {
        revert TokenNotBridged(currency);
      } else if (l1Asset != l1Token) {
        revert UnexpectedL1Asset(l1Token, l1Asset);
      }

      // Execute ERC20 bridge through standard bridge
      L2StandardBridge(STANDARD_BRIDGE).bridgeERC20To(
        currency,
        l1Token,
        L1_BRIDGE_PROXY,
        amount,
        MIN_GAS_LIMIT,
        data
      );
    }
  }

  /// @notice Receives native ETH for bridging operations
  /// @dev Required to receive ETH before bridging to L1
  receive() external payable {}
}
