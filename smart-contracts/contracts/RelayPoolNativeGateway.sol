// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IWETH} from "./interfaces/IWETH.sol";

/// @title RelayPoolNativeGateway
/// @author Relay Protocol
/// @notice Gateway contract for depositing and withdrawing native ETH to/from WETH-based RelayPools
/// @dev Handles wrapping/unwrapping of ETH and provides slippage protection for all operations
contract RelayPoolNativeGateway {
  /// @notice Error when ETH transfer fails
  error EthTransferFailed();

  /// @notice Error when contract receives ETH from non-WETH address
  error OnlyWethCanSendEth();

  /// @notice Error when ETH remains in contract after operation
  error RemainingEth();

  /// @notice Error when slippage protection is triggered
  error SlippageExceeded();

  /// @notice The Wrapped ETH (WETH) contract
  /// @dev Used to wrap/unwrap native ETH for pool operations
  IWETH public immutable WETH;

  /// @notice Initializes the gateway with the WETH contract address
  /// @param wethAddress Address of the Wrapped Native token contract
  constructor(address wethAddress) {
    WETH = IWETH(wethAddress);
  }

  /// @notice Deposits native ETH into a WETH-based pool
  /// @dev Wraps ETH to WETH, then deposits to the pool with slippage protection
  /// @param pool The address of the ERC4626 pool to deposit into
  /// @param receiver The address that will receive the pool shares
  /// @param minSharesOut Minimum amount of shares to receive (slippage protection)
  /// @return shares The amount of pool shares minted to the receiver
  function deposit(
    address pool,
    address receiver,
    uint256 minSharesOut
  ) external payable returns (uint256 shares) {
    // wrap tokens
    WETH.deposit{value: msg.value}();
    SafeERC20.safeIncreaseAllowance(IERC20(address(WETH)), pool, msg.value);

    // do the deposit
    shares = IERC4626(pool).deposit(msg.value, receiver);

    // Enforce slippage protection
    if (shares < minSharesOut) {
      revert SlippageExceeded();
    }
  }

  /// @notice Mints pool shares by depositing native ETH
  /// @dev Wraps ETH, calculates shares, then mints with slippage protection
  /// @param pool The address of the ERC4626 pool to mint shares from
  /// @param receiver The address that will receive the pool shares
  /// @param minSharesOut Minimum amount of shares to receive (slippage protection)
  /// @return shares The amount of pool shares minted to the receiver
  function mint(
    address pool,
    address receiver,
    uint256 minSharesOut
  ) external payable returns (uint256 shares) {
    // wrap tokens
    WETH.deposit{value: msg.value}();
    SafeERC20.safeIncreaseAllowance(IERC20(address(WETH)), pool, msg.value);

    // do the deposit
    shares = IERC4626(pool).convertToShares(msg.value);

    // Enforce slippage protection
    if (shares < minSharesOut) {
      revert SlippageExceeded();
    }

    IERC4626(pool).mint(shares, receiver);
  }

  /// @notice Withdraws a specific amount of native ETH from a WETH-based pool
  /// @dev Withdraws WETH from pool, unwraps to ETH, with slippage protection
  /// @param pool The address of the ERC4626 pool to withdraw from
  /// @param assets Amount of native ETH to withdraw
  /// @param receiver The address that will receive the native ETH
  /// @param maxSharesIn Maximum amount of shares to burn (slippage protection)
  /// @return shares The amount of pool shares burned
  function withdraw(
    address pool,
    uint256 assets,
    address receiver,
    uint256 maxSharesIn
  ) external virtual returns (uint256 shares) {
    uint256 balanceBefore = address(this).balance;

    // withdraw from pool
    shares = IERC4626(pool).withdraw(assets, address(this), msg.sender);

    // Enforce slippage protection
    if (shares > maxSharesIn) {
      revert SlippageExceeded();
    }

    // withdraw native tokens and send them back
    WETH.withdraw(assets);
    safeTransferETH(receiver, assets);

    // make sure no ETH is left in the contract
    if (address(this).balance - balanceBefore > 0) {
      revert RemainingEth();
    }
  }

  /// @notice Redeems pool shares for native ETH
  /// @dev Redeems shares for WETH, unwraps to ETH, with slippage protection
  /// @param pool The address of the ERC4626 pool to redeem from
  /// @param shares Amount of pool shares to redeem
  /// @param receiver The address that will receive the native ETH
  /// @param minAssetsOut Minimum amount of ETH to receive (slippage protection)
  /// @return assets The amount of native ETH sent to receiver
  function redeem(
    address pool,
    uint256 shares,
    address receiver,
    uint256 minAssetsOut
  ) external virtual returns (uint256 assets) {
    uint256 balanceBefore = address(this).balance;
    // withdraw from pool
    assets = IERC4626(pool).redeem(shares, address(this), msg.sender);

    // Enforce slippage protection
    if (assets < minAssetsOut) {
      revert SlippageExceeded();
    }

    // withdraw native tokens and send them back
    WETH.withdraw(assets);
    safeTransferETH(receiver, assets);

    // make sure no ETH is left in the contract
    if (address(this).balance - balanceBefore > 0) {
      revert RemainingEth();
    }
  }

  /// @notice Safely transfers ETH to an address
  /// @dev Reverts if the ETH transfer fails
  /// @param to Recipient of the ETH transfer
  /// @param value Amount of ETH to transfer
  function safeTransferETH(address to, uint256 value) internal {
    (bool success, ) = to.call{value: value}(new bytes(0));
    if (!success) {
      revert EthTransferFailed();
    }
  }

  /// @notice Receives ETH only from WETH contract
  /// @dev Required for WETH unwrapping operations
  receive() external payable {
    if (msg.sender != address(WETH)) {
      revert OnlyWethCanSendEth();
    }
  }
}
