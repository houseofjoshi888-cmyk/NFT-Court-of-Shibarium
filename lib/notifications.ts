type Notification = {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  read: boolean;
};

// Helper function to add in-app notifications
export function addNotification(
  walletAddress: string,
  type: string,
  message: string
) {
  if (typeof window === 'undefined') return;

  try {
    const key = `hoj:notifications:${walletAddress.toLowerCase()}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    
    const newNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
      read: false
    };

    const updated = [newNotification, ...existing].slice(0, 50); // Keep last 50 notifications
    localStorage.setItem(key, JSON.stringify(updated));

    // Dispatch event for immediate UI update
    window.dispatchEvent(new CustomEvent('hoj-new-notification', {
      detail: newNotification
    }));
  } catch (error) {
    console.error('Failed to add notification:', error);
  }
}

// Marketplace-specific notification helpers
export function notifyNFTListed(walletAddress: string, nftName: string, price: string, currency: string) {
  addNotification(
    walletAddress,
    "LISTED",
    `Your NFT "${nftName}" has been listed for ${price} ${currency}`
  );
}

export function notifyNFTSold(walletAddress: string, nftName: string, price: string, currency: string) {
  addNotification(
    walletAddress,
    "SALE",
    `Your NFT "${nftName}" was sold for ${price} ${currency}!`
  );
}

export function notifyOfferReceived(walletAddress: string, nftName: string, offerPrice: string, currency: string) {
  addNotification(
    walletAddress,
    "OFFER",
    `New offer received for "${nftName}": ${offerPrice} ${currency}`
  );
}

export function notifyOfferAccepted(walletAddress: string, nftName: string, price: string, currency: string) {
  addNotification(
    walletAddress,
    "OFFER_ACCEPTED",
    `Your offer for "${nftName}" was accepted for ${price} ${currency}!`
  );
}

export function notifyNFTPurchased(walletAddress: string, nftName: string, price: string, currency: string) {
  addNotification(
    walletAddress,
    "PURCHASE",
    `You successfully purchased "${nftName}" for ${price} ${currency}`
  );
}

export function notifyListingCanceled(walletAddress: string, nftName: string) {
  addNotification(
    walletAddress,
    "CANCELED",
    `Your listing for "${nftName}" has been canceled`
  );
}

export function notifyFavoriteAdded(walletAddress: string, nftName: string) {
  addNotification(
    walletAddress,
    "FAVORITE",
    `You added "${nftName}" to your favorites`
  );
}

// Helper function to get notifications
export function getNotifications(walletAddress: string) {
  if (typeof window === 'undefined') return [];

  try {
    const key = `hoj:notifications:${walletAddress.toLowerCase()}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return [];
  }
}

// Helper function to mark notification as read
export function markNotificationAsRead(walletAddress: string, notificationId: string) {
  if (typeof window === 'undefined') return;

  try {
    const key = `hoj:notifications:${walletAddress.toLowerCase()}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = existing.map((n: Notification) => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
}

// Helper function to mark all notifications as read
export function markAllNotificationsAsRead(walletAddress: string) {
  if (typeof window === 'undefined') return;

  try {
    const key = `hoj:notifications:${walletAddress.toLowerCase()}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = existing.map((n: Notification) => ({ ...n, read: true }));
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
  }
}

// Helper function to clear notifications
export function clearNotifications(walletAddress: string) {
  if (typeof window === 'undefined') return;

  try {
    const key = `hoj:notifications:${walletAddress.toLowerCase()}`;
    localStorage.setItem(key, '[]');
  } catch (error) {
    console.error('Failed to clear notifications:', error);
  }
}