# MySalesApp Navigation Map

This document captures the current navigation skeleton so you can discuss, tweak, and extend the target user journeys without digging through the code.

## Entry Flow

```
App (NavigationContainer)
+-- Auth Stack (unauthenticated users)
|   +-- Login
|   +-- SignUp
+-- App Stack (authenticated users)
    +-- Home (MainTabsNavigator)
    +-- Playmobil (legacy alias of BrandTabsNavigator)
    +-- Kivos (legacy alias of BrandTabsNavigator)
    +-- John (legacy alias of BrandTabsNavigator)
    +-- Data
    +-- ProductDetail
    +-- StockDetails
    +-- CustomerDetail
    +-- KivosCustomerDetail
    +-- JohnCustomerDetail
    +-- CustomerSalesSummary
    +-- CustomerSalesDetail
    +-- OrdersManagement
    +-- OrderDetail
    +-- Settings
    +-- UserManagement
    +-- SalesmanManagement
    +-- Catalog (shared catalogue reader)
    +-- OrderCustomerSelectScreen
    +-- OrderProductSelectionScreen
    +-- OrderReviewScreen
    +-- OrderSummaryScreen
    +-- ExportSuccessScreen
    +-- SuperMarketOrderFlow (nested stack, see below)
    +-- SuperMarketProductSelection
    +-- SuperMarketOrderReview
    +-- SuperMarketOrderSummary
    +-- SuperMarketStoreDetails
    +-- Profile
```

- When `useAuth` has no user, the Auth Stack renders, hiding all other routes.
- After authentication the curved-tab home takes over; the stacked routes above sit behind buttons, list items, order flows, and admin-only entries.

## Main Tabs Navigator (`Home`)

`MainTabsNavigator` builds the bottom curved tab bar that appears on the main dashboard. Tabs are generated from the brands the user has access to (`useAuth.hasBrand`).

```
Home Tabs (CurvedBottomBar)
+-- MainHome (always present)
+-- PlaymobilModule (optional brand tab)
+-- KivosModule (optional brand tab)
+-- JohnModule (optional brand tab)
```

- **MainHome** (`MainHomeScreen.js`): Focuses on the user profile card and English-labelled KPIs. No floating action button or dashboard quick actions are shown; navigation to brand areas happens via the curved tab buttons.
- **Brand tabs** render brand-specific dashboards by wrapping `BrandTabsNavigator` with a fixed `brand` param. Opening a brand tab replaces the primary curved bar with the brand-specific one described in the next section.

## Brand Tabs Navigator (per brand)

`BrandTabsNavigator` unifies the Playmobil, Kivos, and John experiences with another curved tab bar. It accepts `brand` and optionally shows the supermarket flow if the brand is listed in `SUPERMARKET_BRANDS`.

```
Brand Tabs (CurvedBottomBar)
+-- BrandHome (brand landing page)
+-- Products
+-- Customers
+-- Catalogues
+-- OrdersMgmt (visible on tablet layouts only)
+-- NewOrder (hidden tab, opened via FAB/shortcuts)
```

- **BrandHome** highlights brand artwork and action cards. Actions either stay within the brand navigator (`NewOrder`, `OrdersMgmt`) or bubble up to the root stack (e.g., `SuperMarketOrderFlow`, `MainHome` back action).
- **Products** lists SKUs and links to `ProductDetail` and `StockDetails` routes in the root stack.
- **Customers** lists customers and links to brand-specific customer detail screens plus quick shortcuts into the order flow pre-filled for a customer.
- **Catalogues** opens the shared catalogue reader regardless of entry point.
- **OrdersMgmt** is only injected on larger screens; phones use the action card which navigates to the stack-level `OrdersManagement`.
- **FAB** (available on all brand tabs) routes to the hidden `NewOrder` tab, which is simply the first step of the standard order flow (`OrderCustomerSelectScreen`).

## Standard Order Flow

Triggered from brand FAB actions, customer quick shortcuts, or `OrdersManagement`:

```
OrderCustomerSelectScreen
  -> OrderProductSelectionScreen
    -> OrderReviewScreen
      -> OrderSummaryScreen
        -> ExportSuccessScreen (optional success branch)
```

- Each step lives in the root stack to keep state in `OrderContext`.
- Going backward usually returns to the previous step; cancelling often navigates back to `BrandHome` with the originating `brand` param.

## SuperMarket Order Flow

Brands that support supermarket journeys launch a nested stack living behind the `SuperMarketOrderFlow` route. The nested navigator (declared in `SuperMarketOrderFlowScreen.js`) keeps its own history while sharing the `brand` param with every screen inside.

```
SuperMarketOrderFlow (nested stack)
  -> SuperMarketStoreSelect
      -> SuperMarketProductSelection
          -> SuperMarketOrderReview
              -> SuperMarketOrderSummary
                  -> SuperMarketStoreDetails (drill-down)
```

- Entry points include: BrandHome action card, OrdersManagement quick action, and some supermarket-specific list interactions.
- `SuperMarketProductSelection` can branch back to `SuperMarketOrderFlow` home if the user needs to restart.

## Administrative & Supporting Screens

- **OrdersManagement**: Accessed from BrandHome action cards and Orders tabs (tablet layout). Provides links back into order creation (`OrderCustomerSelectScreen`) and supermarket selection flows.
- **Customer detail routes** (`CustomerDetail`, `KivosCustomerDetail`, `JohnCustomerDetail`) push off the Customers lists and expose buttons to `CustomerSalesSummary`.
- **Settings**, **UserManagement**, and **SalesmanManagement** sit behind admin-only buttons (Settings > Manage Users).
- **Data**, **Catalog**, and **Profile** are global stack routes surfaced via dashboard cards or profile menus.

## How to Use This Map

- **Discuss desired changes**: Use the tree to point at exact tabs or stack entries that should move, be renamed, or merge.
- **Identify reuse**: The brand tabs are instances of the same navigator; extend or alter once and pass additional params (e.g., new tabs, conditional actions).
- **Spot context jumps**: Any jump from a brand navigator back to the root stack is called out above, making it easier to decide whether a screen should stay nested or become a dedicated stack route.

Keep this file alongside design conversations so engineers can mirror upcoming information architecture tweaks in the navigator modules (`App.js`, `MainTabsNavigator.js`, and `BrandTabsNavigator.js`).
