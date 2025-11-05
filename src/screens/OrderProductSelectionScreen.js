// src/screens/OrderProductSelectionScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useOrder } from '../context/OrderContext';
import { getProductsFromLocal } from '../utils/localData';
import { getImmediateAvailabilityMap, lookupImmediateStockValue } from '../utils/stockAvailability';
import { normalizeBrandKey } from '../constants/brands';
import { computeOrderTotals } from '../utils/orderTotals';

export default function OrderProductSelectionScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);

  const orderCtx = useOrder() || {};
  const orderLines = Array.isArray(orderCtx.orderLines) ? orderCtx.orderLines : [];
  const setOrderLines = typeof orderCtx.setOrderLines === 'function' ? orderCtx.setOrderLines : () => {};
  const paymentMethod = orderCtx.paymentMethod || orderCtx.order?.paymentMethod || 'prepaid_cash';
  const orderCustomer = orderCtx.customer || orderCtx.order?.customer || null;

  const rawRouteProducts = Array.isArray(route?.params?.products) ? route.params.products : [];
  const brand = useMemo(
    () => normalizeBrandKey(route?.params?.brand || orderCtx.order?.brand || 'playmobil'),
    [orderCtx.order?.brand, route?.params?.brand]
  );
  const routeProducts = useMemo(
    () => rawRouteProducts.filter((item = {}) => normalizeBrandKey(item.brand || brand) === brand),
    [brand, rawRouteProducts]
  );
  const [products, setProducts] = useState(routeProducts);
  useEffect(() => {
    if (routeProducts.length) {
      setProducts(routeProducts);
    }
  }, [routeProducts]);

  function ensureVisible(index) {
    try {
      if (!listRef?.current || typeof index !== 'number') return;
      setTimeout(() => {
        try {
          listRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: Platform.OS === 'android' ? 0.2 : 0.4,
          });
        } catch {}
      }, 50);
    } catch {}
  }

  const [loading, setLoading] = useState(!routeProducts.length);
  const [search, setSearch] = useState('');
  const [kbPad, setKbPad] = useState(0);
  const [immediateStockMap, setImmediateStockMap] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await getImmediateAvailabilityMap();
        if (!cancelled && map) setImmediateStockMap(new Map(map));
      } catch {
        if (!cancelled) setImmediateStockMap(new Map());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleGoBack = useCallback(() => {
    navigation.navigate('OrderCustomerSelectScreen', { brand });
  }, [brand, navigation]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (event.data.action?.type === 'GO_BACK') {
          event.preventDefault();
          handleGoBack();
        }
      });
      return () => unsubscribe();
    }, [handleGoBack, navigation])
  );

  const [expandedNodes, setExpandedNodes] = useState({});
  const [searchCollapsed, setSearchCollapsed] = useState({});

  const codeOf = (p) => p?.productCode ?? p?.code ?? p?.sku ?? p?.ProductCode ?? String(p?.id ?? '');
  const descOf = (p) => p?.description ?? p?.desc ?? p?.name ?? p?.productDescription ?? '';
  
  const parseNumeric = (value) => {
    if (value == null) return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const normalized = String(value)
      .replace(/€/g, '')
      .replace(/\s+/g, '')
      .replace(/,/g, '.')
      .replace(/[^0-9.-]/g, '');
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const roundCurrency = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return Math.round(numeric * 100) / 100;
  };

  const wholesaleOf = (p) => {
    const candidates = [
      p?.wholesalePrice,
      p?.whPrice,
      p?.wh_price,
      p?.WholesalePrice,
      p?.wholesale,
    ];
    for (const candidate of candidates) {
      const parsed = parseNumeric(candidate);
      if (parsed != null) {
        const rounded = roundCurrency(parsed);
        if (rounded != null) {
          return rounded;
        }
      }
    }
    return 0;
  };

  const srpOf = (p) => {
    const candidates = [p?.srp, p?.SRP, p?.retailPrice, p?.Retail];
    for (const candidate of candidates) {
      const parsed = parseNumeric(candidate);
      if (parsed != null) {
        const rounded = roundCurrency(parsed);
        if (rounded != null) {
          return rounded;
        }
      }
    }
    return null;
  };

  const offerOf = (p) => {
    const candidates = [p?.offerPrice, p?.offer_price, p?.offer];
    for (const candidate of candidates) {
      const parsed = parseNumeric(candidate);
      if (parsed != null && parsed > 0) {
        const rounded = roundCurrency(parsed);
        if (rounded != null && rounded > 0) {
          return rounded;
        }
      }
    }
    return null;
  };

  const barcodeOf = (p) => {
    const candidates = [
      p?.barcodeUnit,
      p?.barcode_unit,
      p?.barcode,
      p?.Barcode,
      p?.ean,
      p?.eanCode,
    ];
    for (const candidate of candidates) {
      if (candidate) {
        return String(candidate);
      }
    }
    return '';
  };

  const playingThemeOf = (p) => {
    const theme = p?.playingTheme ?? p?.PlayingTheme ?? p?.playing_theme ?? p?.theme ?? '';
    const normalized = String(theme || '').trim();
    return normalized || 'Χωρίς θέμα';
  };

  const sheetCategoryOf = (p) => {
    const value = p?.sheetCategory ?? p?.SheetCategory ?? '';
    const normalized = String(value || '').trim();
    return normalized || 'Χωρίς Φύλλο';
  };

  const generalCategoryOf = (p) => {
    const value = p?.generalCategory ?? p?.GeneralCategory ?? '';
    const normalized = String(value || '').trim();
    return normalized || 'Χωρίς Γενική Κατηγορία';
  };

  const subCategoryOf = (p) => {
    const value = p?.subCategory ?? p?.SubCategory ?? '';
    const normalized = String(value || '').trim();
    return normalized || 'Χωρίς Υποκατηγορία';
  };

  const supplierBrandOf = (p) => {
    const value = p?.supplierBrand ?? p?.SupplierBrand ?? p?.brand ?? '';
    const normalized = String(value || '').trim();
    return normalized || 'Άγνωστο brand';
  };

  const kivosCategoryOf = (p) => {
    const value = p?.category ?? p?.Category ?? p?.generalCategory ?? '';
    const normalized = String(value || '').trim();
    return normalized || 'Χωρίς Κατηγορία';
  };

  const makeNodeKey = useCallback(
    (...parts) =>
      `${brand}::${parts
        .map((part) => encodeURIComponent(String(part ?? '').trim().toLowerCase() || 'n-a'))
        .join('>')}`,
    [brand]
  );

  const parsePackageCount = (raw) => {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'number') {
      const numeric = Number(raw);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    }
    const text = String(raw).trim();
    if (!text) {
      return null;
    }
    const match = text.match(/(\d+(?:[.,]\d+)?)/);
    if (!match) {
      return null;
    }
    const parsed = Number(match[1].replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const packageSizeOf = (product, fallbackSize = null) => {
    const candidates = [
      fallbackSize,
      product?.packageSize,
      product?.packageQty,
      product?.package_quantity,
      product?.package,
      product?.packaging,
      product?.piecesPerPack,
      product?.pieces_per_pack,
      product?.piecesPerPackage,
      product?.qtyPerPack,
      product?.qty_per_pack,
      product?.piecesPerBox,
      product?.unitsPerPack,
      product?.units_per_pack,
    ];
    for (const candidate of candidates) {
      const parsed = parsePackageCount(candidate);
      if (parsed) {
        return parsed;
      }
    }
    return 1;
  };

  const packageLabelOf = (product, resolvedSize = 1) => {
    const candidates = [
      product?.packageLabel,
      product?.package,
      product?.packaging,
      product?.packageDescription,
      product?.package_desc,
    ];
    for (const candidate of candidates) {
      const text = String(candidate || '').trim();
      if (text) {
        return text;
      }
    }
    if (resolvedSize && resolvedSize > 1) {
      return `${resolvedSize} τεμ.`;
    }
    return '';
  };

  const cataloguePageOf = (p) => {
    const raw = p?.cataloguePage ?? p?.CataloguePage ?? p?.catalogPage ?? p?.CatalogPage ?? p?.catalogue_page ?? p?.catalog_page ?? null;
    if (raw == null) return Number.POSITIVE_INFINITY;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const match = String(raw).match(/\d+/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
  };

  const getImmediateStock = (code) => lookupImmediateStockValue(immediateStockMap, code);

  const stockOf = (p) => {
    const code = codeOf(p);
    const mapped = getImmediateStock(code);
    if (mapped != null && mapped !== '') return mapped;
    const fallback = p?.availableStock ?? p?.stock ?? p?.Stock ?? p?.AvailableStock ?? null;
    return fallback != null && fallback !== '' ? fallback : 'n/a';
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (routeProducts.length) return;
      try {
        setLoading(true);
        const local = await getProductsFromLocal(brand);
        if (isMounted) {
          const list = Array.isArray(local) ? local : [];
          const scoped = list.filter((item = {}) => normalizeBrandKey(item.brand || brand) === brand);
          setProducts(scoped);
        }
      } catch {
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [brand, routeProducts.length]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e?.endCoordinates?.height || 0;
      setKbPad(h > 0 ? h : 0);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbPad(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const qtyFor = useMemo(() => {
    const map = new Map();
    for (const line of orderLines) {
      const code = line?.productCode;
      if (!code) {
        continue;
      }
      let displayQuantity = Number(line?.quantity || 0);
      if (brand === 'kivos') {
        const pkgQty = Number(line?.packageQuantity);
        if (Number.isFinite(pkgQty)) {
          displayQuantity = pkgQty;
        } else {
          const pkgSize = Number(line?.packageSize || 1);
          if (pkgSize > 0) {
            const computed = Number(line?.quantity || 0) / pkgSize;
            if (Number.isFinite(computed)) {
              displayQuantity = computed;
            }
          }
        }
      }
      map.set(code, displayQuantity);
    }
    return map;
  }, [orderLines, brand]);

  const getQty = (code) => qtyFor.get(code) || 0;

  const setQty = (product, qty) => {
    const code = codeOf(product);
    const description = descOf(product);
    const wholesale = wholesaleOf(product);
    const srp = srpOf(product);
    const offer = offerOf(product);
    const barcode = barcodeOf(product);
    const q = Math.max(0, Number(qty) || 0);
    const isKivos = brand === 'kivos';
    const isJohn = brand === 'john';
    const usesPackages = isKivos || isJohn;
    const sanitizedWholesale = roundCurrency(wholesale);
    const sanitizedSrp = roundCurrency(srp);
    const sanitizedOffer = roundCurrency(offer);
    const baseWholesale = sanitizedWholesale ?? 0;
    const offerPriceValue = sanitizedOffer;
    const unitPrice = isKivos && offerPriceValue != null ? offerPriceValue : baseWholesale;

    setOrderLines((prev = []) => {
      const exists = prev.find((l) => l.productCode === code);
      const existingPackageSize = usesPackages ? Number(exists?.piecesPerBox || exists?.packageSize || 0) : null;
      const derivedPackageSize = usesPackages ? packageSizeOf(product, existingPackageSize) : 1;
      const piecesPerBox = usesPackages
        ? Math.max(1, Math.round(Number(derivedPackageSize || existingPackageSize || 1)))
        : 1;
      const packageLabel = usesPackages && piecesPerBox > 0 ? `${piecesPerBox} τεμ.` : '';
      const supplierBrand = supplierBrandOf(product);
      const derivedQuantity = isKivos ? q * piecesPerBox : q;

      if (exists) {
        if (q === 0) return prev.filter((l) => l.productCode !== code);
        return prev.map((l) => {
          if (l.productCode !== code) return l;
          const nextLine = {
            ...l,
            quantity: derivedQuantity,
            wholesalePrice: roundCurrency(unitPrice) ?? roundCurrency(l.wholesalePrice) ?? 0,
            srp: sanitizedSrp ?? roundCurrency(l.srp) ?? null,
            supplierBrand: supplierBrand || l.supplierBrand || null,
            originalWholesalePrice: baseWholesale,
            barcodeUnit: barcode || l.barcodeUnit || null,
          };
          if (offerPriceValue != null) {
            nextLine.offerPrice = offerPriceValue;
          } else {
            delete nextLine.offerPrice;
          }
          if (usesPackages) {
            nextLine.packageSize = piecesPerBox;
            nextLine.packageLabel = packageLabel;
            nextLine.piecesPerBox = piecesPerBox;
          }
          if (isKivos) {
            nextLine.packageQuantity = q;
          }
          return nextLine;
        });
      }

      if (q > 0) {
        const newLine = {
          productCode: code,
          description,
          wholesalePrice: roundCurrency(unitPrice) ?? 0,
          srp: sanitizedSrp ?? null,
          quantity: derivedQuantity,
          supplierBrand: supplierBrand || null,
          originalWholesalePrice: baseWholesale,
          barcodeUnit: barcode || null,
        };
        if (offerPriceValue != null) {
          newLine.offerPrice = offerPriceValue;
        }
        if (usesPackages) {
          newLine.packageSize = piecesPerBox;
          newLine.packageLabel = packageLabel;
          newLine.piecesPerBox = piecesPerBox;
        }
        if (isKivos) {
          newLine.packageQuantity = q;
        }
        return [
          ...prev,
          newLine,
        ];
      }
      return prev;
    });
  };

  const increment = (p) => setQty(p, getQty(codeOf(p)) + 1);
  const decrement = (p) => setQty(p, Math.max(0, getQty(codeOf(p)) - 1));

  const { totalItems, totalValue } = useMemo(() => {
    let items = 0;
    for (const line of orderLines) {
      const quantityUnits = Number(line.quantity || 0);
      const displayQuantity =
        brand === 'kivos'
          ? Number(
              line.packageQuantity ??
                (quantityUnits && Number(line.packageSize || 1)
                  ? quantityUnits / Number(line.packageSize || 1)
                  : quantityUnits)
            )
          : quantityUnits;
      items += displayQuantity;
    }
    const totals = computeOrderTotals({
      lines: orderLines,
      brand,
      paymentMethod,
      customer: orderCustomer,
    });
    const netAfterDiscount = totals.net - (totals.discount || 0);
    return { totalItems: items, totalValue: Number(netAfterDiscount.toFixed(2)) };
  }, [orderLines, brand, paymentMethod, orderCustomer]);

  const goNext = () => {
    if (totalItems > 0) navigation.navigate('OrderReviewScreen');
  };

  const searchIndex = useMemo(() => {
    const idx = new Map();
    for (const p of products) {
      try {
        const s = Object.values(p || {})
          .flatMap((v) => {
            if (v == null) return [];
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return [String(v)];
            if (Array.isArray(v)) return v.map((x) => (x == null ? '' : String(x)));
            if (typeof v === 'object') return [JSON.stringify(v)];
            return [];
          })
          .join(' ')
          .toLowerCase();
        idx.set(p, s);
      } catch {}
    }
    return idx;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    const out = [];
    for (const p of products) {
      if ((searchIndex.get(p) || '').includes(q)) out.push(p);
    }
    return out;
  }, [products, search, searchIndex]);

  const groupedListData = useMemo(() => {
    const isSearching = search.trim().length > 0;
    const isCollapsed = (key) => {
      if (!key) return false;
      if (isSearching) {
        return Boolean(searchCollapsed[key]);
      }
      return !Boolean(expandedNodes[key]);
    };

    const rows = [];
    if (!filteredProducts?.length) {
      return rows;
    }

    if (brand === 'john') {
      const sheetMap = new Map();
      for (const product of filteredProducts) {
        const sheet = sheetCategoryOf(product);
        const sheetKey = makeNodeKey('sheet', sheet);
        if (!sheetMap.has(sheetKey)) {
          sheetMap.set(sheetKey, { id: sheetKey, title: sheet, count: 0, generals: new Map() });
        }
        const sheetNode = sheetMap.get(sheetKey);
        sheetNode.count += 1;

        const general = generalCategoryOf(product);
        const generalKey = makeNodeKey('sheet', sheet, 'general', general);
        if (!sheetNode.generals.has(generalKey)) {
          sheetNode.generals.set(generalKey, { id: generalKey, title: general, count: 0, subs: new Map() });
        }
        const generalNode = sheetNode.generals.get(generalKey);
        generalNode.count += 1;

        const sub = subCategoryOf(product);
        const subKey = makeNodeKey('sheet', sheet, 'general', general, 'sub', sub);
        if (!generalNode.subs.has(subKey)) {
          generalNode.subs.set(subKey, { id: subKey, title: sub, items: [] });
        }
        generalNode.subs.get(subKey).items.push(product);
      }

      const sheetNodes = Array.from(sheetMap.values()).sort((a, b) => a.title.localeCompare(b.title));
      for (const sheetNode of sheetNodes) {
        const sheetCollapsed = isCollapsed(sheetNode.id);
        rows.push({
          type: 'header',
          id: sheetNode.id,
          title: sheetNode.title,
          count: sheetNode.count,
          collapsed: sheetCollapsed,
          level: 1,
        });
        if (sheetCollapsed) {
          continue;
        }

        const generalNodes = Array.from(sheetNode.generals.values()).sort((a, b) =>
          a.title.localeCompare(b.title)
        );
        for (const generalNode of generalNodes) {
          const generalCollapsed = isCollapsed(generalNode.id);
          rows.push({
            type: 'header',
            id: generalNode.id,
            title: generalNode.title,
            count: generalNode.count,
            collapsed: generalCollapsed,
            level: 2,
          });
          if (generalCollapsed) {
            continue;
          }

          const subNodes = Array.from(generalNode.subs.values()).sort((a, b) =>
            a.title.localeCompare(b.title)
          );
          for (const subNode of subNodes) {
            const subCollapsed = isCollapsed(subNode.id);
            rows.push({
              type: 'header',
              id: subNode.id,
              title: subNode.title,
              count: subNode.items.length,
              collapsed: subCollapsed,
              level: 3,
            });
            if (subCollapsed) {
              continue;
            }
            const sortedItems = subNode.items.slice().sort((a, b) => codeOf(a).localeCompare(codeOf(b)));
            for (const product of sortedItems) {
              rows.push({ type: 'item', parent: subNode.id, product });
            }
          }
        }
      }
      return rows;
    }

    if (brand === 'kivos') {
      const supplierMap = new Map();
      for (const product of filteredProducts) {
        const supplier = supplierBrandOf(product);
        const supplierKey = makeNodeKey('supplier', supplier);
        if (!supplierMap.has(supplierKey)) {
          supplierMap.set(supplierKey, { id: supplierKey, title: supplier, count: 0, categories: new Map() });
        }
        const supplierNode = supplierMap.get(supplierKey);
        supplierNode.count += 1;

        const category = kivosCategoryOf(product);
        const categoryKey = makeNodeKey('supplier', supplier, 'category', category);
        if (!supplierNode.categories.has(categoryKey)) {
          supplierNode.categories.set(categoryKey, { id: categoryKey, title: category, items: [] });
        }
        supplierNode.categories.get(categoryKey).items.push(product);
      }

      const supplierNodes = Array.from(supplierMap.values()).sort((a, b) =>
        a.title.localeCompare(b.title)
      );
      for (const supplierNode of supplierNodes) {
        const supplierCollapsed = isCollapsed(supplierNode.id);
        rows.push({
          type: 'header',
          id: supplierNode.id,
          title: supplierNode.title,
          count: supplierNode.count,
          collapsed: supplierCollapsed,
          level: 1,
        });
        if (supplierCollapsed) {
          continue;
        }

        const categoryNodes = Array.from(supplierNode.categories.values()).sort((a, b) =>
          a.title.localeCompare(b.title)
        );
        for (const categoryNode of categoryNodes) {
          const categoryCollapsed = isCollapsed(categoryNode.id);
          rows.push({
            type: 'header',
            id: categoryNode.id,
            title: categoryNode.title,
            count: categoryNode.items.length,
            collapsed: categoryCollapsed,
            level: 2,
          });
          if (categoryCollapsed) {
            continue;
          }
          const sortedItems = categoryNode.items.slice().sort((a, b) => codeOf(a).localeCompare(codeOf(b)));
          for (const product of sortedItems) {
            rows.push({ type: 'item', parent: categoryNode.id, product });
          }
        }
      }
      return rows;
    }

    // Default (Playmobil and others): group by playing theme
    const themeMap = new Map();
    for (const product of filteredProducts) {
      const theme = playingThemeOf(product);
      const themeKey = makeNodeKey('theme', theme);
      if (!themeMap.has(themeKey)) {
        themeMap.set(themeKey, { id: themeKey, title: theme, items: [], minPage: Number.POSITIVE_INFINITY });
      }
      const entry = themeMap.get(themeKey);
      entry.items.push(product);
      entry.minPage = Math.min(entry.minPage, cataloguePageOf(product));
    }

    const sortedThemes = Array.from(themeMap.values());
    sortedThemes.sort((a, b) => {
      const aFinite = Number.isFinite(a.minPage);
      const bFinite = Number.isFinite(b.minPage);
      if (aFinite && bFinite && a.minPage !== b.minPage) return a.minPage - b.minPage;
      if (aFinite !== bFinite) return aFinite ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    for (const themeNode of sortedThemes) {
      const themeCollapsed = isCollapsed(themeNode.id);
      const sortedItems = themeNode.items.slice().sort((a, b) => codeOf(a).localeCompare(codeOf(b)));
      rows.push({
        type: 'header',
        id: themeNode.id,
        title: themeNode.title,
        count: sortedItems.length,
        collapsed: themeCollapsed,
        level: 1,
      });
      if (!themeCollapsed) {
        for (const product of sortedItems) {
          rows.push({ type: 'item', parent: themeNode.id, product });
        }
      }
    }

    return rows;
  }, [filteredProducts, expandedNodes, searchCollapsed, search, brand, makeNodeKey]);

  const toggleNode = (key) => {
    if (!key) return;
    const isSearching = search.trim().length > 0;
    if (isSearching) {
      setSearchCollapsed((prev = {}) => {
        const next = { ...prev };
        if (next[key]) {
          delete next[key];
        } else {
          next[key] = true;
        }
        return next;
      });
    } else {
      setExpandedNodes((prev = {}) => {
        const next = { ...prev };
        if (next[key]) {
          delete next[key];
        } else {
          next[key] = true;
        }
        return next;
      });
    }
  };

  const handleExpandAll = () => {
    const isSearching = search.trim().length > 0;
    if (isSearching) {
      setSearchCollapsed({});
    } else {
      const map = {};
      for (const row of groupedListData) {
        if (row?.type === 'header' && row.id) {
          map[row.id] = true;
        }
      }
      setExpandedNodes(map);
    }
  };

  const handleCollapseAll = () => {
    const isSearching = search.trim().length > 0;
    if (isSearching) {
      const map = {};
      for (const row of groupedListData) {
        if (row?.type === 'header' && row.id) {
          map[row.id] = true;
        }
      }
      setSearchCollapsed(map);
    } else {
      setExpandedNodes({});
    }
  };

  const openProductDetails = (product) => {
    if (!product) return;
    const normalized = { ...product };
    const resolvedBrand = normalizeBrandKey(product?.brand || brand);
    if (!normalized.brand) normalized.brand = resolvedBrand;
    const code = codeOf(product);
    if (code && !normalized.productCode) normalized.productCode = code;
    const description = descOf(product);
    if (description && !normalized.description) normalized.description = description;
    const wholesalePrice = wholesaleOf(product);
    if (Number.isFinite(wholesalePrice) && normalized.wholesalePrice == null) normalized.wholesalePrice = wholesalePrice;
    const srpValue = srpOf(product);
    if (srpValue != null && normalized.srp == null) normalized.srp = srpValue;
    const stockValue = stockOf(product);
    if (stockValue != null) normalized.availableStock = stockValue;
    const themeValue = playingThemeOf(product);
    if (themeValue && !normalized.playingTheme) normalized.playingTheme = themeValue;
    navigation.push('ProductDetail', { product: normalized, brand: resolvedBrand, fromOrderFlow: true });
  };

  const renderRow = ({ item, index }) => {
    if (item?.type === 'header') {
      const level = item.level || 1;
      const headerStyle = [
        styles.sectionHeader,
        level === 2 && styles.sectionHeaderLevel2,
        level >= 3 && styles.sectionHeaderLevel3,
      ].filter(Boolean);
      return (
        <TouchableOpacity
          onPress={() => toggleNode(item.id)}
          style={headerStyle}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionHeaderTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.sectionHeaderMeta}>
            <Text style={styles.sectionHeaderCount}>({item.count})</Text>
            <Text style={styles.sectionHeaderIndicator}>{item.collapsed ? '>' : 'v'}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    const product = item?.product;
    if (!product) return null;

    const code = codeOf(product);
    const q = getQty(code);

    const wholesalePrice = Number(wholesaleOf(product) || 0);
    const srp = srpOf(product);
    const isKivosBrand = brand === 'kivos';
    const isJohnBrand = brand === 'john';
    const offerPrice = isKivosBrand ? offerOf(product) : null;
    const hasOfferPrice = isKivosBrand && Number.isFinite(offerPrice) && offerPrice > 0;
    const rawPackageSize = isKivosBrand || isJohnBrand ? packageSizeOf(product) : 1;
    const roundedPackageSize =
      isKivosBrand || isJohnBrand
        ? Math.max(1, Math.round(Number(rawPackageSize || 1)))
        : 1;
    const fallbackPackageLabel = isKivosBrand || isJohnBrand ? packageLabelOf(product, rawPackageSize) : '';
    const packageLabel =
      isKivosBrand || isJohnBrand
        ? roundedPackageSize > 0
          ? `${roundedPackageSize} τεμ.`
          : fallbackPackageLabel
        : '';
    const displayWholesalePrice = Number.isFinite(wholesalePrice) ? wholesalePrice : 0;
    const displayOfferPrice = hasOfferPrice ? Number(offerPrice) : null;
    const displaySrp = srp != null && Number.isFinite(Number(srp)) ? Number(srp) : null;
    const stock = stockOf(product);
    const stockDisplay = stock != null ? String(stock) : 'n/a';
    const isStockNA = stockDisplay === 'n/a';

    return (
      <View style={styles.card}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TouchableOpacity
            onPress={() => openProductDetails(product)}
            activeOpacity={0.85}
            style={{ minWidth: 0 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
              <Text style={styles.code}>{code}</Text>
              <Text style={styles.desc} numberOfLines={1} ellipsizeMode="tail"> {' '} {descOf(product)}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 4, flexWrap: 'wrap' }}>
              <Text style={styles.subInfo}>
                Χ.Τ.: <Text style={{ fontWeight: 'bold' }}>{`€${displayWholesalePrice.toFixed(2)}`}</Text>
              </Text>
              {hasOfferPrice ? (
                <Text style={styles.subInfo}>
                  {' '}| Προσφορά: <Text style={{ fontWeight: 'bold' }}>{`€${displayOfferPrice.toFixed(2)}`}</Text>
                </Text>
              ) : null}
              {displaySrp != null ? (
                <Text style={styles.subInfo}>
                  {' '}| Π.Λ.Τ.: <Text style={{ fontWeight: 'bold' }}>{`€${displaySrp.toFixed(2)}`}</Text>
                </Text>
              ) : null}
              {isKivosBrand || isJohnBrand ? (
                packageLabel ? (
                  <Text style={styles.subInfo}>
                    {' '}| Συσκευασία: <Text style={{ fontWeight: 'bold' }}>{packageLabel}</Text>
                  </Text>
                ) : null
              ) : (
                <Text style={styles.subInfo}>
                  {' '}| Απόθεμα:{' '}
                  <Text style={[styles.stockValueText, isStockNA && styles.stockValueNA]}>{stockDisplay}</Text>
                </Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.qtyRow}>
            <TouchableOpacity onPress={() => decrement(product)} style={styles.qtyTouch}><Text style={styles.qtyBtn}>-</Text></TouchableOpacity>
            <TextInput
              style={styles.qtyInput}
              keyboardType="numeric"
              value={String(q)}
              onChangeText={(v) => setQty(product, Math.max(0, parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0))}
              maxLength={4}
              placeholder="0"
              placeholderTextColor="#bbb"
              returnKeyType="done"
              blurOnSubmit
              selectTextOnFocus
              onFocus={() => ensureVisible(index)}
            />
            <TouchableOpacity onPress={() => increment(product)} style={styles.qtyTouch}><Text style={styles.qtyBtn}>+</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.headerBackButton}
            activeOpacity={0.8}
            onPress={handleGoBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Επιλογή προϊόντων</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setSearchCollapsed({});
            }}
            placeholder="Αναζήτηση..."
            placeholderTextColor="#0a2479ff"
            style={[styles.searchInput, styles.searchInputOverride]}
            returnKeyType="search"
          />
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={handleExpandAll} style={styles.headerBtn} activeOpacity={0.85}>
              <Text style={styles.headerBtnText}>Άνοιξε όλα</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCollapseAll} style={styles.headerBtn} activeOpacity={0.85}>
              <Text style={styles.headerBtnText}>Κλείσε όλα</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {loading ? (
          <ActivityIndicator size="large" color="#1976d2" style={{ marginTop: 24 }} />
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={groupedListData}
              keyExtractor={(row, idx) => {
                if (row?.type === 'header') return `header-${row?.id || idx}`;
                const product = row?.product;
                const code = codeOf(product);
                return `item-${code || idx}`;
              }}
              renderItem={renderRow}
              contentContainerStyle={{ padding: 12, paddingBottom: 160 + (Platform.OS === 'android' ? kbPad : 0) }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 24 }}>
                  Η αναζήτηση δεν βρήκε προϊόντα
                </Text>
              }
            />

            <View style={[styles.fabWrap, { bottom: Math.max(insets.bottom + 16, 16) + (Platform.OS === 'android' ? kbPad : 0) }]}>
              <TouchableOpacity disabled={totalItems <= 0} onPress={goNext} activeOpacity={0.9} style={[styles.fab, totalItems <= 0 && styles.fabDisabled]}>
                <Text style={styles.fabText}>Σύνολο | {totalItems} τεμ. | €{totalValue.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },
  header: { backgroundColor: '#1976d2', paddingHorizontal: 16, paddingVertical: 10 },
  headerText: { flex: 1, color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerBackButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerSpacer: { width: 42 },

  searchRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchInputOverride: { fontWeight: '700', color: '#000' },
  headerButtons: { flexDirection: 'row', marginLeft: 8 },
  headerBtn: { backgroundColor: '#1565c0', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginLeft: 6 },
  headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  sectionHeader: { backgroundColor: '#e8f1ff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderLevel2: { marginLeft: 10, paddingHorizontal: 18, backgroundColor: '#f1f6ff' },
  sectionHeaderLevel3: { marginLeft: 20, paddingHorizontal: 20, backgroundColor: '#f7faff' },
  sectionHeaderTitle: { color: '#0d47a1', fontSize: 15.5, fontWeight: '700', flex: 1, marginRight: 12 },
  sectionHeaderMeta: { flexDirection: 'row', alignItems: 'center' },
  sectionHeaderCount: { color: '#0d47a1', fontSize: 13, fontWeight: '600', marginRight: 8 },
  sectionHeaderIndicator: { color: '#0d47a1', fontSize: 15, fontWeight: '700' },

  card: { backgroundColor: '#fafdff', borderRadius: 12, padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#1976d2', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, minHeight: 74 },
  code: { color: '#1565c0', fontWeight: 'bold', fontSize: 15, flexShrink: 0 },
  desc: { color: '#1976d2', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  subInfo: { color: '#555', fontSize: 13, marginRight: 6 },
  stockValueText: { fontWeight: 'bold', color: '#0d47a1' },
  stockValueNA: { color: '#d32f2f' },

  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#fff', borderRadius: 8, minHeight: 36, minWidth: 96, paddingHorizontal: 4, borderWidth: 1.3, borderColor: '#1976d2', alignSelf: 'flex-start' },
  qtyTouch: { paddingHorizontal: 6, paddingVertical: 4 },
  qtyBtn: { fontSize: 22, color: '#1976d2', fontWeight: 'bold' },
  qtyInput: { width: 40, height: 32, textAlign: 'center', fontSize: 17, color: '#111', marginHorizontal: 3, backgroundColor: '#f5fafd', borderRadius: 5, fontWeight: 'bold', paddingVertical: 0, paddingHorizontal: 0 },

  fabWrap: { position: 'absolute', right: 16, left: 16, alignItems: 'flex-end' },
  fab: { backgroundColor: '#1976d2', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 28, elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  fabDisabled: { opacity: 0.5 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 15.5 },
});