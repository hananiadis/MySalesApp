# Expense Module — Status Recap (2026-03-26)

## Recap (What we built)
- Turned the app into a weekly expense workflow: draft week tracking (“Ταμείο” carry-over + car persistence) → submit → manager approval via “Inbox” + “Αναφορές Ομάδας”.
- Renamed the report to “Εβδομαδιαίο Εξοδολόγιο” and added an A4 PDF print/share with richer header metadata (logo precedence, submitted/approved timestamps + “by who”, etc.).
- Added manager numbering sequences per year (A1/A2… reset yearly) for approved submissions.

## The big incident we fixed
- Managers were getting `firestore/permission-denied` when opening Inbox / Team Reports because the query on `weeklyReportSubmissions` wasn’t allowed by the published Firestore rules.
- We added release-safe ADB logging + a “get probe” to prove whether rules were live, then authenticated Firebase CLI and deployed the correct rules to the correct project.
- Relevant files:
  - `firebase/firestore.rules`
  - `warehouse-web/firestore.rules`
  - `src/services/expenseService.js`

## Where we are now
- Permission issues are resolved.
- We improved the list rows in both manager screens to show:
  - who submitted (salesman name/email)
  - total cost + breakdown: invoices vs receipts (totals + counts)
- These fields are written into the submission `summary` at submit-time, and the screens render them with fallback for older submissions:
  - `src/services/expenseService.js`
  - `src/screens/ManagerInboxScreen.js`
  - `src/screens/ManagerWeeklyReportScreen.js`

## Where we’re going next (recommended)
- Backfill older `weeklyReportSubmissions` docs so historic weeks also show invoice/receipt totals + counts (or accept that only newly re-submitted weeks have the breakdown).
- Confirm the UX details you want for the “Submitted by” label (full name vs email, and where it should appear in each row).
- Optional hardening: if you ever see rules/query flakiness again, migrate to a manager-specific inbox collection (query becomes trivial + rules become simpler).
