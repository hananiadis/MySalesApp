// src/utils/exportOrderUtils.js
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import XLSX from 'xlsx';
import { getPaymentLabel } from '../constants/paymentOptions';
import { normalizeBrandKey } from '../constants/brands';
import { computeOrderTotals } from './orderTotals';

const VAT_MULTIPLIER = 1.24;

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export async function generateOrderXLSX(order, options = {}) {
  if (!order) throw new Error('Order is missing');

  const lines = Array.isArray(order.lines) ? order.lines : [];
  const customer = order?.customer || {};
  const normalizedBrand = normalizeBrandKey(order?.brand);
  const paymentLabel =
    getPaymentLabel(order?.paymentMethod, normalizedBrand) ||
    order?.paymentMethodLabel ||
    order?.paymentMethod ||
    '';

  const vatNo =
    customer?.vatno ||
    customer?.vat ||
    customer?.vatNumber ||
    (customer?.vatInfo && customer?.vatInfo.registrationNo) ||
    '';
  const customerCode = customer?.code || customer?.customerCode || customer?.id || '';

  const totals = computeOrderTotals({
    lines,
    brand: normalizedBrand,
    paymentMethod: order?.paymentMethod,
    customer,
  });

  const netValue = toNumber(order?.netValue, totals.net ?? 0);
  const discount = toNumber(order?.discount, totals.discount ?? 0);
  const vat = toNumber(order?.vat, totals.vat ?? 0);
  const finalValue = toNumber(
    order?.finalValue,
    totals.total ?? netValue - discount + (totals.vat ?? vat)
  );

  const { mode = 'order', includeImages = false } = options;

  const rows = [];
  const isSuperMarket = order?.orderType === 'supermarket';
  const isKivosBrand = normalizedBrand === 'kivos';
  const allowListingExport = mode === 'listing' && isSuperMarket;

  const addressObject =
    customer?.address && typeof customer.address === 'object' ? customer.address : null;
  const storeAddress =
    addressObject?.street ?? order?.storeAddress ?? (typeof customer?.address === 'string' ? customer.address : '');
  const storeCity = addressObject?.city ?? order?.storeCity ?? '';
  const storePostalCode = addressObject?.postalCode ?? order?.storePostalCode ?? '';
  const storeRegion = addressObject?.region ?? order?.storeRegion ?? '';
  const storeFullAddress = [storeAddress, storePostalCode].filter(Boolean).join(' ').trim();
  const storeCityDisplay = [storeCity, storeRegion].filter(Boolean).join(', ');
  const storePhone =
    customer?.phone ||
    customer?.telephone ||
    customer?.contact?.telephone1 ||
    customer?.contact?.mobile ||
    order?.storePhone ||
    '';
  const storeEmail = customer?.email || order?.storeEmail || '';
  const storeCategory = order?.storeCategory || customer?.storeCategory || '';

  let headerLength = 0;

  if (isSuperMarket) {
    const inventorySnapshot = order?.inventorySnapshot || {};
    const orderLines = lines.filter((line) => Number(line?.quantity || 0) > 0);
    const orderLineMap = new Map(
      orderLines.map((line) => [line?.productCode || line?.code || line?.sku || '', line])
    );
    const listingSource = allowListingExport
      ? Array.isArray(order?.supermarketListings)
        ? order.supermarketListings
        : []
      : orderLines;

    rows.push(['Order Number', order?.number || order?.id || '']);
    rows.push(['Created At', new Date(order?.createdAt || Date.now()).toLocaleString()]);
    rows.push(['Store Name', order?.storeName || customer?.name || '']);
    rows.push(['Store Code', order?.storeCode || customerCode]);
    rows.push(['Category', order?.storeCategory || customer?.storeCategory || '']);
    rows.push(['Company', order?.companyName || customer?.companyName || '']);
    rows.push(['Payment Method', paymentLabel]);
    rows.push(['VAT Number', vatNo]);
    rows.push(['Store Address', storeFullAddress]);
    rows.push(['Store City', storeCityDisplay]);
    rows.push(['Store Phone', storePhone]);
    rows.push(['Store Email', storeEmail]);
    rows.push([]);

    const headerRow = [
      'Product Code',
      ...(includeImages ? ['Image'] : []),
      'Description',
      'Barcode',
      'Packaging',
      'Price',
      'SRP',
      'Suggested Qty',
      'Ordered Qty',
      'Store Stock',
      'Inventory Stock',
    ];
    headerLength = headerRow.length;
    rows.push(headerRow);

    listingSource.forEach((item) => {
      const sourceLine = allowListingExport ? orderLineMap.get(item?.productCode || item?.code || '') : item;
      const productCode = (allowListingExport ? item?.productCode || item?.code : sourceLine?.productCode || sourceLine?.code) || '';
      if (!productCode) {
        return;
      }
      const snapshotEntry =
        inventorySnapshot[productCode] ||
        inventorySnapshot[item?.code || ''] ||
        inventorySnapshot[sourceLine?.code || ''] ||
        {};
      const priceRaw = allowListingExport ? toNumber(item?.priceNumber ?? item?.price ?? item?.wholesalePrice, 0) : toNumber(sourceLine?.wholesalePrice, 0);
      const srpRaw = allowListingExport
        ? toNumber(item?.srpNumber ?? item?.srp, Number.isFinite(priceRaw) ? +(priceRaw * VAT_MULTIPLIER).toFixed(2) : 0)
        : toNumber(sourceLine?.srp, Number.isFinite(priceRaw) ? +(priceRaw * VAT_MULTIPLIER).toFixed(2) : 0);
      const suggestedQty = allowListingExport
        ? Number(item?.suggestedQtyNumber ?? item?.suggestedQty ?? 0) || ''
        : Number(sourceLine?.suggestedQty ?? sourceLine?.suggestedQtyNumber ?? 0) || '';
      const orderedQty = Number(sourceLine?.quantity || 0);
      const packagingValue = allowListingExport ? item?.packaging : sourceLine?.packaging;
      const barcodeValue = allowListingExport ? item?.barcode : sourceLine?.barcode;
      const descriptionValue = allowListingExport ? item?.description || item?.listingLabel : sourceLine?.description || sourceLine?.name || '';
      const photoUrl = allowListingExport ? item?.photoUrl : sourceLine?.photoUrl;
      const storeStockValue = allowListingExport
        ? item?.storeStock ?? sourceLine?.storeStock ?? ''
        : sourceLine?.storeStock ?? item?.storeStock ?? '';
      const inventoryStockValue = snapshotEntry?.stockQty ?? sourceLine?.currentStock ?? '';
      const price = Number.isFinite(priceRaw) ? priceRaw : '';
      const srp = Number.isFinite(srpRaw) ? srpRaw : '';
      const row = [
        productCode,
        ...(includeImages
          ? [
              photoUrl
                ? `=IMAGE("${photoUrl}")`
                : '',
            ]
          : []),
        descriptionValue || '',
        barcodeValue || '',
        packagingValue || '',
        price,
        srp,
        suggestedQty,
        orderedQty,
        storeStockValue,
        inventoryStockValue,
      ];
      rows.push(row);
    });
  } else {
    rows.push(['Order Number', order?.number || order?.id || '']);
    rows.push(['Created At', new Date(order?.createdAt || Date.now()).toLocaleString()]);
    rows.push(['Customer Code', customerCode]);
    rows.push(['Customer Name', customer?.name || customer?.title || order?.customerName || '']);
    rows.push(['VAT Number', vatNo]);
    rows.push(['Payment Method', paymentLabel]);
    rows.push([]);

    const headerRow = isKivosBrand
      ? [
          'Product Code',
          'Barcode',
          'Description',
          'Packs',
          'Units per Pack (Total Units)',
          'Total Units',
          'Price',
          'Discount',
          'Line Total',
        ]
      : ['Product Code', 'Description', 'Quantity', 'Price', 'Line Total'];

    headerLength = headerRow.length;
    rows.push(headerRow);

    lines
      .filter((line) => Number(line?.quantity || 0) > 0)
      .forEach((line) => {
        const code = line?.code || line?.sku || line?.id || line?.productCode || '';
        const description = line?.description || line?.name || '';
        if (isKivosBrand) {
          const barcode =
            line?.barcodeUnit ||
            line?.barcode ||
            line?.Barcode ||
            '';
          const quantityUnits = Number(line?.quantity || 0);
          const piecesPerBoxRaw = Number(line?.packageSize ?? line?.piecesPerBox ?? 1);
          const piecesPerBox =
            Number.isFinite(piecesPerBoxRaw) && piecesPerBoxRaw > 0 ? Math.round(piecesPerBoxRaw) : 1;
          const quantityPacksRaw =
            line?.packageQuantity != null
              ? Number(line.packageQuantity)
              : piecesPerBox > 0
              ? quantityUnits / piecesPerBox
              : quantityUnits;
          const quantityPacks = Number.isFinite(quantityPacksRaw) ? Math.round(quantityPacksRaw) : 0;
          const totalUnits = Math.max(0, Math.round(quantityUnits));
          const price = toNumber(line?.wholesalePrice, 0);
          const discountValue = toNumber(line?.discount, 0);
          const lineValue = +(totalUnits * price - discountValue).toFixed(2);
          rows.push([
            code,
            String(barcode || ''),
            description,
            quantityPacks,
            `${piecesPerBox} (${totalUnits})`,
            totalUnits,
            price,
            discountValue,
            lineValue,
          ]);
        } else {
          const quantity = Number(line?.quantity || 0);
          const price = toNumber(line?.wholesalePrice, 0);
          const value = +(quantity * price).toFixed(2);
          rows.push([code, description, quantity, price, value]);
        }
      });
  }

  if (!headerLength) {
    headerLength = rows[rows.length - 1]?.length || 5;
  }

  const makeSummaryRow = (label, value) => {
    const row = new Array(headerLength).fill('');
    row[0] = label;
    row[headerLength - 1] = Number.isFinite(value) ? value : value || '';
    return row;
  };

  rows.push([]);
  rows.push(makeSummaryRow('Net Value', netValue));
  rows.push(makeSummaryRow('Discount', isSuperMarket ? 0 : discount));
  rows.push(makeSummaryRow('VAT 24%', vat));
  rows.push(makeSummaryRow('Total Value', finalValue));

  if (order?.notes) {
    rows.push([]);
    rows.push(['Notes']);
    rows.push([String(order.notes)]);
  }

  if (order?.deliveryInfo) {
    rows.push([]);
    rows.push(['Delivery Info']);
    rows.push([String(order.deliveryInfo)]);
  }

  const worksheetName = isSuperMarket ? 'SuperMarket' : 'Orders';
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, worksheetName);

  const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const fileNamePrefix = isSuperMarket ? 'SuperMarket_Order' : 'Orders';
  const fileName = `${fileNamePrefix}_${order?.number || order?.id || Date.now()}.xlsx`;
  const baseDir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  const filePath = `${baseDir}/${fileName}`;
  await RNFS.writeFile(filePath, wbout, 'base64');

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

