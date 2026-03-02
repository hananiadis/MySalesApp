# Firestore Quota Optimization Guide

## Problem
Firestore has daily read quotas that can be exceeded when fetching large collections repeatedly. Every time you load data, you consume read operations from your quota.

## Solutions Implemented

### 1. **IndexedDB Local Caching** (`cacheService.js`)
Browser-based persistent storage that survives page reloads.

**How it works:**
- First load: Fetches from Firestore, saves to IndexedDB
- Subsequent loads: Reads from IndexedDB (0 Firestore reads!)
- Cache expires after configurable time (5 min - 24 hours)

**Benefits:**
- Dramatically reduces Firestore reads
- Works offline
- Faster load times
- Survives browser refresh

**Cache Durations:**
- **Orders**: 5 minutes (SHORT) - changes frequently
- **Products**: 24 hours (LONG) - rarely changes
- **Customers**: 24 hours (LONG) - rarely changes
- **Stock**: 5 minutes (SHORT) - changes frequently

### 2. **Incremental Fetching** (`optimizedFirestoreService.js`)
Only fetch data that changed since last sync.

**How it works:**
```javascript
// First fetch: Gets all orders from last 30 days
// Firestore reads: 150 documents

// Second fetch (5 minutes later): Only gets orders created in last 5 minutes
// Firestore reads: 2 documents

// Savings: 148 fewer reads!
```

**Implementation:**
- Tracks last sync timestamp in IndexedDB
- Uses Firestore `where('createdAt', '>=', lastSyncTime)` query
- Merges new data with cached data
- Updates last sync timestamp

### 3. **Aggressive React Query Caching**
Prevents unnecessary refetches.

**Configuration in `App.tsx`:**
```javascript
staleTime: 5 * 60 * 1000,       // Data fresh for 5 minutes
cacheTime: 30 * 60 * 1000,      // Keep in memory for 30 minutes
refetchOnWindowFocus: false,     // Don't refetch when switching tabs
refetchOnMount: false,           // Don't refetch when component remounts
refetchOnReconnect: false,       // Don't refetch when internet reconnects
```

**Benefits:**
- Switching between screens: 0 Firestore reads
- Clicking browser refresh: Uses cache if data is fresh
- Opening multiple tabs: Shares cache

### 4. **Configurable Date Range Loading**
Load only recent orders, not entire history.

**UI Controls:**
- "Load Orders From Last 7/30/60/90/180 days"
- Default: 30 days
- Fewer days = fewer Firestore reads

**Example Savings:**
- 180 days: 1,000 orders = 1,000 reads
- 30 days: 150 orders = 150 reads
- **Savings: 850 reads per load!**

### 5. **Query Optimization**
Smart Firestore queries that minimize reads.

**Techniques:**
- `limit()` - Cap maximum documents fetched
- `where()` - Filter on server side
- `orderBy()` + `startAfter()` - Pagination support
- Status-specific queries - Only fetch pending/packing orders

**Example:**
```javascript
// ❌ BAD: Fetches ALL orders
getDocs(collection(db, 'orders_kivos'))

// ✅ GOOD: Fetches only last 30 days, max 500
query(
  ordersRef,
  where('createdAt', '>=', thirtyDaysAgo),
  orderBy('createdAt', 'desc'),
  limit(500)
)
```

## How to Use

### Orders List Screen
1. **First Load**: Fetches from Firestore and caches locally
2. **Refresh Page**: Uses cached data (0 reads!)
3. **Change Days Filter**: Fetches only needed date range
4. **Click "🔄 Refresh"**: Force fetch from Firestore
5. **Wait 5 Minutes**: Automatic incremental fetch gets only new orders

### Manual Cache Clear
If you need to force refresh all data:

```javascript
import { clearAllCaches } from './services/cacheService';

// In browser console or debug screen
await clearAllCaches();
```

### Monitor Cache Performance
Check browser console for cache logs:
- `📦 Orders loaded from cache` - Zero Firestore reads!
- `🔄 Fetching orders since: <date>` - Incremental fetch
- `✅ Fetched X orders from Firestore` - Actual reads used

## Best Practices

### For Developers

1. **Use Cached Services**
   ```javascript
   // ✅ GOOD: Uses caching
   import { fetchOrdersIncremental } from './services/optimizedFirestoreService';
   
   // ❌ BAD: Direct Firestore calls
   getDocs(collection(db, 'orders_kivos'))
   ```

2. **Configure React Query Properly**
   ```javascript
   useQuery(['orders'], fetchOrdersIncremental, {
     staleTime: 5 * 60 * 1000,  // 5 minutes
     cacheTime: 30 * 60 * 1000, // 30 minutes
   })
   ```

3. **Add Date Range Filters**
   ```javascript
   // Fetch recent data only
   fetchOrdersIncremental({ daysBack: 30 })
   ```

4. **Invalidate Cache on Mutations**
   ```javascript
   // After creating/updating order
   queryClient.invalidateQueries(['orders']);
   ```

### For Users

1. **Don't Refresh Unnecessarily**
   - Data auto-refreshes every 5 minutes
   - Use cached data when possible

2. **Use Date Range Filters**
   - Select "7 days" for quick overview
   - Select "180 days" only when needed

3. **Close Unused Tabs**
   - Each tab can trigger separate fetches
   - Keep only necessary tabs open

## Quota Savings Examples

### Scenario 1: Dashboard + Orders Screen
**Without Optimization:**
- Load dashboard: 1,500 reads (products + stock + orders)
- Load orders screen: 1,500 reads (same data, fetched again)
- Refresh page: 1,500 reads (fetched again)
- **Total: 4,500 reads**

**With Optimization:**
- First load: 1,500 reads + cached
- Orders screen: 0 reads (uses cache)
- Refresh page: 0 reads (cache still valid)
- After 5 min: 5 reads (only new orders)
- **Total: 1,505 reads (66% reduction!)**

### Scenario 2: Daily Usage
**Without Optimization:**
- 10 page loads × 1,500 reads = 15,000 reads/day

**With Optimization:**
- First load: 1,500 reads
- 9 subsequent loads: 0 reads (cache)
- 12 incremental syncs: 60 reads (5 new orders each)
- **Total: 1,560 reads/day (90% reduction!)**

## Monitoring Quota Usage

### Firebase Console
1. Go to Firebase Console → Firestore → Usage
2. Check "Document reads" graph
3. Compare usage before/after optimization

### Browser DevTools
1. Open Console (F12)
2. Look for cache logs:
   - `📦` = Cache hit (good!)
   - `🔄` = Firestore fetch (uses quota)
   - `✅` = Shows how many docs fetched

### In-App Monitoring
Check the info message in Orders List:
- "💡 ... Current: X orders loaded"
- "📦 Uses cached data when available to save Firestore quota"

## Troubleshooting

### Problem: Stale Data Showing
**Solution:** Click "🔄 Refresh from Server" button

### Problem: Cache Taking Up Space
**Solution:** 
```javascript
// Clear old cache data
await clearAllCaches();
```

### Problem: Still Hitting Quota
**Solutions:**
1. Reduce `daysBack` to 7 or 14 days
2. Increase `staleTime` to 10-15 minutes
3. Implement pagination (load 50 orders at a time)
4. Use status filters (only load pending orders)

### Problem: Need Real-Time Updates
**Note:** This optimization prioritizes quota over real-time.
For critical real-time needs, use Firestore listeners on specific documents only:
```javascript
// Real-time for ONE order
onSnapshot(doc(db, 'orders_kivos', orderId), ...)

// ❌ Don't use onSnapshot for collections!
```

## Future Enhancements

1. **Background Sync**: Use Service Workers for automatic background updates
2. **Pagination**: Load 50 orders at a time with "Load More" button
3. **Composite Indexes**: Optimize multi-field queries
4. **Firestore Bundle**: Pre-fetch common queries as bundles
5. **GraphQL Layer**: Deduplicate and batch requests

## Summary

✅ **Implemented:**
- IndexedDB caching with configurable expiration
- Incremental fetching (only new/changed data)
- React Query aggressive caching
- Date range filters to limit data scope
- Query optimization with limits and filters

📊 **Expected Savings:**
- 60-90% reduction in Firestore reads
- Faster page loads (instant cache hits)
- Better offline experience
- Lower Firebase costs

🎯 **Best for:**
- Large datasets (1000+ documents)
- Frequently accessed screens
- Mobile/slow connections
- Cost-conscious projects
- Read-heavy workloads

⚠️ **Trade-offs:**
- Slightly less real-time (5 min delay)
- Browser storage used (~10-50 MB)
- Complexity in cache invalidation
- Initial implementation time

## Resources

- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [React Query Documentation](https://react-query.tanstack.com/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## Required Indexes

Ensure these single-field indexes exist (they are enabled by default in most projects):

- `orders_kivos.firestoreUpdatedAt` (Ascending)
- `products_kivos.lastUpdated` (Ascending)
- `stock_kivos.lastUpdated` (Ascending)

If you disable automatic indexing, re-enable or add these in Firebase Console → Firestore → Indexes. No composite indexes are required for our current queries.
