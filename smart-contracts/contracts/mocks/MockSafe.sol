// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockSafe {
    mapping(address => bool) public owners;

    constructor(address[] memory _owners) {
        for (uint256 i = 0; i < _owners.length; i++) {
            owners[_owners[i]] = true;
        }
    }

    function isOwner(address account) external view returns (bool) {
        return owners[account];
    }
} 