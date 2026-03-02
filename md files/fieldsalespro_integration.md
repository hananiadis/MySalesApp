# FieldSales Pro Integration Plan

## Goals
- Wire FieldSales Pro web app to existing MySalesApp data (customers, orders, auth) without breaking mobile flows.
- Add visit planning/execution, territory planning, and route optimization as first-class data in Firestore.
- Keep web app modular (can be served separately) while reusing Firebase Auth and Firestore.

## Firestore Data Model Additions

### territories (per brand or shared)
- `id` (string, doc id)
- `brand` (string: playmobil|kivos|john|shared)
- `name` (string)
- `code` (string)
- `geojson` (object) // boundary polygon/collection
- `centroid` ({ lat: number, lng: number })
- `capacityPerWeek` (number) // optional limit of visits per week
- `active` (boolean)
- `updatedAt` (timestamp)

Index: `brand`, `active` for listing; `code` unique.

### territoryAssignments
- `id` (doc id)
- `territoryId` (ref or string)
- `salesmanId` (string, uid)
- `salesmanName` (string)
- `brand` (string)
- `startDate` (timestamp)
- `endDate` (timestamp|null)
- `status` (string: active|planned|ended)
- `updatedAt` (timestamp)

Index: `territoryId`, `status`; compound `brand + salesmanId + status`.

### twoMonthSchedules
- `id`
- `brand`
- `periodStart` (date, first day of 2-month window)
- `periodEnd` (date)
- `ownerId` (uid of manager)
- `status` (draft|submitted|approved|rejected)
- `notes` (string)
- `updatedAt`
- `assignments`: array of blocks
  - `territoryId`
  - `salesmanId`
  - `weekOf` (date, ISO week start)
  - `capacityPlanned` (number of visits)
  - `color` (string)

Index: `brand + periodStart + status`.

### visitPlans
- `id`
- `brand`
- `scheduleId` (twoMonthSchedules.id)
- `salesmanId`
- `territoryId`
- `customerId` (Firestore customer doc id)
- `customerCode` (string)
- `date` (date)
- `timeWindow` ({ start: string, end: string } | null)
- `priority` (low|medium|high)
- `visitType` (planned|spontaneous)
- `status` (planned|in-progress|completed|canceled|missed)
- `plannedRouteId` (string|null)
- `notes` (string)
- `updatedAt`

Index: `salesmanId + date`, `territoryId + date`, `customerCode + date`.

### visitExecutions
- `id` (ideally same as visitPlans.id when matched)
- `brand`
- `planId` (visitPlans.id|null for spontaneous)
- `salesmanId`
- `customerId`
- `customerCode`
- `territoryId`
- `checkInAt` (timestamp|null)
- `checkOutAt` (timestamp|null)
- `locationCheckIn` ({ lat, lng }|null)
- `locationCheckOut` ({ lat, lng }|null)
- `outcome` ({ metDecisionMaker: bool, quotePresented: bool, saleClosed: bool })
- `notes` (string)
- `photos` (array of storage paths)
- `signaturePath` (string|null)
- `followUpDate` (date|null)
- `status` (in-progress|completed|canceled)
- `orderIds` (array of order doc ids) // link to existing orders collections
- `updatedAt`

Index: `salesmanId + checkInAt`, `customerCode + checkInAt`, `territoryId + checkInAt`.

### routes
- `id`
- `brand`
- `salesmanId`
- `date`
- `territoryId`
- `stops`: array of { visitPlanId, customerId, customerCode, lat, lng, eta, etd }
- `distanceMeters` (number)
- `durationSeconds` (number)
- `optimizer` (osrm|google)
- `createdAt`, `updatedAt`

Index: `salesmanId + date`.

### routeOptimizations (optional log)
- `id`
- `routeId`
- `request` (origin, stops, constraints)
- `response` (distance matrix/steps)
- `status` (success|failed)
- `createdAt`

## API Contract (BFF/Cloud Functions)
All endpoints secured via Firebase Auth (bearer token). Responses JSON; errors `{ error: string, code: string }`.

### Auth/Context
- Expect `x-brand` header (playmobil|kivos|john|shared) for brand scoping.
- Role checks: managers/admins can write schedules/assignments; salesmen can read their own plans and post executions.

### GET /api/customers
Query params: `search`, `territoryId`, `salesmanId`, `limit`, `pageToken`.
Returns: paginated customers with `territoryId`, `visitCadenceDays`, `lastVisitAt`, `nextVisitDue`.

### POST /api/territories
Body: territory fields above. Role: manager/admin.

### GET /api/territories
Filters: `brand`, `active`.

### POST /api/territory-assignments
Body: { territoryId, salesmanId, startDate, endDate }.

### GET /api/territory-assignments
Filters: `territoryId`, `salesmanId`, `status`.

### POST /api/schedules
Creates 2-month schedule.
Body: { brand, periodStart, periodEnd, assignments, status }.

### GET /api/schedules
Filters: `brand`, `periodStart`, `status`.

### POST /api/schedules/{id}/status
Body: { status: submitted|approved|rejected, note }.

### POST /api/visit-plans
Create/replace visit plans for a given day.
Body: { brand, date, salesmanId, territoryId, visits: [visitPlans fields] }.

### GET /api/visit-plans
Filters: `date`, `salesmanId`, `territoryId`, `status`.

### POST /api/visit-executions
Body: visitExecutions fields; if `planId` provided, mark plan status accordingly.

### PATCH /api/visit-executions/{id}
Update outcome, notes, media, follow-up, orderIds, status.

### POST /api/routes/optimize
Body: { brand, salesmanId, date, origin: {lat,lng}, stops: [{ visitPlanId, lat, lng, timeWindow? }], constraints: { lunchWindow?, travelBufferMins?, maxVisits? } }
Returns: { routeId, orderedStops, distanceMeters, durationSeconds }.

### GET /api/routes
Filters: `salesmanId`, `date`.

### POST /api/orders/attach-visit
Body: { orderId, visitExecutionId } → updates order doc with `visitId` and updates visit execution `orderIds`.

## Data Alignment with Existing Collections
- Customers: extend docs with `territoryId`, `visitCadenceDays`, `lastVisitAt`, `nextVisitDue`.
- Orders: add `visitId` (string|null), `visitDate` (date) to support attribution.
- Users: ensure `role` and `brands` already set; add optional `territoryIds` array for filtering.

## Suggested Indexes
- `visitPlans`: `salesmanId + date`, `territoryId + date`.
- `visitExecutions`: `salesmanId + checkInAt`, `customerCode + checkInAt`.
- `twoMonthSchedules`: `brand + periodStart + status`.
- `routes`: `salesmanId + date`.

## Rollout Steps
1) Create collections/indexes in Firestore and update security rules to enforce brand + role scoping.
2) Implement BFF endpoints (Cloud Functions or HTTPS) that wrap Firestore and OSRM/Google optimization.
3) Wire FieldSales Pro to these endpoints; replace mock data for territories, schedules, visit plans, and executions.
4) In MySalesApp mobile, add optional `visitId` when creating orders and expose a shortcut to open FieldSales Pro.
