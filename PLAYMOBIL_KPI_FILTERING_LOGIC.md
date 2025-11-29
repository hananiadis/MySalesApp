# Playmobil KPI Dashboard Filtering Logic

## ⚠️ CRITICAL - DO NOT CHANGE WITHOUT WRITTEN CONFIRMATION ⚠️

**Date Established**: November 20, 2025  
**Status**: PRODUCTION - WORKING CORRECTLY

---

## Current Implementation (VERIFIED CORRECT)

### Single Salesman Selection
When **ONE salesman** is selected in the filter:
- ✅ Data shows ONLY that salesman's customers
- ✅ Sales and orders are calculated correctly
- ✅ Historical data (2024, 2025) is attributed properly using two-tier logic

### Multiple Salesmen Selection
When **TWO OR MORE salesmen** are selected:
- ✅ Data shows ALL selected salesmen's customers COMBINED
- ✅ Sales and orders are ADDED together across all selected salesmen
- ✅ Metrics aggregate data from all selected salesmen
- ✅ Each record maintains its proper `handledBy` attribution

### "Όλοι" (All) Selection
When "Όλοι" button is clicked:
- ✅ Shows data for ALL available salesmen
- ✅ Aggregates all sales and orders across all salesmen
- ✅ Displays complete team/portfolio view

---

## Technical Implementation Details

### Data Attribution (Two-Tier Logic)

**TIER 1 - Single-Salesman Customers:**
```javascript
// Customer has only ONE salesman in Firestore merch array
// Use that salesman for ALL years of historical data
if (merchArray.length === 1) {
  handledBy = merchArray[0]; // Salesman NAME
}
```

**TIER 2 - Multi-Salesman Customers:**
```javascript
// Customer has MULTIPLE salesmen in merch array
// Use store-level mapping from latest year (2025)
// Each store's ALL-YEAR data goes to current store salesman
if (merchArray.length > 1) {
  handledBy = storeMapping[customerCode].stores[storeName]; // Salesman NAME
}
```

### Filtering Logic (SalesAnalyticsScreen.js)

```javascript
// CORRECT IMPLEMENTATION - DO NOT CHANGE
const filteredSalesData = useMemo(() => {
  // Get selected salesmen objects
  const salesmenToFilter = selectedSalesmen.length > 0 
    ? availableSalesmen.filter(s => selectedSalesmen.includes(s.code))
    : availableSalesmen; // All if none selected
  
  // Extract NAMES (not codes) - handledBy field contains NAMES
  const salesmenNames = salesmenToFilter.map(s => s.name);
  
  // Filter records by name matching
  const filteredCurrent = salesData.current.filter(r => {
    return salesmenNames.includes(r.handledBy);
  });
  
  return { current: filteredCurrent, previous: filteredPrevious };
}, [salesData, selectedSalesmen, availableSalesmen]);
```

### Key Points

1. **handledBy field contains SALESMAN NAMES** (not codes)
2. **Filter uses NAMES for comparison** (not codes)
3. **Multiple selections ADD data together** (union of records)
4. **Empty selection shows ALL available salesmen** (default view)

---

## Data Flow

```
User Selection → Salesman Codes (doc IDs)
                     ↓
             Map codes to names
                     ↓
        Filter records by handledBy (names)
                     ↓
          Aggregate metrics across all matches
```

---

## Before Making ANY Changes

### Required Confirmation Checklist

- [ ] Written confirmation from product owner
- [ ] Test case documented for new behavior
- [ ] Verification of single-salesman selection (must still work)
- [ ] Verification of multi-salesman selection (must aggregate)
- [ ] Verification of "Όλοι" selection (must show all)
- [ ] Historical data attribution verified (2024 vs 2025)

### Common Pitfalls to AVOID

❌ **DO NOT** change `handledBy` to use codes instead of names  
❌ **DO NOT** filter by `r.handledBy === selectedSalesman[0]` (ignores multiple)  
❌ **DO NOT** use `salesmenCodes.includes(r.handledBy)` (name vs code mismatch)  
❌ **DO NOT** return empty array when `selectedSalesmen.length === 0`  
❌ **DO NOT** change two-tier logic without understanding customer attribution

### Testing Requirements

Before deploying ANY changes:

1. Test with 1 salesman selected → Shows only their data
2. Test with 2+ salesmen selected → Shows combined data (sum of sales)
3. Test with "Όλοι" → Shows all available salesmen data
4. Test with customer who changed salesmen 2024→2025 → Correct attribution per year
5. Test with multi-salesman customer → Correct store-level attribution

---

## Version History

- **v1.1** (2025-11-20): Default filter behavior updated
  - **BREAKING**: Brand homescreen now defaults to user's linked salesmen (not ALL company data)
  - On first load, shows only the logged-in user's assigned salesmen
  - User can manually select "Όλοι" to see all company data if needed
  - Preserves user's selection in AsyncStorage for subsequent visits
  - Route params can override with `selectedSalesmenIds` array
  
- **v1.0** (2025-11-20): Initial implementation
  - Two-tier salesman attribution (single vs multi-salesman customers)
  - Name-based filtering for multiple salesman selection
  - Aggregation of metrics across selected salesmen

---

## Contact

If changes are needed, contact development team with:
1. **Business justification** for the change
2. **Expected behavior** for all selection scenarios
3. **Test data** to validate new behavior

**This logic preserves historical data integrity and ensures accurate salesman attribution.**
