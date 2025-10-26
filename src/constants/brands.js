export const CUSTOMER_COLLECTIONS = {
  playmobil: 'customers',
  john: 'customers_john',
  kivos: 'customers_kivos',
};

export const PRODUCT_COLLECTIONS = {
  playmobil: 'products',
  john: 'products_john',
  kivos: 'products_kivos',
};

export const AVAILABLE_BRANDS = Object.keys(CUSTOMER_COLLECTIONS);

export const BRAND_LABEL = {
  playmobil: 'Playmobil',
  john: 'John',
  kivos: 'Kivos',
};

export const DEFAULT_BRAND = 'playmobil';

const BRAND_ALIASES = {
  playmobil: ['playmobil hellas', 'playmobil_hellas', 'playmobilhellas', 'pm'],
  john: ['john hellas', 'john_hellas', 'johnhellas', 'john toys', 'john toys hellas'],
  kivos: ['kivos hellas', 'kivos_hellas', 'kivoshellas'],
};

const BRAND_ALIAS_LOOKUP = Object.entries(BRAND_ALIASES).reduce((acc, [canonical, aliases]) => {
  aliases.forEach((alias) => {
    if (typeof alias !== 'string') {
      return;
    }
    const trimmed = alias.trim().toLowerCase();
    if (!trimmed) {
      return;
    }
    acc[trimmed] = canonical;
    acc[trimmed.replace(/[\s_-]+/g, '')] = canonical;
  });
  return acc;
}, {});

export function normalizeBrandKey(rawBrand) {
  if (typeof rawBrand !== 'string') {
    return DEFAULT_BRAND;
  }

  const trimmed = rawBrand.trim().toLowerCase();
  if (!trimmed) {
    return DEFAULT_BRAND;
  }

  if (CUSTOMER_COLLECTIONS[trimmed]) {
    return trimmed;
  }

  const compact = trimmed.replace(/[\s_-]+/g, '');
  const aliasMatch = BRAND_ALIAS_LOOKUP[trimmed] || BRAND_ALIAS_LOOKUP[compact];
  if (aliasMatch && CUSTOMER_COLLECTIONS[aliasMatch]) {
    return aliasMatch;
  }

  return DEFAULT_BRAND;
}

export const SUPERMARKET_BRANDS = ['playmobil', 'john'];

export function isSuperMarketBrand(brand) {
  return ['john', 'kivos', 'playmobil', 'supermarket'].includes(brand);
}

export const SUPERMARKET_COLLECTIONS = {
  listings: 'supermarket_listings',
  stores: 'supermarket_stores',
  meta: 'supermarket_meta',
};