📦 MySalesApp — Warehouse Manager Web Dashboard & Android Integration
🔧 Master Architecture & Implementation Instructions for GitHub Copilot / Codex

This document describes the design, structure, architecture, and implementation rules for building a Warehouse Manager module for the brand Kivos, consisting of:

A React (or Next.js) Web Dashboard for PC

Additional Warehouse features inside the Android app

Firestore database schema

Role-based access control

Modern UI guidelines

Advanced workflow logic

Copilot/Codex must follow these instructions strictly.
This file contains no code — only the full plan and development rules.

🧭 1. PROJECT GOALS

Create a complete warehouse management system for the Kivos brand.

PC/Web Dashboard handles:

Stock Management

Supplier Orders

Stock History

Bulk stock edit/import/export

Warehouse Settings

KPIs / Reports

Android app handles:

Barcode scanning

Quick add/remove stock

Supplier receiving

Quick inventory checks

Offline adjustments

Everything integrates with existing MySalesApp Firestore data.

Warehouse Manager role must only see Kivos data based on brandAccess.

🗂️ 2. PROJECT STRUCTURE (INSTRUCTIONS FOR CODEX)

Codex must create the following folder structure for the Web Dashboard:

/warehouse-dashboard
   /src
      /auth
      /components
         /layout
         /tables
         /charts
         /dialogs
      /context
      /hooks
      /pages
         /kivos
            stock
            supplier-orders
            history
            settings
         /auth
      /services
         firestore
         suppliers
         stock
         orders
      /styles
      /utils


This is NOT code.
Codex will generate files later when prompted.

🔐 3. ROLE-BASED ACCESS RULES

Codex must apply these rules to all components:

Warehouse Manager Role
roles: ["warehouse_manager"]
brandAccess: ["kivos"]


Permissions:

Feature	Allowed
View Kivos stock	✔
Create/edit stock	✔
Add/remove/set quantities	✔
View stock history	✔
Create supplier orders	✔
Edit supplier orders	✔
Receive supplier orders	✔
View Kivos orders	✔
Bulk export/import stock	✔
Access Playmobil/John	❌
Change prices	❌
Create customer orders	❌
View admin-only settings	❌

Codex must enforce UI + Firestore security rules.

🔥 4. FIRESTORE SCHEMA (No Code, Only Structure)

Codex must generate CRUD operations based on the following schema.

4.1 products_kivos_stock

Document ID = productCode

{
  quantity: number,
  minStock: number,
  updatedAt: timestamp,
  updatedBy: userId,
  warnings: {
    lowStock: boolean
  },
  history: [
    {
      type: "add" | "remove" | "set",
      qty: number,
      reason: string,
      userId: string,
      timestamp: timestamp
    }
  ]
}

4.2 supplier_orders_kivos
{
  createdAt,
  createdBy,
  supplierName,
  notes,
  products: [
    { productCode, requiredQty, receivedQty }
  ],
  status: "pending" | "partial" | "received"
}

4.3 warehouse_logs_kivos
{
  productCode,
  oldQty,
  newQty,
  type,
  qty,
  reason,
  userId,
  timestamp
}

🧱 5. WEB DASHBOARD MODULES TO IMPLEMENT

Codex must implement the following React pages.

5.1 Dashboard Home

Pending supplier orders

Low stock list

Recent stock changes

Quick access to Kivos module

5.2 Kivos → Stock Management
A. Stock Table

Search

Filter

Sort

Pagination

Export CSV

Import CSV (bulk updates)

Inline editing

Minimum stock UI

B. Stock Detail & History Panel

Fields shown:

productCode

productName

currentQuantity

minimumQuantity

movementHistory

C. Adjust Stock Dialogs

Add stock

Remove stock

Set stock manually

Reason dropdown

Confirmation step

5.3 Kivos → Supplier Orders
A. Supplier Order List

Sort by date

Status filter

View details

Duplicate order

Export Excel

B. Supplier Order Builder

User can:

Select customer orders (fetch from orders_kivos)

Auto-generate required quantities

Compare with stock

Highlight shortages

Add/Remove lines

Save to Firestore

C. Supplier Order Detail

Edit lines

Mark as received

Partial receiving UI

Add notes

Export to PDF

5.4 Kivos → Warehouse Settings

Settings stored in Firestore:

{
  minStockDefaults: number,
  suppliers: [...],
  adjustmentReasons: [...]
}


Fields:

Default minimum stock

Default supplier per product

Retail deduction presets

5.5 Kivos → Stock History

A table showing logs from warehouse_logs_kivos with:

Product Code

Change Type

Quantity

Reason

Date

User

With filters:

Date range

Type

Product

User

📱 6. ANDROID APP MODULES

Codex must ONLY generate Android code when instructed.
This section describes WHAT to build, not code.

6.1 Warehouse Mode (role-based)

When user has "warehouse_manager" role:

Show a new button:
"Warehouse Mode"

6.2 Barcode Scanner

Scans product barcode

Opens Stock Detail modal

Shows product info

Buttons: Add / Remove / Set

6.3 Supplier Receiving

Workflow:

Select supplier order

See list of items

Enter received quantity

Allow “partial receive”

Update stock table

Save Firestore logs

6.4 Quick Stock Editor

Search product

Quick adjust stock

Offline-first logic

Sync on reconnect

🧠 7. AI & MODERN FEATURES TO ADD LATER

Codex should treat these as future modules:

AI stock prediction

Barcode verification with camera

Automatic reorder suggestions

Push notifications

Desktop PDF generation

🧩 8. DESIGN & UI RULES FOR ALL MODULES

Codex must follow these UI guidelines:

Typography

Use Roboto or Inter

Clear section headers

16px base font

Layout

Cards for each module

Tables with sticky headers

Filters in left sidebar

Right-side drawer for detail view

Dialogs for adjustments

Navigation
Sidebar:
  Dashboard
  Kivos
     Stock
     Supplier Orders
     History
     Settings
  (future brands)

Color Coding

Low Stock = red

Warning = orange

Normal = green

Supplier pending = blue

🧭 9. IMPLEMENTATION ORDER (FOR CODEX)

Codex must create features in exact order:

Phase 1 (Core)

Project skeleton (React or Next.js + Firebase)

Authentication (Firebase Auth)

Role-based redirect guards

Kivos Stock Table

Stock Detail + Adjustments

Create Firestore CRUD for stock

Phase 2 (Operations)

Supplier Orders: List

Supplier Order Builder

Supplier Order Detail

Supplier Receiving flow

Phase 3 (Data Tools)

Stock History Table

Bulk Import/Export

Alerts & warnings

Phase 4 (Enhancements)

Dashboard analytics

Minimum stock automation

Future AI suggestions

Android scanning integration

🏁 10. WHAT CODEX MUST NEVER DO

Never change Firestore schema names

Never create Playmobil or John modules in this phase

Never allow unauthorized access to brands outside Kivos

Never modify existing MySalesApp mobile orders logic

Never duplicate product data — always link via productCode

🧱 11. WHAT CODEX MUST ALWAYS DO

Follow folder structure exactly

Use Firestore CRUD modules under /services

Use context providers for auth & user roles

Use Material UI or Tailwind (your choice)

Keep UI clean, minimal, professional

Respect mobile/desktop separation

🎯 12. NEXT STEP FOR YOU

Once you paste this file into VS Code:

Open a new JS/TS file

Type:
“Implement Phase 1: Create React project skeleton according to plan.md”

Codex will generate the correct structure.

Then continue step by step:

“Implement Stock Table UI”

“Create Firestore Service for stock”

“Create Supplier Order Builder layout”