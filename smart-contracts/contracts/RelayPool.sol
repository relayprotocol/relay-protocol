// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "solmate/src/tokens/ERC4626.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {ITokenSwap} from "./interfaces/ITokenSwap.sol";
import {TypeCasts} from "./utils/TypeCasts.sol";
import {HyperlaneMessage} from "./Types.sol";
import {IBridgeProxy} from "./interfaces/IBridgeProxy.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title RelayPool
/// @author Relay Protocol
/// @notice ERC4626 vault that enables cross-chain asset bridging and yield generation
/// @dev Receives bridged assets via Hyperlane, provides instant liquidity, and deposits idle funds into yield pools
contract RelayPool is ERC4626, Ownable {
  /// @notice Configuration for an authorized origin chain and bridge
  /// @param chainId The chain ID of the origin chain
  /// @param bridge The address of the bridge contract on the origin chain
  /// @param curator The address authorized to disable this origin
  /// @param maxDebt Maximum outstanding debt allowed from this origin
  /// @param outstandingDebt Current outstanding debt from this origin
  /// @param proxyBridge The address of the proxy bridge contract for claiming funds
  /// @param bridgeFee Fee charged for bridging (in fractional basis points)
  /// @param coolDown Minimum time in seconds between message timestamp and processing
  struct OriginSettings {
    uint32 chainId;
    address bridge;
    address curator;
    uint256 maxDebt;
    uint256 outstandingDebt;
    address proxyBridge;
    uint32 bridgeFee; // fractional basis points
    uint32 coolDown; // in seconds
  }

  /// @notice Parameters for adding a new origin
  /// @param curator The address authorized to disable this origin
  /// @param chainId The chain ID of the origin chain
  /// @param bridge The address of the bridge contract on the origin chain
  /// @param proxyBridge The address of the proxy bridge contract for claiming funds
  /// @param maxDebt Maximum outstanding debt allowed from this origin
  /// @param bridgeFee Fee charged for bridging (in fractional basis points)
  /// @param coolDown Minimum time in seconds between message timestamp and processing
  struct OriginParam {
    address curator;
    uint32 chainId;
    address bridge;
    address proxyBridge;
    uint256 maxDebt;
    uint32 bridgeFee; // fractional basis points
    uint32 coolDown; // in seconds
  }

  /// @notice Error when caller is not authorized for the operation
  /// @param sender The address that attempted the unauthorized call
  error UnauthorizedCaller(address sender);

  /// @notice Error when attempting to swap the pool's underlying asset
  /// @param token The token address that was attempted to be swapped
  error UnauthorizedSwap(address token);

  /// @notice Error when message is from an unauthorized origin
  /// @param chainId The chain ID of the unauthorized origin
  /// @param bridge The bridge address of the unauthorized origin
  error UnauthorizedOrigin(uint32 chainId, address bridge);

  /// @notice Error when attempting to process an already processed message
  /// @param chainId The chain ID of the message origin
  /// @param bridge The bridge address of the message origin
  /// @param nonce The nonce of the already processed message
  error MessageAlreadyProcessed(uint32 chainId, address bridge, uint256 nonce);

  /// @notice Error when origin would exceed its maximum allowed debt
  /// @param chainId The chain ID of the origin
  /// @param bridge The bridge address of the origin
  /// @param maxDebt The maximum allowed debt for this origin
  /// @param nonce The nonce of the rejected transaction
  /// @param recipient The intended recipient of the funds
  /// @param amount The amount that would exceed the debt limit
  error TooMuchDebtFromOrigin(
    uint32 chainId,
    address bridge,
    uint256 maxDebt,
    uint256 nonce,
    address recipient,
    uint256 amount
  );

  /// @notice Error when native currency transfer fails
  /// @param recipient The intended recipient of the transfer
  /// @param amount The amount that failed to transfer
  error FailedTransfer(address recipient, uint256 amount);

  /// @notice Error when insufficient funds are available
  /// @param amount The amount available
  /// @param balance The balance required
  error InsufficientFunds(uint256 amount, uint256 balance);

  /// @notice Error when native currency is sent to a non-WETH pool
  error NotAWethPool();

  /// @notice Error when message timestamp is too recent based on cooldown period
  /// @param chainId The chain ID of the message origin
  /// @param bridge The bridge address of the message origin
  /// @param nonce The nonce of the message
  /// @param timestamp The timestamp of the message
  /// @param coolDown The required cooldown period
  error MessageTooRecent(
    uint32 chainId,
    address bridge,
    uint256 nonce,
    uint256 timestamp,
    uint32 coolDown
  );

  /// @notice Error when share price is below minimum acceptable threshold
  /// @param actualPrice The actual share price
  /// @param minPrice The minimum acceptable share price
  error SharePriceTooLow(uint256 actualPrice, uint256 minPrice);

  /// @notice Error when share price is above maximum acceptable threshold
  /// @param actualPrice The actual share price
  /// @param maxPrice The maximum acceptable share price
  error SharePriceTooHigh(uint256 actualPrice, uint256 maxPrice);

  /// @notice The address of the Hyperlane mailbox
  /// @dev Used to receive cross-chain messages
  address public immutable HYPERLANE_MAILBOX;

  /// @notice The address of the WETH contract (used for native pools)
  /// @dev Set to WETH address for native currency pools, otherwise can be address(0)
  address public immutable WETH;

  /// @notice Denominator for fractional basis points calculations (1 = 0.0000001 bps)
  uint256 public constant FRACTIONAL_BPS_DENOMINATOR = 100_000_000_000;

  /// @notice Keeping track of the outstanding debt for ERC4626 computations
  /// @dev Represents funds that have been sent but not yet claimed from bridges
  uint256 public outstandingDebt = 0;

  /// @notice Mapping of origins to their settings
  /// @dev [chainId][bridgeAddress] => OriginSettings
  mapping(uint32 => mapping(address => OriginSettings))
    public authorizedOrigins;

  /// @notice Mapping of messages by origin
  /// @dev [chainId][bridgeAddress][nonce] => message data
  mapping(uint32 => mapping(address => mapping(uint256 => bytes)))
    public messages;

  /// @notice The address of the yield pool where funds are deposited
  /// @dev Must be an ERC4626 vault for the same underlying asset
  address public yieldPool;

  /// @notice UniswapV3 wrapper contract for token swaps
  address public tokenSwapAddress;

  /// @notice Keeping track of the total fees collected
  /// @dev Fees are held in the yield pool until they finish streaming
  uint256 public pendingBridgeFees = 0;

  /// @notice All incoming assets are streamed (even though they are instantly deposited in the yield pool)
  /// @dev Total amount of assets currently being streamed
  uint256 public totalAssetsToStream = 0;

  /// @notice Timestamp when assets were last collected for streaming
  uint256 public lastAssetsCollectedAt = 0;

  /// @notice Timestamp when current streaming period ends
  uint256 public endOfStream = block.timestamp;

  /// @notice Duration over which collected assets are streamed
  uint256 public streamingPeriod = 7 days;

  /// @notice Emitted when a loan is provided to a bridge recipient
  /// @param nonce The unique identifier of the transaction
  /// @param recipient The address receiving the funds
  /// @param asset The asset being transferred
  /// @param amount The total amount including fees
  /// @param origin The origin settings for this bridge
  /// @param fees The fee amount collected
  event LoanEmitted(
    uint256 indexed nonce,
    address indexed recipient,
    ERC20 asset,
    uint256 amount,
    OriginSettings origin,
    uint256 fees
  );

  /// @notice Emitted when bridged funds are claimed and deposited
  /// @param chainId The chain ID of the bridge origin
  /// @param bridge The bridge address on the origin chain
  /// @param amount The total amount claimed
  /// @param fees The fee amount collected
  event BridgeCompleted(
    uint32 chainId,
    address indexed bridge,
    uint256 amount,
    uint256 fees
  );

  /// @notice Emitted when outstanding debt changes
  /// @param oldDebt Previous total outstanding debt
  /// @param newDebt New total outstanding debt
  /// @param origin The origin settings involved
  /// @param oldOriginDebt Previous outstanding debt for the origin
  /// @param newOriginDebt New outstanding debt for the origin
  event OutstandingDebtChanged(
    uint256 oldDebt,
    uint256 newDebt,
    OriginSettings origin,
    uint256 oldOriginDebt,
    uint256 newOriginDebt
  );

  /// @notice Emitted when assets are deposited into the yield pool
  /// @param amount The amount deposited
  /// @param yieldPool The yield pool address
  event AssetsDepositedIntoYieldPool(uint256 amount, address yieldPool);

  /// @notice Emitted when assets are withdrawn from the yield pool
  /// @param amount The amount withdrawn
  /// @param yieldPool The yield pool address
  event AssetsWithdrawnFromYieldPool(uint256 amount, address yieldPool);

  /// @notice Emitted when the token swap address is changed
  /// @param prevAddress The previous swap contract address
  /// @param newAddress The new swap contract address
  event TokenSwapChanged(address prevAddress, address newAddress);

  /// @notice Emitted when the yield pool is changed
  /// @param oldPool The previous yield pool address
  /// @param newPool The new yield pool address
  event YieldPoolChanged(address oldPool, address newPool);

  /// @notice Emitted when the streaming period is changed
  /// @param oldPeriod The previous streaming period
  /// @param newPeriod The new streaming period
  event StreamingPeriodChanged(uint256 oldPeriod, uint256 newPeriod);

  /// @notice Emitted when a new origin is added
  /// @param origin The origin parameters
  event OriginAdded(OriginParam origin);

  /// @notice Emitted when an origin is disabled
  /// @param chainId The chain ID of the disabled origin
  /// @param bridge The bridge address of the disabled origin
  /// @param maxDebt The previous maximum debt limit
  /// @param outstandingDebt The outstanding debt at time of disabling
  /// @param proxyBridge The proxy bridge address
  event OriginDisabled(
    uint32 chainId,
    address bridge,
    uint256 maxDebt,
    uint256 outstandingDebt,
    address proxyBridge
  );

  /// @notice Initializes the RelayPool with core parameters
  /// @dev Warning: the owner should always be a timelock with significant delay
  /// @param hyperlaneMailbox The Hyperlane mailbox contract address
  /// @param asset The underlying asset for this vault
  /// @param name The name of the vault token
  /// @param symbol The symbol of the vault token
  /// @param baseYieldPool The initial yield pool for depositing assets
  /// @param weth The WETH contract address (for native currency pools)
  /// @param curator The address that will own the pool after deployment
  constructor(
    address hyperlaneMailbox,
    ERC20 asset,
    string memory name,
    string memory symbol,
    address baseYieldPool,
    address weth,
    address curator
  ) ERC4626(asset, name, symbol) Ownable(msg.sender) {
    // Set the Hyperlane mailbox
    HYPERLANE_MAILBOX = hyperlaneMailbox;

    // set the yieldPool
    yieldPool = baseYieldPool;

    // set weth
    WETH = weth;

    // Change the owner to the curator
    transferOwnership(curator);
  }

  /// @notice Updates the streaming period for fee accrual
  /// @dev Updates streamed assets before changing the period
  /// @param newPeriod The new streaming period in seconds
  function updateStreamingPeriod(uint256 newPeriod) public onlyOwner {
    updateStreamedAssets();
    uint256 oldPeriod = streamingPeriod;
    streamingPeriod = newPeriod;
    emit StreamingPeriodChanged(oldPeriod, newPeriod);
  }

  /// @notice Updates the yield pool, moving all assets from the old pool to the new one
  /// @dev Implements share price-based slippage protection to ensure fair value transfer
  /// @param newPool The address of the new yield pool
  /// @param minSharePriceFromOldPool The minimum acceptable share price when withdrawing from the old pool
  /// @param maxSharePricePriceFromNewPool The maximum acceptable share price when depositing into the new pool
  function updateYieldPool(
    address newPool,
    uint256 minSharePriceFromOldPool,
    uint256 maxSharePricePriceFromNewPool
  ) public onlyOwner {
    address oldPool = yieldPool;
    uint256 sharesOfOldPool = ERC20(yieldPool).balanceOf(address(this));

    // Calculate share price of old pool using convertToAssets
    uint256 oldPoolSharePrice = ERC4626(oldPool).convertToAssets(
      10 ** ERC20(oldPool).decimals()
    );

    // Check if share price is too low
    if (oldPoolSharePrice < minSharePriceFromOldPool) {
      revert SharePriceTooLow(oldPoolSharePrice, minSharePriceFromOldPool);
    }

    // Redeem all the shares from the old pool
    uint256 withdrawnAssets = ERC4626(yieldPool).redeem(
      sharesOfOldPool,
      address(this),
      address(this)
    );
    yieldPool = newPool;

    // Calculate share price of new pool using convertToAssets
    uint256 newPoolSharePrice = ERC4626(newPool).convertToAssets(
      10 ** ERC20(newPool).decimals()
    );

    // Check if share price is too high
    if (newPoolSharePrice > maxSharePricePriceFromNewPool) {
      revert SharePriceTooHigh(
        newPoolSharePrice,
        maxSharePricePriceFromNewPool
      );
    }

    // Deposit all assets into the new pool
    SafeERC20.safeIncreaseAllowance(
      IERC20(address(asset)),
      newPool,
      withdrawnAssets
    );
    depositAssetsInYieldPool(withdrawnAssets);

    emit YieldPoolChanged(oldPool, newPool);
  }

  /// @notice Adds a new authorized origin for bridging
  /// @dev Only callable by owner, typically a timelock contract
  /// @param origin The origin parameters including chain ID, addresses, and limits
  function addOrigin(OriginParam memory origin) public onlyOwner {
    authorizedOrigins[origin.chainId][origin.bridge] = OriginSettings({
      chainId: origin.chainId,
      bridge: origin.bridge,
      curator: origin.curator, // We can't use msg.sender here, because we recommend msg.sender to be a timelock and this address should be able to disable an origin quickly!
      maxDebt: origin.maxDebt,
      outstandingDebt: 0,
      proxyBridge: origin.proxyBridge,
      bridgeFee: origin.bridgeFee,
      coolDown: origin.coolDown
    });
    emit OriginAdded(origin);
  }

  /// @notice Disables an origin by setting its max debt to zero
  /// @dev Only callable by the origin's curator for emergency response
  /// @param chainId The chain ID of the origin to disable
  /// @param bridge The bridge address of the origin to disable
  function disableOrigin(uint32 chainId, address bridge) public {
    OriginSettings memory origin = authorizedOrigins[chainId][bridge];
    if (msg.sender != origin.curator) {
      revert UnauthorizedCaller(msg.sender);
    }
    authorizedOrigins[chainId][bridge].maxDebt = 0;
    emit OriginDisabled(
      chainId,
      bridge,
      origin.maxDebt,
      origin.outstandingDebt,
      origin.proxyBridge
    );
  }

  /// @notice Increases outstanding debt for an origin
  /// @dev Updates both origin-specific and total outstanding debt
  /// @param amount The amount to increase debt by
  /// @param origin The origin settings to update
  function increaseOutstandingDebt(
    uint256 amount,
    OriginSettings storage origin
  ) internal {
    uint256 currentOriginOutstandingDebt = origin.outstandingDebt;
    origin.outstandingDebt += amount;
    uint256 currentOutstandingDebt = outstandingDebt;
    outstandingDebt += amount;
    emit OutstandingDebtChanged(
      currentOutstandingDebt,
      outstandingDebt,
      origin,
      currentOriginOutstandingDebt,
      origin.outstandingDebt
    );
  }

  /// @notice Decreases outstanding debt for an origin
  /// @dev Updates both origin-specific and total outstanding debt
  /// @param amount The amount to decrease debt by
  /// @param origin The origin settings to update
  function decreaseOutstandingDebt(
    uint256 amount,
    OriginSettings storage origin
  ) internal {
    uint256 currentOriginOutstandingDebt = origin.outstandingDebt;
    origin.outstandingDebt -= amount;
    uint256 currentOutstandingDebt = outstandingDebt;
    outstandingDebt -= amount;
    emit OutstandingDebtChanged(
      currentOutstandingDebt,
      outstandingDebt,
      origin,
      currentOriginOutstandingDebt,
      origin.outstandingDebt
    );
  }

  /// @notice Returns the maximum assets that can be deposited
  /// @dev Limited by the yield pool's capacity
  /// @param /* receiver */ The address that would receive shares (unused)
  /// @return maxAssets The maximum amount of assets that can be deposited
  function maxDeposit(
    address /* receiver */
  ) public view override returns (uint256 maxAssets) {
    return ERC4626(yieldPool).maxDeposit(address(this));
  }

  /// @notice Returns the maximum assets that can be withdrawn by an owner
  /// @dev Limited to the owner's share balance converted to assets
  /// @param owner The address to check withdrawal capacity for
  /// @return maxAssets The maximum amount of assets that can be withdrawn
  function maxWithdraw(
    address owner
  ) public view override returns (uint256 maxAssets) {
    return convertToAssets(this.balanceOf(owner));
  }

  /// @notice Returns the maximum shares that can be minted
  /// @dev Limited by the yield pool's deposit capacity
  /// @param receiver The address that would receive the shares
  /// @return maxShares The maximum amount of shares that can be minted
  function maxMint(
    address receiver
  ) public view override returns (uint256 maxShares) {
    uint256 maxDepositInYieldPool = maxDeposit(receiver);
    return ERC4626.previewDeposit(maxDepositInYieldPool);
  }

  /// @notice Returns the maximum shares that can be redeemed by an owner
  /// @dev Limited by the owner's share balance and yield pool's withdrawal capacity
  /// @param owner The address to check redemption capacity for
  /// @return maxShares The maximum amount of shares that can be redeemed
  function maxRedeem(
    address owner
  ) public view override returns (uint256 maxShares) {
    uint256 maxWithdrawInYieldPool = maxWithdraw(owner);
    return ERC4626.previewWithdraw(maxWithdrawInYieldPool);
  }

  /// @notice Returns the total assets controlled by the pool
  /// @dev Includes yield pool balance, outstanding debt, minus pending fees and streaming assets
  /// @return The total assets under management
  function totalAssets() public view override returns (uint256) {
    uint256 balanceOfYieldPoolTokens = ERC20(yieldPool).balanceOf(
      address(this)
    );
    uint256 yieldPoolBalance = ERC4626(yieldPool).previewRedeem(
      balanceOfYieldPoolTokens
    );
    // Pending bridge fees are still in the yield pool!
    // So we need to extract them from this pool's asset until
    // The bridge is claimed!
    return
      yieldPoolBalance +
      outstandingDebt -
      pendingBridgeFees -
      remainsToStream();
  }

  /// @notice Deposits assets into the yield pool
  /// @dev Internal function that approves and deposits to yield pool
  /// @param amount The amount of assets to deposit
  function depositAssetsInYieldPool(uint256 amount) internal {
    SafeERC20.safeIncreaseAllowance(IERC20(address(asset)), yieldPool, amount);
    ERC4626(yieldPool).deposit(amount, address(this));
    emit AssetsDepositedIntoYieldPool(amount, yieldPool);
  }

  /// @notice Withdraws assets from the yield pool
  /// @dev Internal function that withdraws from yield pool to recipient
  /// @param amount The amount of assets to withdraw
  /// @param recipient The address to receive the withdrawn assets
  function withdrawAssetsFromYieldPool(
    uint256 amount,
    address recipient
  ) internal {
    ERC4626(yieldPool).withdraw(amount, recipient, address(this));
    emit AssetsWithdrawnFromYieldPool(amount, yieldPool);
  }

  /// @notice Handles incoming cross-chain messages from Hyperlane
  /// @dev Only callable by Hyperlane mailbox, provides instant liquidity to recipients
  /// @param chainId The origin chain ID
  /// @param bridgeAddress The origin bridge address (as bytes32)
  /// @param data The encoded message data
  function handle(
    uint32 chainId,
    bytes32 bridgeAddress,
    bytes calldata data
  ) external payable {
    // Only `HYPERLANE_MAILBOX` is authorized to call this method
    if (msg.sender != HYPERLANE_MAILBOX) {
      revert UnauthorizedCaller(msg.sender);
    }

    // convert bytes32 to address
    address bridge = TypeCasts.bytes32ToAddress(bridgeAddress);

    // Check if the origin is authorized
    OriginSettings storage origin = authorizedOrigins[chainId][bridge];
    if (origin.maxDebt == 0) {
      revert UnauthorizedOrigin(chainId, bridge);
    }

    // Parse the data received from the sender chain
    HyperlaneMessage memory message = abi.decode(data, (HyperlaneMessage));

    // if the message is too recent, we reject it
    if (block.timestamp - message.timestamp < origin.coolDown) {
      revert MessageTooRecent(
        chainId,
        bridge,
        message.nonce,
        message.timestamp,
        origin.coolDown
      );
    }

    // Check if message was already processed
    if (messages[chainId][bridge][message.nonce].length > 0) {
      revert MessageAlreadyProcessed(chainId, bridge, message.nonce);
    }
    // Mark as processed if not
    messages[chainId][bridge][message.nonce] = data;

    // Calculate fee using fractional basis points
    uint256 feeAmount = (message.amount * origin.bridgeFee) /
      FRACTIONAL_BPS_DENOMINATOR;
    pendingBridgeFees += feeAmount;

    // Check if origin settings are respected
    // We look at the full amount, because feed are considered debt
    // (they are owed to the pool)
    if (origin.outstandingDebt + message.amount > origin.maxDebt) {
      revert TooMuchDebtFromOrigin(
        chainId,
        bridge,
        origin.maxDebt,
        message.nonce,
        message.recipient,
        message.amount
      );
    }
    increaseOutstandingDebt(message.amount, origin);

    // We only send the amount net of fees
    sendFunds(message.amount - feeAmount, message.recipient);

    emit LoanEmitted(
      message.nonce,
      message.recipient,
      asset,
      message.amount,
      origin,
      feeAmount
    );
  }

  /// @notice Calculates remaining assets to be streamed
  /// @dev Returns zero if streaming period has ended
  /// @return The amount of assets remaining to be streamed
  function remainsToStream() internal view returns (uint256) {
    if (block.timestamp > endOfStream) {
      return 0; // Nothing left to stream
    } else {
      return
        totalAssetsToStream - // total assets to stream
        (totalAssetsToStream * (block.timestamp - lastAssetsCollectedAt)) /
        (endOfStream - lastAssetsCollectedAt); // already streamed
    }
  }

  /// @notice Updates the streamed assets calculation
  /// @dev Resets the streaming calculation to current timestamp
  /// @return The new total assets to stream
  function updateStreamedAssets() public returns (uint256) {
    totalAssetsToStream = remainsToStream();
    lastAssetsCollectedAt = block.timestamp;
    return totalAssetsToStream;
  }

  /// @notice Adds assets to be accounted for in a streaming fashion
  /// @dev Adjusts streaming end time based on weighted average
  /// @param amount The amount of assets to add to streaming
  /// @return The new total assets to stream
  function addToStreamingAssets(uint256 amount) internal returns (uint256) {
    if (amount > 0) {
      updateStreamedAssets();
      // We adjust the end of the stream based on the new amount
      uint256 amountLeft = remainsToStream();
      uint256 timeLeft = Math.max(endOfStream, block.timestamp) -
        block.timestamp;
      uint256 weightedStreamingPeriod = (amountLeft *
        timeLeft +
        amount *
        streamingPeriod) / (amountLeft + amount);
      endOfStream = block.timestamp + weightedStreamingPeriod;
    }
    return totalAssetsToStream += amount;
  }

  /// @notice Claims funds from a bridge after they arrive
  /// @dev Decreases outstanding debt and deposits funds into yield pool
  /// @param chainId The origin chain ID
  /// @param bridge The origin bridge address
  /// @return amount The amount of assets claimed
  function claim(
    uint32 chainId,
    address bridge
  ) public returns (uint256 amount) {
    OriginSettings storage origin = authorizedOrigins[chainId][bridge];
    if (origin.proxyBridge == address(0)) {
      revert UnauthorizedOrigin(chainId, bridge);
    }

    // We need to claim the funds from the bridge proxy contract
    amount = IBridgeProxy(origin.proxyBridge).claim(
      address(asset) == WETH ? address(0) : address(asset),
      origin.outstandingDebt
    );

    // We should have received funds
    decreaseOutstandingDebt(amount, origin);
    // and we should deposit these funds into the yield pool
    depositAssetsInYieldPool(amount);

    // The amount is the amount that was loaned + the fees
    uint256 feeAmount = (amount * origin.bridgeFee) /
      FRACTIONAL_BPS_DENOMINATOR;
    pendingBridgeFees -= feeAmount;
    // We need to account for it in a streaming fashion
    addToStreamingAssets(feeAmount);

    emit BridgeCompleted(chainId, bridge, amount, feeAmount);
  }

  /// @notice Sends funds to a recipient
  /// @dev Handles both ERC20 and native currency transfers
  /// @param amount The amount to send
  /// @param recipient The address to receive the funds
  function sendFunds(uint256 amount, address recipient) internal {
    if (address(asset) == WETH) {
      withdrawAssetsFromYieldPool(amount, address(this));
      IWETH(WETH).withdraw(amount);
      (bool success, ) = recipient.call{value: amount}("");
      if (!success) {
        revert FailedTransfer(recipient, amount);
      }
    } else {
      withdrawAssetsFromYieldPool(amount, recipient);
    }
  }

  /// @notice Sets the token swap contract address
  /// @dev Used for swapping non-asset tokens received by the pool
  /// @param newTokenSwapAddress The new token swap contract address
  function setTokenSwap(address newTokenSwapAddress) external onlyOwner {
    address prevTokenSwapAddress = tokenSwapAddress;
    tokenSwapAddress = newTokenSwapAddress;
    emit TokenSwapChanged(prevTokenSwapAddress, tokenSwapAddress);
  }

  /// @notice Swaps tokens and deposits resulting assets
  /// @dev Swaps via Uniswap V3 through the token swap contract
  /// @param token The token to swap from
  /// @param amount The amount of tokens to swap
  /// @param uniswapWethPoolFeeToken The fee tier for token-WETH pool
  /// @param uniswapWethPoolFeeAsset The fee tier for WETH-asset pool
  /// @param deadline The deadline for the swap
  /// @param amountOutMinimum The minimum amount of assets to receive
  function swapAndDeposit(
    address token,
    uint256 amount,
    uint24 uniswapWethPoolFeeToken,
    uint24 uniswapWethPoolFeeAsset,
    uint48 deadline,
    uint256 amountOutMinimum
  ) public onlyOwner {
    if (token == address(asset)) {
      revert UnauthorizedSwap(token);
    }

    SafeERC20.safeTransfer(IERC20(address(token)), tokenSwapAddress, amount);

    ITokenSwap(tokenSwapAddress).swap(
      token,
      uniswapWethPoolFeeToken,
      uniswapWethPoolFeeAsset,
      deadline,
      amountOutMinimum
    );
    collectNonDepositedAssets();
  }

  /// @notice Collects any assets not yet deposited and starts streaming them
  /// @dev Can be called by anyone to ensure timely asset collection
  function collectNonDepositedAssets() public {
    uint256 balance = ERC20(asset).balanceOf(address(this));
    if (balance > 0) {
      depositAssetsInYieldPool(balance);
      addToStreamingAssets(balance);
    }
  }

  /// @notice Hook called before withdrawing assets from the vault
  /// @dev Withdraws assets from yield pool before processing withdrawal
  /// @param assets The amount of assets to withdraw
  /// @param /* shares */ The amount of shares being burned (unused)
  function beforeWithdraw(
    uint256 assets,
    uint256 /* shares */
  ) internal override {
    // We need to withdraw the assets from the yield pool
    withdrawAssetsFromYieldPool(assets, address(this));
  }

  /// @notice Hook called after depositing assets to the vault
  /// @dev Deposits assets into yield pool after receiving them
  /// @param assets The amount of assets deposited
  /// @param /* shares */ The amount of shares minted (unused)
  function afterDeposit(
    uint256 assets,
    uint256 /* shares */
  ) internal override {
    // We need to deposit the assets into the yield pool
    depositAssetsInYieldPool(assets);
  }

  /// @notice Processes failed Hyperlane messages manually
  /// @dev Only callable by owner, typically after slow bridge resolution
  /// @param chainId The origin chain ID
  /// @param bridge The origin bridge address
  /// @param data The encoded message data
  function processFailedHandler(
    uint32 chainId,
    address bridge,
    bytes calldata data
  ) public onlyOwner {
    OriginSettings storage origin = authorizedOrigins[chainId][bridge]; // no validation here since this is onlyOwner and _may_ be called for a disabled origin.
    HyperlaneMessage memory message = abi.decode(data, (HyperlaneMessage));

    // Check if message was already processed
    if (messages[chainId][bridge][message.nonce].length > 0) {
      revert MessageAlreadyProcessed(chainId, bridge, message.nonce);
    }

    // Mark the message as processed to avoid double processing (if the hyperlane message eventually makes it)
    messages[chainId][bridge][message.nonce] = data;

    // Increase the outstanding debt with the amount
    increaseOutstandingDebt(message.amount, origin);
    // And immediately claim from the bridge to get the funds (and decrease the outstanding debt!)
    uint256 amount = claim(chainId, bridge);
    if (amount < message.amount) {
      revert InsufficientFunds(amount, message.amount);
    }

    // Send the funds to the recipient (we should not take fees because the funds have taken more time to arrive...)
    sendFunds(message.amount, message.recipient);
  }

  /// @notice Receives native currency
  /// @dev Required for WETH unwrapping in native currency pools
  receive() external payable {
    if (address(asset) != WETH) {
      revert NotAWethPool();
    }
    if (msg.sender != WETH) {
      IWETH(WETH).deposit{value: address(this).balance}();
    }
  }
}
