// src/services/kpiCalculations.js
import { PLAYMOBIL_CONFIG } from '../config/playmobil';
import { normalizeCustomerCode } from '../utils/customerCodes';

const { columnNames, dateFormat } = PLAYMOBIL_CONFIG;

const SALES_MAPPING = {
  code: columnNames.sales.customerCode,
  name: columnNames.sales.customerName,
  value: columnNames.sales.revenue,
  date: columnNames.sales.billingDate,
};

const ORDERS_MAPPING = {
  code: columnNames.orders.customerCode,
  name: columnNames.orders.customerName,
  value: columnNames.orders.grossValue,
  date: columnNames.orders.documentDate,
};

const BALANCE_MAPPING = {
  code: columnNames.balance.customerCode,
  name: columnNames.balance.customerName,
  balance: columnNames.balance.balance,
  snapshot: columnNames.balance.snapshotDate || 'Snapshot Date',
};

const GREEK_TO_LATIN_MONTH = {
  '\u03b1': 'a',
  '\u03b2': 'v',
  '\u03b3': 'g',
  '\u03b4': 'd',
  '\u03b5': 'e',
  '\u03b6': 'z',
  '\u03b7': 'i',
  '\u03b8': 'th',
  '\u03b9': 'i',
  '\u03ba': 'k',
  '\u03bb': 'l',
  '\u03bc': 'm',
  '\u03bd': 'n',
  '\u03be': 'x',
  '\u03bf': 'o',
  '\u03c0': 'p',
  '\u03c1': 'r',
  '\u03c3': 's',
  '\u03c2': 's',
  '\u03c4': 't',
  '\u03c5': 'u',
  '\u03c6': 'f',
  '\u03c7': 'ch',
  '\u03c8': 'ps',
  '\u03c9': 'o',
  '\u0391': 'a',
  '\u0392': 'v',
  '\u0393': 'g',
  '\u0394': 'd',
  '\u0395': 'e',
  '\u0396': 'z',
  '\u0397': 'i',
  '\u0398': 'th',
  '\u0399': 'i',
  '\u039a': 'k',
  '\u039b': 'l',
  '\u039c': 'm',
  '\u039d': 'n',
  '\u039e': 'x',
  '\u039f': 'o',
  '\u03a0': 'p',
  '\u03a1': 'r',
  '\u03a3': 's',
  '\u03a4': 't',
  '\u03a5': 'u',
  '\u03a6': 'f',
  '\u03a7': 'ch',
  '\u03a8': 'ps',
  '\u03a9': 'o',
};

const MONTH_ALIASES = {
  ian: 0,
  ianouar: 0,
  jan: 0,
  fev: 1,
  feb: 1,
  febr: 1,
  mar: 2,
  mart: 2,
  apr: 3,
  avr: 3,
  may: 4,
  mai: 4,
  ioun: 5,
  jun: 5,
  ioul: 6,
  jul: 6,
  aug: 7,
  augou: 7,
  sep: 8,
  sept: 8,
  okt: 9,
  oct: 9,
  nov: 10,
  noe: 10,
  dec: 11,
  dek: 11,
};

function normalizeMonthToken(token = '') {
  if (!token) return '';
  const base = token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  let result = '';
  for (const char of base) {
    if (/[a-z]/.test(char)) {
      result += char;
    } else if (Object.prototype.hasOwnProperty.call(GREEK_TO_LATIN_MONTH, char)) {
      result += GREEK_TO_LATIN_MONTH[char];
    }
  }
  return result;
}

function resolveMonthIndex(token) {
  const normalized = normalizeMonthToken(token);
  if (!normalized) return undefined;
  const candidates = [
    normalized,
    normalized.slice(0, 6),
    normalized.slice(0, 5),
    normalized.slice(0, 4),
    normalized.slice(0, 3),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(MONTH_ALIASES, candidate)) {
      return MONTH_ALIASES[candidate];
    }
  }
  return undefined;
}

function normalizeYearToken(token) {
  if (!token) return undefined;
  const numeric = Number(token);
  if (!Number.isFinite(numeric)) return undefined;
  if (numeric < 100) {
    return numeric >= 70 ? numeric + 1900 : numeric + 2000;
  }
  return numeric;
}

function normalizeNumber(value) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return 0;

  let text = String(value).trim();
  if (!text) return 0;

  // Remove spaces, NBSP and currency symbols
  text = text
    .replace(/\s+/g, '')
    .replace(/\u00A0/g, '')
    .replace(/[\u20AC\u00A3\u00A5$]/g, '');

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  let decimalSeparator = null;
  if (lastComma !== -1 && lastDot !== -1) {
    decimalSeparator = lastComma > lastDot ? ',' : '.';
  } else if (lastComma !== -1) {
    const digitsAfter = text.length - lastComma - 1;
    decimalSeparator = digitsAfter === 3 ? null : ',';
  } else if (lastDot !== -1) {
    const digitsAfter = text.length - lastDot - 1;
    decimalSeparator = digitsAfter === 3 ? null : '.';
  }

  let normalized = text;
  if (decimalSeparator) {
    const thousandsSep = decimalSeparator === ',' ? '.' : ',';
    const thousandsRegex = new RegExp(
      `\\${thousandsSep}(?=\\d{3}(?:\\${thousandsSep}|\\${decimalSeparator}|$))`,
      'g'
    );
    normalized = normalized.replace(thousandsRegex, '');
    if (decimalSeparator !== '.') {
      const decimalRegex = new RegExp(`\\${decimalSeparator}`, 'g');
      normalized = normalized.replace(decimalRegex, '.');
    }
  } else {
    normalized = normalized.replace(/[^\d-]/g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSheetDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + value * 86400000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const text = String(value).trim();
  if (!text) return null;

  const normalizedText = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const monthMatch = normalizedText.match(/(\d{1,2})[\/\-.\s]+([a-z\u0370-\u03ff]+)(?:[\/\-.\s]+(\d{2,4}))?/);
  if (monthMatch) {
    const day = Number(monthMatch[1]);
    const monthIndex = resolveMonthIndex(monthMatch[2]);
    const explicitYear = normalizeYearToken(monthMatch[3]);
    if (Number.isFinite(day) && monthIndex !== undefined) {
      const fallbackYearMatch = normalizedText.match(/\d{4}/);
      const inferredYear =
        explicitYear ??
        normalizeYearToken(fallbackYearMatch && fallbackYearMatch[0]) ??
        new Date().getFullYear();
      const parsed = new Date(inferredYear, monthIndex, day);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  const parts = normalizedText.split(/[\/\-.]/).map((segment) => parseInt(segment, 10));
  if (dateFormat === 'D/M/YYYY' && parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
    const [day, month, year] = parts;
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function determineContext(records, referenceDate = new Date()) {
  const reference =
    referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();

  if (!records.length) {
    return {
      year: reference.getFullYear(),
      month: reference.getMonth(),
      day: reference.getDate(),
    };
  }

  const latestRecordDate = records.reduce((latest, record) => {
    const candidate = record?.date instanceof Date ? record.date : null;
    if (!candidate || Number.isNaN(candidate.getTime())) return latest;
    if (!latest || candidate.getTime() > latest.getTime()) {
      return candidate;
    }
    return latest;
  }, null);

  const anchor =
    latestRecordDate && latestRecordDate.getTime() > reference.getTime()
      ? latestRecordDate
      : reference;

  return {
    year: anchor.getFullYear(),
    month: anchor.getMonth(),
    day: anchor.getDate(),
  };
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function aggregate(records, predicate) {
  let total = 0;
  const customers = new Set();
  records.forEach((record) => {
    if (predicate(record)) {
      total += record.amount;
      customers.add(record.code);
    }
  });
  return { amount: total, customers: customers.size };
}

function buildRecords(rows, mapping, customerSet) {
  if (!Array.isArray(rows)) return [];
  if (!mapping?.code || !mapping?.value || !mapping?.date) {
    console.warn('[kpiCalculations] Missing mapping configuration:', mapping);
    return [];
  }
  return rows
    .map((row) => {
      const rawCode = (row?.[mapping.code] || '').toString().trim();
      const code = normalizeCustomerCode(rawCode);
      if (!code || (customerSet && !customerSet.has(code))) return null;
      const date = parseSheetDate(row?.[mapping.date]);
      if (!date) return null;
      return {
        code,
        name: row?.[mapping.name] || '',
        amount: normalizeNumber(row?.[mapping.value]),
        date,
      };
    })
    .filter(Boolean);
}

function buildBalanceMap(rows, customerSet) {
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  rows.forEach((row) => {
    const rawCode = (row?.[BALANCE_MAPPING.code] || '').toString().trim();
    const code = normalizeCustomerCode(rawCode);
    if (!code || (customerSet && !customerSet.has(code))) return;
    const balance = normalizeNumber(row?.[BALANCE_MAPPING.balance]);
    const snapshotRaw = row?.[BALANCE_MAPPING.snapshot] || row?.Snapshot || row?.Date;
    const snapshot = snapshotRaw ? parseSheetDate(snapshotRaw) : null;
    map.set(code, {
      code,
      name: row?.[BALANCE_MAPPING.name] || '',
      balance,
      snapshot,
    });
  });
  return map;
}

function buildDiff(current, previous) {
  const diffAmount = current.amount - previous.amount;
  const percent = previous.amount === 0 ? null : (diffAmount / previous.amount) * 100;
  return {
    amount: diffAmount,
    percent,
  };
}

function compileMetrics(recordsThisYear, recordsPrevYear, referenceDate = new Date()) {
  const context = determineContext(recordsThisYear, referenceDate);
  const comparisonYear = context.year - 1;
  const comparisonDay = Math.min(context.day, daysInMonth(comparisonYear, context.month));

  const mtdCurrentPredicate = (r) =>
    r.date.getFullYear() === context.year &&
    r.date.getMonth() === context.month &&
    r.date.getDate() <= context.day;
  const mtdPreviousPredicate = (r) =>
    r.date.getFullYear() === comparisonYear &&
    r.date.getMonth() === context.month &&
    r.date.getDate() <= comparisonDay;

  const ytdCurrentPredicate = (r) =>
    r.date.getFullYear() === context.year &&
    (r.date.getMonth() < context.month ||
      (r.date.getMonth() === context.month && r.date.getDate() <= context.day));
  const ytdPreviousPredicate = (r) =>
    r.date.getFullYear() === comparisonYear &&
    (r.date.getMonth() < context.month ||
      (r.date.getMonth() === context.month && r.date.getDate() <= comparisonDay));

  const monthlyCurrentPredicate = (r) =>
    r.date.getFullYear() === context.year && r.date.getMonth() === context.month;
  const monthlyPreviousPredicate = (r) =>
    r.date.getFullYear() === comparisonYear && r.date.getMonth() === context.month;

  const yearlyCurrentPredicate = (r) => r.date.getFullYear() === context.year;
  const yearlyPreviousPredicate = (r) => r.date.getFullYear() === comparisonYear;

  const mtdCurrent = aggregate(recordsThisYear, mtdCurrentPredicate);
  const mtdPrevious = aggregate(recordsPrevYear, mtdPreviousPredicate);

  const ytdCurrent = aggregate(recordsThisYear, ytdCurrentPredicate);
  const ytdPrevious = aggregate(recordsPrevYear, ytdPreviousPredicate);

  const monthCurrent = aggregate(recordsThisYear, monthlyCurrentPredicate);
  const monthPrevious = aggregate(recordsPrevYear, monthlyPreviousPredicate);

  const yearCurrent = aggregate(recordsThisYear, yearlyCurrentPredicate);
  const yearPrevious = aggregate(recordsPrevYear, yearlyPreviousPredicate);

  const buildDetail = (predicate, list) =>
    list.filter((record) => predicate(record)).sort((a, b) => b.amount - a.amount);

  return {
    context,
    mtd: {
      current: mtdCurrent,
      previous: mtdPrevious,
      diff: buildDiff(mtdCurrent, mtdPrevious),
      currentRecords: buildDetail(mtdCurrentPredicate, recordsThisYear),
      previousRecords: buildDetail(mtdPreviousPredicate, recordsPrevYear),
    },
    ytd: {
      current: ytdCurrent,
      previous: ytdPrevious,
      diff: buildDiff(ytdCurrent, ytdPrevious),
      currentRecords: buildDetail(ytdCurrentPredicate, recordsThisYear),
      previousRecords: buildDetail(ytdPreviousPredicate, recordsPrevYear),
    },
    monthly: {
      current: monthCurrent,
      previous: monthPrevious,
      diff: buildDiff(monthCurrent, monthPrevious),
      currentRecords: buildDetail(monthlyCurrentPredicate, recordsThisYear),
      previousRecords: buildDetail(monthlyPreviousPredicate, recordsPrevYear),
    },
    yearly: {
      current: yearCurrent,
      previous: yearPrevious,
      diff: buildDiff(yearCurrent, yearPrevious),
      currentRecords: buildDetail(yearlyCurrentPredicate, recordsThisYear),
      previousRecords: buildDetail(yearlyPreviousPredicate, recordsPrevYear),
    },
  };
}

export function calculateAllKPIs(sheetsData, customerCodes, options = {}) {
  if (!sheetsData) throw new Error('sheetsData missing');
  if (!Array.isArray(customerCodes)) throw new Error('customerCodes missing');

  const referenceDate =
    options.referenceDate instanceof Date && !Number.isNaN(options.referenceDate.getTime())
      ? options.referenceDate
      : new Date();

  const customerSet = new Set(
    customerCodes.map((code) => normalizeCustomerCode(code)).filter(Boolean)
  );

  const sales2025Records = buildRecords(sheetsData.sales2025 || [], SALES_MAPPING, customerSet);
  const sales2024Records = buildRecords(sheetsData.sales2024 || [], SALES_MAPPING, customerSet);
  const orders2025Records = buildRecords(sheetsData.orders2025 || [], ORDERS_MAPPING, customerSet);
  const orders2024Records = buildRecords(sheetsData.orders2024 || [], ORDERS_MAPPING, customerSet);

  const invoiced = compileMetrics(sales2025Records, sales2024Records, referenceDate);
  const orders = compileMetrics(orders2025Records, orders2024Records, referenceDate);

  return {
    referenceDate,
    invoiced,
    orders,
    records: {
      invoiced: {
        current: sales2025Records,
        previous: sales2024Records,
      },
      orders: {
        current: orders2025Records,
        previous: orders2024Records,
      },
    },
  };
}

export function getCustomerSalesSummary(sheetsData, customerCodes) {
  const customerSet = new Set(
    customerCodes.map((code) => normalizeCustomerCode(code)).filter(Boolean)
  );
  const salesRecords = buildRecords(sheetsData.sales2025 || [], SALES_MAPPING, customerSet);
  const balanceMap = buildBalanceMap(sheetsData.balance2025 || [], customerSet);

  const summaryMap = new Map();
  salesRecords.forEach((record) => {
    const current = summaryMap.get(record.code) || {
      code: record.code,
      name: record.name,
      totalInvoiced: 0,
      lastInvoiceDate: null,
    };
    current.totalInvoiced += record.amount;
    if (!current.lastInvoiceDate || record.date > current.lastInvoiceDate) {
      current.lastInvoiceDate = record.date;
    }
    summaryMap.set(record.code, current);
  });

  const results = [];
  summaryMap.forEach((entry) => {
    const balanceInfo = balanceMap.get(entry.code);
    results.push({
      ...entry,
      balance: balanceInfo?.balance ?? 0,
      balanceSnapshot: balanceInfo?.snapshot || null,
      balanceName: balanceInfo?.name || entry.name,
    });
  });

  return results.sort((a, b) => b.totalInvoiced - a.totalInvoiced);
}
