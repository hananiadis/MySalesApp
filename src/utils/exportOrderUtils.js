// src/utils/exportOrderUtils.js
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import XLSX from 'xlsx';

// Generate a single-sheet XLSX file for the given order and save it locally.
// Returns { filePath, fileName } and does not handle sharing.
export async function generateOrderXLSX(order) {
  if (!order) throw new Error('Order is missing');

  const lines = Array.isArray(order.lines) ? order.lines : [];
  const customer = order?.customer || {};

  const paymentLabels = {
    prepaid_cash: 'Μετρητά (έκπτωση 3%)',
    free_shipping: 'Ελεύθερα',
    premium_invoicing: 'Προνομιακή Πιστωτική Πολιτική',
    bank_cheque: 'Επιταγή Ροής',
  };
  const paymentLabel = paymentLabels[order?.paymentMethod] || order?.paymentMethod || '';

  const vatNo =
    customer?.vatno ||
    customer?.vat ||
    customer?.vatNumber ||
    (customer?.vatInfo && customer?.vatInfo.registrationNo) ||
    '';
  const customerCode = customer?.code || customer?.customerCode || customer?.id || '';

  // Build rows
  const rows = [];

  // Header block
  rows.push(['Αριθμός Παραγγελίας', order?.number || '']);
  rows.push(['Ημερομηνία', new Date(order?.createdAt || Date.now()).toLocaleString()]);
  rows.push(['Κωδικός Πελάτη', customerCode]);
  rows.push(['Επωνυμία Πελάτη', customer?.name || customer?.title || order?.customerName || '']);
  rows.push(['ΑΦΜ', vatNo]);
  rows.push(['Τρόπος Πληρωμής', paymentLabel]);
  rows.push([]);

  // Column headers
  rows.push(['Κωδικός', 'Περιγραφή', 'Ποσότητα', 'Τιμή', 'Αξία']);

  // Lines
  lines
    .filter(l => Number(l?.quantity || 0) > 0)
    .forEach(l => {
      const code = l?.code || l?.sku || l?.id || l?.productCode || '';
      const desc = l?.description || l?.name || '';
      const qty = Number(l?.quantity || 0);
      const price = Number(l?.wholesalePrice || 0);
      const value = +(qty * price).toFixed(2);
      rows.push([code, desc, qty, price, value]);
    });

  // Totals
  const net = Number(order?.netValue ?? 0);
  const discount = Number(order?.discount ?? 0);
  const vat = Number(order?.vat ?? 0);
  const total = Number(order?.finalValue ?? 0);

  rows.push([]);
  rows.push(['Καθαρή Αξία', '', '', '', net]);
  rows.push(['Έκπτωση', '', '', '', discount]);
  rows.push(['ΦΠΑ', '', '', '', vat]);
  rows.push(['Τελική Αξία', '', '', '', total]);

  // Notes
  if (order?.notes) {
    rows.push([]);
    rows.push(['Σημειώσεις']);
    rows.push([String(order.notes)]);
  }

  // Build workbook
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Παραγγελία');

  // Save to file
  const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const fileName = `Order_${order?.number || order?.id || Date.now()}.xlsx`;
  const baseDir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  const filePath = `${baseDir}/${fileName}`;
  await RNFS.writeFile(filePath, wbout, 'base64');

  return { filePath, fileName };
}

// Backwards-compatible helper used by screens: returns uri/mime for sharing
export async function exportOrderAsXLSX(order) {
  const { filePath, fileName } = await generateOrderXLSX(order);
  return {
    filePath,
    fileName,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uri: Platform.select({ android: `file://${filePath}`, ios: filePath }),
  };
}

// Optional stub for PDF
export async function exportOrderAsPDF() {
  throw new Error('PDF export is not implemented. Please export as XLSX.');
}

