/** Short actionable messages; never expose raw RPC request bodies to the UI. */
export function transactionError(error: unknown): string {
  const text=error instanceof Error?error.message:String(error);
  if (/user rejected|user denied|rejected the request|4001/i.test(text)) return "Request canceled in your wallet. No new transaction was submitted.";
  if (/insufficient funds|exceeds.*balance/i.test(text)) return "Not enough native currency for the purchase and network gas fee.";
  if (/ListingNoLongerValid|NotListed|NFTNotListed/i.test(text)) return "This listing is no longer available. Refresh the NFT before continuing.";
  if (/PriceChanged|IncorrectPayment/i.test(text)) return "The listing price changed. Refresh and review the new price.";
  if (/MarketplaceNotApproved|InsufficientApproval/i.test(text)) return "The marketplace needs NFT approval from the owner before this trade can proceed.";
  if (/InvalidQuantity|InsufficientBalance/i.test(text)) return "That edition quantity is no longer available. Refresh and choose a smaller quantity.";
  if (/NotOwner|NotSeller/i.test(text)) return "Only the current owner or listing seller can perform this action.";
  if (/failed on chain|canceled or replaced|Wallet or network changed/.test(text)) return text.split("\n")[0];
  if (/timeout|timed out|fetch failed|HTTP request failed|429|503/i.test(text)) return "The network provider is unavailable. Try again shortly; check any submitted transaction first.";
  return text.split("\n")[0].slice(0,240)||"Transaction could not be completed.";
}
