// src/utils/localOrders.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'orders_v2';

/**
 * Load full array of orders from AsyncStorage.
 */
async function loadAll() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('loadAll orders error', e);
    return [];
  }
}

/**
 * Save full array of orders back to AsyncStorage.
 */
async function saveAll(orders) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.warn('saveAll orders error', e);
  }
}

/**
 * Upsert a single order by id (no duplicates).
 * - Sets/keeps the provided status (draft/sent)
 * - Updates updatedAt timestamp
 * - Returns the saved order (with id).
 */
export async function saveOrder(order, status = 'draft') {
  if (!order) throw new Error('No order to save');
  let id = order.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const toSave = {
    ...order,
    id,
    status: status || order.status || 'draft',
    updatedAt: new Date().toISOString(),
  };

  const all = await loadAll();
  const idx = all.findIndex(o => o.id === id);

  if (idx >= 0) {
    // Update existing (upsert)
    all[idx] = { ...all[idx], ...toSave };
  } else {
    // Insert new
    all.push(toSave);
  }

  await saveAll(all);
  return toSave;
}

/**
 * Get all orders (optionally filtered by status later in the code).
 */
export async function getOrders() {
  const all = await loadAll();
  // Sort: latest updated first
  return all.sort((a, b) => (new Date(b.updatedAt || 0)) - (new Date(a.updatedAt || 0)));
}

/**
 * Update only the status of an order (e.g., 'sent').
 */
export async function updateOrderStatus(orderId, status) {
  if (!orderId) return;
  const all = await loadAll();
  const idx = all.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    all[idx] = {
      ...all[idx],
      status,
      updatedAt: new Date().toISOString(),
    };
    await saveAll(all);
  }
}

/**
 * Remove an order from local storage.
 */
export async function deleteOrder(orderId) {
  if (!orderId) return;
  const all = await loadAll();
  const filtered = all.filter(o => o.id !== orderId);
  await saveAll(filtered);
}

/**
 * Remove many orders in a single read/write to avoid race conditions
 * when deleting concurrently.
 */
export async function deleteMany(ids) {
  const set = new Set(Array.isArray(ids) ? ids : []);
  if (set.size === 0) return;
  const all = await loadAll();
  const filtered = all.filter(o => !set.has(o?.id));
  await saveAll(filtered);
}

/**
 * (Optional) Clear all orders – handy for debugging.
 */
// export async function clearAllOrders() {
//   await saveAll([]);
// }
