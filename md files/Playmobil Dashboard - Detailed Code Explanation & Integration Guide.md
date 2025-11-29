# Playmobil Dashboard - Detailed Code Explanation & Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [Data Flow Architecture](#data-flow-architecture)
3. [Service Files Explained](#service-files-explained)
4. [React Components Explained](#react-components-explained)
5. [Integration Points](#integration-points)
6. [Database Schema & Keys](#database-schema--keys)
7. [Configuration Requirements](#configuration-requirements)

---

## Summary: What You Need to Change

### In Your App

1. **Update `googleSheetsCache.js`:**
   ```javascript
   const SHEET_URLS = {
     sales2025: 'YOUR_ACTUAL_CSV_URL',  // ← Replace
     orders2025: 'YOUR_ACTUAL_CSV_URL', // ← Replace
     balance2025: 'YOUR_ACTUAL_CSV_URL', // ← Replace
     sales2024: 'YOUR_ACTUAL_CSV_URL',  // ← Replace
     orders2024: 'YOUR_ACTUAL_CSV_URL'  // ← Replace
   };
   ```

2. **Update `usePlaymobilData.js` hook:**
   ```javascript
   // Change this line to match YOUR user data structure:
   const salesmanIds = user.salesmanIds || [user.uid];
   
   // Examples for your app:
   // If in Firestore user doc:
   const userDoc = await getDoc(doc(db, 'users', user.uid));
   const salesmanIds = userDoc.data().salesmanIds;
   
   // If single value (not array):
   const salesmanIds = [userDoc.data().salesmanId];
   ```

3. **Verify Firestore `customers` collection:**
   - Document ID = Customer code
   - Field `merch` = Single salesman ID (string, not array)
   - Customer codes match Google Sheets exactly

4. **Check Google Sheets column names:**
   - If different from defaults, update constants in `kpiCalculations.js`

5. **Verify date format:**
   - Must be M/D/YYYY (e.g., "10/31/2025")
   - If different, modify `parseSheetDate()` function

---

## Testing the Integration

### Step-by-Step Test

1. **Test Authentication:**
   ```javascript
   console.log('User:', user);
   console.log('Salesman IDs:', salesmanIds);
   // Should log the user's salesman ID(s)
   ```

2. **Test Customer Query:**
   ```javascript
   const customerCodes = await getCustomerCodes(db, salesmanIds);
   console.log('Customer codes:', customerCodes);
   // Should log array like: ['F2051', '1404516', ...]
   ```

3. **Test Cache:**
   ```javascript
   const sheetsData = await getAllSheetsData(db);
   console.log('Sales 2025 rows:', sheetsData.sales2025.length);
   // First time: "Fetching fresh data for sales2025"
   // Second time: "Using cached data for sales2025"
   ```

4. **Test KPI Calculations:**
   ```javascript
   const kpis = calculateAllKPIs(sheetsData, customerCodes);
   console.log('MTD 2025:', kpis.invoiced.mtd2025);
   // Should show: { amount: X, customers: Y }
   ```

5. **Test Customer Summary:**
   ```javascript
   const summary = getCustomerSalesSummary(sheetsData, customerCodes);
   console.log('Customers:', summary.length);
   console.log('First customer:', summary[0]);
   // Should show customer object with all fields
   ```

---

## Common Integration Issues

### Issue 1: "No customers found"
**Cause:** Firestore query returns empty
**Fix:**
- Verify `customers` collection exists
- Check `merch` field exists on documents
- Verify `merch` value matches salesmanId exactly
- Check Firestore security rules allow read

### Issue 2: "Failed to fetch sheet"
**Cause:** CSV URL not accessible
**Fix:**
- Verify sheets are published as CSV
- Check URL is correct (ends with `tqx=out:csv&gid=...`)
- Test URL directly in browser (should download CSV)

### Issue 3: "Column not found"
**Cause:** Column name mismatch
**Fix:**
- Open Google Sheet and check exact column names
- Update constants in `kpiCalculations.js` to match
- Remember: Names are case-sensitive

### Issue 4: "Invalid date"
**Cause:** Date format mismatch
**Fix:**
- Verify dates are M/D/YYYY format
- Modify `parseSheetDate()` if using different format

### Issue 5: "KPIs show 0"
**Cause:** Customer codes don't match
**Fix:**
- Check Firestore document IDs match sheet customer codes exactly
- Log `customerCodes` and compare with sheet data
- Check for whitespace or case differences

### Issue 6: "Permission denied"
**Cause:** Firestore security rules
**Fix:**
- Deploy security rules that allow authenticated users to read/write
- Check user is authenticated before querying

---

## Performance Optimization Tips

1. **Cache Duration:**
   - 24 hours is default
   - Adjust based on how often sheets are updated
   - Shorter = more API calls but fresher data

2. **Parallel Fetching:**
   - `Promise.all()` fetches all sheets at once
   - Don't change to sequential unless needed

3. **Customer Query:**
   - Index `merch` field in Firestore for faster queries
   - Consider caching customer list if large

4. **Component Rendering:**
   - Use React.memo() for KPICard if many cards
   - Debounce search input for large customer lists

5. **Data Size:**
   - Cache collection grows by ~1MB per sheet
   - Monitor Firestore usage
   - Consider cleanup of old cache docs

---

## Maintenance

### Regular Tasks

1. **Monitor cache size:**
   - Check Firestore storage usage
   - Delete old cache docs if needed

2. **Update sheet URLs:**
   - If sheets are re-published, update URLs in config

3. **Verify data accuracy:**
   - Spot-check KPI calculations monthly
   - Compare with manual calculations

4. **Update column mappings:**
   - If Google Sheets structure changes, update constants

### Troubleshooting Commands

```javascript
// Force cache refresh
import { refreshAllCaches } from './services/googleSheetsCache';
await refreshAllCaches(db);

// Check cache status
const cacheDoc = await getDoc(doc(db, 'sheetsCache', 'sales2025'));
console.log('Cache age (hours):', 
  (new Date() - cacheDoc.data().timestamp.toDate()) / (1000 * 60 * 60)
);

// List all customer codes
const customers = await getDocs(collection(db, 'customers'));
customers.forEach(doc => console.log(doc.id));
```

---

## Code File Summary

| File | Purpose | Key Functions | Dependencies |
|------|---------|---------------|--------------|
| `googleSheetsCache.js` | Fetch & cache sheets | `getAllSheetsData()`, `getCachedSheetData()` | Firestore |
| `kpiCalculations.js` | Calculate KPIs | `calculateAllKPIs()`, `getCustomerSalesSummary()` | None |
| `customerService.js` | Query customers | `getCustomerCodes()`, `getCustomersBySalesman()` | Firestore |
| `PlaymobilKPIDashboard.jsx` | Display KPIs | `KPICard`, `calculateChange()` | React, Lucide |
| `CustomerSalesSummary.jsx` | Display customers | `handleSort()`, `filteredAndSortedCustomers` | React, Lucide |
| `usePlaymobilData.js` | Data orchestration | `loadData()` | All services |

---

## Quick Reference: Key Values

### Firestore Collections
- `customers` - Customer data
- `sheetsCache` - Cached Google Sheets data
- `users` - User profiles (optional)

### Firestore Fields
- `customers.merch` - Single salesman ID (string)
- `sheetsCache.data` - Array of parsed CSV objects
- `sheetsCache.timestamp` - Cache creation time

### Sheet Column Names (Sales)
- `Payer` - Customer code (Column M)
- `Name Payer` - Customer name (Column L)
- `Sales revenue` - Invoice amount (Column F)
- `Billing Date` - Invoice date (Column N)

### Sheet Column Names (Orders)
- `Bill-To Party` - Customer code (Column B)
- `Name bill-to` - Customer name (Column C)
- `Gross value` - Order amount (Column I)
- `Document Date` - Order date (Column D)

### Sheet Column Names (Balance)
- `Customer` - Customer code
- `Name` - Customer name
- `Balance` - Current balance

### Date Format
- Google Sheets: `M/D/YYYY`
- JavaScript: `new Date(year, month-1, day)`

---

## Final Checklist Before Going Live

- [ ] All 5 Google Sheets published as CSV
- [ ] CSV URLs updated in `googleSheetsCache.js`
- [ ] Firestore `customers` collection populated
- [ ] Customer document IDs match sheet codes
- [ ] All customers have `merch` field
- [ ] User authentication provides salesman IDs
- [ ] Firestore security rules deployed
- [ ] Column names verified in sheets
- [ ] Date format is M/D/YYYY
- [ ] Tested with real user account
- [ ] KPIs match manual calculations
- [ ] Customer balance displays correctly
- [ ] Cache working (check Firestore)
- [ ] No errors in console
- [ ] Mobile responsive design tested

---

This completes the detailed explanation of all code files, integration points, and configuration requirements. Use this document as your reference when implementing and troubleshooting the Playmobil dashboard. Overview

This system consists of **3 service layers** and **2 UI components** that work together to:
1. Cache Google Sheets data in Firestore
2. Query customer data based on salesman
3. Calculate KPIs from filtered data
4. Display results in dashboards

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER AUTHENTICATION                       │
│  User logs in → Get salesman ID(s) from user profile       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               CUSTOMER SERVICE (customerService.js)          │
│  Query Firestore: customers collection                      │
│  WHERE merch == salesmanId                                  │
│  RETURNS: Array of customer codes                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│          GOOGLE SHEETS CACHE (googleSheetsCache.js)         │
│  1. Check Firestore sheetsCache collection                  │
│  2. If cache valid (<24h) → return cached data              │
│  3. If cache expired → fetch from Google Sheets             │
│  4. Parse CSV → Store in Firestore → return data            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│          KPI CALCULATIONS (kpiCalculations.js)              │
│  1. Filter sheets data by customer codes                    │
│  2. Calculate MTD, YTD, Monthly, Yearly metrics             │
│  3. Calculate year-over-year comparisons                    │
│  4. Generate customer summaries with balances               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    UI COMPONENTS                             │
│  PlaymobilKPIDashboard → Display KPI cards                  │
│  CustomerSalesSummary → Display customer table              │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Files Explained

### 1. `googleSheetsCache.js` - Google Sheets Caching Service

#### Purpose
Fetches data from Google Sheets, caches it in Firestore, and serves cached data for 24 hours to reduce API calls and improve performance.

#### Key Functions

##### `parseCSV(csvText)`
**What it does:**
- Converts CSV text into JavaScript objects
- First row becomes object keys (headers)
- Subsequent rows become data objects

**Input:**
```csv
Name,Age,City
John,25,Athens
Maria,30,Thessaloniki
```

**Output:**
```javascript
[
  { Name: 'John', Age: '25', City: 'Athens' },
  { Name: 'Maria', Age: '30', City: 'Thessaloniki' }
]
```

**Code explanation:**
```javascript
function parseCSV(csvText) {
  const lines = csvText.split('\n');  // Split by newlines
  const headers = lines[0].split(',') // First line = headers
    .map(h => h.trim().replace(/"/g, '')); // Remove quotes & whitespace
  
  const data = [];
  for (let i = 1; i < lines.length; i++) { // Start from line 2
    if (!lines[i].trim()) continue; // Skip empty lines
    
    const values = lines[i].split(','); // Split by comma
    const row = {};
    
    // Map each value to its header
    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
    });
    
    data.push(row);
  }
  
  return data;
}
```

---

##### `fetchSheetData(url)`
**What it does:**
- Fetches CSV data from Google Sheets published URL
- Parses it into JavaScript objects

**Input:** 
- `url`: Google Sheets CSV export URL

**Output:** 
- Array of objects (parsed CSV)

**Code explanation:**
```javascript
async function fetchSheetData(url) {
  try {
    const response = await fetch(url); // HTTP GET request
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }
    const csvText = await response.text(); // Get response as text
    return parseCSV(csvText); // Parse CSV to objects
  } catch (error) {
    console.error('Error fetching sheet:', error);
    throw error;
  }
}
```

---

##### `isCacheValid(cacheDoc)`
**What it does:**
- Checks if cached data is still fresh (<24 hours old)

**Input:**
- `cacheDoc`: Firestore document snapshot

**Output:**
- `true` if cache is valid, `false` if expired

**Code explanation:**
```javascript
function isCacheValid(cacheDoc) {
  if (!cacheDoc.exists()) return false; // No cache = invalid
  
  const data = cacheDoc.data();
  if (!data.timestamp) return false; // No timestamp = invalid
  
  const cacheTime = data.timestamp.toDate(); // Convert Firestore timestamp to JS Date
  const now = new Date();
  const hoursDiff = (now - cacheTime) / (1000 * 60 * 60); // Calculate hours difference
  
  return hoursDiff < CACHE_DURATION_HOURS; // Valid if < 24 hours
}
```

**Logic:**
- 1000 ms = 1 second
- 60 seconds = 1 minute  
- 60 minutes = 1 hour
- Divide milliseconds difference by this to get hours

---

##### `getCachedSheetData(db, sheetKey, sheetUrl)`
**What it does:**
- Main caching logic: check cache, fetch if needed, store result

**Flow:**
1. Check Firestore for cached data
2. If cache exists and valid → return cached data
3. If cache missing or expired → fetch fresh data
4. Store fresh data in Firestore
5. Return data

**Code explanation:**
```javascript
async function getCachedSheetData(db, sheetKey, sheetUrl) {
  const cacheDocRef = doc(db, CACHE_COLLECTION, sheetKey);
  // CACHE_COLLECTION = 'sheetsCache'
  // sheetKey = 'sales2025', 'orders2025', etc.
  
  try {
    // 1. Try to get from cache
    const cacheDoc = await getDoc(cacheDocRef);
    
    if (isCacheValid(cacheDoc)) {
      console.log(`Using cached data for ${sheetKey}`);
      return cacheDoc.data().data; // Return the 'data' field
    }
    
    // 2. Cache miss or expired - fetch fresh
    console.log(`Fetching fresh data for ${sheetKey}`);
    const freshData = await fetchSheetData(sheetUrl);
    
    // 3. Store in Firestore cache
    await setDoc(cacheDocRef, {
      data: freshData,              // Parsed CSV data
      timestamp: serverTimestamp(), // Current server time
      sheetKey                      // For reference
    });
    
    return freshData;
  } catch (error) {
    console.error(`Error getting cached data for ${sheetKey}:`, error);
    
    // 4. Fallback: if fetch fails but old cache exists, use it
    const cacheDoc = await getDoc(cacheDocRef);
    if (cacheDoc.exists()) {
      console.warn(`Using stale cache for ${sheetKey} due to fetch error`);
      return cacheDoc.data().data;
    }
    
    throw error; // No cache and fetch failed = throw error
  }
}
```

---

##### `getAllSheetsData(db)`
**What it does:**
- Fetches all 5 sheets in parallel
- Returns object with all data

**Code explanation:**
```javascript
export async function getAllSheetsData(db) {
  try {
    // Promise.all runs all fetches in parallel (faster)
    const [sales2025, orders2025, balance2025, sales2024, orders2024] = 
      await Promise.all([
        getCachedSheetData(db, 'sales2025', SHEET_URLS.sales2025),
        getCachedSheetData(db, 'orders2025', SHEET_URLS.orders2025),
        getCachedSheetData(db, 'balance2025', SHEET_URLS.balance2025),
        getCachedSheetData(db, 'sales2024', SHEET_URLS.sales2024),
        getCachedSheetData(db, 'orders2024', SHEET_URLS.orders2024)
      ]);
    
    // Return as named object
    return {
      sales2025,
      orders2025,
      balance2025,
      sales2024,
      orders2024
    };
  } catch (error) {
    console.error('Error fetching all sheets data:', error);
    throw error;
  }
}
```

**Performance:**
- Sequential: 5 sheets × 2 seconds = 10 seconds
- Parallel (Promise.all): ~2 seconds (all at once)

---

#### Configuration Required

**SHEET_URLS object:**
```javascript
const SHEET_URLS = {
  sales2025: 'YOUR_CSV_URL_HERE',   // ← Replace with actual URL
  orders2025: 'YOUR_CSV_URL_HERE',  // ← Replace with actual URL
  balance2025: 'YOUR_CSV_URL_HERE', // ← Replace with actual URL
  sales2024: 'YOUR_CSV_URL_HERE',   // ← Replace with actual URL
  orders2024: 'YOUR_CSV_URL_HERE'   // ← Replace with actual URL
};
```

**How to get CSV URLs:**
1. Open Google Sheet
2. File → Share → Publish to web
3. Select specific sheet (e.g., "D_monthly sls")
4. Choose "Comma-separated values (.csv)"
5. Click Publish
6. Copy URL

**URL format example:**
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/gviz/tq?tqx=out:csv&gid=SHEET_GID
```

---

#### Firestore Collections Used

**Collection: `sheetsCache`**

Document structure:
```javascript
{
  // Document ID: sheetKey ('sales2025', 'orders2025', etc.)
  
  "data": [
    // Array of objects (parsed CSV)
    { "Payer": "F2051", "Sales revenue": "1234.56", ... },
    { "Payer": "1404516", "Sales revenue": "789.12", ... },
    // ...
  ],
  
  "timestamp": Timestamp(2025, 10, 31, 10, 30, 0), // Server timestamp
  
  "sheetKey": "sales2025" // Reference for debugging
}
```

---

### 2. `kpiCalculations.js` - KPI Calculation Service

#### Purpose
Filters Google Sheets data by customer codes and calculates all KPI metrics (MTD, YTD, Monthly, Yearly) with year-over-year comparisons.

#### Key Functions

##### `parseSheetDate(dateString)`
**What it does:**
- Converts Google Sheets date format to JavaScript Date object

**Input formats:**
- "10/31/2025" (October 31, 2025)
- "1/5/2025" (January 5, 2025)

**Output:**
- JavaScript Date object

**Code explanation:**
```javascript
function parseSheetDate(dateString) {
  if (!dateString) return null;
  
  // Example: "10/31/2025" → ["10", "31", "2025"]
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;
  
  const month = parseInt(parts[0], 10); // 10
  const day = parseInt(parts[1], 10);   // 31
  const year = parseInt(parts[2], 10);  // 2025
  
  // JavaScript Date: new Date(year, month-1, day)
  // Month is 0-indexed: January=0, February=1, ..., December=11
  return new Date(year, month - 1, day);
}
```

**Why month - 1?**
- Google Sheets: January = 1, December = 12
- JavaScript Date: January = 0, December = 11
- We subtract 1 to convert

---

##### `filterByCustomers(data, customerCodes, customerCodeColumn)`
**What it does:**
- Filters array of rows to include only specified customers

**Input:**
- `data`: Array of sheet rows (objects)
- `customerCodes`: Array of customer codes to keep
- `customerCodeColumn`: Column name containing customer code

**Output:**
- Filtered array

**Code explanation:**
```javascript
function filterByCustomers(data, customerCodes, customerCodeColumn) {
  return data.filter(row => {
    const code = row[customerCodeColumn]?.toString().trim();
    // Get customer code from row, convert to string, remove whitespace
    
    return customerCodes.includes(code);
    // Keep row only if customer code is in our list
  });
}
```

**Example:**
```javascript
const data = [
  { Payer: 'F2051', Sales: 100 },
  { Payer: '1404516', Sales: 200 },
  { Payer: 'OTHER', Sales: 300 }
];

const customerCodes = ['F2051', '1404516'];

filterByCustomers(data, customerCodes, 'Payer');
// Returns: [
//   { Payer: 'F2051', Sales: 100 },
//   { Payer: '1404516', Sales: 200 }
// ]
// 'OTHER' is filtered out
```

---

##### `calculateInvoicedMetrics(salesData, customerCodes, year, month, day)`
**What it does:**
- Calculates all invoiced metrics (MTD, YTD, Monthly, Yearly) for a specific time period

**Column Mappings:**
```javascript
const CUSTOMER_CODE_COL = 'Payer';        // Column M in sheets
const SALES_REVENUE_COL = 'Sales revenue'; // Column F in sheets
const BILLING_DATE_COL = 'Billing Date';   // Column N in sheets
```

**Logic Flow:**

**1. Filter by customers**
```javascript
const filtered = filterByCustomers(salesData, customerCodes, CUSTOMER_CODE_COL);
// Only keep rows for our salesman's customers
```

**2. Calculate MTD (Month-to-Date)**
```javascript
const mtdData = filtered.filter(row => {
  const date = parseSheetDate(row[BILLING_DATE_COL]);
  if (!date) return false;
  
  return date.getFullYear() === year &&      // Same year (e.g., 2025)
         date.getMonth() + 1 === month &&    // Same month (e.g., 10 for October)
         date.getDate() <= day;              // Up to specific day (e.g., 31)
});
```

**Example:** If today is October 31, 2025:
- Include: October 1-31, 2025
- Exclude: November 1+, 2025
- Exclude: October 1-31, 2024 (wrong year)

**3. Sum amounts**
```javascript
const mtdAmount = mtdData.reduce((sum, row) => {
  // Get Sales revenue value, remove commas, convert to number
  const amount = parseFloat(row[SALES_REVENUE_COL]?.replace(/,/g, '') || 0);
  return sum + amount;
}, 0);
```

**Why replace commas?**
- Sheets: "1,234.56"
- JavaScript: needs "1234.56"
- Remove commas before parseFloat

**4. Count unique customers**
```javascript
const mtdCustomers = new Set(
  mtdData.map(row => row[CUSTOMER_CODE_COL]?.toString().trim())
).size;
```

**Why Set?**
- Customer may have multiple invoices in October
- Set automatically removes duplicates
- `.size` gives unique count

**Example:**
```javascript
['F2051', 'F2051', '1404516', 'F2051'] 
→ Set {'F2051', '1404516'} 
→ size = 2
```

**5. Calculate YTD (Year-to-Date)**
```javascript
const ytdData = filtered.filter(row => {
  const date = parseSheetDate(row[BILLING_DATE_COL]);
  if (!date) return false;
  
  return date.getFullYear() === year &&      // Same year
         date.getMonth() + 1 <= month;       // Up to and including current month
});
```

**Example:** If current month is October 2025:
- Include: January 1 - October 31, 2025
- Exclude: November 1+, 2025

**6. Monthly Total**
```javascript
const monthlyData = filtered.filter(row => {
  const date = parseSheetDate(row[BILLING_DATE_COL]);
  if (!date) return false;
  
  return date.getFullYear() === year &&
         date.getMonth() + 1 === month;
         // No day restriction = entire month
});
```

**7. Yearly Total**
```javascript
const yearlyData = filtered.filter(row => {
  const date = parseSheetDate(row[BILLING_DATE_COL]);
  if (!date) return false;
  
  return date.getFullYear() === year;
  // No month restriction = entire year
});
```

**Return object:**
```javascript
return {
  mtd: { amount: mtdAmount, customers: mtdCustomers },
  ytd: { amount: ytdAmount, customers: ytdCustomers },
  monthly: { amount: monthlyAmount, customers: monthlyCustomers },
  yearly: { amount: yearlyAmount, customers: yearlyCustomers }
};
```

---

##### `calculateOrdersMetrics(ordersData, customerCodes, year, month, day)`
**What it does:**
- Same as `calculateInvoicedMetrics` but for orders data

**Column Mappings:**
```javascript
const CUSTOMER_CODE_COL = 'Bill-To Party'; // Column B in sheets
const GROSS_VALUE_COL = 'Gross value';      // Column I in sheets
const DOCUMENT_DATE_COL = 'Document Date';  // Column D in sheets
```

**Logic:**
- Identical to invoiced metrics
- Just different column names
- Uses orders sheet instead of sales sheet

---

##### `calculateAllKPIs(sheetsData, customerCodes)`
**What it does:**
- Main function that calculates all KPIs for both years

**Flow:**
```javascript
export function calculateAllKPIs(sheetsData, customerCodes) {
  // 1. Get current date info
  const now = new Date();
  const currentYear = now.getFullYear();      // 2025
  const currentMonth = now.getMonth() + 1;    // 10 (October)
  const currentDay = now.getDate();           // 31
  
  // 2. Calculate 2025 metrics
  const invoiced2025 = calculateInvoicedMetrics(
    sheetsData.sales2025,    // 2025 sales data
    customerCodes,           // Filtered customer list
    2025,                    // Year
    currentMonth,            // Current month (10)
    currentDay               // Current day (31)
  );
  
  const orders2025 = calculateOrdersMetrics(
    sheetsData.orders2025,
    customerCodes,
    2025,
    currentMonth,
    currentDay
  );
  
  // 3. Calculate 2024 metrics (SAME month/day for comparison)
  const invoiced2024 = calculateInvoicedMetrics(
    sheetsData.sales2024,    // 2024 sales data
    customerCodes,
    2024,                    // Last year
    currentMonth,            // Same month (10)
    currentDay               // Same day (31)
  );
  
  const orders2024 = calculateOrdersMetrics(
    sheetsData.orders2024,
    customerCodes,
    2024,
    currentMonth,
    currentDay
  );
  
  // 4. Combine into final structure
  return {
    invoiced: {
      mtd2025: invoiced2025.mtd,
      mtd2024: invoiced2024.mtd,
      ytd2025: invoiced2025.ytd,
      ytd2024: invoiced2024.ytd,
      monthly2025: invoiced2025.monthly,
      monthly2024: invoiced2024.monthly,
      yearly2025: invoiced2025.yearly,
      yearly2024: invoiced2024.yearly
    },
    orders: {
      mtd2025: orders2025.mtd,
      mtd2024: orders2024.mtd,
      ytd2025: orders2025.ytd,
      ytd2024: orders2024.ytd,
      monthly2025: orders2025.monthly,
      monthly2024: orders2024.monthly,
      yearly2025: orders2025.yearly,
      yearly2024: orders2024.yearly
    }
  };
}
```

**Output structure:**
```javascript
{
  invoiced: {
    mtd2025: { amount: 65526.06, customers: 1 },
    mtd2024: { amount: 108945.03, customers: 1 },
    ytd2025: { amount: 932603.52, customers: 96 },
    ytd2024: { amount: 1758594.10, customers: 139 },
    // ... etc
  },
  orders: {
    // Same structure
  }
}
```

---

##### `getCustomerSalesSummary(sheetsData, customerCodes)`
**What it does:**
- Creates detailed summary for each customer with balance

**Column Mappings:**
```javascript
// Sales sheet
const SALES_CUSTOMER_CODE = 'Payer';
const SALES_CUSTOMER_NAME = 'Name Payer';
const SALES_REVENUE = 'Sales revenue';
const BILLING_DATE = 'Billing Date';

// Balance sheet
const BALANCE_CUSTOMER_CODE = 'Customer';
const BALANCE_CUSTOMER_NAME = 'Name';
const BALANCE_AMOUNT = 'Balance';
```

**Logic:**

**1. Filter sales data**
```javascript
const salesFiltered = filterByCustomers(
  sheetsData.sales2025,
  customerCodes,
  SALES_CUSTOMER_CODE
);
```

**2. Group by customer using Map**
```javascript
const customerMap = new Map();

salesFiltered.forEach(row => {
  const code = row[SALES_CUSTOMER_CODE]?.toString().trim();
  const name = row[SALES_CUSTOMER_NAME]?.toString().trim();
  const amount = parseFloat(row[SALES_REVENUE]?.replace(/,/g, '') || 0);
  const date = parseSheetDate(row[BILLING_DATE]);
  
  // Create customer entry if doesn't exist
  if (!customerMap.has(code)) {
    customerMap.set(code, {
      code,
      name,
      totalInvoiced: 0,
      invoiceCount: 0,
      lastInvoiceDate: null,
      balance: 0
    });
  }
  
  // Update aggregates
  const customer = customerMap.get(code);
  customer.totalInvoiced += amount;        // Add to total
  customer.invoiceCount++;                  // Increment count
  
  // Track most recent invoice date
  if (date && (!customer.lastInvoiceDate || date > customer.lastInvoiceDate)) {
    customer.lastInvoiceDate = date;
  }
});
```

**Why Map?**
- Efficient lookups: O(1) to check if customer exists
- Easy to update existing entries
- Maintains insertion order

**3. Add balance data**
```javascript
sheetsData.balance2025.forEach(row => {
  const code = row[BALANCE_CUSTOMER_CODE]?.toString().trim();
  
  if (customerMap.has(code)) {
    const balance = parseFloat(row[BALANCE_AMOUNT]?.replace(/,/g, '') || 0);
    customerMap.get(code).balance = balance;
  }
});
```

**4. Convert Map to Array**
```javascript
return Array.from(customerMap.values());
```

**Output:**
```javascript
[
  {
    code: 'F2051',
    name: 'FUNPARK - PLAYMOBIL HELLAS S.A.',
    totalInvoiced: 64872.45,
    invoiceCount: 96,
    lastInvoiceDate: Date(2025, 9, 29),
    balance: 5420.30
  },
  {
    code: '1404516',
    name: 'ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ',
    totalInvoiced: 4778.72,
    invoiceCount: 6,
    lastInvoiceDate: Date(2025, 8, 11),
    balance: -850.00
  }
]
```

---

### 3. `customerService.js` - Firestore Customer Service

#### Purpose
Queries Firestore `customers` collection to get customers assigned to specific salesman/salesmen.

#### Key Functions

##### `getCustomersBySalesman(db, salesmanId)`
**What it does:**
- Gets all customers where `merch` field equals the salesman ID

**Code explanation:**
```javascript
export async function getCustomersBySalesman(db, salesmanId) {
  try {
    const customersRef = collection(db, 'customers');
    // Get reference to 'customers' collection
    
    // Create query: WHERE merch == salesmanId
    // Note: Using '==' because merch is a SINGLE value, not array
    const q = query(customersRef, where('merch', '==', salesmanId));
    
    // Execute query
    const snapshot = await getDocs(q);
    
    // Convert snapshots to array of objects
    const customers = [];
    snapshot.forEach(doc => {
      customers.push({
        code: doc.id,  // Document ID = customer code
        ...doc.data()  // Spread other fields (name, merch, etc.)
      });
    });
    
    console.log(`Found ${customers.length} customers for salesman ${salesmanId}`);
    return customers;
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
}
```

**Firestore query translation:**
```sql
-- SQL equivalent:
SELECT * FROM customers WHERE merch = 'SALESMAN_ID';
```

**Return example:**
```javascript
[
  { 
    code: 'F2051', 
    name: 'FUNPARK - PLAYMOBIL HELLAS S.A.', 
    merch: 'SALESMAN_1' 
  },
  { 
    code: '1404516', 
    name: 'ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ', 
    merch: 'SALESMAN_1' 
  }
]
```

---

##### `getCustomersForSalesmen(db, salesmanIds)`
**What it does:**
- Gets customers for multiple salesmen (with deduplication)

**Why needed?**
- User might be linked to multiple salesmen
- Need to aggregate all their customers
- Avoid counting same customer twice

**Code explanation:**
```javascript
export async function getCustomersForSalesmen(db, salesmanIds) {
  try {
    const allCustomers = [];
    const customerCodesSet = new Set(); // Track unique codes
    
    // Loop through each salesman
    for (const salesmanId of salesmanIds) {
      const customers = await getCustomersBySalesman(db, salesmanId);
      
      // Add only unique customers
      customers.forEach(customer => {
        if (!customerCodesSet.has(customer.code)) {
          customerCodesSet.add(customer.code);    // Mark as seen
          allCustomers.push(customer);             // Add to results
        }
      });
    }
    
    console.log(`Found ${allCustomers.length} unique customers for ${salesmanIds.length} salesmen`);
    return allCustomers;
  } catch (error) {
    console.error('Error fetching customers for salesmen:', error);
    throw error;
  }
}
```

**Example scenario:**
```javascript
// User linked to 2 salesmen
salesmanIds = ['SALESMAN_1', 'SALESMAN_2'];

// SALESMAN_1 has: F2051, 1404516, 1403200
// SALESMAN_2 has: 1404516, 1402650

// Without deduplication: 5 customers
// With deduplication: 4 unique customers (1404516 counted once)
```

---

##### `getCustomerCodes(db, salesmanIds)`
**What it does:**
- Convenience function to get just the customer codes (not full objects)
- Used for filtering sheets data

**Code explanation:**
```javascript
export async function getCustomerCodes(db, salesmanIds) {
  try {
    // Handle both single ID and array of IDs
    const idsArray = Array.isArray(salesmanIds) ? salesmanIds : [salesmanIds];
    
    // Get full customer objects
    const customers = await getCustomersForSalesmen(db, idsArray);
    
    // Extract just the codes
    return customers.map(c => c.code);
  } catch (error) {
    console.error('Error fetching customer codes:', error);
    throw error;
  }
}
```

**Input/Output examples:**
```javascript
// Input: Single ID
'SALESMAN_1'
// Output: ['F2051', '1404516', '1403200']

// Input: Array of IDs
['SALESMAN_1', 'SALESMAN_2']
// Output: ['F2051', '1404516', '1403200', '1402650']
```

---

## React Components Explained

### 1. `PlaymobilKPIDashboard.jsx`

#### Purpose
Displays KPI metrics in card format with trend indicators and year-over-year comparisons.

#### Component Structure

```javascript
const PlaymobilKPIDashboard = ({ kpiData }) => {
  // Props: kpiData object from calculations
  
  // Helper functions
  const formatCurrency = (amount) => { ... }
  const formatNumber = (num) => { ... }
  const calculateChange = (current, previous) => { ... }
  
  // Sub-component for individual KPI cards
  const KPICard = ({ title, current, previous, type, period }) => { ... }
  
  // Section header component
  const SectionHeader = ({ icon: Icon, title }) => { ... }
  
  // Main render
  return (
    <div>
      {/* Header */}
      {/* Invoiced Metrics Section */}
      {/* Orders Metrics Section */}
    </div>
  );
};
```

---

#### Key Functions Explained

##### `formatCurrency(amount)`
**What it does:**
- Converts number to EUR currency format with Greek locale

**Code:**
```javascript
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(amount);
};
```

**Examples:**
```javascript
formatCurrency(1234.56)    // "1.234,56 €"
formatCurrency(1000000)    // "1.000.000,00 €"
formatCurrency(-500.50)    // "-500,50 €"
```

**Why 'el-GR'?**
- Greek locale uses: period for thousands, comma for decimals
- en-US would show: "1,234.56" (wrong for Greece)
- el-GR shows: "1.234,56" (correct for Greece)

---

##### `formatNumber(num)`
**What it does:**
- Formats numbers with thousands separator (no currency symbol)

**Code:**
```javascript
const formatNumber = (num) => {
  return new Intl.NumberFormat('el-GR').format(num);
};
```

**Examples:**
```javascript
formatNumber(1234)      // "1.234"
formatNumber(1000000)   // "1.000.000"
```

---

##### `calculateChange(current, previous)`
**What it does:**
- Calculates absolute and percentage change between two values

**Code:**
```javascript
const calculateChange = (current, previous) => {
  if (previous === 0) return { absolute: current, percentage: 100 };
  // Handle division by zero
  
  const absolute = current - previous;
  const percentage = ((absolute / previous) * 100);
  
  return { absolute, percentage };
};
```

**Examples:**
```javascript
// Current: 1200, Previous: 1000
calculateChange(1200, 1000)
// Returns: { absolute: 200, percentage: 20 }

// Current: 800, Previous: 1000
calculateChange(800, 1000)
// Returns: { absolute: -200, percentage: -20 }

// Current: 500, Previous: 0
calculateChange(500, 0)
// Returns: { absolute: 500, percentage: 100 }
```

**Formula explanation:**
```
Absolute change = Current - Previous
Percentage change = (Absolute change / Previous) × 100

Example:
Current: €1,200
Previous: €1,000
Absolute: €1,200 - €1,000 = €200
Percentage: (€200 / €1,000) × 100 = 20%
```

---

##### `KPICard` Component
**What it does:**
- Displays a single KPI metric with comparison

**Props:**
- `title`: Card title (e.g., "Invoiced Amount (MTD)")
- `current`: Current year data `{ amount: X, customers: Y }`
- `previous`: Previous year data `{ amount: X, customers: Y }`
- `type`: 'amount' or 'customers'
- `period`: 'MTD', 'YTD', 'Monthly', 'Yearly'

**Code:**
```javascript
const KPICard = ({ title, current, previous, type, period }) => {
  // 1. Calculate the change
  const change = calculateChange(
    type === 'amount' ? current.amount : current.customers,
    type === 'amount' ? previous.amount : previous.customers
  );
  
  // 2. Determine if positive or negative
  const isPositive = change.absolute >= 0;
  
  // 3. Choose icon based on type
  const Icon = type === 'amount' ? DollarSign : Users;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <Icon className="w-5 h-5 text-blue-500" />
      </div>
      
      <div className="space-y-3">
        {/* Current Value */}
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {type === 'amount' 
              ? formatCurrency(current.amount) 
              : formatNumber(current.customers)
            }
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {currentYear} ({period})
          </p>
        </div>

        {/* Previous Year & Comparison */}
        <div className="border-t pt-3">
          <p className="text-sm text-gray-600">
            Previous Year: {
              type === 'amount' 
                ? formatCurrency(previous.amount) 
                : formatNumber(previous.customers)
            }
          </p>
          
          {/* Trend Indicator */}
          <div className={`flex items-center mt-2 ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive 
              ? <TrendingUp className="w-4 h-4 mr-1" /> 
              : <TrendingDown className="w-4 h-4 mr-1" />
            }
            <span className="text-sm font-semibold">
              {type === 'amount' 
                ? formatCurrency(Math.abs(change.absolute)) 
                : formatNumber(Math.abs(change.absolute))
              }
            </span>
            <span className="text-sm ml-2">
              ({isPositive ? '+' : ''}{change.percentage.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Visual breakdown:**
```
┌─────────────────────────────────────┐
│ Invoiced Amount (MTD)           💰  │ ← Header with icon
├─────────────────────────────────────┤
│                                      │
│ €65,526.06                          │ ← Current value (big & bold)
│ 2025 (MTD)                          │ ← Year & period label
│ ─────────────────────────────────── │
│ Previous Year: €108,945.03          │ ← Previous year value
│ ↓ €43,418.97 (-39.9%)              │ ← Trend (red = down)
│                                      │
└─────────────────────────────────────┘
```

**Color logic:**
- **Green** (positive): Current > Previous
- **Red** (negative): Current < Previous
- Applies to both text and icon

---

#### Main Layout Structure

```javascript
return (
  <div className="min-h-screen bg-gray-50 p-6">
    <div className="max-w-7xl mx-auto">
      
      {/* PAGE HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Playmobil KPI Dashboard
        </h1>
        <p className="text-gray-600">
          Performance metrics as of {currentDate}/{currentMonth}/{currentYear}
        </p>
      </div>

      {/* INVOICED SECTION */}
      <div className="mb-12">
        <SectionHeader icon={DollarSign} title="Invoiced Performance" />
        
        {/* Month to Date */}
        <div className="mb-6">
          <h3>Month to Date (October 1-31)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KPICard
              title="Invoiced Amount (MTD)"
              current={kpiData.invoiced.mtd2025}
              previous={kpiData.invoiced.mtd2024}
              type="amount"
              period="MTD"
            />
            <KPICard
              title="Invoiced Customers (MTD)"
              current={kpiData.invoiced.mtd2025}
              previous={kpiData.invoiced.mtd2024}
              type="customers"
              period="MTD"
            />
          </div>
        </div>

        {/* Year to Date */}
        <div className="mb-6">
          <h3>Year to Date (January-October)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* YTD amount card */}
            {/* YTD customers card */}
          </div>
        </div>

        {/* Monthly & Yearly Totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Monthly total cards */}
          {/* Yearly total cards */}
        </div>
      </div>

      {/* ORDERS SECTION */}
      <div className="mb-12">
        <SectionHeader icon={ShoppingCart} title="Orders Performance" />
        {/* Same structure as invoiced section */}
      </div>
      
    </div>
  </div>
);
```

**Grid system:**
- Uses Tailwind CSS grid
- `grid-cols-1`: 1 column on mobile
- `md:grid-cols-2`: 2 columns on medium+ screens
- `gap-6`: 24px spacing between cards

---

#### Props Expected

**Input prop structure:**
```javascript
kpiData = {
  invoiced: {
    mtd2025: { amount: 65526.06, customers: 1 },
    mtd2024: { amount: 108945.03, customers: 1 },
    ytd2025: { amount: 932603.52, customers: 96 },
    ytd2024: { amount: 1758594.10, customers: 139 },
    monthly2025: { amount: 65526.06, customers: 1 },
    monthly2024: { amount: 108945.03, customers: 1 },
    yearly2025: { amount: 932603.52, customers: 96 },
    yearly2024: { amount: 1758594.10, customers: 139 }
  },
  orders: {
    // Same structure as invoiced
  }
};
```

---

### 2. `CustomerSalesSummary.jsx`

#### Purpose
Displays detailed customer information in a sortable, searchable table with summary cards.

#### Component Structure

```javascript
const CustomerSalesSummary = ({ customers }) => {
  // Props: customers array from getCustomerSalesSummary()
  
  // State for search and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('totalInvoiced');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Helper functions
  const formatCurrency = (amount) => { ... }
  const formatDate = (date) => { ... }
  const handleSort = (field) => { ... }
  
  // Filtering and sorting logic
  const filteredAndSortedCustomers = customers
    .filter(...)
    .sort(...);
  
  // Calculate totals
  const totalInvoiced = customers.reduce(...);
  const totalBalance = customers.reduce(...);
  const totalInvoices = customers.reduce(...);
  
  return (
    <div>
      {/* Header */}
      {/* Summary Cards */}
      {/* Search Bar */}
      {/* Customer Table */}
    </div>
  );
};
```

---

#### Key Functions Explained

##### `handleSort(field)`
**What it does:**
- Manages sorting state (which column, ascending/descending)

**Code:**
```javascript
const handleSort = (field) => {
  if (sortBy === field) {
    // Same column clicked - toggle order
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  } else {
    // New column clicked - set descending by default
    setSortBy(field);
    setSortOrder('desc');
  }
};
```

**Example flow:**
```
Initial: sortBy='totalInvoiced', sortOrder='desc'

User clicks 'totalInvoiced' column:
→ Toggle: sortOrder='asc'

User clicks 'name' column:
→ Change: sortBy='name', sortOrder='desc'

User clicks 'name' again:
→ Toggle: sortOrder='asc'
```

---

##### `filteredAndSortedCustomers`
**What it does:**
- Applies search filter and sorting to customers array

**Code:**
```javascript
const filteredAndSortedCustomers = customers
  .filter(customer => 
    // Search in both name and code (case-insensitive)
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.code.toLowerCase().includes(searchTerm.toLowerCase())
  )
  .sort((a, b) => {
    // Get values to compare
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    // Special handling for name (case-insensitive)
    if (sortBy === 'name') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    // Apply sort order
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;  // Ascending
    } else {
      return aVal < bVal ? 1 : -1;  // Descending
    }
  });
```

**Filter logic:**
```javascript
// User types "funpark"
searchTerm = "funpark"

// Check each customer
customer.name = "FUNPARK - PLAYMOBIL HELLAS S.A."
→ "funpark - playmobil hellas s.a.".includes("funpark") = true ✓

customer.name = "ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ"
→ "ανανιαδου αναστασια & σια οε".includes("funpark") = false ✗
```

**Sort logic:**
```javascript
// sortBy = 'totalInvoiced', sortOrder = 'desc'

Customers:
A: totalInvoiced = 1000
B: totalInvoiced = 2000
C: totalInvoiced = 500

Descending sort (highest first):
2000 > 1000 > 500
Result: [B, A, C]

Ascending sort (lowest first):
500 < 1000 < 2000
Result: [C, A, B]
```

---

##### Summary Card Calculations
**What it does:**
- Calculates aggregate totals across all customers

**Code:**
```javascript
// Total invoiced amount
const totalInvoiced = customers.reduce((sum, c) => sum + c.totalInvoiced, 0);
// Start with 0, add each customer's totalInvoiced

// Total balance (can be negative)
const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);

// Total number of invoices
const totalInvoices = customers.reduce((sum, c) => sum + c.invoiceCount, 0);
```

**Example:**
```javascript
customers = [
  { totalInvoiced: 1000, balance: 500, invoiceCount: 10 },
  { totalInvoiced: 2000, balance: -200, invoiceCount: 15 },
  { totalInvoiced: 1500, balance: 300, invoiceCount: 8 }
];

totalInvoiced = 1000 + 2000 + 1500 = 4500
totalBalance = 500 + (-200) + 300 = 600
totalInvoices = 10 + 15 + 8 = 33
```

---

#### Table Structure

```javascript
<table className="min-w-full divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <tr>
      {/* Each column header is clickable for sorting */}
      <th onClick={() => handleSort('code')}>
        Code {sortBy === 'code' && (sortOrder === 'asc' ? '↑' : '↓')}
      </th>
      <th onClick={() => handleSort('name')}>
        Customer Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
      </th>
      <th onClick={() => handleSort('totalInvoiced')}>
        Total Invoiced
      </th>
      <th onClick={() => handleSort('invoiceCount')}>
        Invoices
      </th>
      <th onClick={() => handleSort('balance')}>
        Balance
      </th>
      <th onClick={() => handleSort('lastInvoiceDate')}>
        Last Invoice
      </th>
    </tr>
  </thead>
  
  <tbody className="bg-white divide-y divide-gray-200">
    {filteredAndSortedCustomers.map((customer) => (
      <tr key={customer.code} className="hover:bg-gray-50">
        <td>{customer.code}</td>
        <td>{customer.name}</td>
        <td>{formatCurrency(customer.totalInvoiced)}</td>
        <td>{customer.invoiceCount}</td>
        <td className={customer.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
          {formatCurrency(customer.balance)}
        </td>
        <td>{formatDate(customer.lastInvoiceDate)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

**Balance color logic:**
```javascript
// Positive balance (customer owes money) = Green
customer.balance = 5420.30 → className="text-green-600"

// Negative balance (we owe customer) = Red
customer.balance = -850.00 → className="text-red-600"

// Zero balance = Green (default)
customer.balance = 0 → className="text-green-600"
```

---

#### Props Expected

**Input prop structure:**
```javascript
customers = [
  {
    code: 'F2051',
    name: 'FUNPARK - PLAYMOBIL HELLAS S.A.',
    totalInvoiced: 64872.45,
    invoiceCount: 96,
    lastInvoiceDate: Date(2025, 9, 29),
    balance: 5420.30
  },
  {
    code: '1404516',
    name: 'ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ',
    totalInvoiced: 4778.72,
    invoiceCount: 6,
    lastInvoiceDate: Date(2025, 8, 11),
    balance: -850.00
  }
  // ... more customers
];
```

---

## Integration Points

### Critical Keys & Field Names That Must Align

#### 1. Firestore Collection: `customers`

**Collection name:** `customers` (hardcoded in `customerService.js`)

**Document structure:**
```javascript
{
  // Document ID = Customer Code (MUST match Google Sheets)
  "F2051": {
    "name": "FUNPARK - PLAYMOBIL HELLAS S.A.",
    "merch": "SALESMAN_ID_HERE",  // ← CRITICAL: Single string value
    // ... other fields
  }
}
```

**Why document ID is important:**
```javascript
// In customerService.js
snapshot.forEach(doc => {
  customers.push({
    code: doc.id,  // ← Uses document ID as customer code
    ...doc.data()
  });
});
```

**Alignment requirement:**
- Firestore document ID = Google Sheets customer code
- Example: If sheets have "F2051", Firestore document must be ID "F2051"

---

#### 2. Firestore Collection: `sheetsCache`

**Collection name:** `sheetsCache` (defined as constant)

**Document IDs (exact strings):**
- `sales2025`
- `orders2025`
- `balance2025`
- `sales2024`
- `orders2024`

**Document structure:**
```javascript
{
  "sales2025": {  // ← Document ID must match sheetKey
    "data": [...],              // Array of parsed CSV objects
    "timestamp": Timestamp,     // Firestore server timestamp
    "sheetKey": "sales2025"    // Must match document ID
  }
}
```

**Where used:**
```javascript
// In googleSheetsCache.js
const CACHE_COLLECTION = 'sheetsCache';  // ← Must match your Firestore

// Document references
doc(db, CACHE_COLLECTION, 'sales2025')
doc(db, CACHE_COLLECTION, 'orders2025')
// etc.
```

---

#### 3. Google Sheets Column Names

**CRITICAL:** These exact column names must exist in your sheets.

**D_monthly sls sheet (Sales):**
```javascript
// From kpiCalculations.js
const CUSTOMER_CODE_COL = 'Payer';        // Column M
const SALES_REVENUE_COL = 'Sales revenue'; // Column F
const BILLING_DATE_COL = 'Billing Date';   // Column N
const CUSTOMER_NAME_COL = 'Name Payer';    // Column L
```

**D_total incom.orders sheet (Orders):**
```javascript
// From kpiCalculations.js
const CUSTOMER_CODE_COL = 'Bill-To Party'; // Column B
const GROSS_VALUE_COL = 'Gross value';      // Column I
const DOCUMENT_DATE_COL = 'Document Date';  // Column D
const CUSTOMER_NAME_COL = 'Name bill-to';   // Column C
```

**D_cust.balance sheet (Balance):**
```javascript
// From kpiCalculations.js
const BALANCE_CUSTOMER_CODE = 'Customer';  // Customer code column
const BALANCE_CUSTOMER_NAME = 'Name';      // Customer name column
const BALANCE_AMOUNT = 'Balance';          // Balance amount column
```

**If column names are different in your sheets:**
```javascript
// You MUST update these constants in kpiCalculations.js

// Example: If your sheets use "CustomerCode" instead of "Payer"
const CUSTOMER_CODE_COL = 'CustomerCode';  // ← Change this

// Example: If your sheets use "Total" instead of "Sales revenue"
const SALES_REVENUE_COL = 'Total';  // ← Change this
```

---

#### 4. User Authentication Fields

**Where salesman IDs come from:**

**Option A: User document in Firestore**
```javascript
// Collection: users
{
  "USER_ID": {
    "email": "user@example.com",
    "salesmanIds": ["SALESMAN_1"],  // ← Must align with customers.merch
    // OR
    "salesmanId": "SALESMAN_1",     // ← Single value alternative
  }
}
```

**Option B: Custom claims (Firebase Auth)**
```javascript
// Set by admin (backend)
{
  "salesmanIds": ["SALESMAN_1"]  // ← Must align with customers.merch
}
```

**In your hook (`usePlaymobilData.js`):**
```javascript
// YOU MUST IMPLEMENT THIS PART:
const salesmanIds = user.salesmanIds || [user.uid];
// ↑ Change this line to match YOUR user data structure

// Examples:
// If stored in Firestore user document:
const userDoc = await getDoc(doc(db, 'users', user.uid));
const salesmanIds = userDoc.data().salesmanIds;

// If stored in custom claims:
const idTokenResult = await user.getIdTokenResult();
const salesmanIds = idTokenResult.claims.salesmanIds;

// If single value (not array):
const salesmanIds = [userDoc.data().salesmanId]; // Wrap in array
```

---

#### 5. Date Format Alignment

**Google Sheets date format MUST be:** `M/D/YYYY`

**Examples:**
- ✅ `10/31/2025` (October 31, 2025)
- ✅ `1/5/2025` (January 5, 2025)
- ❌ `31/10/2025` (D/M/YYYY - wrong!)
- ❌ `2025-10-31` (ISO format - wrong!)

**Why this matters:**
```javascript
// parseSheetDate() expects M/D/YYYY
const parts = dateString.split('/'); // ["10", "31", "2025"]
const month = parseInt(parts[0], 10); // 10 = October
const day = parseInt(parts[1], 10);   // 31
const year = parseInt(parts[2], 10);  // 2025
```

**If your sheets use different format:**
You must modify `parseSheetDate()` in `kpiCalculations.js`

```javascript
// For D/M/YYYY format:
function parseSheetDate(dateString) {
  const parts = dateString.split('/');
  const day = parseInt(parts[0], 10);    // ← Swap these
  const month = parseInt(parts[1], 10);  // ← Swap these
  const year = parseInt(parts[2], 10);
  return new Date(year, month - 1, day);
}

// For ISO format (YYYY-MM-DD):
function parseSheetDate(dateString) {
  return new Date(dateString); // JavaScript handles ISO natively
}
```

---

## Database Schema & Keys

### Complete Firestore Structure

```
firestore/
├── customers/                    ← Query by 'merch' field
│   ├── F2051                    ← Document ID = Customer Code
│   │   ├── name: "FUNPARK..."
│   │   ├── merch: "SALESMAN_1"  ← Single string (not array)
│   │   └── ... other fields
│   │
│   ├── 1404516
│   │   ├── name: "ΑΝΑΝΙΑΔΟΥ..."
│   │   ├── merch: "SALESMAN_1"
│   │   └── ... other fields
│   │
│   └── ... more customers
│
├── sheetsCache/                  ← Auto-created by caching service
│   ├── sales2025                ← Document ID (exact string)
│   │   ├── data: [...]          ← Parsed CSV array
│   │   ├── timestamp: Timestamp
│   │   └── sheetKey: "sales2025"
│   │
│   ├── orders2025
│   │   ├── data: [...]
│   │   ├── timestamp: Timestamp
│   │   └── sheetKey: "orders2025"
│   │
│   ├── balance2025
│   ├── sales2024
│   └── orders2024
│
└── users/                        ← Optional (for salesman IDs)
    └── USER_UID
        ├── email: "..."
        ├── salesmanIds: ["SALESMAN_1"]  ← Must match merch values
        └── ... other fields
```

---

### Key Alignment Checklist

**Before running the app, verify:**

- [ ] Firestore `customers` collection exists
- [ ] Customer document IDs match Google Sheets customer codes exactly
- [ ] All customers have `merch` field (single string value)
- [ ] `merch` values match the salesman IDs in user profiles
- [ ] Google Sheets are published as CSV
- [ ] CSV URLs are updated in `googleSheetsCache.js`
- [ ] Column names in sheets match constants in `kpiCalculations.js`
- [ ] Dates in sheets are in M/D/YYYY format
- [ ] User authentication provides salesman ID(s)
- [ ] Firestore security rules allow reading `customers` and `sheetsCache`

---

## Configuration Requirements

### 1. Environment/Configuration File

Create a config file for easy updates:

```javascript
// config/playmobil.js

export const PLAYMOBIL_CONFIG = {
  // Firestore collection names
  collections: {
    customers: 'customers',
    sheetsCache: 'sheetsCache',
    users: 'users'  // If storing salesman IDs here
  },
  
  // Google Sheets CSV URLs
  sheetUrls: {
    sales2025: 'YOUR_CSV_URL',
    orders2025: 'YOUR_CSV_URL',
    balance2025: 'YOUR_CSV_URL',
    sales2024: 'YOUR_CSV_URL',
    orders2024: 'YOUR_CSV_URL'
  },
  
  // Column name mappings (if different from default)
  columnNames: {
    sales: {
      customerCode: 'Payer',
      customerName: 'Name Payer',
      revenue: 'Sales revenue',
      billingDate: 'Billing Date'
    },
    orders: {
      customerCode: 'Bill-To Party',
      customerName: 'Name bill-to',
      grossValue: 'Gross value',
      documentDate: 'Document Date'
    },
    balance: {
      customerCode: 'Customer',
      customerName: 'Name',
      balance: 'Balance'
    }
  },
  
  // Cache settings
  cache: {
    durationHours: 24
  }
};
```

Then import in service files:
```javascript
import { PLAYMOBIL_CONFIG } from '../config/playmobil';

const SHEET_URLS = PLAYMOBIL_CONFIG.sheetUrls;
const CACHE_COLLECTION = PLAYMOBIL_CONFIG.collections.sheetsCache;
```

---

### 2. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Customers collection - read only
    match /customers/{customerId} {
      // Any authenticated user can read
      allow read: if request.auth != null;
      
      // Only admins can write (managed elsewhere)
      allow write: if false;
    }
    
    // Sheets cache - read/write for authenticated users
    match /sheetsCache/{sheetId} {
      // Allow authenticated users to read cache
      allow read: if request.auth != null;
      
      // Allow authenticated users to write cache
      // (for the caching service to function)
      allow write: if request.auth != null;
    }
    
    // Users collection (if using for salesman IDs)
    match /users/{userId} {
      // Users can read their own document
      allow read: if request.auth.uid == userId;
      
      // Users cannot modify their own salesman assignments
      allow write: if false;
    }
  }
}
```

---

### 3. Firebase Indexes

**If queries are slow, create indexes:**

```javascript
// Firestore console → Indexes → Create index

Collection: customers
Fields:
  - merch (Ascending)
  - __name__ (Ascending)

// This optimizes the WHERE merch == 'X' query
```

---

##