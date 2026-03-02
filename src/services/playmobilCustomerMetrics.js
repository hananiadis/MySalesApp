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

    // Filter customer records from all datasets (using dynamic years)
    const customerInvoicedCurrent = filterByCustomer(sheetsData[`invoiced${currentYear}`] || []);
    const customerInvoicedPrevious = filterByCustomer(sheetsData[`invoiced${previousYear}`] || []);
    const customerOrdersCurrent = filterByCustomer(sheetsData[`orders${currentYear}`] || []);

    console.log('[calculateCustomerMetrics] Customer records:', {
      [currentYear]: customerInvoicedCurrent.length,
      [previousYear]: customerInvoicedPrevious.length,
      [`orders${currentYear}`]: customerOrdersCurrent.length,
    });

    // Calculate full year totals
    const fullYearInvoicedPrevious = sumAmounts(customerInvoicedPrevious);
    const fullYearInvoicedCurrent = sumAmounts(customerInvoicedCurrent);

    // Calculate YTD (Year-to-Date) - from Jan 1 to reference date
    const ytdInvoicedPrevious = customerInvoicedPrevious
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
    const mtdInvoicedCurrent = customerInvoicedCurrent
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
    const fullMonthInvoicedPrevious = customerInvoicedPrevious
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
    const mtdInvoicedPrevious = customerInvoicedPrevious
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
    const openOrdersAmount = sumAmounts(customerOrdersCurrent);

    const result = {
      customerCode,
      currentYear,
      previousYear,
      
      // Full year metrics
      [`fullYearInvoiced${previousYear}`]: fullYearInvoicedPrevious,
      [`fullYearInvoiced${currentYear}`]: fullYearInvoicedCurrent,
      
      // YTD metrics (with "Invoiced" for backward compatibility)
      [`ytdInvoiced${previousYear}`]: ytdInvoicedPrevious,
      [`ytdInvoiced${currentYear}`]: fullYearInvoicedCurrent, // Current year is always YTD
      
      // MTD metrics (with "Invoiced" for backward compatibility)
      [`mtdInvoiced${previousYear}`]: mtdInvoicedPrevious, // Previous year MTD
      [`mtdInvoiced${currentYear}`]: mtdInvoicedCurrent, // Current year MTD
      [`fullMonthInvoiced${previousYear}`]: fullMonthInvoicedPrevious, // Full month of previous year
      
      // Orders
      openOrdersAmount,
      
      // Calculations
      ytdChangePercent: ytdInvoicedPrevious > 0 
        ? ((fullYearInvoicedCurrent - ytdInvoicedPrevious) / ytdInvoicedPrevious) * 100 
        : null,
      mtdChangePercent: mtdInvoicedPrevious > 0 
        ? ((mtdInvoicedCurrent - mtdInvoicedPrevious) / mtdInvoicedPrevious) * 100 
        : null,
      
      // Raw records for detailed view (using dynamic year keys)
      records: {
        [currentYear]: customerInvoicedCurrent,
        [previousYear]: customerInvoicedPrevious,
        [`orders${currentYear}`]: customerOrdersCurrent,
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
