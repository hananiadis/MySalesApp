Kivos KPI & Monthly Sales Module – Dev Spec

Goal: Add a complete Kivos brand statistics & monthly sales feature to MySalesApp, reusing the same architecture and UX patterns as existing Playmobil / generic KPI screens, while keeping prompts small enough for Codex context limits.

1. High-Level Overview

Brand: Kivos

Platform: React Native (Expo)

Backend: Firestore (+ existing CSV/Sheets imports)

New feature type: Read-only analytics (KPI dashboards + drill-down views)

Key idea: Use only Kivos data and filter by month/year to show:

Total sales

Sales per customer

Sales per product / category

Trend vs previous period

Basic credit/receivable summary (if data available)

2. Non-Goals (for v1)

No new imports / ETL logic from Sheets (reuse existing data that’s already in Firestore if possible).

No advanced forecasting/AI.

No complex multi-brand comparison dashboards.

No offline write-backs (read-only).

Data Model Overview
🔹 Firestore Collection: customers_kivos

Each document represents a customer.

Inside the document you already have yearly sales fields like:

InvSales2022
InvSales2023
InvSales2024
InvSales2025
...


Each one contains the total annual sales of that customer for that year.

Example format (based on your screenshot):

InvSales2022: number | null
InvSales2023: number | null
InvSales2024: number | null
InvSales2025: number | null


These fields are all you need to build the first version of the KPI module.

2. New Screens
2.1. KivosBrandStatisticsScreen
Purpose

Show annual and monthly sales KPIs for the whole Kivos brand based on historical sales data.

UI Elements

Year selector (2022 → current year)

Summary KPIs:

Total annual sales

Number of active customers (sales > 0)

Average sales per customer

Sales Δ% vs previous year

Top 10 customers table:

Customer Name

Annual Sales

Monthly breakdown:

Since raw monthly data does not exist, Codex must:

Derive monthly sales by: annual / 12 (simple average)

Show this as “estimated monthly sales”

Label clearly: “Μηνιαία (εκτιμώμενα)”

Optional chart:

Annual trend line 2022 → 2025

Data Source

Firestore: customers_kivos collection

For each document:

Read only the selected year field, e.g.:

const field = `InvSales${year}`;
const value = doc.data()[field];

Navigation

From Kivos Brand Home → KivosBrandStatisticsScreen

2.2. KivosCustomerHistoryScreen
Purpose

Show historic sales for a single customer across all years.

UI Elements

Customer Name + Code

Table with:

Year → Sales

Charts:

Bar chart: sales per year

KPIs:

Highest annual sales

Year-over-year Δ%

Data Source

A single Firestore document from customers_kivos

Read all fields starting with InvSales20XX

Navigation

From KivosBrandStatisticsScreen → On customer tap → KivosCustomerHistoryScreen

3. Navigation Structure

Add screens to your Kivos brand navigator:

KivosBrandStatistics
KivosCustomerHistory


Use:

navigation.navigate('KivosBrandStatistics', { brand: 'kivos' })
navigation.navigate('KivosCustomerHistory', { brand: 'kivos', customer })

4. Access Control

Allow access to:

OWNER

ADMIN

DEVELOPER

SALES_MANAGER

SALESMAN (if brand access: "kivos")

Use your existing helper:

hasBrandAccess(user, 'kivos')

5. Data Loading (No Orders!)
Step 1 — Fetch all Kivos customers:
const q = query(
  collection(db, 'customers_kivos'),
  where('brand', '==', 'kivos')
)

Step 2 — Transform into KPI snapshot:

Example (Codex will write this):

function computeAnnualKPIs(customers, year) {
  const field = `InvSales${year}`;
  const values = customers
    .map(c => c[field] || 0)
    .filter(v => v > 0);

  const total = values.reduce((a, b) => a + b, 0);
  const activeCustomers = values.length;
  const avg = activeCustomers ? total / activeCustomers : 0;

  return { total, activeCustomers, avg };
}

Step 3 — Top customers
const top = customers
  .map(c => ({
    name: c.name,
    code: c.customerCode,
    sales: c[field] || 0
  }))
  .sort((a, b) => b.sales - a.sales)
  .slice(0, 10);

Step 4 — Estimated monthly sales

Since you have no monthly granularity:

const estimatedMonthly = total / 12;


Label clearly:
"Μηνιαίες Πωλήσεις (Εκτίμηση)"

6. Updated UI / Greek Labels

Use:

Στατιστικά Kivos

Συνολικές Πωλήσεις (Έτος)

Ενεργοί Πελάτες

Μέση Ετήσια Πώληση ανά Πελάτη

Εκτίμηση Μηνιαίων Πωλήσεων

Top Πελάτες

Πωλήσεις ανά Έτος

Ιστορικό Πωλήσεων Πελάτη

7. Error Handling

If no InvSalesXXXX field exists → treat as 0

If customer has no sales in selected year:

Hide from active customers

If entire year has zero sales:

Show message:
"Δεν βρέθηκαν πωλήσεις για το επιλεγμένο έτος."

8. Prompts for Codex (Updated Version)
Prompt 1 – Identify sales fields
Scan the customers_kivos collection model and identify all fields named like InvSalesXXXX. Do not modify code yet. Report back a list of all matching fields.

Prompt 2 – Create KivosBrandStatisticsScreen
Create a screen KivosBrandStatisticsScreen that:

1. Fetches all documents from customers_kivos.
2. Allows selecting a year (2022 → current year).
3. Computes:
   - Total annual sales for selected year
   - Active customers (sales > 0)
   - Avg annual sales per active customer
   - Sales delta vs previous year
   - Estimated monthly sales (total / 12)
4. Displays top 10 customers sorted by sales.
5. Navigates to KivosCustomerHistoryScreen on tap.
6. Uses Greek labels.
7. Uses SafeScreen and existing UI components.

Prompt 3 – Create KivosCustomerHistoryScreen
Create a screen KivosCustomerHistoryScreen that:

1. Receives customerCode and customerName.
2. Fetches the matching customers_kivos document.
3. Reads all InvSales fields (e.g. InvSales2022…2025).
4. Displays a table Year → Sales.
5. Shows KPIs:
   - Highest annual sales
   - Average annual sales
   - YoY trends
6. Styled like existing KPI screens with Greek labels.

Prompt 4 – Add to Navigation
Add KivosBrandStatistics and KivosCustomerHistory to the Kivos brand navigation stack. Add a new button in the Kivos brand home screen labeled "Στατιστικά & Πωλήσεις" that navigates to KivosBrandStatistics.

✔ Summary

This version is:

✅ Accurate for your real Kivos data
✅ Uses only existing historical sales fields
✅ Lightweight to implement
✅ Does not require orders, order lines, or supermarket listings
✅ Modular so later you can add:

Monthly breakdown from spreadsheet imports

Product-level Kivos analytics

Full KPI charts like Playmobil