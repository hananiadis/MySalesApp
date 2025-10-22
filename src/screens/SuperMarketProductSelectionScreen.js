import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useOrder } from '../context/OrderContext';
import { fetchSuperMarketListings } from '../services/supermarketData';
import { getStoreInventory } from '../services/supermarketInventory';
import { normalizeBrandKey } from '../constants/brands';

const SuperMarketProductSelectionScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  
  const orderCtx = useOrder() || {};
  const orderLines = Array.isArray(orderCtx.orderLines) ? orderCtx.orderLines : [];
  const setOrderLines = typeof orderCtx.setOrderLines === 'function' ? orderCtx.setOrderLines : () => {};
  
  const { store, orderId, brand } = route?.params || {};
  const normalizedBrand = useMemo(() => normalizeBrandKey(brand || 'john'), [brand]);
  
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [inventory, setInventory] = useState({});
  const [searchValue, setSearchValue] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [error, setError] = useState(null);
  const [kbPad, setKbPad] = useState(0);

  // Load data on mount
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      if (!store?.storeCategory) {
        setError('Store category not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('Loading SuperMarket data for store:', store);
        console.log('Store category:', store.storeCategory);
        console.log('Store code:', store.storeCode);
        console.log('Brand:', normalizedBrand);

        // Load listings for the store category
        const rawListings = await fetchSuperMarketListings(normalizedBrand, { onlyActive: true });
        console.log('Raw listings loaded:', rawListings.length);
        
        // Filter by store category (Α, Β, Γ, Δ)
        const categoryListings = rawListings.filter(listing => {
          const storeCategory = store.storeCategory?.toUpperCase();
          console.log('Checking listing:', listing.productCode, 'against store category:', storeCategory);
          console.log('Listing flags:', { isAActive: listing.isAActive, isBActive: listing.isBActive, isCActive: listing.isCActive });
          
          if (storeCategory === 'Α' || storeCategory === 'A') return listing.isAActive;
          if (storeCategory === 'Β' || storeCategory === 'B') return listing.isBActive;
          if (storeCategory === 'Γ' || storeCategory === 'C') return listing.isCActive;
          if (storeCategory === 'Δ' || storeCategory === 'D') return listing.isCActive; // Assuming Δ maps to C for now
          return listing.isActive; // fallback
        });

        console.log('Category listings after filter:', categoryListings.length);

        // Load inventory for the specific store
        const storeInventory = await getStoreInventory(store.storeCode);
        console.log('Store inventory loaded:', Object.keys(storeInventory).length, 'items');

        if (mounted) {
          setListings(categoryListings);
          setInventory(storeInventory);
        }
      } catch (err) {
        console.error('Failed to load SuperMarket data', err);
        if (mounted) {
          setError(`Αδυναμία φόρτωσης των προϊόντων: ${err.message}`);
          setListings([]);
          setInventory({});
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [store, normalizedBrand]);

  // Keyboard handling
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e?.endCoordinates?.height || 0;
      setKbPad(h > 0 ? h : 0);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbPad(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups = {};
    
    listings.forEach(listing => {
      const category = listing.productCategory || listing.category || 'Άλλα';
      if (!groups[category]) {
        groups[category] = [];
      }
      
      const currentStock = inventory[listing.productCode] || 0;
      const suggestedQty = listing.suggestedQty || 0;
      
      groups[category].push({
        ...listing,
        currentStock: Number(currentStock),
        suggestedQty: Number(suggestedQty),
        srp: listing.price ? (listing.price * 1.24).toFixed(2) : null,
      });
    });

    // Sort categories and products within categories
    const sortedGroups = {};
    Object.keys(groups).sort().forEach(category => {
      sortedGroups[category] = groups[category].sort((a, b) => 
        (a.description || '').localeCompare(b.description || '')
      );
    });

    return sortedGroups;
  }, [listings, inventory]);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchValue.trim()) return groupedProducts;
    
    const query = searchValue.toLowerCase().trim();
    const filtered = {};
    
    Object.keys(groupedProducts).forEach(category => {
      const categoryProducts = groupedProducts[category].filter(product => 
        (product.productCode || '').toLowerCase().includes(query) ||
        (product.description || '').toLowerCase().includes(query) ||
        (product.barcode || '').toLowerCase().includes(query)
      );
      
      if (categoryProducts.length > 0) {
        filtered[category] = categoryProducts;
      }
    });
    
    return filtered;
  }, [groupedProducts, searchValue]);

  // Get quantity for a product
  const qtyFor = useMemo(() => {
    const map = new Map();
    orderLines.forEach(line => {
      if (line?.productCode) {
        map.set(line.productCode, Number(line.quantity || 0));
      }
    });
    return map;
  }, [orderLines]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalItems = 0;
    let totalValue = 0;
    
    orderLines.forEach(line => {
      const qty = Number(line.quantity || 0);
      const price = Number(line.price || 0);
      totalItems += qty;
      totalValue += qty * price;
    });
    
    return { totalItems, totalValue };
  }, [orderLines]);

  // Toggle category expansion
  const toggleCategory = useCallback((category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  }, []);

  // Update product quantity
  const updateQuantity = useCallback((productCode, newQty) => {
    const quantity = Math.max(0, Number(newQty) || 0);
    
    setOrderLines(prevLines => {
      const existingIndex = prevLines.findIndex(line => line.productCode === productCode);
      
      if (quantity === 0) {
        // Remove from order if quantity is 0
        if (existingIndex >= 0) {
          return prevLines.filter((_, index) => index !== existingIndex);
        }
        return prevLines;
      }
      
      const product = listings.find(p => p.productCode === productCode);
      if (!product) return prevLines;
      
      const inventoryItem = inventory[productCode];
      const newLine = {
        productCode,
        description: product.description,
        barcode: product.barcode,
        price: Number(product.price || 0),
        quantity,
        packaging: product.packaging,
        srp: product.srp,
        isNew: product.isNew,
        currentStock: inventoryItem?.stockQty || 0,
        suggestedQty: product.suggestedQty || 0,
        masterCode: inventoryItem?.masterCode,
      };
      
      if (existingIndex >= 0) {
        // Update existing line
        const updated = [...prevLines];
        updated[existingIndex] = newLine;
        return updated;
      } else {
        // Add new line
        return [...prevLines, newLine];
      }
    });
  }, [listings, inventory, setOrderLines]);

  // Add all suggested products
  const addAllSuggested = useCallback(() => {
    const suggestedProducts = Object.values(filteredProducts)
      .flat()
      .filter(product => product.suggestedQty > 0);
    
    suggestedProducts.forEach(product => {
      const currentQty = qtyFor.get(product.productCode) || 0;
      if (currentQty === 0) {
        updateQuantity(product.productCode, product.suggestedQty);
      }
    });
  }, [filteredProducts, qtyFor, updateQuantity]);

  // Navigation handlers
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleNext = useCallback(() => {
    navigation.navigate('SuperMarketOrderReview', {
      store,
      orderId,
      brand: normalizedBrand,
    });
  }, [navigation, store, orderId, normalizedBrand]);

  // Render category header
  const renderCategoryHeader = useCallback(({ item: category }) => {
    const isExpanded = expandedCategories[category];
    const products = filteredProducts[category] || [];
    const categoryTotal = products.reduce((sum, product) => {
      const qty = qtyFor.get(product.productCode) || 0;
      return sum + qty;
    }, 0);

    return (
      <TouchableOpacity
        style={styles.categoryHeader}
        onPress={() => toggleCategory(category)}
        activeOpacity={0.7}
      >
        <View style={styles.categoryHeaderContent}>
          <Text style={styles.categoryTitle}>{category}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {products.length} προϊόντα
              {categoryTotal > 0 && ` • ${categoryTotal} τεμ.`}
            </Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#6b7280"
        />
      </TouchableOpacity>
    );
  }, [expandedCategories, filteredProducts, qtyFor, toggleCategory]);

  // Render product row
  const renderProductRow = useCallback(({ item: product }) => {
    const currentQty = qtyFor.get(product.productCode) || 0;
    const stockLevel = product.currentStock;
    const stockColor = stockLevel > 10 ? '#10b981' : stockLevel > 0 ? '#f59e0b' : '#ef4444';
    const inventoryItem = inventory[product.productCode];
    
    return (
      <View style={styles.productRow}>
        <View style={styles.productImageContainer}>
          {product.photoUrl ? (
            <Image source={{ uri: product.photoUrl }} style={styles.productImage} />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Ionicons name="image-outline" size={24} color="#9ca3af" />
            </View>
          )}
        </View>
        
        <View style={styles.productInfo}>
          <Text style={styles.productCode}>{product.productCode}</Text>
          {inventoryItem?.masterCode && (
            <Text style={styles.masterCode}>Κωδ. SuperMarket: {inventoryItem.masterCode}</Text>
          )}
          <Text style={styles.productDescription} numberOfLines={2}>
            {product.description}
          </Text>
          
          <View style={styles.productDetails}>
            <View style={styles.stockContainer}>
              <View style={[styles.stockIndicator, { backgroundColor: stockColor }]} />
              <Text style={styles.stockText}>
                Απόθεμα: {stockLevel} τεμ.
              </Text>
            </View>
            
            {product.suggestedQty > 0 && (
              <Text style={styles.suggestedText}>
                Προτεινόμενη: {product.suggestedQty} τεμ.
              </Text>
            )}
            
            {product.isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>ΝΕΟ</Text>
              </View>
            )}
          </View>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>
              Τιμή: €{product.price?.toFixed(2) || '0.00'}
            </Text>
            {product.srp && (
              <Text style={styles.srpText}>
                Λιανική: €{product.srp}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => updateQuantity(product.productCode, currentQty - 1)}
            disabled={currentQty <= 0}
          >
            <Ionicons name="remove" size={16} color={currentQty > 0 ? "#374151" : "#9ca3af"} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.qtyInput}
            value={currentQty.toString()}
            onChangeText={(text) => updateQuantity(product.productCode, text)}
            keyboardType="numeric"
            selectTextOnFocus
          />
          
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => updateQuantity(product.productCode, currentQty + 1)}
          >
            <Ionicons name="add" size={16} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [qtyFor, updateQuantity]);

  // Render list item
  const renderListItem = useCallback(({ item }) => {
    if (item.type === 'category') {
      return renderCategoryHeader({ item: item.category });
    }
    
    if (item.type === 'product') {
      return renderProductRow({ item: item.product });
    }
    
    return null;
  }, [renderCategoryHeader, renderProductRow]);

  // Build flat list data
  const listData = useMemo(() => {
    const data = [];
    
    Object.keys(filteredProducts).forEach(category => {
      data.push({ type: 'category', category });
      
      if (expandedCategories[category]) {
        const products = filteredProducts[category];
        products.forEach(product => {
          data.push({ type: 'product', product });
        });
      }
    });
    
    return data;
  }, [filteredProducts, expandedCategories]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Επιλογή Προϊόντων</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ActivityIndicator size="large" color="#1976d2" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Επιλογή Προϊόντων</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Πίσω</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Επιλογή Προϊόντων</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.storeInfo}>
        <Text style={styles.storeName}>{store?.storeName}</Text>
        <Text style={styles.storeCode}>Κωδικός: {store?.storeCode}</Text>
        <Text style={styles.storeCategory}>Κατηγορία: {store?.storeCategory}</Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#6b7280" style={{ marginRight: 6 }} />
        <TextInput
          value={searchValue}
          onChangeText={setSearchValue}
          placeholder="Αναζήτηση προϊόντων..."
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
        />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={listData}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={renderListItem}
          contentContainerStyle={{ paddingBottom: 160 + (Platform.OS === 'android' ? kbPad : 0) }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {searchValue ? 'Δεν βρέθηκαν προϊόντα' : 'Δεν υπάρχουν διαθέσιμα προϊόντα'}
              </Text>
            </View>
          }
        />

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.addAllButton}
            onPress={addAllSuggested}
            disabled={Object.values(filteredProducts).flat().filter(p => p.suggestedQty > 0).length === 0}
          >
            <Text style={styles.addAllButtonText}>Προσθήκη Όλων</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.fabWrap, { bottom: Math.max(insets.bottom + 16, 16) + (Platform.OS === 'android' ? kbPad : 0) }]}>
          <TouchableOpacity
            disabled={totals.totalItems <= 0}
            onPress={handleNext}
            activeOpacity={0.9}
            style={[styles.fab, totals.totalItems <= 0 && styles.fabDisabled]}
          >
            <Text style={styles.fabText}>
              Σύνολο | {totals.totalItems} τεμ. | €{totals.totalValue.toFixed(2)}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSpacer: {
    width: 40,
  },
  storeInfo: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  storeCode: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  storeCategory: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1f1',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    paddingVertical: 0,
  },
  categoryHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginRight: 12,
  },
  categoryBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  productRow: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImageContainer: {
    width: 60,
    height: 60,
    marginRight: 12,
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  masterCode: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 2,
  },
  productDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    lineHeight: 18,
  },
  productDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  stockIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  stockText: {
    fontSize: 12,
    color: '#6b7280',
  },
  suggestedText: {
    fontSize: 12,
    color: '#10b981',
    marginRight: 8,
  },
  newBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  priceText: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
    marginRight: 12,
  },
  srpText: {
    fontSize: 12,
    color: '#6b7280',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    width: 50,
    height: 32,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  actionButtons: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  addAllButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fabWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  fab: {
    backgroundColor: '#1976d2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#1f2937',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabDisabled: {
    backgroundColor: '#9ca3af',
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default SuperMarketProductSelectionScreen;