# Year-End Automation Template (Playmobil & Kivos)

This is a step-by-step, “do and verify” guide for rolling to a new year (example: 2026→2027).

## Quick-start (automation)
- macOS/Linux: `./scripts/prepare-year-end.sh --from 2026 --to 2027 --dry-run` (remove `--dry-run` to apply)
- Windows PowerShell: `pwsh ./scripts/prepare-year-end.ps1 -FromYear 2026 -ToYear 2027 -DryRun` (remove `-DryRun` to apply)
- Always review the backups (stored under backups/year-end-<timestamp>) and git diff after running.

## Pre-flight checklist
- Sheets exist and have data:
  - Playmobil: invoicedYYYY, ordersYYYY, balanceYYYY (CSV/Sheet URLs ready)
  - Kivos: kivosSalesYYYY (CSV) plus any balance/budget sheets if used
- URLs extracted: collect the exact CSV export links for each new-year sheet.
- Date formats confirmed:
  - Playmobil: DD/MM/YYYY
  - Kivos: DD/MM/YYYY for >=2026, MM/DD/YYYY for earlier years (parser depends on this)
- Credentials OK: service accounts valid, no expiry issues.
- Reference date chosen: typically Jan 1 of the new year for initial YTD/MTD checks.

## Step-by-step config updates (with verification)
1) Run the automation (dry-run first):
   - macOS/Linux: `./scripts/prepare-year-end.sh --from 2026 --to 2027 --dry-run`
   - Windows: `pwsh ./scripts/prepare-year-end.ps1 -FromYear 2026 -ToYear 2027 -DryRun`
   - Verify backups exist in backups/year-end-<timestamp>.

2) Update sheet URLs in `src/services/spreadsheets.js`:
   - Replace old URLs with the new-year CSV links for invoicedYYYY, ordersYYYY, balanceYYYY, kivosSalesYYYY.
   - Verify: rerun the script without `dry-run` to apply year bumps, then open the file and confirm the new URLs/keys are present.

3) Verify Playmobil loaders:
   - File: `src/services/playmobilKpi.js`
   - Check that the new year keys are included in any sheet lists/caches; confirm ttlHours if needed.

4) Verify Kivos loaders and date parsing:
   - File: `src/services/kivosKpi.js`
   - Ensure `getAllSheetsData` pulls `sales<newYear>`.
   - Confirm `parseDate` expectedYear logic matches the sheet format.

5) Verify customer metrics:
   - File: `src/services/playmobilCustomerMetrics.js`
   - Ensure `records[currentYear]` exists and dynamic year logic uses current/previous year correctly.

6) Screens with year references:
   - `src/screens/CustomerSalesSummary.js`
   - `src/screens/CustomerMonthlySales.js`
   - Any dashboard/KPI cards with explicit year keys — search for the old year (e.g., `2026` or `year2026`) and update to dynamic patterns where safe.

7) Firestore importers (if year-specific):
   - `firestore-import/firestoreManager_full.js` — confirm any year-tied sheets/fields are updated.

## Test checklist (do and verify)
- Clear app cache (AsyncStorage) and spreadsheet cache.
- App → Settings → Data Cache: confirm all required sheets (15+ entries) show fresh timestamps for the new year.
- Playmobil:
  - KPI screens show the new year tab populated.
  - Σύνοψη Πωλήσεων cards show YTD/MTD for the new year; modals return records.
- Kivos:
  - Dashboard cards populated for the new year; modals show records.
  - Logs show filtered records > 0 and no date-parse issues (no zeroed KPIs).
- Customer monthly/detail screens: current + previous year data present and dated correctly.

## Post-implementation checklist
- Remove stale caches/old sheet files (if any), then reload the app.
- Verify both brands show the new year’s figures across KPI and detail screens.
- Run `grep "2026" src` (or the old year) and confirm no unintended hardcoded references remain.
- Archive the backups from backups/year-end-<timestamp> for rollback.
- Record new sheet URLs and changes in release notes.
