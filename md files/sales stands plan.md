## Sales Stands Feature Analysis

### Data Structure

#### 1. **Sales Stand Definitions Collection** (`salesStands_playmobil`)

```javascript
{
  standCode: "STAND001",
  description: "Back to School Display Stand 2025",
  displayCode: "DISP-BTS-001", // The window display product code
  
  // Products included in the stand (mandatory items)
  includedProducts: [
    { productCode: "70983", quantity: 5, description: "School Bus" },
    { productCode: "71649", quantity: 3, description: "Toddler group" },
    { productCode: "71760", quantity: 10, description: "Figures Series 27" }
  ],
  
  // Metadata
  totalValue: 450.50, // Auto-calculated
  wholesaleValue: 325.00,
  isActive: true,
  launchDate: "2025-01-15",
  expiryDate: "2025-06-30", // Optional
  category: "Back to School",
  
  // System
  brand: "playmobil",
  lastUpdated: Timestamp
}
```

#### 2. **Salesman Stand Budget Collection** (`salesmanStandBudgets`)

```javascript
{
  id: "AUTO_ID",
  salesmanId: "playmobil_user123",
  standCode: "STAND001",
  
  // Budget tracking
  allocated: 10, // Total stands allocated to this salesman
  used: 3,       // Stands already assigned to customers
  available: 7,  // allocated - used
  
  // Tracking
  year: 2025,
  quarter: "Q1", // Optional
  
  lastUpdated: Timestamp
}
```

#### 3. **Customer Stand Assignments Collection** (`customerStandAssignments`)

```javascript
{
  id: "AUTO_ID",
  customerId: "CUST_001",
  customerCode: "12345",
  customerName: "ΠΑΠΑΔΟΠΟΥΛΟΣ Α.Ε.",
  
  standCode: "STAND001",
  standDescription: "Back to School Display Stand 2025",
  
  assignedBy: "playmobil_user123", // Salesman who assigned it
  assignedBySalesman: "Γιάννης Παπαδόπουλος",
  assignedDate: Timestamp,
  
  // Status
  status: "assigned", // assigned, delivered, returned
  deliveryDate: Timestamp, // When display was delivered
  
  // Reference to order
  orderId: "ORDER_12345",
  orderDate: Timestamp,
  
  brand: "playmobil",
  year: 2025
}
```

#### 4. **Order Lines Enhancement**

Existing `orders` collection, add stand-related fields:

```javascript
{
  // ... existing order fields ...
  
  // New fields for stand tracking
  salesStandCode: "STAND001", // If this order includes a stand
  salesStandDisplayCode: "DISP-BTS-001",
  
  orderLines: [
    {
      productCode: "DISP-BTS-001",
      description: "Back to School Window Display",
      quantity: 1,
      wholesalePrice: 0, // Free display
      isSalesStandDisplay: true, // Flag for display item
      salesStandCode: "STAND001",
      isLocked: true // Cannot be removed individually
    },
    {
      productCode: "70983",
      description: "School Bus",
      quantity: 5, // 5 from stand
      baseQuantityFromStand: 5, // Locked quantity from stand
      additionalQuantity: 0, // Can add more
      wholesalePrice: 34.99,
      salesStandCode: "STAND001",
      isLockedQuantity: true // Base quantity cannot be reduced
    },
    {
      productCode: "70983", // Same product, added extra
      description: "School Bus",
      quantity: 2, // Additional 2 units
      wholesalePrice: 34.99,
      salesStandCode: null, // Not part of stand
      isLockedQuantity: false
    }
  ]
}
```

---

### User Flow

#### **Adding a Sales Stand to Order**

1. **Navigation**: In order product selection screen, add "Sales Stands" button
2. **Stand Selection Screen**:
   - List available stands with preview
   - Show: Stand image, included products, total value
   - Display salesman's available budget: "Available: 7/10"
   
3. **Budget Check**:
   ```
   IF salesmanBudget.available > 0:
     → Allow selection
   ELSE:
     → Show warning dialog:
       "Δεν έχετε διαθέσιμο budget για αυτό το stand.
        Διαθέσιμα stands από άλλους πωλητές: 
        - Μαρία Γεωργίου: 5 διαθέσιμα
        - Νίκος Ιωάννου: 2 διαθέσιμα
        
        Επικοινωνήστε για μεταφορά budget."
     → Allow "Request Transfer" button
     → Or "Add Anyway" (with override permission)
   ```

4. **Add Stand to Order**:
   - Add display item (quantity locked at 1)
   - Add all included products with base quantities
   - Mark these items with `isLocked` flags
   - Update order totals
   - Decrement salesman's available budget

#### **Modifying Stand Products**

**In Order Review Screen**:

```
┌─────────────────────────────────────────────┐
│ 📦 Sales Stand: Back to School Display     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                             │
│ DISP-BTS-001 - Window Display         [🔒] │
│ Quantity: 1 (cannot modify)                │
│                                             │
│ 70983 - School Bus                    [🔒] │
│ Base: 5 (from stand)                       │
│ Additional: [−] 2 [+]  ← Can modify this   │
│ Total: 7 units                             │
│                                             │
│ 71649 - Toddler group                 [🔒] │
│ Base: 3 (from stand)                       │
│ Additional: [−] 0 [+]                      │
│ Total: 3 units                             │
│                                             │
│ [Remove Entire Stand] ← Removes all items  │
└─────────────────────────────────────────────┘
```

- **Base quantities**: Greyed out, cannot be modified
- **Additional quantities**: User can add more with +/− buttons
- **Remove Stand**: Removes display + all base quantities, keeps additional quantities

#### **Budget Management Screen**

**For Managers/Admins**:

```
┌─────────────────────────────────────────────┐
│ Sales Stand Budget Management               │
├─────────────────────────────────────────────┤
│                                             │
│ Stand: Back to School Display (STAND001)    │
│                                             │
│ Salesman          Allocated  Used  Avail    │
│ ─────────────────────────────────────────── │
│ Γιάννης Π.            10      3      7      │
│ Μαρία Γ.              15      10     5      │
│ Νίκος Ι.               8      6      2      │
│                                             │
│ [Transfer Budget Between Salesmen]          │
│ [View Assignments]                          │
└─────────────────────────────────────────────┘
```

---

### UI Components Needed

#### 1. **Sales Stands Screen** (`SalesStandsScreen.js`)

- Grid of available stands with images
- Filter by category/status
- Shows budget availability
- Tap to view details → Add to order

#### 2. **Stand Detail Modal** (`StandDetailModal.js`)

- Display image and description
- List of included products with quantities
- Total value
- "Add to Order" button with budget check

#### 3. **Stand Budget Widget** (in Order Customer Select or Header)

```
┌─────────────────────┐
│ 🎁 Stands: 7/10     │
└─────────────────────┘
```

#### 4. **Order Review Stand Section**

- Separate section for stand items
- Visual distinction (background color, border)
- Lock icons on quantities
- Clear indication of base vs additional

#### 5. **Budget Management Screen** (Admin only)

- Allocate stands to salesmen
- View assignments by stand/salesman
- Transfer budget between salesmen
- View customer assignments

---

### Business Rules

#### **Budget Enforcement**

1. **On Stand Addition**:
   ```
   available = allocated - used
   IF available > 0:
     allow addition
     decrement available
   ELSE:
     check other salesmen budgets
     show warning + request transfer
   ```

2. **On Order Cancellation**:
   - If order contained a stand
   - Increment salesman's available budget
   - Remove customer assignment record

3. **On Order Delivery**:
   - Update assignment status to "delivered"
   - Budget remains used

#### **Product Quantity Rules**

1. **Base Quantity** (from stand):
   - Cannot be reduced below stand requirement
   - Locked in UI
   - Removed only when entire stand is removed

2. **Additional Quantity**:
   - Can be added freely
   - Can be reduced to zero
   - Removed independently from stand

3. **Display Item**:
   - Always quantity 1
   - Cannot be modified
   - Free (price = 0)

---

### Reports & Analytics

#### **Stand Usage Report**

```
Stand: Back to School Display (STAND001)
Period: Q1 2025

Total Allocated: 50 stands
Total Used: 38 stands
Remaining: 12 stands

By Salesman:
┌──────────────────────────────────────────┐
│ Salesman       Allocated  Used  %        │
├──────────────────────────────────────────┤
│ Γιάννης Π.         10      8    80%      │
│ Μαρία Γ.           15     12    80%      │
│ Νίκος Ι.            8      7    87.5%    │
└──────────────────────────────────────────┘

Customer Assignments: [View List]
```

#### **Customer Stand History**

In customer detail screen:

```
Sales Stands Received:
- 2025-01-15: Back to School Display (Γιάννης Π.)
- 2024-09-10: Christmas Collection Stand (Μαρία Γ.)
- 2024-05-20: Summer Vacation Display (Γιάννης Π.)
```

---

### Implementation Priority

#### **Phase 1: Core Functionality**
1. Create Firestore collections & structure
2. Stand definition management (admin)
3. Budget allocation to salesmen
4. Add stand to order flow
5. Budget check & warnings

#### **Phase 2: Order Integration**
6. Display stand items in order review
7. Lock/unlock quantity logic
8. Remove stand functionality
9. Order submission with stand data

#### **Phase 3: Tracking & Reports**
10. Customer assignment tracking
11. Budget usage reports
12. Stand history per customer
13. Admin budget management UI

#### **Phase 4: Advanced Features**
14. Budget transfer requests
15. Stand return functionality
16. Multi-salesman approval workflow
17. Analytics dashboard

---

### Key Considerations

**Data Integrity**:
- Use Firestore transactions when decrementing budget
- Prevent race conditions on budget allocation
- Validate budget before order finalization

**User Experience**:
- Clear visual distinction of locked items
- Helpful warnings when budget exhausted
- Easy way to add extra quantities
- Simple stand removal process

**Permissions**:
- Salesmen: Can only use their allocated stands
- Managers: Can view all budgets, transfer between salesmen
- Admins: Can create stands, allocate budget

**Edge Cases**:
- What if stand products are discontinued?
- What if salesman leaves company with used budget?
- What if customer returns products from stand?
- What if display is damaged and needs replacement?

This structure provides flexibility, clear tracking, and enforces business rules while maintaining good UX!