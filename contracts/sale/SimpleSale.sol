// SPDX-License-Identifier: MIT

pragma solidity = 0.6.8;

import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";
import "./Sale.sol";

/**
 * @title SimpleSale
 */
abstract contract SimpleSale is Sale, GSNRecipient {
    using SafeMath for uint256;

    // enum ErrorCodes {
    //     RESTRICTED_METHOD,
    //     INSUFFICIENT_BALANCE
    // }

    event PriceUpdated(
        bytes32 sku,
        uint256 ethPrice,
        uint256 erc20Price
    );

    /**
     * Used to represent the unit price for a given purchase ID in terms of
     * ETH and/or an ERC20 token amount.
     */
    struct Price {
        uint256 ethPrice;
        uint256 erc20Price;
    }

    mapping(bytes32 /* sku */ => Price) public prices;

    /**
     * Constructor.
     * @param payoutWallet_ The wallet address used to receive purchase payments
     *  with.
     * @param payoutToken_ The ERC20 token currency accepted by the payout
     *  wallet for purchase payments.
     */
    constructor(
        address payable payoutWallet_,
        IERC20 payoutToken_
    )
        Sale(
            payoutWallet_,
            payoutToken_
        )
        internal
    {}

    /**
     * Sets the ETH/ERC20 price for the given purchase ID.
     * @dev Will emit the PriceUpdated event after calling the function successfully.
     * @param sku The SKU item whose price will be set.
     * @param ethPrice The ETH price to assign to the purchase ID.
     * @param erc20Price The ERC20 token price to assign to the purchase ID.
     */
    function setPrice(bytes32 sku, uint256 ethPrice, uint256 erc20Price) public onlyOwner {
        prices[sku] = Price(ethPrice, erc20Price);
        emit PriceUpdated(sku, ethPrice, erc20Price);
    }

    /////////////////////////////////////////// GSNRecipient implementation ///////////////////////////////////

    /**
     * @dev Ensures that only users with enough gas payment token balance can have transactions relayed through the GSN.
     */
    function acceptRelayedCall(
        address /* relay */,
        address /* from */,
        bytes calldata encodedFunction,
        uint256 /* transactionFee */,
        uint256 /* gasPrice */,
        uint256 /* gasLimit */,
        uint256 /* nonce */,
        bytes calldata /* approvalData */,
        uint256 /* maxPossibleCharge */
    )
        external
        view
        override
        returns (uint256, bytes memory mem)
    {
        // restrict to burn function only
        // load methodId stored in first 4 bytes https://solidity.readthedocs.io/en/v0.5.16/abi-spec.html#function-selector-and-argument-encoding
        // load amount stored in the next 32 bytes https://solidity.readthedocs.io/en/v0.5.16/abi-spec.html#function-selector-and-argument-encoding
        // 32 bytes offset is required to skip array length
        bytes4 methodId;
        address purchaser;
        string memory sku;
        uint256 quantity;
        address paymentToken;
        mem = encodedFunction;
        assembly {
            let dest := add(mem, 32)
            methodId := mload(dest)
            dest := add(dest, 4)
            purchaser := mload(dest)
            dest := add(dest, 32)
            sku := mload(dest)
            dest := add(dest, 32)
            quantity := mload(dest)
            dest := add(dest, 32)
            paymentToken := mload(dest)
        }

        // bytes4(keccak256("purchaseFor(address,string,uint256,address)")) == 0xwwwwww
        // if (methodId != 0xwwwwww) {
            // return _rejectRelayedCall(uint256(ErrorCodes.RESTRICTED_METHOD));
        // }

        // Check that user has enough balance
        // if (balanceOf(from) < amountParam) {
        //     return _rejectRelayedCall(uint256(ErrorCodes.INSUFFICIENT_BALANCE));
        // }

        //TODO restrict to purchaseFor() and add validation checks

        return _approveRelayedCall();
    }

    function _preRelayedCall(bytes memory) internal override returns (bytes32) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function _postRelayedCall(bytes memory, bool, uint256, bytes32) internal override {
        // solhint-disable-previous-line no-empty-blocks
    }

    function _msgSender() internal view override (GSNRecipient, Context) returns (address payable) {
        return Context._msgSender();
    }

    function _msgData() internal view override (GSNRecipient, Context) returns (bytes memory) {
        return Context._msgData();
    }

    /**
     * @dev Withdraws the purchaser's deposits in `RelayHub`.
     */
    function withdrawDeposits(uint256 amount, address payable payee) external onlyOwner {
        _withdrawDeposits(amount, payee);
    }

    /////////////////////////////////////////// internal hooks ///////////////////////////////////

    /**
     * Validates a purchase.
     * @param purchase Purchase conditions.
     */
    function _validatePurchase(
        Purchase memory purchase
    ) internal override virtual view {
        require(
            purchase.purchaser != address(0),
            "SimpleSale: Purchaser cannot be the zero address");

        require(
            purchase.purchaser != address(uint160(address(this))),
            "SimpleSale: Purchaser cannot be the contract address");

        require(
            purchase.quantity != 0,
            "SimpleSale: Quantity cannot be zero");

        require(
            (purchase.paymentToken == ETH_ADDRESS) || (purchase.paymentToken == payoutToken),
            "SimpleSale: Payment token is unsupported");
    }

    /**
     * Calculates the purchase price.
     * @param purchase Purchase conditions.
     * @return priceInfo Implementation-specific calculated purchase price
     *  information (0:total price, 1:unit price).
     */
    function _calculatePrice(
        Purchase memory purchase
    ) internal override virtual returns (bytes32[] memory priceInfo) {
        uint256 unitPrice;

        if (purchase.paymentToken == ETH_ADDRESS) {
            unitPrice = prices[purchase.sku].ethPrice;
        } else {
            require(
                payoutToken != IERC20(0),
                "SimpleSale: ERC20 payment is unsupported");

            unitPrice = prices[purchase.sku].erc20Price;
        }

        require(unitPrice != 0, "SimpleSale: Invalid SKU");

        uint256 totalPrice = unitPrice.mul(purchase.quantity);

        priceInfo = new bytes32[](2);
        priceInfo[0] = bytes32(totalPrice);
        priceInfo[1] = bytes32(unitPrice);
    }

    /**
     * Accepts payment for a purchase.
     * @param purchase Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information.
     * @return paymentInfo Implementation-specific accepted purchase payment
     *  information.
     */
    function _acceptPayment(
        Purchase memory purchase,
        bytes32[] memory priceInfo
    ) internal override virtual returns (bytes32[] memory /* paymentInfo */) {
        uint256 totalPrice = uint256(priceInfo[0]);

        if (purchase.paymentToken == ETH_ADDRESS) {
            require(
                msg.value >= totalPrice,
                "SimpleSale: Insufficient ETH provided");

            payoutWallet.transfer(totalPrice);

            uint256 change = msg.value.sub(totalPrice);

            if (change > 0) {
                purchase.operator.transfer(change);
            }
        } else {
            require(
                payoutToken.transferFrom(purchase.operator, payoutWallet, totalPrice),
                "SimpleSale: Failure in transferring ERC20 payment");
        }
    }

    /**
     * Retrieves implementation-specific extra data passed as the Purchased
     *  event extData argument.
     * @param *purchase* Purchase conditions.
     * @param priceInfo Implementation-specific calculated purchase price
     *  information.
     * @param *paymentInfo* Implementation-specific accepted purchase payment
     *  information.
     * @param *deliveryInfo* Implementation-specific purchase delivery
     *  information.
     * @param *finalizeInfo* Implementation-specific purchase finalization
     *  information.
     * @return extData Implementation-specific extra data passed as the Purchased event
     *  extData argument (0:total price, 1:unit price).
     */
    function _getPurchasedEventExtData(
        Purchase memory /* purchase */,
        bytes32[] memory priceInfo,
        bytes32[] memory /* paymentInfo */,
        bytes32[] memory /* deliveryInfo */,
        bytes32[] memory /* finalizeInfo */
    ) internal override virtual view returns (bytes32[] memory extData) {
        extData = new bytes32[](2);
        extData[0] = priceInfo[0];
        extData[1] = priceInfo[1];
    }

}
