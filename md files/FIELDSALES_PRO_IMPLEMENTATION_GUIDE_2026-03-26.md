# FieldSales Pro — Implementation Plan & Guide (2026-03-26)

This guide turns the existing specs into an executable plan to implement the **FieldSales Pro** module (2‑month planning + daily visit planning/execution + manager oversight) and integrate it with **MySalesApp** (customers, orders, auth).

## What exists today (confirmed)

### Mobile entry point
- The MySalesApp home button **Διαχείριση Επισκέψεων** navigates to the stack route `FieldSalesPro`.
- That route renders a WebView wrapper: [src/screens/FieldSalesProScreen.js](../src/screens/FieldSalesProScreen.js)
- The WebView loads a **local packaged web build** from:
  - Android: `file:///android_asset/build/index.html` → [android/app/src/main/assets/build/index.html](../android/app/src/main/assets/build/index.html)

### Current web module state
- The shipped web bundle in [android/app/src/main/assets/build/assets](../android/app/src/main/assets/build/assets) is **UI with mock data** (hardcoded salesmen/customers, map iframes, etc.).
- The native wrapper currently injects `window.FIREBASE_USER_TOKEN` as **UID** (and email), not an ID token.
- The web app does **not** appear to consume those injected globals yet.

## Source specs we will implement

1) Data model + API contract proposal: [md files/fieldsalespro_integration.md](fieldsalespro_integration.md)
2) Feature spec / UX flows: [FieldSales Pro/instructions.md](../FieldSales%20Pro/instructions.md)
3) Existing app navigation map (for where module lives): [md files/NavigationMap.md](NavigationMap.md)
4) Existing Firestore collections (customers/orders/users): [firestore-import/firestore_schema.json](../firestore-import/firestore_schema.json)

## Key decision (pick once; affects everything)

### Option A — Web talks directly to Firestore
- Web app uses Firebase Web SDK → reads/writes Firestore directly.
- Pros: fewer backend pieces.
- Cons: WebView auth bridging is tricky (web SDK needs an auth session; you can’t “just pass UID”). Rules + query analyzability can also become complex.

### Option B — BFF (recommended) + Firestore as DB
- Web app calls HTTPS endpoints (Cloud Functions / Cloud Run) with `Authorization: Bearer <Firebase ID token>`.
- Backend verifies token, enforces role/brand rules, and reads/writes Firestore (Admin SDK).
- Pros:
  - Works cleanly in WebView: native can inject a fresh **ID token**.
  - Keeps Firestore rules simpler (client does not need broad read/write).
  - Lets us centralize logic: conflict detection, optimization, computed fields.
- Cons: must implement and deploy backend.

**Recommendation:** Option B.

The rest of this guide assumes **Option B**.

---

## Data model (Firestore) — new collections

Start from [md files/fieldsalespro_integration.md](fieldsalespro_integration.md). Summary:

### New collections
- `territories`
- `territoryAssignments`
- `twoMonthSchedules`
- `visitPlans`
- `visitExecutions`
- `routes`
- `routeOptimizations` (optional log)

### Existing collections we will extend (minimal)
From [firestore-import/firestore_schema.json](../firestore-import/firestore_schema.json):
- Customers are currently stored in brand-specific collections:
  - Playmobil: `customers`
  - Kivos: `customers_kivos`
  - John: `customers_john`
- Orders are in brand-specific collections:
  - `orders_kivos`, `orders_john` (and likely `orders_playmobil` in practice)
  - Supermarket flow uses `orders_{brand}_supermarket` (see [md files/Curved_Navigation_Implementation_Prompt.md](Curved_Navigation_Implementation_Prompt.md))

Add optional fields:
- Customer docs:
  - `territoryId` (string|null)
  - `visitCadenceDays` (number|null)
  - `lastVisitAt` (timestamp|null)
  - `nextVisitDue` (timestamp|null)
- Order docs (per brand order collection):
  - `visitId` (string|null) // points to visitExecutions id
  - `visitDate` (timestamp|null)

### Indexes to create (minimum viable)
- `visitPlans`: `(salesmanId, date)`, `(territoryId, date)`
- `visitExecutions`: `(salesmanId, checkInAt)`, `(customerCode, checkInAt)`
- `twoMonthSchedules`: `(brand, periodStart, status)`
- `routes`: `(salesmanId, date)`

---

## Auth, roles, and brand scoping

### Identity source
- MySalesApp already authenticates users via Firebase Auth.
- User profile/role is stored in `users/{uid}` (see schema in [firestore-import/firestore_schema.json](../firestore-import/firestore_schema.json)).

### Roles we will enforce
- **Salesman**: can read/write own daily execution data; can read own plans.
- **Sales Manager** (`sales_manager`) and Admin/Owner/Developer: can create territories, assignments, schedules; can read team dashboards.

### Brand scoping
- Requests must include `x-brand: playmobil|kivos|john|shared`.
- Backend checks the user’s `users/{uid}.brands` includes that brand (or user is admin).

---

## WebView ↔ Web App authentication bridge (required for Option B)

### What to change in the mobile wrapper
In [src/screens/FieldSalesProScreen.js](../src/screens/FieldSalesProScreen.js):
1) Inject an **ID token**, not UID:
   - `const idToken = await user.getIdToken(/* forceRefresh? */ false)`
   - Inject it as `window.MYSALES_ID_TOKEN` (or similar).
2) Add a refresh mechanism:
   - Web app posts message `{ type: 'REQUEST_ID_TOKEN' }`.
   - Native replies by injecting a refreshed token or using `postMessage` back.

### What the web app should do
- Read token from `window.MYSALES_ID_TOKEN`.
- Call BFF endpoints with:
  - `Authorization: Bearer <token>`
  - `x-brand: <brand>`

---

## Backend (BFF) — minimal endpoint set

Start from the integration doc’s contract; MVP endpoints:

### Customers
- `GET /api/customers?search=&territoryId=&salesmanId=`
  - Backend queries the brand’s customer collection and returns normalized fields.

### Territories + assignments (manager)
- `GET /api/territories`
- `POST /api/territories`
- `GET /api/territory-assignments`
- `POST /api/territory-assignments`

### Two-month schedule (manager)
- `POST /api/schedules` (create/update as draft)
- `GET /api/schedules` (list)
- `POST /api/schedules/{id}/status` (submit/approve/reject)

### Daily plan + execution (salesman)
- `GET /api/visit-plans?date=&salesmanId=`
- `POST /api/visit-plans` (manager writes or salesman writes own, depending on policy)
- `POST /api/visit-executions` (create/check-in/out + outcome)
- `PATCH /api/visit-executions/{id}`

### Routes (optional for MVP)
- `POST /api/routes/optimize`
- `GET /api/routes?salesmanId=&date=`

### Orders integration
- `POST /api/orders/attach-visit` (attach order ↔ visit)

**Implementation note:** Use Firebase Admin SDK inside Functions to access Firestore; implement role checks in code (not only rules).

---

## Milestone plan (practical, testable)

### Milestone 0 — Baseline wiring (1–2 days)
Goal: stop guessing; verify the module can authenticate to an API.
- Add WebView injection of **ID token** + a simple `GET /api/health` call from web app.
- Add a minimal backend endpoint that verifies token and returns `{ uid, role, brands }`.

Exit criteria:
- Opening FieldSales Pro inside MySalesApp successfully shows “authenticated” in the web UI using the real signed-in user.

### Milestone 1 — Customer read + territory assignment (3–5 days)
Goal: use real customer data + basic territory mapping.
- Implement `GET /api/customers` with brand-specific collection routing.
- Implement `GET/POST /api/territories` and `GET/POST /api/territory-assignments`.
- Update **Customer Management** page to load real customers and show territory fields.

Exit criteria:
- Manager can assign a territory to customers (or to salesmen via assignments) and see it reflected in the UI.

### Milestone 2 — Daily plan (visitPlans) (4–7 days)
Goal: build the real “visit scheduling” functionality.
- Implement `visitPlans` CRUD:
  - list by `salesmanId + date` and by week.
  - write a set of visit plans for a day.
- Update **Visit Scheduling** page: replace mock visit list with real visits.

Exit criteria:
- A salesman can open “My Day” and see *today’s* planned customers.

### Milestone 3 — Execution (visitExecutions) + basic manager view (5–10 days)
Goal: real check-in/out and outcomes.
- Implement `visitExecutions` create/update:
  - check-in/out timestamps
  - outcome fields
  - notes + follow-up date
- Update **My Day Mobile** page:
  - “Check in”, “Check out”, “Complete”, “Missed/Cancel”.
- Update **Manager Dashboard**:
  - show team progress from `visitExecutions`.

Exit criteria:
- Manager can see plan vs actual by day; salesman can complete visits.

### Milestone 4 — 2‑month schedule workflow (manager) (1–2 weeks)
Goal: implement the strategic planning piece.
- Implement `twoMonthSchedules` with statuses.
- Implement conflict detection (server-side):
  - same territory assigned to two salesmen for same week
  - capacity over limits
- Update **Territory Planning** to load/save schedules and assignments.

Exit criteria:
- Manager creates a 2‑month schedule draft, submits, approves, and salesmen see their assigned weeks.

### Milestone 5 — Route optimization (optional, after core works)
Goal: real ordered stops.
- Implement `routes` generation and store ordered stops.
- Start simple:
  - call OSRM public endpoint (or chosen provider) and store result.
  - provide “Open in Google Maps” deep link export.

Exit criteria:
- “Optimize today’s route” produces an ordered stop list + distance/time.

### Milestone 6 — Orders attribution (ongoing)
Goal: connect visits to revenue.
- Add `visitId` to brand order docs when an order is created from/after a visit.
- Provide UI action “Attach last visit” for an order, or auto-attach by timestamp proximity.

Exit criteria:
- Manager analytics can compute revenue per territory/salesman using orders tied to visits.

---

## Implementation notes (avoid known pitfalls)

### 1) Avoid Firestore rules/query pain in the web app
- If we keep web on BFF-only, the web client does not need broad Firestore rules.
- Keep any direct Firestore access limited to what mobile already needs.

### 2) Normalizing customers across brand collections
- Implement a single DTO in the backend:
  - `{ id, customerCode, name, address, city, postalCode, lat?, lng?, territoryId?, merch?, brand }`
- Internally, map from `customers` vs `customers_kivos` vs `customers_john` shapes.

### 3) Dates and timezones
- Persist visit plan `date` as **YYYY‑MM‑DD string** OR normalized UTC midnight timestamp.
- Be consistent across `visitPlans`, `routes`, and schedule weeks.

### 4) Offline (later milestone)
- MVP: online-only.
- Then add:
  - cache today’s plan in localStorage/IndexedDB
  - queue visit execution updates and replay when online

---

## “First tasks” checklist (do these next)

1) Decide architecture: **Option B (BFF)**.
2) Decide brand routing rules for customers/orders (Playmobil: `customers`, Kivos: `customers_kivos`, John: `customers_john`).
3) Add WebView injection of **Firebase ID token** (not UID) and implement a `GET /api/me` endpoint.
4) Replace mock data in **My Day Mobile** first (highest value).

---

## Approved execution sequence (gated)

This is the approved delivery order for **Option B**. We do **not** move to the next milestone until the current one passes its exit criteria in the app.

### Runtime choice
- **Recommended:** Firebase **Cloud Functions** (HTTPS) in `europe-west1`.
- **Why this over Cloud Run:** for this repo, Functions is cheaper to operate in practice because setup and deployment are simpler, and runtime costs are typically comparable at low-to-moderate traffic when both scale to zero.
- **When to reconsider Cloud Run:** only if we later need custom containers, heavier dependencies, or tighter control over concurrency/CPU.

### Milestone 0 — Auth + plumbing
Goal: prove the embedded web app can authenticate against a backend using the signed-in MySalesApp user.

Build:
- Create a new `functions/` project in this repo.
- Add `GET /api/health` and `GET /api/me`.
- Verify Firebase ID token in backend and load `users/{uid}` for `role` and `brands`.
- Update [src/screens/FieldSalesProScreen.js](../src/screens/FieldSalesProScreen.js) to inject:
  - `window.MYSALES_ID_TOKEN`
  - `window.MYSALES_ROLE`
  - `window.MYSALES_BRANDS`
  - `window.MYSALES_BFF_BASE_URL`
  - `window.MYSALES_DEFAULT_BRAND`
- Add token refresh bridge:
  - web posts `{ type: 'REQUEST_ID_TOKEN' }`
  - native injects a fresh token from `user.getIdToken(true)`

Validate before continuing:
- FieldSales Pro opens inside the app and `/api/me` returns the active user context.
- Forced token refresh succeeds without reopening the screen.

### Milestone 1 — Customer Management
Goal: switch Customer Management from mocks to real Firestore-backed data.

Build:
- Backend endpoints:
  - `GET /api/customers`
  - `PATCH /api/customers/:id`
  - `GET /api/territories`
- Normalize customer data across:
  - `customers`
  - `customers_kivos`
  - `customers_john`
- Replace `mockCustomers` in [FieldSales Pro/src/pages/customer-management/index.jsx](../FieldSales%20Pro/src/pages/customer-management/index.jsx).

Validate before continuing:
- Search/filter works against real customers.
- Territory updates persist and reload correctly.
- Brand switching shows the correct customer base.

### Milestone 2 — Territories + assignments
Goal: make territory creation and salesman assignment real and persistent.

Build:
- Backend endpoints:
  - `GET /api/territories`
  - `POST /api/territories`
  - `PATCH /api/territories/:id`
  - `GET /api/territory-assignments`
  - `POST /api/territory-assignments`
- Replace in-memory territory assignment logic in [FieldSales Pro/src/pages/territory-planning/index.jsx](../FieldSales%20Pro/src/pages/territory-planning/index.jsx).

Validate before continuing:
- Manager can create/edit territories.
- Manager can assign a salesman and see persisted results after reload.

### Milestone 3 — Visit Scheduling
Goal: replace the weekly scheduling mocks with real `visitPlans` data.

Build:
- Backend endpoints:
  - `GET /api/visit-plans?weekOf=&salesmanId=`
  - `POST /api/visit-plans`
- Replace `mockScheduledVisits` and mock customer scheduling input in [FieldSales Pro/src/pages/visit-scheduling/index.jsx](../FieldSales%20Pro/src/pages/visit-scheduling/index.jsx).
- Persist drag/drop changes to backend.

Validate before continuing:
- Weekly plans save and reload correctly.
- Salesman sees only own plans; manager can inspect team plans.

### Milestone 4 — My Day Mobile
Goal: make day-of execution real using `visitExecutions`.

Build:
- Backend endpoints:
  - `GET /api/visit-plans?date=&salesmanId=me`
  - `POST /api/visit-executions`
  - `PATCH /api/visit-executions/:id`
- Replace hardcoded visits in [FieldSales Pro/src/pages/my-day-mobile/index.jsx](../FieldSales%20Pro/src/pages/my-day-mobile/index.jsx).
- Persist check-in, check-out, outcome, notes, and follow-up.

Validate before continuing:
- A planned visit appears in My Day.
- Check-in/check-out changes are saved and visible on refresh.
- Completed visits become visible for manager reporting.

### Milestone 5 — Manager Dashboard
Goal: replace dashboard widgets with real operational data.

Build:
- Backend endpoints:
  - `GET /api/manager/team-status?date=`
  - `GET /api/manager/activity?since=`
- Replace mock metrics, activity feed, and team status blocks in [FieldSales Pro/src/pages/manager-dashboard/index.jsx](../FieldSales%20Pro/src/pages/manager-dashboard/index.jsx) and its child components.

Validate before continuing:
- Manager sees real plan-vs-actual progress.
- Dashboard totals match underlying visit plans and executions.

### Milestone 6 — Two-month planning + approvals
Goal: implement the strategic planning workflow, not just daily scheduling.

Build:
- Backend endpoints:
  - `GET /api/schedules`
  - `POST /api/schedules`
  - `POST /api/schedules/:id/status`
- Add conflict detection on save/submit.
- Wire schedule persistence into [FieldSales Pro/src/pages/territory-planning/index.jsx](../FieldSales%20Pro/src/pages/territory-planning/index.jsx).

Validate before continuing:
- Manager can create a draft 2-month plan.
- Submit/approve flow works.
- Invalid schedule conflicts are blocked server-side.

### Milestone 7 — Performance Analytics
Goal: switch analytics to real metrics after the operational data model is proven.

Build:
- Backend endpoint:
  - `GET /api/analytics/overview?range=`
- Start with visit-based metrics first.
- Add order attribution later after core execution flow is stable.

Validate before continuing:
- Analytics renders real data with correct role/brand scoping.
- Numbers reconcile with known visit data for a controlled test case.

### Packaging gate
Because the web app stays embedded as local Android assets:
- Build FieldSales Pro and copy `dist/` into `android/app/src/main/assets/build/`.
- Verify the updated asset build works inside the Android app and can call the BFF.

Final release check:
- Fresh Android build loads the new FieldSales Pro UI.
- All completed milestones continue to pass after packaging.

### Out of initial gated scope
- Route optimization API
- Orders attribution / revenue-per-visit
- Offline-first sync queue

---

## Appendix: Where the UI pages live

FieldSales Pro routes: [FieldSales Pro/src/Routes.jsx](../FieldSales%20Pro/src/Routes.jsx)
- `/manager-dashboard`
- `/territory-planning`
- `/visit-scheduling`
- `/my-day-mobile`
- `/customer-management`
- `/performance-analytics`
