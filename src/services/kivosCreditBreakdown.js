// /src/services/kivosCreditBreakdown.js
import { loadSpreadsheet } from './spreadsheetCache';
import { parseLocaleNumber } from '../utils/numberFormat';

// Normalizes customer codes (removes leading zeros, spaces, uppercase)
function normalizeCode(value) {
  return String(value || '').trim().replace(/^0+/, '').toUpperCase();
}

/**
 * Fetch a customer's credit breakdown (GViz sheet)
 * Reads from "kivosCredit" config key in spreadsheets.js
 * Returns credit buckets (days30 / days60 / days90 / days90plus)
 */
export async function getKivosCreditBreakdown(customerCode) {
  try {
    const rawText = await loadSpreadsheet('kivosCredit', { force: false });
    if (!rawText) return null;

    // Parse the GViz JSON payload
    const match = rawText.match(/google\.visualization\.Query\.setResponse\((.*)\);?/s);
    if (!match) {
      console.warn('[getKivosCreditBreakdown] GViz parse failed');
      return null;
    }

    const payload = JSON.parse(match[1]);
    const rows = payload.table?.rows ?? [];
    if (!rows.length) return null;

    const normalizedTarget = normalizeCode(customerCode);
    for (const row of rows) {
      const sheetCode = normalizeCode(row.c[0]?.v);
      if (sheetCode === normalizedTarget) {
        const record = {
          code: sheetCode,
          name: row.c[1]?.v || '',
          days30: parseLocaleNumber(row.c[2]?.v),
          days60: parseLocaleNumber(row.c[3]?.v),
          days90: parseLocaleNumber(row.c[4]?.v),
          days90plus: parseLocaleNumber(row.c[5]?.v),
          balance: parseLocaleNumber(row.c[6]?.v),
        };

        const summed =
          record.days30 + record.days60 + record.days90 + record.days90plus;
        record.total = record.balance || summed;
        if (!record.balance) {
          record.balance = summed;
        }

        return record;
      }
    }

    console.warn('[getKivosCreditBreakdown] No match for', customerCode);
    return null;
  } catch (err) {
    console.warn('[getKivosCreditBreakdown] failed:', err.message);
    return null;
  }
}

