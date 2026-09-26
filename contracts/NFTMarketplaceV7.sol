// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HOJNFTMarketplaceV6} from "./NFTMarketplaceV6.sol";

/// @title HOJ NFT Marketplace V7
/// @notice Pays native-currency sale recipients immediately where possible.
/// @dev A failed direct payment is credited to the same recipient's withdrawable
/// balance instead. Existing deployments are immutable and do not gain this behavior.
contract HOJNFTMarketplaceV7 is HOJNFTMarketplaceV6 {
    event DirectPayment(address indexed recipient, uint256 amount);
    event PaymentDeferred(address indexed recipient, uint256 amount);

    constructor(address treasury) HOJNFTMarketplaceV6(treasury) {}

    function marketplaceVersion() external pure override returns (uint256) { return 7; }

    function _creditSale(address nftAddress, uint256 tokenId, address seller, uint256 salePrice)
        internal
        override
        returns (uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount)
    {
        marketplaceFee = marketplaceFeeFor(salePrice);
        (royaltyRecipient, royaltyAmount) = _royaltyInfo(nftAddress, tokenId, salePrice);
        if (marketplaceFee + royaltyAmount > salePrice) revert InvalidRoyalty(royaltyAmount, salePrice);

        _payOrCredit(seller, salePrice - marketplaceFee - royaltyAmount);
        _payOrCredit(HOUSE_TREASURY, marketplaceFee);
        if (royaltyAmount != 0) _payOrCredit(royaltyRecipient, royaltyAmount);
    }

    function _payOrCredit(address recipient, uint256 amount) private {
        if (amount == 0) return;
        // A bounded call keeps a recipient from consuming the buyer's entire
        // transaction gas. A wallet requiring more gas can claim via withdrawProceeds.
        (bool paid,) = payable(recipient).call{value: amount, gas: 30_000}("");
        if (paid) emit DirectPayment(recipient, amount);
        else {
            s_proceeds[recipient] += amount;
            emit PaymentDeferred(recipient, amount);
        }
    }
}
