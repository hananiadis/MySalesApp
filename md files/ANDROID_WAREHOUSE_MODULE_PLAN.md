📦 MySalesApp — Android Warehouse Manager Module
🔧 Master Specification & Development Guide for Copilot / Codex (NO CODE)

This document defines the design, screens, permissions, workflows, and Firestore interactions required to implement the Warehouse Manager features inside the Android app (React Native + Expo).

Codex must follow this plan exactly when generating code later.

📘 1. Purpose of Android Warehouse Module

The Android app will cover mobile-first warehouse operations, meaning tasks that are:

Done while walking around the warehouse

Require scanning barcodes

Require fast manual stock adjustments

Require quick supplier receiving workflows

Require offline capability

The heavy management & bulk editing will be done on PC (Web Dashboard).

🔐 2. Role-Based Access

Warehouse Manager must have:

roles: ["warehouse_manager"]
brandAccess: ["kivos"]


Android must:

Detect this role on login

Enable “Warehouse Mode” button

Hide customer order features not relevant for warehouse

Restrict brand options ONLY to Kivos

Disable Playmobil + John modules

📱 3. Android Screens to Implement

codex must generate the following screens as independent components:

WarehouseHomeScreen
WarehouseScanScreen
WarehouseProductDetailScreen
WarehouseAdjustStockScreen
WarehouseSupplierOrdersScreen
WarehouseSupplierOrderDetailScreen
WarehouseReceiveStockScreen
WarehouseQuickEditScreen
WarehouseSettingsScreen (optional)


Each is explained below.

🧭 4. Android Navigation Structure (Warehouse Mode)

When the logged user is a warehouse_manager:

HomeScreen displays a new button:

"Αποθήκη / Warehouse Mode"

This opens:

WarehouseHomeScreen
   ├─ Scan Product
   ├─ Supplier Orders
   ├─ Quick Stock Edit
   ├─ Receive Goods
   └─ Back to Main Home

📦 5. Screen Specifications

Below is the detailed description of each screen.
Codex must implement these exact screens, component names, layout logic, and behaviors.

5.1 📌 WarehouseHomeScreen

Purpose:
Quick central hub for warehouse tools.

Buttons:

Scan Barcode

Quick Stock Edit

Supplier Orders

Receive Stock

Back to Home

Requirements:

Flat grid layout with icons (Scan, Edit, List, Receive)

Show user role & brand (“Kivos Warehouse Manager”)

5.2 📌 WarehouseScanScreen

Main purpose:
Scan product barcode → fetch product info → open product detail.

Requirements:

Use Expo barcode scanner

On successful scan:

Look up product in products_kivos

Look up stock in products_kivos_stock

Navigate to WarehouseProductDetailScreen

Allow toggling flashlight

Allow manual product code entry

Offline fallback:

Local cache of product codes

Local cache of stock

Barcode types allowed:

EAN-13 (primary), EAN-8, UPC-A, UPC-E, QR (optional)

5.3 📌 WarehouseProductDetailScreen

Shows:

Product image (cached or placeholder)

Product Code

Product Name

Current Stock

Minimum Stock

Stock warning badge (if < minStock)

History preview (last 3 movements)

Buttons:

Add Stock

Remove Stock

Set Stock Manually

View Full History (opens history page on Web Dashboard—not in Android)

Rules:

All actions go to WarehouseAdjustStockScreen

5.4 📌 WarehouseAdjustStockScreen

Purpose:
Perform add / remove / set stock changes.

Inputs:

Quantity (+ or –)

Reason dropdown:

Supplier Delivery

Retail Sale

Damage/Loss

Correction

Internal Use

Other

Optional Notes

Confirmation Button

Offline-first behavior:

Cache change locally

Sync when online

Never block adjustment because of offline state

After submit:

Update Firestore:

products_kivos_stock

warehouse_logs_kivos

Show success toast

Navigate back to detail

5.5 📌 WarehouseSupplierOrdersScreen

Purpose:
List supplier orders created in Web Dashboard.

Data source:
/supplier_orders_kivos

List fields:

Supplier Name

Created Date

Status (pending / partial / received)

Total Items

Button: View

Sort options:

Date descending

Status

Filter:

Pending only

Partial only

Clicking an entry → opens WarehouseSupplierOrderDetailScreen

5.6 📌 WarehouseSupplierOrderDetailScreen

Shows:

Supplier Name

Notes

Status

List of items:

productCode

requiredQty

receivedQty

difference

Button:

Receive Goods
→ goes to WarehouseReceiveStockScreen

5.7 📌 WarehouseReceiveStockScreen

Purpose:
Mobile-first receiving workflow.

Requirements:

Flat list of all items from supplier order

Each row has:

Product code

Required

Input: Received this time

Auto-calculation of remaining

Allow scanning barcode to auto-jump to product

Process:

User enters received quantities

Press “Complete Receiving”

App applies:

Stock adjustments (add stock)

Update supplier order status:

Fully received → “received”

Partial → “partial”

Save log entry in warehouse_logs_kivos

Show success modal

5.8 📌 WarehouseQuickEditScreen

Purpose:
Fast adjustments without scanning.

Features:

Search bar (product code or name)

List with:

Product Code

Name

Current Stock

Tap → open WarehouseAdjustStockScreen

Use cases:

Retail shop sold some items

Quick correction

Removing damaged goods

5.9 📌 WarehouseSettingsScreen (Optional)

Allows editing:

Default reasons

Default minimum stock

Local offline settings

Auto-sync toggle

Stored under:

warehouse_settings_kivos

🧱 6. Firestore Rules Android Must Follow
For reading:

Only allow reading Kivos brand documents if:

user.role === warehouse_manager
user.brandAccess.includes('kivos')

For writing:

Allow writing:

products_kivos_stock/*

warehouse_logs_kivos/*

Updating supplier_orders_kivos/* status & received quantities

But NOT:

Prices

Customer orders

Customers list

Other brands

⚙️ 7. Offline-First Behavior Required

Android warehouse module must support offline operations.

Codex must implement:

Stock Adjustments:

Queue entries locally (MMKV or SQLite)

Retry when connected

Local timestamping

Scanning:

Use cached local product list

Use cached local stock list

Supplier Receiving:

Allow local buffering

Partial receive stored offline

🎨 8. UI/UX Guidelines
Style:

Big buttons

Large text

High contrast (warehouse lighting)

Icons: scan, add, remove, list

Layout:

Bottom-safe area

React Native Paper or custom UI

Loading skeletons

Toasts for success

Animations:

Scan highlight

Stock update “flash” effect

📝 9. Naming Conventions (MANDATORY for Codex)

Components:

WarehouseHomeScreen.js
WarehouseScanScreen.js
WarehouseProductDetailScreen.js
WarehouseAdjustStockScreen.js
WarehouseSupplierOrdersScreen.js
WarehouseSupplierOrderDetailScreen.js
WarehouseReceiveStockScreen.js
WarehouseQuickEditScreen.js


Services:

warehouseStockService.js
warehouseReceivingService.js
warehouseSupplierOrdersService.js
warehouseOfflineQueueService.js


Hooks:

useWarehouseStock
useBarcodeScanner
useOfflineQueue


MMKV keys:

kivos_stock_cache
kivos_pending_operations
kivos_last_sync

🧭 10. Implementation Order (Android)

Codex must follow these steps in order:

Phase A — Core Setup

Enable warehouse role routing

Add Warehouse Mode button

Kivos-only data filter

Phase B — Inventory Basics

Scanner

Product Detail

Adjust Stock

Offline queue

Phase C — Supplier Orders

Supplier Orders list

Supplier Order detail

Receive Stock workflow

Phase D — Enhancements

Quick edit screen

Settings screen

Barcode UX polish

Error handling

🚫 11. Things Codex Must NOT Do

Must not modify existing customer order flow

Must not add features for Playmobil or John

Must not change Firestore schema names

Must not remove offline-first logic

Must not require user authentication changes

Must not handle prices or catalogs

🎯 12. Goals of this Module

After implementation:

Warehouse Manager can run ALL Kivos warehouse operations from Android

PC dashboard handles heavy management

Brand separation is enforced

Offline-first operations are safe

Firestore is used efficiently