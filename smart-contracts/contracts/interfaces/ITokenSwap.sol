// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface ITokenSwap {
  function swap(
    address pool,
    uint24 uniswapWethPoolFeeToken,
    uint24 uniswapWethPoolFeeAsset,
    uint48 deadline
  ) external payable returns (uint amount);
}
