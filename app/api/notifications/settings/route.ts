import { getAddress } from "viem";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { walletAddress, email, emailEnabled, salesEnabled, offersEnabled } = await request.json() as {
      walletAddress?: string;
      email?: string;
      emailEnabled?: boolean;
      salesEnabled?: boolean;
      offersEnabled?: boolean;
    };

    if (!walletAddress) {
      return Response.json({ error: "Wallet address is required." }, { status: 400 });
    }

    // Validate email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Invalid email format." }, { status: 400 });
    }

    const validAddress = getAddress(walletAddress);

    const settings = {
      email: email || "",
      emailEnabled: Boolean(emailEnabled),
      salesEnabled: Boolean(salesEnabled),
      offersEnabled: Boolean(offersEnabled),
      updatedAt: new Date().toISOString()
    };

    // In production, save to database
    // For now, we just return success since client handles localStorage
    return Response.json({
      success: true,
      message: "Notification settings saved successfully",
      settings
    });
  } catch (error) {
    console.error("Failed to save notification settings:", error);
    return Response.json({ error: "Failed to save notification settings." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return Response.json({ error: "Wallet address is required." }, { status: 400 });
    }

    const validAddress = getAddress(walletAddress);

    // In production, fetch from database
    // For now, return default settings
    const settings = {
      email: "",
      emailEnabled: false,
      salesEnabled: true,
      offersEnabled: true,
      updatedAt: null
    };

    return Response.json(settings);
  } catch (error) {
    console.error("Failed to retrieve notification settings:", error);
    return Response.json({ error: "Failed to retrieve notification settings." }, { status: 500 });
  }
}