import { getAddress } from "viem";
import { getMarketplaceChain, isMarketplaceChainId, type MarketplaceChainId } from "@/lib/marketplace-chains";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { 
      chainId, 
      contract, 
      tokenId, 
      eventType, 
      seller, 
      buyer, 
      price, 
      transactionHash 
    } = await request.json();

    // Validate required fields
    if (!chainId || !contract || !tokenId || !eventType) {
      return Response.json({ error: "Missing required fields: chainId, contract, tokenId, eventType" }, { status: 400 });
    }

    if (!isMarketplaceChainId(Number(chainId))) {
      return Response.json({ error: "Unsupported chain" }, { status: 400 });
    }

    const validContract = getAddress(contract);
    const chain = getMarketplaceChain(Number(chainId) as MarketplaceChainId);

    // Handle different event types
    if (eventType === "sold" || eventType === "offer_accepted") {
      // Get seller's notification settings
      const sellerSettings = await getNotificationSettings(seller);
      
      if (sellerSettings.emailEnabled && sellerSettings.email && sellerSettings.salesEnabled) {
        // Get NFT metadata
        const nftData = await getNftMetadata(validContract, tokenId, Number(chainId));
        
        // Send sale notification
        await fetch('/api/notifications/send-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: sellerSettings.email,
            nftName: nftData?.name || `Token #${tokenId}`,
            collectionName: nftData?.collection || null,
            price: price || "0",
            currency: chain.currency,
            buyer: buyer || null,
            transactionUrl: `${chain.explorerUrl}/tx/${transactionHash}`
          })
        });
      }
    }

    if (eventType === "offer_received" && seller) {
      const sellerSettings = await getNotificationSettings(seller);
      
      if (sellerSettings.emailEnabled && sellerSettings.email && sellerSettings.offersEnabled) {
        const nftData = await getNftMetadata(validContract, tokenId, Number(chainId));
        
        await fetch('/api/notifications/send-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: sellerSettings.email,
            nftName: nftData?.name || `Token #${tokenId}`,
            collectionName: nftData?.collection || null,
            offerPrice: price || "0",
            currency: chain.currency,
            offerer: buyer || null,
            transactionUrl: `${chain.explorerUrl}/tx/${transactionHash}`
          })
        });
      }
    }

    return Response.json({ success: true, message: "Webhook processed successfully" });

  } catch (error) {
    console.error("Failed to process webhook:", error);
    return Response.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

async function getNotificationSettings(walletAddress: string) {
  try {
    const response = await fetch(`/api/notifications/settings?wallet=${walletAddress}`);
    if (response.ok) {
      return await response.json();
    }
    return { email: "", emailEnabled: false, salesEnabled: true, offersEnabled: true };
  } catch {
    return { email: "", emailEnabled: false, salesEnabled: true, offersEnabled: true };
  }
}

async function getNftMetadata(contract: string, tokenId: string, chainId: number) {
  try {
    const response = await fetch(`/api/nft?contract=${contract}&tokenId=${tokenId}&chainId=${chainId}`, { cache: "no-store" });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}