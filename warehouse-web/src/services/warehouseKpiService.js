import { collection, getDocs, query } from 'firebase/firestore';
import { db } from './firebase';

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortBy = (array, selector, direction = 'desc') =>
  [...array].sort((a, b) => {
    const aVal = selector(a);
    const bVal = selector(b);
    return direction === 'asc' ? aVal - bVal : bVal - aVal;
  });

const supplierExtraDiscount = (supplierBrandRaw) => {
  if (!supplierBrandRaw) return 0;
  const brand = String(supplierBrandRaw).toLowerCase();

  const autofixBrands = ['logo', 'logo scripto', 'good', 'borg'];
  const papazoglouBrands = ['artline', 'penac'];

  if (autofixBrands.includes(brand)) return 0.2685; // 26.85%
  if (papazoglouBrands.includes(brand)) return 0.2919; // 29.19%
  if (brand === 'plus') return 0.2; // 20%

  return 0;
};

const computeUnitCost = (product = {}, stock = {}) => {
  // Prefer explicit unitCost if already set
  const explicitCost = asNumber(stock.unitCost || product.unitCost);
  if (explicitCost > 0) return explicitCost;

  const basePrice =
    asNumber(product.wholesalePrice) ||
    asNumber(product.price) ||
    asNumber(stock.price) ||
    asNumber(stock.wholesalePrice);

  if (!basePrice) return 0;

  const discount = Math.max(asNumber(product.discount), asNumber(product.technicalDiscount), 0);
  const supplierDiscount = supplierExtraDiscount(product.supplierBrand);

  const afterProductDiscount = basePrice * (1 - Math.min(discount, 1));
  const afterSupplierDiscount = afterProductDiscount * (1 - Math.min(supplierDiscount, 1));

  return asNumber(afterSupplierDiscount);
};

export const getMergedStock = async () => {
  const [productsSnap, stockSnap] = await Promise.all([
    getDocs(query(collection(db, 'products_kivos'))),
    getDocs(query(collection(db, 'stock_kivos'))),
  ]);

  const products = productsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  const stockByCode = stockSnap.docs.reduce((acc, docSnap) => {
    const data = docSnap.data();
    if (data?.productCode) acc[data.productCode] = { id: docSnap.id, ...data };
    return acc;
  }, {});

  const merged = products.map((product) => {
    const stock = stockByCode[product.productCode] || {};
    const qtyOnHand = asNumber(stock.qtyOnHand);
    const lowStockLimit = asNumber(product.lowStockLimit);
    const velocity =
      asNumber(stock.velocity) || asNumber(product.velocity) || asNumber(stock.outbound30d);
    const rotationScore =
      asNumber(stock.rotationScore) ||
      asNumber(product.rotationScore) ||
      (qtyOnHand > 0 ? velocity / Math.max(qtyOnHand, 1) : 0);

    const unitCost = computeUnitCost(product, stock);

    return {
      productCode: product.productCode,
      name: product.name || product.title || product.productCode,
      lowStockLimit,
      qtyOnHand,
      unitCost,
      outbound30d: asNumber(stock.outbound30d || product.outbound30d),
      velocity,
      rotationScore,
      isLowStock: qtyOnHand < lowStockLimit,
      product,
      stock,
    };
  });

  return merged;
};

export const getLowStockStats = async () => {
  const merged = await getMergedStock();
  const lowStockItems = merged.filter((item) => item.isLowStock);

  return {
    count: lowStockItems.length,
    items: lowStockItems,
  };
};

export const getStockValue = async () => {
  const merged = await getMergedStock();
  const totalValue = merged.reduce(
    (sum, item) => sum + item.qtyOnHand * asNumber(item.unitCost),
    0,
  );

  return {
    currency: '€',
    totalValue,
  };
};

export const getFastMovers = async () => {
  const merged = await getMergedStock();
  const ranked = sortBy(merged, (item) => item.velocity || item.outbound30d, 'desc').slice(0, 10);

  return ranked.map((item) => ({
    name: item.name,
    productCode: item.productCode,
    velocity: Math.round(item.velocity || item.outbound30d || 0),
  }));
};

export const getSlowMovers = async () => {
  const merged = await getMergedStock();
  const ranked = sortBy(merged, (item) => item.velocity || item.outbound30d, 'asc').slice(0, 10);

  return ranked.map((item) => ({
    name: item.name,
    productCode: item.productCode,
    velocity: Math.round(item.velocity || item.outbound30d || 0),
  }));
};

export const getMonthlyAdjustments = async () => {
  const adjustmentsSnap = await getDocs(query(collection(db, 'stock_adjustments_kivos')));
  const data = adjustmentsSnap.docs.map((docSnap) => {
    const item = docSnap.data();
    return {
      month: item.month || docSnap.id,
      inbound: asNumber(item.inbound),
      outbound: asNumber(item.outbound),
    };
  });

  return data.sort((a, b) => a.month.localeCompare(b.month));
};

export const getRotationScore = async () => {
  const merged = await getMergedStock();
  const ranked = sortBy(merged, (item) => item.rotationScore, 'desc');
  const items = ranked.slice(0, 8).map((item) => ({
    name: item.name,
    productCode: item.productCode,
    score: Number(item.rotationScore.toFixed(2)),
  }));

  const average =
    ranked.length > 0
      ? Number(
          (
            ranked.reduce((sum, item) => sum + (item.rotationScore || 0), 0) / ranked.length
          ).toFixed(2),
        )
      : 0;

  return { average, items };
};

export const getOpenSupplierOrders = async () => {
  const ordersSnap = await getDocs(query(collection(db, 'supplier_orders_kivos')));
  const orders = ordersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const open = orders.filter((order) => (order.status || '').toLowerCase() === 'open');

  return { count: open.length, orders };
};

export const getPackedOrdersToday = async () => {
  const packedSnap = await getDocs(query(collection(db, 'packed_orders_kivos')));
  const today = new Date().toISOString().slice(0, 10);

  const packedToday = packedSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((order) => (order.packedDate || '').startsWith(today));

  return { count: packedToday.length, orders: packedToday };
};
