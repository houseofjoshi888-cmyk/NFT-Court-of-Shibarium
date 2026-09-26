# Email Notification System - Implementation Guide

## 🎯 Overview

The House of Joshi Marketplace now includes a comprehensive email notification system that alerts users when their NFTs are sold or when they receive offers. This implementation uses Resend for email delivery.

## 📧 What's Implemented

### 1. **User Profile Notification Settings**
- **Location**: `/profile` → "Notifications" tab
- **Features**:
  - Email address input
  - Enable/disable email notifications
  - Enable/disable sale notifications
  - Enable/disable offer notifications
  - Settings saved to localStorage (demo) and API ready for database

### 2. **Email API Endpoints**

#### **POST `/api/notifications/settings`**
- Save user notification preferences
- Currently uses localStorage (demo)
- Ready for database integration

#### **GET `/api/notifications/settings?wallet=0x...`**
- Retrieve user notification preferences
- Returns default settings if not configured

#### **POST `/api/notifications/send-sale`**
- Send sale notification email
- Includes: NFT name, price, buyer, transaction link
- Uses Resend API for delivery
- Royal black & gold email template

#### **POST `/api/notifications/send-offer`**
- Send offer notification email
- Includes: NFT name, offer amount, offerer, transaction link
- Uses Resend API for delivery
- Royal black & gold email template

#### **POST `/api/notifications/webhook`**
- Webhook endpoint for marketplace events
- Handles: `sold`, `offer_accepted`, `offer_received` events
- Automatically triggers appropriate notifications
- Fetches NFT metadata and sends emails

## 🚀 Setup Instructions

### 1. **Get Resend API Key**

1. Sign up at https://resend.com
2. Go to API Keys: https://resend.com/api-keys
3. Create a new API key
4. Copy the API key

### 2. **Add Environment Variable**

Add to your `.env.local` file:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
```

Or copy the example file:

```bash
cp .env.notification.example .env.local
# Then edit .env.local with your actual API key
```

### 3. **Verify Domain (Optional)**

For production use, verify your domain in Resend:
1. Go to Domains in Resend dashboard
2. Add your domain (e.g., thehouseofjoshi.com)
3. Add DNS records provided by Resend
4. Wait for verification

### 4. **Test the System**

1. Go to `/profile` in your marketplace
2. Click the "Notifications" tab
3. Enter your email address
4. Enable email notifications
5. Click "Save Notification Settings"
6. Test by triggering a sale or offer event

## 📧 Email Templates

### **Sale Notification Email**

**Subject**: 🎉 Your NFT was sold on House of Joshi Marketplace!

**Content**:
- NFT name and collection
- Sale price in native currency
- Buyer wallet address
- Transaction link to blockchain explorer
- Royal black & gold styling

### **Offer Notification Email**

**Subject**: 💎 New offer received on House of Joshi Marketplace!

**Content**:
- NFT name and collection
- Offer amount in native currency
- Offerer wallet address
- Transaction link to blockchain explorer
- Royal black & gold styling

## 🔧 Integration with V7 Contract

To connect the notification system to your V7 marketplace contracts:

### **Option 1: Webhook Integration**

Set up a webhook listener that calls `/api/notifications/webhook` when events occur:

```typescript
// Example event listener
marketplaceContract.on("ItemBought", async (buyer, nftAddress, tokenId, price, fee, royaltyRecipient, royaltyAmount) => {
  await fetch('/api/notifications/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chainId: await contract.chainId,
      contract: nftAddress,
      tokenId: tokenId.toString(),
      eventType: 'sold',
      seller: await getSellerFromListing(nftAddress, tokenId),
      buyer,
      price: price.toString(),
      transactionHash: tx.hash
    })
  });
});
```

### **Option 2: Direct API Call**

When a sale occurs in your frontend code:

```typescript
// After successful purchase
await fetch('/api/notifications/send-sale', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: sellerEmail,
    nftName: purchasedNft.name,
    collectionName: purchasedNft.collection,
    price: purchasePrice,
    currency: 'ETH',
    buyer: buyerAddress,
    transactionUrl: transactionLink
  })
});
```

## 🎨 Styling

The notification settings page includes:
- Royal black & gold color scheme
- Professional toggle switches
- Email input with validation
- Clear information about notification types
- Responsive design for mobile devices

## 📊 Current Status

**✅ Implemented**:
- User profile notification settings UI
- Email API endpoints (sale and offer)
- Webhook endpoint for marketplace events
- Royal black & gold email templates
- LocalStorage persistence (demo)
- CSS styling for notification settings

**⏳ Future Enhancements**:
- Database integration for settings storage
- Browser push notifications
- In-app notification center
- Notification history
- Unsubscribe links in emails
- Bounced email handling
- Notification preferences per collection

## 💰 Cost

**Resend Pricing**:
- Free tier: 3,000 emails/month
- Pro tier: $20/month for 50,000 emails
- Enterprise: Custom pricing

**Estimated Monthly Cost**:
- Small marketplace (100 sales/month): Free tier
- Medium marketplace (1,000 sales/month): Free tier
- Large marketplace (10,000 sales/month): $20/month

## 🔒 Security Notes

- Email addresses are stored in localStorage (demo) - should be encrypted in database
- API keys should never be committed to git
- Validate email format before storage
- Implement rate limiting on notification endpoints
- Add authentication to webhook endpoint in production

## 📞 Support

For issues with:
- **Resend API**: https://resend.com/docs
- **Notification system**: Check browser console for errors
- **Email delivery**: Check Resend dashboard logs

## 🎯 Next Steps

1. Add `RESEND_API_KEY` to your environment variables
2. Test the notification settings in your profile
3. Integrate webhook calls with V7 contract events
4. Verify email delivery in Resend dashboard
5. Consider database integration for production use

The email notification system is now ready to use!