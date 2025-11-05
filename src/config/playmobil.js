// src/config/playmobil.js

export const PLAYMOBIL_CONFIG = {
  // Firestore collections
  collections: {
    customers: 'customers',
    sheetsCache: 'sheetsCache',
    users: 'users'
  },

  // Google Sheets CSV URLs (your actual published links)
  sheetUrls: {
    sales2025:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vTG9rEF1fDFT7Z4M4Q7ejMGFmLtbS3gsORfFOP19ESNV00TticfgHxfnmvPOd28Nm23783aXLafj-TL/pub?gid=616087206&single=true&output=csv',
    orders2025:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vTG9rEF1fDFT7Z4M4Q7ejMGFmLtbS3gsORfFOP19ESNV00TticfgHxfnmvPOd28Nm23783aXLafj-TL/pub?gid=724538995&single=true&output=csv',
    balance2025:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vTG9rEF1fDFT7Z4M4Q7ejMGFmLtbS3gsORfFOP19ESNV00TticfgHxfnmvPOd28Nm23783aXLafj-TL/pub?gid=440325138&single=true&output=csv',
    sales2024:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vT6ovPvxxcXY5Ufs1-xUGnubbpASr0NqQNZwAcmX3Qp-zs9tkgCe3vKQlSdP-4P5nX_U_YoTlKSYUbf/pub?gid=466675476&single=true&output=csv',
    orders2024:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vT6ovPvxxcXY5Ufs1-xUGnubbpASr0NqQNZwAcmX3Qp-zs9tkgCe3vKQlSdP-4P5nX_U_YoTlKSYUbf/pub?gid=729827210&single=true&output=csv'
  },

  // Column name mappings (match your sheet headers)
  columnNames: {
    sales: {
      customerCode: 'Payer',
      customerName: 'Name Payer',
      revenue: 'Sales revenue',
      billingDate: 'Billing Date'
    },
    orders: {
      customerCode: 'Bill-To Party',
      customerName: 'Name bill-to',
      grossValue: 'Gross value',
      documentDate: 'Document Date'
    },
    balance: {
      customerCode: 'Customer',
      customerName: 'Name',
      balance: 'Balance'
    }
  },

  // Cache duration (hours)
  cache: {
    durationHours: 24
  },

  // Date format of your sheets
  dateFormat: 'D/M/YYYY'
};
