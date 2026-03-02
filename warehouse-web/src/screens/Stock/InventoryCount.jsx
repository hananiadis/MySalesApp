import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { getMergedStock } from '../../services/warehouseKpiService';
import { adjustStock } from '../../services/stockService';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import * as XLSX from 'xlsx';
import t from '../../utils/translations';

const InventoryCount = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilters, setBrandFilters] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [openBrandDropdown, setOpenBrandDropdown] = useState(false);
  const [countedQuantities, setCountedQuantities] = useState({}); // { productCode: countedQty }
  const [notes, setNotes] = useState({}); // { productCode: note }
  const [collapsedBrands, setCollapsedBrands] = useState({});
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);
  const [countSessionName, setCountSessionName] = useState('');
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

    // Brand filter
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

    // Location filter
    if (locationFilter) {
      const term = locationFilter.toLowerCase();
      items = items.filter((item) => 
        (item.product?.location || '').toLowerCase().includes(term)
      );
    }

    // Show discrepancies only
    if (showDiscrepanciesOnly) {
      items = items.filter((item) => {
        const counted = countedQuantities[item.productCode];
        return counted !== undefined && counted !== '' && parseFloat(counted) !== (item.qtyOnHand || 0);
      });
    }

    return items;
  }, [stockItems, searchTerm, brandFilters, locationFilter, showDiscrepanciesOnly, countedQuantities]);

  // Expand all groups when searching or filtering
  useEffect(() => {
    if (searchTerm || brandFilters.length > 0 || locationFilter) {
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
  }, [searchTerm, brandFilters, locationFilter]);

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
              (a.product?.location || '').localeCompare(b.product?.location || '') ||
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

  const handleCountChange = (productCode, value) => {
    setCountedQuantities((prev) => ({
      ...prev,
      [productCode]: value,
    }));
  };

  const handleNoteChange = (productCode, value) => {
    setNotes((prev) => ({
      ...prev,
      [productCode]: value,
    }));
  };

  const discrepancies = useMemo(() => {
    return Object.entries(countedQuantities)
      .filter(([productCode, counted]) => {
        if (counted === undefined || counted === '') return false;
        const item = stockItems.find((i) => i.productCode === productCode);
        return item && parseFloat(counted) !== (item.qtyOnHand || 0);
      })
      .map(([productCode, counted]) => {
        const item = stockItems.find((i) => i.productCode === productCode);
        return {
          productCode,
          expected: item?.qtyOnHand || 0,
          counted: parseFloat(counted),
          difference: parseFloat(counted) - (item?.qtyOnHand || 0),
          product: item,
        };
      });
  }, [countedQuantities, stockItems]);

  const countedCount = Object.keys(countedQuantities).filter(
    (key) => countedQuantities[key] !== undefined && countedQuantities[key] !== '',
  ).length;

  const handleSaveCount = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    if (discrepancies.length === 0) {
      setErrorMessage('No discrepancies to save. All counted quantities match system quantities.');
      return;
    }

    if (!countSessionName.trim()) {
      setErrorMessage('Please enter a count session name');
      return;
    }

    setIsSaving(true);

    try {
      const adjustments = [];

      for (const disc of discrepancies) {
        if (disc.difference !== 0) {
          await adjustStock({
            productCode: disc.productCode,
            delta: disc.difference,
            reason: 'inventory_count',
            notes: `Count session: ${countSessionName}${notes[disc.productCode] ? ` - ${notes[disc.productCode]}` : ''}`,
            updatedBy: user?.uid || 'unknown',
          });
          adjustments.push(disc);
        }
      }

      // Save count session record
      await addDoc(collection(db, 'inventory_counts_kivos'), {
        sessionName: countSessionName,
        countedBy: user?.uid || 'unknown',
        countedByEmail: user?.email || 'unknown',
        timestamp: serverTimestamp(),
        itemsCounted: countedCount,
        discrepanciesFound: discrepancies.length,
        adjustmentsMade: adjustments.length,
        adjustments: adjustments.map((a) => ({
          productCode: a.productCode,
          expected: a.expected,
          counted: a.counted,
          difference: a.difference,
          note: notes[a.productCode] || '',
        })),
      });

      setSuccessMessage(
        `Inventory count saved successfully! ${adjustments.length} adjustments made.`,
      );
      setCountedQuantities({});
      setNotes({});
      setCountSessionName('');
      await refetch();
      queryClient.invalidateQueries(['stock']);
    } catch (err) {
      setErrorMessage(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCount = () => {
    setCountedQuantities({});
    setNotes({});
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handlePrintCountSheet = () => {
    const printData = filteredItems.map((item) => ({
      Location: item.product?.location || '',
      'Product Code': item.productCode || '',
      Description: item.product?.description || item.name || '',
      'Expected Qty': item.qtyOnHand || 0,
      'Counted Qty': '',
      Notes: '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(printData);
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 40 },
      { wch: 12 },
      { wch: 12 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Count Sheet');
    const filename = `inventory_count_sheet_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleExportDiscrepancies = () => {
    if (discrepancies.length === 0) {
      setErrorMessage('No discrepancies to export');
      return;
    }

    const exportData = discrepancies.map((disc) => ({
      'Product Code': disc.productCode,
      Description: disc.product?.product?.description || disc.product?.name || '',
      'Supplier Brand': disc.product?.product?.supplierBrand || '',
      Category: disc.product?.product?.category || '',
      Location: disc.product?.product?.location || '',
      'Expected Qty': disc.expected,
      'Counted Qty': disc.counted,
      Difference: disc.difference,
      'Difference %': ((disc.difference / disc.expected) * 100).toFixed(2) + '%',
      Notes: notes[disc.productCode] || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 40 },
      { wch: 16 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Discrepancies');
    const filename = `inventory_discrepancies_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

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
        <h1 className="text-3xl font-bold text-gray-900">{t.inventoryCount.title}</h1>
        <p className="text-gray-600 mt-1">
          {t.inventoryCount.subtitle}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">{t.inventoryCount.totalProducts}</p>
          <p className="text-2xl font-bold text-gray-900">{filteredItems.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">{t.inventoryCount.counted}</p>
          <p className="text-2xl font-bold text-blue-600">{countedCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">{t.inventoryCount.discrepancies}</p>
          <p className="text-2xl font-bold text-orange-600">{discrepancies.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">{t.inventoryCount.matchRate}</p>
          <p className="text-2xl font-bold text-green-600">
            {countedCount > 0 ? ((1 - discrepancies.length / countedCount) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col gap-4">
          {/* Row 1: Search and Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder={t.inventoryCount.searchPlaceholder}
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
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
                >
                  {t.inventoryCount.brand}: {brandFilters.length === 0 ? t.common.all : `${brandFilters.length} επιλεγμένα`}
                </button>
                {openBrandDropdown && (
                  <div className="absolute z-10 mt-1 w-80 rounded-md border border-gray-200 bg-white shadow max-h-96 overflow-auto">
                    <div className="p-2">
                      <button
                        type="button"
                        onClick={() => setBrandFilters([])}
                        className="w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-100"
                      >
                        {t.common.selectAll}
                      </button>
                      <div className="mt-2 space-y-1">
                        {brandOptions.map((b) => (
                          <label
                            key={b}
                            className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-gray-50"
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
                )}
              </div>

              {/* Location filter */}
              <input
                type="text"
                placeholder={t.inventoryCount.locationPlaceholder}
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              {/* Show discrepancies only */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showDiscrepanciesOnly}
                  onChange={(e) => setShowDiscrepanciesOnly(e.target.checked)}
                  className="rounded"
                />
                <span className="whitespace-nowrap">Discrepancies Only</span>
              </label>
            </div>
          </div>

          {/* Collapse/Expand All */}
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-2 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 bg-gray-600 text-white rounded-md text-xs hover:bg-gray-700 transition-colors"
            >
              Collapse All
            </button>
          </div>

          {/* Row 2: Actions */}
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <input
              type="text"
              placeholder="Count session name (e.g., 'Monthly Count Dec 2025')"
              value={countSessionName}
              onChange={(e) => setCountSessionName(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handlePrintCountSheet}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
              >
                {t.inventoryCount.printCountSheet}
              </button>
              <button
                onClick={handleExportDiscrepancies}
                disabled={discrepancies.length === 0}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 transition-colors disabled:bg-gray-300"
              >
                {t.inventoryCount.exportDiscrepancies}
              </button>
              {countedCount > 0 && (
                <>
                  <button
                    onClick={handleSaveCount}
                    disabled={isSaving || discrepancies.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:bg-gray-300 font-medium"
                  >
                    {isSaving ? t.inventoryCount.saving : `${t.inventoryCount.saveCount} (${discrepancies.length} ${t.inventoryCount.adjustments})`}
                  </button>
                  <button
                    onClick={handleClearCount}
                    disabled={isSaving}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                  >
                    {t.inventoryCount.clearAll}
                  </button>
                </>
              )}
            </div>
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
            {t.inventoryCount.noProducts}
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
                    <span>
                      {brand}{' '}
                      <span className="text-sm font-normal text-gray-600">
                        ({brandProductCount} {t.common.products})
                      </span>
                    </span>
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
                  {collapsedBrands[brand] !== true &&
                    categories.map(({ category, products }) => {
                      const categoryKey = `${brand}::${category}`;
                      return (
                        <div key={category} className="mb-4">
                          {/* Category Header */}
                          <button
                            type="button"
                            onClick={() => toggleCategoryCollapse(brand, category)}
                            className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 mb-2 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                          >
                            <span>
                              {category}{' '}
                              <span className="text-xs font-normal text-gray-600">
                                ({products.length} {t.common.products})
                              </span>
                            </span>
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
                          {collapsedCategories[categoryKey] !== true && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b">
                                  <tr>
                                    <th className="px-2 py-2 text-left font-medium text-gray-700 w-20">
                                      Location
                                    </th>
                                    <th className="px-2 py-2 text-left font-medium text-gray-700 w-24">
                                      Code
                                    </th>
                                    <th className="px-2 py-2 text-left font-medium text-gray-700">
                                      Description
                                    </th>
                                    <th className="px-2 py-2 text-right font-medium text-gray-700 w-20">
                                      Expected
                                    </th>
                                    <th className="px-2 py-2 text-center font-medium text-gray-700 w-24">
                                      Counted
                                    </th>
                                    <th className="px-2 py-2 text-right font-medium text-gray-700 w-20">
                                      Difference
                                    </th>
                                    <th className="px-2 py-2 text-left font-medium text-gray-700 w-40">
                                      Notes
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {products.map((item) => {
                                    const counted = countedQuantities[item.productCode];
                                    const expected = item.qtyOnHand || 0;
                                    const difference =
                                      counted !== undefined && counted !== ''
                                        ? parseFloat(counted) - expected
                                        : 0;
                                    const hasDiscrepancy = difference !== 0 && counted !== undefined && counted !== '';

                                    return (
                                      <tr
                                        key={item.productCode}
                                        className={`hover:bg-gray-50 ${
                                          hasDiscrepancy
                                            ? Math.abs(difference) > expected * 0.1
                                              ? 'bg-red-50'
                                              : 'bg-yellow-50'
                                            : counted !== undefined && counted !== ''
                                              ? 'bg-green-50'
                                              : ''
                                        }`}
                                      >
                                        <td className="px-2 py-2 text-gray-600">
                                          {item.product?.location || '-'}
                                        </td>
                                        <td className="px-2 py-2 font-semibold text-gray-900">
                                          {item.productCode}
                                        </td>
                                        <td className="px-2 py-2 text-gray-700">
                                          <div
                                            className="max-w-xs truncate"
                                            title={item.product?.description}
                                          >
                                            {item.product?.description || item.name}
                                          </div>
                                        </td>
                                        <td className="px-2 py-2 text-right font-medium text-gray-900">
                                          {expected}
                                        </td>
                                        <td className="px-2 py-2">
                                          <input
                                            type="number"
                                            step="1"
                                            min="0"
                                            placeholder={t.inventoryCount.countPlaceholder}
                                            value={counted || ''}
                                            onChange={(e) =>
                                              handleCountChange(item.productCode, e.target.value)
                                            }
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500"
                                          />
                                        </td>
                                        <td
                                          className={`px-2 py-2 text-right font-semibold ${
                                            hasDiscrepancy
                                              ? difference > 0
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                              : 'text-gray-400'
                                          }`}
                                        >
                                          {hasDiscrepancy
                                            ? `${difference > 0 ? '+' : ''}${difference}`
                                            : '-'}
                                        </td>
                                        <td className="px-2 py-2">
                                          <input
                                            type="text"
                                            placeholder={t.inventoryCount.notesPlaceholder}
                                            value={notes[item.productCode] || ''}
                                            onChange={(e) =>
                                              handleNoteChange(item.productCode, e.target.value)
                                            }
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
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
          {t.inventoryCount.showing} {filteredItems.length} {t.common.products} • {countedCount} {t.inventoryCount.counted.toLowerCase()} •{' '}
          {discrepancies.length} {t.inventoryCount.discrepancies.toLowerCase()}
        </div>
      )}
    </div>
  );
};

export default InventoryCount;

