import { normalizeBrandKey } from '../constants/brands';

const VAT_RATE = 0.24;

const KIVOS_GROUP_ONE = new Set(['logo', 'good', 'logo scripto', 'borg']);
const KIVOS_GROUP_TWO = new Set(['artline', 'penac']);
const KIVOS_GROUP_ONE_THRESHOLD = 166.67;

const getLineTotal = (line) => {
  const quantity = Number(line?.quantity || 0);
  const price = Number(line?.wholesalePrice || 0);
  if (!Number.isFinite(quantity) || !Number.isFinite(price)) {
    return 0;
  }
  return quantity * price;
};

const getSupplierBrand = (line) => {
  const raw =
    line?.supplierBrand ??
    line?.brand ??
    line?.supplier ??
    line?.supplier_brand ??
    '';
  return String(raw || '').trim().toLowerCase();
};

const parseChannelNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? numeric : null;
};

const customerChannelNumber = (customer = null) => {
  if (!customer || typeof customer !== 'object') return null;
  const raw =
    customer.channel ??
    customer.Channel ??
    customer.salesChannel ??
    customer.channelId ??
    customer.channelCode ??
    customer.channel_id ??
    null;
  return parseChannelNumber(raw);
};

export function computeOrderTotals({ lines, brand, paymentMethod, customer = null }) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const normalizedBrand = normalizeBrandKey(brand);
  const net = safeLines.reduce((sum, line) => sum + getLineTotal(line), 0);

  let discount = 0;

  if (normalizedBrand === 'kivos') {
    const channelNo = customerChannelNumber(customer);
    const isChannelTwo = channelNo === 2;
    let groupOneTotal = 0;
    let groupTwoTotal = 0;

    safeLines.forEach((line) => {
      const supplier = getSupplierBrand(line);
      const lineTotal = getLineTotal(line);
      if (lineTotal <= 0) {
        return;
      }
      if (KIVOS_GROUP_ONE.has(supplier)) {
        groupOneTotal += lineTotal;
      }
      if (KIVOS_GROUP_TWO.has(supplier)) {
        groupTwoTotal += lineTotal;
      }
    });

    if (isChannelTwo && groupOneTotal >= KIVOS_GROUP_ONE_THRESHOLD) {
      discount += groupOneTotal * 0.1;
    }

    if (groupTwoTotal > 375) {
      discount += groupTwoTotal * 0.2;
    } else if (groupTwoTotal > 167) {
      discount += groupTwoTotal * 0.1;
    }
  } else if (normalizedBrand === 'john') {
    if (paymentMethod === 'cash') {
      if (net < 300) {
        discount += net * 0.03;
      } else {
        discount += net * 0.05;
      }
    }
  } else if (paymentMethod === 'prepaid_cash') {
    discount += net * 0.03;
  }

  const roundedDiscount = Number.isFinite(discount) ? +discount.toFixed(2) : 0;
  const taxableBase = net - roundedDiscount;
  const vat = +(taxableBase * VAT_RATE).toFixed(2);
  const total = +(taxableBase + vat).toFixed(2);

  return {
    net,
    discount: roundedDiscount,
    vat,
    total,
  };
}
