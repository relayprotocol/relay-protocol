// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// https://docs.arbitrum.io/build-decentralized-apps/token-bridging/token-bridge-erc20

import {BridgeProxy} from "./BridgeProxy.sol";
import {IL2GatewayRouter} from "../interfaces/arb/IArbL2GatewayRouter.sol";
import {IArbSys} from "../interfaces/arb/IArbSys.sol";
import {IOutbox} from "../interfaces/arb/IOutbox.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// errors
error WrongSender(address sender);
error AssetMismatch(address expected, address actual);

contract ArbitrumOrbitNativeBridgeProxy is BridgeProxy {
  // arb pre-compiles
  IArbSys public immutable ARB_SYS =
    IArbSys(0x0000000000000000000000000000000000000064);

  IL2GatewayRouter public immutable ROUTER;
  IOutbox public immutable OUTBOX;

  /**
   * params will be stored as immutable values in the bytecode
   * @param routerGateway the ARB router gateway contract
   */
  constructor(
    address routerGateway,
    address outbox,
    uint256 relayPoolChainId,
    address relayPool,
    address l1BridgeProxy
  ) BridgeProxy(relayPoolChainId, relayPool, l1BridgeProxy) {
    ROUTER = IL2GatewayRouter(routerGateway);
    OUTBOX = IOutbox(outbox);
  }

  // TODO: BUG: we should pass the L2 token, and get the L1 token... not the other way around!
  // DOCS https://docs.arbitrum.io/build-decentralized-apps/token-bridging/token-bridge-erc20
  function bridge(
    address sender,
    address asset, //l2 token
    address l1Currency, //l1 token
    uint256 amount,
    bytes calldata /* data*/
  ) external payable override {
    // send native tokens to L1
    if (l1Currency == address(0)) {
      ARB_SYS.withdrawEth{value: amount}(L1_BRIDGE_PROXY);
    } else {
      // get l2 token from l1 address
      address l2token = ROUTER.calculateL2TokenAddress(l1Currency);
      if (l2token != asset) {
        revert AssetMismatch(l2token, asset);
      }

      // Take the ERC20 tokens from the sender
      IERC20(l2token).transferFrom(sender, address(this), amount);

      // here we have to pass empty data as data has been disabled in the default
      // gateway (see EXTRA_DATA_DISABLED in Arbitrum's L2GatewayRouter.sol)
      ROUTER.outboundTransfer(l1Currency, L1_BRIDGE_PROXY, amount, "");
    }
  }
}
