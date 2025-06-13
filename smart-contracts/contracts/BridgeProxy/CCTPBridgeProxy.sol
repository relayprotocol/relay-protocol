// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITokenMessenger} from "../interfaces/cctp/ITokenMessenger.sol";
import {BridgeProxy} from "./BridgeProxy.sol";

// docs
// https://developers.circle.com/stablecoins/message-format

/// @title CCTPBridgeProxy
/// @author Relay Protocol
/// @notice Bridge proxy implementation for Circle's Cross-Chain Transfer Protocol (CCTP)
/// @dev Handles USDC bridging using Circle's burn-and-mint mechanism
contract CCTPBridgeProxy is BridgeProxy {
  /// @notice Circle's TokenMessenger contract for CCTP operations
  /// @dev Handles the burn-and-mint bridging of USDC
  ITokenMessenger public immutable MESSENGER;

  /// @notice The USDC token contract address on this chain
  /// @dev Only USDC can be bridged through this proxy
  address public immutable USDC;

  /// @notice CCTP domain identifier for Ethereum mainnet
  /// @dev See https://developers.circle.com/stablecoins/supported-domains
  uint32 public constant ETHEREUM_DOMAIN = 0;

  /// @notice Initializes the CCTP bridge proxy with required contracts
  /// @param messenger The CCTP TokenMessenger contract address
  /// @param usdc The USDC token contract address on this chain
  /// @param relayPoolChainId The chain ID where the relay pool is deployed
  /// @param relayPool The address of the relay pool
  /// @param l1BridgeProxy The corresponding bridge proxy on L1
  constructor(
    address messenger,
    address usdc,
    uint256 relayPoolChainId,
    address relayPool,
    address l1BridgeProxy
  ) BridgeProxy(relayPoolChainId, relayPool, l1BridgeProxy) {
    MESSENGER = ITokenMessenger(messenger);
    USDC = usdc;
  }

  /// @notice Bridges USDC to Ethereum mainnet using CCTP
  /// @dev Burns USDC on the source chain to be minted on Ethereum
  /// @param currency The token to bridge (must be USDC)
  /// @param /* l1Asset */ The L1 token address (unused, USDC address is consistent)
  /// @param amount The amount of USDC to bridge
  /// @param /* txParams */ Transaction parameters (unused in CCTP implementation)
  /// @param /* extraData */ Extra bridge data (unused in CCTP implementation)
  function bridge(
    address currency,
    address /* l1Asset */,
    uint256 amount,
    bytes calldata /* txParams */,
    bytes calldata /* extraData */
  ) external payable override {
    // Verify the token is USDC
    if (currency != USDC) {
      revert TokenNotBridged(currency);
    }

    // Approve TokenMessenger to spend USDC
    SafeERC20.safeIncreaseAllowance(IERC20(USDC), address(MESSENGER), amount);

    // Burn USDC on source chain for minting on Ethereum
    // Convert L1 bridge proxy address to bytes32 format required by CCTP
    bytes32 targetAddressBytes32 = bytes32(uint256(uint160(L1_BRIDGE_PROXY)));
    MESSENGER.depositForBurn(
      amount,
      ETHEREUM_DOMAIN,
      targetAddressBytes32,
      USDC
    );
  }
}
