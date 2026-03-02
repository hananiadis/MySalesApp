# Expense Tracker Implementation Guide

## Overview
Add a comprehensive user-centric expense tracking system to MySalesApp with weekly reporting. Expenses are tied to individual salesmen (not brands), support three expense category groups, provide per-user and manager-level reporting with analytics, and include weekly tracking for mileage, petty cash, and work locations.

---

## Step 1: Define Expense Categories and Constants

**File:** `src/constants/expenseConstants.js`

**Purpose:** Centralize all expense-related enums, category definitions, and configuration constants.

**Content Structure:**

```javascript
// Category Groups and Subcategories
export const EXPENSE_GROUPS = {
  TRAVEL: 'ΜΕΤΑΚΙΝΗΣΗ',
  ACCOMMODATION_FOOD: 'ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ',
  MISCELLANEOUS: 'ΔΙΑΦΟΡΑ'
};

export const EXPENSE_CATEGORIES = {
  // ΜΕΤΑΚΙΝΗΣΗ (Travel)
  FUEL: { id: 'fuel', label: 'Βενζίνη - Αέριο', group: EXPENSE_GROUPS.TRAVEL },
  TICKETS: { id: 'tickets', label: 'Εισιτήρια', group: EXPENSE_GROUPS.TRAVEL },
  TAXI: { id: 'taxi', label: 'Ταξί', group: EXPENSE_GROUPS.TRAVEL },
  CAR_RENTAL: { id: 'car_rental', label: 'Ενοικίαση Αυτοκινήτου', group: EXPENSE_GROUPS.TRAVEL },
  TOLLS: { id: 'tolls', label: 'Διόδια', group: EXPENSE_GROUPS.TRAVEL },
  PARKING: { id: 'parking', label: 'Parking', group: EXPENSE_GROUPS.TRAVEL },
  
  // ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ (Accommodation & Food)
  HOTEL: { id: 'hotel', label: 'Ξενοδοχείο', group: EXPENSE_GROUPS.ACCOMMODATION_FOOD },
  PERSONAL_MEAL: { id: 'personal_meal', label: 'Ατομικό Γεύμα', group: EXPENSE_GROUPS.ACCOMMODATION_FOOD },
  THIRD_PARTY_MEAL: { id: 'third_party_meal', label: 'Γεύμα Τρίτου', group: EXPENSE_GROUPS.ACCOMMODATION_FOOD },
  
  // ΔΙΑΦΟΡΑ (Miscellaneous)
  POSTAL: { id: 'postal', label: 'Ταχυδρομικά Έξοδα', group: EXPENSE_GROUPS.MISCELLANEOUS },
  TELECOM: { id: 'telecom', label: 'Τηλέφωνα, φαξ, Internet', group: EXPENSE_GROUPS.MISCELLANEOUS },
  CAR_SERVICE: { id: 'car_service', label: 'Service Αυτοκινήτου', group: EXPENSE_GROUPS.MISCELLANEOUS },
  OTHER: { id: 'other', label: 'Διάφορα', group: EXPENSE_GROUPS.MISCELLANEOUS }
};

export const EXPENSE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved'
};

export const EXPENSE_CURRENCY = 'EUR';

// Sorting and filtering options
export const EXPENSE_SORT_OPTIONS = [
  { id: 'date_desc', label: 'Πιο Πρόσφατα' },
  { id: 'date_asc', label: 'Παλιότερα' },
  { id: 'amount_desc', label: 'Υψηλότερο ποσό' },
  { id: 'amount_asc', label: 'Χαμηλότερο ποσό' }
];

// Weekdays for weekly tracking
export const WEEKDAYS = [
  { id: 'monday', label: 'Δευτέρα', short: 'Δευ' },
  { id: 'tuesday', label: 'Τρίτη', short: 'Τρι' },
  { id: 'wednesday', label: 'Τετάρτη', short: 'Τετ' },
  { id: 'thursday', label: 'Πέμπτη', short: 'Πεμ' },
  { id: 'friday', label: 'Παρασκευή', short: 'Παρ' },
  { id: 'saturday', label: 'Σάββατο', short: 'Σαβ' },
  { id: 'sunday', label: 'Κυριακή', short: 'Κυρ' }
];

// Helper functions
export const getCategoryLabel = (categoryId) => {
  const category = Object.values(EXPENSE_CATEGORIES).find(cat => cat.id === categoryId);
  return category ? category.label : 'Άγνωστη κατηγορία';
};

export const getCategoryGroup = (categoryId) => {
  const category = Object.values(EXPENSE_CATEGORIES).find(cat => cat.id === categoryId);
  return category ? category.group : null;
};

export const getCategoriesByGroup = (groupId) => {
  return Object.values(EXPENSE_CATEGORIES).filter(cat => cat.group === groupId);
};

export const getAllCategoryGroups = () => {
  return Object.values(EXPENSE_GROUPS);
};

export const getWeekdayLabel = (weekdayId) => {
  const day = WEEKDAYS.find(d => d.id === weekdayId);
  return day ? day.label : '';
};

export const getWeekdayShortLabel = (weekdayId) => {
  const day = WEEKDAYS.find(d => d.id === weekdayId);
  return day ? day.short : '';
};

// Get ISO week number
export const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// Get week start and end dates
export const getWeekStartEnd = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};
```

**Key Design Decisions:**
- Categories organized by group for easier UI navigation
- Each category has id, label (Greek), and group reference
- Weekday constants for weekly tracking UI
- Helper functions for week calculations and lookups
- Flat structure for easy iteration in dropdowns/pickers

---

## Step 2: Create Expense Context and Service Layer

### 2A. Expense Service (`src/services/expenseService.js`)

**Purpose:** Handle all Firestore operations, offline caching, sync logic, and data aggregation for expenses and weekly tracking data.

**Key Responsibilities:**
- CRUD operations for expenses in Firestore
- User-scoped collections: `expenses/{userId}/records/{expenseId}` and `weeklyTracking/{userId}/weeks/{weekId}`
- Local caching with AsyncStorage
- Offline queue management
- Date-range filtering and category-based aggregation
- Weekly tracking: mileage, petty cash, work locations
- Manager-level multi-user report generation
- Weekly report data aggregation

**Core Methods:**
```javascript
// Expense CRUD
async addExpense(userId, expenseData)
async updateExpense(userId, expenseId, updates)
async deleteExpense(userId, expenseId)
async getExpense(userId, expenseId)

// Listing & Filtering
async getExpensesByDateRange(userId, startDate, endDate)
async getExpensesByCategory(userId, categoryId, startDate, endDate)
async getExpensesByWeek(userId, weekStartDate)

// Weekly Tracking CRUD
async saveWeeklyTracking(userId, weekId, trackingData)
  // trackingData: {
  //   weekStartDate: date,
  //   mileage: { startKm, endKm, privateKm },
  //   pettyCash: { given, remaining },
  //   locations: { monday: 'Athens', tuesday: 'Piraeus', ... }
  // }
async getWeeklyTracking(userId, weekId)
async getWeeklyTrackingByDateRange(userId, startDate, endDate)

// Aggregation & Analytics
async getExpenseSummaryByGroup(userId, startDate, endDate)
async getExpenseSummaryByCategory(userId, startDate, endDate)
async getExpenseSummaryByDay(userId, startDate, endDate) // { 2026-01-15: 120, ... }
async getWeeklyReport(userId, weekStartDate) // All expenses + tracking for week

// Manager/Multi-User Reports
async getMultiUserExpenseReport(userIds, startDate, endDate)
async getMultiUserWeeklyReport(userIds, weekStartDate)
async getManagerAssignedSalesmen(managerId)

// Weekly Report Export
async generateWeeklyReportData(userId, weekStartDate) // Returns structured data for PDF/print
async generateManagerWeeklyReportData(userIds, weekStartDate)

// Sync & Offline
async syncOfflineData(userId)
async setOfflineData(userId, data)
async getOfflineData(userId)
```

**Firestore Schema:**
```
expenses/
  {userId}/
    records/
      {expenseId}/
        {
          id: string
          userId: string
          category: string
          amount: number
          currency: string
          description: string
          date: ISO timestamp
          status: string
          createdAt: server timestamp
          updatedAt: server timestamp
        }

weeklyTracking/
  {userId}/
    weeks/
      {weekId}/ (format: "2026-W03" for week 3 of 2026)
        {
          id: string
          userId: string
          weekStartDate: ISO timestamp
          weekEndDate: ISO timestamp
          mileage: {
            startKm: number,
            endKm: number,
            businessKm: number (calculated: endKm - startKm - privateKm),
            privateKm: number
          }
          pettyCash: {
            given: number,
            spent: number (calculated from expenses),
            remaining: number (calculated: given - spent)
          }
          locations: {
            monday: string,
            tuesday: string,
            wednesday: string,
            thursday: string,
            friday: string,
            saturday: string,
            sunday: string
          }
          createdAt: server timestamp
          updatedAt: server timestamp
        }
```

**Implementation Pattern:** Follow `src/services/firebase.js` and OrderContext sync logic.

---

### 2B. Expense Context (`src/context/ExpenseContext.js`)

**Purpose:** Global state management for expenses, weekly tracking, current filters, and UI state.

**Context Structure:**
```javascript
{
  // Current user's expenses
  expenses: Array<Expense>,
  filteredExpenses: Array<Expense>,
  
  // Current week's tracking
  currentWeekTracking: {
    weekId: string,
    weekStartDate: Date,
    mileage: { startKm, endKm, businessKm, privateKm },
    pettyCash: { given, spent, remaining },
    locations: { monday, tuesday, ... }
  },
  
  // Current filters
  filters: {
    startDate: Date,
    endDate: Date,
    categories: Array<string>,
    status: string,
    sortBy: string,
    weekId: string | null // For weekly view
  },
  
  // Analytics data
  summary: {
    totalByGroup: { TRAVEL: 100, FOOD: 200, ... },
    totalByCategory: { fuel: 50, hotel: 200, ... },
    totalByDay: { '2026-01-15': 120, '2026-01-16': 85, ... },
    grandTotal: 300,
    expenseCount: 15
  },
  
  // Multi-user reporting (manager mode)
  selectedSalesmen: Array<{ id, name }>,
  managerReport: {
    expenses: Array<Expense>,
    weeklyTracking: Array<WeeklyTracking>,
    summary: {...}
  },
  
  // Loading & sync states
  loading: boolean,
  syncing: boolean,
  error: string | null,
  
  // Actions
  addExpense(expenseData),
  updateExpense(expenseId, updates),
  deleteExpense(expenseId),
  saveWeeklyTracking(trackingData),
  getWeeklyTracking(weekId),
  setDateRange(startDate, endDate),
  setWeekFilter(weekId),
  setCategoryFilter(categoryIds),
  setStatusFilter(status),
  setSortBy(sortOption),
  syncAllData(),
  loadManagerReport(selectedUserIds, weekId),
  clearFilters()
}
```

**Key Design:**
- Derived state: `filteredExpenses` auto-computed from `expenses` + `filters`
- Separate tracking for weekly data (mileage, petty cash, locations)
- Weekly calculations: businessKm = endKm - startKm - privateKm, remaining = given - spent
- Manager mode: Separate state for multi-user aggregation
- Lazy load: Data fetched on context init and on screen focus

**Integration:** Wrap AppNavigator with ExpenseProvider (after AuthProvider).

---

## Step 3: Create Core Screens

### 3A. ExpenseTrackerScreen (`src/screens/ExpenseTrackerScreen.js`)

**Purpose:** Main dashboard for viewing, filtering, and listing expenses.

**Layout:**
```
┌─────────────────────────────────────────┐
│ Expense Tracker Header                  │
├─────────────────────────────────────────┤
│ [Date Range Picker] [Filter] [Sort]     │
├─────────────────────────────────────────┤
│ Category Quick Filter Chips              │
│ [All] [Travel] [Food] [Misc]            │
├─────────────────────────────────────────┤
│ Summary Cards (per category group)       │
│ ┌─────────────────────────────────────┐ │
│ │ ΜΕΤΑΚΙΝΗΣΗ (Travel)                 │ │
│ │ €500.00 | 8 expenses                │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Expense List (FlatList)                 │
│ ┌─────────────────────────────────────┐ │
│ │ Jan 15 | Βενζίνη | €45.50          │ │
│ │ Jan 14 | Ξενοδοχείο | €120.00      │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [+ ADD EXPENSE] FAB                     │
└─────────────────────────────────────────┘
```

**Key Features:**
- Date range picker (default: current month)
- Category filtering (multi-select chips)
- Sorting options (date, amount)
- Summary cards per group
- Expense list with pull-to-refresh
- Swipe to delete with confirmation
- Tap to edit

**State Management:** Use ExpenseContext.

---

### 3B. ExpenseDetailScreen (`src/screens/ExpenseDetailScreen.js`)

**Purpose:** Create/edit form for individual expenses.

**Layout:**
```
┌─────────────────────────────────────────┐
│ New Expense / Edit Expense              │
├─────────────────────────────────────────┤
│ Category Picker (Grouped by category)   │
│ Date Picker                             │
│ Amount Input (EUR)                      │
│ Description (Optional)                  │
│ Status (Draft/Submitted/Approved)       │
│                                          │
│ [Cancel] [Save]                         │
└─────────────────────────────────────────┘
```

**Validation:**
- Category: required
- Amount: required, > 0
- Date: required, not in future
- Description: optional but recommended

**Behavior:**
- Create mode: All fields blank, status defaults to 'draft'
- Edit mode: Prefill all fields, allow status change
- Save: Calls `expenseService.addExpense()` or `updateExpense()`
- Offline: Queue unsaved expenses locally

---

### 3C. ExpenseReportsScreen (`src/screens/ExpenseReportsScreen.js`)

**Purpose:** Analytics and summary reports for individual user's expenses.

**Layout:**
```
┌─────────────────────────────────────────┐
│ Expense Reports                         │
├─────────────────────────────────────────┤
│ [Date Range Picker]                     │
├─────────────────────────────────────────┤
│ Overall Summary Card                    │
│ Total: €1,050.00 | Count: 18           │
│ Average: €58.33 | Highest: €120.00     │
├─────────────────────────────────────────┤
│ By Category Group (Progress bars)       │
│ ΜΕΤΑΚΙΝΗΣΗ       45% | €475.00         │
│ ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ 35% | €368.00       │
│ ΔΙΑΦΟΡΑ          20% | €210.00         │
├─────────────────────────────────────────┤
│ By Category (Detailed Breakdown)        │
│ Βενζίνη - Αέριο | €320.00 | 6 items   │
│ Ξενοδοχείο | €240.00 | 2 items        │
│ ... (sorted by amount desc)            │
└─────────────────────────────────────────┘
```

**Data Visualization:**
- Progress bars for group breakdown
- Detailed category table with amounts and counts
- Dynamic summary KPIs

**State:** Use ExpenseContext.

---

## Step 4: Create Weekly Tracking Screen

### WeeklyTrackingScreen (`src/screens/WeeklyTrackingScreen.js`)

**Purpose:** Record weekly mileage, petty cash, and work locations.

**Layout:**
```
┌─────────────────────────────────────────┐
│ Weekly Tracking (Week 3, Jan 15-21)     │
├─────────────────────────────────────────┤
│ MILEAGE (Χιλιόμετρα)                    │
│ ┌─────────────────────────────────────┐ │
│ │ Start (Km)        [     1245.5    ]  │ │
│ │ End (Km)          [     1450.2    ]  │ │
│ │ Total: 204.7 km                     │ │
│ │ Private (Km)      [      15      ]  │ │
│ │ Business: 189.7 km                  │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ PETTY CASH (Ταμείο)                     │
│ ┌─────────────────────────────────────┐ │
│ │ Given (€)         [    200.00    ]  │ │
│ │ Expenses from tracker: €185.50      │ │
│ │ Remaining: €14.50                   │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ WORK LOCATIONS (Τοποθεσίες Εργασίας)    │
│ ┌─────────────────────────────────────┐ │
│ │ Monday    [Athens         ]        │ │
│ │ Tuesday   [Piraeus        ]        │ │
│ │ Wednesday [Patras         ]        │ │
│ │ Thursday  [Athens         ]        │ │
│ │ Friday    [Maroussi       ]        │ │
│ │ Saturday  [            ]          │ │
│ │ Sunday    [            ]          │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ [Save Changes]                          │
└─────────────────────────────────────────┘
```

**Features:**
- Displays current week (Mon-Sun) with dates
- Mileage section: start/end km, auto-calc total and business km
- Private km input
- Petty cash: given amount (manual), spent auto-calculated from expenses
- Remaining auto-calculated
- Work locations: one input per weekday
- Save button persists to context + Firestore
- Auto-load existing tracking for current week

**State Management:** Use ExpenseContext for `currentWeekTracking`.

**Sync:** Save to `weeklyTracking/{userId}/weeks/{weekId}` collection.

---

## Step 5: Create Weekly Report Screen

### WeeklyReportScreen (`src/screens/WeeklyReportScreen.js`)

**Purpose:** Generate printable weekly report with all expenses broken down by group, category, and day.

**Layout:**
```
┌─────────────────────────────────────────┐
│ Weekly Report (Week 3, Jan 15-21, 2026) │
├─────────────────────────────────────────┤
│ Week Summary Card                       │
│ ┌─────────────────────────────────────┐ │
│ │ Total Expenses: €685.50             │ │
│ │ Mileage: 189.7 km (Business)        │ │
│ │ Petty Cash: €14.50 remaining        │ │
│ │ Worked in: Athens, Piraeus, Patras  │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ΜΕΤΑΚΙΝΗΣΗ (Travel)                     │
│ ┌─────────────────────────────────────┐ │
│ │ Wed 15: Βενζίνη €45.50              │ │
│ │ Thu 16: Parking €10.00              │ │
│ │ Fri 17: Ταξί €35.00                 │ │
│ │ Group Total: €90.50                 │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ (Food)               │
│ ┌─────────────────────────────────────┐ │
│ │ Wed 15: Γεύμα Τρίτου €25.00        │ │
│ │ Thu 16: Ξενοδοχείο €120.00         │ │
│ │ Fri 17: Γεύμα Τρίτου €28.00        │ │
│ │ Group Total: €173.00                │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ΔΙΑΦΟΡΑ (Misc)                          │
│ ┌─────────────────────────────────────┐ │
│ │ Tue 14: Service €15.00              │ │
│ │ Thu 16: Τηλέφωνα €8.50              │ │
│ │ Group Total: €23.50                 │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Daily Breakdown                         │
│ ┌─────────────────────────────────────┐ │
│ │ Mon 13: €0.00                       │ │
│ │ Tue 14: €15.00                      │ │
│ │ Wed 15: €70.50                      │ │
│ │ Thu 16: €138.00                     │ │
│ │ Fri 17: €63.00                      │ │
│ │ Sat 18: €0.00                       │ │
│ │ Sun 19: €0.00                       │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [Print Report] [Export PDF] [Share]     │
└─────────────────────────────────────────┘
```

**Features:**
- Week selector (navigate prev/next week)
- Weekly summary: total expenses, mileage, petty cash, locations
- Expenses grouped by category group
- Each group shows daily breakdown with category labels
- Daily breakdown section showing totals per day
- Print/PDF export button
- Share functionality for managers
- Auto-loads data from ExpenseContext

**Print Format:**
- Header: "Weekly Report - Salesman Name - Week X, Jan 15-21, 2026"
- Summary card with key metrics
- Full breakdown by group and category
- Daily totals
- Printable on A4 portrait format

**State:** Use ExpenseContext, fetch weekly data via `getWeeklyReport()`.

**Export:** Use react-native-print or pdf library for print-friendly output.

---

## Step 6: Add Manager Weekly Reports

### ManagerWeeklyReportScreen (`src/screens/ManagerWeeklyReportScreen.js`)

**Purpose:** Allow managers to view aggregated weekly reports from multiple salesmen.

**Layout:**
```
┌─────────────────────────────────────────┐
│ Team Weekly Reports                     │
├─────────────────────────────────────────┤
│ Week Selector [< Week 3 >]              │
│ (Jan 15-21, 2026)                       │
├─────────────────────────────────────────┤
│ Select Salesmen                         │
│ ┌─────────────────────────────────────┐ │
│ │ [✓] John Salesman    €450.50       │ │
│ │ [✓] Maria Sales Rep  €235.00       │ │
│ │ [ ] Alex Account Mgr €0.00         │ │
│ └─────────────────────────────────────┘ │
│ [Generate Report]                       │
├─────────────────────────────────────────┤
│ Team Summary                            │
│ ┌─────────────────────────────────────┐ │
│ │ Total (2 salesmen): €685.50        │ │
│ │ Avg per Person: €342.75            │ │
│ │ Combined Mileage: 456.3 km         │ │
│ │ Petty Cash Remaining: €29.00       │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ By Salesman                             │
│ ┌─────────────────────────────────────┐ │
│ │ John Salesman (€450.50)            │ │
│ │  ΜΕΤΑΚΙΝΗΣΗ: €120.00 | 6 items     │ │
│ │  ΔΙΑΜΟΝΗ: €230.00 | 4 items        │ │
│ │  ΔΙΑΦΟΡΑ: €100.50 | 3 items        │ │
│ │ Maria Sales Rep (€235.00)          │ │
│ │  ... similar breakdown ...         │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ By Category Group (Aggregated)          │
│ ΜΕΤΑΚΙΝΗΣΗ       €250.00 | 12 items    │
│ ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ €400.00 | 10 items │
│ ΔΙΑΦΟΡΑ          €35.50 | 4 items     │
├─────────────────────────────────────────┤
│ [Print Team Report] [Export]            │
└─────────────────────────────────────────┘
```

**Behavior:**
- Auto-load manager's assigned salesmen on screen mount
- Multi-select with checkboxes
- Week selector to change week
- Generate report aggregates all selected users for week
- Shows per-person breakdown + group + category summaries
- Drill-down: tap salesman name to view their full report
- Print/export team report

**Implementation:** Reuse components from WeeklyReportScreen; aggregate data via `getMultiUserWeeklyReport()`.

---

## Step 7: Update Homescreen

### MainHomeScreen Addition

**File:** `src/screens/MainHomeScreen.js`

**Change:** Add "Εξοδολόγιο" to quick actions.

**Implementation:**
```javascript
{
  key: 'expense-tracker',
  label: 'Εξοδολόγιο',
  subtitle: 'Καταγραφή εξόδων, ταξιδιών, καυσίμων κ.α.',
  icon: 'receipt',
  onPress: () => navigation.navigate('ExpenseTracker')
}
```

**UI Pattern:** Follow existing action card pattern.

---

## Step 8: Register Routes in Navigation

### RootNavigator.js (`src/navigation/RootNavigator.js`)

**Screens to Add:**
```javascript
<Stack.Screen name="ExpenseTracker" component={ExpenseTrackerScreen} options={{ title: 'Εξοδολόγιο' }} />
<Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: 'Έξοδο' }} />
<Stack.Screen name="ExpenseReports" component={ExpenseReportsScreen} options={{ title: 'Αναφορές Εξόδων' }} />
<Stack.Screen name="WeeklyTracking" component={WeeklyTrackingScreen} options={{ title: 'Εβδομαδιαία Καταγραφή' }} />
<Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} options={{ title: 'Εβδομαδιαία Αναφορά' }} />

// For managers:
{
  isManager && (
    <Stack.Screen name="ManagerWeeklyReport" component={ManagerWeeklyReportScreen} options={{ title: 'Αναφορές Ομάδας' }} />
  )
}
```

---

## Step 9: Configure Firestore Schema

**Collection Structure:**
```
expenses/
  {userId}/
    records/
      {expenseId}

weeklyTracking/
  {userId}/
    weeks/
      {weekId} (format: "2026-W03")
```

**Firestore Rules:**
```javascript
match /expenses/{userId}/records/{expenseId} {
  allow read, write: if request.auth.uid == userId;
  allow read: if request.auth.uid in get(/databases/$(database)/documents/users/$(userId)).data.managers || [];
}

match /weeklyTracking/{userId}/weeks/{weekId} {
  allow read, write: if request.auth.uid == userId;
  allow read: if request.auth.uid in get(/databases/$(database)/documents/users/$(userId)).data.managers || [];
}
```

---

## Implementation Checklist

- [ ] Step 1: Create `expenseConstants.js`
- [ ] Step 2A: Create `expenseService.js`
- [ ] Step 2B: Create `ExpenseContext.js` and ExpenseProvider
- [ ] Step 3A: Create `ExpenseTrackerScreen.js`
- [ ] Step 3B: Create `ExpenseDetailScreen.js`
- [ ] Step 3C: Create `ExpenseReportsScreen.js`
- [ ] Step 4: Create `WeeklyTrackingScreen.js`
- [ ] Step 5: Create `WeeklyReportScreen.js` with print functionality
- [ ] Step 6: Create `ManagerWeeklyReportScreen.js`
- [ ] Step 7: Update `MainHomeScreen.js`
- [ ] Step 8: Register routes in `RootNavigator.js`
- [ ] Step 9: Configure Firestore schema and rules

**Testing Priorities:**
1. Offline CRUD for expenses
2. Weekly tracking calculations (mileage, petty cash)
3. Weekly report generation and data accuracy
4. Manager multi-user report aggregation
5. Print/PDF export functionality
6. Date filtering and week navigation

---

## Data Flow Diagram

```
MainHomeScreen
    ↓
[+ Εξοδολόγιο] Button
    ↓
ExpenseTrackerScreen
    ├─→ [Add Expense] → ExpenseDetailScreen (create)
    │        ↓
    │    expenseService.addExpense()
    │        ↓
    │    Sync to Firestore
    │        ↓
    │    ExpenseContext updated
    │
    ├─→ [View Reports] → ExpenseReportsScreen
    │
    ├─→ [Weekly Tracking] → WeeklyTrackingScreen
    │        ↓
    │    expenseService.saveWeeklyTracking()
    │        ↓
    │    Save mileage + petty cash + locations
    │
    └─→ [Weekly Report] → WeeklyReportScreen
            ↓
        Fetch weekly data
            ↓
        Display breakdown by group/category/day
            ↓
        [Print] / [Export PDF]

Manager View:
    ManagerWeeklyReportScreen
        ↓
    Select salesmen + week
        ↓
    expenseService.getMultiUserWeeklyReport()
        ↓
    Aggregate and display
```

---

## Key Features Summary

1. **Expense Tracking**
   - Daily expense logging by category
   - Draft/submit/approve workflow
   - Category-based filtering and analytics

2. **Weekly Tracking**
   - Mileage (start/end, business vs. private km)
   - Petty cash management (given vs. spent vs. remaining)
   - Daily work locations (where worked each day)

3. **Reporting**
   - Per-user reports (expenses, analytics, weekly summary)
   - Per-day breakdown within weekly reports
   - Aggregated weekly reports by category group and category

4. **Manager Functionality**
   - View multiple salesmen's reports
   - Aggregate expenses across team
   - Weekly team reports with per-person and group breakdowns

5. **Print/Export**
   - Print-friendly weekly reports
   - PDF export capability (future enhancement)
   - Share reports with team

6. **Offline Support**
   - Queue expenses locally
   - Sync when online
   - Full offline functionality for weekly tracking

---

## Notes for Implementation

1. **Week ID Format:** Use ISO week format "2026-W03" for consistent week identification
2. **Date Calculations:** Use `getWeekStartEnd()` from constants to ensure consistent week boundaries
3. **Mileage Calculations:** businessKm = (endKm - startKm) - privateKm
4. **Petty Cash:** Automatically calculate spent from expenses, then remaining = given - spent
5. **Print Components:** Consider using `react-native-html-to-pdf` or native print APIs
6. **Styling:** Follow existing theme/colors.js patterns
7. **Performance:** Memoize weekly calculations to avoid recalculation
8. **Accessibility:** Add testIDs to all interactive elements
