// src/screens/MonthlyComparisonScreen.js
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import SafeScreen from '../components/SafeScreen';
import usePlaymobilKpi from '../hooks/usePlaymobilKpi';
import { useKivosKpi } from '../hooks/useKivosKpi';

const MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μαΐος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'
];

let renderCount = 0;

export default function MonthlyComparisonScreen({ route, navigation }) {
  renderCount++;
  console.log(`[MonthlyComparison] ===== RENDER #${renderCount} =====`);
  
  console.log('[MonthlyComparison] RAW route object:', JSON.stringify(route, null, 2));
  
  const { brand } = route?.params || {};
  
  console.log('[MonthlyComparison] Destructured params:', { 
    brand
  });
  
  const [selectedSalesmenIds, setSelectedSalesmenIds] = useState([]);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [customersData, setCustomersData] = useState([]);
  const [showSalesmenPicker, setShowSalesmenPicker] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedSalesGroups, setSelectedSalesGroups] = useState([]);
  const [selectedPrefectures, setSelectedPrefectures] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState({
    region: false,
    salesGroup: false,
    prefecture: false,
  });
  
  // Track state changes
  useEffect(() => {
    console.log('[MonthlyComparison] STATE CHANGE - selectedSalesmenIds:', selectedSalesmenIds);
  }, [selectedSalesmenIds]);
  
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const availableYears = [currentYear, previousYear];

  // Memoize reference date to prevent creating new Date objects on every render
  const currentYearRefDate = useMemo(() => new Date(currentYear, 11, 31), [currentYear]);

  // Fetch KPI data for current year
  console.log('[MonthlyComparison] About to call usePlaymobilKpi for current year with IDs:', selectedSalesmenIds);
  const isKivos = brand === 'kivos';

  // Playmobil data hook (default)
  const playmobilHook =
    usePlaymobilKpi({
      referenceDate: currentYearRefDate,
      enabled: !isKivos,
      selectedSalesmenIds,
    }) || {};

  // Kivos data hook (uses sheets)
  const kivosHook = isKivos
    ? useKivosKpi(selectedSalesmenIds, currentYearRefDate)
    : {};

  const currentYearData = isKivos
    ? {
        invoiced: {
          current: kivosHook.recordSets?.sales?.[`year${currentYear}`] || [],
          previous: kivosHook.recordSets?.sales?.[`year${previousYear}`] || [],
        },
      }
    : playmobilHook.recordSets;

  const currentYearLoading = isKivos ? kivosHook.loading : playmobilHook.isLoading;
  const currentYearStatus = isKivos ? (kivosHook.error ? 'error' : 'ready') : playmobilHook.status;
  const availableSalesmen = isKivos ? kivosHook.availableSalesmen || [] : playmobilHook.availableSalesmen || [];

  console.log('[MonthlyComparison] Current year hook returned:', { 
    status: currentYearStatus,
    isLoading: currentYearLoading,
    hasData: !!currentYearData,
    availableSalesmenCount: availableSalesmen.length
  });

  const allSalesmanIds = useMemo(() => availableSalesmen.map(s => s.id), [availableSalesmen]);

  useEffect(() => {
    if (!selectionInitialized && allSalesmanIds.length > 0) {
      console.log('[MonthlyComparison] Auto-selecting all salesmen IDs');
      setSelectedSalesmenIds(allSalesmanIds);
      setSelectionInitialized(true);
    }
  }, [allSalesmanIds, selectionInitialized]);

  const isLoading = currentYearLoading;
  console.log('[MonthlyComparison] Combined loading state:', isLoading);

  // Load customers data
  useEffect(() => {
    console.log('[MonthlyComparison] useEffect[brand] triggered, brand:', brand);
    const loadCustomers = async () => {
      try {
        const { getCustomersFromLocal } = await import('../utils/localData');
        const customers = await getCustomersFromLocal(brand);
        console.log('[MonthlyComparison] Loaded customers count:', customers.length);
        setCustomersData(customers);
      } catch (err) {
        console.error('[MonthlyComparison] Error loading customers:', err);
      }
    };
    loadCustomers();
  }, [brand]);

  // Quick lookup for customers by code
  const customerByCode = useMemo(() => {
    const map = new Map();
    customersData.forEach(customer => {
      const code = String(customer.customerCode || customer.code || '').trim();
      if (code) {
        map.set(code, customer);
      }
    });
    return map;
  }, [customersData]);

  // Merge current and previous year records to understand where sales exist
  const combinedSalesRecords = useMemo(() => {
    const current = currentYearData?.invoiced?.current || [];
    const previous = currentYearData?.invoiced?.previous || [];
    return [...current, ...previous];
  }, [currentYearData]);

  // Customers that actually have sales (current or previous year) for the active salesman selection
  const customersWithSales = useMemo(() => {
    if (!combinedSalesRecords.length || !customerByCode.size) return [];
    const seen = new Set();

    combinedSalesRecords.forEach(record => {
      const code = String(record.customerCode || record.code || '').trim();
      if (!code || seen.has(code)) return;
      if (customerByCode.has(code)) {
        seen.add(code);
      }
    });

    return Array.from(seen)
      .map(code => customerByCode.get(code))
      .filter(Boolean);
  }, [combinedSalesRecords, customerByCode]);

  const getRegion = (customer) => customer.transportation?.zone || customer.transportationZone;
  const getSalesGroup = (customer) => customer.salesInfo?.description || customer.salesInfo?.groupKeyText;
  const getPrefecture = (customer) => customer.region?.name || customer.prefecture;

  const matchesFilters = useCallback((
    customer,
    {
      ignoreRegion = false,
      ignoreSalesGroup = false,
      ignorePrefecture = false,
    } = {}
  ) => {
    const region = getRegion(customer);
    const salesGroup = getSalesGroup(customer);
    const prefecture = getPrefecture(customer);

    const regionOk = ignoreRegion || !selectedRegions.length || (region && selectedRegions.includes(region));
    const salesGroupOk = ignoreSalesGroup || !selectedSalesGroups.length || (salesGroup && selectedSalesGroups.includes(salesGroup));
    const prefectureOk = ignorePrefecture || !selectedPrefectures.length || (prefecture && selectedPrefectures.includes(prefecture));

    return regionOk && salesGroupOk && prefectureOk;
  }, [selectedRegions, selectedSalesGroups, selectedPrefectures]);

  const buildFilteredCategoryList = (
    getter,
    { ignoreRegion = false, ignoreSalesGroup = false, ignorePrefecture = false } = {}
  ) => {
    if (!customersWithSales.length) return [];
    const set = new Set();

    customersWithSales.forEach(customer => {
      if (!matchesFilters(customer, { ignoreRegion, ignoreSalesGroup, ignorePrefecture })) {
        return;
      }
      const value = getter(customer);
      if (value) {
        set.add(value);
      }
    });

    return Array.from(set).sort();
  };

  const availableRegions = useMemo(
    () => buildFilteredCategoryList(getRegion, { ignoreRegion: true }),
    [customersWithSales, selectedSalesGroups, selectedPrefectures]
  );

  const availableSalesGroups = useMemo(
    () => buildFilteredCategoryList(getSalesGroup, { ignoreSalesGroup: true }),
    [customersWithSales, selectedRegions, selectedPrefectures]
  );

  const availablePrefectures = useMemo(
    () => buildFilteredCategoryList(getPrefecture, { ignorePrefecture: true }),
    [customersWithSales, selectedRegions, selectedSalesGroups]
  );

  // Drop selections that no longer have matching sales after filters change
  useEffect(() => {
    setSelectedRegions(prev => {
      const next = prev.filter(r => availableRegions.includes(r));
      return next.length === prev.length ? prev : next;
    });
  }, [availableRegions]);

  useEffect(() => {
    setSelectedSalesGroups(prev => {
      const next = prev.filter(g => availableSalesGroups.includes(g));
      return next.length === prev.length ? prev : next;
    });
  }, [availableSalesGroups]);

  useEffect(() => {
    setSelectedPrefectures(prev => {
      const next = prev.filter(p => availablePrefectures.includes(p));
      return next.length === prev.length ? prev : next;
    });
  }, [availablePrefectures]);

  // Calculate monthly sales for all available years
  const monthlyData = useMemo(() => {
    try {
    console.log('[MonthlyComparison] useMemo[monthlyData] calculating...');
    console.log('[MonthlyComparison] currentYearData:', currentYearData);
    
    // For current year (2025): use current year hook's .invoiced.current (2025 data)
    // For previous year (2024): use current year hook's .invoiced.previous (2024 data)
    const currentRecords = currentYearData?.invoiced?.current;
    const previousRecords = currentYearData?.invoiced?.previous; // Use current hook's previous, not previous hook!
    
    if (!currentRecords || !previousRecords) {
      console.log('[MonthlyComparison] No data available for monthly calculations');
      return null;
    }

    console.log('[MonthlyComparison] Processing records:', {
      currentCount: currentRecords.length,
      previousCount: previousRecords.length
    });

    const matchesSelections = (customer) => matchesFilters(customer);

    // Function to filter records by combined customer selections
    const filterBySelections = (records) => {
      if (!selectedRegions.length && !selectedSalesGroups.length && !selectedPrefectures.length) {
        return records;
      }

      return records.filter(record => {
        const customerCode = String(record.customerCode || record.code || '').trim();
        const customer = customerByCode.get(customerCode);
        
        if (!customer) return false;
        return matchesSelections(customer);
      });
    };

    const years = {
      [currentYear]: Array(12).fill(0),
      [currentYear - 1]: Array(12).fill(0),
    };

    // Filter records by customer selections if applicable
    const filteredCurrent = filterBySelections(currentRecords);
    const filteredPrevious = filterBySelections(previousRecords);

    // Process current year
    filteredCurrent.forEach(record => {
      const date = new Date(record.date || record.invoiceDate);
      if (date.getFullYear() === currentYear) {
        const month = date.getMonth();
        const amount = parseFloat(record.amount || 0);
        if (Number.isFinite(amount)) {
          years[currentYear][month] += amount;
        }
      }
    });

    // Process previous year
    filteredPrevious.forEach(record => {
      const date = new Date(record.date || record.invoiceDate);
      if (date.getFullYear() === currentYear - 1) {
        const month = date.getMonth();
        const amount = parseFloat(record.amount || 0);
        if (Number.isFinite(amount)) {
          years[currentYear - 1][month] += amount;
        }
      }
    });

    return years;
    } catch (err) {
      console.error('[MonthlyComparison] Error in monthlyData memo:', err);
      return null;
    }
  }, [currentYearData, currentYear, customerByCode, matchesFilters]);


  // Safe, locale-free currency formatter (Hermes/Android lacks Intl with options)
  const formatCurrency = (value) => {
    try {
      const numeric = Number.isFinite(value) ? value : 0;
      const rounded = Math.round(numeric);
      const sign = rounded < 0 ? '-' : '';
      const abs = Math.abs(rounded);
      const withThousands = abs
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `${sign}€${withThousands}`;
    } catch (err) {
      console.error('[MonthlyComparison] formatCurrency error:', err, 'value:', value);
      return `${value}`;
    }
  };

  const formatPercentage = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <SafeScreen title="Μηνιαία Σύγκριση">
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Φόρτωση δεδομένων...</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen title="Μηνιαία Σύγκριση">
      <ScrollView style={styles.container}>
        {/* Salesmen Filter */}
        {availableSalesmen.length > 0 && (
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Πωλητές:</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowSalesmenPicker(!showSalesmenPicker)}
            >
              <Text style={styles.dropdownButtonText}>
                {allSalesmanIds.length > 0 && selectedSalesmenIds?.length === allSalesmanIds.length
                  ? 'Όλοι οι πωλητές' 
                  : `${selectedSalesmenIds?.length || 0} επιλεγμένοι`}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {showSalesmenPicker && availableSalesmen.length > 0 && (
          <View style={styles.pickerContainer}>
            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => {
                setSelectedSalesmenIds(allSalesmanIds);
                setShowSalesmenPicker(false);
              }}
            >
              <Text style={styles.pickerOptionText}>Όλοι</Text>
            </TouchableOpacity>
            {availableSalesmen.map(salesman => {
              const currentSelection = Array.isArray(selectedSalesmenIds) ? selectedSalesmenIds : [];
              const isSelected = currentSelection.includes(salesman.id);
              return (
                <TouchableOpacity
                  key={salesman.id}
                  style={styles.pickerOption}
                  onPress={() => {
                    if (isSelected) {
                      // Remove this salesman
                      const filtered = currentSelection.filter(id => id !== salesman.id);
                      setSelectedSalesmenIds(filtered.length > 0 ? filtered : []);
                    } else {
                      // Add this salesman
                      setSelectedSalesmenIds([...currentSelection, salesman.id]);
                    }
                  }}
                >
                  <Ionicons 
                    name={isSelected ? "checkbox" : "square-outline"} 
                    size={20} 
                    color={colors.primary} 
                  />
                  <Text style={styles.pickerOptionText}>{salesman.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Customer Category Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Φίλτρο Πελατών</Text>

          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setDropdownOpen(prev => ({ ...prev, region: !prev.region }))}
          >
            <Text style={styles.dropdownButtonText}>
              {selectedRegions.length > 0
                ? `Περιοχές (${selectedRegions.length})`
                : 'Όλες οι Περιοχές'}
            </Text>
            <Ionicons name={dropdownOpen.region ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
          </TouchableOpacity>
          {dropdownOpen.region && (
            <View style={styles.pickerContainer}>
              <TouchableOpacity style={styles.pickerOption} onPress={() => setSelectedRegions([])}>
                <Ionicons name="close-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.pickerOptionText}>Καμία επιλογή</Text>
              </TouchableOpacity>
              {(availableRegions.length === 0) ? (
                <View style={styles.pickerOption}>
                  <Text style={styles.pickerOptionText}>Δεν υπάρχουν διαθέσιμες περιοχές</Text>
                </View>
              ) : (
                <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                  {availableRegions.map(region => {
                    const isSelected = selectedRegions.includes(region);
                    return (
                      <TouchableOpacity
                        key={region}
                        style={styles.pickerOption}
                        onPress={() => {
                          setSelectedRegions(prev => 
                            prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
                          );
                        }}
                      >
                        <Ionicons 
                          name={isSelected ? "checkbox" : "square-outline"} 
                          size={20} 
                          color={colors.primary} 
                        />
                        <Text style={styles.pickerOptionText}>{region}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setDropdownOpen(prev => ({ ...prev, salesGroup: !prev.salesGroup }))}
          >
            <Text style={styles.dropdownButtonText}>
              {selectedSalesGroups.length > 0
                ? `Sales Group (${selectedSalesGroups.length})`
                : 'Όλα τα Sales Group'}
            </Text>
            <Ionicons name={dropdownOpen.salesGroup ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
          </TouchableOpacity>
          {dropdownOpen.salesGroup && (
            <View style={styles.pickerContainer}>
              <TouchableOpacity style={styles.pickerOption} onPress={() => setSelectedSalesGroups([])}>
                <Ionicons name="close-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.pickerOptionText}>Καμία επιλογή</Text>
              </TouchableOpacity>
              {(availableSalesGroups.length === 0) ? (
                <View style={styles.pickerOption}>
                  <Text style={styles.pickerOptionText}>Δεν υπάρχουν διαθέσιμες επιλογές</Text>
                </View>
              ) : (
                <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                  {availableSalesGroups.map(group => {
                    const isSelected = selectedSalesGroups.includes(group);
                    return (
                      <TouchableOpacity
                        key={group}
                        style={styles.pickerOption}
                        onPress={() => {
                          setSelectedSalesGroups(prev => 
                            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
                          );
                        }}
                      >
                        <Ionicons 
                          name={isSelected ? "checkbox" : "square-outline"} 
                          size={20} 
                          color={colors.primary} 
                        />
                        <Text style={styles.pickerOptionText}>{group}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setDropdownOpen(prev => ({ ...prev, prefecture: !prev.prefecture }))}
          >
            <Text style={styles.dropdownButtonText}>
              {selectedPrefectures.length > 0
                ? `Νομοί (${selectedPrefectures.length})`
                : 'Όλοι οι Νομοί'}
            </Text>
            <Ionicons name={dropdownOpen.prefecture ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
          </TouchableOpacity>
          {dropdownOpen.prefecture && (
            <View style={styles.pickerContainer}>
              <TouchableOpacity style={styles.pickerOption} onPress={() => setSelectedPrefectures([])}>
                <Ionicons name="close-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.pickerOptionText}>Καμία επιλογή</Text>
              </TouchableOpacity>
              {(availablePrefectures.length === 0) ? (
                <View style={styles.pickerOption}>
                  <Text style={styles.pickerOptionText}>Δεν υπάρχουν διαθέσιμες επιλογές</Text>
                </View>
              ) : (
                <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                  {availablePrefectures.map(prefecture => {
                    const isSelected = selectedPrefectures.includes(prefecture);
                    return (
                      <TouchableOpacity
                        key={prefecture}
                        style={styles.pickerOption}
                        onPress={() => {
                          setSelectedPrefectures(prev => 
                            prev.includes(prefecture) ? prev.filter(p => p !== prefecture) : [...prev, prefecture]
                          );
                        }}
                      >
                        <Ionicons 
                          name={isSelected ? "checkbox" : "square-outline"} 
                          size={20} 
                          color={colors.primary} 
                        />
                        <Text style={styles.pickerOptionText}>{prefecture}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* Monthly Comparison Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Μηνιαία Σύγκριση Πωλήσεων</Text>
          
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.monthColumn]}>Μήνας</Text>
            {availableYears.map(year => (
              <Text key={year} style={[styles.tableHeaderText, styles.valueColumn]}>
                {year}
              </Text>
            ))}
            <Text style={[styles.tableHeaderText, styles.changeColumn]}>Μεταβολή</Text>
          </View>

          {/* Table Rows */}
          {monthlyData && MONTHS.map((month, index) => {
            const currentAmount = monthlyData[currentYear]?.[index] || 0;
            const previousAmount = monthlyData[currentYear - 1]?.[index] || 0;
            const change = previousAmount > 0 
              ? ((currentAmount - previousAmount) / previousAmount) * 100 
              : (currentAmount > 0 ? 100 : 0);

            return (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCellText, styles.monthColumn]}>{month}</Text>
                <Text style={[styles.tableCellText, styles.valueColumn]}>
                  {formatCurrency(currentAmount)}
                </Text>
                <Text style={[styles.tableCellText, styles.valueColumn]}>
                  {formatCurrency(previousAmount)}
                </Text>
                <Text style={[styles.tableCellText, styles.changeColumn, { color: change >= 0 ? '#4caf50' : '#f44336' }]}>
                  {formatPercentage(change)}
                </Text>
              </View>
            );
          })}

          {/* Total Row */}
          {monthlyData && (
            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tableCellText, styles.monthColumn, styles.totalText]}>Σύνολο</Text>
              <Text style={[styles.tableCellText, styles.valueColumn, styles.totalText]}>
                {formatCurrency(monthlyData[currentYear].reduce((sum, val) => sum + val, 0))}
              </Text>
              <Text style={[styles.tableCellText, styles.valueColumn, styles.totalText]}>
                {formatCurrency(monthlyData[currentYear - 1].reduce((sum, val) => sum + val, 0))}
              </Text>
              <Text style={[styles.tableCellText, styles.changeColumn, styles.totalText]}>
                {(() => {
                  const currentTotal = monthlyData[currentYear].reduce((sum, val) => sum + val, 0);
                  const previousTotal = monthlyData[currentYear - 1].reduce((sum, val) => sum + val, 0);
                  const totalChange = previousTotal > 0 
                    ? ((currentTotal - previousTotal) / previousTotal) * 100 
                    : (currentTotal > 0 ? 100 : 0);
                  return formatPercentage(totalChange);
                })()}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  filterSection: {
    padding: 16,
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  section: {
    padding: 16,
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  totalRow: {
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 0,
    marginTop: 4,
    borderRadius: 8,
  },
  tableCellText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  totalText: {
    fontWeight: '700',
  },
  monthColumn: {
    flex: 2,
  },
  valueColumn: {
    flex: 2,
    textAlign: 'right',
  },
  changeColumn: {
    flex: 1.5,
    textAlign: 'right',
    fontWeight: '600',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  pickerContainer: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
    marginBottom: 16,
    maxHeight: 300,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  pickerScroll: {
    maxHeight: 240,
  },
});

