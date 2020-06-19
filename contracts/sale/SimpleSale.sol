// SPDX-License-Identifier: MIT

pragma solidity = 0.6.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";

abstract contract SimpleSale is Ownable, GSNRecipient {
    using SafeMath for uint256;

    enum ErrorCodes {
        RESTRICTED_METHOD,
        INSUFFICIENT_BALANCE
    }

    struct Price {
        uint256 ethPrice;
        uint256 erc20Price;
    }

    struct PurchaseForVars {
        address payable recipient;
        address payable operator;
        string purchaseId;
        address paymentToken;
        uint256 quantity;
        uint256 unitPrice;
        uint256 totalPrice;
        uint256 value;
        string extData;
    }

    event Purchased(
        address recipient,
        address operator,
        string purchaseId,
        address paymentToken,
        uint256 quantity,
        uint256 price,
        string extData
    );

    event PriceUpdated(
        string purchaseId,
        uint256 ethPrice,
        uint256 erc20Price
    );

    address public ETH_ADDRESS = address(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    address public erc20Token;
    address payable public payoutWallet;

    mapping(string => Price) public prices; //  purchaseId => price in tokens

    constructor(address payable payoutWallet_, address erc20Token_) public {
        setPayoutWallet(payoutWallet_);
        erc20Token = erc20Token_;
    }

    function setPayoutWallet(address payable payoutWallet_) public onlyOwner {
        require(payoutWallet_ != address(0));
        require(payoutWallet_ != address(this));
        payoutWallet = payoutWallet_;
    }

    function setErc20Token(address erc20Token_) public onlyOwner {
        erc20Token = erc20Token_;
    }

    function setPrice(string memory purchaseId, uint256 ethPrice, uint256 erc20TokenPrice) public onlyOwner {
        prices[purchaseId] = Price(ethPrice, erc20TokenPrice);
        emit PriceUpdated(purchaseId, ethPrice, erc20TokenPrice);
    }

    function purchaseFor(
        address recipient,
        string calldata purchaseId,
        address paymentToken,
        uint256 quantity,
        string calldata extData
    ) external payable {
        require(quantity > 0, "Quantity can't be 0");
        require(paymentToken == ETH_ADDRESS || paymentToken == erc20Token, "Unsupported payment token");

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
     * @dev Defines the purchase lifecycle sequence to execute when handling a purchase.
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
     * @dev Purchase lifecycle hook that handles the calculation of the total price.
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
            require(purchaseForVars.unitPrice != 0, "purchaseId not found");
        } else {
            require(erc20Token != address(0), "ERC20 payment not supported");
            purchaseForVars.unitPrice = prices[purchaseForVars.purchaseId].erc20Price;
            require(purchaseForVars.unitPrice != 0, "Price not found");
        }

        return purchaseForVars.unitPrice.mul(purchaseForVars.quantity);
    }

    /**
     * @dev Purchase lifecycle hook that handles the acceptance of payment.
     * @dev Any overpayments result in the change difference being returned to the recipient.
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
            require(purchaseForVars.value >= purchaseForVars.totalPrice, "Insufficient ETH");

            payoutWallet.transfer(purchaseForVars.totalPrice);

            uint256 change = purchaseForVars.value.sub(purchaseForVars.totalPrice);

            if (change > 0) {
                purchaseForVars.operator.transfer(change);
            }
        } else {
            require(ERC20(erc20Token).transferFrom(purchaseForVars.operator, payoutWallet, purchaseForVars.totalPrice));
        }
    }

    /**
     * @dev Purchase lifecycle hook that handles the delivery of the purchased item to the recipient.
     * @dev Overridable.
     * @param purchaseForVars PurchaseForVars structure of in-memory intermediate variables used in the purchaseFor() call
     */
    function _purchaseForDelivery(PurchaseForVars memory purchaseForVars) internal virtual;

    /**
     * @dev Purchase lifecycle hook that handles the notification of a purchase event.
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
