// utils/imageHelpers.js

import RNFS from 'react-native-fs';
import { useState, useEffect } from 'react';

// Directory for product images (stored in the app's documents directory for persistence)
export const IMAGES_DIR = `${RNFS.DocumentDirectoryPath}/product_images`;

/**
 * Ensure the images directory exists.
 */
export async function ensureImagesDir() {
  try {
    const exists = await RNFS.exists(IMAGES_DIR);
    if (!exists) {
      await RNFS.mkdir(IMAGES_DIR);
    }
  } catch (e) {
    console.warn('Failed to ensure image directory:', e.message || e);
  }
}

/**
 * Returns the local file path for a product image based on its code.
 */
export function getLocalImagePath(productCode) {
  if (!productCode) return null;
  return `${IMAGES_DIR}/product_${productCode}.jpg`;
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
export async function downloadAndCacheImage(productCode, remoteUrl) {
  if (!productCode || !remoteUrl) return null;
  const normalizedUrl = normalizeImageUrl(remoteUrl);
  if (!normalizedUrl) return null;
  await ensureImagesDir();

  const localPath = getLocalImagePath(productCode);
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
export function useLocalOrRemoteImage(productCode, remoteUrl, forceDownload = false) {
  const [uri, setUri] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!productCode || !remoteUrl) {
        if (mounted) setUri(null);
        return;
      }
      const localPath = getLocalImagePath(productCode);
      let exists = await RNFS.exists(localPath);
      if (!exists && forceDownload) {
        await downloadAndCacheImage(productCode, remoteUrl);
        exists = await RNFS.exists(localPath);
      }
      if (exists && mounted) setUri(`file://${localPath}`);
      else if (mounted) setUri(remoteUrl);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [productCode, remoteUrl, forceDownload]);

  return uri;
}
