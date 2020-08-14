// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@animoca/ethereum-contracts-erc20_base/contracts/token/ERC20/IERC20.sol";

/**
 * @title PayoutToken
 * Contract module that adds support for a payout token to sale contacts.
 */
contract PayoutToken is Ownable
{
    event PayoutTokenSet(IERC20 payoutToken);

    IERC20 public payoutToken;

    /**
     * Constructor.
     * @param payoutToken_ The ERC20 token to accept as the payment currency.
     */
    constructor(IERC20 payoutToken_) internal {
        _setPayoutToken(payoutToken_);
    }

    /**
     * Sets the ERC20 token to accept as the payment currency.
     * @dev Emits the PayoutTokenSet event.
     * @dev Reverts if called by any other than the contract owner.
     * @dev Reverts if the payout token is the same as the current value.
     * @param payoutToken_ The new ERC20 token to accept as the payment
     *  currency.
     */
    function setPayoutToken(
        IERC20 payoutToken_
    ) public virtual onlyOwner {
        require(payoutToken_ != payoutToken, "PayoutToken: duplicate assignment");
        _setPayoutToken(payoutToken_);
    }

    /**
     * Sets the ERC20 token to accept as the payment currency.
     * @dev Emits the PayoutTokenSet event.
     * @dev Reverts if called by any other than the contract owner.
     * @param payoutToken_ The new ERC20 token to accept as the payment
     *  currency.
     */
    function _setPayoutToken(
        IERC20 payoutToken_
    ) internal virtual {
        payoutToken = payoutToken_;
        emit PayoutTokenSet(payoutToken_);
    }

}
