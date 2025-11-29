# MySalesApp - User Roles & Features Guide

## Overview

MySalesApp is a multi-brand sales management application for field salespeople and administrators. The app supports three main brands:
- **Playmobil** - Toy products
- **Kivos** - Educational/office supplies
- **John Hellas** - Various products including supermarket orders

## User Roles

The application supports different user roles with varying levels of access and functionality:

### Role Hierarchy
1. **Owner (Ιδιοκτήτης)** - Full system access
2. **Admin (Διαχειριστής)** - Administrative access
3. **Developer (Προγραμματιστής)** - Technical access
4. **Sales Manager (Διευθ. Πωλήσεων)** - Team management
5. **Salesman (Πωλητής)** - Basic sales functionality
6. **Warehouse Manager (Υπευθ. Αποθήκης)** - Inventory management
7. **Customer (Πελάτης)** - Limited customer portal access

---

## Admin User Functionality

### What Admins Can Do

#### 1. **User Management**
- Create, edit, and delete user accounts
- Assign roles to users (Salesman, Sales Manager, etc.)
- Assign brand access (Playmobil, Kivos, John)
- Assign customer codes (merchIds) to salespeople
- View all users in the system

#### 2. **Brand Navigation**
- Access all brand modules regardless of assignment
- Switch between Playmobil, Kivos, and John brands
- View brand-specific home screens and features

#### 3. **Data Management**
- Force refresh Google Sheets data for all brands
- Export KPI data to Excel files
- View comprehensive dashboards with all metrics
- Access test/debug screens for troubleshooting

#### 4. **Order Management**
- View all orders across all brands
- Review order history
- Access detailed order information
- Monitor order statuses

#### 5. **KPI & Analytics**
- View Playmobil KPI dashboard with:
  - Monthly (MTD) performance metrics
  - Year-to-Date (YTD) comparisons
  - Yearly totals
  - Customer-specific sales data
- Click KPI cards to view detailed transaction lists
- Export KPI reports to Excel
- Compare current vs previous year performance

#### 6. **Customer Data**
- View all customers across all brands
- Access customer sales summaries
- See customer balances and credit information
- View customer purchase history with interactive charts
- Access detailed transaction breakdowns

#### 7. **Product Catalog**
- View all products across all brands
- Search and filter products
- See product details including:
  - Pricing (wholesale, SRP, offers)
  - Stock availability
  - Product images
  - Catalog page numbers
  - Package sizes

#### 8. **Profile Settings**
- View and edit own profile
- See assigned brands and customer codes
- Check last sync timestamp
- Monitor online/offline status

---

## Salesman User Functionality

### What Salesmen Can Do

#### 1. **Brand Access**
- Access only assigned brands (typically one: Playmobil, Kivos, or John)
- Automatic navigation to single brand if only one assigned
- Brand-specific home screen with quick actions

#### 2. **Customer Management**
- View assigned customers only (based on merchIds)
- Search customers by:
  - Name
  - Code
  - Brand
- View customer details:
  - Contact information
  - Sales history
  - Current balance
  - Purchase trends

#### 3. **Customer Sales Summary (Playmobil)**
- **Year Comparison Card**
  - View previous year's invoiced total
  - See current year's budget
  - Click to view transaction details
  
- **YTD (Year-to-Date) Card**
  - Compare YTD invoiced amounts (current vs previous year)
  - See percentage change
  - Click to view YTD transactions
  
- **MTD (Month-to-Date) Card**
  - Compare current month to previous year same month
  - View both MTD and full month comparisons
  - Click to view monthly transactions

- **Open Orders**
  - View pending orders
  - See open deliveries
  - Total orders amount

- **Balance Information**
  - Current account balance
  - Credit status

#### 4. **Order Creation & Management**

##### Standard Orders (Playmobil, Kivos)
1. **Select Customer**
   - Choose from assigned customers
   - View customer info during selection

2. **Select Products**
   - Browse products by category
   - Search by code or description
   - View product images and details
   - Check stock availability
   - Add quantities using +/- buttons
   - See running total

3. **Review Order**
   - Verify customer details
   - Review product list with quantities
   - See pricing based on payment method
   - Check total amount

4. **Submit Order**
   - Choose payment method (prepaid, cash, check, etc.)
   - Add delivery notes
   - Submit to system

##### SuperMarket Orders (John brand)
1. **Select Store**
   - Filter by brand (Sklavenitis, Masoutis, etc.)
   - Filter by category (Μεγάλο, Μεσαίο, Μικρό)
   - Search stores by name/code
   - View store details

2. **Select Products**
   - Same as standard orders
   - SuperMarket-specific pricing

3. **Review & Submit**
   - Same process as standard orders

#### 5. **KPI Dashboard (Playmobil Only)**
- View personal performance metrics:
  - **Monthly Cards (MTD)**
    - Invoiced sales vs previous year
    - Orders vs previous year
    - Click to see transaction details
  
  - **Yearly Cards**
    - Full year invoiced comparison
    - Full year orders comparison
    - Top 25 customers view
  
  - **Interactive Features**
    - Click any KPI card to see detailed transactions
    - View individual sales records with:
      - Date
      - Customer name
      - Amount
    - Scroll through transaction history

#### 6. **Product Catalog**
- View products for assigned brands
- Search and filter
- See pricing and availability
- View product images
- Check package information

#### 7. **Data Synchronization**
- Pull latest customer data
- Pull latest product data
- View last sync timestamp
- Offline mode support (uses cached data)

#### 8. **Profile**
- View own information
- See role label (Πωλητής)
- Check assigned brands
- See assigned customer codes
- Monitor sync status

---

## Key Differences: Admin vs Salesman

| Feature | Admin | Salesman |
|---------|-------|----------|
| **Brand Access** | All brands | Assigned brands only |
| **Customer View** | All customers | Assigned customers only |
| **User Management** | ✅ Full access | ❌ No access |
| **KPI Dashboard** | ✅ All data | ✅ Personal data only |
| **Export Data** | ✅ Yes | ❌ No |
| **Debug Tools** | ✅ Yes | ❌ No |
| **Order Creation** | ✅ All customers | ✅ Assigned customers |
| **Profile Edit** | ✅ All users | ✅ Own profile only |

---

## Common Workflows

### For Salesmen: Daily Order Taking

1. **Morning Preparation**
   - Open app and sync data
   - Check KPI dashboard for personal targets
   - Review customer balances

2. **Customer Visit**
   - Navigate to brand → New Order
   - Select customer from list
   - Browse/search products
   - Add items to cart with quantities
   - Review order total
   - Submit order with payment method

3. **Between Visits**
   - Check customer sales summaries
   - View previous orders
   - Plan next visits based on KPIs

4. **End of Day**
   - Review submitted orders
   - Check updated KPIs
   - Sync latest data

### For Admins: System Management

1. **User Setup**
   - Create new salesman account
   - Assign appropriate role
   - Assign brand access
   - Assign customer codes (merchIds)

2. **Monitoring**
   - Check KPI dashboards for all salespeople
   - Export reports as needed
   - Review order patterns

3. **Data Maintenance**
   - Refresh Google Sheets data periodically
   - Verify customer/product data accuracy
   - Export analytics reports

4. **Troubleshooting**
   - Access debug screens
   - Check sync logs
   - Verify user permissions

---

## Technical Features

### Data Sources
- **Google Sheets** - Primary data source for:
  - Playmobil sales data (invoiced & orders)
  - Kivos customer data
  - Product catalogs
  - Customer balances

- **Firestore** - User accounts and app configuration

- **AsyncStorage** - Local caching for offline support

### Caching Strategy
- **Month-Based Chunks** - Historical data cached permanently
- **Current Month** - Refreshed every 12 hours
- **In-Memory Cache** - Fast access during session
- **Smart Refresh** - Only updates current/recent data

### Offline Support
- Works offline using cached data
- Syncs when connection restored
- Shows online/offline status indicator

---

## Brand-Specific Features

### Playmobil
- KPI dashboards with YTD/MTD metrics
- Interactive transaction detail modals
- Customer sales summaries with charts
- Budget tracking
- Excel export functionality

### Kivos
- Customer credit breakdown
- Historical sales trends
- Balance tracking
- Simplified order flow

### John Hellas
- SuperMarket store management
- Store filtering by brand and category
- Store-specific pricing
- Special order flow for retail chains

---

## Getting Started

### For New Salesmen
1. Receive credentials from admin
2. Login to app
3. Navigate to assigned brand
4. Sync customer and product data
5. Start taking orders

### For New Admins
1. Receive admin credentials
2. Login to app
3. Access User Management
4. Set up salespeople
5. Assign brands and customers
6. Monitor KPI dashboards

---

## Support & Troubleshooting

### Common Issues

**"No customers shown"**
- Check if merchIds are assigned to user
- Verify brand assignment
- Sync latest data

**"KPI not loading"**
- Check internet connection
- Force refresh from dashboard
- Wait for cache to update

**"Can't create order"**
- Verify customer assignment
- Check product availability
- Ensure valid payment method selected

**"Export not working"**
- Check if user has admin role
- Verify data is loaded
- Check storage permissions

---

## Security & Permissions

### Authentication
- Email/password login
- Role-based access control
- Automatic session management

### Data Access
- Salesmen see only assigned customers
- Customer codes (merchIds) control data visibility
- Admins have full access

### Offline Security
- Encrypted local storage
- Automatic logout on inactivity
- Secure credential storage

---

## Updates & Maintenance

### App Updates
- Managed through Expo OTA updates
- Automatic when online
- No app store approval needed for minor updates

### Data Refresh
- Automatic cache invalidation (12 hours)
- Manual refresh available
- Real-time sync for orders

---

*Last Updated: November 6, 2025*
