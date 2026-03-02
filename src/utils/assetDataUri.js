import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

const dataUriCache = new Map();

const guessMime = (uri) => {
  const lower = String(uri || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
};

export const moduleAssetToDataUri = async (moduleId) => {
  if (!moduleId) return null;
  if (dataUriCache.has(moduleId)) return dataUriCache.get(moduleId);

  const asset = Asset.fromModule(moduleId);
  if (!asset) return null;

  try {
    if (!asset.localUri) {
      await asset.downloadAsync();
    }

    const uri = asset.localUri || asset.uri;
    if (!uri) return null;

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const mime = guessMime(uri);
    const dataUri = `data:${mime};base64,${base64}`;
    dataUriCache.set(moduleId, dataUri);
    return dataUri;
  } catch (e) {
    return null;
  }
};
