// src/screens/SuperMarketProductSelectionScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Keyboard,
  Image,
  Alert,
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import { useOrder } from "../context/OrderContext";
import { fetchSuperMarketListings, fetchBrandProductsByCodes } from "../services/supermarketData";
import { getStoreInventory } from "../services/supermarketInventory";
import { normalizeBrandKey } from "../constants/brands";
import {
  getProductByCode,
  getStockByCode,
  toNumberSafe,
  canonicalCode,
} from "../utils/codeNormalization";

const STORE_LOGOS = {
  masoutis: require("../../assets/masoutis_logo.png"),
  sklavenitis: require("../../assets/sklavenitis_logo.png"),
};

const detectStoreKey = (store) => {
  const name = (store?.companyName || store?.storeName || "").toLowerCase();
  if (name.includes("μασουτ") || name.includes("masout")) return "masoutis";
  if (name.includes("σκλαβεν") || name.includes("sklavenit")) return "sklavenitis";
  return null;
};

// ✅ Normalize Greek category codes
const normalizeCategory = (value) => {
  if (!value) return "";
  return String(value).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const normalizeSearchText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export default function SuperMarketProductSelectionScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);

  const orderCtx = useOrder();
  const orderLines = Array.isArray(orderCtx.orderLines) ? orderCtx.orderLines : [];
  const setOrderLines = orderCtx.setOrderLines || (() => {});

  const { store, brand } = route?.params || {};
  const normalizedBrand = useMemo(() => normalizeBrandKey(brand || "john"), [brand]);

  const handleBackToStoreSelect = useCallback(() => {
    navigation.navigate('BrandHome', { brand: normalizedBrand });
  }, [navigation, normalizedBrand]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (event.data.action?.type === 'GO_BACK') {
          event.preventDefault();
          handleBackToStoreSelect();
        }
      });
      return () => unsubscribe();
    }, [handleBackToStoreSelect, navigation])
  );

  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [inventory, setInventory] = useState({});
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [error, setError] = useState(null);
  const [kbPad, setKbPad] = useState(0);
  const [noListingsMessage, setNoListingsMessage] = useState(null);

  const storeKey = detectStoreKey(store);

  // Fetch data
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        console.log("🔍 [SuperMarket Selection] ========== START ==========");
        console.log("📦 Store Raw Data:", JSON.stringify(store, null, 2));
        console.log("🏷️  Brand:", normalizedBrand);
        
        const rawListings = await fetchSuperMarketListings(normalizedBrand);
        console.log("📋 Total listings fetched:", rawListings.length);

        if (rawListings.length) {
          const sampleListing = rawListings[0];
          console.log("📝 Listing sample:", {
            productCode: sampleListing?.productCode,
            masterCode: sampleListing?.masterCode,
            storeCode: store.storeCode,
          });
        } else {
          console.log("⚠️ No listings returned for brand:", normalizedBrand);
        }

        // ✅ Normalize store categories
        const storeCat = normalizeCategory(store?.storeCategory || store?.hasToys || store?.category || "");
        const summerType = normalizeCategory(store?.hasSummerItems || "");
        const isSummerStore = !!summerType;

        console.log("🏪 Store Category (normalized):", storeCat);
        console.log("☀️  Summer Type (normalized):", summerType);
        console.log("🌞 Is Summer Store:", isSummerStore);

        // ✅ Toy category matching (Α, Β, Γ, Δ)
        const matchesToys = (p) => {
          console.log(`  🧸 Checking toy match for ${p.productCode}:`, {
            storeCat,
            isAActive: p.isAActive,
            isBActive: p.isBActive,
            isCActive: p.isCActive,
            isActive: p.isActive,
          });

          if (storeCat === "Α" || storeCat === "A") return p.isAActive === true;
          if (storeCat === "Β" || storeCat === "B") return p.isBActive === true;
          if (storeCat === "Γ" || storeCat === "C" || storeCat === "G") return p.isCActive === true;
          if (/^[ΔDEEZ]/.test(storeCat)) return p.isActive === true;
          return false;
        };

        // ✅ Summer category matching
        const matchesSummer = (p) => {
          if (!isSummerStore) return false;

          console.log(`  ☀️ Checking summer match for ${p.productCode}:`, {
            summerType,
            isSummerActiveGrand: p.isSummerActiveGrand,
            isSummerActiveMegalaPlus: p.isSummerActiveMegalaPlus,
            isSummerActiveMegala: p.isSummerActiveMegala,
            isSummerActiveMesaia: p.isSummerActiveMesaia,
            isSummerActiveMikra: p.isSummerActiveMikra,
          });

          if (summerType.includes("GRAND")) return p.isSummerActiveGrand === true;
          if (summerType.includes("PLUS")) return p.isSummerActiveMegalaPlus === true;
          if (summerType.includes("ΜΕΓΑΛΑ") || summerType.includes("ΜΕΓΑΛ")) return p.isSummerActiveMegala === true;
          if (summerType.includes("ΜΕΣΑΙΑ") || summerType.includes("ΜΕΣ")) return p.isSummerActiveMesaia === true;
          if (summerType.includes("ΜΙΚΡΑ") || summerType.includes("ΜΙΚΡ")) return p.isSummerActiveMikra === true;
          return false;
        };

        const filtered = rawListings.filter((p) => {
          const toyMatch = matchesToys(p);
          const summerMatch = matchesSummer(p);
          const matches = toyMatch || summerMatch;
          
          if (matches) {
            console.log(`✅ Product ${p.productCode} matches! (toy: ${toyMatch}, summer: ${summerMatch})`);
          }
          
          return matches;
        });

        console.log("✅ Filtered listings count:", filtered.length);
        
        const listingSummaryFor = (listing) => ({
          storeCode: store?.storeCode || null,
          storeName: store?.storeName || null,
          category: listing?.productCategory || null,
          listingId: listing?.id || `${store?.storeCode || 'store'}_${listing?.productCode || 'code'}`,
          packaging: listing?.packaging || null,
          price: toNumberSafe(listing?.price, null),
          isNew: Boolean(listing?.isNew),
          brand: normalizedBrand,
        });

        const findBaseProduct = (listing, productMap) => {
          if (!listing || !productMap || productMap.size === 0) {
            return null;
          }
          const candidates = [
            listing.productCode,
            listing.masterCode,
            listing.displayProductCode,
            listing.code,
          ];
          for (const candidate of candidates) {
            if (!candidate) continue;
            const raw = String(candidate).trim();
            if (!raw) continue;
            const upper = raw.toUpperCase();
            if (productMap.has(upper)) {
              return productMap.get(upper);
            }
            const canon = canonicalCode(raw);
            if (canon && productMap.has(canon)) {
              return productMap.get(canon);
            }
          }
          return null;
        };

        let enrichedListings = filtered;

        if (filtered.length && normalizedBrand === "john") {
          try {
            const lookupCodes = Array.from(
              new Set(
                filtered
                  .flatMap((item) => [
                    item?.productCode,
                    item?.masterCode,
                    item?.displayProductCode,
                  ])
                  .filter((code) => typeof code === "string" && code.trim().length > 0)
              )
            );

            const productMap = await fetchBrandProductsByCodes(normalizedBrand, lookupCodes);

            enrichedListings = filtered.map((listing) => {
              const baseProduct = findBaseProduct(listing, productMap);
              const summary = listingSummaryFor(listing);

              const baseListingsRaw = baseProduct
                ? [
                    ...(Array.isArray(baseProduct.activeSupermarketListings)
                      ? baseProduct.activeSupermarketListings
                      : []),
                    ...(Array.isArray(baseProduct.supermarketListings)
                      ? baseProduct.supermarketListings
                      : []),
                  ]
                : [];

              const combinedListings = [...baseListingsRaw, summary];
              const dedupedListings = [];
              const seen = new Set();
              combinedListings.forEach((entry) => {
                if (!entry) return;
                const key = [
                  entry.storeCode || "",
                  entry.category || "",
                  entry.listingId || entry.productCode || entry.code || "",
                ].join("|");
                if (seen.has(key)) {
                  return;
                }
                seen.add(key);
                dedupedListings.push(entry);
              });

              if (!baseProduct) {
                return {
                  ...listing,
                  srp: toNumberSafe(
                    listing?.srp ??
                      (listing?.price != null ? listing.price * 1.24 : 0),
                    0
                  ),
                  activeSupermarketListings: dedupedListings,
                  baseProduct: null,
                };
              }

              const mergedWholesale = toNumberSafe(
                baseProduct.wholesalePrice ??
                  listing.price ??
                  baseProduct.price,
                toNumberSafe(listing.price, 0)
              );

              const mergedPrice = toNumberSafe(
                listing.price ?? baseProduct.wholesalePrice ?? baseProduct.price,
                mergedWholesale
              );

              const mergedSrp = toNumberSafe(
                baseProduct.srp ??
                  listing.srp ??
                  (listing.price != null ? listing.price * 1.24 : 0),
                0
              );

              return {
                ...baseProduct,
                ...listing,
                description: baseProduct.description || listing.description,
                wholesalePrice: mergedWholesale,
                price: mergedPrice,
                srp: mergedSrp,
                packaging: listing.packaging || baseProduct.packaging,
                barcode: listing.barcode || baseProduct.barcode,
                photoUrl:
                  listing.photoUrl ||
                  baseProduct.photoUrl ||
                  baseProduct.imageUrl,
                baseProduct,
                activeSupermarketListings: dedupedListings,
              };
            });
          } catch (mergeError) {
            console.warn("[SuperMarket] Failed to merge base product info:", mergeError);
            enrichedListings = filtered.map((listing) => ({
              ...listing,
              srp: toNumberSafe(
                listing?.srp ??
                  (listing?.price != null ? listing.price * 1.24 : 0),
                0
              ),
              activeSupermarketListings: [listingSummaryFor(listing)],
              baseProduct: null,
            }));
          }
        } else {
          enrichedListings = filtered.map((listing) => ({
            ...listing,
            srp: toNumberSafe(
              listing?.srp ?? (listing?.price != null ? listing.price * 1.24 : 0),
              0
            ),
            activeSupermarketListings: [listingSummaryFor(listing)],
            baseProduct: null,
          }));
        }

        if (enrichedListings.length > 0) {
          console.log(
            "📄 First 3 matching products:",
            enrichedListings.slice(0, 3).map((p) => ({
              code: p.productCode,
              desc: p.description,
              category: p.productCategory,
              merged: Boolean(p.baseProduct),
            }))
          );
        }

        let msg = null;
        if (!enrichedListings.length) {
          const toyLabelRaw = store?.hasToys ?? store?.storeCategory ?? "?";
          const summerLabelRaw = store?.hasSummerItems ?? "";
          const toyLabel = String(toyLabelRaw ?? "-").trim() || "-";
          const summerLabel = String(summerLabelRaw ?? "-").trim() || "-";
          msg = `Το κατάστημα ${store?.storeCode || ""} ${store?.storeName || ""} με κατηγορία παιχνιδιών ${toyLabel} και κατηγορία καλοκαιρινών ${summerLabel} δεν έχει ενεργά προϊόντα στη λίστα του.`.trim();
          console.warn(msg);
          console.log("⚠️ Debug: Sample listing flags:", rawListings[0]);
        }

        console.log("📦 Loading inventory for store:", store.storeCode);
        const inv = await getStoreInventory(store.storeCode);
        const inventoryKeys = Object.keys(inv);
        console.log("📦 Inventory loaded:", inventoryKeys.length, "items");
        
        if (inventoryKeys.length === 0) {
          console.log("⚠️ Inventory empty for store:", store.storeCode, "brand:", normalizedBrand);
        } else {
          const sampleKey = inventoryKeys[0];
          console.log("📦 Sample inventory entry:", { key: sampleKey, entry: inv[sampleKey] });
        }
        
        const orderDoc = await firestore()
          .collection("supermarket_meta")
          .doc("category_order")
          .get();

        if (mounted) {
          setListings(enrichedListings);
          setInventory(inv);
          setCategoryOrder(orderDoc.exists ? orderDoc.data().order || [] : []);
          const expand = {};
          enrichedListings.forEach((p) => (expand[p.productCategory || "Άλλα"] = true));
          setExpandedCategories(expand);
          setNoListingsMessage(msg);
        }

        console.log("🔍 [SuperMarket Selection] ========== END ==========", {
          storeCode: store.storeCode,
          listings: filtered.length,
          inventory: inventoryKeys.length,
        });
      } catch (err) {
        console.error("❌ [SuperMarket] loadData error:", err);
        console.error("Stack:", err.stack);
        if (mounted) setError("Αδυναμία φόρτωσης δεδομένων");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => (mounted = false);
  }, [store, normalizedBrand]);

  // Keyboard adjust
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setKbPad(e?.endCoordinates?.height || 0)
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setKbPad(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const filteredListings = useMemo(() => {
    if (!searchValue) return listings;
    const query = normalizeSearchText(searchValue);
    if (!query) return listings;

    const tokens = query.split(/\s+/).filter(Boolean);
    if (!tokens.length) return listings;

    return listings.filter((item) => {
      const searchPool = [
        item.displayProductCode,
        item.productCode,
        item.masterCode,
        item.description,
        item.productCategory,
        item.category,
        item.categoryPath,
        item.brand,
        item.subBrand,
        item.packaging,
        item.barcode,
        item.supplierCode,
        item.supplier,
      ];

      if (Array.isArray(item.tags)) {
        searchPool.push(item.tags.join(" "));
      }
      if (Array.isArray(item.keywords)) {
        searchPool.push(item.keywords.join(" "));
      }
      if (item.attributes && typeof item.attributes === "object") {
        Object.values(item.attributes).forEach((val) => {
          if (val) searchPool.push(val);
        });
      }

      const combined = searchPool
        .filter(Boolean)
        .map((val) => normalizeSearchText(val))
        .join(" ");

      if (!combined) return false;
      return tokens.every((token) => combined.includes(token));
    });
  }, [listings, searchValue]);
  // Group products
  const groupedProducts = useMemo(() => {
    const groups = {};
    filteredListings.forEach((l) => {
      const cat = l.productCategory || "Άλλα";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({
        ...l,
        currentStock: getStockByCode(l.productCode, inventory),
        srp: toNumberSafe(
          l.srp ?? (l.price != null ? l.price * 1.24 : 0),
          0
        ),
      });
    });
    const sorted = {};
    const order = categoryOrder.length ? categoryOrder : Object.keys(groups).sort();
    order.forEach((c) => {
      if (groups[c]) sorted[c] = groups[c];
    });
    console.log("📊 Grouped products:", Object.keys(sorted).map(k => `${k}: ${sorted[k].length}`).join(", "));
    return sorted;
  }, [filteredListings, inventory, categoryOrder]);

  const qtyFor = useMemo(() => {
    const map = new Map();
    orderLines.forEach((l) => map.set(l.productCode, toNumberSafe(l.quantity, 0)));
    return map;
  }, [orderLines]);

  const updateQuantity = (code, newQty) => {
    const quantity = Math.max(0, toNumberSafe(newQty, 0));
    console.log(`📝 Update quantity: ${code} -> ${quantity}`);
    
    setOrderLines((prev) => {
      const idx = prev.findIndex((l) => l.productCode === code);
      if (quantity === 0) return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
      
      const product = getProductByCode(code, listings);
      if (!product) {
        console.warn(`⚠️ Product not found: ${code}`);
        return prev;
      }
      
      const wholesale = toNumberSafe(product.price, 0);
      const newLine = {
        productCode: code,
        displayProductCode: product.displayProductCode || product.productCode || code,
        description: product.description,
        price: wholesale,
        wholesalePrice: wholesale,
        quantity,
        packaging: product.packaging,
        currentStock: getStockByCode(code, inventory),
        photoUrl: product.photoUrl,
        barcode: product.barcode,
        suggestedQty: product.suggestedQty,
        isNew: product.isNew,
        srp: wholesale * 1.24,
      };
      
      if (idx >= 0) {
        const up = [...prev];
        up[idx] = newLine;
        return up;
      }
      return [...prev, newLine];
    });
  };

  const handleExpandAll = () => {
    const map = {};
    Object.keys(groupedProducts).forEach((cat) => (map[cat] = true));
    setExpandedCategories(map);
  };
  
  const handleCollapseAll = () => {
    const map = {};
    Object.keys(groupedProducts).forEach((cat) => (map[cat] = false));
    setExpandedCategories(map);
  };

  const handleContinue = () => {
    if (orderLines.length === 0) {
      Alert.alert(
        "Κενή παραγγελία",
        "Δεν έχετε επιλέξει κανένα προϊόν. Θέλετε να συνεχίσετε;",
        [
          { text: "Όχι", style: "cancel" },
          { 
            text: "Ναι", 
            onPress: () => {
              navigation.navigate("SuperMarketOrderReview", {
                store,
                orderId: route?.params?.orderId,
                brand: normalizedBrand,
              });
            }
          },
        ]
      );
      return;
    }

    navigation.navigate("SuperMarketOrderReview", {
      store,
      orderId: route?.params?.orderId,
      brand: normalizedBrand,
    });
  };

  const goToStoreSelection = useCallback(() => {
    navigation.navigate("SuperMarketOrderFlow", { brand: normalizedBrand });
  }, [navigation, normalizedBrand]);

  const renderProduct = ({ item }) => {
    const q = qtyFor.get(item.productCode) || 0;
    const displayCode = item.displayProductCode || item.productCode;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => {
          console.log("🔗 Navigate to ProductDetail:", item.productCode);
          navigation.push("ProductDetail", {
            product: item,
            brand: normalizedBrand,
            fromListing: true,
            fromOrderFlow: true,
          });
        }}
      >
        <Image
          source={{ uri: item.photoUrl }}
          style={styles.productImage}
          resizeMode="contain"
        />
        <View style={styles.productCenter}>
          <Text style={styles.productTitle} numberOfLines={1}>
            {displayCode} – {item.description}
          </Text>
          <Text style={styles.subInfo}>
            Απόθεμα: <Text style={styles.bold}>{item.currentStock ?? "n/a"}</Text> | Π.Λ.Τ.:{" "}
            <Text style={styles.bold}>{item.srp.toFixed(2)}€</Text> | Συσκ:{" "}
            <Text style={styles.bold}>{item.packaging || "-"}</Text>
          </Text>
        </View>
        <View style={styles.qtyBox}>
          <TouchableOpacity
            onPress={() => updateQuantity(item.productCode, q - 1)}
            style={styles.qtyBtn}
          >
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.qtyInput}
            keyboardType="numeric"
            value={String(q)}
            selectTextOnFocus
            onChangeText={(v) => updateQuantity(item.productCode, v)}
          />
          <TouchableOpacity
            onPress={() => updateQuantity(item.productCode, q + 1)}
            style={styles.qtyBtn}
          >
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGroup = ({ item }) => {
    const expanded = expandedCategories[item.category] ?? true;
    const items = groupedProducts[item.category] || [];
    return (
      <View>
        <TouchableOpacity
          onPress={() =>
            setExpandedCategories((p) => ({ ...p, [item.category]: !expanded }))
          }
          style={styles.groupHeader}
        >
          <Text style={styles.groupTitle}>
            {item.category} ({items.length})
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#fff"
          />
        </TouchableOpacity>
        {expanded && (
          <FlatList
            data={items}
            keyExtractor={(it) => it.productCode}
            renderItem={renderProduct}
          />
        )}
      </View>
    );
  };

  const categories = Object.keys(groupedProducts).map((category) => ({ category }));

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.storeLine}>
              {store.storeCode} – {store.storeName}
            </Text>
            <Text style={styles.storeSubLine}>
              Κατ: {store.category || "-"} | Παιχνίδια: {store.hasToys || "-"} | Καλοκαιρινά: {store.hasSummerItems || "-"}
            </Text>
          </View>
          {storeKey && (
            <Image source={STORE_LOGOS[storeKey]} style={styles.logo} resizeMode="contain" />
          )}
        </View>
      </View>

      <View style={styles.quickNavRow}>
        <TouchableOpacity
          style={styles.quickNavButton}
          onPress={goToStoreSelection}
          activeOpacity={0.8}
        >
          <Ionicons name="storefront-outline" size={18} color="#1f4f8f" />
          <Text style={styles.quickNavText}>Επιστροφή στην επιλογή καταστήματος</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1976d2" style={{ marginTop: 24 }} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      ) : noListingsMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{noListingsMessage}</Text>
          <TouchableOpacity 
            style={styles.continueAnywayBtn}
            onPress={handleContinue}
          >
            <Text style={styles.continueAnywayText}>Συνέχεια χωρίς προϊόντα</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.controlsRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Αναζήτηση προϊόντων..."
              value={searchValue}
              onChangeText={setSearchValue}
            />
            <TouchableOpacity style={styles.ctrlBtn} onPress={handleExpandAll}>
              <Text style={styles.ctrlBtnText}>+ Όλα</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={handleCollapseAll}>
              <Text style={styles.ctrlBtnText}>− Όλα</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={categories}
            keyExtractor={(i) => i.category}
            renderItem={renderGroup}
            contentContainerStyle={{ paddingBottom: 100 + kbPad }}
            ListEmptyComponent={
              searchValue ? (
                <View style={styles.emptySearchContainer}>
                  <Text style={styles.emptySearchText}>
                    {`Δεν βρέθηκαν προϊόντα για "${(searchValue || "").trim()}".`}
                  </Text>
                </View>
              ) : null
            }
          />

          {/* Floating Continue Button */}
          <TouchableOpacity
            style={[styles.continueBtn, { bottom: insets.bottom + 16 + kbPad }]}
            onPress={handleContinue}
          >
            <Text style={styles.continueBtnText}>
              Συνέχεια ({orderLines.length} προϊόντα)
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f9fb" },
  header: {
    backgroundColor: "#1976d2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#1565c0",
  },
  headerTopRow: { flexDirection: "row", alignItems: "center" },
  quickNavRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  quickNavButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  quickNavText: {
    marginLeft: 6,
    color: "#1f4f8f",
    fontWeight: "600",
    fontSize: 13,
  },
  storeLine: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  storeSubLine: { color: "#e3f2fd", fontSize: 13, marginTop: 2 },
  logo: { width: 60, height: 40, marginLeft: 8 },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#e3f2fd",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    fontSize: 14,
  },
  ctrlBtn: {
    marginLeft: 6,
    backgroundColor: "#1976d2",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ctrlBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  groupHeader: {
    backgroundColor: "#1976d2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  groupTitle: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 4,
    padding: 8,
    elevation: 2,
  },
  productImage: { width: 60, height: 60, marginRight: 8, borderRadius: 6 },
  productCenter: { flex: 1 },
  productTitle: { fontWeight: "bold", color: "#1565c0", fontSize: 13 },
  subInfo: { color: "#444", fontSize: 12, marginTop: 2 },
  bold: { fontWeight: "bold" },
  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: "#1976d2",
    borderRadius: 8,
    overflow: "hidden",
  },
  qtyBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  qtyBtnText: { color: "#1976d2", fontSize: 20, fontWeight: "bold" },
  qtyInput: {
    width: 36,
    textAlign: "center",
    color: "#000",
    fontSize: 14,
    fontWeight: "bold",
    paddingVertical: 0,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 16,
  },
  emptySearchContainer: {
    padding: 24,
    alignItems: "center",
  },
  emptySearchText: {
    color: "#475569",
    fontSize: 14,
    textAlign: "center",
  },
  continueAnywayBtn: {
    backgroundColor: "#64748b",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  continueAnywayText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  continueBtn: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#1976d2",
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  continueBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8,
  },
});



























