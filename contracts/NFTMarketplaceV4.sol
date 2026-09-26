// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {NFTMarketplace} from "./NFTMarketplace.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @notice Adds seller-specific edition listings. Prices are per unit, in the
/// native currency. Existing ERC-721 calls and pull-payment proceeds are retained.
contract NFTMarketplaceV4 is NFTMarketplace {
    constructor(address treasury) NFTMarketplace(treasury) {}
    struct EditionListing { uint256 quantity; uint256 unitPrice; }
    mapping(address => mapping(uint256 => mapping(address => EditionListing))) internal editions;
    error InvalidQuantity();
    error UnsupportedToken();
    error PriceChanged();
    event EditionListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 quantity, uint256 unitPrice);
    event EditionCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId);
    event EditionBought(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, address seller, uint256 quantity, uint256 unitPrice, uint256 remaining, uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount);

    function marketplaceVersion() external pure virtual override returns (uint256) { return 4; }

    /// @dev Also updates the seller's existing listing atomically.
    function listEdition(address nftAddress, uint256 tokenId, uint256 quantity, uint256 unitPrice) external {
        if (!IERC165(nftAddress).supportsInterface(type(IERC1155).interfaceId)) revert UnsupportedToken();
        if (quantity == 0 || IERC1155(nftAddress).balanceOf(msg.sender, tokenId) < quantity) revert InvalidQuantity();
        if (unitPrice == 0) revert PriceMustBeAboveZero();
        if (!IERC1155(nftAddress).isApprovedForAll(msg.sender, address(this))) revert MarketplaceNotApproved();
        editions[nftAddress][tokenId][msg.sender] = EditionListing(quantity, unitPrice);
        emit EditionListed(msg.sender, nftAddress, tokenId, quantity, unitPrice);
    }

    function cancelEdition(address nftAddress, uint256 tokenId) external {
        if (editions[nftAddress][tokenId][msg.sender].quantity == 0) revert NotListed();
        delete editions[nftAddress][tokenId][msg.sender];
        emit EditionCanceled(msg.sender, nftAddress, tokenId);
    }

    function buyEdition(address nftAddress, uint256 tokenId, address seller, uint256 quantity, uint256 expectedUnitPrice) external payable nonReentrant {
        EditionListing storage listing = editions[nftAddress][tokenId][seller];
        if (listing.quantity == 0) revert NotListed();
        if (quantity == 0 || quantity > listing.quantity) revert InvalidQuantity();
        if (listing.unitPrice != expectedUnitPrice) revert PriceChanged();
        uint256 total = quantity * listing.unitPrice;
        if (msg.value != total) revert IncorrectPayment(total, msg.value);
        if (IERC1155(nftAddress).balanceOf(seller, tokenId) < quantity || !IERC1155(nftAddress).isApprovedForAll(seller, address(this))) revert ListingNoLongerValid();
        uint256 unitPrice = listing.unitPrice;
        listing.quantity -= quantity;
        uint256 remaining = listing.quantity;
        if (remaining == 0) delete editions[nftAddress][tokenId][seller];
        (uint256 fee, address recipient, uint256 royalty) = _creditSale(nftAddress, tokenId, seller, total);
        IERC1155(nftAddress).safeTransferFrom(seller, msg.sender, tokenId, quantity, "");
        emit EditionBought(msg.sender, nftAddress, tokenId, seller, quantity, unitPrice, remaining, fee, recipient, royalty);
    }

    function getEditionListing(address nftAddress, uint256 tokenId, address seller) external view returns (EditionListing memory) {
        return editions[nftAddress][tokenId][seller];
    }
}
