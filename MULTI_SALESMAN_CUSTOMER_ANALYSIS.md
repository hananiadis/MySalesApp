# Multi-Salesman Customer Problem - Analysis & Summary

## Current Situation Summary

### System Overview

**Tech Stack:**
- React Native app for sales management
- Firestore database for customer data
- Google Sheets as data source for sales transactions
- Multiple brands: Playmobil, Kivos, John

---

### How It Works Now (Playmobil Focus)

#### 1. Customer Data (Firestore)
**Collection:** `customers`

**Structure:**
```javascript
{
  customerCode: "1402094",           // Unique ID
  name: "CUSTOMER NAME",
  merch: "ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ",         // Single salesman assignment
  // ... other fields (address, contact, etc.)
}
```

**Key Field:** `merch` - Identifies which salesman owns/manages this customer

---

#### 2. Sales Data (Google Sheets)
**Source:** CSV exports from published Google Sheets

**Key Columns:**
- `Payer` - Customer code (matches Firestore `customerCode`)
- `Name Payer` - Customer name
- `Sales revenue` - Invoice amount
- `Billing Date` - Transaction date
- **`Name Sales-Rep`** - Salesman who handled this specific invoice
- **`Partner ZM name`** - Alternative salesman field (used when `Name Sales-Rep` = "ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ")

**Current Parsing (from `playmobil.js` config):**
```javascript
columnNames: {
  sales: {
    customerCode: 'Payer',
    customerName: 'Name Payer',
    revenue: 'Sales revenue',
    billingDate: 'Billing Date'
    // NOT currently parsing: Name Sales-Rep, Partner ZM name
  }
}
```

---

#### 3. Current KPI Logic

**Flow:**
1. User logs in → System checks `user.merchIds` (e.g., `["playmobil_ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ"]`)
2. System queries Firestore: `WHERE merch == "ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ"`
3. Gets list of customer codes: `["1402094", "1401252", ...]`
4. Loads sales spreadsheet (all rows)
5. **Filters transactions:** Only rows where `Payer IN [customer codes from step 3]`
6. Calculates KPIs (YTD, MTD, yearly totals) from filtered transactions

**Key Point:** Filtering is based on **customer ownership** (Firestore `merch` field), NOT on who actually handled each invoice

---

## The Problem You're Trying to Solve

### Scenario:
You have **ONE customer** that is:
- **Assigned to one primary salesman** in Firestore (e.g., `merch = "ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ"`)
- **But invoiced by MULTIPLE different salesmen** throughout the year

### Example Customer "1402094"

**Firestore Record:**
```javascript
{
  customerCode: "1402094",
  name: "Big Multi-Location Store",
  merch: "ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ"  // Primary salesman
}
```

**Sales Spreadsheet (2025 invoices):**
```
Date        | Payer   | Revenue | Name Sales-Rep                    | Partner ZM name
------------|---------|---------|-----------------------------------|------------------
2025-01-15  | 1402094 | €5,000  | ΚΑΡΑΜΑΝΗΣ ΓΙΩΡΓΟΣ                | ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ
2025-02-20  | 1402094 | €3,000  | ΖΕΓΑΣ ΓΙΩΡΓΟΣ                    | ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ
2025-03-10  | 1402094 | €7,000  | ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ                  | ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ
2025-04-05  | 1402094 | €4,000  | ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ    | ΚΑΡΑΜΑΝΗΣ ΓΙΩΡΓΟΣ
2025-05-12  | 1402094 | €6,000  | ΚΑΡΑΜΑΝΗΣ ΓΙΩΡΓΟΣ                | ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ
```

**Total: €25,000**

---

### Current Behavior (Problematic)

**When ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ logs in:**
- ✅ Sees customer "1402094" in their list
- ✅ KPI shows €25,000 YTD for this customer
- ❌ **Cannot see** that other salesmen handled €15,000 of those invoices

**When ΚΑΡΑΜΑΝΗΣ ΓΙΩΡΓΟΣ logs in:**
- ❌ Does NOT see customer "1402094" in their list (not assigned to them)
- ❌ KPI shows €0 for this customer
- ❌ **Gets no credit** for the €9,000 they actually invoiced

---

## What You Want to Achieve

### Primary Goals:
1. **Visibility:** See which salesman handled each specific invoice
2. **Fair Attribution:** Each salesman should get credit for invoices they personally handled
3. **Maintain Historical Data:** Don't break year-over-year comparisons
4. **Minimal Risk:** Don't mess up existing KPI calculations for other customers

### Specific Requirements:
- Handle the special case where `Name Sales-Rep = "ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ"` → use `Partner ZM name` instead
- Show revenue split in Customer Sales Summary view
- Potentially: Allow multiple salesmen to see the same customer if they invoice them

---

## Technical Constraints

### What We Cannot Change:
- ❌ Historical spreadsheet data (already recorded)
- ❌ Firestore `merch` field is single string (not array)

### What We Can Change:
- ✅ How we parse spreadsheet columns
- ✅ How we filter/attribute transactions
- ✅ What we display in UI
- ✅ Add configuration for special cases

---

## Key Fields Summary

| Field | Source | Current Use | Potential Use |
|-------|--------|-------------|---------------|
| `customerCode` | Firestore | Unique ID | Same |
| `merch` | Firestore | Customer ownership | Keep as primary owner |
| `Payer` | Spreadsheet | Customer code in transaction | Same |
| `Name Sales-Rep` | Spreadsheet | **NOT USED** | **Handling salesman** |
| `Partner ZM name` | Spreadsheet | **NOT USED** | **Fallback salesman** |
| `Sales revenue` | Spreadsheet | Invoice amount | Same |
| `Billing Date` | Spreadsheet | Transaction date | Same |

---

## The Core Question

**How do we:**
1. Parse `Name Sales-Rep` and `Partner ZM name` from spreadsheet?
2. Determine which salesman handled each invoice?
3. Split revenue attribution between multiple salesmen?
4. Show this in KPIs and Customer Detail views?
5. Do this without breaking existing functionality?

---

## Potential Solutions (To Be Decided)

### Option 1: Transaction-Level Attribution
- Parse salesman info from each spreadsheet row
- Filter KPIs by handling salesman (not customer owner)
- **Problem:** Breaks historical comparisons when customer changes owner

### Option 2: Hybrid Approach
- Keep KPIs based on customer ownership (Firestore `merch`)
- Add transaction-level salesman info for Customer Detail view
- Show revenue split in summary view
- **Problem:** Other salesmen don't see customer in their KPI dashboard

### Option 3: Special Customer Config
- Add configuration for specific shared customers
- Multiple salesmen can see the same customer
- All see 100% of revenue (no automatic split)
- **Problem:** No automatic revenue attribution

---

## Files That Would Need Changes

### Configuration:
- `src/config/playmobil.js` - Add column mappings for `Name Sales-Rep`, `Partner ZM name`

### Data Services:
- `src/services/googleSheets.js` - Parse new columns from CSV
- `src/services/playmobilKpi.js` - Store/use transaction-level salesman info

### UI Components:
- `src/screens/CustomerSalesSummary.js` - Show revenue split by salesman
- `src/components/KpiDataModal.js` - Potentially show salesman badges

### Utilities:
- Helper function to determine handling salesman (handle special case)

---

## Status

**Current State:** Analysis complete, awaiting decision on approach

**Next Steps:** Choose solution approach and implement
