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
  },
  playmobilStock: {
    key: 'sheet_playmobil_stock',
    url: 'https://docs.google.com/spreadsheets/d/1VG7QzMgj0Ib0jNXZM5dLFgDyyer8gvSmkkaVZzMZcEM/gviz/tq?tqx=out:json&sheet=Sheet1',
    type: 'gviz',
    ttlHours: 24,
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

  // --- SUPERMARKET ---
  supermarketInventory: {
    key: 'sheet_supermarket_inventory',
    url: 'https://docs.google.com/spreadsheets/d/1A1HlA27aaamZy-smzvbr6DckmH7MGME2NNwMMNOnZVI/export?format=csv&gid=1490385526',
    type: 'csv',
    ttlHours: 24,
  },
};
