# KPI Loading Fix Plan

## Issues Identified

### 1. **Initial Load Shows Wrong Values When User Has Many Salesmen**

**Problem:**
- When hook initializes with `selectedSalesmenIds = null`, it defaults to ALL playmobil salesmen
- The hook sets `activeSalesmenIds` to ALL available salesmen on first load
- This causes KPIs to show aggregated data for ALL salesmen initially
- When user changes filter, it correctly recalculates with the subset

**Root Cause (usePlaymobilKpi.js lines 145-154)**:
```javascript
let subsetIds = Array.isArray(selectedSalesmenIds) ? selectedSalesmenIds.filter(Boolean) : [];
if (subsetIds.length) {
  subsetIds = subsetIds.filter(id => playmobilIds.includes(id));
  console.log('[usePlaymobilKpi] Using provided selectedSalesmenIds subset:', subsetIds);
}
if (!subsetIds.length) {
  subsetIds = playmobilIds; // ← BUG: Defaults to ALL
  console.log('[usePlaymobilKpi] No subset provided (or invalid) -> using ALL playmobil salesmen');
}
setActiveSalesmenIds(subsetIds);
```

**Solution:**
When `selectedSalesmenIds` is null/empty, instead of using ALL salesmen, use a smart default:
- **If user has only 1 Playmobil salesman**: Use that one
- **If user has multiple Playmobil salesmen**: Keep as null and show "Select Salesmen" prompt in UI
- This prevents overwhelming initial loads and makes the default behavior more intuitive

### 2. **Previous Year Sales Attributed to Historical Salesman**

**Problem:**
- Previous year (2024) sales are filtered by `handledBy` field
- If a customer changed from Salesman A to Salesman B in 2025:
  - 2024 sales show under Salesman A (historical)
  - 2025 sales show under Salesman B (current)
- This makes year-over-year comparison incorrect because customer groups differ

**Example:**
```
Customer: ΠΑΠΑΔΟΠΟΥΛΟΣ Α.Ε. (Code: 12345)

2024: handledBy = "playmobil_user1" (Salesman A)
      Sales: €50,000

2025: handledBy = "playmobil_user2" (Salesman B)
      Sales: €60,000

Current behavior:
- Salesman A's KPIs show:
  - 2024 YTD: €50,000 ✓
  - 2025 YTD: €0 (customer moved)
  
- Salesman B's KPIs show:
  - 2024 YTD: €0 (customer wasn't his yet)
  - 2025 YTD: €60,000 ✓

Comparison broken!
```

**Expected Behavior:**
```
Salesman B should see:
- 2024 YTD: €50,000 (same customer, historical data)
- 2025 YTD: €60,000 (current data)
- Comparison: +20% growth ✓
```

**Root Cause (playmobilKpi.js lines 1001-1026)**:
```javascript
const filterByCustomers = (records) => {
  const filtered = records.filter(r => {
    const recordCode = r.customerCode || r.code;
    const matchesCustomer = customerCodes.includes(recordCode);
    
    if (!salesmenFilter || !Array.isArray(salesmenFilter) || salesmenFilter.length === 0) {
      return matchesCustomer;
    }
    
    // ← BUG: This filters by historical handledBy
    if (r.handledBy !== undefined && r.handledBy !== null && r.handledBy !== '') {
      const matchesSalesman = salesmenFilter.includes(r.handledBy);
      return matchesCustomer && matchesSalesman;
    }
    
    return matchesCustomer;
  });
  return filtered;
};
```

**Solution:**
For previous year data, ignore the historical `handledBy` and attribute based on **current customer assignment**:

```javascript
const filterByCustomers = (records, isPreviousYear = false) => {
  const filtered = records.filter(r => {
    const recordCode = r.customerCode || r.code;
    const matchesCustomer = customerCodes.includes(recordCode);
    
    if (!salesmenFilter || !Array.isArray(salesmenFilter) || salesmenFilter.length === 0) {
      return matchesCustomer;
    }
    
    // For PREVIOUS YEAR data: Use current customer assignment, ignore historical handledBy
    if (isPreviousYear) {
      // Customer is already in customerCodes (from current year assignment)
      // So if customer matches, include the record regardless of historical handledBy
      return matchesCustomer;
    }
    
    // For CURRENT YEAR data: Use handledBy for store-based attribution
    if (r.handledBy !== undefined && r.handledBy !== null && r.handledBy !== '') {
      const matchesSalesman = salesmenFilter.includes(r.handledBy);
      return matchesCustomer && matchesSalesman;
    }
    
    return matchesCustomer;
  });
  return filtered;
};
```

## Implementation Steps

### Step 1: Fix Initial Load Default (usePlaymobilKpi.js)

**Location:** Lines 145-154

**Change:**
```javascript
// OLD:
if (!subsetIds.length) {
  subsetIds = playmobilIds; // Uses ALL salesmen
  console.log('[usePlaymobilKpi] No subset provided (or invalid) -> using ALL playmobil salesmen');
}

// NEW:
if (!subsetIds.length) {
  if (playmobilIds.length === 1) {
    // User has only 1 salesman - use it by default
    subsetIds = playmobilIds;
    console.log('[usePlaymobilKpi] User has 1 salesman, using as default:', playmobilIds[0]);
  } else {
    // User has multiple salesmen - keep as empty to show selection prompt
    subsetIds = [];
    console.log('[usePlaymobilKpi] User has multiple salesmen, requiring explicit selection');
    // Set a flag to show "Please select salesmen" message
    if (!cancelled) {
      setStatus(STATUS.AWAITING_SELECTION);
      return;
    }
  }
}
```

**Add new status:**
```javascript
const STATUS = {
  INITIAL: 'initial',
  LOADING: 'loading',
  AWAITING_SELECTION: 'awaiting_selection', // NEW
  SUCCESS: 'success',
  ERROR: 'error',
};
```

### Step 2: Fix Previous Year Attribution (playmobilKpi.js)

**Location:** Lines 1001-1026

**Change 1 - Add isPreviousYear parameter:**
```javascript
const filterByCustomers = (records, isPreviousYear = false) => {
  const filtered = records.filter(r => {
    const recordCode = r.customerCode || r.code;
    const matchesCustomer = customerCodes.includes(recordCode);
    
    if (!salesmenFilter || !Array.isArray(salesmenFilter) || salesmenFilter.length === 0) {
      return matchesCustomer;
    }
    
    // For PREVIOUS YEAR: Ignore historical handledBy, use current customer assignment
    if (isPreviousYear) {
      return matchesCustomer;
    }
    
    // For CURRENT YEAR: Use handledBy for store-based multi-salesman attribution
    if (r.handledBy !== undefined && r.handledBy !== null && r.handledBy !== '') {
      const matchesSalesman = salesmenFilter.includes(r.handledBy);
      return matchesCustomer && matchesSalesman;
    }
    
    return matchesCustomer;
  });
  return filtered;
};
```

**Change 2 - Update calls to filterByCustomers (lines 1047-1048):**
```javascript
const currentFiltered = filterByCustomers(currentYearData, false); // Current year
const previousFiltered = filterByCustomers(previousYearData, true); // Previous year
```

### Step 3: Update UI to Handle AWAITING_SELECTION Status

**In PlaymobilHomeTab.js or KivosHomeTab.js:**

```javascript
if (status === 'awaiting_selection') {
  return (
    <SafeScreen>
      <View style={styles.selectionPrompt}>
        <Ionicons name="people-outline" size={64} color="#1976d2" />
        <Text style={styles.promptTitle}>Επιλογή Πωλητών</Text>
        <Text style={styles.promptText}>
          Έχετε {availableSalesmen.length} πωλητές συνδεδεμένους.
          Παρακαλώ επιλέξτε πωλητές για να δείτε τα KPIs.
        </Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => setShowSalesmanFilter(true)}
        >
          <Text style={styles.selectButtonText}>Επιλογή Πωλητών</Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}
```

### Step 4: Apply Same Fix to Kivos KPIs

**Location:** src/services/kivosKpi.js

Apply the same `isPreviousYear` logic to Kivos KPI calculations.

## Testing Checklist

### Test Case 1: Single Salesman User
- [ ] User with 1 Playmobil salesman
- [ ] On app load, KPIs should show immediately (no selection needed)
- [ ] Values should be correct on first load

### Test Case 2: Multiple Salesmen User
- [ ] User with 3+ Playmobil salesmen
- [ ] On app load, should show "Select Salesmen" prompt
- [ ] After selecting 2 salesmen, KPIs should show correct aggregated values
- [ ] Changing filter should recalculate correctly

### Test Case 3: Customer Changed Salesmen
```
Setup:
- Customer "12345" had Salesman A in 2024
- Customer "12345" has Salesman B in 2025
- 2024 sales: €50,000
- 2025 sales: €60,000

Test:
1. View Salesman B's KPIs
2. Check YTD 2024: Should show €50,000 ✓
3. Check YTD 2025: Should show €60,000 ✓
4. Check YTD comparison: Should show +20% ✓
```

### Test Case 4: Multi-Salesman Customer (Store-Based)
```
Setup:
- Customer "67890" has 3 salesmen assigned
- Store A handled by Salesman X
- Store B handled by Salesman Y
- 2024: Store A sales €30k, Store B sales €20k
- 2025: Store A sales €40k, Store B sales €25k

Test:
1. View Salesman X's KPIs
2. Check YTD 2024: Should show €30,000 (Store A only) ✓
3. Check YTD 2025: Should show €40,000 (Store A only) ✓
4. Check YTD comparison: Should show +33% ✓
```

## Migration Notes

**Impact:**
- ⚠️ **Breaking Change for Multi-Salesman Users**: They will now need to explicitly select salesmen on first load
- ✅ **Better for Single-Salesman Users**: Immediate data load (same as before)
- ✅ **Better for Previous Year Comparisons**: Now compares same customer groups

**Communication:**
- Notify users that initial KPI screen may now require salesman selection
- Explain that this prevents overwhelming data loads and improves accuracy
- Previous year comparisons now correctly show same customer groups

**Rollback Plan:**
If issues arise, can revert by:
1. Removing `AWAITING_SELECTION` status check
2. Keeping `isPreviousYear` parameter but setting it to `false` for both years

## Additional Considerations

### Performance
- Filtering by customer assignment (ignoring handledBy) for previous year is actually FASTER
- No need to cross-reference historical salesman assignments

### Data Integrity
- Current year `handledBy` remains authoritative for store-based attribution
- Previous year data attribution follows "who owns the customer NOW" principle
- This matches business logic: "Show me how MY customers performed last year"

### Edge Cases
- **Customer deleted/inactive**: Previous year data still shows if customer was active then
- **New customer in 2025**: No previous year data (expected behavior)
- **Customer with no stores**: Uses primary salesman assignment (expected behavior)

## Conclusion

These fixes will:
1. ✅ Prevent overwhelming initial data loads for multi-salesman users
2. ✅ Make year-over-year comparisons accurate and meaningful
3. ✅ Maintain correct store-based attribution for current year
4. ✅ Simplify previous year attribution logic
