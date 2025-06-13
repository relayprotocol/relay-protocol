// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RelayBridge} from "./RelayBridge.sol";
import {BridgeProxy} from "./BridgeProxy/BridgeProxy.sol";

/// @title RelayBridgeFactory
/// @author Relay Protocol
/// @notice Factory contract for deploying RelayBridge instances for different assets
/// @dev This factory deploys new RelayBridge contracts and maintains a registry of bridges by asset address
contract RelayBridgeFactory {
  /// @notice The Hyperlane mailbox address used for cross-chain messaging
  /// @dev Immutable to ensure consistency across all deployed bridges
  address public immutable HYPERLANE_MAILBOX;

  /// @notice Mapping from asset address to array of deployed bridge addresses
  /// @dev Multiple bridges can exist for the same asset
  mapping(address => address[]) public bridgesByAsset;

  /// @notice Emitted when a new bridge is deployed
  /// @param bridge The address of the newly deployed RelayBridge contract
  /// @param asset The address of the asset that the bridge will handle
  /// @param proxyBridge The BridgeProxy contract associated with this bridge
  event BridgeDeployed(
    address bridge,
    address indexed asset,
    BridgeProxy indexed proxyBridge
  );

  /// @notice Initializes the factory with the Hyperlane mailbox address
  /// @dev The mailbox address cannot be changed after deployment
  /// @param hMailbox The address of the Hyperlane mailbox contract
  constructor(address hMailbox) {
    HYPERLANE_MAILBOX = hMailbox;
  }

  /// @notice Deploys a new RelayBridge for a specific asset
  /// @dev Creates a new RelayBridge instance and adds it to the bridgesByAsset mapping
  /// @param asset The address of the asset (token) that the bridge will handle
  /// @param proxyBridge The BridgeProxy contract that will work with this bridge
  /// @return The address of the newly deployed RelayBridge contract
  function deployBridge(
    address asset,
    BridgeProxy proxyBridge
  ) public returns (address) {
    RelayBridge bridge = new RelayBridge(asset, proxyBridge, HYPERLANE_MAILBOX);
    bridgesByAsset[asset].push(address(bridge));
    emit BridgeDeployed(address(bridge), asset, proxyBridge);
    return address(bridge);
  }
}
