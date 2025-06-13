// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/// @title BridgeProxy
/// @author Relay Protocol
/// @notice Abstract base contract for bridge-specific proxy implementations
/// @dev Provides common functionality for claiming bridged assets and enforcing access control
contract BridgeProxy {
  /// @notice Error when attempting to bridge an unsupported token
  /// @param token The token address that is not supported for bridging
  error TokenNotBridged(address token);

  /// @notice Error when received L1 asset doesn't match expected
  /// @param expected The expected L1 asset address
  /// @param received The actual L1 asset address received
  error UnexpectedL1Asset(address expected, address received);

  /// @notice Error when unauthorized address attempts to claim funds
  /// @param user The unauthorized address
  /// @param chainId The chain ID where the attempt was made
  error NotAuthorized(address user, uint256 chainId);

  /// @notice Error when bridge function is not implemented by child contract
  error BridgeNotImplemented();

  /// @notice Error when native currency transfer fails
  /// @param amount The amount that failed to transfer
  error TransferFailed(uint256 amount);

  /// @notice Chain ID where the relay pool is deployed
  /// @dev Used to ensure claim is only called on the correct chain
  uint256 public immutable RELAY_POOL_CHAIN_ID;

  /// @notice Address of the relay pool that can claim bridged funds
  /// @dev Only this address can call the claim function
  address public immutable RELAY_POOL;

  /// @notice Address of the corresponding bridge proxy on L1
  /// @dev Set to this contract's address if deployed on the relay pool chain
  address public immutable L1_BRIDGE_PROXY;

  /// @notice Initializes the bridge proxy with relay pool configuration
  /// @param relayPoolChainId The chain ID where the relay pool is deployed
  /// @param relayPool The address of the relay pool
  /// @param l1BridgeProxy The address of the L1 bridge proxy (ignored if on pool chain)
  constructor(
    uint256 relayPoolChainId,
    address relayPool,
    address l1BridgeProxy
  ) {
    RELAY_POOL_CHAIN_ID = relayPoolChainId;
    RELAY_POOL = relayPool;
    // If deployed on the relay pool chain, this contract is the L1 bridge proxy
    if (block.chainid == relayPoolChainId) {
      L1_BRIDGE_PROXY = address(this);
    } else {
      L1_BRIDGE_PROXY = l1BridgeProxy;
    }
  }

  /// @notice Initiates a bridge transaction (must be implemented by child contracts)
  /// @dev Should be called via delegateCall from the RelayBridge contract
  ///      This allows users to approve the Bridge contract without worrying about proxy addresses
  /// @param currency The address of the token on the origin chain (address(0) for native)
  /// @param l1Asset The address of the token on L1 (address(0) for native)
  /// @param amount The amount of tokens to bridge
  /// @param txParams Transaction parameters specific to the bridge implementation
  /// @param extraData Additional data specific to the bridge implementation
  function bridge(
    address currency,
    address l1Asset,
    uint256 amount,
    bytes calldata txParams,
    bytes calldata extraData
  ) external payable virtual {
    revert BridgeNotImplemented();
  }

  /// @notice Claims bridged funds and transfers them to the relay pool
  /// @dev Can only be called by the relay pool on the correct chain
  ///      Bridge finalization should be triggered before calling this
  /// @param currency The token address to claim (address(0) for native currency)
  /// @param amount The maximum amount to claim
  /// @return balance The actual amount claimed and transferred
  function claim(
    address currency,
    uint256 amount
  ) external onlyRelayPool returns (uint256 balance) {
    if (amount > 0) {
      if (currency == address(0)) {
        // Claim native currency - transfer min of balance and requested amount
        balance = Math.min(address(this).balance, amount);
        (bool success, ) = RELAY_POOL.call{value: balance}("");
        if (!success) {
          revert TransferFailed(balance);
        }
      } else {
        // Claim ERC20 tokens - transfer min of balance and requested amount
        balance = Math.min(IERC20(currency).balanceOf(address(this)), amount);
        SafeERC20.safeTransfer(IERC20(currency), RELAY_POOL, balance);
      }
    }
  }

  /// @notice Ensures only the relay pool can call protected functions
  /// @dev Checks both the sender address and chain ID for security
  modifier onlyRelayPool() {
    if (msg.sender != RELAY_POOL || block.chainid != RELAY_POOL_CHAIN_ID) {
      revert NotAuthorized(msg.sender, block.chainid);
    }
    _;
  }
}
