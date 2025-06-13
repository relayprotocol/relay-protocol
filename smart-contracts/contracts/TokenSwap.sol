/* solhint-disable one-contract-per-file */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IUniversalRouter} from "./interfaces/uniswap/IUniversalRouter.sol";
import {IRelayPool} from "./interfaces/IRelayPool.sol";

/// @title TokenSwap
/// @author Relay Protocol
/// @notice A helper contract that facilitates token swaps through Uniswap's Universal Router
/// @dev This contract is designed to work with RelayPool contracts and handles swapping of
///      various tokens to the pool's asset token using Uniswap V3 pools
contract TokenSwap {
  /// @notice Address of Uniswap's Universal Router
  /// @dev Required for executing swaps through Uniswap V3
  address public immutable UNISWAP_UNIVERSAL_ROUTER;

  /// @notice Command identifier for V3 exact input swaps
  /// @dev Specified in https://docs.uniswap.org/contracts/universal-router/technical-reference#v3_swap_exact_in
  uint256 internal constant V3_SWAP_EXACT_IN = 0x00;

  /// @notice Emitted when a token swap is successfully completed
  /// @param pool The RelayPool that initiated the swap
  /// @param tokenIn The address of the input token
  /// @param tokenOut The address of the output token (pool's asset)
  /// @param amountIn The amount of input tokens swapped
  /// @param amountOut The amount of output tokens received
  event TokenSwapped(
    address pool,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOut
  );

  /// @notice Error when a token swap fails to produce output tokens
  /// @param uniswapUniversalRouter The Universal Router address that failed
  /// @param tokenIn The input token that failed to swap
  /// @param amount The amount that was attempted to swap
  error TokenSwappedFailed(
    address uniswapUniversalRouter,
    address tokenIn,
    uint256 amount
  );

  /// @notice Error when attempting to swap the pool's asset token to itself
  error UnauthorizedSwap();

  /// @notice Initializes the contract with Uniswap Universal Router address
  /// @param _uniswapUniversalRouter The address of Uniswap Universal Router
  constructor(address _uniswapUniversalRouter) {
    UNISWAP_UNIVERSAL_ROUTER = _uniswapUniversalRouter;
  }

  /// @notice Retrieves the balance of a specified token for this contract
  /// @dev This is a helper function used internally to check token balances
  /// @param token The address of the ERC20 token
  /// @return The balance of the specified token held by this contract
  function _getBalance(address token) internal view returns (uint256) {
    return IERC20(token).balanceOf(address(this));
  }

  /// @notice Swaps input tokens for the pool's asset token using Uniswap V3
  /// @dev The swap can follow two routes:
  ///      1. Direct: token -> asset (when uniswapWethPoolFeeAsset is 0)
  ///      2. Through WETH: token -> WETH -> asset (default route)
  /// @param tokenAddress The address of the input token to swap
  /// @param uniswapWethPoolFeeToken The fee tier for the token-WETH pool (if used)
  /// @param uniswapWethPoolFeeAsset The fee tier for the WETH-asset pool (if used)
  /// @param deadline The Unix timestamp after which the swap will revert
  /// @param amountOutMinimum The minimum amount of output tokens that must be received
  /// @return amountOut The amount of output tokens received from the swap
  function swap(
    address tokenAddress,
    uint24 uniswapWethPoolFeeToken,
    uint24 uniswapWethPoolFeeAsset,
    uint48 deadline,
    uint256 amountOutMinimum
  ) public payable returns (uint256 amountOut) {
    // Get pool information - only pools can call this function
    address pool = msg.sender;
    address asset = IRelayPool(pool).asset();
    address wrappedAddress = IRelayPool(pool).WETH();

    // Get total balance of token to swap
    uint256 tokenAmount = _getBalance(tokenAddress);
    uint256 assetAmountBefore = _getBalance(asset);

    // Prevent swapping asset to itself
    if (tokenAddress == asset) {
      revert UnauthorizedSwap();
    }

    // Transfer tokens to Universal Router for swapping
    SafeERC20.safeTransfer(
      IERC20(tokenAddress),
      UNISWAP_UNIVERSAL_ROUTER,
      tokenAmount
    );

    // Build the swap path based on fee parameters
    bytes memory path = uniswapWethPoolFeeAsset == 0
      ? abi.encodePacked(tokenAddress, uniswapWethPoolFeeToken, asset) // Direct swap: token -> asset
      : abi.encodePacked(tokenAddress, uniswapWethPoolFeeToken, wrappedAddress); // Route through WETH: token -> WETH

    // Add WETH -> asset leg if routing through WETH and asset is not WETH
    if (uniswapWethPoolFeeAsset != 0 && asset != wrappedAddress) {
      path = abi.encodePacked(path, uniswapWethPoolFeeAsset, asset);
    }

    // Encode parameters for the V3 swap
    bytes memory commands = abi.encodePacked(bytes1(uint8(V3_SWAP_EXACT_IN)));
    bytes[] memory inputs = new bytes[](1);
    inputs[0] = abi.encode(
      address(this), // recipient is this contract
      tokenAmount, // amountIn
      amountOutMinimum, // amountOutMinimum
      path,
      false // funds are coming from universal router
    );

    // Execute the swap through Universal Router
    IUniversalRouter(UNISWAP_UNIVERSAL_ROUTER).execute(
      commands,
      inputs,
      uint256(deadline)
    );

    // Verify swap success by checking output amount
    amountOut = _getBalance(asset) - assetAmountBefore;
    if (amountOut == 0) {
      revert TokenSwappedFailed(
        UNISWAP_UNIVERSAL_ROUTER,
        tokenAddress,
        tokenAmount
      );
    }

    // Transfer the swapped assets back to the pool
    SafeERC20.safeTransfer(IERC20(asset), pool, amountOut);
    emit TokenSwapped(pool, tokenAddress, asset, tokenAmount, amountOut);
  }

  /// @notice Receives ETH from WETH unwrapping during swaps
  /// @dev Required when swapping through WETH and the Universal Router unwraps WETH
  receive() external payable {}
}
