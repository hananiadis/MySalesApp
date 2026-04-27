# Οδηγός Προγραμματιστή για την Ενότητα Εξοδολόγιο

## Σκοπός

Το έγγραφο αυτό εξηγεί πώς είναι χτισμένη σήμερα η ενότητα εξόδων στο MySalesApp, ποια αρχεία έχουν την ευθύνη για κάθε μέρος της ροής και τι πρέπει να ελέγχεται πριν από οποιαδήποτε επέκταση ή αλλαγή.

Η ενότητα δεν είναι μία μόνο οθόνη. Είναι ένα μικρό λειτουργικό υποσύστημα που αποτελείται από:

- ξεχωριστό tab navigator
- shared context/provider για διαχείριση state και actions
- service layer με Firestore persistence
- ροή weekly tracking και weekly submission
- οθόνες έγκρισης για διαχειριστές
- shared modal φόρμα για category-specific καταχώρηση

## Τρέχουσα Αρχιτεκτονική Πλοήγησης

### Σημείο εισόδου

Η εφαρμογή φορτώνει την ενότητα μέσω του `ExpenseProvider` μέσα στο `App.js`.

Τρέχουσα βασική ροή routes:

- `App.js`
  - `Stack.Screen name="ExpenseTracker" component={ExpenseTabsNavigator}`
  - `Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen}`

### Persistent πλοήγηση της ενότητας

Η ενότητα χρησιμοποιεί το `src/navigation/ExpenseTabsNavigator.js`.

Ο navigator αυτός είναι μοντελοποιημένος πάνω στην αρχιτεκτονική των brand tabs:

- κρυφό default tab bar
- custom `CurvedBottomBar`
- persistent curved bottom navigation σε όλες τις βασικές expense sub-screens
- centered FAB routed μέσω του shared bar

Ορατά tabs:

- `ExpenseTracker`
- `ExpenseReports`
- `WeeklyTracking`
- `WeeklyReport`
- `ManagerInbox` αν ο ρόλος είναι approver
- `ManagerWeeklyReport` αν ο ρόλος είναι approver

Συμπεριφορά FAB:

- το FAB δεν ανοίγει απευθείας κάποιο global modal
- κάνει navigate στο `ExpenseTracker` με `{ openAddMenu: true }`
- το `ExpenseTrackerScreen` διαβάζει αυτό το param και ανοίγει το category sheet

Με αυτόν τον τρόπο διατηρείται μία ενιαία popup ροή προσθήκης εξόδου σε όλη την ενότητα.

## Αρχιτεκτονική State

### Provider

Το βασικό state ζει στο `src/context/ExpenseContext.js`.

Ο provider είναι υπεύθυνος για:

- current user id και role
- expense list loading
- filtered expense list και summary
- current week tracking state
- manager assigned salesmen
- manager report loading
- public actions που χρησιμοποιούνται από τα screens

Σημαντικά exported actions που χρησιμοποιεί το UI:

- `addNewExpense(expenseData)`
- `updateExistingExpense(expenseId, updates)`
- `deleteExistingExpense(expenseId)`
- `saveTracking(trackingData)`
- `fetchWeeklyTracking(weekId)`
- `submitWeeklyReportToManager(weekId)`
- `setDateRange(startDate, endDate)`
- `setCategoryFilter(categoryIds)`
- `setStatusFilter(status)`
- `setSortBy(sortOption)`
- `loadManagerReport(userIds, weekStartDate)`
- `reloadAssignedSalesmen()`

### Μοντέλο φόρτωσης

Το μοντέλο φόρτωσης στον provider παραμένει σκόπιμα απλό:

- initial expenses load από date range
- weekly tracking φορτώνεται ξεχωριστά
- assigned salesmen φορτώνονται μόνο για approver roles

Τα περισσότερα screens κρατούν επίσης local UI state για:

- modal visibility
- current selected week
- selected group/category
- local filter chips

## Service Layer

Το βασικό persistence layer βρίσκεται στο `src/services/expenseService.js`.

### Firestore collections

Οι βασικές collections που χρησιμοποιούνται σήμερα είναι:

- `expenses/{userId}/records/{expenseId}`
- `weeklyTracking/{userId}/weeks/{weekId}`
- `weeklyReportSubmissions/{submissionId}`
- `weeklyReportSeries/...`

### Κύριες ευθύνες του service layer

- CRUD για μεμονωμένα expenses
- save/load του weekly tracking
- δημιουργία weekly report
- weekly submission για approval
- queries για το manager inbox
- actions έγκρισης για διαχειριστές
- AsyncStorage-based caching helpers

Σημαντικές manager functions:

- `getManagerWeeklyReportSubmissions(managerId)`
- `getWeeklyReportSubmissionsByWeekId(weekId)`
- `approveWeeklyReportSubmission({ managerId, salesmanId, weekId })`

## Constants και Domain Model

Το `src/constants/expenseConstants.js` είναι το βασικό domain reference file.

Ορίζει:

- `EXPENSE_GROUPS`
- `EXPENSE_CATEGORIES`
- `EXPENSE_STATUS`
- `PAYMENT_METHODS`
- `INVOICE_TYPES`
- `FUEL_TYPES`
- `SERVICE_TYPES`
- week helpers όπως `getWeekId`, `getWeekStartEnd`, `getMondayFromWeekId`
- category helpers όπως `getCategoryLabel`, `getCategoriesByGroup`, `getAllCategoryGroups`

Οι τρέχουσες top-level ομάδες είναι:

- `ΜΕΤΑΚΙΝΗΣΗ`
- `ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ`
- `ΔΙΑΦΟΡΑ`

## Ευθύνη ανά Screen

### `ExpenseTrackerScreen`

Σκοπός:

- landing hub της ενότητας
- current month summary
- recent weekly reports
- add-expense popup entry

Σημαντικές σημειώσεις:

- πλέον βρίσκεται μέσα στα persistent expense tabs
- περιέχει το canonical add-category bottom sheet
- ανοίγει το `ExpenseDetailModal` για δημιουργία ή επεξεργασία εξόδου

### `ExpenseReportsScreen`

Σκοπός:

- report-style overview των εξόδων grouped by week και άλλων summaries

### `WeeklyTrackingScreen`

Σκοπός:

- weekly mileage
- petty cash
- daily locations
- weekly expense list
- add-expense popup μέσα στο weekly flow

Σημαντικές σημειώσεις:

- περιέχει αντίστοιχη category popup flow
- αποθηκεύει εβδομαδιακά operational δεδομένα ξεχωριστά από τα single expense records

### `WeeklyReportScreen`

Σκοπός:

- weekly report review για τον πωλητή
- submission και manager-facing read mode

### `ManagerInboxScreen`

Σκοπός:

- manager inbox με submitted weekly reports που περιμένουν review ή approval

### `ManagerWeeklyReportScreen`

Σκοπός:

- week-based manager view πάνω στις submitted reports

### `ExpenseDetailScreen`

Σκοπός:

- full screen expense detail flow για stack-based detail editing/navigation

### `ExpenseDetailModal`

Σκοπός:

- shared category-specific create/edit form που χρησιμοποιείται από τα popup flows

Βασικά category-specific UI blocks που χειρίζεται σήμερα:

- fuel
- car service
- hotel
- tickets
- taxi

## UI System και Styling

Η πρόσφατη εργασία έφερε την ενότητα εξόδων πιο κοντά οπτικά στην ενότητα Order Management.

### Shared style direction

- primary blue: `#185FA5`
- light blue background: `#E6F1FB`
- page background: `#f7f5f0`
- λευκές card surfaces
- soft neutral borders
- rounded sheet/card treatment

Αυτό υλοποιείται σήμερα με local `TOKENS` objects μέσα στα expense screens και modal components.

Δεν έχει ακόμη εξαχθεί σε ένα κεντρικό `expenseTheme.js`, οπότε αν γίνει βαθύτερο refactor, αυτό είναι μια λογική επόμενη κίνηση.

### Shared curved nav

Τα expense tabs χρησιμοποιούν πλέον απευθείας το `src/components/CurvedBottomBar.js`.

Αυτό σημαίνει ότι οποιαδήποτε μελλοντική οπτική αλλαγή στο shared curved bar μπορεί να επηρεάσει αυτόματα:

- brand home style tabs
- expense module tabs

## Κύρια User Workflows

### Ροή πωλητή

1. Ανοίγει την ενότητα εξόδων
2. Πατάει FAB ή add button
3. Επιλέγει group
4. Επιλέγει category
5. Συμπληρώνει τη φόρμα στο `ExpenseDetailModal`
6. Αποθηκεύει draft expense
7. Ανοίγει weekly tracking ή weekly report
8. Υποβάλλει το weekly report στον υπεύθυνο

### Ροή διαχειριστή

1. Ανοίγει την ενότητα εξόδων
2. Χρησιμοποιεί `Εισερχόμενα` ή `Ομάδα`
3. Ανοίγει τη weekly submission
4. Κάνει έλεγχο στο report και στα expenses
5. Εγκρίνει από τα manager screens

## Κανόνες Ρόλων

Τα role checks γίνονται μέσω του `isExpenseApproverRole(...)`.

Συμπεριφορές μόνο για approver ρόλους:

- manager tabs visible στο `ExpenseTabsNavigator`
- salesman selector στο `ExpenseDetailModal`
- manager inbox και team weekly screens
- approval actions

## Οδηγίες Επέκτασης

### Προσθήκη νέας κατηγορίας εξόδου

1. Προσθέστε τη στο `EXPENSE_CATEGORIES` μέσα στο `expenseConstants.js`
2. Τοποθετήστε τη στο σωστό `EXPENSE_GROUPS` group
3. Ενημερώστε τυχόν icon mapping σε:
   - `ExpenseTrackerScreen`
   - `WeeklyTrackingScreen`
4. Αν χρειάζεται custom fields, επεκτείνετε το `ExpenseDetailModal`
5. Αν αλλάζουν οι κανόνες validation, ενημερώστε το `validateExpense(...)`
6. Επιβεβαιώστε ότι το weekly report rendering συνεχίζει να λειτουργεί σωστά

### Προσθήκη νέας manager action

1. Προσθέστε service-layer function στο `expenseService.js`
2. Συνδέστε role gating όπου χρειάζεται
3. Προσθέστε την action στο σωστό manager screen
4. Κάντε refresh στο local state μετά το mutation

### Αλλαγή tab layout

Χρησιμοποιήστε το `ExpenseTabsNavigator.js` και το `CurvedBottomBar.js`.

Μην επαναφέρετε local footer implementations μέσα στα expense screens.

## Τρέχοντα Αρχιτεκτονικά Tradeoffs

- τα styling tokens επαναλαμβάνονται τοπικά και δεν είναι ακόμη centralized
- υπάρχουν και `ExpenseDetailScreen` και `ExpenseDetailModal`, κάτι που δίνει ευελιξία αλλά έχει και εννοιολογική επικάλυψη
- το popup add flow είναι σκόπιμα anchored στο `ExpenseTrackerScreen` μέσω route params, κάτι πρακτικό αλλά όχι πλήρης global modal controller
- το `expenseService.js` καλύπτει πολλές ευθύνες και μελλοντικά μπορεί να χωριστεί σε:
  - expense CRUD
  - weekly tracking
  - weekly submissions
  - manager queries

## Προτεινόμενη Ασφαλής Στρατηγική Αλλαγών

Όταν αλλάζετε την ενότητα:

1. Ξεκινήστε από το owning screen ή service και όχι από broad search
2. Κρατήστε τις αλλαγές local σε ένα workflow slice κάθε φορά
3. Κάντε validate άμεσα στα touched files
4. Κάντε manual verification για:
   - persistent bottom nav
   - FAB add flow
   - weekly submission
   - manager approval path

## Προτεινόμενες Μελλοντικές Βελτιώσεις

- εξαγωγή `expenseTheme.js`
- εξαγωγή popup icon mapping σε shared helper
- split του `expenseService.js` σε μικρότερα domain services
- ενοποίηση `ExpenseDetailScreen` και `ExpenseDetailModal` γύρω από shared form primitives
- προσθήκη focused tests για manager approval και tab persistence
# Expense Module Developer Guide

## Purpose

This document explains how the Expense module is built today in MySalesApp, which files own each part of the workflow, and what to check before extending it.

The module is not a single screen. It is a small feature area made of:

- a dedicated tab navigator
- a shared context/provider for state and actions
- Firestore-backed services
- weekly tracking and weekly submission workflow
- manager approval screens
- a shared expense detail modal for category-specific entry

## Current Navigation Architecture

### Entry point

The app mounts the expense feature through `ExpenseProvider` inside `App.js`.

Current high-level route flow:

- `App.js`
  - `Stack.Screen name="ExpenseTracker" component={ExpenseTabsNavigator}`
  - `Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen}`

### Persistent module navigation

The expense feature uses `src/navigation/ExpenseTabsNavigator.js`.

This navigator is intentionally modeled after the brand tab architecture:

- hidden default tab bar
- custom `CurvedBottomBar`
- persistent curved bottom navigation across expense sub-screens
- centered FAB routed through the shared bar

Visible tabs:

- `ExpenseTracker`
- `ExpenseReports`
- `WeeklyTracking`
- `WeeklyReport`
- `ManagerInbox` if approver role
- `ManagerWeeklyReport` if approver role

FAB behavior:

- the FAB does not open a separate global modal directly
- it navigates to `ExpenseTracker` with `{ openAddMenu: true }`
- `ExpenseTrackerScreen` reads that param and opens the category sheet

This preserves one canonical add-expense popup flow across the module.

## State Architecture

### Provider

Main state lives in `src/context/ExpenseContext.js`.

The provider is responsible for:

- current user id and role
- expense list loading
- filtered expense list and summary
- current week tracking state
- manager assigned salesmen
- manager report loading
- public actions used by screens

Important exported actions used by the UI:

- `addNewExpense(expenseData)`
- `updateExistingExpense(expenseId, updates)`
- `deleteExistingExpense(expenseId)`
- `saveTracking(trackingData)`
- `fetchWeeklyTracking(weekId)`
- `submitWeeklyReportToManager(weekId)`
- `setDateRange(startDate, endDate)`
- `setCategoryFilter(categoryIds)`
- `setStatusFilter(status)`
- `setSortBy(sortOption)`
- `loadManagerReport(userIds, weekStartDate)`
- `reloadAssignedSalesmen()`

### Loading model

Provider-side loading is intentionally simple:

- initial expenses load from date range
- weekly tracking loads separately
- assigned salesmen load only for approver roles

Most screens also maintain local UI state for:

- modal visibility
- current selected week
- selected group/category
- local filter chips

## Service Layer

Primary persistence lives in `src/services/expenseService.js`.

### Firestore collections

Current collections used by the module:

- `expenses/{userId}/records/{expenseId}`
- `weeklyTracking/{userId}/weeks/{weekId}`
- `weeklyReportSubmissions/{submissionId}`
- `weeklyReportSeries/...`

### Main service responsibilities

- CRUD for single expenses
- weekly tracking save/load
- weekly report generation
- weekly submission for approval
- manager inbox queries
- manager approval actions
- AsyncStorage-based caching helpers

Important manager functions:

- `getManagerWeeklyReportSubmissions(managerId)`
- `getWeeklyReportSubmissionsByWeekId(weekId)`
- `approveWeeklyReportSubmission({ managerId, salesmanId, weekId })`

## Constants and Domain Model

`src/constants/expenseConstants.js` is the domain reference file.

It defines:

- `EXPENSE_GROUPS`
- `EXPENSE_CATEGORIES`
- `EXPENSE_STATUS`
- `PAYMENT_METHODS`
- `INVOICE_TYPES`
- `FUEL_TYPES`
- `SERVICE_TYPES`
- week helpers like `getWeekId`, `getWeekStartEnd`, `getMondayFromWeekId`
- category helpers like `getCategoryLabel`, `getCategoriesByGroup`, `getAllCategoryGroups`

Current top-level groups are:

- `ΜΕΤΑΚΙΝΗΣΗ`
- `ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ`
- `ΔΙΑΦΟΡΑ`

## Screen Responsibilities

### `ExpenseTrackerScreen`

Purpose:

- landing hub of the expense module
- current month summary
- recent weekly reports
- add-expense popup entry

Key notes:

- now sits inside persistent expense tabs
- contains the canonical add-category bottom sheet
- opens `ExpenseDetailModal` for new expense creation/edit

### `ExpenseReportsScreen`

Purpose:

- report-style overview of expenses grouped by week and summaries

### `WeeklyTrackingScreen`

Purpose:

- weekly mileage
- petty cash
- daily locations
- weekly expense list
- add-expense popup inside weekly flow

Key notes:

- includes a matching category popup flow
- saves weekly operational data separately from single expense records

### `WeeklyReportScreen`

Purpose:

- weekly report review for a salesman
- submission and manager-facing read mode

### `ManagerInboxScreen`

Purpose:

- manager inbox of submitted weekly reports waiting for review or approval

### `ManagerWeeklyReportScreen`

Purpose:

- week-based manager view across submitted reports

### `ExpenseDetailScreen`

Purpose:

- full screen expense detail flow still exists for stack-based detail editing/navigation

### `ExpenseDetailModal`

Purpose:

- shared category-specific create/edit form used by popup flows

Key category-specific UI blocks currently handled there:

- fuel
- car service
- hotel
- tickets
- taxi

## UI System and Styling

Recent work aligned the expense module visually with the Order Management module.

### Shared style direction

- primary blue: `#185FA5`
- light blue background: `#E6F1FB`
- page background: `#f7f5f0`
- white card surfaces
- soft neutral borders
- rounded sheet/card treatment

This is implemented as local `TOKENS` objects in the expense screens and modal components.

It is not yet centralized in a single `expenseTheme.js`, so if you need a deeper refactor, that is a sensible future cleanup.

### Shared curved nav

The expense tabs now use `src/components/CurvedBottomBar.js` directly.

That means any future visual change to the shared curved bar affects:

- brand home style tabs
- expense module tabs

## Main User Workflows

### Salesman workflow

1. Open Expense module
2. Press FAB or add button
3. Choose group
4. Choose category
5. Fill form in `ExpenseDetailModal`
6. Save draft expense
7. Open weekly tracking/report
8. Submit weekly report to manager

### Manager workflow

1. Open Expense module
2. Use `Εισερχόμενα` or `Ομάδα`
3. Open weekly submission
4. Review report and expenses
5. Approve from manager screens

## Role Rules

Role checks are done through `isExpenseApproverRole(...)`.

Approver-only behaviors include:

- manager tabs visible in `ExpenseTabsNavigator`
- salesman selector in `ExpenseDetailModal`
- manager inbox and team weekly screens
- approval actions

## Extension Guidelines

### Add a new expense category

1. Add it to `EXPENSE_CATEGORIES` in `expenseConstants.js`
2. Put it in the correct `EXPENSE_GROUPS` group
3. Update any icon mapping in:
   - `ExpenseTrackerScreen`
   - `WeeklyTrackingScreen`
4. If it needs custom fields, extend `ExpenseDetailModal`
5. If validation rules differ, update `validateExpense(...)`
6. Verify weekly report rendering still behaves correctly

### Add a new manager action

1. Add service-layer function in `expenseService.js`
2. Wire role gating if needed
3. Add action in manager screen
4. Refresh local state after mutation

### Change tab layout

Use `ExpenseTabsNavigator.js` and `CurvedBottomBar.js`.

Do not reintroduce local footer implementations inside expense screens.

## Current Known Architectural Tradeoffs

- styling tokens are repeated locally instead of centralized
- both `ExpenseDetailScreen` and `ExpenseDetailModal` exist, which is flexible but duplicated conceptually
- popup add flow is intentionally anchored in `ExpenseTrackerScreen` via route params; this is pragmatic, but not a full global modal controller
- service file is doing multiple responsibilities and is a candidate for future split:
  - expense CRUD
  - weekly tracking
  - weekly submissions
  - manager queries

## Recommended Safe Change Strategy

When modifying this module:

1. Start from the owning screen or service, not from broad search
2. Keep changes local to one workflow slice
3. Validate the touched files immediately
4. Manually verify:
   - persistent bottom nav
   - FAB add flow
   - weekly submission
   - manager approval path

## Suggested Future Improvements

- extract `expenseTheme.js`
- extract popup icon mapping into one shared helper
- split `expenseService.js` into smaller domain services
- unify `ExpenseDetailScreen` and `ExpenseDetailModal` around shared form primitives
- add focused tests for manager approval and tab persistence