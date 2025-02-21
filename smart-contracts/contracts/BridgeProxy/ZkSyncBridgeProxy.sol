// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BridgeProxy} from "./BridgeProxy.sol";
import {IL1SharedBridge} from "../interfaces/zksync/IL1SharedBridge.sol";
import {IL2SharedBridge} from "../interfaces/zksync/IL2SharedBridge.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UnsafeBytes} from "../utils/UnsafeBytes.sol";

contract ZkSyncBridgeProxy is BridgeProxy {
  IL2SharedBridge public immutable L2_SHARED_BRIDGE;

  constructor(
    address l2SharedBridge,
    uint256 relayPoolChainId,
    address relayPool,
    address l1BridgeProxy
  ) BridgeProxy(relayPoolChainId, relayPool, l1BridgeProxy) {
    L2_SHARED_BRIDGE = IL2SharedBridge(l2SharedBridge);
  }

  function bridge(
    address currency,
    address /* l1Asset */,
    uint256 amount,
    bytes calldata /*data*/
  ) external payable override {
    // withdraw to L1
    L2_SHARED_BRIDGE.withdraw(L1_BRIDGE_PROXY, currency, amount);
  }
}
