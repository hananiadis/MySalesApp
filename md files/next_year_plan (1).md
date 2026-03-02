## Plan: Add 2026 Data & Create Year-End Automation Process

**TL;DR:** Add Google Sheets for 2026 Playmobil/Kivos data to configs, update KPI screens to include 2026 in data arrays, create a reusable `year-end-checklist.md` with step-by-step instructions so next January requires only config updates and sheet URLs.

### **Steps**

#### **Phase 1: Prepare 2026 Google Sheets (Manual - One-Time)**
1. Create 3 new Google Sheets for Playmobil 2026: **sales2026**, **orders2026**, **balance2026** (note their gid values)
2. Create 1 new Google Sheet for Kivos 2026: **kivosSales2026** (note its gid)
3. Share all sheets publicly; extract publishable CSV URLs
4. Document URLs and gid values in a `2026_SHEETS.txt` file for reference

#### **Phase 2: Update Configuration Files (Automated Template)**
1. Update spreadsheets.js - add sales2026, orders2026, balance2026, kivosSales2026 with ttlHours=12, permanent=false
2. Update playmobil.js - add invoiced2026, orders2026, balance2026 to SHEETS_MAPPING
3. Update googleSheetsCache.js - add 2026 sheet keys to sheet registry
4. Archive sales2024 & orders2024 as permanent=true (already done)

#### **Phase 3: Update KPI & Statistics Screens**
1. playmobilKpi.js - add sales2026, orders2026, balance2026 to loadSpreadsheets()
2. kivosKpi.js - add kivosSales2026 to Promise.all(); add `sales2026: parseKivosSalesData(...)` to datasets
3. Update src/screens/KivosKpiScreen.js - add year2026 to kpiData structure
4. Update KivosCustomerDetailScreen.js - add InvSales2026 to field display

#### **Phase 4: Update Firestore Schema (Manual - Backend)**
1. Add `InvSales2025`  to `customers_kivos` collection (Firestore console). make a field in customers_kivos collections InvSales2025 as it is now finalized and can be permanent. InvSales2026 is a dynamic field that should be read from spreadsheet
2. Update importCustomers.js to import these new fields from Kivos customer sheet, update firestoreManager_full.js to import InvSales2025 to firestore

#### **Phase 5: Create Reusable Year-End Automation Template**
1. Create YEAR_END_CHECKLIST.md in root with:
   - Pre-flight checklist (2026 sheets created? URLs extracted?)
   - File-by-file config update instructions (with line numbers & find/replace patterns)
   - Test checklist (load Settings → Data Cache, verify all 15+ sheets listed with fresh timestamps)
   - Post-implementation checklist (clear old metadata, reload app, verify KPI screens show 2026 data)

2. Create template script scripts/prepare-year-end.sh for:
   - Backup current configs
   - Update all year references via sed/find-replace
   - Display summary of changes made

#### **Phase 6: Update UI Labels & Catalog References**
1. Update CatalogScreen.js - update "2025" catalog references to "2026" where applicable
2. Search codebase for hardcoded "2025" strings; update to dynamic year where possible

#### **Further Considerations**

1. **Google Drive File Storage** - Where are the raw 2026 sales/order data files currently stored in Google Drive? Should we document the import path (CSV → Google Sheets → App)?
   - Option A: Store raw CSVs in a "2026" folder within existing Google Drive structure
   - Option B: Create a central "Year Archives" folder with subfolders per year
   - Option C: Use shared Drive for permanent historical data
   - 
   Analyze options, i am towards storing the files in google drive folders and giving the correct links each year

2. **Kivos Historical Data Retention** - Currently system tracks 2022, 2023, 2024, 2025. For 2026, do you want to:
   - **Option A:** Keep full 4-year rolling window (drop 2022, add 2026)
   - **Option B:** Keep permanent archive (add 2026, keep 2022-2025)
   - Option C: Policy decision on historical data retention
   - 
   I want to go with Option B

3. **Automation for Next Year** - The `YEAR_END_CHECKLIST.md` template will guide manual config updates. Should we also:
   - **Option A:** Create a CLI utility that accepts new year + sheet URLs and auto-updates all configs?
   - **Option B:** Keep manual updates (gives you control over each change)?
   - **Option C:** Hybrid: Auto-update, then manual review of diffs before committing?
   - 
   i want option C

---

**Timeline:** Phase 1-2: ~30 min (manual + config updates) | Phase 3-4: ~45 min (KPI screens) | Phase 5-6: ~30 min (automation + UI)
