# Playmobil KPI Dashboard - Complete Implementation Guide

## Overview
Complete solution with caching, KPI calculations, and customer sales summary.

---

## Architecture

```
User Login
    ↓
Get User's Salesman ID(s)
    ↓
Query Firestore: Get Customers (where merch == salesmanId)
    ↓
Get Customer Codes
    ↓
Get Sheets Data (from cache or fetch fresh)
    ↓
Filter by Customer Codes
    ↓
Calculate KPIs & Customer Summaries
    ↓
Display in Dashboard
```

---

## File Structure

```
src/
├── services/
│   ├── googleSheetsCache.js      # Caching service
│   ├── kpiCalculations.js        # KPI calculation logic
│   └── customerService.js        # Firestore customer queries
├── components/
│   ├── PlaymobilKPIDashboard.jsx # Main KPI dashboard
│   └── CustomerSalesSummary.jsx  # Customer detail screen
└── hooks/
    └── usePlaymobilData.js       # Custom hook (see below)
```

---

## Complete Implementation

### 1. Custom Hook for Data Management

```javascript
// hooks/usePlaymobilData.js
import { useState, useEffect } from 'react';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAllSheetsData } from '../services/googleSheetsCache';
import { getCustomerCodes } from '../services/customerService';
import { calculateAllKPIs, getCustomerSalesSummary } from '../services/kpiCalculations';

export function usePlaymobilData() {
  const [kpiData, setKpiData] = useState(null);
  const [customerSummary, setCustomerSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const db = getFirestore();
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user's salesman IDs from their profile
      // TODO: Adjust this based on your user data structure
      const salesmanIds = user.salesmanIds || [user.uid]; // Fallback to user ID

      // 1. Get customer codes from Firestore
      const customerCodes = await getCustomerCodes(db, salesmanIds);

      if (customerCodes.length === 0) {
        console.warn('No customers found for salesman');
        setKpiData({
          invoiced: {
            mtd2025: { amount: 0, customers: 0 },
            mtd2024: { amount: 0, customers: 0 },
            ytd2025: { amount: 0, customers: 0 },
            ytd2024: { amount: 0, customers: 0 },
            monthly2025: { amount: 0, customers: 0 },
            monthly2024: { amount: 0, customers: 0 },
            yearly2025: { amount: 0, customers: 0 },
            yearly2024: { amount: 0, customers: 0 }
          },
          orders: {
            mtd2025: { amount: 0, customers: 0 },
            mtd2024: { amount: 0, customers: 0 },
            ytd2025: { amount: 0, customers: 0 },
            ytd2024: { amount: 0, customers: 0 },
            monthly2025: { amount: 0, customers: 0 },
            monthly2024: { amount: 0, customers: 0 },
            yearly2025: { amount: 0, customers: 0 },
            yearly2024: { amount: 0, customers: 0 }
          }
        });
        setCustomerSummary([]);
        return;
      }

      // 2. Get cached or fresh sheets data
      const sheetsData = await getAllSheetsData(db);

      // 3. Calculate KPIs
      const kpis = calculateAllKPIs(sheetsData, customerCodes);
      setKpiData(kpis);

      // 4. Calculate customer summaries
      const summary = getCustomerSalesSummary(sheetsData, customerCodes);
      setCustomerSummary(summary);

    } catch (err) {
      console.error('Error loading Playmobil data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return {
    kpiData,
    customerSummary,
    loading,
    error,
    refresh: loadData
  };
}
```

### 2. Main App Integration

```javascript
// App.jsx or PlaymobilScreen.jsx
import React from 'react';
import { usePlaymobilData } from './hooks/usePlaymobilData';
import PlaymobilKPIDashboard from './components/PlaymobilKPIDashboard';
import CustomerSalesSummary from './components/CustomerSalesSummary';

function PlaymobilScreen() {
  const { kpiData, customerSummary, loading, error, refresh } = usePlaymobilData();
  const [activeTab, setActiveTab] = React.useState('kpis'); // 'kpis' or 'customers'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading Playmobil data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-xl text-red-600 mb-4">Error: {error}</div>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('kpis')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'kpis'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              KPI Dashboard
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'customers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Customer Sales Summary
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'kpis' && <PlaymobilKPIDashboard kpiData={kpiData} />}
      {activeTab === 'customers' && (
        <CustomerSalesSummary customers={customerSummary} />
      )}
    </div>
  );
}

export default PlaymobilScreen;
```

### 3. Update Dashboard Component to Use Props

```javascript
// Update PlaymobilKPIDashboard.jsx to accept kpiData as prop
const PlaymobilKPIDashboard = ({ kpiData }) => {
  // Remove useState for kpiData
  // Use the kpiData prop directly
  
  // Rest of the component stays the same
  // ...
};
```

### 4. Update Customer Summary to Use Props

```javascript
// Update CustomerSalesSummary.jsx to accept customers as prop
const CustomerSalesSummary = ({ customers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('totalInvoiced');
  const [sortOrder, setSortOrder] = useState('desc');

  // Remove loading state and useEffect
  // Use the customers prop directly
  
  // Rest of the component stays the same
  // ...
};
```

---

## Google Sheets Setup

### Step 1: Publish Sheets to Web

1. Open each Google Sheet
2. Go to: **File → Share → Publish to web**
3. Select the specific sheet (e.g., "D_monthly sls")
4. Choose format: **Comma-separated values (.csv)**
5. Click **Publish**
6. Copy the URL

### Step 2: Update URLs in Code

Replace the URLs in `googleSheetsCache.js`:

```javascript
const SHEET_URLS = {
  sales2025: 'YOUR_2025_SALES_CSV_URL',
  orders2025: 'YOUR_2025_ORDERS_CSV_URL',
  balance2025: 'YOUR_2025_BALANCE_CSV_URL',
  sales2024: 'YOUR_2024_SALES_CSV_URL',
  orders2024: 'YOUR_2024_ORDERS_CSV_URL'
};
```

**Important**: Make sure to publish ONLY the specific sheets, not the entire spreadsheet.

---

## Firestore Structure

### Collection: `customers`

```javascript
{
  // Document ID = Customer Code (e.g., "F2051", "1404516")
  "F2051": {
    "name": "FUNPARK - PLAYMOBIL HELLAS S.A.",
    "merch": "SALESMAN_ID_1",  // Single value, not array
    // ... other customer fields
  },
  "1404516": {
    "name": "ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ",
    "merch": "SALESMAN_ID_2",
    // ... other customer fields
  }
}
```

### Collection: `sheetsCache` (auto-created by caching service)

```javascript
{
  "sales2025": {
    "data": [...], // Parsed CSV data
    "timestamp": Timestamp,
    "sheetKey": "sales2025"
  },
  "orders2025": {
    "data": [...],
    "timestamp": Timestamp,
    "sheetKey": "orders2025"
  }
  // ... etc
}
```

---

## User Authentication Setup

### Option 1: Store Salesman IDs in User Profile

```javascript
// When creating user or updating profile
const userRef = doc(db, 'users', userId);
await setDoc(userRef, {
  email: user.email,
  salesmanIds: ['SALESMAN_ID_1'], // or multiple IDs
  // ... other user fields
}, { merge: true });

// Then in your hook, retrieve it:
const userDoc = await getDoc(doc(db, 'users', user.uid));
const salesmanIds = userDoc.data().salesmanIds;
```

### Option 2: Use Custom Claims

```javascript
// Set custom claims (admin SDK, backend only)
admin.auth().setCustomUserClaims(uid, {
  salesmanIds: ['SALESMAN_ID_1']
});

// Then in frontend:
const idTokenResult = await user.getIdTokenResult();
const salesmanIds = idTokenResult.claims.salesmanIds;
```

---

## Cache Management

### Manual Cache Refresh

Add a refresh button to force update:

```javascript
import { refreshAllCaches } from './services/googleSheetsCache';

async function handleRefresh() {
  const db = getFirestore();
  await refreshAllCaches(db);
  // Reload data
  refresh();
}
```

### Automatic Daily Refresh

Use Firebase Cloud Functions or Cloud Scheduler:

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.refreshSheetsCache = functions.pubsub
  .schedule('0 2 * * *') // Every day at 2 AM
  .onRun(async (context) => {
    const db = admin.firestore();
    
    // Delete old cache
    const cacheRefs = await db.collection('sheetsCache').listDocuments();
    await Promise.all(cacheRefs.map(ref => ref.delete()));
    
    console.log('Cache cleared, will refresh on next access');
    return null;
  });
```

---

## Testing Checklist

- [ ] User authentication works
- [ ] Customer codes retrieved from Firestore correctly
- [ ] Google Sheets CSV URLs are accessible
- [ ] Cache stores data in Firestore
- [ ] Cache expires after 24 hours
- [ ] KPIs calculate correctly for MTD, YTD, Monthly, Yearly
- [ ] Year-over-year comparisons show correct percentages
- [ ] Customer summary displays all fields correctly
- [ ] Sorting works in customer table
- [ ] Search filters customers correctly
- [ ] Balance displays with correct sign (positive/negative)
- [ ] Currency formatting shows EUR symbol
- [ ] Dates parse correctly from Google Sheets format
- [ ] Credit notes (negative amounts) are included
- [ ] No customers case handled gracefully
- [ ] Error states display properly
- [ ] Loading states show during data fetch

---

## Performance Optimization

1. **Cache Duration**: Adjust `CACHE_DURATION_HOURS` in `googleSheetsCache.js` based on your needs
2. **Firestore Indexes**: Create indexes if querying customers becomes slow
3. **Pagination**: Add pagination to customer table if many customers (100+)
4. **Lazy Loading**: Load customer summary only when tab is clicked
5. **Service Worker**: Cache static assets for faster loads

---

## Common Issues & Solutions

### Issue: "merch is not a field"
**Solution**: Ensure Firestore `customers` collection has `merch` field on all documents

### Issue: CSV parsing fails
**Solution**: Check that Google Sheets are published as CSV, not HTML or other format

### Issue: Dates showing as NaN
**Solution**: Verify date format in Google Sheets is M/D/YYYY (e.g., "10/31/2025")

### Issue: Cache not updating
**Solution**: Check Firestore rules allow write to `sheetsCache` collection

### Issue: KPIs show 0 for all values
**Solution**: Verify customer codes match exactly between Firestore and Google Sheets

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Customers - read only for authenticated users
    match /customers/{customerId} {
      allow read: if request.auth != null;
      allow write: if false; // Managed by admin only
    }
    
    // Sheets cache - allow read/write for authenticated users
    match /sheetsCache/{sheetId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

---

## Next Steps

1. Set up Google Sheets CSV export URLs
2. Create Firestore `customers` collection with proper structure
3. Add salesman IDs to user profiles
4. Deploy Firebase security rules
5. Test with real data
6. Add error monitoring (e.g., Sentry)
7. Set up automatic cache refresh (optional)

---

This implementation provides a complete, production-ready solution with caching, proper error handling, and clean separation of concerns.