// /src/utils/permanentMetaStorage.js
// File-based storage for metadata of permanent (non-expiring) sheets
// Keeps permanent sheets' metadata out of AsyncStorage to avoid conflicts with cache

import * as FileSystem from 'expo-file-system/legacy';

const PERMANENT_META_FILE = `${FileSystem.documentDirectory}permanent-sheet-meta.json`;
let metaCache = null; // In-memory cache to avoid repeated file reads

async function ensurePermanentMetaFile() {
  try {
    const info = await FileSystem.getInfoAsync(PERMANENT_META_FILE);
    if (!info.exists) {
      await FileSystem.writeAsStringAsync(PERMANENT_META_FILE, JSON.stringify({}));
    }
  } catch (error) {
    console.warn('[permanentMetaStorage] Cannot create file:', error.message);
  }
}

async function loadMetaFromFile() {
  try {
    await ensurePermanentMetaFile();
    const content = await FileSystem.readAsStringAsync(PERMANENT_META_FILE);
    return JSON.parse(content);
  } catch (error) {
    console.warn('[permanentMetaStorage] Failed to load meta:', error.message);
    return {};
  }
}

async function saveMetaToFile(meta) {
  try {
    await FileSystem.writeAsStringAsync(PERMANENT_META_FILE, JSON.stringify(meta, null, 2));
  } catch (error) {
    console.warn('[permanentMetaStorage] Failed to save meta:', error.message);
  }
}

/**
 * Get metadata for a permanent sheet from file storage
 */
export async function getPermanentMeta(sheetKey) {
  if (!metaCache) {
    metaCache = await loadMetaFromFile();
  }
  return metaCache[sheetKey] || null;
}

/**
 * Set metadata for a permanent sheet in file storage
 */
export async function setPermanentMeta(sheetKey, meta) {
  if (!metaCache) {
    metaCache = await loadMetaFromFile();
  }

  metaCache[sheetKey] = meta;
  await saveMetaToFile(metaCache);
  
  console.log(`[permanentMetaStorage] Saved meta for ${sheetKey}:`, {
    lastFetchedAt: meta.lastFetchedAt,
    checksum: meta.checksum ? meta.checksum.substring(0, 8) : null,
  });
}

/**
 * Clear all permanent metadata (for testing/reset)
 */
export async function clearAllPermanentMeta() {
  metaCache = {};
  await saveMetaToFile({});
  console.log('[permanentMetaStorage] Cleared all permanent metadata');
}

/**
 * Clear metadata for a specific sheet
 */
export async function clearPermanentMeta(sheetKey) {
  if (!metaCache) {
    metaCache = await loadMetaFromFile();
  }

  delete metaCache[sheetKey];
  await saveMetaToFile(metaCache);
  console.log(`[permanentMetaStorage] Cleared meta for ${sheetKey}`);
}
