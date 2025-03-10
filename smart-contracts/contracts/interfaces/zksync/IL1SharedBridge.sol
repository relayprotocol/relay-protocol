// SPDX-License-Identifier: MIT
// We use a floating point pragma here so it can be used within other projects that interact with the ZKsync ecosystem without using our exact pragma version.
pragma solidity ^0.8.28;

/// @title L1 Bridge contract interface
/// @author Matter Labs
/// @custom:security-contact security@matterlabs.dev
/// @notice Finalize the withdrawal and release funds
///   _chainId The chain ID of the transaction to check
///   _l2BatchNumber The L2 batch number where the withdrawal was processed
///   _l2MessageIndex The position in the L2 logs Merkle tree of the l2Log that was sent with the message
///   _l2TxNumberInBatch The L2 transaction number in the batch, in which the log was sent
///   _message The L2 withdraw data, stored in an L2 -> L1 message
///   _merkleProof The Merkle proof of the inclusion L2 -> L1 message about withdrawal initialization
interface IL1SharedBridge {
  event WithdrawalFinalizedSharedBridge(
    uint256 indexed chainId,
    address indexed to,
    address indexed l1Token,
    uint256 amount
  );

  function isWithdrawalFinalized(
    uint256 _chainId,
    uint256 _l2BatchNumber,
    uint256 _l2MessageIndex
  ) external view returns (bool);

  function finalizeWithdrawal(
    uint256 _chainId,
    uint256 _l2BatchNumber,
    uint256 _l2MessageIndex,
    uint16 _l2TxNumberInBatch,
    bytes calldata _message,
    bytes32[] calldata _merkleProof
  ) external;
}
