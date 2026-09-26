// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HOJNFTMarketplace} from "./NFTMarketplaceV5.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title HOJ NFT Marketplace V6
/// @notice Adds fixed-price ERC-721 sales in treasury-approved ERC-20 tokens.
/// @dev Existing native-currency listings, offers, and ERC-1155 editions remain unchanged.
/// Deploy separately on each chain; only the treasury can approve local WETH/USDC contracts.
contract HOJNFTMarketplaceV6 is HOJNFTMarketplace {
    using SafeERC20 for IERC20;

    struct TokenListing { address seller; address paymentToken; uint256 price; }
    mapping(address => bool) public allowedPaymentTokens;
    mapping(address => mapping(uint256 => TokenListing)) private tokenListings;

    error UnauthorizedPaymentAdmin();
    error PaymentTokenNotAllowed();
    error InvalidPaymentToken();
    error PaymentAmountMismatch();

    event PaymentTokenAllowed(address indexed paymentToken, bool allowed);
    event TokenItemListed(address indexed nftAddress, uint256 indexed tokenId, address indexed paymentToken, address seller, uint256 price);
    event TokenItemCanceled(address indexed nftAddress, uint256 indexed tokenId, address indexed paymentToken, address seller);
    event TokenItemBought(address indexed nftAddress, uint256 indexed tokenId, address indexed paymentToken, address seller, address buyer, uint256 price, uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount);

    constructor(address treasury) HOJNFTMarketplace(treasury) {}

    function marketplaceVersion() external pure virtual override returns (uint256) { return 6; }

    function setAllowedPaymentToken(address paymentToken, bool allowed) external {
        if (msg.sender != HOUSE_TREASURY) revert UnauthorizedPaymentAdmin();
        if (paymentToken == address(0) || paymentToken.code.length == 0) revert InvalidPaymentToken();
        allowedPaymentTokens[paymentToken] = allowed;
        emit PaymentTokenAllowed(paymentToken, allowed);
    }

    function listTokenItem(address nftAddress, uint256 tokenId, address paymentToken, uint256 price) external {
        if (!allowedPaymentTokens[paymentToken]) revert PaymentTokenNotAllowed();
        if (price == 0) revert PriceMustBeAboveZero();
        IERC721 nft = IERC721(nftAddress);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(msg.sender, address(this))) revert MarketplaceNotApproved();

        TokenListing memory previous = tokenListings[nftAddress][tokenId];
        if (previous.price != 0) emit TokenItemCanceled(nftAddress, tokenId, previous.paymentToken, previous.seller);
        tokenListings[nftAddress][tokenId] = TokenListing(msg.sender, paymentToken, price);
        emit TokenItemListed(nftAddress, tokenId, paymentToken, msg.sender, price);
    }

    function cancelTokenItem(address nftAddress, uint256 tokenId) external {
        TokenListing memory listing = tokenListings[nftAddress][tokenId];
        if (listing.price == 0) revert NotListed();
        if (listing.seller != msg.sender) revert NotSeller();
        delete tokenListings[nftAddress][tokenId];
        emit TokenItemCanceled(nftAddress, tokenId, listing.paymentToken, msg.sender);
    }

    function buyTokenItem(address nftAddress, uint256 tokenId, address expectedPaymentToken, uint256 expectedPrice) external nonReentrant {
        TokenListing memory listing = tokenListings[nftAddress][tokenId];
        if (listing.price == 0) revert NotListed();
        if (listing.paymentToken != expectedPaymentToken || listing.price != expectedPrice) revert PriceChanged();
        if (!allowedPaymentTokens[listing.paymentToken]) revert PaymentTokenNotAllowed();
        IERC721 nft = IERC721(nftAddress);
        if (nft.ownerOf(tokenId) != listing.seller) revert ListingNoLongerValid();
        if (nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(listing.seller, address(this))) revert ListingNoLongerValid();

        uint256 fee = marketplaceFeeFor(listing.price);
        (address royaltyRecipient, uint256 royaltyAmount) = _royaltyInfo(nftAddress, tokenId, listing.price);
        if (fee + royaltyAmount > listing.price) revert InvalidRoyalty(royaltyAmount, listing.price);
        IERC20 payment = IERC20(listing.paymentToken);
        uint256 beforeBalance = payment.balanceOf(address(this));
        payment.safeTransferFrom(msg.sender, address(this), listing.price);
        if (payment.balanceOf(address(this)) - beforeBalance != listing.price) revert PaymentAmountMismatch();

        delete tokenListings[nftAddress][tokenId];
        payment.safeTransfer(listing.seller, listing.price - fee - royaltyAmount);
        payment.safeTransfer(HOUSE_TREASURY, fee);
        if (royaltyAmount != 0) payment.safeTransfer(royaltyRecipient, royaltyAmount);
        nft.safeTransferFrom(listing.seller, msg.sender, tokenId);
        emit TokenItemBought(nftAddress, tokenId, listing.paymentToken, listing.seller, msg.sender, listing.price, fee, royaltyRecipient, royaltyAmount);
    }

    function getTokenListing(address nftAddress, uint256 tokenId) external view returns (TokenListing memory) {
        return tokenListings[nftAddress][tokenId];
    }
}
