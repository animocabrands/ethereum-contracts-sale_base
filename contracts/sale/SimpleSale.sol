// SPDX-License-Identifier: MIT

pragma solidity = 0.6.8;

import "@animoca/ethereum-contracts-core_library/contracts/payment/PayoutWallet.sol";
import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";

/**
 * @title SimpleSale
 */
abstract contract SimpleSale is Ownable, GSNRecipient, PayoutWallet {
    using SafeMath for uint256;

    // enum ErrorCodes {
    //     RESTRICTED_METHOD,
    //     INSUFFICIENT_BALANCE
    // }

    event Purchased(
        address recipient,
        address operator,
        string purchaseId,
        IERC20 paymentToken,
        uint256 quantity,
        uint256 price,
        string extData
    );

    event PriceUpdated(
        string purchaseId,
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

    /**
     * Used as a container to pass result values between the purchaseFor()
     * life-cycle hooks.
     */
    struct PurchaseForVars {
        address payable recipient;
        address payable operator;
        string purchaseId;
        IERC20 paymentToken;
        uint256 quantity;
        uint256 unitPrice;
        uint256 totalPrice;
        uint256 value;
        string extData;
    }

    // special address value to represent a payment in ETH
    IERC20 public ETH_ADDRESS = IERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    IERC20 public erc20Token;

    mapping(string /* purchaseId */ => Price) public prices;

    /**
     * Constructor.
     * @param payoutWallet_ The wallet address accepting purchase payments.
     * @param erc20Token_ ERC20 token to use as an alternate payment to ETH.
     */
    constructor(
        address payable payoutWallet_,
        IERC20 erc20Token_
    )
        PayoutWallet(payoutWallet_)
        public
    {
        erc20Token = erc20Token_;
    }

    /**
     * Sets the ERC20 token to use as an alternate purchase payment to ETH.
     * @dev Reverts if the given ERC20 token is already set.
     * @param erc20Token_ ERC20 token to use as an alternate payment to ETH.
     */
    function setErc20Token(IERC20 erc20Token_) public onlyOwner {
        require(erc20Token_ != erc20Token, "SimpleSale: ERC20 token is already set");
        erc20Token = erc20Token_;
    }

    /**
     * Sets the ETH/ERC20 price for the given purchase ID.
     * @dev Will emit the PriceUpdated event after calling the function successfully.
     * @param purchaseId The purchase ID whose price will be set.
     * @param ethPrice The ETH price to assign to the purchase ID.
     * @param erc20TokenPrice The ERC20 token price to assign to the purchase ID.
     */
    function setPrice(string memory purchaseId, uint256 ethPrice, uint256 erc20TokenPrice) public onlyOwner {
        prices[purchaseId] = Price(ethPrice, erc20TokenPrice);
        emit PriceUpdated(purchaseId, ethPrice, erc20TokenPrice);
    }

    /**
     * Performs a purchase of the given purchase ID.
     * @dev Will emit the Purchased event after calling the function successfully.
     * @dev Reverts if the recipient is the zero address.
     * @dev Reverts if the recipient is this contract.
     * @dev Reverts if the quantity to purchase is zero.
     * @dev Reverts if the payment token is neither the pre-defined ERC20 token, or the ETH token.
     * @param recipient The recipient of the purchase.
     * @param purchaseId The purchase ID being purchased.
     * @param paymentToken The method of payment (either the pre-defined ERC20 token, or the ETH token).
     * @param quantity The quantity of the given purchase ID being purchased.
     * @param extData User-defined custom data to pass through to the Purchased event.
     */
    function purchaseFor(
        address recipient,
        string calldata purchaseId,
        IERC20 paymentToken,
        uint256 quantity,
        string calldata extData
    ) external payable {
        require(recipient != address(0), "SimpleSale: Recipient cannot be the zero address");
        require(recipient != address(uint160(address(this))), "SimpleSale: Recipient cannot be the contract address");
        require(quantity > 0, "SimpleSale: Quantity cannot be zero");
        require((paymentToken == ETH_ADDRESS) || (paymentToken == erc20Token), "SimpleSale: Payment token is unsupported");

        PurchaseForVars memory purchaseForVars;
        purchaseForVars.recipient = address(uint160(recipient));
        purchaseForVars.operator = _msgSender();
        purchaseForVars.purchaseId = purchaseId;
        purchaseForVars.paymentToken = paymentToken;
        purchaseForVars.quantity = quantity;
        purchaseForVars.value = msg.value;
        purchaseForVars.extData = extData;

        _purchaseFor(purchaseForVars);
    }

    /////////////////////////////////////////// GSNRecipient implementation ///////////////////////////////////
    /**
     * @dev Ensures that only users with enough gas payment token balance can have transactions relayed through the GSN.
     */
    function acceptRelayedCall(
        address /*relay*/,
        address /*from*/,
        bytes calldata encodedFunction,
        uint256 /*transactionFee*/,
        uint256 /*gasPrice*/,
        uint256 /*gasLimit*/,
        uint256 /*nonce*/,
        bytes calldata /*approvalData*/,
        uint256 /*maxPossibleCharge*/
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
        address recipient;
        string memory purchaseId;
        uint256 quantity;
        address paymentToken;
        mem = encodedFunction;
        assembly {
            let dest := add(mem, 32)
            methodId := mload(dest)
            dest := add(dest, 4)
            recipient := mload(dest)
            dest := add(dest, 32)
            purchaseId := mload(dest)
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
     * @dev Withdraws the recipient's deposits in `RelayHub`.
     */
    function withdrawDeposits(uint256 amount, address payable payee) external onlyOwner {
        _withdrawDeposits(amount, payee);
    }

    /////////////////////////////////////////// internal hooks ///////////////////////////////////

    /**
     * Defines the purchase lifecycle sequence to execute when handling a purchase.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     */
    function _purchaseFor(
        PurchaseForVars memory purchaseForVars
    )
        internal
        virtual
    {
        purchaseForVars.totalPrice = _purchaseForPricing(purchaseForVars);
        _purchaseForPayment(purchaseForVars);
        _purchaseForDelivery(purchaseForVars);
        _purchaseForNotify(purchaseForVars);
    }

    /**
     * Purchase lifecycle hook that handles the calculation of the total price.
     * @dev Reverts if an ERC20 payment is being made but the contract is configured to not support ERC20 payments.
     * @dev Reverts if no price is associated with the purchase ID being purchased.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     * @return totalPrice Total price.
     */
    function _purchaseForPricing(
        PurchaseForVars memory purchaseForVars
    )
        internal
        virtual
        returns
    (
        uint256 totalPrice
    )
    {
        if (purchaseForVars.paymentToken == ETH_ADDRESS) {
            purchaseForVars.unitPrice = prices[purchaseForVars.purchaseId].ethPrice;
        } else {
            require(erc20Token != IERC20(0), "SimpleSale: ERC20 payment is unsupported");
            purchaseForVars.unitPrice = prices[purchaseForVars.purchaseId].erc20Price;
        }

        require(purchaseForVars.unitPrice != 0, "SimpleSale: Invalid purchase ID");

        return purchaseForVars.unitPrice.mul(purchaseForVars.quantity);
    }

    /**
     * Purchase lifecycle hook that handles the acceptance of payment.
     * @dev Any overpayments result in the change difference being returned to the recipient.
     * @dev Reverts if there is insufficient ETH provided for an ETH payment.
     * @dev Reverts if there was a failure in transfering ERC20 tokens for an ERC20 token payment.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     */
    function _purchaseForPayment(
        PurchaseForVars memory purchaseForVars
    )
        internal
        virtual
    {
        if (purchaseForVars.paymentToken == ETH_ADDRESS) {
            require(purchaseForVars.value >= purchaseForVars.totalPrice, "SimpleSale: Insufficient ETH provided");

            payoutWallet.transfer(purchaseForVars.totalPrice);

            uint256 change = purchaseForVars.value.sub(purchaseForVars.totalPrice);

            if (change > 0) {
                purchaseForVars.operator.transfer(change);
            }
        } else {
            require(erc20Token.transferFrom(purchaseForVars.operator, payoutWallet, purchaseForVars.totalPrice), "SimpleSale: Failure in transferring ERC20 payment");
        }
    }

    /**
     * Purchase lifecycle hook that handles the delivery of the purchased item to the recipient.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     */
    function _purchaseForDelivery(PurchaseForVars memory purchaseForVars) internal virtual;

    /**
     * Purchase lifecycle hook that handles the notification of a purchase event.
     * @dev This function MUST emit the Purchased event after calling the function successfully.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     */
    function _purchaseForNotify(
        PurchaseForVars memory purchaseForVars
    )
        internal
        virtual
    {
        emit Purchased(
            purchaseForVars.recipient,
            purchaseForVars.operator,
            purchaseForVars.purchaseId,
            purchaseForVars.paymentToken,
            purchaseForVars.quantity,
            purchaseForVars.unitPrice,
            purchaseForVars.extData);
    }
}
