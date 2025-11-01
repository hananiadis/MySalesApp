import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import firestore from '@react-native-firebase/firestore';

const ensureFileSystemSetup = () => {
  if (typeof global !== 'undefined' && typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
  }
};

// Logo asset mappings
const COMPANY_LOGOS = {
  masoutis: require('../../assets/masoutis_logo.png'),
  sklavenitis: require('../../assets/sklavenitis_logo.png'),
};

const BRAND_LOGOS = {
  john: require('../../assets/john_hellas_logo.png'),
  playmobil: require('../../assets/playmobil_logo.png'),
  kivos: require('../../assets/kivos_logo.png'),
};

// Normalize company/brand names to find logo
const normalizeForLogo = (name) => {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .trim();
};

// Map company name variations to logo keys
const getCompanyLogoKey = (companyName) => {
  const normalized = normalizeForLogo(companyName);
  
  // Sklavenitis variations
  if (normalized.includes('σκλαβενιτ') || normalized.includes('sklavenit') || 
      normalized.includes('ευσ') || normalized.includes('eys')) {
    return 'sklavenitis';
  }
  
  // Masoutis variations
  if (normalized.includes('μασουτ') || normalized.includes('masout')) {
    return 'masoutis';
  }
  
  return null;
};

// Map brand variations to logo keys
const getBrandLogoKey = (brand) => {
  const normalized = normalizeForLogo(brand);
  
  if (normalized === 'john' || normalized.includes('johnhell')) return 'john';
  if (normalized === 'playmobil') return 'playmobil';
  if (normalized === 'kivos') return 'kivos';
  
  return null;
};

// Load logo from assets
const loadLogoAsBase64 = async (logoAsset) => {
  try {
    if (!logoAsset) return null;
    
    const asset = Asset.fromModule(logoAsset);
    await asset.downloadAsync();
    
    if (!asset.localUri) return null;
    
    const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    return base64;
  } catch (error) {
    console.log('🖼️ Failed to load logo:', error?.message || error);
    return null;
  }
};

const getHeaderConfig = (includeImages = false) => {
  const baseConfig = [
    { header: 'Α/Α', key: 'rowNumber', width: 5 },
    { header: 'Κωδικός', key: 'code', width: 12 },
  ];

  if (includeImages) {
    baseConfig.push({ header: 'Εικόνα', key: 'image', width: 10 });
  }

  baseConfig.push(
    { header: 'Barcode', key: 'barcode', width: 15 },
    { header: 'Περιγραφή', key: 'description', width: 35 },
    { header: 'Συσκευασία', key: 'packaging', width: 12 },
    { header: 'Π.Λ.Τ.', key: 'srp', width: 12 },
    { header: 'Απόθεμα', key: 'stock', width: 10 },
    { header: 'Ποσότητα', key: 'quantity', width: 10 }
  );

  return baseConfig;
};

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4F8F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const HEADER_ALIGNMENT = { vertical: 'middle', horizontal: 'center' };
const CURRENCY_FORMAT = '€#,##0.00';

const getCanonicalCode = (product = {}) => {
  const raw =
    product.productCode ||
    product.code ||
    product.masterCode ||
    product.id ||
    '';
  return String(raw || '').trim().toUpperCase();
};

const toNumberSafe = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
  if (!arrayBuffer) return '';
  const buffer =
    arrayBuffer instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(arrayBuffer))
      : Buffer.from(arrayBuffer);
  return buffer.toString('base64');
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

const mapProductsForExport = (products = [], order = {}, fullList = false) => {
  const quantityMap = new Map();
  const inventorySnapshot = order?.inventorySnapshot || {};
  
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
        
        // Get inventory stock following same logic as ProductSelectionScreen
        const inventoryEntry = inventorySnapshot[key] || 
                              inventorySnapshot[product.productCode] ||
                              inventorySnapshot[product.code] || 
                              {};
        const inventoryStock = toNumberSafe(
          inventoryEntry.stockQty ?? 
          inventoryEntry.qty ?? 
          inventoryEntry.stock ?? 
          product.currentStock, 
          0
        );
        
        return {
          ...product,
          quantity: fullList ? quantityValue : Number(quantityValue || 0),
          inventoryStock,
        };
      })
    : [];
};

const addHeaderWithLogos = async (workbook, sheet, order = {}) => {
  const companyName = order?.companyName || order?.customer?.companyName || '';
  const storeName = order?.storeName || order?.customer?.storeName || '';
  const storeCode = order?.storeCode || order?.customer?.storeCode || '';
  const brand = order?.brand || 'john';
  
  // Determine logos
  const companyLogoKey = getCompanyLogoKey(companyName);
  const brandLogoKey = getBrandLogoKey(brand);
  
  // Load logos
  const companyLogoBase64 = companyLogoKey ? await loadLogoAsBase64(COMPANY_LOGOS[companyLogoKey]) : null;
  const brandLogoBase64 = brandLogoKey ? await loadLogoAsBase64(BRAND_LOGOS[brandLogoKey]) : null;
  
  // Row 1: Title row with logos
  const titleRow = sheet.getRow(1);
  titleRow.height = 60;
  
  // Add company logo (left)
  if (companyLogoBase64) {
    try {
      const companyImageId = workbook.addImage({
        base64: companyLogoBase64,
        extension: 'png',
      });
      sheet.addImage(companyImageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 100, height: 50 },
        editAs: 'oneCell',
      });
    } catch (error) {
      console.log('Failed to add company logo:', error);
    }
  }
  
  // Center title
  sheet.mergeCells('C1:F1');
  const titleCell = sheet.getCell('C1');
  titleCell.value = 'ΠΑΡΑΓΓΕΛΙΑ SUPERMARKET';
  titleCell.font = { size: 18, bold: true, color: { argb: 'FF1F4F8F' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  
  // Add brand logo (right)
  if (brandLogoBase64) {
    try {
      const brandImageId = workbook.addImage({
        base64: brandLogoBase64,
        extension: 'png',
      });
      sheet.addImage(brandImageId, {
        tl: { col: 7, row: 0 },
        ext: { width: 100, height: 50 },
        editAs: 'oneCell',
      });
    } catch (error) {
      console.log('Failed to add brand logo:', error);
    }
  }
  
  // Row 2: Store name
  const storeRow = sheet.getRow(2);
  sheet.mergeCells('A2:I2');
  const storeCell = sheet.getCell('A2');
  storeCell.value = `${storeName} - Κωδ. ${storeCode}`;
  storeCell.font = { size: 14, bold: true, color: { argb: 'FF1565C0' } };
  storeCell.alignment = { vertical: 'middle', horizontal: 'center' };
  storeRow.height = 25;
  
  // Row 3: Empty spacing
  sheet.getRow(3).height = 10;
  
  // Fallback text if logos not found
  if (!companyLogoBase64 && companyName) {
    const fallbackRow = sheet.getRow(1);
    const fallbackCell = fallbackRow.getCell(1);
    fallbackCell.value = companyName;
    fallbackCell.font = { size: 12, bold: true, color: { argb: 'FF1F4F8F' } };
    fallbackCell.alignment = { vertical: 'middle', horizontal: 'left' };
  }
  
  if (!brandLogoBase64 && brand) {
    const fallbackRow = sheet.getRow(1);
    const fallbackCell = fallbackRow.getCell(9);
    fallbackCell.value = brand.toUpperCase();
    fallbackCell.font = { size: 12, bold: true, color: { argb: 'FF1F4F8F' } };
    fallbackCell.alignment = { vertical: 'middle', horizontal: 'right' };
  }
};

const addStoreInfoSection = async (sheet, order = {}) => {
  const store = order?.customer || {};
  const storeCode = order?.storeCode || store?.storeCode || store?.customerCode || '';
  
  // Fetch store info from Firestore to get hasToys and hasSummerItems
  let firestoreStoreData = null;
  try {
    const storeDoc = await firestore()
      .collection('supermarket_stores')
      .where('storeCode', '==', storeCode)
      .limit(1)
      .get();
    
    if (!storeDoc.empty) {
      firestoreStoreData = storeDoc.docs[0].data();
      console.log('📦 Fetched store data from Firestore:', firestoreStoreData);
    }
  } catch (error) {
    console.log('⚠️ Failed to fetch store data from Firestore:', error);
  }
  
  const addressObject = store?.address && typeof store.address === 'object' ? store.address : null;
  
  const storeInfo = {
    storeName: order?.storeName || store?.storeName || store?.name || '',
    storeCode: storeCode,
    companyName: order?.companyName || store?.companyName || '',
    category: order?.storeCategory || store?.storeCategory || store?.category || '',
    address: addressObject?.street ?? order?.storeAddress ?? (typeof store?.address === 'string' ? store.address : ''),
    postalCode: addressObject?.postalCode ?? order?.storePostalCode ?? '',
    city: addressObject?.city ?? order?.storeCity ?? '',
    region: addressObject?.region ?? order?.storeRegion ?? '',
    phone: store?.phone || store?.telephone || order?.storePhone || '',
    email: '', // Empty for now
    hasToys: firestoreStoreData?.hasToys || order?.customer?.hasToys || store?.hasToys || '',
    hasSummerItems: firestoreStoreData?.hasSummerItems || order?.customer?.hasSummerItems || store?.hasSummerItems || '',
    orderNumber: order?.number || order?.id || '',
    createdAt: order?.createdAt ? new Date(order.createdAt).toLocaleString('el-GR') : '',
  };
  
  let currentRow = 5;
  
  // Helper to add info rows
  const addInfoRow = (label1, value1, label2, value2) => {
    const row = sheet.getRow(currentRow);
    row.getCell(1).value = label1;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value1;
    sheet.mergeCells(currentRow, 2, currentRow, 3);
    
    row.getCell(5).value = label2;
    row.getCell(5).font = { bold: true };
    row.getCell(6).value = value2;
    sheet.mergeCells(currentRow, 6, currentRow, 7);
    
    row.height = 18;
    currentRow++;
  };
  
  addInfoRow('Κατάστημα:', storeInfo.storeName, 'Κωδικός Καταστήματος:', storeInfo.storeCode);
  addInfoRow('Εταιρεία:', storeInfo.companyName, 'Κατηγορία:', storeInfo.category);
  addInfoRow('Διεύθυνση:', storeInfo.address, 'Τ.Κ.:', storeInfo.postalCode);
  addInfoRow('Πόλη:', storeInfo.city, 'Περιοχή:', storeInfo.region);
  addInfoRow('Τηλέφωνο:', storeInfo.phone, 'Email:', storeInfo.email);
  addInfoRow('Κατηγορία Παιχνιδιών:', storeInfo.hasToys, 'Κατηγορία Καλοκαιρινών:', storeInfo.hasSummerItems);
  addInfoRow('Ημερομηνία:', storeInfo.createdAt, 'Αρ. Παραγγελίας:', storeInfo.orderNumber);
  
  // Add spacing
  sheet.getRow(currentRow).height = 15;
  
  return currentRow + 1; // Return next available row
};

const buildTotalsRows = (sheet, products = [], includeImages = false, startRow) => {
  // Calculate totals with 60% margin
  let totalQuantity = 0;
  let wholesaleTotal = 0;
  
  products.forEach(product => {
    const qty = toNumberSafe(product.quantity, 0);
    const price = toNumberSafe(product.price || product.wholesalePrice, 0);
    totalQuantity += qty;
    wholesaleTotal += qty * price;
  });
  
  const netValue = wholesaleTotal * 0.60; // 60% margin
  const vatValue = netValue * 0.24; // 24% VAT
  const totalValue = netValue + vatValue;
  
  const columnCount = includeImages ? 8 : 7;
  
  sheet.addRow([]);
  
  const totalsData = [
    { label: 'Σύνολο Προϊόντων:', value: `${totalQuantity} τεμ.`, highlight: false, isNumber: false },
    { label: 'Καθαρή Αξία:', value: netValue, highlight: false, isNumber: true },
    { label: 'ΦΠΑ 24%:', value: vatValue, highlight: false, isNumber: true },
    { label: 'Συνολική Αξία:', value: totalValue, highlight: true, isNumber: true },
  ];

  totalsData.forEach(({ label, value, highlight, isNumber }) => {
    const emptyColumns = new Array(columnCount - 2).fill('');
    const row = sheet.addRow([...emptyColumns, label, value]);
    row.font = { bold: true, color: highlight ? { argb: 'FF1976D2' } : undefined };
    row.alignment = { horizontal: 'right' };
    
    const valueCell = row.getCell(columnCount);
    if (isNumber) {
      valueCell.numFmt = CURRENCY_FORMAT;
    }
  });
};

export async function exportSupermarketXLSX(products = [], order = {}, fullList = false, includeImages = true) {
  ensureFileSystemSetup();
  console.log(`📦 Starting XLSX export (images: ${includeImages ? 'enabled' : 'disabled'})...`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MySalesApp';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('SuperMarket Order');
  
  // Add header with logos
  await addHeaderWithLogos(workbook, sheet, order);
  
  // Add store information section
  const productsStartRow = await addStoreInfoSection(sheet, order);
  
  // Set up product table columns
  const HEADER_CONFIG = getHeaderConfig(includeImages);
  const headerRow = sheet.getRow(productsStartRow);
  headerRow.values = HEADER_CONFIG.map((col) => col.header);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = HEADER_ALIGNMENT;
  headerRow.height = 20;
  
  // Set column widths
  HEADER_CONFIG.forEach((col, index) => {
    sheet.getColumn(index + 1).width = col.width;
  });

  // Style specific columns
  const srpColIndex = includeImages ? 6 : 5;
  const stockColIndex = includeImages ? 7 : 6;
  const qtyColIndex = includeImages ? 8 : 7;
  
  sheet.getColumn(srpColIndex).numFmt = CURRENCY_FORMAT;
  sheet.getColumn(srpColIndex).alignment = { horizontal: 'right' };
  sheet.getColumn(stockColIndex).alignment = { horizontal: 'center' };
  sheet.getColumn(qtyColIndex).alignment = { horizontal: 'center' };

  const exportProducts = mapProductsForExport(products, order, fullList);
  let currentRowIndex = productsStartRow + 1;
  let imageCount = 0;
  const IMAGE_LIMIT = 300;

  for (let i = 0; i < exportProducts.length; i++) {
    const product = exportProducts[i];
    const row = sheet.getRow(currentRowIndex);
    const quantityValue = Number(product.quantity ?? 0);
    const wholesaleValue = Number(
      product.wholesalePrice ??
        product.price ??
        product.wholesale ??
        0
    );
    const srpValue = wholesaleValue * 1.24;

    const rowValues = [
      i + 1, // Α/Α (row number)
      product.productCode || product.code || '',
    ];

    if (includeImages) {
      rowValues.push(''); // placeholder for image column
    }

    rowValues.push(
      product.barcode || '',
      product.description || product.name || '',
      product.packaging || product.package || '',
      srpValue,
      product.inventoryStock || 0,
      quantityValue
    );

    row.values = rowValues;
    row.alignment = { vertical: 'middle' };
    row.height = includeImages ? 80 : 15;

    // Only process images if includeImages is true
    if (includeImages && imageCount < IMAGE_LIMIT) {
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

          const imageColIndex = 2; // Column C (after Α/Α and Κωδικός)
          sheet.addImage(imageId, {
            tl: { col: imageColIndex, row: currentRowIndex - 1 },
            ext: { width: 80, height: 80 },
            editAs: 'oneCell',
          });
          imageCount += 1;
          console.log('🖼️ Embedded image:', imagePath);
        } catch (error) {
          console.log('🖼️ Failed to embed image:', imagePath, error?.message || error);
        }
      }
    }

    currentRowIndex += 1;
  }

  buildTotalsRows(sheet, exportProducts, includeImages, currentRowIndex);

  const documentDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  const imagesSuffix = includeImages ? '_with_images' : '';
  const fileUri = `${documentDir}SuperMarketOrder_${Date.now()}${imagesSuffix}.xlsx`;

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

    const fileSizeKB = Math.round(buffer.byteLength / 1024);
    console.log(`✅ Export complete: ${fileUri} (${fileSizeKB} KB, ${imageCount} images)`);
  } catch (error) {
    console.error('❌ Failed to export XLSX:', error);
    throw error;
  }

  return fileUri;
}