// src/utils/exportOrderUtils.js
//
// Requires: exceljs          → npm install exceljs
//           react-native-fs  → already in your project
//           expo-asset        → already in your project
//           expo-file-system  → already in your project
//
// Column layout (matches Δελτίο_Παραγγελίας template exactly):
//   A  – narrow spacer (4.26)
//   B  – Κωδ.          (11.0)
//   C  – Barcode       (10.0)  ← header merges C:E
//   D  –               (7.42)
//   E  –               (3.58)
//   F  – Αποθ.         (7.58)  store stock qty  → Q = F*M
//   G  – Παρ/λία       (8.26)  order qty        → R = G*M
//   H  – Περιγραφή     (77.58)
//   I  – Σελ. Κατ.     (4.58)
//   J  – Ass           (4.42)
//   K  – ΝΕΟ           (5.68)
//   L  – Συσκ.         (6.0)
//   M  – Χ.Τ.          (8.0)
//   N  – Π.Λ.Τ.        (8.16)
//   O  – ΑΡ. ΣΕΛ       (19.68)
//   P  – Ηλικία        (6.68)
//   Q  – Αποθ. value   (6.84)  formula =F*M
//   R  – Παρ/λία value (13.0)  formula =G*M

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { getPaymentLabel } from '../constants/paymentOptions';
import { normalizeBrandKey } from '../constants/brands';

// ─── Buffer polyfill (same pattern as exportSupermarketXLSX) ─────────────────
const ensureBufferPolyfill = () => {
  if (typeof global !== 'undefined' && typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
  }
};

// ─── Safe number coercion ─────────────────────────────────────────────────────
const toNumberSafe = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// ─── Brand logo assets ────────────────────────────────────────────────────────
const BRAND_LOGOS = {
  playmobil: require('../../assets/playmobil_logo.png'),
  john:      require('../../assets/john_hellas_logo.png'),
  kivos:     require('../../assets/kivos_logo.png'),
};

const LOGO_CACHE = new Map();

const loadLogoAsBase64 = async (cacheKey, assetModule) => {
  if (!cacheKey || !assetModule) return null;
  if (LOGO_CACHE.has(cacheKey)) return LOGO_CACHE.get(cacheKey);

  let base64 = null;
  try {
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();          // always resolve to a local file URI
    if (asset.localUri) {
      // RNFS.readFile requires a plain path (no file:// scheme) on Android.
      // It is more reliable than expo-file-system for bundled asset URIs.
      const plainPath = asset.localUri.replace(/^file:\/\//, '');
      try {
        base64 = await RNFS.readFile(plainPath, 'base64');
      } catch {
        // Fallback: try expo-file-system with the original URI
        base64 = await FileSystem.readAsStringAsync(asset.localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    }
  } catch (error) {
    console.log('🖼️ Logo load failed for', cacheKey, error?.message || error);
  }

  LOGO_CACHE.set(cacheKey, base64);
  return base64;
};

// ─── Colours (ARGB) ───────────────────────────────────────────────────────────
const C = {
  navy:    { argb: 'FF000099' },
  yellow:  { argb: 'FFFFFF00' },
  white:   { argb: 'FFFFFFFF' },
  cyan:    { argb: 'FF66FFFF' },
  ltCyan:  { argb: 'FFDDFFFF' },
  ltGreen: { argb: 'FFCCFFCC' },
  blue:    { argb: 'FF0000FF' },
  green:   { argb: 'FF008000' },
  black:   { argb: 'FF000000' },
  gray:    { argb: 'FFDDDDDD' },
};

const fill = (color) => ({ type: 'pattern', pattern: 'solid', fgColor: color });

// ─── Borders ──────────────────────────────────────────────────────────────────
const BD = {
  medium: (c = C.black) => ({ style: 'medium', color: c }),
  thin:   (c = C.black) => ({ style: 'thin',   color: c }),
  hair:   (c = C.black) => ({ style: 'hair',   color: c }),
};

const BORDER = {
  // rows 2-5
  r2Label:  { top: BD.thin(),  bottom: BD.hair(), left: BD.medium(), right: BD.hair()   },
  rLabel:   { top: BD.hair(),  bottom: BD.hair(), left: BD.medium(), right: BD.hair()   },
  r2Val:    { top: BD.thin(),  bottom: BD.hair(), left: BD.hair(),   right: BD.hair()   },
  rVal:     { top: BD.hair(),  bottom: BD.hair(), left: BD.hair(),   right: BD.hair()   },
  r2RLabel: { top: BD.thin(),  bottom: BD.hair(), left: BD.hair(),   right: BD.hair()   },
  rRLabel:  { top: BD.hair(),  bottom: BD.hair(), left: BD.hair(),   right: BD.hair()   },
  r2RVal:   { top: BD.thin(),  bottom: BD.hair(), left: BD.hair(),   right: BD.medium() },
  rRVal:    { top: BD.hair(),  bottom: BD.hair(), left: BD.hair(),   right: BD.medium() },
  r5RVal:   { top: BD.hair(),                     left: BD.hair(),   right: BD.medium() },
  // row 6
  r6:       { left: BD.medium(), right: BD.medium() },
  // row 7
  r7StockLbl: { top: BD.hair(),   bottom: BD.medium(), left: BD.medium(), right: BD.hair()   },
  r7StockVal: { top: BD.hair(),   bottom: BD.medium(), left: BD.hair()                       },
  r7OrdLbl:   { top: BD.medium(), bottom: BD.medium(), left: BD.medium(), right: BD.hair()   },
  r7OrdVal:   { top: BD.medium(), bottom: BD.medium(), left: BD.hair(),   right: BD.medium() },
  // row 8 headers
  r8B:   { top: BD.medium(), bottom: BD.medium(), left: BD.medium(), right: BD.thin()   },
  r8C:   { top: BD.medium(), bottom: BD.medium(), left: BD.thin(),   right: BD.hair()   },
  r8Mid: { top: BD.medium(), bottom: BD.medium(), left: BD.hair(),   right: BD.hair()   },
  r8N:   { top: BD.medium(), bottom: BD.medium(), left: BD.hair(),   right: BD.medium() },
  // data rows
  dataB:   { top: BD.thin(), bottom: BD.thin(), left: BD.medium()                      },
  dataMid: { top: BD.thin(), bottom: BD.thin(), left: BD.thin(),   right: BD.thin()    },
  dataN:   {                 bottom: BD.thin(),                    right: BD.medium()  },
  // bottom sections
  bottomVal: { top: BD.thin(), bottom: BD.thin(), left: BD.medium(), right: BD.medium() },
};

// ─── Column widths ────────────────────────────────────────────────────────────
const COL_WIDTHS = {
  A: 4.26,  B: 11.0,  C: 10.0,  D: 7.42,  E: 3.58,
  F: 7.58,  G: 8.26,  H: 77.58, I: 4.58,  J: 4.42,
  K: 5.68,  L: 6.0,   M: 8.0,   N: 8.16,  O: 19.68,
  P: 6.68,  Q: 6.84,  R: 13.0,
};

// ─── Row heights ──────────────────────────────────────────────────────────────
const ROW_H = {
  1: 46.0,
  2: 30.0,
  3: 30.0,
  4: 30.0,
  5: 30.0,
  6: 26.0,
  7: 26.0,
  8: 32.0,
  9: 26.0,
  DATA: 24.0,
  FOOTER_LABEL: 22.0,
  FOOTER_VALUE: 24.0,
  NOTES: 34.0,
};

// ─── Utility helpers ──────────────────────────────────────────────────────────
const L2C = (letter) => letter.charCodeAt(0) - 64; // 'A'→1, 'B'→2 …

// Get cell by column letter + row number (1-based)
const gc = (ws, colLetter, row) => ws.getCell(row, L2C(colLetter));

// Apply styles to a cell (only sets keys that are provided)
const applyStyle = (cell, { font, fill: f, alignment, border, numFmt } = {}) => {
  if (font)      cell.font      = font;
  if (f)         cell.fill      = f;
  if (alignment) cell.alignment = alignment;
  if (border)    cell.border    = border;
  if (numFmt)    cell.numFmt    = numFmt;
};

// Merge a column-letter range in one row, then flood every cell with a fill
const mergeRange = (ws, row, fromLetter, toLetter) => {
  ws.mergeCells(row, L2C(fromLetter), row, L2C(toLetter));
};

const floodFill = (ws, row, fromLetter, toLetter, fillColor) => {
  for (let c = L2C(fromLetter); c <= L2C(toLetter); c++) {
    ws.getCell(row, c).fill = fill(fillColor);
  }
};

const mergeAndFlood = (ws, row, fromLetter, toLetter, fillColor) => {
  mergeRange(ws, row, fromLetter, toLetter);
  if (fillColor) floodFill(ws, row, fromLetter, toLetter, fillColor);
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═════════════════════════════════════════════════════════════════════════════

export async function generateOrderXLSX(order, options = {}) {
  if (!order) throw new Error('Order is missing');
  ensureBufferPolyfill();

  // ── Unpack order data ──────────────────────────────────────────────────────
  const lines           = Array.isArray(order.lines) ? order.lines : [];
  const customer        = order?.customer || {};
  const normalizedBrand = normalizeBrandKey(order?.brand);
  const paymentLabel    =
    getPaymentLabel(order?.paymentMethod, normalizedBrand) ||
    order?.paymentMethodLabel ||
    order?.paymentMethod || '';

  const vatNo        = customer?.vatno    || customer?.vat || customer?.vatNumber ||
                       customer?.vatInfo?.registrationNo || '';
  const customerCode = customer?.code     || customer?.customerCode || customer?.id || '';
  const customerName = customer?.name     || customer?.title || order?.customerName || '';
  const customerName3 = customer?.name3 || '';
  const profession   = customer?.profession || customer?.category || '';
  const doy          = customer?.vatInfo?.office || customer?.doy || customer?.taxOffice || '';

  const addrObj         = customer?.address && typeof customer.address === 'object'
                            ? customer.address : null;
  const storeAddress    = addrObj?.street    ?? order?.storeAddress ??
                          (typeof customer?.address === 'string' ? customer.address : '');
  const storePostalCode = addrObj?.postalCode ?? order?.storePostalCode ?? customer?.postalCode ?? '';
  const storeCity       = addrObj?.city       ?? order?.storeCity       ?? customer?.city ?? '';
  const customerCity    = customer?.city || storeCity || '';
  const cityTk          = [storeCity, storePostalCode].filter(Boolean).join('  ');

  const createdAt  = new Date(order?.createdAt || Date.now()).toLocaleDateString('el-GR');
  const brandKey         = normalizedBrand || normalizeBrandKey(order?.brand) || '';
  const brandTitle       = String(order?.brand || normalizedBrand || 'ORDER').toUpperCase();
  const brandLogoModule  = BRAND_LOGOS[brandKey] || null;

  const orderLines = lines.filter((l) => Number(l?.quantity || 0) > 0);

  // ── Workbook / worksheet ───────────────────────────────────────────────────
  const workbook   = new ExcelJS.Workbook();
  workbook.creator = 'SalesApp';
  workbook.created = new Date();
  const ws         = workbook.addWorksheet('Παραγγελία');
  ws.properties.defaultRowHeight = ROW_H.DATA;
  ws.properties.dyDescent = 55;

  // ── Column widths ──────────────────────────────────────────────────────────
  Object.entries(COL_WIDTHS).forEach(([letter, width]) => {
    ws.getColumn(L2C(letter)).width = width;
  });

  // ── Fixed row heights (1–9) ────────────────────────────────────────────────
  for (let r = 1; r <= 9; r++) {
    ws.getRow(r).height = ROW_H[r];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 1 — Brand logo on the left + dynamic brand title
  //   • B1:F1 = visible white logo panel
  //   • H1 = exported brand name
  //   • N1 = month/year text
  // ═══════════════════════════════════════════════════════════════════════════

  floodFill(ws, 1, 'B', 'N', C.navy);
  mergeAndFlood(ws, 1, 'B', 'F', C.white);
  applyStyle(gc(ws, 'B', 1), {
    fill:      fill(C.white),
    alignment: { horizontal: 'center', vertical: 'middle' },
    border:    { top: BD.medium(), bottom: BD.thin(), left: BD.medium(), right: BD.thin() },
  });

  // Load and insert brand logo on the left using bundled local assets only
  const brandLogoBase64 = brandLogoModule
    ? await loadLogoAsBase64(`brand-${brandKey}`, brandLogoModule)
    : null;

  if (brandLogoBase64) {
    try {
      const logoImageId = workbook.addImage({
        base64: brandLogoBase64,
        extension: 'png',
      });
      ws.addImage(logoImageId, {
        tl: { col: 1.35, row: 0.14 },
        ext: { width: 140, height: 34 },
        editAs: 'oneCell',
      });
    } catch (logoErr) {
      console.log('⚠️ Failed to add brand logo:', logoErr?.message || logoErr);
    }
  } else {
    gc(ws, 'B', 1).value = brandTitle;
    applyStyle(gc(ws, 'B', 1), {
      font:      { bold: true, size: 12, color: C.navy },
      fill:      fill(C.white),
      alignment: { horizontal: 'center', vertical: 'middle' },
      border:    { top: BD.medium(), bottom: BD.thin(), left: BD.medium(), right: BD.thin() },
    });
  }

  // H1 — dynamic brand title centered
  const r1title = gc(ws, 'H', 1);
  r1title.value = brandTitle;
  applyStyle(r1title, {
    font:      { bold: true, size: 14, color: C.white },
    fill:      fill(C.navy),
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  const r1date = gc(ws, 'N', 1);
  r1date.value = 'ΙΑΝΟΥΑΡΙΟΣ 2026';
  applyStyle(r1date, {
    font:      { bold: true, size: 14, color: C.yellow },
    fill:      fill(C.navy),
    alignment: { horizontal: 'right', vertical: 'middle' },
    border:    { top: BD.medium(), bottom: BD.thin(), right: BD.medium() },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ROWS 2–5 — Customer info
  //   B:F  → left label   (no fill, bold 12pt)
  //   G:H  → left value   (ltCyan fill)   ← customer data input
  //   I:L  → right label  (no fill, bold 12pt)
  //   M:N  → right value  (no fill)       ← customer data input
  // ═══════════════════════════════════════════════════════════════════════════
  const infoRows = [
    ['Επωνυμία πελάτη :', customerName, 'Κωδικός Πελάτη :', customerCode],
    ['Επάγγελμα :',       customerName3 || profession, 'Ημερομηνία :', createdAt],
    ['Διεύθυνση :',       storeAddress, 'ΔΟΥ :',            doy        ],
    ['Πόλη / TK :',       customerCity || cityTk, 'ΑΦΜ :', vatNo],
  ];

  infoRows.forEach(([lLabel, lVal, rLabel, rVal], i) => {
    const row     = i + 2;
    const isFirst = i === 0;
    const isLast  = i === 3;

    // B:F – left label
    gc(ws, 'B', row).value = lLabel;
    applyStyle(gc(ws, 'B', row), {
      font:      { bold: true, size: 12 },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border:    isFirst ? BORDER.r2Label : BORDER.rLabel,
    });
    mergeRange(ws, row, 'B', 'F');

    // G:H – left value (ltCyan)
    gc(ws, 'G', row).value = lVal || '';
    applyStyle(gc(ws, 'G', row), {
      font:      { size: 11, bold: false },
      fill:      fill(C.ltCyan),
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      border:    isFirst ? BORDER.r2Val : BORDER.rVal,
    });
    mergeAndFlood(ws, row, 'G', 'H', C.ltCyan);

    // I:L – right label
    gc(ws, 'I', row).value = rLabel;
    applyStyle(gc(ws, 'I', row), {
      font:      { bold: true, size: 12 },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border:    isFirst ? BORDER.r2RLabel : BORDER.rRLabel,
    });
    mergeRange(ws, row, 'I', 'L');

    // M:N – right value (no fill)
    gc(ws, 'M', row).value = rVal || '';
    applyStyle(gc(ws, 'M', row), {
      font:      { size: 11 },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border:    isFirst ? BORDER.r2RVal
               : isLast  ? BORDER.r5RVal
               :            BORDER.rRVal,
    });
    mergeRange(ws, row, 'M', 'N');
  });

  if (customerName3) {
    gc(ws, 'G', 3).value = customerName3;
  }
  if (customerCity) {
    gc(ws, 'G', 5).value = customerCity;
  }
  if (customer?.vatInfo?.office) {
    gc(ws, 'M', 4).value = customer.vatInfo.office;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 6 — Terms banner (cyan, B:N)
  // ═══════════════════════════════════════════════════════════════════════════
  gc(ws, 'B', 6).value = `ΓΙΑ ΚΑΘΕ ΠΑΡΑΓΓΕΛΙΑ ΙΣΧΥΟΥΝ ΟΙ ΓΕΝΙΚΟΙ ΟΡΟΙ ΣΥΝΑΛΛΑΓΩΝ ΚΑΙ ΠΩΛΗΣΕΩΝ ΠΡΟΪΟΝΤΩΝ ${brandTitle}`;
  applyStyle(gc(ws, 'B', 6), {
    font:      { bold: true, size: 12 },
    fill:      fill(C.cyan),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border:    BORDER.r6,
  });
  mergeAndFlood(ws, 6, 'B', 'N', C.cyan);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 7 — Summary / totals bar
  //   B:D  → "Aξία Αποθέματος ="  (ltGreen)
  //   E    → ltGreen fill (standalone, not merged)
  //   F:G  → SUBTOTAL formula      (ltGreen)
  //   I:L  → "Aξία παραγγελίας =" (no fill)
  //   M:N  → SUBTOTAL formula      (yellow bg, blue text)
  // ═══════════════════════════════════════════════════════════════════════════
  const DATA_START = 10;
  const DATA_END   = Math.max(DATA_START + orderLines.length - 1, DATA_START);

  gc(ws, 'B', 7).value = 'Aξία Απoθέματος =';
  applyStyle(gc(ws, 'B', 7), {
    font:      { bold: true, size: 11 },
    fill:      fill(C.ltGreen),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border:    BORDER.r7StockLbl,
  });
  mergeAndFlood(ws, 7, 'B', 'D', C.ltGreen);

  // E7 — standalone ltGreen cell (not part of merge, as in original template)
  gc(ws, 'E', 7).fill = fill(C.ltGreen);

  gc(ws, 'F', 7).value  = { formula: `SUBTOTAL(109,Q${DATA_START}:Q${DATA_END})` };
  gc(ws, 'F', 7).numFmt = '#,##0.00';
  applyStyle(gc(ws, 'F', 7), {
    font:      { bold: true, size: 11 },
    fill:      fill(C.ltGreen),
    alignment: { horizontal: 'center', vertical: 'middle' },
    border:    BORDER.r7StockVal,
  });
  mergeAndFlood(ws, 7, 'F', 'G', C.ltGreen);

  gc(ws, 'I', 7).value = 'Aξία παραγγελίας =';
  applyStyle(gc(ws, 'I', 7), {
    font:      { bold: true, size: 11 },
    alignment: { horizontal: 'right', vertical: 'middle' },
    border:    BORDER.r7OrdLbl,
  });
  mergeRange(ws, 7, 'I', 'L');

  gc(ws, 'M', 7).value  = { formula: `SUBTOTAL(109,R${DATA_START}:R${DATA_END})` };
  gc(ws, 'M', 7).numFmt = '#,##0.00';
  applyStyle(gc(ws, 'M', 7), {
    font:      { bold: true, size: 11, color: C.blue },
    fill:      fill(C.yellow),
    alignment: { horizontal: 'center', vertical: 'middle' },
    border:    BORDER.r7OrdVal,
  });
  mergeAndFlood(ws, 7, 'M', 'N', C.yellow);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 8 — Column headers
  // ═══════════════════════════════════════════════════════════════════════════
  mergeRange(ws, 8, 'C', 'E'); // Barcode header spans C:E

  const headerDefs = [
    // [col, label, font, border]
    ['B', 'Κωδ.',             { bold: true,  size: 10 },                  BORDER.r8B  ],
    ['C', 'Barcode',          { bold: false, size: 10 },                  BORDER.r8C  ],
    ['F', 'Αποθ.',            { bold: true,  size: 11, color: C.green },  BORDER.r8Mid],
    ['G', 'Παρ/λία',          { bold: true,  size: 10, color: C.blue  },  BORDER.r8Mid],
    ['H', 'Περιγραφή Είδους', { bold: true,  size: 10 },                  BORDER.r8Mid],
    ['I', 'Σελ. Κατ.',        { bold: true,  size: 9  },                  BORDER.r8Mid],
    ['J', 'Ass',              { bold: true,  size: 10 },
      { top: BD.medium(), bottom: BD.medium(), right: BD.hair() }],
    ['K', 'ΝΕΟ',              { bold: true,  size: 10 },                  BORDER.r8Mid],
    ['L', 'Συσκ.',            { bold: true,  size: 10 },                  BORDER.r8Mid],
    ['M', 'Χ.Τ.',             { bold: true,  size: 10 },                  BORDER.r8Mid],
    ['N', 'Π.Λ.Τ.',           { bold: true,  size: 10 },                  BORDER.r8N  ],
    ['O', 'ΑΡ. ΣΕΛ',         { bold: false, size: 11 },                  {}          ],
    ['P', 'Ηλικία',           { bold: true,  size: 10 },                  {}          ],
    ['Q', 'Αποθ.',            { bold: true,  size: 8  },                  {}          ],
    ['R', 'Παρ/λία',          { bold: true,  size: 8  },                  {}          ],
  ];

  headerDefs.forEach(([col, label, font, border]) => {
    const cell = gc(ws, col, 8);
    cell.value = label;
    applyStyle(cell, {
      font,
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 9 — Category group header (light gray)
  // ═══════════════════════════════════════════════════════════════════════════
  gc(ws, 'B', 9).value = 'ΠΑΡΑΓΓΕΛΘΕΝΤΑ ΕΙΔΗ';
  applyStyle(gc(ws, 'B', 9), {
    font:      { bold: true, size: 10 },
    fill:      fill(C.gray),
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  mergeAndFlood(ws, 9, 'B', 'N', C.gray);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROWS 10+ — Order line items
  // ═══════════════════════════════════════════════════════════════════════════
  orderLines.forEach((line, idx) => {
    const row = DATA_START + idx;
    ws.getRow(row).height = ROW_H.DATA; // 14.4pt

    const code        = line?.code        || line?.sku  || line?.productCode || '';
    const barcode     = line?.barcode     || line?.barcodeUnit || '';
    const description = line?.description || line?.name || '';
    const storeStock  = Number.isFinite(Number(line?.storeStock))
                          ? Number(line.storeStock) : null;
    const qty         = Number(line?.quantity || 0);
    const catalogPage = line?.catalogPage ?? line?.catPage    ?? '';
    const assortment  = line?.assortment  ?? line?.ass        ?? '';
    const isNew       = line?.isNew ? '●' : '';
    const packaging   = line?.packaging   ?? line?.packageSize ?? '';
    const priceVal    = toNumberSafe(line?.wholesalePrice, 0);
    const srpVal      = toNumberSafe(line?.srp, 0);
    const catalogRef  = line?.catalogRef  ?? '';
    const age         = line?.age         ?? line?.ageGroup   ?? '';

    // B — Code (bold, medium-left, no right border as per template)
    gc(ws, 'B', row).value = code;
    applyStyle(gc(ws, 'B', row), {
      font:      { bold: true, size: 10 },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border:    BORDER.dataB,
    });

    // C:E — Barcode (merged, thin borders)
    gc(ws, 'C', row).value = barcode ? String(barcode) : '';
    applyStyle(gc(ws, 'C', row), {
      font:      { bold: true, size: 10 },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border:    BORDER.dataMid,
    });
    mergeRange(ws, row, 'C', 'E');

    // F — Store stock (green text)
    gc(ws, 'F', row).value = storeStock !== null ? storeStock : '';
    applyStyle(gc(ws, 'F', row), {
      font:      { size: 10, color: C.green },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border:    BORDER.dataMid,
    });

    // G — Order qty (blue bold)
    gc(ws, 'G', row).value = qty;
    applyStyle(gc(ws, 'G', row), {
      font:      { bold: true, size: 10, color: C.blue },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border:    BORDER.dataMid,
    });

    // H — Description
    gc(ws, 'H', row).value = description;
    applyStyle(gc(ws, 'H', row), {
      font:      { bold: true, size: 10 },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border:    BORDER.dataMid,
    });

    // I — Catalog page
    gc(ws, 'I', row).value = catalogPage !== '' ? catalogPage : '';
    applyStyle(gc(ws, 'I', row), {
      font:      { size: 10 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border:    BORDER.dataMid,
    });

    // J — Assortment
    gc(ws, 'J', row).value = assortment;
    applyStyle(gc(ws, 'J', row), {
      font:      { size: 10 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border:    BORDER.dataMid,
    });

    // K — New flag
    gc(ws, 'K', row).value = isNew;
    applyStyle(gc(ws, 'K', row), {
      font:      { size: 10 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border:    BORDER.dataMid,
    });

    // L — Packaging
    gc(ws, 'L', row).value = packaging !== '' ? packaging : '';
    applyStyle(gc(ws, 'L', row), {
      font:      { size: 10 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border:    BORDER.dataMid,
    });

    // M — Wholesale price Χ.Τ.
    gc(ws, 'M', row).value  = priceVal;
    gc(ws, 'M', row).numFmt = '0.00';
    applyStyle(gc(ws, 'M', row), {
      font:      { size: 10 },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border:    BORDER.dataMid,
    });

    // N — SRP Π.Λ.Τ. (medium-right, no top — matching template)
    gc(ws, 'N', row).value  = srpVal;
    gc(ws, 'N', row).numFmt = '0.00';
    applyStyle(gc(ws, 'N', row), {
      font:      { size: 10 },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border:    BORDER.dataN,
    });

    // O — Catalog ref (no border)
    gc(ws, 'O', row).value = catalogRef !== '' ? catalogRef : '';
    applyStyle(gc(ws, 'O', row), {
      font:      { size: 10 },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });

    // P — Age (no border)
    gc(ws, 'P', row).value = age ? String(age) : '';
    applyStyle(gc(ws, 'P', row), {
      font:      { size: 10 },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });

    // Q — Stock value formula =F*M (no border)
    gc(ws, 'Q', row).value  = { formula: `F${row}*M${row}` };
    gc(ws, 'Q', row).numFmt = '0.00';
    applyStyle(gc(ws, 'Q', row), {
      font:      { size: 10 },
      alignment: { horizontal: 'right', vertical: 'middle' },
    });

    // R — Order value formula =G*M (no border, blue bold)
    gc(ws, 'R', row).value  = { formula: `G${row}*M${row}` };
    gc(ws, 'R', row).numFmt = '0.00';
    applyStyle(gc(ws, 'R', row), {
      font:      { bold: true, size: 10, color: C.blue },
      alignment: { horizontal: 'right', vertical: 'middle' },
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BOTTOM SECTION — Notes + Payment/Delivery
  // ═══════════════════════════════════════════════════════════════════════════
  let br = Math.max(DATA_END + 2, 12);

  // Cyan section banner helper
  const addBanner = (rowNum, label) => {
    ws.getRow(rowNum).height = ROW_H.FOOTER_LABEL;
    gc(ws, 'B', rowNum).value = label;
    applyStyle(gc(ws, 'B', rowNum), {
      font:      { bold: true, size: 11 },
      fill:      fill(C.cyan),
      alignment: { horizontal: 'left', vertical: 'middle' },
      border:    { left: BD.medium(), right: BD.medium() },
    });
    mergeAndFlood(ws, rowNum, 'B', 'N', C.cyan);
  };

  // Single merged-row value cell helper
  const addValueRow = (rowNum, value, heightPt = ROW_H.FOOTER_VALUE) => {
    ws.getRow(rowNum).height = heightPt;
    gc(ws, 'B', rowNum).value = value || '';
    applyStyle(gc(ws, 'B', rowNum), {
      font:      { size: 10 },
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      border:    BORDER.bottomVal,
    });
    mergeRange(ws, rowNum, 'B', 'N');
  };

  // Notes
  addBanner(br, 'ΠΑΡΑΤΗΡΗΣΕΙΣ:');
  br++;
  addValueRow(br, order?.notes ? String(order.notes) : '', ROW_H.NOTES);
  br += 2;

  // Payment & Delivery — two separate bordered cells
  addBanner(br, 'ΤΡΟΠΟΣ ΠΛΗΡΩΜΗΣ & ΑΠΟΣΤΟΛΗ:');
  br++;
  addValueRow(br, paymentLabel ? `Τρόπος πληρωμής: ${paymentLabel}` : '');
  br++;
  addValueRow(br, order?.deliveryInfo ? `Αποστολή: ${String(order.deliveryInfo)}` : '');

  // Enforce readable Excel row heights from row 2 to the final printed row
  for (let rowNum = 2; rowNum <= br; rowNum++) {
    const row = ws.getRow(rowNum);
    if (rowNum >= 2 && rowNum <= 5) {
      row.height = ROW_H[rowNum];
    } else if (rowNum >= DATA_START && rowNum <= DATA_END) {
      row.height = ROW_H.DATA;
    } else if (!row.height || row.height < ROW_H.FOOTER_LABEL) {
      row.height = ROW_H.FOOTER_LABEL;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRINT AREA — B1 to N<lastRow>
  // ═══════════════════════════════════════════════════════════════════════════
  ws.pageSetup.printArea = `B1:N${br}`;
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.orientation = 'portrait';

  // ═══════════════════════════════════════════════════════════════════════════
  // Write → file
  // ═══════════════════════════════════════════════════════════════════════════
  const orderNum = order?.number || order?.id || Date.now();
  const fileName = `Παραγγελία_${orderNum}.xlsx`;
  const baseDir  = Platform.OS === 'android'
    ? RNFS.DownloadDirectoryPath
    : RNFS.DocumentDirectoryPath;
  const filePath = `${baseDir}/${fileName}`;

  const buffer = await workbook.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  await RNFS.writeFile(filePath, base64, 'base64');

  return { filePath, fileName };
}

export async function exportOrderAsXLSX(order, options = {}) {
  const { filePath, fileName } = await generateOrderXLSX(order, options);
  return {
    filePath,
    fileName,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uri: Platform.select({ android: `file://${filePath}`, ios: filePath }),
  };
}

export async function exportOrderAsPDF() {
  throw new Error('PDF export is not implemented. Please export as XLSX.');
}
