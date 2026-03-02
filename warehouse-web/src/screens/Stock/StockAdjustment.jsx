import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { getMergedStock } from '../../services/warehouseKpiService';
import { adjustStock, updateMinStock } from '../../services/stockService';
import { useAuth } from '../../context/AuthContext';
import t from '../../utils/translations';

const StockAdjustment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilters, setBrandFilters] = useState([]);
  const [openBrandDropdown, setOpenBrandDropdown] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [collapsedBrands, setCollapsedBrands] = useState({});
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [editingMinStock, setEditingMinStock] = useState({});
  const [qtyInputMode, setQtyInputMode] = useState({}); // Track mode per product: 'adjustment' or 'direct'
  const brandDropdownRef = useRef(null);

  const { data: stockItems = [], isLoading, error, refetch } = useQuery({
    queryKey: ['stock'],
    queryFn: getMergedStock,
    staleTime: 1000 * 60 * 2,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target)) {
        setOpenBrandDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize all groups as collapsed on mount
  useEffect(() => {
    if (stockItems.length > 0 && Object.keys(collapsedBrands).length === 0) {
      const allBrands = {};
      const allCategories = {};
      stockItems.forEach((item) => {
        const brand = item.product?.supplierBrand || 'Unknown Brand';
        const category = item.product?.category || 'Uncategorized';
        allBrands[brand] = true;
        allCategories[`${brand}::${category}`] = true;
      });
      setCollapsedBrands(allBrands);
      setCollapsedCategories(allCategories);
    }
  }, [stockItems]);

  // Filter and search
  const filteredItems = useMemo(() => {
    let items = [...stockItems];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          item.productCode?.toLowerCase().includes(term) ||
          item.name?.toLowerCase().includes(term) ||
          item.product?.description?.toLowerCase().includes(term) ||
          item.product?.barcodeUnit?.includes(term) ||
          item.product?.barcodeBox?.includes(term) ||
          item.product?.barcodeCarton?.includes(term),
      );
    }

    // Brand filter (multi)
    if (brandFilters && brandFilters.length > 0) {
      const wantsUnknown = brandFilters.includes('__unknown__');
      const lowers = new Set(
        brandFilters.filter((b) => b !== '__unknown__').map((b) => String(b).toLowerCase()),
      );
      items = items.filter((item) => {
        const b = (item.product?.supplierBrand || '').trim();
        if (!b) return wantsUnknown;
        return lowers.size === 0 ? true : lowers.has(b.toLowerCase());
      });
    }

    return items;
  }, [stockItems, searchTerm, brandFilters]);

  // Expand all groups when searching or filtering
  useEffect(() => {
    if (searchTerm || brandFilters.length > 0) {
      // Expand all by setting to false explicitly
      const allBrands = {};
      const allCategories = {};
      
      filteredItems.forEach((item) => {
        const brand = item.product?.supplierBrand || 'Unknown Brand';
        const category = item.product?.category || 'Uncategorized';
        allBrands[brand] = false;
        allCategories[`${brand}::${category}`] = false;
      });
      
      setCollapsedBrands(allBrands);
      setCollapsedCategories(allCategories);
    }
  }, [searchTerm, brandFilters]);

  // Group by brand then category
  const groupedItems = useMemo(() => {
    const brands = {};
    filteredItems.forEach((item) => {
      const brand = item.product?.supplierBrand || 'Unknown Brand';
      const category = item.product?.category || 'Uncategorized';

      if (!brands[brand]) brands[brand] = {};
      if (!brands[brand][category]) brands[brand][category] = [];
      brands[brand][category].push(item);
    });

    return Object.keys(brands)
      .sort()
      .map((brand) => ({
        brand,
        categories: Object.keys(brands[brand])
          .sort()
          .map((category) => ({
            category,
            products: brands[brand][category].sort((a, b) =>
              (a.productCode || '').localeCompare(b.productCode || ''),
            ),
          })),
      }));
  }, [filteredItems]);

  const brandOptions = useMemo(() => {
    const set = new Set();
    stockItems.forEach((it) => {
      const b = (it.product?.supplierBrand || '').trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [stockItems]);

  const toggleBrand = (brand) => {
    setBrandFilters((prev) => {
      if (brand === '__all__') return [];
      const set = new Set(prev);
      if (set.has(brand)) set.delete(brand);
      else set.add(brand);
      return Array.from(set);
    });
  };

  const toggleBrandCollapse = (brand) => {
    setCollapsedBrands((prev) => ({ ...prev, [brand]: !prev[brand] }));
  };

  const toggleCategoryCollapse = (brand, category) => {
    const key = `${brand}::${category}`;
    setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEditMinStock = (productCode) => {
    setEditingMinStock((prev) => ({ ...prev, [productCode]: !prev[productCode] }));
  };

  const toggleQtyInputMode = (productCode) => {
    setQtyInputMode((prev) => ({
      ...prev,
      [productCode]: prev[productCode] === 'direct' ? 'adjustment' : 'direct',
    }));
  };

  const expandAll = () => {
    setCollapsedBrands({});
    setCollapsedCategories({});
  };

  const collapseAll = () => {
    const allBrands = {};
    const allCategories = {};
    groupedItems.forEach(({ brand, categories }) => {
      allBrands[brand] = true;
      categories.forEach(({ category }) => {
        allCategories[`${brand}::${category}`] = true;
      });
    });
    setCollapsedBrands(allBrands);
    setCollapsedCategories(allCategories);
  };

  const handleFieldChange = (productCode, field, value) => {
    setPendingChanges((prev) => ({
      ...prev,
      [productCode]: {
        ...prev[productCode],
        [field]: value,
      },
    }));
  };

  const handleSaveAll = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    const changes = Object.entries(pendingChanges).filter(([_, values]) =>
      Object.values(values).some((v) => v !== '' && v !== undefined),
    );

    if (changes.length === 0) {
      setErrorMessage(t.stockAdjustment.noChanges);
      return;
    }

    setIsSaving(true);

    try {
      const promises = changes.map(async ([productCode, values]) => {
        const item = stockItems.find((i) => i.productCode === productCode);
        const results = [];

        // Handle qty adjustment
        if (values.qtyAdjustment !== undefined && values.qtyAdjustment !== '') {
          let delta;
          const inputValue = parseFloat(values.qtyAdjustment);
          
          if (qtyInputMode[productCode] === 'direct') {
            // Direct quantity mode: calculate delta from new total
            if (!isNaN(inputValue) && inputValue >= 0) {
              delta = inputValue - (item?.qtyOnHand || 0);
            }
          } else {
            // Adjustment mode: use value as delta
            delta = inputValue;
          }
          
          if (!isNaN(delta) && delta !== 0) {
            const newQty = (item?.qtyOnHand || 0) + delta;
            if (newQty < 0) {
              throw new Error(`${productCode}: Adjustment would result in negative stock`);
            }
            await adjustStock({
              productCode,
              delta,
              reason: 'manual_adjustment',
              notes: `Bulk adjustment from Stock Adjustment screen (${qtyInputMode[productCode] === 'direct' ? 'direct quantity' : 'delta'})`,
              updatedBy: user?.uid || 'unknown',
            });
            results.push('qty');
          }
        }

        // Handle minStock update
        if (values.minStock !== undefined && values.minStock !== '') {
          const newMin = parseInt(values.minStock, 10);
          if (!isNaN(newMin) && newMin >= 0) {
            await updateMinStock({
              productCode,
              lowStockLimit: newMin,
              updatedBy: user?.uid || 'unknown',
            });
            results.push('min');
          }
        }

        return { productCode, results };
      });

      await Promise.all(promises);

      setSuccessMessage(`Successfully updated ${changes.length} product(s)`);
      setPendingChanges({});
      await refetch();
    } catch (err) {
      setErrorMessage(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearChanges = () => {
    setPendingChanges({});
    setSuccessMessage('');
    setErrorMessage('');
  };

  const pendingCount = Object.keys(pendingChanges).filter((key) =>
    Object.values(pendingChanges[key]).some((v) => v !== '' && v !== undefined),
  ).length;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading stock: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{t.stockAdjustment.title}</h1>
        <p className="text-gray-600 mt-1">
          {t.stockAdjustment.subtitle}
        </p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{errorMessage}</p>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-3 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder={t.stockAdjustment.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            {/* Brand dropdown */}
            <div className="relative" ref={brandDropdownRef}>
              <button
                type="button"
                onClick={() => setOpenBrandDropdown((o) => !o)}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                title="Filter by supplier brand"
              >
                {t.stockAdjustment.brand}: {brandFilters.length === 0 ? t.common.all : `${brandFilters.length} επιλεγμένα`}
              </button>
              {openBrandDropdown && (
                <div className="absolute z-10 mt-1 w-80 rounded-md border border-gray-200 bg-white shadow max-h-[36rem] overflow-auto">
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => setBrandFilters([])}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100"
                    >
                      {t.common.selectAll}
                    </button>
                    <div className="mt-2">
                      <label className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={brandFilters.includes('__unknown__')}
                          onChange={() => toggleBrand('__unknown__')}
                        />
                        {t.common.unknown}
                      </label>
                      <div className="mt-1 space-y-1">
                        {brandOptions.map((b) => (
                          <label
                            key={b}
                            className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={brandFilters.includes(b)}
                              onChange={() => toggleBrand(b)}
                            />
                            <span className="truncate" title={b}>
                              {b}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Collapse/Expand All */}
            <button
              onClick={expandAll}
              className="px-3 py-2 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 transition-colors"
            >
              {t.common.expandAll}
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 bg-gray-600 text-white rounded-md text-xs hover:bg-gray-700 transition-colors"
            >
              {t.common.collapseAll}
            </button>

            {/* Save/Clear Buttons */}
            {pendingCount > 0 && (
              <>
                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 transition-colors disabled:bg-gray-300"
                >
                  {isSaving ? t.stockAdjustment.saving : `${t.common.save} (${pendingCount})`}
                </button>
                <button
                  onClick={handleClearChanges}
                  disabled={isSaving}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md text-xs hover:bg-gray-300 transition-colors"
                >
                  {t.common.clear}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grouped Product List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">{t.common.loading}</p>
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {t.stockAdjustment.noProducts}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {groupedItems.map(({ brand, categories }) => {
              const brandProductCount = categories.reduce((sum, cat) => sum + cat.products.length, 0);
              return (
              <div key={brand} className="p-4">
                {/* Brand Header */}
                <button
                  type="button"
                  onClick={() => toggleBrandCollapse(brand)}
                  className="w-full flex items-center justify-between text-lg font-bold text-gray-900 mb-3 bg-blue-50 px-3 py-2 rounded hover:bg-blue-100 transition-colors"
                >
                  <span>{brand} <span className="text-sm font-normal text-gray-600">({brandProductCount} {t.common.products})</span></span>
                  <svg
                    className={`w-5 h-5 transition-transform ${collapsedBrands[brand] !== true ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                {/* Categories */}
                {collapsedBrands[brand] !== true && categories.map(({ category, products }) => {
                  const categoryKey = `${brand}::${category}`;
                  return (
                  <div key={category} className="mb-4">
                    {/* Category Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategoryCollapse(brand, category)}
                      className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 mb-2 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    >
                      <span>{category} <span className="text-xs font-normal text-gray-600">({products.length} {t.common.products})</span></span>
                      <svg
                        className={`w-4 h-4 transition-transform ${collapsedCategories[categoryKey] !== true ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>

                    {/* Products Table */}
                    {collapsedCategories[categoryKey] !== true && (<div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-2 text-left font-medium text-gray-700 w-24">
                              {t.stockAdjustment.code}
                            </th>
                            <th className="px-2 py-2 text-left font-medium text-gray-700">
                              {t.stockAdjustment.description}
                            </th>
                            <th className="px-2 py-2 text-right font-medium text-gray-700 w-20">
                              {t.stockAdjustment.current}
                            </th>
                            <th className="px-2 py-2 text-center font-medium text-gray-700 w-32">
                              <div className="flex flex-col items-center gap-1">
                                <span>{t.stockAdjustment.quantity}</span>
                                <span className="text-xs font-normal text-gray-500">({t.stockAdjustment.adjustmentOrTotal})</span>
                              </div>
                            </th>
                            <th className="px-2 py-2 text-right font-medium text-gray-700 w-20">
                              {t.stockAdjustment.newQty}
                            </th>
                            <th className="px-2 py-2 text-right font-medium text-gray-700 w-20">
                              {t.stockAdjustment.minStock}
                            </th>
                            <th className="px-2 py-2 text-center font-medium text-gray-700 w-24">
                              {t.stockAdjustment.newMin}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {products.map((item) => {
                            const pendingQtyAdj = pendingChanges[item.productCode]?.qtyAdjustment;
                            const pendingMinStock = pendingChanges[item.productCode]?.minStock;
                            const inputMode = qtyInputMode[item.productCode] || 'adjustment';
                            
                            let qtyDelta = 0;
                            let newQty = item.qtyOnHand || 0;
                            
                            if (pendingQtyAdj) {
                              const inputValue = parseFloat(pendingQtyAdj);
                              if (!isNaN(inputValue)) {
                                if (inputMode === 'direct') {
                                  // Direct mode: input is the new total
                                  qtyDelta = inputValue - (item.qtyOnHand || 0);
                                  newQty = inputValue;
                                } else {
                                  // Adjustment mode: input is the delta
                                  qtyDelta = inputValue;
                                  newQty = (item.qtyOnHand || 0) + inputValue;
                                }
                              }
                            }
                            
                            const newMinStock = pendingMinStock
                              ? parseInt(pendingMinStock, 10)
                              : item.lowStockLimit || 0;

                            return (
                              <tr key={item.productCode} className="hover:bg-gray-50">
                                <td className="px-2 py-2 font-semibold text-gray-900">
                                  {item.productCode}
                                </td>
                                <td className="px-2 py-2 text-gray-700">
                                  <div className="max-w-xs truncate" title={item.product?.description}>
                                    {item.product?.description || item.name}
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-right font-medium text-gray-900">
                                  {item.qtyOnHand || 0}
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      step="1"
                                      placeholder={inputMode === 'direct' ? t.stockAdjustment.newTotal : '+/-'}
                                      value={pendingQtyAdj || ''}
                                      onChange={(e) =>
                                        handleFieldChange(
                                          item.productCode,
                                          'qtyAdjustment',
                                          e.target.value,
                                        )
                                      }
                                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500 text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => toggleQtyInputMode(item.productCode)}
                                      className="px-1 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                      title={inputMode === 'direct' ? t.stockAdjustment.switchToAdjustment : t.stockAdjustment.switchToDirect}
                                    >
                                      {inputMode === 'direct' ? '=' : '±'}
                                    </button>
                                  </div>
                                </td>
                                <td
                                  className={`px-2 py-2 text-right font-semibold ${
                                    newQty < 0
                                      ? 'text-red-600'
                                      : pendingQtyAdj && qtyDelta !== 0
                                        ? 'text-green-600'
                                        : 'text-gray-900'
                                  }`}
                                >
                                  {newQty}
                                </td>
                                <td className="px-2 py-2 text-right text-gray-600">
                                  {item.lowStockLimit || 0}
                                </td>
                                <td className="px-2 py-2">
                                  {editingMinStock[item.productCode] ? (
                                    <input
                                      type="number"
                                      step="1"
                                      min="0"
                                      placeholder={t.stockAdjustment.newMinPlaceholder}
                                      value={pendingMinStock || ''}
                                      onChange={(e) =>
                                        handleFieldChange(item.productCode, 'minStock', e.target.value)
                                      }
                                      className="w-full px-2 py-1 border border-blue-400 rounded text-center focus:ring-1 focus:ring-blue-500"
                                      autoFocus
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => toggleEditMinStock(item.productCode)}
                                      className="w-full px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors font-medium"
                                    >
                                      {t.stockAdjustment.editMin}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>)}
                  </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {!isLoading && filteredItems.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          {t.stockAdjustment.showing} {filteredItems.length} {t.common.products}
          {pendingCount > 0 && ` • ${pendingCount} ${t.stockAdjustment.pendingChanges}`}
        </div>
      )}
    </div>
  );
};

export default StockAdjustment;

