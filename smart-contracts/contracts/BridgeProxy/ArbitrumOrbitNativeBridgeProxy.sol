// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// https://docs.arbitrum.io/build-decentralized-apps/token-bridging/token-bridge-erc20

import {BridgeProxy} from "./BridgeProxy.sol";
import {IL2GatewayRouter} from "../interfaces/arb/IArbL2GatewayRouter.sol";
import {IArbSys} from "../interfaces/arb/IArbSys.sol";

/// @title ArbitrumOrbitNativeBridgeProxy
/// @author Relay Protocol
/// @notice Bridge proxy implementation for Arbitrum Orbit L2 to L1 token bridging
/// @dev Handles both native ETH and ERC20 token bridging from Arbitrum Orbit L2s to their L1
contract ArbitrumOrbitNativeBridgeProxy is BridgeProxy {
  /// @notice Error when L2 token address doesn't match the calculated address from L1 token
  /// @param expected The expected L2 token address calculated from L1 token
  /// @param actual The actual L2 token address provided
  error AssetMismatch(address expected, address actual);

  /// @notice Arbitrum system precompile for native ETH withdrawals
  /// @dev Located at a fixed address on all Arbitrum chains
  IArbSys public immutable ARB_SYS =
    IArbSys(0x0000000000000000000000000000000000000064);

  /// @notice Arbitrum L2 gateway router for ERC20 token bridging
  /// @dev Handles the routing of tokens to their appropriate gateway
  IL2GatewayRouter public immutable ROUTER;

  /// @notice Initializes the bridge proxy with Arbitrum-specific configuration
  /// @param routerGateway The Arbitrum L2 gateway router contract address
  /// @param relayPoolChainId The chain ID where the relay pool is deployed
  /// @param relayPool The address of the relay pool on the pool chain
  /// @param l1BridgeProxy The corresponding bridge proxy on L1
  constructor(
    address routerGateway,
    uint256 relayPoolChainId,
    address relayPool,
    address l1BridgeProxy
  ) BridgeProxy(relayPoolChainId, relayPool, l1BridgeProxy) {
    ROUTER = IL2GatewayRouter(routerGateway);
  }

  /// @notice Bridges tokens from L2 to L1 on the Arbitrum Orbit stack
  /// @dev Handles both native ETH (via ArbSys) and ERC20 tokens (via gateway router)
  /// @param asset The L2 token address to bridge (address(0) for native ETH)
  /// @param l1Currency The corresponding L1 token address (address(0) for native ETH)
  /// @param amount The amount of tokens to bridge
  /// @param /* txParams */ Transaction parameters (unused in Arbitrum implementation)
  /// @param /* extraData */ Extra data for the bridge (unused as disabled in default gateway)
  function bridge(
    address asset, //l2 token
    address l1Currency, //l1 token
    uint256 amount,
    bytes calldata /* txParams */,
    bytes calldata /* extraData */
  ) external payable override {
    // Bridge native ETH using ArbSys precompile
    if (l1Currency == address(0)) {
      ARB_SYS.withdrawEth{value: amount}(L1_BRIDGE_PROXY);
    } else {
      // Bridge ERC20 tokens using the gateway router
      // First verify the L2 token matches the expected address for the L1 token
      address l2token = ROUTER.calculateL2TokenAddress(l1Currency);
      if (l2token != asset) {
        revert AssetMismatch(l2token, asset);
      }

      // Execute the outbound transfer
      // Empty data is passed as EXTRA_DATA_DISABLED in Arbitrum's L2GatewayRouter.sol
      ROUTER.outboundTransfer(l1Currency, L1_BRIDGE_PROXY, amount, "");
    }
  }

  /// @notice Receives native ETH for bridging operations
  /// @dev Required to receive ETH before withdrawing via ArbSys
  receive() external payable {}
}
