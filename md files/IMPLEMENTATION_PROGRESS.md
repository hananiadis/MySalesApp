# Multi-Salesman Customer Implementation - Progress Report

## ✅ Completed Steps (Backend)

### 1. Configuration Updates
- ✅ Added `salesRep` and `partnerZM` to `playmobil.js` config columnNames.sales
- ✅ CSV parser automatically picks up new columns

### 2. Salesman Determination Logic
- ✅ Created `determineHandlingSalesman()` function in `playmobilKpi.js`
- ✅ Handles special case: `"ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ"` → uses `partnerZM` instead

### 3. Firestore Query Update
- ✅ Changed from `where('merch', 'in', batch)` to `where('merch', 'array-contains-any', batch)`
- ✅ Supports array-based merch field in customer documents

### 4. Transaction Data Enhancement
- ✅ Added `handledBy` field to all sales records during data loading
- ✅ Field is computed and stored when fetching fresh data from Google Sheets

### 5. Data Migration Tools
- ✅ Added `migrateCustomerMerchToArray()` function to firestoreManager
- ✅ Added `addSalesmanToCustomer()` helper function
- ✅ Updated `importPlaymobilCustomers()` to create merch as array
- ✅ Added menu options 5.4 and 5.5 for migration and salesman management

---

## 🔄 Next Steps (UI Implementation)

### 6. Customer Sales Summary Enhancement

Need to add revenue split display in `CustomerSalesSummary.js`:

#### A. Calculate Revenue Grouping by Salesman

Add helper function:
```javascript
const groupBySalesman = (transactions) => {
  const groups = {};
  
  transactions.forEach(txn => {
    const salesman = txn.handledBy || 'Unknown';
    if (!groups[salesman]) {
      groups[salesman] = {
        total: 0,
        count: 0,
        transactions: []
      };
    }
    groups[salesman].total += Number(txn.amount || txn.total || txn.value || 0);
    groups[salesman].count++;
    groups[salesman].transactions.push(txn);
  });
  
  return groups;
};
```

#### B. Display Revenue Split Summary

Add UI component to show split before transaction list:
```javascript
// Calculate splits
const salesBySalesman = groupBySalesman(currentYearRecords);
const totalRevenue = Object.values(salesBySalesman).reduce((sum, g) => sum + g.total, 0);

// Display splits
<View style={styles.revenueSplitSection}>
  <Text style={styles.splitTitle}>Revenue by Handling Salesman</Text>
  {Object.entries(salesBySalesman).map(([salesman, data]) => (
    <View key={salesman} style={styles.splitRow}>
      <Text style={styles.salesmanName}>{salesman}</Text>
      <Text style={styles.splitAmount}>
        €{data.total.toFixed(2)} ({((data.total / totalRevenue) * 100).toFixed(1)}%)
      </Text>
      <Text style={styles.splitCount}>{data.count} invoices</Text>
    </View>
  ))}
</View>
```

#### C. Add Salesman Badge to Transaction List

Enhance each transaction row:
```javascript
<View style={styles.transactionRow}>
  <Text style={styles.transactionDate}>{date}</Text>
  <Text style={styles.transactionAmount}>€{amount}</Text>
  {record.handledBy && (
    <View style={styles.salesmanBadge}>
      <Ionicons name="person-outline" size={12} color="#666" />
      <Text style={styles.salesmanBadgeText}>{record.handledBy}</Text>
    </View>
  )}
</View>
```

---

## 📋 Migration Checklist

### Before Running Migration:

1. **Backup Firestore Data**
   - Export customers collection
   - Keep copy of current data

2. **Test with One Customer**
   - Manually convert one customer's merch to array
   - Test KPI dashboard loads correctly
   - Test customer appears in salesman's list

### Running Migration:

1. **Run Firestore Manager**
   ```bash
   cd firestore-import
   node firestoreManager_full.js
   ```

2. **Select Option 5 → 5.4 (Migrate customer merch to array)**
   - Choose brand: `playmobil`
   - Confirm migration
   - Wait for completion

3. **Add Additional Salesmen to Shared Customer**
   - Select Option 5 → 5.5 (Add salesman to customer)
   - Enter customer code (e.g., "1402094")
   - Enter salesman name (e.g., "ΚΑΡΑΜΑΝΗΣ ΓΙΩΡΓΟΣ")
   - Repeat for each additional salesman

4. **Clear App Cache**
   - Force refresh KPI data to reload with new structure

### Testing After Migration:

1. **Test Primary Salesman**
   - Login as primary salesman (from primaryMerch)
   - Should see customer in list
   - KPIs should show all revenue

2. **Test Additional Salesman**
   - Login as added salesman
   - Should see same customer in list
   - KPIs should show all revenue (same total)

3. **Test Customer Detail View**
   - Click on shared customer
   - Should see revenue split by handling salesman
   - Should see salesman badge on each transaction

---

## 🎯 Expected Behavior After Implementation

### KPI Dashboard
- **Primary Salesman**: Sees customer, sees total €25,000
- **Additional Salesman**: Sees same customer, sees same total €25,000
- **Both** can drill down to see details

### Customer Sales Summary
```
Customer 1402094 - Big Store
Total 2025: €25,000

Revenue by Handling Salesman:
├─ ΚΑΡΑΜΑΝΗΣ ΓΙΩΡΓΟΣ    €11,000 (44%)   5 invoices
├─ ΖΕΓΑΣ ΓΙΩΡΓΟΣ        €7,000  (28%)   3 invoices
└─ ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ     €7,000  (28%)   4 invoices

Recent Transactions:
[2025-05-12] €6,000  [ΚΑΡΑΜΑΝΗΣ ΓΙΩΡΓΟΣ]
[2025-04-05] €4,000  [ΚΑΡΑΜΑΝΗΣ ΓΙΩΡΓΟΣ]  (via Partner ZM)
[2025-03-10] €7,000  [ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ]
...
```

---

## ⚠️ Important Notes

1. **No Revenue Splitting in KPIs**
   - All assigned salesmen see 100% of customer revenue
   - This is by design (account team model)
   - Split is shown in detail view only

2. **Historical Data**
   - All past invoices are attributed to current owners
   - Year-over-year comparisons remain accurate
   - Transaction-level salesman is for transparency only

3. **Manual Management**
   - Adding/removing salesmen requires using firestoreManager
   - No automatic sync with spreadsheet
   - This gives you full control

4. **Array Size Limit**
   - Max 10 salesmen per query (Firestore limit)
   - You have <10 salesmen, so no issue

---

## 🔧 Files Modified

### Backend Services:
- ✅ `src/config/playmobil.js` - Added salesRep, partnerZM columns
- ✅ `src/services/playmobilKpi.js` - Added determineHandlingSalesman(), updated query, added handledBy field
- ✅ `firestore-import/firestoreManager_full.js` - Migration functions, array import

### UI Components (TODO):
- ⏳ `src/screens/CustomerSalesSummary.js` - Need to add revenue split display
- ⏳ `src/components/KpiDataModal.js` - Optional: add salesman badges

### Data Structure:
- ✅ Customer merch: `string` → `array`
- ✅ Transaction records: Added `handledBy` field
- ✅ Firestore queries: `in` → `array-contains-any`

---

## Status: ~85% Complete

**Remaining Work:**
1. Add revenue split UI to CustomerSalesSummary
2. Add salesman badges to transaction lists
3. Run migration on Firestore
4. Test with real data
