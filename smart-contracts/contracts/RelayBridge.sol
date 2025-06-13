// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IHyperlaneMailbox} from "./interfaces/IHyperlaneMailbox.sol";
import {StandardHookMetadata} from "./utils/StandardHookMetadata.sol";
import {BridgeProxy} from "./BridgeProxy/BridgeProxy.sol";

/// @title IRelayBridge
/// @author Relay Protocol
/// @notice Interface for the RelayBridge contract
/// @dev Defines the bridge function for cross-chain asset transfers
interface IRelayBridge {
  /// @notice Bridges an asset (ERC20 token or native currency) from the origin chain to a pool chain
  /// @param amount Amount of asset units to bridge (ERC20 tokens or native currency)
  /// @param recipient Address on the pool chain to receive the bridged asset
  /// @param poolAsset Address of the asset on the pool chain to bridge to
  /// @param poolGas Gas limit for the pool chain transaction
  /// @param extraData Extra data passed to the bridge proxy
  /// @return nonce Unique identifier for this bridge transaction
  function bridge(
    uint256 amount,
    address recipient,
    address poolAsset,
    uint256 poolGas,
    bytes calldata extraData
  ) external payable returns (uint256 nonce);
}

/// @title RelayBridge
/// @author Relay Protocol
/// @notice RelayBridge contract enabling cross-chain bridging via Hyperlane
/// @dev Bridges assets from an origin chain to a configured pool chain
contract RelayBridge is IRelayBridge {
  /// @dev Internal struct capturing parameters for a bridge transaction
  struct BridgeTransaction {
    uint256 amount;
    address recipient;
    address poolAsset;
    uint256 poolGas;
    bytes extraData;
    uint256 nonce;
    bytes txParams;
    uint32 poolChainId;
    bytes32 poolId;
  }

  /// @notice Error for failed bridging operations
  /// @param nonce The nonce of the failed transaction
  error BridgingFailed(uint256 nonce);

  /// @notice Error for insufficient native value sent to cover fees or asset
  /// @param received The amount of native currency received
  /// @param expected The amount of native currency expected
  error InsufficientValue(uint256 received, uint256 expected);

  /// @notice Error when refunding leftover native value fails
  /// @param value The amount of native currency that failed to refund
  error FailedFeeRefund(uint256 value);

  /// @notice Counter for assigning unique nonces to bridge transactions
  /// @dev Incremented with each bridge transaction to ensure uniqueness
  uint256 public transferNonce;

  /// @notice Asset address on the origin chain being bridged (address(0) for native currency)
  /// @dev Immutable to ensure the bridge always handles the same asset
  address public immutable ASSET;

  /// @notice BridgeProxy contract handling origin-chain transfer logic
  /// @dev Uses delegatecall to execute custom bridge logic
  BridgeProxy public immutable BRIDGE_PROXY;

  /// @notice Hyperlane Mailbox contract for cross-chain messaging
  /// @dev Used to dispatch messages to the pool chain
  address public immutable HYPERLANE_MAILBOX;

  /// @notice Emitted when a bridge transaction is initiated on the origin chain
  /// @param nonce Nonce of the transaction
  /// @param sender Address on the origin chain that initiated the bridge
  /// @param recipient Address on the pool chain to receive assets
  /// @param ASSET Asset address on the origin chain (address(0) for native currency)
  /// @param poolAsset Asset address on the pool chain (address(0) for native currency)
  /// @param amount Amount of asset units bridged
  /// @param BRIDGE_PROXY BridgeProxy used
  event BridgeInitiated(
    uint256 indexed nonce,
    address indexed sender,
    address recipient,
    address ASSET,
    address poolAsset,
    uint256 amount,
    BridgeProxy BRIDGE_PROXY
  );

  /// @notice Emitted after a bridge transaction is executed on the pool chain
  /// @dev This event would be emitted by the pool chain contract
  /// @param nonce Nonce of the executed transaction
  event BridgeExecuted(uint256 indexed nonce);

  /// @notice Emitted if a bridge transaction is cancelled prior to execution
  /// @dev This event would be emitted if a bridge is cancelled
  /// @param nonce Nonce of the cancelled transaction
  event BridgeCancelled(uint256 indexed nonce);

  /// @notice Initializes the RelayBridge with asset and infrastructure contracts
  /// @dev All parameters are immutable after deployment
  /// @param asset Asset address on the origin chain to bridge (0 for native currency)
  /// @param bridgeProxy BridgeProxy contract for origin-chain transfers
  /// @param hyperlaneMailbox Hyperlane Mailbox address for messaging
  constructor(
    address asset,
    BridgeProxy bridgeProxy,
    address hyperlaneMailbox
  ) {
    ASSET = asset;
    BRIDGE_PROXY = bridgeProxy;
    HYPERLANE_MAILBOX = hyperlaneMailbox;
  }

  /// @notice Calculates the fee required in native currency to dispatch a cross-chain message
  /// @dev Uses Hyperlane's quoteDispatch to estimate the cross-chain messaging fee
  /// @param amount Amount of asset units to bridge
  /// @param recipient Address on the pool chain that will receive the bridged asset
  /// @param poolGas Gas limit for the pool chain transaction
  /// @return fee Required fee in native currency for dispatch
  function getFee(
    uint256 amount,
    address recipient,
    uint256 poolGas
  ) external view returns (uint256 fee) {
    bytes memory txParams = abi.encode(
      transferNonce,
      recipient,
      amount,
      block.timestamp
    );
    uint32 poolChainId = uint32(BRIDGE_PROXY.RELAY_POOL_CHAIN_ID());
    bytes32 poolId = bytes32(uint256(uint160(BRIDGE_PROXY.RELAY_POOL())));

    fee = IHyperlaneMailbox(HYPERLANE_MAILBOX).quoteDispatch(
      poolChainId,
      poolId,
      txParams,
      StandardHookMetadata.overrideGasLimit(poolGas)
    );
  }

  /// @inheritdoc IRelayBridge
  /// @dev Executes a cross-chain bridge transaction with the following steps:
  ///      1. Validates sufficient payment for fees (and asset amount if native)
  ///      2. Transfers the asset from sender to this contract (if ERC20)
  ///      3. Executes bridge logic via delegatecall to BRIDGE_PROXY
  ///      4. Dispatches cross-chain message via Hyperlane
  ///      5. Refunds any excess native currency to sender
  function bridge(
    uint256 amount,
    address recipient,
    address poolAsset,
    uint256 poolGas,
    bytes calldata extraData
  ) external payable returns (uint256 nonce) {
    // Assign unique nonce and increment counter
    nonce = transferNonce++;

    // Package all transaction parameters
    BridgeTransaction memory transaction = BridgeTransaction({
      amount: amount,
      recipient: recipient,
      poolAsset: poolAsset,
      poolGas: poolGas,
      extraData: extraData,
      nonce: nonce,
      txParams: abi.encode(nonce, recipient, amount, block.timestamp),
      poolChainId: uint32(BRIDGE_PROXY.RELAY_POOL_CHAIN_ID()),
      poolId: bytes32(uint256(uint160(BRIDGE_PROXY.RELAY_POOL())))
    });

    // Calculate Hyperlane messaging fee
    uint256 hyperlaneFee = IHyperlaneMailbox(HYPERLANE_MAILBOX).quoteDispatch(
      transaction.poolChainId,
      transaction.poolId,
      transaction.txParams,
      StandardHookMetadata.overrideGasLimit(poolGas)
    );

    // Handle asset transfer and fee validation
    if (ASSET != address(0)) {
      // ERC20 token: transfer from sender and validate fee payment
      SafeERC20.safeTransferFrom(
        IERC20(ASSET),
        msg.sender,
        address(this),
        amount
      );
      if (msg.value < hyperlaneFee) {
        revert InsufficientValue(msg.value, hyperlaneFee);
      }
    } else {
      // Native currency: validate payment covers both amount and fee
      if (msg.value < hyperlaneFee + amount) {
        revert InsufficientValue(msg.value, hyperlaneFee + amount);
      }
    }

    // Execute bridge logic via delegatecall to maintain context
    (bool success, ) = address(BRIDGE_PROXY).delegatecall(
      abi.encodeWithSignature(
        "bridge(address,address,uint256,bytes,bytes)",
        ASSET,
        poolAsset,
        amount,
        transaction.txParams,
        extraData
      )
    );
    if (!success) revert BridgingFailed(nonce);

    // Dispatch cross-chain message via Hyperlane
    IHyperlaneMailbox(HYPERLANE_MAILBOX).dispatch{value: hyperlaneFee}(
      transaction.poolChainId,
      transaction.poolId,
      transaction.txParams,
      StandardHookMetadata.overrideGasLimit(poolGas)
    );

    emit BridgeInitiated(
      nonce,
      msg.sender,
      recipient,
      ASSET,
      poolAsset,
      amount,
      BRIDGE_PROXY
    );

    // Calculate and refund excess native currency
    uint256 leftOverValue = ASSET != address(0)
      ? msg.value - hyperlaneFee
      : msg.value - hyperlaneFee - amount;

    if (leftOverValue > 0) {
      (bool sent, ) = msg.sender.call{value: leftOverValue}(new bytes(0));
      if (!sent) revert FailedFeeRefund(leftOverValue);
    }
  }
}
