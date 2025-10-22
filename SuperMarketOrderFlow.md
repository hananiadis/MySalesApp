# SuperMarket Order Flow Implementation Plan

## Overview

Create a parallel order flow for the John brand that serves SuperMarket chains. The flow must filter products by store category listings, display real-time inventory stock, and suggest order quantities based on current stock levels.

### Prerequisites

- Access to the SuperMarket Google Sheets (product listings, inventory stock, store categories) listed in [Configuration Requirements](#configuration-requirements).
- Firebase credentials with permissions to manage the `supermarket_*` collections.
- AsyncStorage available in the React Native app (already bundled with MySalesApp).
- Local tooling: the Firestore import scripts in `firestore-import/firestoremanager_full.js`.

## Data Structure

### Firestore Collections

**1. `supermarket_stores` Collection**

```javascript
{
  id: "auto-generated (${brand}_${companyName}_${storeCode})",
  companyName: "User input at import time",
  storeNumber: "Store index (transliterated header: A/A)",
  storeName: "Store name (Katastima)",
  openingStatus: "2024 Egkainia - Anakainiseis",
  storeCode: "Store code (Kod.)",
  address: "Dieythinsi",
  postalCode: "TK",
  region: "Nomos",
  city: "Poli",
  area: "Periochi",
  phone: "Til.",
  category: "Geniki Katigoria / typologia",
  hasSummerItems: "Kalokairina",
  hasToys: "Paichnidia",
  brand: "john",
  updatedAt: timestamp
}
```

**2. `supermarket_listings` Collection**

```javascript
{
  id: "auto-generated",
  productCode: "Kwd.",
  photoUrl: "Fotografia",
  barcode: "Barcode",
  description: "Perigrafi",
  packaging: "Sysk.",
  price: "Timi",
  isNew: "Neo",
  storeStock: "Apothema",
  suggestedQty: "Posotita",
  isAActive: true,
  isBActive: true,
  isCActive: true,
  category: "matched from store category",
  brand: "john",
  isActive: true,
  updatedAt: timestamp
}
```

> Listing header mapping (spreadsheet transliterations -> Firestore):
> `Kwd.` -> `productCode`, `Fotografia` -> `photoUrl`, `Barcode` -> `barcode`, `Perigrafi` -> `description`, `Sysk.` -> `packaging`, `Timi` -> `price`, `Neo` -> `isNew`, `Apothema` -> `storeStock`, `Posotita` -> `suggestedQty`, `IsAActive` -> `isAActive`, `IsBActive` -> `isBActive`, `IsCActive` -> `isCActive`.

**3. `orders_john_supermarket` Collection**

```javascript
{
  // All standard order fields, plus:
  orderType: "supermarket",
  storeId: "reference to supermarket_stores",
  storeName: "store name for display",
  storeCode: "store code",
  storeCategory: "category used for listing filter",
  inventorySnapshot: { productCode: stockQty }, // cached at order time
}
```

### Google Sheets Cache (AsyncStorage)

**Key: `supermarket_inventory_cache`**

```javascript
{
  lastFetched: timestamp,
  expiresAt: timestamp, // lastFetched + 24 hours
  data: {
    "storeCode_productCode": {
      storeCode: "Kod.",
      storeName: "Katastima",
      productCode: "Supplier Item Code",
      masterCode: "Mitricos Kod.",
      description: "Perigrafi",
      stockQty: "Teliko Apothema (tem.)",
      stockCost: "Teliko Apothema (kostos)"
    }
  }
}
```

## Implementation Steps

### 1. Firestore Import Manager Updates

**File: `firestore-import/firestoremanager_full.js`**

Add a new section "9. SuperMarket Management" with options:

- 9.1 Import SuperMarket Stores (Excel/Google Sheets)
- 9.2 Import SuperMarket Listings (Excel/Google Sheets)
- 9.3 Delete SuperMarket Stores collection
- 9.4 Delete SuperMarket Listings collection
- 9.5 Inspect SuperMarket Stores
- 9.6 Inspect SuperMarket Listings

**Import logic:**

- Parse Excel files using the `xlsx` library.
- Prompt the user for Company/Customer Name before import (e.g., `Enter company name for these stores:`).
- Map spreadsheet headers to Firestore fields using the mapping above.
- Add `companyName` to each store document.
- Validate required fields (`storeCode`, `category`, `productCode`, `companyName`).
- Batch write to Firestore (500 docs per batch).
- Generate IDs following `${brand}_${companyName}_${storeCode}` for stores and `${brand}_${category}_${productCode}` for listings.
- Use `IsAActive`/`IsBActive`/`IsCActive` flags to set category visibility booleans.

### 2. MySalesApp � Inventory Service

**File: `src/services/supermarketInventory.js`** (new)

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SUPERMARKET_INVENTORY_SHEET_URL,
  SUPERMARKET_LISTINGS_SHEET_URL,
} from '../config/firebase';

const CACHE_KEY = 'supermarket_inventory_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function getInventoryData(forceRefresh = false) {
  const cached = await AsyncStorage.getItem(CACHE_KEY);
  if (cached && !forceRefresh) {
    const parsed = JSON.parse(cached);
    if (parsed.expiresAt > Date.now()) {
      return parsed.data;
    }
  }

  let inventoryData = {};
  try {
    const response = await fetch(SUPERMARKET_INVENTORY_SHEET_URL);
    const text = await response.text();
    // Strip JSONP prefix from Google Visualization API response
    // Parse rows into inventoryData object
    // Build lookup object: { "storeCode_productCode": {...} }
  } catch (error) {
    // Handle network or parsing issues; surface to analytics/logger if available
    throw error;
  }

  await AsyncStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      lastFetched: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION,
      data: inventoryData,
    }),
  );

  return inventoryData;
}

export async function getStoreInventory(storeCode) {
  const allData = await getInventoryData();
  return Object.entries(allData)
    .filter(([key]) => key.startsWith(`${storeCode}_`))
    .reduce((acc, [key, val]) => {
      acc[val.productCode] = val.stockQty;
      return acc;
    }, {});
}
```

> When parsing Google Visualization API responses, drop the leading `/**/` and the `google.visualization.Query.setResponse(...)` wrapper before calling `JSON.parse`.

### 3. JohnScreen � Add SuperMarket Button

**File: `src/screens/JohnScreen.js`**

Add a button after the existing entries:

```javascript
<TouchableOpacity
  style={styles.brandButton}
  onPress={() => navigation.navigate('SuperMarketOrderFlow')}
>
  <Ionicons name="storefront-outline" size={28} color="#fff" />
  <Text style={styles.brandButtonText}>Paraggelies SuperMarket</Text>
</TouchableOpacity>
```

### 4. SuperMarket Store Selection Screen

**File: `src/screens/SuperMarketStoreSelectScreen.js`** (new)

- Fetch stores from the `supermarket_stores` collection.
- Group or filter by `category` to align with product listings.
- Support search by store name, code, or city.
- Display store name, code, city, and category.
- On select -> navigate to `SuperMarketProductSelectionScreen` with `{ storeId, storeCode, storeCategory }`.

### 5. SuperMarket Product Selection Screen

**File: `src/screens/SuperMarketProductSelectionScreen.js`** (new)

**Data loading:**

1. Fetch listings for the selected `storeCategory` from `supermarket_listings`.
2. Filter by `isAActive`/`isBActive`/`isCActive` to ensure category alignment.
3. Fetch store inventory using `getStoreInventory(storeCode)`.
4. Merge listings, inventory, and product metadata from `products_john`.

**Product display model:**

```javascript
{
  productCode: 'XXX',
  description: 'Perigrafi',
  barcode: '...ean...',
  price: 10.50,           // base price list (VAT excluded)
  srp: 13.02,             // price * 1.24 (VAT included)
  packaging: '12 tem.',
  currentStock: 45,       // from inventory sheet
  storeStock: 30,         // from listing 'Apothema' column
  suggestedQty: 5,        // from listing 'Posotita'
  isNew: true,            // from listing
  canOrder: true          // only if product active for this category
}
```

**UI features:**

- List/Grid view with product imagery, code, and description.
- Stock indicator (Green: >10, Yellow: 1�10, Red: 0).
- Pre-filled quantity = `suggestedQty` (editable).
- Display SRP (Suggested Retail Price) as `price * 1.24`.
- Search shows all products but disables "Add to Order" for items not active in the listing.
- "Add All Suggested" button adds items with `suggestedQty > 0`.

### 6. Order Flow Integration

**File: `src/context/OrderContext.js`**

Add a new action: `startSuperMarketOrder(orderId, storeObj, inventorySnapshot)`

```javascript
const startSuperMarketOrder = async (orderId, storeObj, inventorySnapshot) => {
  const draft = {
    ...initialState,
    id: orderId,
    number: generateOrderNumber(),
    brand: 'john',
    orderType: 'supermarket',
    storeId: storeObj.id,
    storeName: storeObj.storeName,
    storeCode: storeObj.storeCode,
    storeCategory: storeObj.category,
    customerId: storeObj.id, // or link to actual customer
    customer: {
      id: storeObj.id,
      name: storeObj.storeName,
      customerCode: storeObj.storeCode,
      // ... other customer fields
    },
    inventorySnapshot,
    status: 'draft',
    createdAt: new Date().toISOString(),
    userId: currentUserId || 'demoUserId',
    createdBy: currentUserId || 'demoUserId',
  };

  await saveOrder(draft, 'draft');
  dispatch({ type: 'INIT_ORDER', payload: draft });
  return { orderId: draft.id };
};
```

**File: `src/utils/firestoreOrders.js`**

Update `getCollectionName()`:

```javascript
export function getCollectionName(brand, orderType) {
  if (orderType === 'supermarket') {
    return `orders_${brand}_supermarket`;
  }
  return brand === 'playmobil' ? 'orders' : `orders_${brand}`;
}
```

### 7. Navigation Setup

**File: `App.js`**

Add new screens to the stack:

```javascript
import SuperMarketStoreSelectScreen from './src/screens/SuperMarketStoreSelectScreen';
import SuperMarketProductSelectionScreen from './src/screens/SuperMarketProductSelectionScreen';

<Stack.Screen name="SuperMarketOrderFlow" component={SuperMarketStoreSelectScreen} />
<Stack.Screen name="SuperMarketProductSelection" component={SuperMarketProductSelectionScreen} />
```

### 8. Excel Export Updates

**File: `src/utils/exportOrderUtils.js`**

Update `createOrderExcel()` to handle SuperMarket orders:

- Include store info header (Store Code, Name, Category).
- Include the `inventorySnapshot` captured at order time.
- Show suggested vs actual quantities per line.
- Flag new items.
- Include SRP (price � 1.24) alongside base price.

### 9. OrdersManagement Filter

**File: `src/screens/OrdersManagement.js`**

Add filter toggles:

- `KanoniKes Paraggelies` (orderType !== 'supermarket')
- `Paraggelies SuperMarket` (orderType === 'supermarket')

## File Changes Summary

### New Files

1. `src/services/supermarketInventory.js` � Inventory cache service.
2. `src/screens/SuperMarketStoreSelectScreen.js` � Store selection screen.
3. `src/screens/SuperMarketProductSelectionScreen.js` � Product selection with stock visibility.

### Modified Files

1. `firestore-import/firestoremanager_full.js` � Add section 9 (SuperMarket management).
2. `App.js` � Register new screens in navigation.
3. `src/screens/JohnScreen.js` � Add SuperMarket entry button.
4. `src/context/OrderContext.js` � Add `startSuperMarketOrder()`.
5. `src/utils/firestoreOrders.js` � Update collection name logic.
6. `src/utils/exportOrderUtils.js` � Handle SuperMarket exports.
7. `src/screens/OrdersManagement.js` � Add orderType filter.

## Configuration Requirements

**Google Sheets URLs:**

1. Product Listing  
   `https://docs.google.com/spreadsheets/d/1GPfMydqVMyDjjmhEIjWLP5kN2Vs21v8YdJgr15ins0c/edit?usp=sharing`
2. Masoutis Stores Categories  
   `https://docs.google.com/spreadsheets/d/1pr6HRuTRbRUpqYVYKLuiV7qZ2uqR-bm0sObZom6_m1s/edit?usp=sharing`
3. Masoutis Inventory Stock  
   `https://docs.google.com/spreadsheets/d/1A1HlA27aaamZy-smzvbr6DckmH7MGME2NNwMMNOnZVI/edit?usp=sharing`

Add to `firestore-import-config.json`:

```json
{
  "supermarket": {
    "listings": "https://docs.google.com/spreadsheets/d/1GPfMydqVMyDjjmhEIjWLP5kN2Vs21v8YdJgr15ins0c/gviz/tq?tqx=out:json",
    "stores": "https://docs.google.com/spreadsheets/d/1pr6HRuTRbRUpqYVYKLuiV7qZ2uqR-bm0sObZom6_m1s/gviz/tq?tqx=out:json",
    "inventory": "https://docs.google.com/spreadsheets/d/1A1HlA27aaamZy-smzvbr6DckmH7MGME2NNwMMNOnZVI/gviz/tq?tqx=out:json"
  }
}
```

Add to `src/config/firebase.js` (or the equivalent environment configuration):

```javascript
export const SUPERMARKET_LISTINGS_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1GPfMydqVMyDjjmhEIjWLP5kN2Vs21v8YdJgr15ins0c/gviz/tq?tqx=out:json';
export const SUPERMARKET_INVENTORY_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1A1HlA27aaamZy-smzvbr6DckmH7MGME2NNwMMNOnZVI/gviz/tq?tqx=out:json';
export const SUPERMARKET_STORES_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1pr6HRuTRbRUpqYVYKLuiV7qZ2uqR-bm0sObZom6_m1s/gviz/tq?tqx=out:json';
```

## Testing Checklist

1. Import stores, listings, and inventory via the Firestore Manager.
2. Verify collections in the Firebase console.
3. Access the SuperMarket flow from `JohnScreen`.
4. Select a store and verify category-based product filtering.
5. Confirm inventory data loads and caches (force refresh to validate expiry logic).
6. Ensure suggested quantities pre-fill as expected.
7. Verify search behavior for inactive products.
8. Complete an order and export to Excel.
9. Confirm the `orders_john_supermarket` collection is created and populated.
10. Check the OrdersManagement filter buttons switch views correctly.

## Future Enhancements (Playmobil)

When implementing for Playmobil:

- Reuse `supermarketInventory.js`.
- Create `supermarket_stores_playmobil` and `supermarket_listings_playmobil` collections.
- Add a SuperMarket button to `PlaymobilScreen.js`.
- Pass a `brand` prop to reuse the same screen components.
- Store Playmobil orders in `orders_playmobil_supermarket` (or a shared `orders_supermarket` collection).




