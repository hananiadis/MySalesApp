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
  const id = order.id != null ? String(order.id) : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const toSave = {
    ...order,
    id,
    status: status || order.status || 'draft',
    updatedAt: new Date().toISOString(),
  };

  const all = await loadAll();
  const baseArray = Array.isArray(all) ? all : [];
  const idx = baseArray.findIndex((entry) => String(entry?.id) === id);

  if (idx >= 0) {
    baseArray[idx] = { ...baseArray[idx], ...toSave };
  } else {
    baseArray.push(toSave);
  }

  await saveAll(baseArray);
  return toSave;
}

/**
 * Get all orders (optionally filtered by status later in the code).
 */
export async function getOrders() {
  const all = await loadAll();

  const byId = new Map();
  const withoutId = [];

  for (const entry of Array.isArray(all) ? all : []) {
    if (entry?.id != null) {
      const key = String(entry.id);
      const existing = byId.get(key);
      if (!existing) {
        byId.set(key, entry);
      } else {
        const existingTimestamp = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const entryTimestamp = new Date(entry.updatedAt || entry.createdAt || 0).getTime();
        if (entryTimestamp >= existingTimestamp) {
          byId.set(key, { ...existing, ...entry });
        }
      }
    } else {
      withoutId.push(entry);
    }
  }

  const deduped = [...byId.values(), ...withoutId];
  return deduped.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

/**
 * Update only the status of an order (e.g., 'sent').
 */
export async function updateOrderStatus(orderId, status) {
  if (!orderId) return;
  const id = String(orderId);
  const all = await loadAll();
  const baseArray = Array.isArray(all) ? all : [];
  const idx = baseArray.findIndex((entry) => String(entry?.id) === id);
  if (idx >= 0) {
    baseArray[idx] = {
      ...baseArray[idx],
      status,
      updatedAt: new Date().toISOString(),
    };
    await saveAll(baseArray);
  }
}

/**
 * Remove an order from local storage.
 */
export async function deleteOrder(orderId) {
  if (!orderId) return;
  const id = String(orderId);
  const all = await loadAll();
  const baseArray = Array.isArray(all) ? all : [];
  const filtered = baseArray.filter((entry) => String(entry?.id) !== id);
  await saveAll(filtered);
}

/**
 * Remove many orders in a single read/write to avoid race conditions
 * when deleting concurrently.
 */
export async function deleteMany(ids) {
  const set = new Set((Array.isArray(ids) ? ids : []).map((value) => String(value)));
  if (set.size === 0) return;
  const all = await loadAll();
  const baseArray = Array.isArray(all) ? all : [];
  const filtered = baseArray.filter((entry) => !set.has(String(entry?.id)));
  await saveAll(filtered);
}

/**
 * (Optional) Clear all orders - handy for debugging.
 */
// export async function clearAllOrders() {
//   await saveAll([]);
// }

export async function listLocalOrders(status) {
  const all = await getOrders();
  if (!status) return all;
  return all.filter((order) => order?.status === status);
}
