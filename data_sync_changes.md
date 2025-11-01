# 📱 MySalesApp — Current Functional State (End-of-Iteration Summary)

## 🧩 Core Functionalities
- **Brand modules:** Playmobil, Kivos, John Hellas supported with their own product, customer, and order collections.
- **Firestore Sync:**  
  - Incremental synchronization per collection (`products*`, `customers*`) using any of  
    `updatedAt`, `lastUpdated`, `importedAt`, or `createdAt`.  
  - Initial run performs full collection download; subsequent runs merge only changed/new docs.
  - Supermarket collections (`supermarket_stores`, `supermarket_listings`, `supermarket_meta`) fully fetched (typically small).
- **Spreadsheets:**  
  - Cached via `spreadsheetCache` + `utils/sheets` with 24 h TTL & checksum.  
  - Sheets in use:
    | Brand / Context | Sheet Key | Purpose |
    |-----------------|------------|----------|
    | Playmobil | `playmobilSales`, `playmobilStock` | Sales KPIs & stock availability |
    | Kivos | `kivosCustomers`, `kivosCredit` | Customer and credit analysis |
    | Supermarket | `supermarketInventory` | Store inventory for supermarket order flow |

- **Images:**  
  - Product images downloaded & cached under `cacheDirectory/brand-images/<brand>/`.  
  - Re-download skipped if file already cached.

## 🔄 Update Flow
- Centralized service `/src/services/updateAll.js`
  - Handles all Firestore + Sheet + Image + Supermarket updates.
  - Callable from any screen via:
    ```js
    import { updateAllDataForUser } from '../services/updateAll';
    await updateAllDataForUser({ brandAccess, supportsSuperMarketBrand });
    ```
- “Update All” button integrated in:
  - **DataScreen** (Λήψη Δεδομένων)
  - **User Dropdown Menu** (`GlobalUserMenu.js`)

## 🧠 DataScreen
- Wrapped in `SafeScreen` → respects status bar & notch areas.
- Header with Back & “Ενημέρωση Όλων” buttons.
- Displays sync progress / success alerts.
- Calls incremental `updateAllDataForUser`.

## 🏠 MainHomeScreen
- Connection indicator = small **green/red dot** next to region name.
- “Τελευταίος Συγχρονισμός” shows latest timestamp among any sync actions  
  (orders → Firestore or data downloads → Firestore/Sheets).
- “KPIs” header spaced further from user box for visual clarity.
- User info box (`SalesmanInfoCard`) clickable → navigates to **UserProfile**.

## 👤 SalesmanInfoCard
- Preserves previous design (avatar + region + sync + brand chips).
- Accepts **React element** as `region` prop (for text + dot rendering).
- Supports **dot-only** connection mode (hidden text if `connectionLabel` is empty).

## ⚙️ Collections (confirmed)
| Brand | Products | Customers | Orders |
|--------|-----------|-----------|---------|
| Playmobil | `products` | `customers` | `orders` |
| Kivos | `products_kivos` | `customers_kivos` | `orders_kivos` |
| John Hellas | `products_john` | `customers_john` | `orders_john` |

## 🗂️ Supermarket
- `supermarket_stores`: store info + brand link + category structure.  
- `supermarket_listings`: product listings per store & brand.  
- `supermarket_meta`: ordering of groups for listing display.  
- Orders stored in `orders_{brand}_supermarket`.

## 🖼️ UI Overview
- All screens use `SafeScreen` for consistent padding.
- Modern blue-white theme (#1976d2 primary).  
- Smooth navigation:
  - Home → Brand Screens  
  - Brand Screens → Order Flows / Products / Customers / Data Screen  
  - User dropdown menu includes **Update All** option.

---

**This document represents the current stable state** of MySalesApp after the latest refactor.  
It can serve as the reference context for continued development in VS Code / Codex.
