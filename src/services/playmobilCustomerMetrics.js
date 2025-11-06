// src/services/playmobilCustomerMetrics.js
// Customer-specific metrics calculation for Playmobil

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllSheetsData } from './playmobilKpi';
import { parseLocaleNumber } from '../utils/numberFormat';

/**
 * Calculate customer-specific sales metrics
 * @param {string} customerCode - Customer code to filter by
 * @param {Date} referenceDate - Reference date for calculations
 * @returns {Promise<Object>} Customer metrics
 */
export async function calculateCustomerMetrics(customerCode, referenceDate = new Date()) {
  console.log('[calculateCustomerMetrics] START', { customerCode, referenceDate });

  try {
    // Get cached sheets data (will use cache if available, fetch if stale)
    const sheetsData = await getAllSheetsData();
    
    const refDate = new Date(referenceDate);
    const currentYear = refDate.getFullYear();
    const previousYear = currentYear - 1;
    const currentMonth = refDate.getMonth(); // 0-based
    const currentDay = refDate.getDate();

    // Helper to filter records by customer code
    const filterByCustomer = (records) => {
      return records.filter(record => {
        const recordCode = record.customerCode || record.Payer || record.code;
        return String(recordCode || '').trim() === String(customerCode).trim();
      });
    };

    // Helper to parse date from record
    const parseRecordDate = (record) => {
      const dateStr = record.date || record.Date || record.documentDate;
      if (!dateStr) return null;
      
      // Try to parse the date string
      const parts = String(dateStr).split(/[\/\-\.]/);
      if (parts.length === 3) {
        // Assume DD/MM/YYYY or similar
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-based
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      
      return new Date(dateStr);
    };

    // Helper to sum amounts
    const sumAmounts = (records) => {
      return records.reduce((sum, record) => {
        const amount = parseLocaleNumber(
          record.amount || 
          record.total || 
          record.value || 
          record['Sales revenue'] || 
          0
        );
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
    };

    // Filter customer records from all datasets
    const customerInvoiced2025 = filterByCustomer(sheetsData.invoiced2025 || []);
    const customerInvoiced2024 = filterByCustomer(sheetsData.invoiced2024 || []);
    const customerOrders2025 = filterByCustomer(sheetsData.orders2025 || []);

    console.log('[calculateCustomerMetrics] Customer records:', {
      invoiced2025: customerInvoiced2025.length,
      invoiced2024: customerInvoiced2024.length,
      orders2025: customerOrders2025.length,
    });

    // Calculate full year totals
    const fullYearInvoiced2024 = sumAmounts(customerInvoiced2024);
    const fullYearInvoiced2025 = sumAmounts(customerInvoiced2025);

    // Calculate YTD (Year-to-Date) - from Jan 1 to reference date
    const ytdInvoiced2024 = customerInvoiced2024
      .filter(record => {
        const recordDate = parseRecordDate(record);
        if (!recordDate) return true; // Include if date parsing fails
        const recordYear = recordDate.getFullYear();
        if (recordYear !== previousYear) return false;
        
        // Check if date is within YTD window of previous year
        const recordMonth = recordDate.getMonth();
        const recordDay = recordDate.getDate();
        
        return (recordMonth < currentMonth) || 
               (recordMonth === currentMonth && recordDay <= currentDay);
      })
      .reduce((sum, record) => {
        const amount = parseLocaleNumber(
          record.amount || record.total || record.value || record['Sales revenue'] || 0
        );
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    // Calculate MTD (Month-to-Date) for current month
    const mtdInvoiced2025 = customerInvoiced2025
      .filter(record => {
        const recordDate = parseRecordDate(record);
        if (!recordDate) return false;
        const recordYear = recordDate.getFullYear();
        const recordMonth = recordDate.getMonth();
        const recordDay = recordDate.getDate();
        
        return recordYear === currentYear && 
               recordMonth === currentMonth && 
               recordDay <= currentDay;
      })
      .reduce((sum, record) => {
        const amount = parseLocaleNumber(
          record.amount || record.total || record.value || record['Sales revenue'] || 0
        );
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    // Calculate full month for previous year (entire month)
    const fullMonthInvoiced2024 = customerInvoiced2024
      .filter(record => {
        const recordDate = parseRecordDate(record);
        if (!recordDate) return false;
        const recordYear = recordDate.getFullYear();
        const recordMonth = recordDate.getMonth();
        
        return recordYear === previousYear && recordMonth === currentMonth;
      })
      .reduce((sum, record) => {
        const amount = parseLocaleNumber(
          record.amount || record.total || record.value || record['Sales revenue'] || 0
        );
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    // Calculate MTD for previous year (same month, up to current day)
    const mtdInvoiced2024 = customerInvoiced2024
      .filter(record => {
        const recordDate = parseRecordDate(record);
        if (!recordDate) return false;
        const recordYear = recordDate.getFullYear();
        const recordMonth = recordDate.getMonth();
        const recordDay = recordDate.getDate();
        
        return recordYear === previousYear && 
               recordMonth === currentMonth && 
               recordDay <= currentDay;
      })
      .reduce((sum, record) => {
        const amount = parseLocaleNumber(
          record.amount || record.total || record.value || record['Sales revenue'] || 0
        );
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    // Calculate open orders totals
    const openOrdersAmount = sumAmounts(customerOrders2025);

    const result = {
      customerCode,
      currentYear,
      previousYear,
      
      // Full year metrics
      fullYearInvoiced2024,
      fullYearInvoiced2025,
      
      // YTD metrics
      ytdInvoiced2024,
      ytdInvoiced2025: fullYearInvoiced2025, // Current year is always YTD
      
      // MTD metrics
      mtdInvoiced2024, // Previous year MTD
      mtdInvoiced2025, // Current year MTD
      fullMonthInvoiced2024, // Full month of previous year
      
      // Orders
      openOrdersAmount,
      
      // Calculations
      ytdChangePercent: ytdInvoiced2024 > 0 
        ? ((fullYearInvoiced2025 - ytdInvoiced2024) / ytdInvoiced2024) * 100 
        : null,
      mtdChangePercent: mtdInvoiced2024 > 0 
        ? ((mtdInvoiced2025 - mtdInvoiced2024) / mtdInvoiced2024) * 100 
        : null,
      
      // Raw records for detailed view
      records: {
        invoiced2025: customerInvoiced2025,
        invoiced2024: customerInvoiced2024,
        orders2025: customerOrders2025,
      },
    };

    console.log('[calculateCustomerMetrics] SUCCESS', result);
    return result;
  } catch (error) {
    console.error('[calculateCustomerMetrics] ERROR:', error);
    throw error;
  }
}

/**
 * Get customer balance from balance sheet
 * @param {string} customerCode - Customer code
 * @returns {Promise<number|null>} Balance amount
 */
export async function getCustomerBalance(customerCode) {
  console.log('[getCustomerBalance] START', { customerCode });

  try {
    const sheetsData = await getAllSheetsData();
    const balanceRecords = sheetsData.balance2025 || [];
    
    const customerRecord = balanceRecords.find(record => {
      const recordCode = record.customerCode || record.Payer || record.code || record['Bill-to'];
      return String(recordCode || '').trim() === String(customerCode).trim();
    });

    if (!customerRecord) {
      console.log('[getCustomerBalance] No balance record found');
      return null;
    }

    const balance = parseLocaleNumber(
      customerRecord.balance || 
      customerRecord.Balance || 
      customerRecord.total || 
      customerRecord.Total ||
      0
    );

    console.log('[getCustomerBalance] SUCCESS', { balance });
    return isNaN(balance) ? null : balance;
  } catch (error) {
    console.error('[getCustomerBalance] ERROR:', error);
    return null;
  }
}
