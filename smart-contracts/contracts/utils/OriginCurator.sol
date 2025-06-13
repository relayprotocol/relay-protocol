// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISafe {
  function isOwner(address) external view returns (bool);
}

/**
 * @title Origin Curator for Relay Vaults 
 * @dev A contract that forwards calls to another address if the caller is approved.
 * @notice Used as curator for Relay Vaults. The whitelist is maintained using a SAFE multisig.
 */
contract OriginCurator {
    // Errors 
    error NotMultisigOwner(address);
    error InvalidTargetAddress();
    error InsufficientValueSent();
    error ForwardFailed();
    error RefundFailed();
    
    // SAFE address that contains the whitelist of allowed callers
    address public safeAddress;
    
    // Events
    event Forwarded(address indexed to, bytes data, uint256 value);

    modifier onlyMultisigOwner() {
      if (!ISafe(safeAddress).isOwner(msg.sender)) revert NotMultisigOwner(msg.sender);
      _;
    }
    /**
     * @param _safeAddress The address of the SAFE contract
     */    
    constructor(address _safeAddress) {
      safeAddress = _safeAddress;
    }

    /**
     * Forwards a call to another address with optional ETH value
     * @param to The address to forward the call to
     * @param data The calldata to forward
     * @param value The amount of ETH to forward
     */
    function forward(address to, bytes calldata data, uint256 value) onlyMultisigOwner external payable  {
        if (to == address(0)) revert InvalidTargetAddress();
        if (msg.value < value) revert InsufficientValueSent();

        (bool success, ) = to.call{value: value}(data);
        if (!success) revert ForwardFailed();

        // Refund excess ETH if any
        if (msg.value > value) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - value}("");
            if (!refundSuccess) revert RefundFailed();
        }

        emit Forwarded(to, data, value);
    }

    /**
     * @dev Allows the contract to receive ETH
     */
    receive() external payable {}
} 