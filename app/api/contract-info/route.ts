import { getAddress } from "viem";
import { getMarketplaceChain, isMarketplaceChainId, type MarketplaceChainId } from "@/lib/marketplace-chains";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const chainId = Number(query.get("chainId"));
  const contract = query.get("contract");

  if (!contract) {
    return Response.json({ error: "Contract address is required." }, { status: 400 });
  }

  if (!isMarketplaceChainId(chainId)) {
    return Response.json({ error: "Unsupported chain." }, { status: 400 });
  }

  try {
    const contractAddress = getAddress(contract);
    const chain = getMarketplaceChain(chainId as MarketplaceChainId);

    // Try to fetch contract info from the explorer
    const response = await fetch(`${chain.explorerApiUrl}/tokens/${contractAddress}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const data = await response.json() as {
        name?: string;
        symbol?: string;
        total_supply?: string;
        decimals?: number;
        type?: string;
      };
      return Response.json({
        address: contractAddress,
        name: data.name || null,
        symbol: data.symbol || null,
        totalSupply: data.total_supply || null,
        decimals: data.decimals || null,
        type: data.type || null,
        explorerUrl: `${chain.explorerUrl}/token/${contractAddress}`,
      });
    }

    // Fallback to basic contract info
    return Response.json({
      address: contractAddress,
      name: null,
      symbol: null,
      totalSupply: null,
      decimals: null,
      type: "ERC-721",
      explorerUrl: `${chain.explorerUrl}/token/${contractAddress}`,
    });
  } catch (error) {
    return Response.json({ error: "Failed to fetch contract information." }, { status: 500 });
  }
}