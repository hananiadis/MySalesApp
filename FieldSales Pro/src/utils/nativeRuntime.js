const SELECTED_BRAND_KEY = 'fieldSales:selectedBrand';

function normalizeBrands(brands) {
  if (!Array.isArray(brands)) {
    return [];
  }

  return brands
    .map((brand) => String(brand || '').trim().toLowerCase())
    .filter(Boolean);
}

export function getRuntimeConfig() {
  if (typeof window === 'undefined') {
    return {
      idToken: '',
      uid: '',
      email: '',
      role: '',
      brands: [],
      defaultBrand: '',
      bffBaseUrl: '',
    };
  }

  const runtime = window.__MYSALES_RUNTIME || {};
  const brands = normalizeBrands(window.MYSALES_BRANDS || runtime.brands);
  const savedBrand = window.localStorage.getItem(SELECTED_BRAND_KEY);
  const defaultBrand =
    (savedBrand && brands.includes(savedBrand) ? savedBrand : '') ||
    String(window.MYSALES_DEFAULT_BRAND || runtime.defaultBrand || brands[0] || '')
      .trim()
      .toLowerCase();

  return {
    idToken: String(window.MYSALES_ID_TOKEN || runtime.idToken || ''),
    uid: String(window.MYSALES_UID || runtime.uid || ''),
    email: String(window.MYSALES_EMAIL || runtime.email || ''),
    role: String(window.MYSALES_ROLE || runtime.role || ''),
    brands,
    defaultBrand,
    bffBaseUrl: String(window.MYSALES_BFF_BASE_URL || runtime.bffBaseUrl || ''),
  };
}

export function requestIdTokenRefresh(timeoutMs = 8000) {
  if (typeof window === 'undefined' || !window.ReactNativeWebView) {
    return Promise.reject(new Error('Native token bridge is unavailable.'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('mysales-runtime-updated', handleRuntimeUpdated);
      window.clearTimeout(timeoutId);
    };

    const finish = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const handleRuntimeUpdated = () => {
      const runtime = getRuntimeConfig();
      finish(() => resolve(runtime.idToken));
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error('Timed out waiting for refreshed ID token.')));
    }, timeoutMs);

    window.addEventListener('mysales-runtime-updated', handleRuntimeUpdated);
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'REQUEST_ID_TOKEN' })
    );
  });
}

export function persistSelectedBrand(brand) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedBrand = String(brand || '').trim().toLowerCase();
  if (!normalizedBrand) {
    return;
  }

  window.localStorage.setItem(SELECTED_BRAND_KEY, normalizedBrand);
}