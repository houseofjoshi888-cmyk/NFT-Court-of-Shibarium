// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title House of Joshi Court Marketplace
/// @notice A non-custodial, fixed-price marketplace for ERC-721 assets settled in native BONE.
contract NFTMarketplace is ReentrancyGuard {
    struct Listing { address seller; uint256 price; }

    mapping(address nft => mapping(uint256 tokenId => Listing)) private s_listings;
    mapping(address seller => uint256 amount) private s_proceeds;

    error AlreadyListed();
    error NotListed();
    error NotOwner();
    error NotSeller();
    error PriceMustBeAboveZero();
    error MarketplaceNotApproved();
    error IncorrectPayment(uint256 expected, uint256 received);
    error ListingNoLongerValid();
    error NoProceeds();
    error TransferFailed();

    event ItemListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 price);
    event ItemCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId);
    event ItemBought(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 price);
    event ProceedsWithdrawn(address indexed seller, uint256 amount);

    function listItem(address nftAddress, uint256 tokenId, uint256 price) external {
        if (s_listings[nftAddress][tokenId].price != 0) revert AlreadyListed();
        if (price == 0) revert PriceMustBeAboveZero();
        IERC721 nft = IERC721(nftAddress);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(msg.sender, address(this))) {
            revert MarketplaceNotApproved();
        }
        s_listings[nftAddress][tokenId] = Listing(msg.sender, price);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function cancelListing(address nftAddress, uint256 tokenId) external {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price == 0) revert NotListed();
        if (listing.seller != msg.sender) revert NotSeller();
        delete s_listings[nftAddress][tokenId];
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    function buyItem(address nftAddress, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price == 0) revert NotListed();
        if (msg.value != listing.price) revert IncorrectPayment(listing.price, msg.value);

        IERC721 nft = IERC721(nftAddress);
        if (nft.ownerOf(tokenId) != listing.seller) revert ListingNoLongerValid();
        if (nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(listing.seller, address(this))) {
            revert ListingNoLongerValid();
        }

        delete s_listings[nftAddress][tokenId];
        s_proceeds[listing.seller] += msg.value;
        nft.safeTransferFrom(listing.seller, msg.sender, tokenId);
        emit ItemBought(msg.sender, nftAddress, tokenId, listing.price);
    }

    function withdrawProceeds() external nonReentrant {
        uint256 amount = s_proceeds[msg.sender];
        if (amount == 0) revert NoProceeds();
        s_proceeds[msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit ProceedsWithdrawn(msg.sender, amount);
    }

    function getListing(address nftAddress, uint256 tokenId) external view returns (Listing memory) {
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}
