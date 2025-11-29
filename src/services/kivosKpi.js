// src/services/kivosKpi.js
// Kivos KPI calculation service

import firestore from '@react-native-firebase/firestore';
import { loadSpreadsheet } from './spreadsheetCache';
import { parseLocaleNumber } from '../utils/numberFormat';

console.log('[kivosKpi] Module loaded');

// In-memory cache for current session
let _memoryCache = {
  datasets: null,
  timestamp: null,
  headerDates: null,
};

// Cache TTL in hours
const CACHE_TTL_HOURS = 12;

/**
 * Get customer codes for given salesman IDs for Kivos brand
 * If salesmanIds is null or empty, returns all customers for user's assigned salesmen
 */
export async function getCustomerCodes(salesmanIds, brand = 'kivos') {
  console.log('[kivosKpi getCustomerCodes] START', { salesmanIds, brand });
  
  try {
    // Use customers_kivos collection for Kivos brand
    const customersRef = firestore().collection('customers_kivos');
    const customerCodes = [];
    
    // If no salesmanIds provided, get user's assigned salesmen first
    if (!salesmanIds || !Array.isArray(salesmanIds) || salesmanIds.length === 0) {
      console.log('[kivosKpi getCustomerCodes] No salesmanIds provided, fetching user\'s assigned salesmen');
      
      const { default: auth } = await import('@react-native-firebase/auth');
      const currentUser = auth().currentUser;
      
      if (!currentUser) {
        console.warn('[kivosKpi getCustomerCodes] No authenticated user');
        return [];
      }
      
      const userDoc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();
      
      const userData = userDoc.data();
      const merchIds = userData?.merchIds || [];
      
      // Filter for Kivos salesmen
      const kivosMerchIds = merchIds.filter(id => 
        String(id).toLowerCase().startsWith('kivos_')
      );
      
      if (kivosMerchIds.length === 0) {
        console.warn('[kivosKpi getCustomerCodes] No Kivos merchIds found for user');
        return [];
      }
      
      // Use user's Kivos salesmen
      salesmanIds = kivosMerchIds;
      console.log('[kivosKpi getCustomerCodes] Using user\'s Kivos salesmen:', salesmanIds);
    }

    // Extract merchNames from salesmanIds (format: "kivos_SALESMAN NAME")
    const merchNames = salesmanIds.map(id => {
      // Remove kivos_ prefix
      const withoutPrefix = String(id).replace(/^kivos_/i, '');
      return withoutPrefix; // Keep the exact case as stored
    });

    console.log('[kivosKpi getCustomerCodes] Extracted merchNames:', merchNames);

    // Query Firestore using array-contains-any for customers with merch array
    // Firestore limits array-contains-any to 10 items
    const batchSize = 10;
    
    for (let i = 0; i < merchNames.length; i += batchSize) {
      const batch = merchNames.slice(i, i + batchSize);
      
      const snapshot = await customersRef
        .where('merch', 'array-contains-any', batch)
        .get();
      
      console.log('[kivosKpi getCustomerCodes] Found', snapshot.size, 'customers for batch:', batch);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const code = data.customerCode || data.code || doc.id;
        if (code) {
          customerCodes.push(String(code).trim());
        }
      });
    }

    console.log('[kivosKpi getCustomerCodes] Found customer codes:', customerCodes.length);
    return [...new Set(customerCodes)]; // Remove duplicates
  } catch (error) {
    console.error('[kivosKpi getCustomerCodes] ERROR:', error.message);
    return [];
  }
}

/**
 * Load all Kivos sales sheets (2022-2025)
 */
export async function getAllSheetsData(options = {}) {
  console.log('[kivosKpi getAllSheetsData] START');
  
  try {
    // Check memory cache first
    if (_memoryCache.datasets && _memoryCache.timestamp) {
      const ageHours = (Date.now() - _memoryCache.timestamp) / (1000 * 60 * 60);
      if (ageHours < CACHE_TTL_HOURS && !options.force) {
        console.log(`[kivosKpi getAllSheetsData] Using in-memory cache (age: ${ageHours.toFixed(2)} hours)`);
        return _memoryCache.datasets;
      }
    }

    console.log('[kivosKpi getAllSheetsData] Loading sheets from storage/network...');

    // Load all 4 years of sales data
    const [sales2025, sales2024, sales2023, sales2022] = await Promise.all([
      loadSpreadsheet('kivosSales2025', { force: options.force }),
      loadSpreadsheet('kivosSales2024', { force: options.force }),
      loadSpreadsheet('kivosSales2023', { force: options.force }),
      loadSpreadsheet('kivosSales2022', { force: options.force }),
    ]);

    console.log('[kivosKpi getAllSheetsData] Sheets loaded:', {
      sales2025: sales2025?.length || 0,
      sales2024: sales2024?.length || 0,
      sales2023: sales2023?.length || 0,
      sales2022: sales2022?.length || 0,
    });

    // Parse and process each year's data
    const datasets = {
      sales2025: parseKivosSalesData(sales2025, 2025),
      sales2024: parseKivosSalesData(sales2024, 2024),
      sales2023: parseKivosSalesData(sales2023, 2023),
      sales2022: parseKivosSalesData(sales2022, 2022),
    };

    // Extract header date from 2025 sheet (first row, last cell)
    let headerReferenceDate = null;
    if (sales2025 && sales2025.length > 0 && sales2025[0].length > 0) {
      const lastCell = sales2025[0][sales2025[0].length - 1];
      if (lastCell) {
        const parsedDate = parseDate(lastCell);
        if (parsedDate) {
          headerReferenceDate = parsedDate;
          console.log('[kivosKpi getAllSheetsData] Header reference date:', headerReferenceDate.toISOString());
        }
      }
    }

    datasets._headerDates = {
      sales2025: headerReferenceDate,
    };

    // Store in memory cache
    _memoryCache = {
      datasets,
      timestamp: Date.now(),
      headerDates: datasets._headerDates,
    };

    console.log('[kivosKpi getAllSheetsData] Records:', {
      sales2025: datasets.sales2025.length,
      sales2024: datasets.sales2024.length,
      sales2023: datasets.sales2023.length,
      sales2022: datasets.sales2022.length,
    });

    return datasets;
  } catch (error) {
    console.error('[kivosKpi getAllSheetsData] ERROR:', error.message);
    throw error;
  }
}

/**
 * Parse Kivos sales data from CSV rows
 * Expected columns:
 * A: Date (Ημερ/νία)
 * B: Document Type (Παραστατικό) - Τ for Invoice, Π/Α for Credit Note
 * C: Customer Code (Κωδικός)
 * D: Customer Name (Επωνυμία)
 * E: Total Amount including 24% VAT (Συνολική)
 */
function parseKivosSalesData(rows, year) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const records = [];
  
  // Find header row (look for "Ημερ/νία" or "Ημερομηνία" or "Date")
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (Array.isArray(row) && row.length > 0) {
      const firstCell = String(row[0] || '').toLowerCase();
      if (firstCell.includes('ημερ') || firstCell.includes('date')) {
        headerRowIndex = i;
        break;
      }
    }
  }

  console.log(`[kivosKpi parseKivosSalesData] ${year} - Header at row ${headerRowIndex + 1}`);

  // Process data rows (skip header)
  let skippedDates = 0;
  let skippedYears = 0;
  const dateIssues = [];
  const sampleDates = []; // Track first 5 successful date parses
  
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length < 5) continue;

    // Column mapping: A=Date, B=DocType, C=Code, D=Name, E=Amount
    const dateStr = String(row[0] || '').trim();
    const docType = String(row[1] || '').trim();
    const customerCode = String(row[2] || '').trim();
    const customerName = String(row[3] || '').trim();
    const totalWithVAT = String(row[4] || '').trim();

    if (!dateStr || !customerCode || !totalWithVAT) continue;

    // Parse date
    const date = parseDate(dateStr);
    if (!date) {
      skippedDates++;
      if (dateIssues.length < 5) {
        dateIssues.push({ row: i + 1, dateStr, reason: 'Failed to parse' });
      }
      continue;
    }
    
    if (date.getFullYear() !== year) {
      skippedYears++;
      if (dateIssues.length < 5) {
        dateIssues.push({ 
          row: i + 1, 
          dateStr, 
          parsedYear: date.getFullYear(), 
          expectedYear: year,
          reason: 'Wrong year' 
        });
      }
      continue;
    }
    
    // Track first few successful date parses for debugging
    if (sampleDates.length < 5) {
      sampleDates.push({
        original: dateStr,
        parsed: date.toISOString().split('T')[0], // YYYY-MM-DD format
        month: date.getMonth() + 1,
        day: date.getDate(),
        year: date.getFullYear()
      });
    }

    // Parse amount (with VAT)
    const amountWithVAT = parseLocaleNumber(totalWithVAT, { defaultValue: 0 });
    if (amountWithVAT === 0) continue;

    // Determine if this is an invoice or credit note
    // Τ* = Invoice (positive)
    // Π* or Α* = Credit note (negative)
    const isInvoice = docType.startsWith('Τ');
    const isCreditNote = docType.startsWith('Π') || docType.startsWith('Α');
    
    if (!isInvoice && !isCreditNote) continue;

    // Calculate net amount (exclude VAT: amount / 1.24)
    let netAmount = amountWithVAT / 1.24;
    
    // Make credit notes negative
    if (isCreditNote) {
      netAmount = -netAmount;
    }

    records.push({
      date,
      dateStr,
      customerCode,
      customerName,
      docType,
      isInvoice,
      isCreditNote,
      amountWithVAT: isInvoice ? amountWithVAT : -amountWithVAT,
      netAmount,
      amount: netAmount, // Standardize field name
      revenue: formatCurrency(netAmount), // For display
      _rowIndex: i,
    });
  }

  console.log(`[kivosKpi parseKivosSalesData] ${year} - Parsed ${records.length} records`);
  
  if (sampleDates.length > 0) {
    console.log(`[kivosKpi parseKivosSalesData] ${year} - Sample parsed dates:`, sampleDates);
  }
  
  if (skippedDates > 0 || skippedYears > 0) {
    console.warn(`[kivosKpi parseKivosSalesData] ${year} - Skipped records:`, {
      skippedDates,
      skippedYears,
      sampleIssues: dateIssues,
    });
  }
  
  return records;
}

/**
 * Parse date string in various formats
 * Tries to intelligently detect MM/DD/YYYY vs DD/MM/YYYY
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  const str = String(dateStr).trim();
  
  // Try MM/DD/YYYY format first (common in US-formatted spreadsheets)
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, first, second, year] = mdyMatch;
    const firstNum = parseInt(first);
    const secondNum = parseInt(second);
    const yearNum = parseInt(year);
    
    // Try MM/DD/YYYY interpretation
    const mdyDate = new Date(yearNum, firstNum - 1, secondNum);
    const mdyValid = !isNaN(mdyDate.getTime()) && 
                     mdyDate.getDate() === secondNum && 
                     mdyDate.getMonth() === firstNum - 1 && 
                     mdyDate.getFullYear() === yearNum;
    
    // Try DD/MM/YYYY interpretation
    const dmyDate = new Date(yearNum, secondNum - 1, firstNum);
    const dmyValid = !isNaN(dmyDate.getTime()) && 
                     dmyDate.getDate() === firstNum && 
                     dmyDate.getMonth() === secondNum - 1 && 
                     dmyDate.getFullYear() === yearNum;
    
    // If both are valid, use heuristic: if first > 12, must be DD/MM/YYYY
    if (firstNum > 12) {
      return dmyValid ? dmyDate : null;
    }
    // If second > 12, must be MM/DD/YYYY
    if (secondNum > 12) {
      return mdyValid ? mdyDate : null;
    }
    // If both are valid and ambiguous, prefer MM/DD/YYYY for Kivos data
    // (based on user's observation that Kivos uses MM/DD/YYYY)
    if (mdyValid) {
      return mdyDate;
    }
    if (dmyValid) {
      return dmyDate;
    }
  }
  
  // Try DD-MM-YYYY format
  const dmyDashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDashMatch) {
    const [, day, month, year] = dmyDashMatch;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime()) && 
        d.getDate() === parseInt(day) && 
        d.getMonth() === parseInt(month) - 1 && 
        d.getFullYear() === parseInt(year)) {
      return d;
    }
  }
  
  // Try YYYY-MM-DD format
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime()) && 
        d.getDate() === parseInt(day) && 
        d.getMonth() === parseInt(month) - 1 && 
        d.getFullYear() === parseInt(year)) {
      return d;
    }
  }
  
  // Try YYYY/MM/DD format
  const ymdSlashMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlashMatch) {
    const [, year, month, day] = ymdSlashMatch;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime()) && 
        d.getDate() === parseInt(day) && 
        d.getMonth() === parseInt(month) - 1 && 
        d.getFullYear() === parseInt(year)) {
      return d;
    }
  }
  
  // Try standard Date parsing as last resort
  const date = new Date(str);
  return !isNaN(date.getTime()) ? date : null;
}

/**
 * Format number as currency
 */
function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '0,00';
  return amount.toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Calculate KPIs for specific customers
 */
export async function calculateKPIs(customerCodes, referenceDate = new Date(), options = {}) {
  console.log('[kivosKpi calculateKPIs] START', {
    customerCount: customerCodes?.length || 0,
    referenceDate: referenceDate.toISOString().split('T')[0],
  });

  try {
    // Load all sheets data
    const sheetsData = await getAllSheetsData(options);
    
    // Get header reference date if available
    let refMoment = referenceDate;
    if (sheetsData._headerDates?.sales2025) {
      refMoment = sheetsData._headerDates.sales2025;
      console.log('[kivosKpi calculateKPIs] Using header reference date:', refMoment.toISOString());
    }

    const refYear = refMoment.getFullYear();
    const refMonth = refMoment.getMonth();
    const refDay = refMoment.getDate();

    // Filter records for the specified customers
    // Normalize customer codes: trim whitespace and convert to uppercase
    const customerSet = new Set(
      customerCodes.map(c => String(c).trim().toUpperCase())
    );
    
    console.log('[kivosKpi calculateKPIs] Looking for customer codes:', Array.from(customerSet));
    
    const filteredData = {
      sales2025: sheetsData.sales2025.filter(r => {
        const normalized = String(r.customerCode || '').trim().toUpperCase();
        return customerSet.has(normalized);
      }),
      sales2024: sheetsData.sales2024.filter(r => {
        const normalized = String(r.customerCode || '').trim().toUpperCase();
        return customerSet.has(normalized);
      }),
      sales2023: sheetsData.sales2023.filter(r => {
        const normalized = String(r.customerCode || '').trim().toUpperCase();
        return customerSet.has(normalized);
      }),
      sales2022: sheetsData.sales2022.filter(r => {
        const normalized = String(r.customerCode || '').trim().toUpperCase();
        return customerSet.has(normalized);
      }),
    };

    console.log('[kivosKpi calculateKPIs] Filtered records:', {
      sales2025: filteredData.sales2025.length,
      sales2024: filteredData.sales2024.length,
      sales2023: filteredData.sales2023.length,
      sales2022: filteredData.sales2022.length,
    });
    
    // Log a sample of unmatched records from 2025 for debugging
    if (filteredData.sales2025.length === 0 && sheetsData.sales2025.length > 0) {
      const sampleCodes = sheetsData.sales2025
        .slice(0, 10)
        .map(r => String(r.customerCode || '').trim().toUpperCase());
      console.log('[kivosKpi calculateKPIs] Sample customer codes in sheet (first 10):', sampleCodes);
    }

    // Calculate YTD (Year-To-Date) metrics
    const ytdFilter = (record) => {
      const d = record.date;
      return (d.getMonth() < refMonth) || 
             (d.getMonth() === refMonth && d.getDate() <= refDay);
    };

    const ytd2025 = sumRecords(filteredData.sales2025.filter(ytdFilter));
    const ytd2024 = sumRecords(filteredData.sales2024.filter(ytdFilter));
    const ytd2023 = sumRecords(filteredData.sales2023.filter(ytdFilter));
    const ytd2022 = sumRecords(filteredData.sales2022.filter(ytdFilter));

    // Calculate MTD (Month-To-Date) metrics
    const mtdFilter = (record) => {
      const d = record.date;
      return d.getMonth() === refMonth && d.getDate() <= refDay;
    };

    const mtd2025 = sumRecords(filteredData.sales2025.filter(mtdFilter));
    const mtd2024 = sumRecords(filteredData.sales2024.filter(mtdFilter));
    const mtd2023 = sumRecords(filteredData.sales2023.filter(mtdFilter));
    const mtd2022 = sumRecords(filteredData.sales2022.filter(mtdFilter));

    // Calculate full year metrics
    const yearly2025 = sumRecords(filteredData.sales2025);
    const yearly2024 = sumRecords(filteredData.sales2024);
    const yearly2023 = sumRecords(filteredData.sales2023);
    const yearly2022 = sumRecords(filteredData.sales2022);

    // Calculate percentage changes
    const ytdChange = calculatePercentageChange(ytd2025.amount, ytd2024.amount);
    const mtdChange = calculatePercentageChange(mtd2025.amount, mtd2024.amount);
    const yearlyChange = calculatePercentageChange(yearly2025.amount, yearly2024.amount);

    const result = {
      referenceMoment: refMoment,
      context: {
        year: refYear,
        month: refMonth,
        day: refDay,
      },
      sales: {
        year2025: {
          ytd: { amount: ytd2025.amount, customers: ytd2025.customers, diff: { percent: ytdChange } },
          mtd: { amount: mtd2025.amount, customers: mtd2025.customers, diff: { percent: mtdChange } },
          yearly: { amount: yearly2025.amount, customers: yearly2025.customers, diff: { percent: yearlyChange } },
        },
        year2024: {
          ytd: { amount: ytd2024.amount, customers: ytd2024.customers },
          mtd: { amount: mtd2024.amount, customers: mtd2024.customers },
          yearly: { amount: yearly2024.amount, customers: yearly2024.customers },
        },
        year2023: {
          ytd: { amount: ytd2023.amount, customers: ytd2023.customers },
          mtd: { amount: mtd2023.amount, customers: mtd2023.customers },
          yearly: { amount: yearly2023.amount, customers: yearly2023.customers },
        },
        year2022: {
          ytd: { amount: ytd2022.amount, customers: ytd2022.customers },
          mtd: { amount: mtd2022.amount, customers: mtd2022.customers },
          yearly: { amount: yearly2022.amount, customers: yearly2022.customers },
        },
      },
      records: {
        year2025: filteredData.sales2025,
        year2024: filteredData.sales2024,
        year2023: filteredData.sales2023,
        year2022: filteredData.sales2022,
      },
    };

    console.log('[kivosKpi calculateKPIs] Result:', {
      hasSales: !!result.sales,
      year2025Ytd: result.sales.year2025.ytd.amount,
      year2024Ytd: result.sales.year2024.ytd.amount,
      recordCounts: {
        year2025: result.records.year2025.length,
        year2024: result.records.year2024.length,
        year2023: result.records.year2023.length,
        year2022: result.records.year2022.length,
      }
    });

    return result;
  } catch (error) {
    console.error('[kivosKpi calculateKPIs] ERROR:', error.message);
    throw error;
  }
}

/**
 * Sum amounts from records
 */
function sumRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { amount: 0, customers: 0 };
  }
  
  const amount = records.reduce((sum, r) => sum + (r.amount || 0), 0);
  const uniqueCustomers = new Set(records.map(r => r.customerCode)).size;
  
  return { amount, customers: uniqueCustomers };
}

/**
 * Calculate percentage change
 */
function calculatePercentageChange(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
