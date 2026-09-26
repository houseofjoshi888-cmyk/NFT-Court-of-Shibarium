# In-App Notification System - Usage Guide

## 🎯 Overview

The House of Joshi Marketplace now includes a comprehensive in-app notification system that shows notifications in the header notification icon and provides a dedicated notifications page.

## ✨ Features

### **Header Notification Icon**
- Located in the top navigation bar
- Shows notification count badge
- Dropdown with recent notifications (up to 5)
- Click to mark individual notifications as read
- "Mark all as read" button
- "View all notifications" link to full page

### **Notifications Page** (`/notifications`)
- Full list of all notifications
- Filter by "All" or "Unread"
- Mark individual notifications as read
- Mark all as read
- Clear all notifications
- Different icons for notification types
- Timestamps for each notification

### **Notification Types**
- **WELCOME**: Welcome message when wallet connects
- **SALE**: NFT sold notification
- **OFFER**: New offer received
- **OFFER_ACCEPTED**: Offer accepted
- **PURCHASE**: NFT purchased
- **LISTED**: NFT listed
- **CANCELED**: Listing canceled
- **FAVORITE**: Added to favorites

## 🚀 How to Use

### **Basic Notification**

```typescript
import { addNotification } from "@/lib/notifications";

// Add a custom notification
addNotification(walletAddress, "CUSTOM", "Your custom message here");
```

### **Marketplace-Specific Notifications**

```typescript
import { 
  notifyNFTListed,
  notifyNFTSold,
  notifyOfferReceived,
  notifyOfferAccepted,
  notifyNFTPurchased,
  notifyListingCanceled,
  notifyFavoriteAdded
} from "@/lib/notifications";

// When user lists an NFT
notifyNFTListed(walletAddress, "Cool Cats #1234", "0.5", "ETH");

// When NFT is sold
notifyNFTSold(walletAddress, "Cool Cats #1234", "0.5", "ETH");

// When offer is received
notifyOfferReceived(walletAddress, "Cool Cats #1234", "0.3", "ETH");

// When offer is accepted
notifyOfferAccepted(walletAddress, "Cool Cats #1234", "0.3", "ETH");

// When user purchases NFT
notifyNFTPurchased(walletAddress, "Cool Cats #1234", "0.5", "ETH");

// When listing is canceled
notifyListingCanceled(walletAddress, "Cool Cats #1234");

// When added to favorites
notifyFavoriteAdded(walletAddress, "Cool Cats #1234");
```

### **Integration with V7 Contract Events**

```typescript
// In your buy/sell/list functions
import { notifyNFTSold, notifyNFTPurchased } from "@/lib/notifications";

// After successful sale
await marketplaceContract.buyItem(...);
notifyNFTSold(sellerAddress, nftName, price, currency);

// After successful purchase
await marketplaceContract.buyItem(...);
notifyNFTPurchased(buyerAddress, nftName, price, currency);
```

### **Integration with Offer System**

```typescript
import { notifyOfferReceived, notifyOfferAccepted } from "@/lib/notifications";

// When offer is made
await makeOffer(...);
notifyOfferReceived(sellerAddress, nftName, offerPrice, currency);

// When offer is accepted
await acceptOffer(...);
notifyOfferAccepted(buyerAddress, nftName, offerPrice, currency);
```

## 🎨 UI Components

### **Header Notification Icon**
- **Location**: Top navigation bar (next to favorites)
- **Badge**: Shows unread count
- **Dropdown**: Shows 5 most recent notifications
- **Auto-updates**: Updates in real-time when new notifications arrive

### **Notifications Page**
- **Route**: `/notifications`
- **Features**:
  - Filter tabs (All/Unread)
  - Notification cards with icons
  - Mark as read buttons
  - Clear all functionality
  - Empty state when no notifications

## 💾 Storage

Notifications are stored in `localStorage` with the key:
```
hoj:notifications:{walletAddress}
```

**Storage structure:**
```typescript
{
  id: string,
  type: string,
  message: string,
  timestamp: number,
  read: boolean
}
```

**Limits:**
- Maximum 50 notifications per wallet
- Oldest notifications are automatically removed
- Notifications persist across sessions

## 🔧 Helper Functions

### **addNotification**
```typescript
addNotification(walletAddress, type, message)
```
- `walletAddress`: User's wallet address
- `type`: Notification type (string)
- `message`: Notification message (string)

### **getNotifications**
```typescript
getNotifications(walletAddress)
```
- Returns array of all notifications for wallet

### **markNotificationAsRead**
```typescript
markNotificationAsRead(walletAddress, notificationId)
```
- Marks specific notification as read

### **markAllNotificationsAsRead**
```typescript
markAllNotificationsAsRead(walletAddress)
```
- Marks all notifications as read

### **clearNotifications**
```typescript
clearNotifications(walletAddress)
```
- Removes all notifications for wallet

## 🎯 Real-Time Updates

The notification system uses custom events for real-time updates:

```typescript
// Listen for new notifications
window.addEventListener('hoj-new-notification', (event) => {
  const notification = event.detail;
  console.log('New notification:', notification);
});
```

## 📱 Responsive Design

- **Desktop**: Full notification dropdown with all features
- **Mobile**: Optimized for touch, simplified dropdown
- **Tablet**: Balanced layout with all features

## 🔔 Notification Badge Animation

The notification badge has a subtle pulse animation to draw attention to unread notifications:

```css
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
```

## 🎨 Styling

All notification components use the royal black & gold theme:
- Background: Dark gray
- Border: Gold accents
- Text: White/light gray
- Icons: Gold
- Hover effects: Gold highlights

## 🔄 Automatic Welcome Notification

When a user connects their wallet for the first time, they automatically receive a welcome notification:

```
WELCOME: Welcome to House of Joshi Marketplace! Connect your wallet to start trading NFTs.
```

## 📊 Notification Types and Icons

| Type | Icon | Description |
|------|------|-------------|
| WELCOME | Wallet | Welcome message |
| SALE | TrendingUp | NFT sold |
| OFFER | Gift | New offer received |
| OFFER_ACCEPTED | Gift | Offer accepted |
| PURCHASE | TrendingUp | NFT purchased |
| LISTED | Gem | NFT listed |
| CANCELED | X | Listing canceled |
| FAVORITE | Heart | Added to favorites |
| DEFAULT | Bell | Generic notification |

## 🚀 Next Steps

1. **Integrate with Buy/Sell functions**: Add notifications when NFTs are bought/sold
2. **Integrate with Offer system**: Add notifications for offers
3. **Add more notification types**: Custom notifications for specific events
4. **Add database storage**: Replace localStorage with database for production
5. **Add notification preferences**: Allow users to customize which notifications they receive

The in-app notification system is now fully functional and ready to be integrated with your marketplace events!