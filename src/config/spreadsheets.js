// /src/config/spreadsheets.js
// Central registry for all Google Sheets used in MySalesApp.
// Each entry defines a unique cache key, a source URL, and a TTL (hours).

export const SPREADSHEETS = {
  // --- PLAYMOBIL ---
  playmobilSales: {
    key: 'sheet_playmobil_sales',
    url: 'https://docs.google.com/spreadsheets/d/1_HxZwIyB3Rhv3ZO4DgH-uIgr3uvr97vw-W3VM0GswFA/export?format=csv&gid=499925136',
    type: 'csv',
    ttlHours: 24,
    // Only keep essential columns to reduce storage size
    keepColumns: [4, 5, 13, 19, 20, 21, 22], // Bill-to, Name, Budget, Open Orders, Open Dlv's, Total Orders, %O/B
  },
  playmobilStock: {
    key: 'sheet_playmobil_stock',
    url: 'https://docs.google.com/spreadsheets/d/1VG7QzMgj0Ib0jNXZM5dLFgDyyer8gvSmkkaVZzMZcEM/gviz/tq?tqx=out:json&sheet=Sheet1',
    type: 'gviz',
    ttlHours: 24,
  },
  // Playmobil KPI Sheets
  sales2025: {
    key: 'sheet_playmobil_sales_2025',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTG9rEF1fDFT7Z4M4Q7ejMGFmLtbS3gsORfFOP19ESNV00TticfgHxfnmvPOd28Nm23783aXLafj-TL/pub?gid=616087206&single=true&output=csv',
    type: 'csv',
    ttlHours: 12,
  },
  orders2025: {
    key: 'sheet_playmobil_orders_2025',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTG9rEF1fDFT7Z4M4Q7ejMGFmLtbS3gsORfFOP19ESNV00TticfgHxfnmvPOd28Nm23783aXLafj-TL/pub?gid=724538995&single=true&output=csv',
    type: 'csv',
    ttlHours: 12,
  },
  balance2025: {
    key: 'sheet_playmobil_balance_2025',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTG9rEF1fDFT7Z4M4Q7ejMGFmLtbS3gsORfFOP19ESNV00TticfgHxfnmvPOd28Nm23783aXLafj-TL/pub?gid=440325138&single=true&output=csv',
    type: 'csv',
    ttlHours: 12,
  },
  sales2024: {
    key: 'sheet_playmobil_sales_2024',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT6ovPvxxcXY5Ufs1-xUGnubbpASr0NqQNZwAcmX3Qp-zs9tkgCe3vKQlSdP-4P5nX_U_YoTlKSYUbf/pub?gid=466675476&single=true&output=csv',
    type: 'csv',
    ttlHours: 12,
  },
  orders2024: {
    key: 'sheet_playmobil_orders_2024',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT6ovPvxxcXY5Ufs1-xUGnubbpASr0NqQNZwAcmX3Qp-zs9tkgCe3vKQlSdP-4P5nX_U_YoTlKSYUbf/pub?gid=729827210&single=true&output=csv',
    type: 'csv',
    ttlHours: 12,
  },
  sheet_playmobil_orders_2025: {
  key: 'sheet_playmobil_orders_2025',
  url: 'https://docs.google.com/spreadsheets/d/1JM1GNHLNim1R59MS62rI6kcrf_gdwMs0fRnxg9cw-sg/export?format=csv&gid=<gid_for_D_total_incom_orders>',
  type: 'csv',
  ttlHours: 24,
},
sheet_playmobil_orders_2024: {
  key: 'sheet_playmobil_orders_2024',
  url: 'https://docs.google.com/spreadsheets/d/1TSvC2gkaoOl-dZhLd_SpvVaZxswRiC-DLlV0y_JADQ0/export?format=csv&gid=<gid_for_D_total_incom_orders>',
  type: 'csv',
  ttlHours: 24,
},

  // --- KIVOS ---
  kivosCustomers: {
    key: 'sheet_kivos_customers',
    url: 'https://docs.google.com/spreadsheets/d/1pCVVgFiutK92nZFYSCkQCQbedqaKgvQahnix6bHSRIU/gviz/tq?gid=0',
    type: 'gviz',
    ttlHours: 24,
  },
  kivosCredit: {
    key: 'sheet_kivos_credit',
    url: 'https://docs.google.com/spreadsheets/d/1JJtzoDJjwwfIm-bBcPAX_aaeNHkGSGzPBo0blFTHfSc/gviz/tq?gid=0',
    type: 'gviz',
    ttlHours: 24,
  },
  // Kivos KPI Sales Sheets
  // Column structure: A=Date, B=DocType, C=CustomerCode, D=CustomerName, E=TotalAmount
  kivosSales2025: {
    key: 'sheet_kivos_sales_2025',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSiqthQnUaVTHPWjc3PNyQvFFV73dztRXxD2fXZM6WaAjD9H8CyP5OhwPKBOt9cHMknSm0GH-nmUIK3/pub?output=csv',
    type: 'csv',
    ttlHours: 12, // Refresh more frequently for current year
    keepColumns: [0, 1, 2, 3, 4], // Date, DocType, CustomerCode, CustomerName, TotalAmount
  },
  kivosSales2024: {
    key: 'sheet_kivos_sales_2024',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQpEzGDHsHJKXfyr3Z2z4PjCa7xpVX6JSafv1rDSNbpkp_8X1dXC-bHmMhyDdvgKxlfzlNVKprVQuAH/pub?output=csv',
    type: 'csv',
    ttlHours: 168, // Historical data, refresh weekly (7 days)
    keepColumns: [0, 1, 2, 3, 4], // Date, DocType, CustomerCode, CustomerName, TotalAmount
  },
  kivosSales2023: {
    key: 'sheet_kivos_sales_2023',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRL-wWy0sjpsaoPQpzBMhIhFiyDg2XGfS5VbHDjmvWPcJAQST0yxMKn_iPiDnhqmoZHzMgjAq4hfGG1/pub?output=csv',
    type: 'csv',
    ttlHours: 168, // Historical data, refresh weekly
    keepColumns: [0, 1, 2, 3, 4], // Date, DocType, CustomerCode, CustomerName, TotalAmount
  },
  kivosSales2022: {
    key: 'sheet_kivos_sales_2022',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQq3uY-Z-qCtjJ-RH-9bWfotaP1cPC-H-b5fDoyHRt4wcZ0QqT9Kw3e2pX0lGXO3Teew_gZ3y8uXbtu/pub?output=csv',
    type: 'csv',
    ttlHours: 720, // Historical data, refresh monthly (30 days)
    keepColumns: [0, 1, 2, 3, 4], // Date, DocType, CustomerCode, CustomerName, TotalAmount
  },

  // --- SUPERMARKET ---
  supermarketInventory: {
    key: 'sheet_supermarket_inventory',
    url: 'https://docs.google.com/spreadsheets/d/1A1HlA27aaamZy-smzvbr6DckmH7MGME2NNwMMNOnZVI/export?format=csv&gid=1490385526',
    type: 'csv',
    ttlHours: 24,
  },
};
