// src/config/kivosChannels.js
// Kivos Channel Configuration

export const KIVOS_CHANNELS = {
  STATIONARY: 1,
  TECHNICAL: 2,
};

export const CHANNEL_LABELS = {
  [KIVOS_CHANNELS.STATIONARY]: 'Χαρτικά',
  [KIVOS_CHANNELS.TECHNICAL]: 'Τεχνικά Προϊόντα',
};

export const CHANNEL_ICONS = {
  [KIVOS_CHANNELS.STATIONARY]: 'document-text-outline',
  [KIVOS_CHANNELS.TECHNICAL]: 'construct-outline',
};

export const CHANNEL_COLORS = {
  [KIVOS_CHANNELS.STATIONARY]: '#3b82f6',
  [KIVOS_CHANNELS.TECHNICAL]: '#ef4444',
};

// Brands eligible for invoice discounts per channel
export const INVOICE_DISCOUNT_BRANDS = {
  [KIVOS_CHANNELS.STATIONARY]: ['ARTLINE', 'PENAC', 'PLUS'],
  [KIVOS_CHANNELS.TECHNICAL]: ['LOGO', 'LOGO SCRIPTO', 'GOOD', 'BORG'],
};

// Products excluded from invoice discount (but still count toward threshold)
export const DISCOUNT_EXCLUDED_PRODUCTS = {
  [KIVOS_CHANNELS.STATIONARY]: [
    '52181', // ΔΙΟΡΘΩΤΙΚΗ ΤΑΙΝΙΑ PLUS MINI WH-1804 4.2mmX12m
    '42339', // ΔΙΟΡΘΩΤΙΚΗ ΤΑΙΝΙΑ PLUS WHITE AWAY MINI 5mmX 7m WH-505
  ],
  [KIVOS_CHANNELS.TECHNICAL]: [],
};

// Free product promotion rules
export const FREE_PRODUCT_PROMOTIONS = {
  [KIVOS_CHANNELS.STATIONARY]: [
    {
      triggerProductCode: '42339',
      triggerQuantity: 100,
      freeProductCode: '42339',
      freeQuantity: 20,
      label: 'Αγοράζοντας 100τμχ 42339 κερδίζετε 20τμχ ΔΩΡΟ',
    },
    {
      triggerProductCode: '52181',
      triggerQuantity: 2,
      freeProductCode: '42339',
      freeQuantity: 20,
      label: 'Αγοράζοντας 2τμχ 52181 κερδίζετε 20τμχ 42339 ΔΩΡΟ',
    },
  ],
  [KIVOS_CHANNELS.TECHNICAL]: [],
};

// Invoice discount rules (applied at invoice level based on brand totals)
export const INVOICE_DISCOUNT_RULES = {
  [KIVOS_CHANNELS.STATIONARY]: [
    {
      threshold: 150, // Net value after 10% discount = 166.67 - 10%
      discount: 0.10,
      label: '10% έκπτωση άνω των 150€',
    },
    {
      threshold: 350, // Net value after 20% discount = 437.5 - 20%
      discount: 0.20,
      label: '20% έκπτωση άνω των 350€',
    },
  ],
  [KIVOS_CHANNELS.TECHNICAL]: [
    {
      threshold: 150, // Net value after 10% discount = 166.67 - 10%
      discount: 0.10,
      label: '10% έκπτωση άνω των 150€',
    },
  ],
};

/**
 * Get channel configuration
 */
export function getChannelConfig(channelId) {
  return {
    id: channelId,
    label: CHANNEL_LABELS[channelId] || 'Άγνωστο',
    icon: CHANNEL_ICONS[channelId] || 'help-outline',
    color: CHANNEL_COLORS[channelId] || '#6b7280',
    discountBrands: INVOICE_DISCOUNT_BRANDS[channelId] || [],
    discountRules: INVOICE_DISCOUNT_RULES[channelId] || [],
  };
}

/**
 * Check if a brand is eligible for invoice discount in this channel
 */
export function isBrandEligibleForDiscount(brand, channelId) {
  const eligibleBrands = INVOICE_DISCOUNT_BRANDS[channelId] || [];
  const brandUpper = String(brand || '').toUpperCase().trim();
  return eligibleBrands.some(b => brandUpper.includes(b));
}

/**
 * Check if a product is excluded from receiving invoice discount
 */
export function isProductExcludedFromDiscount(productCode, channelId) {
  const excludedProducts = DISCOUNT_EXCLUDED_PRODUCTS[channelId] || [];
  const code = String(productCode || '').trim();
  return excludedProducts.includes(code);
}

/**
 * Calculate applicable invoice discount based on eligible brand totals
 * Products from excluded list count toward threshold but don't receive discount
 */
export function calculateInvoiceDiscount(orderItems, channelId) {
  const eligibleBrands = INVOICE_DISCOUNT_BRANDS[channelId] || [];
  const rules = INVOICE_DISCOUNT_RULES[channelId] || [];
  
  // Sum up values for eligible brand products
  let eligibleTotal = 0; // Counts toward threshold
  let discountableTotal = 0; // Receives the discount
  
  orderItems.forEach(item => {
    const brand = String(item.brand || item.supplierBrand || '').toUpperCase().trim();
    const isEligibleBrand = eligibleBrands.some(b => brand.includes(b));
    
    if (isEligibleBrand) {
      // Calculate net value (price * quantity, considering product-level offers)
      const productPrice = item.offerPrice || item.price || item.wholesalePrice || 0;
      const itemTotal = productPrice * (item.quantity || 0);
      
      // All eligible brand products count toward threshold
      eligibleTotal += itemTotal;
      
      // Only non-excluded products receive the discount
      const isExcluded = isProductExcludedFromDiscount(item.productCode || item.code, channelId);
      if (!isExcluded) {
        discountableTotal += itemTotal;
      }
    }
  });
  
  // Find highest applicable discount based on TOTAL eligible (including excluded products)
  let applicableDiscount = 0;
  let applicableRule = null;
  
  for (const rule of rules) {
    // Net value needed before discount
    const grossNeeded = rule.threshold / (1 - rule.discount);
    
    if (eligibleTotal >= grossNeeded) {
      if (rule.discount > applicableDiscount) {
        applicableDiscount = rule.discount;
        applicableRule = rule;
      }
    }
  }
  
  // Apply discount only to discountable total
  return {
    discount: applicableDiscount,
    discountAmount: discountableTotal * applicableDiscount,
    eligibleTotal, // Total that counts toward threshold
    discountableTotal, // Total that receives discount
    rule: applicableRule,
  };
}

/**
 * Calculate free products based on promotion rules
 * @returns Array of free product items to add to order
 */
export function calculateFreeProducts(orderItems, channelId) {
  const promotions = FREE_PRODUCT_PROMOTIONS[channelId] || [];
  const freeItems = [];
  
  promotions.forEach(promo => {
    // Find if trigger product exists in order with sufficient quantity
    const triggerItem = orderItems.find(
      item => String(item.productCode || item.code).trim() === promo.triggerProductCode
    );
    
    if (triggerItem && triggerItem.quantity >= promo.triggerQuantity) {
      // Calculate how many free product sets customer earns
      const setsEarned = Math.floor(triggerItem.quantity / promo.triggerQuantity);
      const totalFreeQuantity = setsEarned * promo.freeQuantity;
      
      if (totalFreeQuantity > 0) {
        freeItems.push({
          productCode: promo.freeProductCode,
          quantity: totalFreeQuantity,
          isFreeGift: true,
          promotionLabel: promo.label,
          triggerProductCode: promo.triggerProductCode,
          triggerQuantity: triggerItem.quantity,
        });
      }
    }
  });
  
  return freeItems;
}

/**
 * Get promotion info for a product (for displaying on product card)
 */
export function getProductPromotionInfo(productCode, channelId) {
  const promotions = FREE_PRODUCT_PROMOTIONS[channelId] || [];
  const promo = promotions.find(p => p.triggerProductCode === String(productCode).trim());
  
  if (promo) {
    return {
      hasPromotion: true,
      label: promo.label,
      triggerQuantity: promo.triggerQuantity,
      freeQuantity: promo.freeQuantity,
      freeProductCode: promo.freeProductCode,
    };
  }
  
  return { hasPromotion: false };
}
