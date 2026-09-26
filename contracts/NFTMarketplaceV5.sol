// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {NFTMarketplaceV4} from "./NFTMarketplaceV4.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title HOJ NFT Marketplace
/// @notice Native-currency ERC-721 and ERC-1155 listings, sales, and funded offers.
/// @dev Deploy this contract separately on every EVM network the app supports.
/// ERC-1155 offers are for a fixed quantity and a total escrowed amount.
contract HOJNFTMarketplace is NFTMarketplaceV4 {
    constructor(address treasury) NFTMarketplaceV4(treasury) {}
    struct EditionOffer { uint256 quantity; uint256 amount; uint64 expiresAt; }
    mapping(address => mapping(uint256 => mapping(address => EditionOffer))) private editionOffers;

    event EditionOfferMade(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 quantity, uint256 amount, uint64 expiresAt);
    event EditionOfferCanceled(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 quantity, uint256 amount);
    event EditionOfferAccepted(address indexed seller, address indexed buyer, address indexed nftAddress, uint256 tokenId, uint256 quantity, uint256 amount, uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount);

    function marketplaceVersion() external pure virtual override returns (uint256) { return 5; }

    function makeEditionOffer(address nftAddress, uint256 tokenId, uint256 quantity, uint64 expiresAt) external payable nonReentrant {
        if (!IERC165(nftAddress).supportsInterface(type(IERC1155).interfaceId)) revert UnsupportedToken();
        if (quantity == 0) revert InvalidQuantity();
        if (msg.value == 0) revert PriceMustBeAboveZero();
        if (expiresAt <= block.timestamp) revert InvalidExpiration();
        EditionOffer memory previous = editionOffers[nftAddress][tokenId][msg.sender];
        if (previous.amount != 0) s_proceeds[msg.sender] += previous.amount;
        editionOffers[nftAddress][tokenId][msg.sender] = EditionOffer(quantity, msg.value, expiresAt);
        emit EditionOfferMade(msg.sender, nftAddress, tokenId, quantity, msg.value, expiresAt);
    }

    function cancelEditionOffer(address nftAddress, uint256 tokenId) external nonReentrant {
        EditionOffer memory offer = editionOffers[nftAddress][tokenId][msg.sender];
        if (offer.amount == 0) revert OfferNotFound();
        delete editionOffers[nftAddress][tokenId][msg.sender];
        s_proceeds[msg.sender] += offer.amount;
        emit EditionOfferCanceled(msg.sender, nftAddress, tokenId, offer.quantity, offer.amount);
    }

    function acceptEditionOffer(address nftAddress, uint256 tokenId, address buyer) external nonReentrant {
        EditionOffer memory offer = editionOffers[nftAddress][tokenId][buyer];
        if (offer.amount == 0) revert OfferNotFound();
        if (offer.expiresAt <= block.timestamp) revert OfferExpired();
        IERC1155 nft = IERC1155(nftAddress);
        uint256 held = nft.balanceOf(msg.sender, tokenId);
        if (held < offer.quantity) revert InvalidQuantity();
        if (!nft.isApprovedForAll(msg.sender, address(this))) revert MarketplaceNotApproved();

        delete editionOffers[nftAddress][tokenId][buyer];
        EditionListing storage listing = editions[nftAddress][tokenId][msg.sender];
        uint256 remainingHeld = held - offer.quantity;
        if (listing.quantity > remainingHeld) {
            if (remainingHeld == 0) {
                delete editions[nftAddress][tokenId][msg.sender];
                emit EditionCanceled(msg.sender, nftAddress, tokenId);
            } else {
                listing.quantity = remainingHeld;
                emit EditionListed(msg.sender, nftAddress, tokenId, remainingHeld, listing.unitPrice);
            }
        }

        (uint256 fee, address recipient, uint256 royalty) = _creditSale(nftAddress, tokenId, msg.sender, offer.amount);
        nft.safeTransferFrom(msg.sender, buyer, tokenId, offer.quantity, "");
        emit EditionOfferAccepted(msg.sender, buyer, nftAddress, tokenId, offer.quantity, offer.amount, fee, recipient, royalty);
    }

    function getEditionOffer(address nftAddress, uint256 tokenId, address buyer) external view returns (EditionOffer memory) {
        return editionOffers[nftAddress][tokenId][buyer];
    }
}
