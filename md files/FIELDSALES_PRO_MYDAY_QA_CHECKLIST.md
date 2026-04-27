# FieldSales Pro My Day QA Checklist

## Scope
This checklist verifies the My Day flow after visit plan and execution persistence changes.

## Preconditions
1. Use a user account with FieldSales Pro access and at least one assigned brand.
2. Ensure at least one visit plan exists for today in the same brand.
3. Open FieldSales Pro inside the app/web wrapper with a valid runtime token.
4. Confirm backend endpoint is reachable:
   - https://api-ibobnvtbvq-ew.a.run.app

## A. Load and Render
1. Open My Day page.
Expected: Page loads without crash and shows either scheduled visits or empty state.
2. If visits exist for today, confirm each card shows:
Expected: customer, time, priority, current status, and actions.
3. If no visits exist, confirm empty-state message appears.
Expected: No console error and no blocking UI issue.

## B. Check-in Persistence
1. On an upcoming visit, tap Start Visit.
Expected: UI changes to in-progress immediately.
2. Refresh page.
Expected: The same visit remains in-progress (persisted from backend).
3. Verify no duplicate cards were created for the same plan.
Expected: Single visit card with updated status.

## C. Complete Visit Persistence
1. On an in-progress visit, tap Complete Visit.
2. In modal, select outcome and fill notes.
3. Submit completion.
Expected: Visit status becomes completed.
4. Refresh page.
Expected: Visit remains completed and completion data persists.

## D. Scheduling Sync
1. Open Visit Scheduling page for current week.
Expected: The same visit appears with completed/in-progress status badge.
2. Confirm status badge text matches My Day status.
Expected: Status consistency between My Day and Scheduling.

## E. Failure Handling
1. Temporarily break network connection and attempt check-in.
Expected: User sees clear error message; UI should not remain in a false persisted state.
2. Restore network and retry.
Expected: Action succeeds and status persists after refresh.

## F. Role and Access Guardrails
1. Login as salesman and verify only own visits appear.
Expected: No cross-user visit data visible.
2. Login as manager and verify weekly scheduling shows assigned team plans (if applicable in data).
Expected: Manager view remains functional without authorization errors.

## G. Regression Spot Check
1. Customer Management still loads customer data.
2. Territory Planning still loads territories/assignments.
3. Firestore rules deployment target remains canonical:
   - firebase/firestore.rules

## Pass Criteria
1. Check-in and completion persist across refresh.
2. Scheduling status badges reflect execution state.
3. No blocking errors in console/network for normal flow.
4. No unrelated module regressions observed.
