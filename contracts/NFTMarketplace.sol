// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title House of Joshi Court Marketplace
/// @notice A non-custodial, fixed-price ERC-721 marketplace settled in native BONE.
/// @dev A fixed 2% protocol fee is deducted from the listed price. Optional ERC-2981
/// royalties are credited separately. All recipients withdraw through pull payments.
contract NFTMarketplace is ReentrancyGuard {
    struct Listing { address seller; uint256 price; }

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MARKETPLACE_FEE_BPS = 200;
    /// @notice The immutable House of Joshi treasury receiving the 2% protocol fee.
    address public constant HOUSE_TREASURY = 0x6736d2eA9807297F0e56967361B9410854B86a5f;

    mapping(address nft => mapping(uint256 tokenId => Listing)) private s_listings;
    mapping(address recipient => uint256 amount) private s_proceeds;

    error AlreadyListed();
    error NotListed();
    error NotOwner();
    error NotSeller();
    error PriceMustBeAboveZero();
    error MarketplaceNotApproved();
    error IncorrectPayment(uint256 expected, uint256 received);
    error ListingNoLongerValid();
    error InvalidRoyalty(uint256 royaltyAmount, uint256 salePrice);
    error NoProceeds();
    error TransferFailed();

    event ItemListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 price);
    event ItemCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId);
    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price,
        uint256 marketplaceFee,
        address royaltyRecipient,
        uint256 royaltyAmount
    );
    event ProceedsWithdrawn(address indexed recipient, uint256 amount);
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

        uint256 marketplaceFee = marketplaceFeeFor(listing.price);
        (address royaltyRecipient, uint256 royaltyAmount) = _royaltyInfo(nftAddress, tokenId, listing.price);
        if (marketplaceFee + royaltyAmount > listing.price) revert InvalidRoyalty(royaltyAmount, listing.price);
        uint256 sellerAmount = listing.price - marketplaceFee - royaltyAmount;

        delete s_listings[nftAddress][tokenId];
        s_proceeds[listing.seller] += sellerAmount;
        s_proceeds[HOUSE_TREASURY] += marketplaceFee;
        if (royaltyAmount != 0) s_proceeds[royaltyRecipient] += royaltyAmount;

        nft.safeTransferFrom(listing.seller, msg.sender, tokenId);
        emit ItemBought(msg.sender, nftAddress, tokenId, listing.price, marketplaceFee, royaltyRecipient, royaltyAmount);
    }

    function withdrawProceeds() external nonReentrant {
        uint256 amount = s_proceeds[msg.sender];
        if (amount == 0) revert NoProceeds();
        s_proceeds[msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit ProceedsWithdrawn(msg.sender, amount);
    }

    function marketplaceFeeFor(uint256 salePrice) public pure returns (uint256) {
        return (salePrice * MARKETPLACE_FEE_BPS) / BPS_DENOMINATOR;
    }

    function getListing(address nftAddress, uint256 tokenId) external view returns (Listing memory) {
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address recipient) external view returns (uint256) {
        return s_proceeds[recipient];
    }

    function _royaltyInfo(address nftAddress, uint256 tokenId, uint256 salePrice)
        internal
        view
        returns (address recipient, uint256 amount)
    {
        try IERC165(nftAddress).supportsInterface(type(IERC2981).interfaceId) returns (bool supported) {
            if (!supported) return (address(0), 0);
        } catch {
            return (address(0), 0);
        }

        try IERC2981(nftAddress).royaltyInfo(tokenId, salePrice) returns (address receiver, uint256 royaltyAmount) {
            if (receiver == address(0) || royaltyAmount == 0) return (address(0), 0);
            return (receiver, royaltyAmount);
        } catch {
            return (address(0), 0);
        }
    }
}
