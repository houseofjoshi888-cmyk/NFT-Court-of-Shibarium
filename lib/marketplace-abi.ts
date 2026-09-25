import { parseAbi, parseEther, maxUint256 } from "viem";

export const marketplaceAbi = parseAbi([
  "function marketplaceVersion() pure returns (uint256)",
  "function allowedPaymentTokens(address paymentToken) view returns (bool)",
  "function setAllowedPaymentToken(address paymentToken, bool allowed)",
  "function listTokenItem(address nftAddress, uint256 tokenId, address paymentToken, uint256 price)",
  "function cancelTokenItem(address nftAddress, uint256 tokenId)",
  "function buyTokenItem(address nftAddress, uint256 tokenId, address expectedPaymentToken, uint256 expectedPrice)",
  "function getTokenListing(address nftAddress, uint256 tokenId) view returns ((address seller, address paymentToken, uint256 price))",
  "event PaymentTokenAllowed(address indexed paymentToken, bool allowed)",
  "event TokenItemListed(address indexed nftAddress, uint256 indexed tokenId, address indexed paymentToken, address seller, uint256 price)",
  "event TokenItemCanceled(address indexed nftAddress, uint256 indexed tokenId, address indexed paymentToken, address seller)",
  "event TokenItemBought(address indexed nftAddress, uint256 indexed tokenId, address indexed paymentToken, address seller, address buyer, uint256 price, uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount)",
  "function listItem(address nftAddress, uint256 tokenId, uint256 price)",
  "function cancelListing(address nftAddress, uint256 tokenId)",
  "function updateListing(address nftAddress, uint256 tokenId, uint256 price)",
  "function listEdition(address nftAddress, uint256 tokenId, uint256 quantity, uint256 unitPrice)",
  "function cancelEdition(address nftAddress, uint256 tokenId)",
  "function buyEdition(address nftAddress, uint256 tokenId, address seller, uint256 quantity, uint256 expectedUnitPrice) payable",
  "function getEditionListing(address nftAddress, uint256 tokenId, address seller) view returns ((uint256 quantity, uint256 unitPrice))",
  "function makeEditionOffer(address nftAddress, uint256 tokenId, uint256 quantity, uint64 expiresAt) payable",
  "function cancelEditionOffer(address nftAddress, uint256 tokenId)",
  "function acceptEditionOffer(address nftAddress, uint256 tokenId, address buyer)",
  "function getEditionOffer(address nftAddress, uint256 tokenId, address buyer) view returns ((uint256 quantity, uint256 amount, uint64 expiresAt))",
  "event EditionListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 quantity, uint256 unitPrice)",
  "event EditionCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId)",
  "event EditionBought(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, address seller, uint256 quantity, uint256 unitPrice, uint256 remaining, uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount)",
  "event EditionOfferMade(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 quantity, uint256 amount, uint64 expiresAt)",
  "event EditionOfferCanceled(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 quantity, uint256 amount)",
  "event EditionOfferAccepted(address indexed seller, address indexed buyer, address indexed nftAddress, uint256 tokenId, uint256 quantity, uint256 amount, uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount)",
  "error InvalidQuantity()", "error UnsupportedToken()", "error PriceChanged()",
  "function buyItem(address nftAddress, uint256 tokenId) payable",
  "function batchBuy(address[] nftAddresses, uint256[] tokenIds) payable",
  "function makeOffer(address nftAddress, uint256 tokenId, uint64 expiresAt) payable",
  "function cancelOffer(address nftAddress, uint256 tokenId)",
  "function acceptOffer(address nftAddress, uint256 tokenId, address buyer)",
  "function withdrawProceeds()",
  "function getListing(address nftAddress, uint256 tokenId) view returns ((address seller, uint256 price))",
  "function getOffer(address nftAddress, uint256 tokenId, address buyer) view returns ((uint256 amount, uint64 expiresAt))",
  "function getProceeds(address recipient) view returns (uint256)",
  "error AlreadyListed()", "error NotListed()", "error NotOwner()", "error NotSeller()",
  "error MarketplaceNotApproved()", "error ListingNoLongerValid()", "error OfferExpired()",
  "error OfferNotFound()", "error NoProceeds()", "error IncorrectPayment(uint256 expected, uint256 received)",
  "event ItemListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 price)",
  "event ItemCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId)",
  "event ItemBought(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 price, uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount)",
  "event ProceedsWithdrawn(address indexed seller, uint256 amount)",
  "event OfferMade(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 amount, uint64 expiresAt)",
  "event OfferCanceled(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 amount)",
  "event OfferAccepted(address indexed seller, address indexed buyer, address indexed nftAddress, uint256 tokenId, uint256 amount, uint256 marketplaceFee, address royaltyRecipient, uint256 royaltyAmount)",
]);

export function parseNativeAmount(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(normalized)) throw new Error("Enter a positive amount with at most 18 decimal places.");
  const amount = parseEther(normalized);
  if (amount <= 0n || amount > maxUint256) throw new Error("Enter a positive amount within the supported range.");
  return amount;
}

export type IndexedOffer = {
  id: string; chainId: number; nftAddress: `0x${string}`; tokenId: string;
  buyer: `0x${string}`; amount: string; expiresAt: number;
  status: "active" | "canceled" | "accepted"; transactionHash: `0x${string}`;
  blockNumber: number; owner?: `0x${string}`;
  tokenType?: "ERC-1155"; quantity?: string;
};
