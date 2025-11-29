# 📱 MySalesApp — Brand Navigation & Playmobil KPIs / Customer Balance Implementation Plan

---

## 🧭 Navigation Logic (Brand Stacks)

### 🎯 Behavior Summary

| Context | Back Button Action |
|----------|--------------------|
| From brand sub-screen (Products, Customers, Catalogues, Orders, etc.) | ⬅️ Go back to **BrandHomeScreen** (not MainHome) |
| From BrandHomeScreen | ⬅️ Go back to **MainHomeScreen** |
| From MainHomeScreen | ⬅️ 1st press: show toast “Πατήστε ξανά για έξοδο” → 2nd press within 1.5 s ➡ exit app |

---

### ⚙️ Implementation Steps

1. **Brand Stack Navigation**
   - Each brand (`Playmobil`, `Kivos`, `John`) uses its own Stack Navigator.
   - First route → `BrandHomeScreen`  
     Inner routes → Products, Customers, Catalogues, Orders, etc.

2. **Hardware Back Handler**
   ```js
   useFocusEffect(
     useCallback(() => {
       const onBackPress = () => {
         const route = navigation.getState()?.routes?.slice(-1)[0]?.name;
         if (route !== 'BrandHomeScreen') {
           navigation.navigate('BrandHomeScreen', { brand });
         } else {
           navigation.navigate('MainHome');
         }
         return true;
       };
       const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
       return () => sub.remove();
     }, [])
   );
3. MainHomeScreen Double-Back Exit

import { BackHandler, ToastAndroid } from 'react-native';

const onBackPress = () => {
  const now = Date.now();
  if (now - lastBackPressRef.current < 1500) {
    BackHandler.exitApp();
  } else {
    lastBackPressRef.current = now;
    ToastAndroid.show('Πατήστε ξανά για έξοδο', ToastAndroid.SHORT);
  }
  return true;
};

4.Verify Flow

Products → Back → Brand Home

Brand Home → Back → Main Home

Main Home → Back → Toast → Double Back → Exit

📊 Playmobil KPIs — Brand-Level Dashboard
🗂️ Data Sources
Year	Spreadsheet	Sheets
2025 (current)	Sales_report_2025
	D_monthly sls, D_total incom.orders, D_cust.balance
2024 (previous)	Sales_report_2024
	D_monthly sls, D_total incom.orders
📈 KPI Metrics
Category	KPI	Source	Notes
Invoiced (Sales)	MTD / YTD Revenue (Σ F “Sales Revenue”)	D_monthly sls	Filter by current month & year
	Distinct customers invoiced	same	Unique Customer Codes (M)
	Δ vs Prev Year (%)	2024 sheet	compare MTD / YTD
Orders	MTD / YTD Gross Value (Σ I)	D_total incom.orders	current month/year
	Distinct order customers	same	Unique codes (B)
	Δ vs Prev Year (%)	2024 sheet	compare MTD / YTD
Balances	per-customer balance & snapshot date	D_cust.balance	used in CustomerSalesDetails.js
🧾 Sheet Columns Used
Sheet	Columns
D_monthly sls	F (Sales Revenue), L (Customer Name), M (Code), N (Billing Date), Q (Billing Type), R (Document No), Y (Transport)
D_total incom.orders	B (Code), C (Name), D (Order Date), I (Gross Value)
D_cust.balance	Customer, Name, Debit Curr Period, Credit Curr Period, Balance, Currency (+ next cell = snapshot date)
🧮 KPI Data Pipeline (Playmobil)
1️⃣ Spreadsheet Registration → /src/config/spreadsheets.js
export const SPREADSHEETS = {
  playmobilSales2025, playmobilOrders2025, playmobilBalances2025,
  playmobilSales2024, playmobilOrders2024,
  // ...existing entries
};

2️⃣ Service → /src/services/playmobilKpis.js

Responsible for loading and computing:

loadPlaymobilSales(year)

loadPlaymobilOrders(year)

computeSalesKpis(rows, { now, salesman })

computeOrdersKpis(rows, { now, salesman })

compareKpis(current, previous)

Returns object:

{
  mtdSales, ytdSales, mtdCustCount, ytdCustCount,
  mtdOrders, ytdOrders, mtdOrderCust, ytdOrderCust,
  mtdSalesDelta, ytdSalesDelta, mtdOrderDelta, ytdOrderDelta
}

3️⃣ UI Component → /src/components/BrandKpiHeader.js

Displays 4 cards: Sales MTD/YTD vs PY and Orders MTD/YTD vs PY.

Color-coded Δ% (green/red).

Reusable for any brand.

4️⃣ Integration → /src/screens/BrandHomeScreen.js
useFocusEffect(
  useCallback(() => {
    if (brand === 'playmobil') {
      loadPlaymobilKpis().then(setKpiData);
    }
  }, [brand])
);

{brand === 'playmobil' && <BrandKpiHeader data={kpiData} />}

💶 Customer Balance Enrichment (Playmobil)
Target

/src/screens/CustomerSalesDetails.js

Data Source

D_cust.balance from Sales_report_2025 (24 h cache)

1️⃣ Spreadsheet Key
playmobilBalances2025: {
  key: 'sheet_playmobil_balances_2025',
  url: 'https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=<gid>',
  type: 'csv',
  ttlHours: 24,
},

2️⃣ Service → /src/services/customerBalance.js
import { loadSpreadsheet } from './spreadsheetCache';
import { parseCSV } from '../utils/sheets';

export async function getCustomerBalance(customerCode) {
  const rows = await loadSpreadsheet('playmobilBalances2025');
  if (!rows) return null;
  const headers = rows[0];
  const currencyIdx = headers.findIndex((h) => h.toLowerCase().includes('currency'));
  const snapshotDate = headers[currencyIdx + 1];
  const codeIdx = headers.findIndex((h) => h.toLowerCase().includes('customer'));
  const balanceIdx = headers.findIndex((h) => h.toLowerCase().includes('balance'));
  const row = rows.find(
    (r) => String(r[codeIdx]).trim().toUpperCase() === String(customerCode).trim().toUpperCase()
  );
  if (!row) return null;
  return { code: row[codeIdx], balance: Number(row[balanceIdx]) || 0, date: snapshotDate };
}

3️⃣ Integration in CustomerSalesDetails
const [balance, setBalance] = useState(null);
useEffect(() => {
  if (customer?.code) getCustomerBalance(customer.code).then(setBalance);
}, [customer?.code]);

{balance && (
  <View style={styles.balanceBox}>
    <Text style={styles.balanceLabel}>Υπόλοιπο Πελάτη</Text>
    <Text style={styles.balanceValue}>
      {balance.balance.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
    </Text>
    <Text style={styles.balanceDate}>Ενημέρωση: {balance.date}</Text>
  </View>
)}

🧱 File-by-File Deliverables
File	Purpose
/src/config/spreadsheets.js	Register Playmobil 2025 & 2024 sheet keys (sales, orders, balances).
/src/services/playmobilKpis.js	Parse sales & orders sheets and compute MTD/YTD & comparison metrics.
/src/components/BrandKpiHeader.js	Render Playmobil KPI cards (Sales/Orders MTD/YTD vs PY).
/src/services/customerBalance.js	Fetch balance by customer code and snapshot date from D_cust.balance.
/src/screens/CustomerSalesDetails.js	Display customer balance block below sales info.
/src/navigation/BrandNavigator.js	Add stack back handlers → Brand Home ↔ Main Home.
/src/screens/MainHomeScreen.js	Keep double-back-to-exit toast behavior.
/src/screens/BrandHomeScreen.js	Integrate BrandKpiHeader (for Playmobil).
✅ Final Result Summary
Area	Result
Navigation	Unified back-press hierarchy with toast on exit
Playmobil Home	Live KPI panel for sales & orders vs previous year
Customer Details	Per-customer balance + snapshot date from sheet
Performance	All data cached (AsyncStorage + incremental Firestore + 24 h spreadsheet TTL)
Offline Support	Works after first successful sync