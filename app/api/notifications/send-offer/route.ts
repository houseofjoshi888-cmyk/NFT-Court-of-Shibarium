export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, nftName, offerPrice, currency, offerer, transactionUrl, collectionName } = await request.json() as {
      email?: string;
      nftName?: string;
      offerPrice?: string;
      currency?: string;
      offerer?: string;
      transactionUrl?: string;
      collectionName?: string;
    };

    if (!email) {
      return Response.json({ error: "Email address is required." }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Invalid email format." }, { status: 400 });
    }

    // Check if Resend API key is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured. Email would be sent to:", email);
      console.log("Offer notification details:", { nftName, offerPrice, currency, offerer, transactionUrl, collectionName });
      
      return Response.json({
        success: true,
        message: "Email service not configured. Notification logged for debugging.",
        note: "Add RESEND_API_KEY to environment variables to enable email sending."
      });
    }

    // Send email using Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'House of Joshi Marketplace <marketplace@thehouseofjoshi.com>',
        to: email,
        subject: '💎 New offer received on House of Joshi Marketplace!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0A0A0A; color: #FFFFFF;">
            <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #D4AF37;">
              <h1 style="color: #D4AF37; margin: 0; font-size: 32px;">💎 New offer received!</h1>
              <p style="color: #888; margin: 20px 0;">House of Joshi Marketplace</p>
            </div>
            
            <div style="padding: 30px 0;">
              <div style="background: #1E1E1E; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h2 style="color: #D4AF37; margin-top: 0;">Offer Details</h2>
                
                <div style="margin: 15px 0;">
                  <span style="color: #888; display: block; margin-bottom: 5px;">NFT Name</span>
                  <strong style="font-size: 18px; color: #FFFFFF;">${nftName || 'NFT'}</strong>
                </div>
                
                ${collectionName ? `
                <div style="margin: 15px 0;">
                  <span style="color: #888; display: block; margin-bottom: 5px;">Collection</span>
                  <strong style="font-size: 18px; color: #FFFFFF;">${collectionName}</strong>
                </div>
                ` : ''}
                
                <div style="margin: 15px 0;">
                  <span style="color: #888; display: block; margin-bottom: 5px;">Offer Amount</span>
                  <strong style="font-size: 24px; color: #D4AF37;">${offerPrice} ${currency}</strong>
                </div>
                
                ${offerer ? `
                <div style="margin: 15px 0;">
                  <span style="color: #888; display: block; margin-bottom: 5px;">Offerer</span>
                  <code style="background: #121212; padding: 8px 12px; border-radius: 4px; color: #D4AF37;">${offerer.slice(0, 6)}…${offerer.slice(-4)}</code>
                </div>
                ` : ''}
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${transactionUrl}" style="display: inline-block; background: #D4AF37; color: #0A0A0A; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  View Offer
                </a>
              </div>
              
              <div style="border-top: 1px solid #333; padding-top: 20px; text-align: center;">
                <p style="color: #666; margin: 0; font-size: 14px;">
                  You received this email because you have email notifications enabled for offers on House of Joshi Marketplace.
                </p>
                <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">
                  <a href="https://thehouseofjoshi.com" style="color: #D4AF37; text-decoration: none;">House of Joshi Marketplace</a>
                </p>
              </div>
            </div>
          </div>
        `
      })
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error("Resend API error:", error);
      return Response.json({ error: "Failed to send email" }, { status: 500 });
    }

    const responseData = await resendResponse.json();
    return Response.json({
      success: true,
      message: "Offer notification sent successfully",
      data: responseData
    });

  } catch (error) {
    console.error("Failed to send offer notification:", error);
    return Response.json({ error: "Failed to send offer notification." }, { status: 500 });
  }
}