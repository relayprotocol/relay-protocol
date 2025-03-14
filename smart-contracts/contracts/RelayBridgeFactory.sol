// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RelayBridge} from "./RelayBridge.sol";
import {BridgeProxy} from "./BridgeProxy/BridgeProxy.sol";

contract RelayBridgeFactory {
  address public immutable HYPERLANE_MAILBOX;

  mapping(address => address[]) public bridgesByAsset; // Keeping track of bridges by asset.

  event BridgeDeployed(
    address bridge,
    address indexed asset,
    BridgeProxy indexed proxyBridge
  );

  constructor(address hMailbox) {
    HYPERLANE_MAILBOX = hMailbox;
  }

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
