// utils/imageHelpers.js

import RNFS from 'react-native-fs';
import { useState, useEffect } from 'react';

// Base directory for product images (Downloads/MySalesApp/Pictures)
const BASE_IMAGES_DIR = `${RNFS.DownloadDirectoryPath}/MySalesApp/Pictures`;

/**
 * Get the images directory for a specific brand
 */
export function getImagesDirForBrand(brand = 'playmobil') {
  return `${BASE_IMAGES_DIR}/${brand}`;
}

/**
 * Get the base images directory (for legacy compatibility and storage info)
 */
export function getBaseImagesDir() {
  return BASE_IMAGES_DIR;
}

/**
 * Ensure the images directory exists for a specific brand.
 */
export async function ensureImagesDir(brand = 'playmobil') {
  try {
    const brandDir = getImagesDirForBrand(brand);
    const baseExists = await RNFS.exists(BASE_IMAGES_DIR);
    if (!baseExists) {
      await RNFS.mkdir(BASE_IMAGES_DIR);
      console.log(`[imageHelpers] Created base directory: ${BASE_IMAGES_DIR}`);
    }
    
    const brandExists = await RNFS.exists(brandDir);
    if (!brandExists) {
      await RNFS.mkdir(brandDir);
      console.log(`[imageHelpers] Created brand directory: ${brandDir}`);
    }
  } catch (e) {
    console.warn('Failed to ensure image directory:', e.message || e);
  }
}

/**
 * Returns the local file path for a product image based on its code and brand.
 */
export function getLocalImagePath(productCode, brand = 'playmobil') {
  if (!productCode) return null;
  const brandDir = getImagesDirForBrand(brand);
  return `${brandDir}/product_${productCode}.jpg`;
}

const normalizeImageUrl = (remoteUrl) => {
  if (!remoteUrl) return null;
  let urlText = String(remoteUrl).trim();
  if (!urlText) {
    return null;
  }

  if (!/^https?:\/\//i.test(urlText)) {
    return urlText;
  }

  if (urlText.includes('drive.google.com')) {
    const idMatch =
      urlText.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
      urlText.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      urlText = `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
    }
  }

  if (urlText.includes('firebasestorage.googleapis.com') && !/[?&]alt=media/.test(urlText)) {
    const separator = urlText.includes('?') ? '&' : '?';
    urlText = `${urlText}${separator}alt=media`;
  }

  return urlText.replace(/\s+/g, '%20');
};

/**
 * Download an image from the internet and store it locally.
 * Returns the local file path if successful, or null on failure.
 */
export async function downloadAndCacheImage(productCode, remoteUrl, brand = 'playmobil') {
  if (!productCode || !remoteUrl) return null;
  const normalizedUrl = normalizeImageUrl(remoteUrl);
  if (!normalizedUrl) return null;
  await ensureImagesDir(brand);

  const localPath = getLocalImagePath(productCode, brand);
  try {
    const exists = await RNFS.exists(localPath);
    if (exists) return localPath;

    const res = await RNFS.downloadFile({
      fromUrl: normalizedUrl,
      toFile: localPath,
    }).promise;

    if (res && res.statusCode >= 200 && res.statusCode < 300) {
      return localPath;
    }

    try {
      await RNFS.unlink(localPath);
    } catch (e) {
      // ignore cleanup error
    }
    throw new Error(`Download failed with status: ${res.statusCode}, url: ${remoteUrl}`);
  } catch (err) {
    console.warn(
      `Image download failed for ${productCode}:`,
      normalizedUrl,
      err?.message || err
    );
    return null;
  }
}

/**
 * React hook to get the local cached image if available, otherwise falls back to remote.
 * Optionally, downloads and caches the image if not found locally.
 * Returns the URI (file://...) or the remoteUrl.
 *
 * Usage:
 *   const uri = useLocalOrRemoteImage(productCode, remoteUrl, true);
 */
export function useLocalOrRemoteImage(productCode, remoteUrl, forceDownload = false, brand = 'playmobil') {
  const [uri, setUri] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!productCode || !remoteUrl) {
        if (mounted) setUri(null);
        return;
      }
      const localPath = getLocalImagePath(productCode, brand);
      let exists = await RNFS.exists(localPath);
      if (!exists && forceDownload) {
        await downloadAndCacheImage(productCode, remoteUrl, brand);
        exists = await RNFS.exists(localPath);
      }
      if (exists && mounted) setUri(`file://${localPath}`);
      else if (mounted) setUri(remoteUrl);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [productCode, remoteUrl, forceDownload, brand]);

  return uri;
}

/**
 * Get the path to the base images directory
 */
export function getImagesDirPath() {
  return BASE_IMAGES_DIR;
}

/**
 * Get total size of all cached images in bytes (all brands)
 */
export async function getImagesCacheSize() {
  try {
    const exists = await RNFS.exists(BASE_IMAGES_DIR);
    if (!exists) return 0;

    const items = await RNFS.readDir(BASE_IMAGES_DIR);
    let totalSize = 0;
    
    // Sum size from all brand folders
    for (const item of items) {
      if (item.isDirectory()) {
        const files = await RNFS.readDir(item.path);
        for (const file of files) {
          if (file.isFile()) {
            totalSize += file.size || 0;
          }
        }
      } else if (item.isFile()) {
        totalSize += item.size || 0;
      }
    }
    return totalSize;
  } catch (e) {
    console.warn('Failed to calculate images cache size:', e.message || e);
    return 0;
  }
}

/**
 * Format bytes to human-readable format (B, KB, MB, GB)
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get detailed statistics about cached images
 * Returns: { totalSize, totalCount, lastDownloadTime, sizeFormatted, brands }
 */
export async function getImagesCacheStats() {
  try {
    const exists = await RNFS.exists(BASE_IMAGES_DIR);
    if (!exists) {
      return {
        totalSize: 0,
        totalCount: 0,
        lastDownloadTime: null,
        sizeFormatted: '0 B',
        brands: {},
      };
    }

    const items = await RNFS.readDir(BASE_IMAGES_DIR);
    let totalSize = 0;
    let totalCount = 0;
    let mostRecentMtime = null;
    const brands = {};
    
    // Iterate through brand folders
    for (const item of items) {
      if (item.isDirectory()) {
        const brandName = item.name;
        brands[brandName] = { count: 0, size: 0 };
        
        const files = await RNFS.readDir(item.path);
        for (const file of files) {
          if (file.isFile()) {
            totalSize += file.size || 0;
            totalCount += 1;
            brands[brandName].count += 1;
            brands[brandName].size += file.size || 0;
            
            // Track most recent modification time
            if (file.mtime) {
              const mtime = new Date(file.mtime);
              if (!mostRecentMtime || mtime > mostRecentMtime) {
                mostRecentMtime = mtime;
              }
            }
          }
        }
      } else if (item.isFile()) {
        // Handle any files in root (shouldn't happen but just in case)
        totalSize += item.size || 0;
        totalCount += 1;
        
        if (item.mtime) {
          const mtime = new Date(item.mtime);
          if (!mostRecentMtime || mtime > mostRecentMtime) {
            mostRecentMtime = mtime;
          }
        }
      }
    }
    
    return {
      totalSize,
      totalCount,
      lastDownloadTime: mostRecentMtime,
      sizeFormatted: formatBytes(totalSize),
      brands,
    };
  } catch (e) {
    console.warn('Failed to get images cache stats:', e.message || e);
    return {
      totalSize: 0,
      totalCount: 0,
      lastDownloadTime: null,
      sizeFormatted: '0 B',
      brands: {},
    };
  }
}

/**
 * Get list of all cached image files with their sizes (all brands)
 */
export async function getImagesCacheList() {
  try {
    const exists = await RNFS.exists(BASE_IMAGES_DIR);
    if (!exists) return [];

    const result = [];
    const items = await RNFS.readDir(BASE_IMAGES_DIR);
    
    for (const item of items) {
      if (item.isDirectory()) {
        const files = await RNFS.readDir(item.path);
        for (const file of files) {
          if (file.isFile()) {
            result.push({
              brand: item.name,
              name: file.name,
              path: file.path,
              size: file.size,
              sizeFormatted: formatBytes(file.size),
            });
          }
        }
      }
    }
    
    return result.sort((a, b) => b.size - a.size);
  } catch (e) {
    console.warn('Failed to list images cache:', e.message || e);
    return [];
  }
}

/**
 * Delete all images for a specific brand
 */
export async function deleteImagesByBrand(brand) {
  try {
    const brandDir = getImagesDirForBrand(brand);
    const exists = await RNFS.exists(brandDir);
    if (!exists) return 0;

    const files = await RNFS.readDir(brandDir);
    let deletedCount = 0;

    for (const file of files) {
      if (file.isFile()) {
        try {
          await RNFS.unlink(file.path);
          deletedCount += 1;
        } catch (e) {
          console.warn(`Failed to delete ${file.name}:`, e.message || e);
        }
      }
    }

    console.log(`[imageHelpers] Deleted ${deletedCount} images for brand: ${brand}`);
    return deletedCount;
  } catch (e) {
    console.warn('Failed to delete images by brand:', e.message || e);
    return 0;
  }
}

/**
 * Delete all cached images (all brands)
 */
export async function clearAllImageCache() {
  try {
    const exists = await RNFS.exists(BASE_IMAGES_DIR);
    if (!exists) return 0;

    const items = await RNFS.readDir(BASE_IMAGES_DIR);
    let deletedCount = 0;

    for (const item of items) {
      if (item.isDirectory()) {
        const files = await RNFS.readDir(item.path);
        for (const file of files) {
          if (file.isFile()) {
            try {
              await RNFS.unlink(file.path);
              deletedCount += 1;
            } catch (e) {
              console.warn(`Failed to delete ${file.name}:`, e.message || e);
            }
          }
        }
      }
    }

    console.log(`[imageHelpers] Cleared ${deletedCount} images from all brands`);
    return deletedCount;
  } catch (e) {
    console.warn('Failed to clear all image cache:', e.message || e);
    return 0;
  }
}
