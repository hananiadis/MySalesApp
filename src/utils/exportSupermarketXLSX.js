import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const ensureFileSystemSetup = () => {
  if (typeof global !== 'undefined' && typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
  }
};

const HEADER_CONFIG = [
  { header: 'Κωδικός', key: 'code', width: 18 },
  { header: 'Περιγραφή', key: 'description', width: 40 },
  { header: 'Συσκευασία', key: 'packaging', width: 16 },
  { header: 'Ποσότητα', key: 'quantity', width: 12 },
  { header: 'Χονδρική', key: 'wholesale', width: 14 },
  { header: 'Εικόνα', key: 'image', width: 18 },
];

const IMAGE_LIMIT = 300;
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4F8F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const HEADER_ALIGNMENT = { vertical: 'middle', horizontal: 'center' };
const CURRENCY_FORMAT = '#,##0.00';

const getCanonicalCode = (product = {}) => {
  const raw =
    product.productCode ||
    product.code ||
    product.masterCode ||
    product.id ||
    '';
  return String(raw || '').trim().toUpperCase();
};

const guessImageCandidates = (product = {}) => {
  const candidates = [
    product.localImagePath,
    product.cachedImagePath,
    product.localPhotoPath,
    product.localPhotoUri,
    product.photoUri,
    product.cachedImageUri,
    product.imageLocalPath,
    product.imagePath,
    product.photoUrl,
  ];

  return candidates.filter((value) => typeof value === 'string' && value.trim().length > 0);
};

const normalizeFileUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('file://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
};

const getImageExtension = (path) => {
  if (!path) return 'jpg';
  const match = path.split('?')[0].match(/\.(\w+)$/i);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  if (ext === 'jpeg') return 'jpg';
  if (ext === 'png') return 'png';
  if (ext === 'jpg') return 'jpg';
  return 'jpg';
};

const toBase64 = (arrayBuffer) => {
  if (!arrayBuffer) {
    return '';
  }
  const buffer =
    arrayBuffer instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(arrayBuffer))
      : Buffer.from(arrayBuffer);
  return buffer.toString('base64');
};

const buildTotalsRows = (sheet, { netValue = 0, vatValue = 0, totalValue = 0 }) => {
  sheet.addRow([]);
  const totalsData = [
    { label: 'Καθαρή Αξία', value: netValue, highlight: false },
    { label: 'ΦΠΑ 24%', value: vatValue, highlight: false },
    { label: 'Συνολική Αξία', value: totalValue, highlight: true },
  ];

  totalsData.forEach(({ label, value, highlight }) => {
    const row = sheet.addRow(['', '', '', '', label, value]);
    row.font = { bold: true, color: highlight ? { argb: 'FF1976D2' } : undefined };
    row.alignment = { horizontal: 'right' };
    const valueCell = row.getCell(6);
    valueCell.numFmt = CURRENCY_FORMAT;
  });
};

const mapProductsForExport = (products = [], order = {}, fullList = false) => {
  const quantityMap = new Map();
  if (Array.isArray(order?.lines)) {
    order.lines.forEach((line = {}) => {
      const key = getCanonicalCode(line);
      if (!key) return;
      const quantity = Number(line.quantity ?? line.qty ?? line.orderQuantity ?? 0);
      quantityMap.set(key, quantity);
    });
  }

  return Array.isArray(products)
    ? products.map((product = {}) => {
        const key = getCanonicalCode(product);
        const quantityValue = Number(
          product.quantity ??
            product.qty ??
            product.orderQuantity ??
            quantityMap.get(key) ??
            0
        );
        return {
          ...product,
          quantity: fullList ? quantityValue : Number(quantityValue || 0),
        };
      })
    : [];
};

const determineImagePath = async (product) => {
  const candidates = guessImageCandidates(product);

  for (const candidate of candidates) {
    const normalized = normalizeFileUri(candidate);
    if (!normalized) continue;

    try {
      const info = await FileSystem.getInfoAsync(normalized);
      if (info?.exists) {
        return normalized;
      }
    } catch (error) {
      console.log('🖼️ Image lookup failed:', normalized, error?.message || error);
    }
  }

  // Attempt to resolve based on product code inside the document directory
  const canonical = getCanonicalCode(product);
  if (canonical) {
    const baseDir = FileSystem.documentDirectory || '';
    const pathsToTry = [
      `${baseDir}product_images/product_${canonical}.jpg`,
      `${baseDir}product_images/product_${canonical}.png`,
      `${baseDir}product_${canonical}.jpg`,
      `${baseDir}product_${canonical}.png`,
    ];

    for (const candidate of pathsToTry) {
      try {
        const info = await FileSystem.getInfoAsync(candidate);
        if (info?.exists) {
          return candidate;
        }
      } catch (error) {
        console.log('🖼️ Derived image lookup failed:', candidate, error?.message || error);
      }
    }
  }

  return null;
};

export async function exportSupermarketXLSX(products = [], order = {}, fullList = false) {
  ensureFileSystemSetup();
  console.log('📦 Starting XLSX export...');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MySalesApp';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('SuperMarket Order', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = HEADER_CONFIG;

  const headerRow = sheet.getRow(1);
  headerRow.values = HEADER_CONFIG.map((col) => col.header);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = HEADER_ALIGNMENT;
  headerRow.height = 24;

  sheet.getColumn('quantity').alignment = { horizontal: 'center' };
  sheet.getColumn('wholesale').numFmt = CURRENCY_FORMAT;
  sheet.getColumn('wholesale').alignment = { horizontal: 'right' };

  const exportProducts = mapProductsForExport(products, order, fullList);
  let currentRowIndex = 2;
  let imageCount = 0;

  for (const product of exportProducts) {
    const row = sheet.getRow(currentRowIndex);
    const quantityValue = Number(product.quantity ?? 0);
    const wholesaleValue = Number(
      product.wholesalePrice ??
        product.price ??
        product.wholesale ??
        product.wholesale_value ??
        0
    );

    row.values = [
      product.productCode || product.code || '',
      product.description || product.name || '',
      product.packaging || product.package || product.packagingInfo || '',
      quantityValue,
      wholesaleValue,
      '', // placeholder for image
    ];
    row.alignment = { vertical: 'middle' };
    row.height = 80;

    if (imageCount < IMAGE_LIMIT) {
      const imagePath = await determineImagePath(product);
      if (imagePath) {
        try {
          const base64Image = await FileSystem.readAsStringAsync(imagePath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const extension = getImageExtension(imagePath);
          const imageId = workbook.addImage({
            base64: base64Image,
            extension,
          });

          sheet.addImage(imageId, {
            tl: { col: 5, row: currentRowIndex - 1 },
            ext: { width: 80, height: 80 },
            editAs: 'oneCell',
          });
          imageCount += 1;
          console.log('🖼️ Embedding image:', imagePath);
        } catch (error) {
          console.log('🖼️ Failed to embed image:', imagePath, error?.message || error);
        }
      }
    }

    currentRowIndex += 1;
  }

  buildTotalsRows(sheet, {
    netValue: Number(order?.netValue ?? 0),
    vatValue: Number(order?.vatValue ?? 0),
    totalValue: Number(order?.totalValue ?? 0),
  });

  const documentDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  const fileUri = `${documentDir}SuperMarketOrder_${Date.now()}.xlsx`;

  try {
    const buffer = await workbook.xlsx.writeBuffer();
    const base64Workbook = toBase64(buffer);

    await FileSystem.writeAsStringAsync(fileUri, base64Workbook, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri);
    } else {
      console.warn('Sharing not available on this device.');
    }

    console.log('✅ Export complete:', fileUri);
  } catch (error) {
    console.error('❌ Failed to export XLSX:', error);
    throw error;
  }

  return fileUri;
}
