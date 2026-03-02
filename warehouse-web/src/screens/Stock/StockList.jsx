import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useQuery } from 'react-query';
import { getMergedStock } from '../../services/warehouseKpiService';
import { useNavigate } from 'react-router-dom';
import t from '../../utils/translations';

const StockList = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [stockStatuses, setStockStatuses] = useState(['low', 'normal', 'out']); // multi-select
  const [brandFilters, setBrandFilters] = useState([]); // array of supplier brands; empty => all
  const [openStockDropdown, setOpenStockDropdown] = useState(false);
  const [openBrandDropdown, setOpenBrandDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'table'
  const [collapsedBrands, setCollapsedBrands] = useState({});
  const [collapsedCategories, setCollapsedCategories] = useState({});
  
  const stockDropdownRef = useRef(null);
  const brandDropdownRef = useRef(null);

  const { data: stockItems = [], isLoading, error } = useQuery({
    queryKey: ['stock'],
    queryFn: getMergedStock,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stockDropdownRef.current && !stockDropdownRef.current.contains(event.target)) {
        setOpenStockDropdown(false);
      }
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target)) {
        setOpenBrandDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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
        if (!b) return wantsUnknown; // match unknown if requested
        return lowers.size === 0 ? true : lowers.has(b.toLowerCase());
      });
    }

    // Stock status filter (multi)
    if (stockStatuses && stockStatuses.length > 0) {
      items = items.filter((item) => {
        const qty = item.qtyOnHand || 0;
        const isOut = qty === 0;
        const isLowNonZero = item.isLowStock && qty > 0;
        const isNormal = !item.isLowStock && qty > 0;
        return (
          (isOut && stockStatuses.includes('out')) ||
          (isLowNonZero && stockStatuses.includes('low')) ||
          (isNormal && stockStatuses.includes('normal'))
        );
      });
    }

    return items;
  }, [stockItems, searchTerm, stockStatuses, brandFilters]);

  // Expand all groups when searching or filtering
  useEffect(() => {
    if (searchTerm || brandFilters.length > 0 || stockStatuses.length < 3) {
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
  }, [searchTerm, brandFilters, stockStatuses]);

  // Sort
  const sortedItems = useMemo(() => {
    const items = [...filteredItems];
    const { key, direction } = sortConfig;

    items.sort((a, b) => {
      let aVal, bVal;

      switch (key) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          return direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        case 'productCode':
          aVal = a.productCode || '';
          bVal = b.productCode || '';
          return direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        case 'qtyOnHand':
        case 'lowStockLimit':
        case 'unitCost':
          aVal = a[key] || 0;
          bVal = b[key] || 0;
          return direction === 'asc' ? aVal - bVal : bVal - aVal;
        case 'totalValue':
          aVal = (a.qtyOnHand || 0) * (a.unitCost || 0);
          bVal = (b.qtyOnHand || 0) * (b.unitCost || 0);
          return direction === 'asc' ? aVal - bVal : bVal - aVal;
        case 'category':
          aVal = a.product?.category || '';
          bVal = b.product?.category || '';
          return direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        case 'supplierBrand':
          aVal = a.product?.supplierBrand || '';
          bVal = b.product?.supplierBrand || '';
          return direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        default:
          return 0;
      }
    });

    return items;
  }, [filteredItems, sortConfig]);

  // Group by brand then category for grouped view
  const groupedItems = useMemo(() => {
    const brands = {};
    sortedItems.forEach((item) => {
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
  }, [sortedItems]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleStatus = (status) => {
    setStockStatuses((prev) => {
      const set = new Set(prev);
      if (set.has(status)) set.delete(status);
      else set.add(status);
      // if all unchecked, treat as all selected (no restriction)
      return Array.from(set);
    });
  };

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

  const handleExport = () => {
    const data = sortedItems.map((item) => ({
      'Product Code': item.productCode || '',
      Description: item.product?.description || item.name || '',
      'Supplier Brand': item.product?.supplierBrand || '',
      Category: item.product?.category || '',
      'Current Stock': item.qtyOnHand || 0,
      'Min Stock': item.lowStockLimit || 0,
      'Unit Cost (€)': Number((item.unitCost || 0).toFixed(2)),
      'Total Value (€)': Number((((item.qtyOnHand || 0) * (item.unitCost || 0)).toFixed(2))),
      Status:
        (item.qtyOnHand || 0) === 0
          ? 'Out of Stock'
          : item.isLowStock
            ? 'Low Stock'
            : 'Normal',
      BarcodeUnit: item.product?.barcodeUnit || '',
      BarcodeBox: item.product?.barcodeBox || '',
      BarcodeCarton: item.product?.barcodeCarton || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data, { origin: 0 });
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 40 },
      { wch: 16 },
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock List');
    const filename = `stock_list_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const totalValue = useMemo(
    () =>
      sortedItems.reduce(
        (sum, item) => sum + (item.qtyOnHand || 0) * (item.unitCost || 0),
        0,
      ),
    [sortedItems],
  );

  const lowStockCount = useMemo(
    () => sortedItems.filter((item) => item.isLowStock).length,
    [sortedItems],
  );

  const outOfStockCount = useMemo(
    () => sortedItems.filter((item) => (item.qtyOnHand || 0) === 0).length,
    [sortedItems],
  );

  const brandOptions = useMemo(() => {
    const set = new Set();
    stockItems.forEach((it) => {
      const b = (it.product?.supplierBrand || '').trim();
      if (b) set.add(b);
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return list;
  }, [stockItems]);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{t.errors.loadingError} {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t.stockList.title}</h1>
          <p className="text-gray-600 mt-1">{t.stockList.subtitle}</p>
        </div>
        <button
          onClick={() => navigate('/stock/adjust')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {t.stockList.adjustStock}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">{t.stockList.totalProducts}</p>
          <p className="text-2xl font-bold text-gray-900">{sortedItems.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">{t.stockList.lowStockItems}</p>
          <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">{t.stockList.outOfStock}</p>
          <p className="text-2xl font-bold text-rose-700">{outOfStockCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">{t.stockList.totalStockValue}</p>
          <p className="text-2xl font-bold text-green-600">€{totalValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-3 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder={t.stockList.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter */}
          <div className="flex gap-3 flex-wrap items-center">
            {/* View Mode Toggle */}
            <div className="flex gap-1 border border-gray-300 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-2 text-xs transition-colors ${
                  viewMode === 'grouped'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.stockList.grouped}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-xs transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.stockList.table}
              </button>
            </div>

            {/* Stock status dropdown */}
            <div className="relative" ref={stockDropdownRef}>
              <button
                type="button"
                onClick={() => setOpenStockDropdown((o) => !o)}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                {t.stockList.stockStatus}: {stockStatuses.length === 3 ? t.common.all : stockStatuses.join(', ')}
              </button>
              {openStockDropdown && (
                <div className="absolute z-10 mt-1 w-44 rounded-md border border-gray-200 bg-white shadow">
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => setStockStatuses(['low', 'normal', 'out'])}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100"
                    >
                      {t.common.selectAll}
                    </button>
                    <div className="mt-1 space-y-1">
                      {['normal', 'low', 'out'].map((s) => (
                        <label key={s} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={stockStatuses.includes(s)}
                            onChange={() => toggleStatus(s)}
                          />
                          <span className="capitalize">{t.stockList[s]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Brand dropdown */}
            <div className="relative" ref={brandDropdownRef}>
              <button
                type="button"
                onClick={() => setOpenBrandDropdown((o) => !o)}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                title="Filter by supplier brand"
              >
                {t.stockList.brand}: {brandFilters.length === 0 ? t.common.all : `${brandFilters.length} επιλεγμένα`}
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
                          <label key={b} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={brandFilters.includes(b)}
                              onChange={() => toggleBrand(b)}
                            />
                            <span className="truncate" title={b}>{b}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              className="px-3 py-2 bg-green-600 text-white rounded-md text-xs hover:bg-green-700 transition-colors"
            >
              {t.stockList.exportExcel}
            </button>

            {/* Collapse/Expand All (only in grouped view) */}
            {viewMode === 'grouped' && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">{t.common.loading}</p>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {t.stockList.noProducts}
          </div>
        ) : viewMode === 'grouped' ? (
          /* Grouped View */
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
                  <span>{brand} <span className="text-sm font-normal text-gray-600">({brandProductCount} products)</span></span>
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
                      <span>{category} <span className="text-xs font-normal text-gray-600">({products.length} products)</span></span>
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
                      <table className="w-full table-fixed text-xs">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="w-24 px-2 py-2 text-left font-medium text-gray-700">{t.stockList.productCode}</th>
                            <th className="px-2 py-2 text-left font-medium text-gray-700">{t.stockList.description}</th>
                            <th className="w-20 px-2 py-2 text-right font-medium text-gray-700">{t.stockList.stock}</th>
                            <th className="w-20 px-2 py-2 text-right font-medium text-gray-700">Ελάχ.</th>
                            <th className="w-24 px-2 py-2 text-right font-medium text-gray-700">{t.stockList.unitCost}</th>
                            <th className="w-28 px-2 py-2 text-right font-medium text-gray-700">{t.stockList.totalValue}</th>
                            <th className="w-24 px-2 py-2 text-center font-medium text-gray-700">{t.stockList.status}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {products.map((item) => {
                            const totalItemValue = (item.qtyOnHand || 0) * (item.unitCost || 0);
                            const stockPercentage = item.lowStockLimit
                              ? (item.qtyOnHand / item.lowStockLimit) * 100
                              : 100;
                            const isVeryLow = stockPercentage < 50;
                            const isCritical = item.qtyOnHand === 0;

                            return (
                              <tr
                                key={item.productCode}
                                onClick={() => navigate(`/stock/${item.productCode}`)}
                                className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                                  isCritical
                                    ? 'bg-red-50'
                                    : isVeryLow
                                      ? 'bg-orange-50'
                                      : item.isLowStock
                                        ? 'bg-yellow-50'
                                        : ''
                                }`}
                              >
                                <td className="px-2 py-2 font-semibold text-gray-900">
                                  {item.productCode}
                                </td>
                                <td className="px-2 py-2 text-gray-700">
                                  <div className="max-w-xs truncate" title={item.product?.description}>
                                    {item.product?.description || item.name}
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-right font-semibold">
                                  <span
                                    className={
                                      isCritical
                                        ? 'text-red-700'
                                        : isVeryLow
                                          ? 'text-orange-600'
                                          : item.isLowStock
                                            ? 'text-yellow-600'
                                            : 'text-gray-900'
                                    }
                                  >
                                    {item.qtyOnHand || 0}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-right text-gray-600">
                                  {item.lowStockLimit || 0}
                                </td>
                                <td className="px-2 py-2 text-right text-gray-900">
                                  €{(item.unitCost || 0).toFixed(2)}
                                </td>
                                <td className="px-2 py-2 text-right font-medium text-gray-900">
                                  €{totalItemValue.toFixed(2)}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  {isCritical ? (
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                      {t.stockList.out}
                                    </span>
                                  ) : isVeryLow ? (
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                                      {t.stockList.veryLow}
                                    </span>
                                  ) : item.isLowStock ? (
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                      {t.stockList.low}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                      {t.stockList.normal}
                                    </span>
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
        ) : (
          /* Table View */
          <div>
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs">
                <tr>
                  <th
                    onClick={() => handleSort('productCode')}
                    className="w-24 px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    {t.stockList.productCode}{' '}
                    {sortConfig.key === 'productCode' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    {t.stockList.description}{' '}
                    {sortConfig.key === 'name' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('supplierBrand')}
                    className="w-28 px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    {t.stockList.supplier}{' '}
                    {sortConfig.key === 'supplierBrand' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('category')}
                    className="w-32 px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    {t.stockList.category}{' '}
                    {sortConfig.key === 'category' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('qtyOnHand')}
                    className="w-20 px-2 py-2 text-right font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    {t.stockList.stock}{' '}
                    {sortConfig.key === 'qtyOnHand' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('unitCost')}
                    className="w-24 px-2 py-2 text-right font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    {t.stockList.unitCost}{' '}
                    {sortConfig.key === 'unitCost' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('totalValue')}
                    className="w-28 px-2 py-2 text-right font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    {t.stockList.totalValue}{' '}
                    {sortConfig.key === 'totalValue' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    {t.stockList.status}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-xs">
                {sortedItems.map((item) => {
                  const totalItemValue = (item.qtyOnHand || 0) * (item.unitCost || 0);
                  const stockPercentage = item.lowStockLimit
                    ? (item.qtyOnHand / item.lowStockLimit) * 100
                    : 100;
                  const isVeryLow = stockPercentage < 50;
                  const isCritical = item.qtyOnHand === 0;

                    return (
                    <tr
                      key={item.productCode}
                      onClick={() => navigate(`/stock/${item.productCode}`)}
                      className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                        isCritical
                          ? 'bg-red-50'
                          : isVeryLow
                            ? 'bg-orange-50'
                            : item.isLowStock
                              ? 'bg-yellow-50'
                              : ''
                      }`}
                    >
                      <td className="px-2 py-2 whitespace-nowrap font-semibold text-gray-900">
                        {item.productCode}
                      </td>
                      <td className="px-2 py-2 text-gray-700">
                        <div className="max-w-[240px] truncate" title={item.product?.description}>
                          {item.product?.description || item.name}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-600">
                        <div className="max-w-xs truncate" title={item.product?.supplierBrand}>
                          {item.product?.supplierBrand || '-'}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-600">
                        <div className="max-w-xs truncate" title={item.product?.category}>
                          {item.product?.category || '-'}
                        </div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-right font-semibold">
                        <span
                          className={
                            isCritical
                              ? 'text-red-700'
                              : isVeryLow
                                ? 'text-orange-600'
                                : item.isLowStock
                                  ? 'text-yellow-600'
                                  : 'text-gray-900'
                          }
                        >
                          {item.qtyOnHand || 0}
                        </span>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-right text-gray-900">
                        €{(item.unitCost || 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-right font-medium text-gray-900">
                        €{totalItemValue.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-center">
                        {isCritical ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            {t.stockList.outOfStock}
                          </span>
                        ) : isVeryLow ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            {t.stockList.veryLow}
                          </span>
                        ) : item.isLowStock ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            {t.stockList.low}
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {t.stockList.normal}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {!isLoading && sortedItems.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          {t.stockList.showing} {sortedItems.length} {t.stockList.of} {stockItems.length} {t.common.products}
        </div>
      )}
    </div>
  );
};

export default StockList;

