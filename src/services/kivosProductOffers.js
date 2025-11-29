// src/services/kivosProductOffers.js
// Service for managing Kivos product offers per channel

import { KIVOS_CHANNELS } from '../config/kivosChannels';

/**
 * Get active offer for a product based on channel
 * @param {Object} product - Product object from Firestore
 * @param {number} channelId - Channel ID (1 = Stationary, 2 = Technical)
 * @returns {Object|null} - Active offer details or null
 */
export function getActiveOffer(product, channelId) {
  if (!product) return null;
  
  const now = new Date();
  
  if (channelId === KIVOS_CHANNELS.STATIONARY) {
    // Stationary channel offers
    const endDate = product.discountEndsAt || product.discountEndDate || product['Discount.End.Date'];
    const discount = product.discount || product['Discount'];
    const offerPrice = product.offerPrice || product['ΤΙΜΗ ΤΕΜΑΧΙΟΥ ΠΡΟΣΦΟΡΑΣ ΕΥΡΩ'];
    
    // Check if offer is still valid
    if (endDate) {
      const expiryDate = new Date(endDate);
      if (expiryDate < now) {
        return null; // Offer expired
      }
    }
    
    if (discount || offerPrice) {
      return {
        channel: channelId,
        discount: parseFloat(discount) || 0,
        offerPrice: parseFloat(offerPrice) || null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
      };
    }
  } else if (channelId === KIVOS_CHANNELS.TECHNICAL) {
    // Technical channel offers
    const endDate = product.technicalDiscountEndsAt || product.technicalDiscountEndDate || product['Technical.Discount.End.Date'];
    const discount = product.technicalDiscount || product['Technical.Discount'];
    const offerPrice = product.technicalOfferPrice || product['Technical.ΤΙΜΗ ΤΕΜΑΧΙΟΥ ΠΡΟΣΦΟΡΑΣ ΕΥΡΩ'];
    
    // Check if offer is still valid
    if (endDate) {
      const expiryDate = new Date(endDate);
      if (expiryDate < now) {
        return null; // Offer expired
      }
    }
    
    if (discount || offerPrice) {
      return {
        channel: channelId,
        discount: parseFloat(discount) || 0,
        offerPrice: parseFloat(offerPrice) || null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
      };
    }
  }
  
  return null;
}

/**
 * Calculate effective price for a product considering active offers
 * @param {Object} product - Product object
 * @param {number} channelId - Channel ID
 * @returns {Object} - Price details
 */
export function calculateProductPrice(product, channelId) {
  const basePrice = parseFloat(product.price || product.listPrice || 0);
  const activeOffer = getActiveOffer(product, channelId);
  
  if (!activeOffer) {
    return {
      basePrice,
      finalPrice: basePrice,
      hasOffer: false,
      discount: 0,
      savings: 0,
    };
  }
  
  let finalPrice = basePrice;
  let discount = 0;
  
  // Priority: Use offer price if available, otherwise apply discount percentage
  if (activeOffer.offerPrice && activeOffer.offerPrice > 0) {
    finalPrice = activeOffer.offerPrice;
    discount = ((basePrice - finalPrice) / basePrice) * 100;
  } else if (activeOffer.discount > 0) {
    discount = activeOffer.discount;
    finalPrice = basePrice * (1 - discount / 100);
  }
  
  return {
    basePrice,
    finalPrice,
    hasOffer: true,
    discount,
    savings: basePrice - finalPrice,
    offerEndDate: activeOffer.endDate,
  };
}

/**
 * Filter products by channel and active offers
 * @param {Array} products - Array of products
 * @param {number} channelId - Channel ID
 * @param {boolean} offersOnly - If true, return only products with active offers
 * @returns {Array} - Filtered products with price info
 */
export function filterProductsByChannel(products, channelId, offersOnly = false) {
  return products
    .map(product => {
      const priceInfo = calculateProductPrice(product, channelId);
      return {
        ...product,
        priceInfo,
      };
    })
    .filter(product => {
      // If offersOnly, keep only products with active offers
      if (offersOnly) {
        return product.priceInfo.hasOffer;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort: offers first, then by name
      if (a.priceInfo.hasOffer && !b.priceInfo.hasOffer) return -1;
      if (!a.priceInfo.hasOffer && b.priceInfo.hasOffer) return 1;
      return (a.name || '').localeCompare(b.name || '', 'el');
    });
}

/**
 * Get offer summary for display
 * @param {Object} product - Product object
 * @param {number} channelId - Channel ID
 * @returns {string|null} - Formatted offer text or null
 */
export function getOfferSummary(product, channelId) {
  const priceInfo = calculateProductPrice(product, channelId);
  
  if (!priceInfo.hasOffer) return null;
  
  const parts = [];
  
  if (priceInfo.discount > 0) {
    parts.push(`-${priceInfo.discount.toFixed(0)}%`);
  }
  
  if (priceInfo.offerEndDate) {
    const dateStr = priceInfo.offerEndDate.toLocaleDateString('el-GR', {
      day: 'numeric',
      month: 'short',
    });
    parts.push(`έως ${dateStr}`);
  }
  
  return parts.join(' • ');
}
