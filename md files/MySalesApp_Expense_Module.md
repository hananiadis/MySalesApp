Full Technical Specification — Expense Tracking & Management Module
For MySalesApp (React Native, Firebase, MMKV, Expo)
1. Overview & Purpose

The Expense Module adds a complete system for logging, submitting, reviewing, approving, and exporting business expenses for sales representatives inside MySalesApp.

The module supports:

Mobile-first expense entry

Receipt capture via camera

Local offline storage using MMKV

Cloud sync to Firestore

Manager/Admin approval workflow

Multi-user expense dashboards

Greek language UI

Export to XLSX/CSV

Future extensibility (OCR, budgets, analysis automation)

This specification provides everything Codex needs to generate the full module.

2. Core Functional Goals

Allow sales reps to quickly record expenses on the road.

Allow attaching receipt photos (camera or gallery).

Support offline mode (MMKV local storage).

Sync to Firestore when online.

Provide a manager view for approvals.

Provide an expense summary dashboard.

Export data for accounting.

Fully translated Greek UI.

3. Feature List
3.1 For Sales Reps

Create new expense

Capture receipt image

Edit draft expenses

Submit expenses

View history

Delete draft before submission

View approval status

Export personal expenses

3.2 For Managers/Admin

View all submitted expenses

Approve/Reject

Mark reimbursed

Filter by user, month, category

Export team expenses

Dashboard totals by category, month, brand, user

3.3 System Features

MMKV-first local storage

Firestore sync

Firebase Storage for images

Greek localization

XLSX export

Offline-first architecture

Modular code structure

4. Architecture
4.1 Component Layers
UI Screens → Hooks/State → ExpenseService → MMKV Storage → Firestore Sync → Firebase Storage

4.2 Local Storage (MMKV)

Key: expenses_local

Stores array of expense objects (draft + submitted + approved)

Key: expenses_sync_timestamp

Stores last sync time

4.3 Firestore Structure

Collection: expenses
Document fields:

Field	Type	Description
id	string	UUID
userId	string	Owner
date	number	Timestamp
amount	number	Expense value
currency	string	Default “EUR”
category	string	Predefined
description	string	Free text
status	string	draft/submitted/approved/rejected/reimbursed
receiptRemoteURL	string	Image in Firebase Storage
createdAt	timestamp	Creation time
updatedAt	timestamp	Last update
approverId	string	Manager
approvedAt	timestamp	Approval time
5. Data Models
5.1 Expense Object
{
  id: string,
  userId: string,
  date: number,
  amount: number,
  currency: "EUR",
  category: string,
  description: string,
  status: "draft" | "submitted" | "approved" | "rejected" | "reimbursed",
  receiptLocalPath: string | null,
  receiptRemoteURL: string | null,
  createdAt: number,
  updatedAt: number,
  approverId?: string,
  approvedAt?: number
}

5.2 Category List

Travel

Fuel

Meals

Parking

Accommodation

Samples

Toll fees

Miscellaneous

6. Screens
6.1 ExpensesScreen (List View)
Purpose

Show all expenses grouped by status.

Features

Filter by status

Grouped list sections

Receipt thumbnails

Floating “+ New Expense” button

Tap row → detail screen

UI Sections

Header: “Έξοδα”

Tabs or segmented filters

List groups: Draft / Submitted / Approved / Reimbursed

6.2 ExpenseCreateScreen
Form Fields

Date picker (default today)

Amount (numeric keypad)

Category dropdown

Description

Receipt: Add photo / choose from gallery

Buttons

Save Draft

Submit Expense

Validation

amount > 0

category required

optional receipt

6.3 ExpenseDetailScreen
Displays

Full-size receipt

All fields

Status badge

Actions Based on Status

Draft → Edit / Submit / Delete

Submitted → (Manager) Approve / Reject

Approved → Mark reimbursed

6.4 ExpensesManagerScreen (Admin Only)

Filters:

User

Month

Category

Status

Actions:

Approve/Reject

Mark Reimbursed

Export XLSX

6.5 ExpenseSummaryScreen

Features:

Monthly totals

Category totals

Bar chart or pie chart

List of highest expenses

Export month as CSV/XLSX

7. Navigation

Add to global navigator:

Expenses
ExpenseCreate
ExpenseDetail
ExpensesManager
ExpenseSummary


Brand screen → “Έξοδα” button
Home screen → “Expenses” icon

8. Local Storage Logic (MMKV)
8.1 Storage Keys

expenses_local

expenses_sync_timestamp

8.2 Local Operations

getLocalExpenses()

saveLocalExpenses(list)

updateLocalExpense(id, data)

deleteLocalExpense(id)

8.3 Offline Mode

If offline:

Save expense locally

Mark status = "draft"

Queue for sync

9. Firestore Sync Logic
9.1 Upload Flow

When online:

Read all local expenses

For each without receiptRemoteURL:

upload receiptLocalPath → Firebase Storage

save URL

Save expense to Firestore

Update sync timestamp

9.2 Download Flow

Fetch all expenses where:

updatedAt > expenses_sync_timestamp


Merge with local.

10. Receipt Image Handling

Folder:

FileSystem.documentDirectory + "receipts/"


Functions:

saveReceiptLocally(uri)

getReceipt(name)

deleteReceipt(name)

Image compress before upload (expo-image-manipulator):

maxWidth: 1080

compress: 0.6

11. Export Logic
Export Formats

XLSX

CSV

Tools

write-excel-file

expo-sharing

Columns

Date

Amount

Category

Description

Status

User (if admin export)

Receipt URL

12. Greek UI Labels
STRINGS.expenses = {
  title: "Έξοδα",
  newExpense: "Νέο Έξοδο",
  date: "Ημερομηνία",
  amount: "Ποσό",
  category: "Κατηγορία",
  description: "Περιγραφή",
  receipt: "Απόδειξη",
  addReceipt: "Προσθήκη Απόδειξης",
  submit: "Υποβολή",
  saveDraft: "Αποθήκευση Προσχεδίου",
  status: {
    draft: "Προσχέδιο",
    submitted: "Υποβλήθηκε",
    approved: "Εγκρίθηκε",
    rejected: "Απορρίφθηκε",
    reimbursed: "Εξοφλήθηκε",
  },
  noExpenses: "Δεν υπάρχουν έξοδα.",
  approve: "Έγκριση",
  reject: "Απόρριψη",
  reimburse: "Εξόφληση",
  managerReview: "Έλεγχος Υπεύθυνου"
}

13. Codex Prompts (for implementation)
13.1 Create Model
Create src/models/expenseModel.js with a function createExpenseModel() returning the exact data structure described in the MD. Add helpers for Firestore mapping and preparing write objects.

13.2 Create Service
Create src/services/expenseService.js with methods: addExpense, updateExpense, submitExpense, approveExpense, rejectExpense, markReimbursed, getUserExpenses, getAllPendingExpenses. Include Firebase Storage uploads for receipts.

13.3 Create Screens
Generate ExpensesScreen.js, ExpenseCreateScreen.js, ExpenseDetailScreen.js, ExpensesManagerScreen.js, ExpenseSummaryScreen.js following the UI and logic described. Use STRINGS.expenses for all labels.

13.4 Add Navigation
Add the five new screens to the app's root navigation. Use the exact route names: Expenses, ExpenseCreate, ExpenseDetail, ExpensesManager, ExpenseSummary.

13.5 Implement MMKV storage
Create utils/storage/expensesLocal.js with functions to load, save, update, delete expenses using MMKV. Use key 'expenses_local'.

13.6 Implement Sync
Create src/services/expenseSyncService.js. Implement upload, download, merge, and timestamp logic. Trigger sync on app start and on connectivity change.

13.7 Implement Receipt Caching
Create src/utils/receiptCache.js supporting saveReceiptLocally, getReceiptPath, deleteReceipt. Store images in documentDirectory/receipts/.

13.8 Charts
In ExpenseSummaryScreen use react-native-svg + victory-native or recharts to generate monthly/category bar and pie charts.

13.9 Export
Create src/utils/exportExpenses.js to export to XLSX. Support both user-level and manager-level exports.

14. Testing Checklist
14.1 Functional

Can create draft

Can submit

Manager sees submission

Approve/reject works

Resubmission works

Reimbursement works

Images display correctly

Sync works after offline mode

14.2 Data Integrity

IDs unique

Dates correct

Currency correct

No broken image paths

14.3 Performance

Opening list < 200ms

Receipt image loads fast

Sync < 2 seconds

14.4 Export

XLSX opens correctly

All fields accurate

Greek encoding correct

15. Future Extensions

OCR auto-scan amount/date

AI expense categorization

GPS tagging

Multi-currency

Budget rules

Duplicate receipt detection

Host receipts in CDN for faster loading

Tag expense to customers or trips

16. Final Notes

This specification is optimized for:

React Native

Expo

Firebase Firestore & Storage

MMKV Storage

Greek market usage

Codex can generate the module exactly using the prompts in section 13.