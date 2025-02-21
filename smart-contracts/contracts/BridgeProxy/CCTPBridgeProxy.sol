// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITokenMessenger} from "../interfaces/cctp/ITokenMessenger.sol";
import {IMessageTransmitter} from "../interfaces/cctp/IMessageTransmitter.sol";
import {BridgeProxy} from "./BridgeProxy.sol";
import {IUSDC} from "../interfaces/IUSDC.sol";

// docs
// https://developers.circle.com/stablecoins/message-format
contract CCTPBridgeProxy is BridgeProxy {
  ITokenMessenger public immutable MESSENGER;
  IMessageTransmitter public immutable TRANSMITTER;
  address public immutable USDC;

  /**
   * @param messenger the CCTP TokenMessenger address
   * @param transmitter the CCTP Trnasmitter address
   * @param usdc the USDC contract address
   *
   * see https://developers.circle.com/stablecoins/supported-domains
   */
  constructor(
    address messenger,
    address transmitter,
    address usdc,
    uint256 relayPoolChainId,
    address relayPool,
    address l1BridgeProxy
  ) BridgeProxy(relayPoolChainId, relayPool, l1BridgeProxy) {
    MESSENGER = ITokenMessenger(messenger);
    TRANSMITTER = IMessageTransmitter(transmitter);
    USDC = usdc;
  }

  function bridge(
    address currency,
    address /* l1Asset */,
    uint256 amount,
    bytes calldata /*data*/
  ) external payable override {
    if (currency != USDC) {
      revert TOKEN_NOT_BRIDGED(currency);
    }

    // approve messenger to manipulate USDC tokens
    IUSDC(USDC).approve(address(MESSENGER), amount);

    // burn USDC on that side of the chain
    bytes32 targetAddressBytes32 = bytes32(uint256(uint160(L1_BRIDGE_PROXY)));
    MESSENGER.depositForBurn(
      amount,
      0, // mainnet domain is zero
      targetAddressBytes32,
      USDC
    );
  }
}
