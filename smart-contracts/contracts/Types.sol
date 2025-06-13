// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title HyperlaneMessage
/// @author Relay Protocol
/// @notice Struct representing a cross-chain bridge message sent via Hyperlane
/// @dev Used to encode bridge transaction data for cross-chain messaging
/// @param nonce Unique identifier for the bridge transaction
/// @param recipient Address on the destination chain to receive the bridged assets
/// @param amount Amount of assets being bridged (in asset's smallest unit)
/// @param timestamp Unix timestamp when the message was created on the origin chain
struct HyperlaneMessage {
  uint256 nonce;
  address recipient;
  uint256 amount;
  uint256 timestamp;
}
