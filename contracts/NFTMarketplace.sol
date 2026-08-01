// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title House of Joshi Court Marketplace
/// @notice A non-custodial, fixed-price ERC-721 marketplace settled in the chain's native currency.
/// @dev A fixed 2% protocol fee is deducted from the listed price. Optional ERC-2981
/// royalties are credited separately. All recipients withdraw through pull payments.
contract NFTMarketplace is ReentrancyGuard {
    struct Listing { address seller; uint256 price; }
    struct Offer { uint256 amount; uint64 expiresAt; }

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MARKETPLACE_FEE_BPS = 200;
    /// @notice The immutable House of Joshi treasury receiving the 2% protocol fee.
    address public constant HOUSE_TREASURY = 0x6736d2eA9807297F0e56967361B9410854B86a5f;

    mapping(address nft => mapping(uint256 tokenId => Listing)) private s_listings;
    mapping(address nft => mapping(uint256 tokenId => mapping(address buyer => Offer))) private s_offers;
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
    error ArrayLengthMismatch();
    error OfferExpired();
    error OfferNotFound();
    error InvalidExpiration();

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
    event OfferMade(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 amount, uint64 expiresAt);
    event OfferCanceled(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 amount);
    event OfferAccepted(address indexed seller, address indexed buyer, address indexed nftAddress, uint256 tokenId, uint256 amount, uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount);

    function marketplaceVersion() external pure returns (uint256) { return 2; }
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

        _settleListing(nftAddress, tokenId, listing, msg.sender);
    }

    function batchBuy(address[] calldata nftAddresses, uint256[] calldata tokenIds) external payable nonReentrant {
        uint256 length = nftAddresses.length;
        if (length == 0 || length != tokenIds.length) revert ArrayLengthMismatch();
        uint256 total;
        for (uint256 i; i < length; ++i) {
            Listing memory listing = s_listings[nftAddresses[i]][tokenIds[i]];
            if (listing.price == 0) revert NotListed();
            total += listing.price;
        }
        if (msg.value != total) revert IncorrectPayment(total, msg.value);
        for (uint256 i; i < length; ++i) {
            Listing memory listing = s_listings[nftAddresses[i]][tokenIds[i]];
            _settleListing(nftAddresses[i], tokenIds[i], listing, msg.sender);
        }
    }

    function makeOffer(address nftAddress, uint256 tokenId, uint64 expiresAt) external payable nonReentrant {
        if (msg.value == 0) revert PriceMustBeAboveZero();
        if (expiresAt <= block.timestamp) revert InvalidExpiration();
        Offer memory previous = s_offers[nftAddress][tokenId][msg.sender];
        if (previous.amount != 0) s_proceeds[msg.sender] += previous.amount;
        s_offers[nftAddress][tokenId][msg.sender] = Offer(msg.value, expiresAt);
        emit OfferMade(msg.sender, nftAddress, tokenId, msg.value, expiresAt);
    }

    function cancelOffer(address nftAddress, uint256 tokenId) external nonReentrant {
        Offer memory offer = s_offers[nftAddress][tokenId][msg.sender];
        if (offer.amount == 0) revert OfferNotFound();
        delete s_offers[nftAddress][tokenId][msg.sender];
        s_proceeds[msg.sender] += offer.amount;
        emit OfferCanceled(msg.sender, nftAddress, tokenId, offer.amount);
    }

    function acceptOffer(address nftAddress, uint256 tokenId, address buyer) external nonReentrant {
        Offer memory offer = s_offers[nftAddress][tokenId][buyer];
        if (offer.amount == 0) revert OfferNotFound();
        if (offer.expiresAt < block.timestamp) revert OfferExpired();
        IERC721 nft = IERC721(nftAddress);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(msg.sender, address(this))) revert MarketplaceNotApproved();
        delete s_offers[nftAddress][tokenId][buyer];
        delete s_listings[nftAddress][tokenId];
        (uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount) = _creditSale(nftAddress, tokenId, msg.sender, offer.amount);
        nft.safeTransferFrom(msg.sender, buyer, tokenId);
        emit OfferAccepted(msg.sender, buyer, nftAddress, tokenId, offer.amount, marketplaceFee, royaltyRecipient, royaltyAmount);
    }

    function _settleListing(address nftAddress, uint256 tokenId, Listing memory listing, address buyer) internal {

        IERC721 nft = IERC721(nftAddress);
        if (nft.ownerOf(tokenId) != listing.seller) revert ListingNoLongerValid();
        if (nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(listing.seller, address(this))) {
            revert ListingNoLongerValid();
        }

        delete s_listings[nftAddress][tokenId];
        (uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount) = _creditSale(nftAddress, tokenId, listing.seller, listing.price);
        nft.safeTransferFrom(listing.seller, buyer, tokenId);
        emit ItemBought(buyer, nftAddress, tokenId, listing.price, marketplaceFee, royaltyRecipient, royaltyAmount);
    }

    function _creditSale(address nftAddress, uint256 tokenId, address seller, uint256 salePrice) internal returns (uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount) {
        marketplaceFee = marketplaceFeeFor(salePrice);
        (royaltyRecipient, royaltyAmount) = _royaltyInfo(nftAddress, tokenId, salePrice);
        if (marketplaceFee + royaltyAmount > salePrice) revert InvalidRoyalty(royaltyAmount, salePrice);
        s_proceeds[seller] += salePrice - marketplaceFee - royaltyAmount;
        s_proceeds[HOUSE_TREASURY] += marketplaceFee;
        if (royaltyAmount != 0) s_proceeds[royaltyRecipient] += royaltyAmount;
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

    function getOffer(address nftAddress, uint256 tokenId, address buyer) external view returns (Offer memory) {
        return s_offers[nftAddress][tokenId][buyer];
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
