// src/services/inventoryService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from './firebase';
import { getProductsFromLocal } from '../utils/localData';

const OFFLINE_QUEUE_KEY = 'inventory_offline_queue_v1';
const ACTIVE_INVENTORY_KEY = 'active_inventory_v1';

/**
 * Inventory line item structure:
 * {
 *   lineId: string (uuid)
 *   productId: string (Firestore doc ID)
 *   barcode: string
 *   sku: string
 *   name: string
 *   qty: number
 *   uom: string (piece, box, etc.)
 *   location?: string
 *   price?: number
 *   updatedAt: ISO string
 * }
 */

/**
 * Inventory document structure:
 * {
 *   inventoryId: string (uuid)
 *   customerId: string
 *   version: number
 *   status: 'active' | 'archived' | 'deleted'
 *   source: 'scan' | 'upload'
 *   note?: string
 *   rowCount: number
 *   totalQty: number
 *   createdAt: ISO string
 *   createdBy: string (userId)
 *   fileUrl?: string (Cloud Storage path)
 *   fileHash?: string
 *   parentVersion?: number
 * }
 */

export class InventoryService {
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Start a new inventory capture session (scan or upload).
   * Returns a session object with empty lines array.
   */
  static createSession(customerId, source = 'scan') {
    return {
      sessionId: this.generateUUID(),
      customerId,
      source,
      lines: [],
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Add a line to session (from scan or manual entry).
   * Auto-matches product by barcode or allows manual entry.
   */
  static async addLineToSession(session, barcode, quantity, productOverride = null) {
    if (!barcode || quantity <= 0) {
      throw new Error('Invalid barcode or quantity');
    }

    console.log('[InventoryService] addLineToSession: barcode=', barcode, 'qty=', quantity);
    
    const products = await getProductsFromLocal('playmobil');
    console.log('[InventoryService] Total products available:', products?.length || 0);
    
    if (!products || products.length === 0) {
      throw new Error('No products available. Please sync product database first.');
    }

    // Log first 3 products with full structure
    if (products.length > 0) {
      console.log('[InventoryService] Sample product structure:', JSON.stringify(products[0], null, 2));
      console.log('[InventoryService] Sample products:', products.slice(0, 3).map(p => ({ 
        id: p.id, 
        barcode: p.barcode, 
        sku: p.sku,
        productCode: p.productCode,
        name: p.name 
      })));
    }

    let product = null;

    // Try to find product by barcode
    if (!productOverride) {
      const trimmed = String(barcode).trim().toLowerCase();
      console.log('[InventoryService] Searching for (lowercase):', trimmed);
      
      // Try exact match first (case-insensitive) on multiple fields
      product = products.find((p) => {
        const barcodeMatch = p.barcode && String(p.barcode).trim().toLowerCase() === trimmed;
        const skuMatch = p.sku && String(p.sku).trim().toLowerCase() === trimmed;
        const productCodeMatch = p.productCode && String(p.productCode).trim().toLowerCase() === trimmed;
        const codeMatch = p.code && String(p.code).trim().toLowerCase() === trimmed;
        return barcodeMatch || skuMatch || productCodeMatch || codeMatch;
      });
      
      if (product) {
        console.log('[InventoryService] ✓ EXACT MATCH FOUND!');
        console.log('[InventoryService] Product details:', { 
          id: product.id, 
          barcode: product.barcode, 
          sku: product.sku, 
          productCode: product.productCode,
          name: product.name 
        });
      } else {
        console.log('[InventoryService] ✗ NO EXACT MATCH for:', trimmed);
        // Try partial match as fallback
        console.log('[InventoryService] Attempting partial match...');
        product = products.find((p) => {
          const barcode = String(p.barcode || '').trim().toLowerCase();
          const sku = String(p.sku || '').trim().toLowerCase();
          const productCode = String(p.productCode || '').trim().toLowerCase();
          return barcode.includes(trimmed) || sku.includes(trimmed) || productCode.includes(trimmed) ||
                 trimmed.includes(barcode) || trimmed.includes(sku) || trimmed.includes(productCode);
        });
        if (product) {
          console.log('[InventoryService] ✓ PARTIAL MATCH FOUND!');
          console.log('[InventoryService] Product details:', { 
            id: product.id, 
            barcode: product.barcode, 
            sku: product.sku,
            productCode: product.productCode, 
            name: product.name 
          });
        }
      }
    } else {
      product = productOverride;
    }

    if (!product) {
      console.error('[InventoryService] ✗ NO MATCH FOUND for barcode/SKU:', barcode);
      throw new Error(`Product not found for barcode/SKU: "${barcode}". Please verify it matches your product database exactly.`);
    }

    const line = {
      lineId: this.generateUUID(),
      productId: product.id,
      barcode: product.barcode || barcode,
      sku: product.sku || product.productCode || '',
      name: product.name || 'Unknown Product',
      qty: quantity,
      uom: product.uom || 'piece',
      location: '',
      price: product.price,
      updatedAt: new Date().toISOString(),
    };

    console.log('[InventoryService] ✓ Line created:', { lineId: line.lineId, sku: line.sku, name: line.name, qty: line.qty });
    session.lines.push(line);
    return session;
  }

  /**
   * Commit session to offline queue (to be synced later).
   * Merges duplicate productIds and writes to AsyncStorage.
   */
  static async commitSessionOffline(session, note = '') {
    const merged = this._mergeLinesByProduct(session.lines);
    const inventory = {
      inventoryId: this.generateUUID(),
      customerId: session.customerId,
      version: 1,
      status: 'active',
      source: session.source,
      note,
      rowCount: merged.length,
      totalQty: merged.reduce((sum, l) => sum + l.qty, 0),
      createdAt: new Date().toISOString(),
      lines: merged,
    };

    // Save to offline queue
    const queue = await this._getOfflineQueue();
    queue.push({
      type: 'create_inventory',
      payload: inventory,
      createdAt: new Date().toISOString(),
      syncAttempts: 0,
    });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

    // Set as active inventory for customer
    await this.setActiveInventory(session.customerId, inventory.inventoryId);

    return inventory;
  }

  /**
   * Push committed inventory to Firestore.
   * Creates customer subdocument structure.
   */
  static async syncOfflineQueue(userId) {
    const queue = await this._getOfflineQueue();
    if (!queue.length) return { synced: 0, failed: 0, pendingCount: 0 };

    let synced = 0;
    let failed = 0;
    const remainingQueue = [];

    for (const task of queue) {
      try {
        if (task.type === 'create_inventory') {
          const { customerId, inventoryId, lines, ...meta } = task.payload;
          const batch = firestore().batch();

          // Write inventory document
          const invRef = firestore()
            .collection('customers')
            .doc(customerId)
            .collection('inventories')
            .doc(inventoryId);
          batch.set(invRef, { ...meta, inventoryId });

          // Write line items
          for (const line of lines) {
            const lineRef = invRef.collection('lines').doc(line.lineId);
            batch.set(lineRef, line);
          }

          // Set current inventory
          const custRef = firestore().collection('customers').doc(customerId);
          batch.update(custRef, {
            currentInventoryId: inventoryId,
            lastInventorySyncAt: new Date().toISOString(),
          });

          await batch.commit();
          synced++;
        }
      } catch (error) {
        console.error('[InventoryService] Sync error:', error);
        task.syncAttempts = (task.syncAttempts || 0) + 1;
        if (task.syncAttempts < 3) {
          remainingQueue.push(task);
        }
        failed++;
      }
    }

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    return { synced, failed, pendingCount: remainingQueue.length };
  }

  /**
   * Fetch active inventory for customer from Firestore.
   */
  static async getActiveInventory(customerId) {
    try {
      const custSnap = await firestore().collection('customers').doc(customerId).get();
      if (!custSnap.exists) return null;

      const { currentInventoryId } = custSnap.data() || {};
      if (!currentInventoryId) return null;

      const invSnap = await firestore()
        .collection('customers')
        .doc(customerId)
        .collection('inventories')
        .doc(currentInventoryId)
        .get();

      if (!invSnap.exists) return null;

      // Fetch lines
      const linesSnap = await firestore()
        .collection('customers')
        .doc(customerId)
        .collection('inventories')
        .doc(currentInventoryId)
        .collection('lines')
        .limit(1000)
        .get();

      const lines = linesSnap.docs.map((d) => d.data());

      return {
        ...invSnap.data(),
        lines,
      };
    } catch (error) {
      console.error('[InventoryService] Failed to fetch active inventory:', error);
      return null;
    }
  }

  /**
   * Cache active inventory locally.
   */
  static async setActiveInventory(customerId, inventoryId) {
    try {
      const cache = {};
      cache[customerId] = inventoryId;
      await AsyncStorage.setItem(ACTIVE_INVENTORY_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn('[InventoryService] Failed to cache active inventory:', error);
    }
  }

  /**
   * Get cached active inventory ID (fast path).
   */
  static async getCachedActiveInventoryId(customerId) {
    try {
      const cache = await AsyncStorage.getItem(ACTIVE_INVENTORY_KEY);
      if (cache) {
        const parsed = JSON.parse(cache);
        return parsed[customerId] || null;
      }
    } catch (error) {
      console.warn('[InventoryService] Failed to read active inventory cache:', error);
    }
    return null;
  }

  /**
   * Fetch all lines for an inventory (paginated).
   */
  static async getInventoryLines(customerId, inventoryId, limit = 500) {
    try {
      const snap = await firestore()
        .collection('customers')
        .doc(customerId)
        .collection('inventories')
        .doc(inventoryId)
        .collection('lines')
        .limit(limit)
        .get();

      return snap.docs.map((d) => d.data());
    } catch (error) {
      console.error('[InventoryService] Failed to fetch inventory lines:', error);
      return [];
    }
  }

  /**
   * Archive old inventory, set new one as active.
   */
  static async switchActiveInventory(customerId, newInventoryId) {
    try {
      const batch = firestore().batch();

      // Get current active
      const custSnap = await firestore().collection('customers').doc(customerId).get();
      const { currentInventoryId: oldInvId } = custSnap.data() || {};

      if (oldInvId) {
        // Archive old
        const oldRef = firestore()
          .collection('customers')
          .doc(customerId)
          .collection('inventories')
          .doc(oldInvId);
        batch.update(oldRef, { status: 'archived' });
      }

      // Set new active
      const custRef = firestore().collection('customers').doc(customerId);
      batch.update(custRef, { currentInventoryId: newInventoryId });

      await batch.commit();
      await this.setActiveInventory(customerId, newInventoryId);
    } catch (error) {
      console.error('[InventoryService] Failed to switch active inventory:', error);
      throw error;
    }
  }

  /**
   * Delete inventory (soft delete: set status to deleted).
   */
  static async deleteInventory(customerId, inventoryId) {
    try {
      const batch = firestore().batch();

      const ref = firestore()
        .collection('customers')
        .doc(customerId)
        .collection('inventories')
        .doc(inventoryId);
      batch.update(ref, { status: 'deleted' });

      // If it's active, clear it
      const custSnap = await firestore().collection('customers').doc(customerId).get();
      const { currentInventoryId } = custSnap.data() || {};
      if (currentInventoryId === inventoryId) {
        const custRef = firestore().collection('customers').doc(customerId);
        batch.update(custRef, { currentInventoryId: null });
      }

      await batch.commit();
    } catch (error) {
      console.error('[InventoryService] Failed to delete inventory:', error);
      throw error;
    }
  }

  /**
   * Private: Merge lines by productId (sum quantities).
   */
  static _mergeLinesByProduct(lines) {
    const map = new Map();
    for (const line of lines) {
      const key = line.productId;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.qty += line.qty;
      } else {
        map.set(key, { ...line });
      }
    }
    return Array.from(map.values());
  }

  /**
   * Private: Get offline queue.
   */
  static async _getOfflineQueue() {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.warn('[InventoryService] Failed to read offline queue:', error);
      return [];
    }
  }
}

export default InventoryService;
