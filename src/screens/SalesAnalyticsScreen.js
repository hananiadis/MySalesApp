// src/screens/SalesAnalyticsScreen.js
// Analytics dashboard showing salesman performance metrics and insights

import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PieChart, LineChart } from 'react-native-chart-kit';
import SafeScreen from '../components/SafeScreen';
import colors from '../theme/colors';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };
const SCREEN_WIDTH = Dimensions.get('window').width;

const CHART_CONFIG = {
  backgroundColor: colors.white,
  backgroundGradientFrom: colors.white,
  backgroundGradientTo: colors.white,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(98, 0, 238, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: colors.primary,
  },
};

const RANKING_FILTERS = {
  VOLUME: 'volume',
  GROWTH: 'growth',
  CONTRACTION: 'contraction',
};

const ACTIVITY_FILTERS = {
  REGION: 'region',
  SALES_GROUP: 'salesGroup',
  PREFECTURE: 'prefecture',
  CITY: 'city',
  TAX_OFFICE: 'taxOffice',
};

const formatCurrency = (value) => {
  if (value == null || !Number.isFinite(value)) return '€0';
  return value.toLocaleString('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
};

const formatPercentage = (value) => {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

export default function SalesAnalyticsScreen({ route, navigation }) {
  const { brand = 'playmobil' } = route?.params || {};
  
  const [status, setStatus] = useState(STATUS.LOADING);
  const [selectedSalesmen, setSelectedSalesmen] = useState([]);
  const [availableSalesmen, setAvailableSalesmen] = useState([]);
  const [salesData, setSalesData] = useState(null); // { current, previous, byYear }
  const [customersData, setCustomersData] = useState([]);
  const [error, setError] = useState(null);
  
  // Filter states
  const [rankingFilter, setRankingFilter] = useState(RANKING_FILTERS.VOLUME);
  const [activityFilter, setActivityFilter] = useState(ACTIVITY_FILTERS.REGION);
  const [showSalesmenPicker, setShowSalesmenPicker] = useState(false);
  const [expandedActivityCategory, setExpandedActivityCategory] = useState(null);

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const currentMonth = new Date().getMonth();

  // Load data only when brand changes, not when salesmen filter changes
  useEffect(() => {
    loadData();
  }, [brand]);
  
  // Set default salesmen selection when available salesmen load
  useEffect(() => {
    if (availableSalesmen.length > 0 && selectedSalesmen.length === 0) {
      console.log('[SalesAnalytics] Setting default salesmen selection');
      setSelectedSalesmen(availableSalesmen.map(s => s.code));
    }
  }, [availableSalesmen]);

  const loadData = async () => {
    console.log('[SalesAnalytics] ===== LOAD DATA START =====');
    console.log('[SalesAnalytics] Brand:', brand);
    console.log('[SalesAnalytics] Selected salesmen:', selectedSalesmen);
    
    try {
      setStatus(STATUS.LOADING);
      
      // Load user's linked salesmen
      console.log('[SalesAnalytics] Loading user salesmen...');
      const startSalesmen = Date.now();
      const { getUserSalesmen } = await import('../services/userService');
      const userSalesmen = await getUserSalesmen(brand);
      console.log(`[SalesAnalytics] User salesmen loaded (${Date.now() - startSalesmen}ms):`, userSalesmen.length);
      setAvailableSalesmen(userSalesmen);
      
      // Load sales data based on brand
      console.log('[SalesAnalytics] Loading sales data for brand:', brand);
      const startSales = Date.now();
      let sales = null;
      let customers = [];
      
      // Load valid customer codes from Firestore to filter spreadsheet data
      console.log('[SalesAnalytics] Loading valid customer codes from Firestore...');
      const { getValidCustomerCodes } = await import('../services/userService');
      const validCustomerCodes = await getValidCustomerCodes(brand);
      console.log('[SalesAnalytics] Valid customer codes loaded:', validCustomerCodes.size);
      
      if (brand === 'playmobil') {
        console.log('[SalesAnalytics] Loading Playmobil data...');
        const { getAllSheetsData } = await import('../services/playmobilKpi');
        console.log('[SalesAnalytics] Calling getAllSheetsData...');
        const sheetsData = await getAllSheetsData();
        console.log(`[SalesAnalytics] Sheets data loaded (${Date.now() - startSales}ms)`);
        console.log('[SalesAnalytics] Sheets data loaded records - 2025:', sheetsData.invoiced2025?.length || 0, '2024:', sheetsData.invoiced2024?.length || 0);
        
        // Filter to only include customers that exist in Firestore
        const filterByCustomer = (records) => records.filter(r => {
          const customerCode = String(r.customerCode || r.code || '').trim();
          return validCustomerCodes.has(customerCode);
        });
        
        const currentFiltered = filterByCustomer(sheetsData.invoiced2025 || []);
        const previousFiltered = filterByCustomer(sheetsData.invoiced2024 || []);
        
        console.log('[SalesAnalytics] After customer filter - 2025:', currentFiltered.length, '2024:', previousFiltered.length);
        
        // Store filtered sales data
        sales = {
          current: currentFiltered,
          previous: previousFiltered,
        };
        
        console.log('[SalesAnalytics] Stored sales - current:', sales.current.length, 'previous:', sales.previous.length);
        
        // Load customers
        console.log('[SalesAnalytics] Loading customers...');
        const startCustomers = Date.now();
        const { getCustomersFromLocal } = await import('../utils/localData');
        customers = await getCustomersFromLocal(brand);
        console.log(`[SalesAnalytics] Customers loaded (${Date.now() - startCustomers}ms):`, customers.length);
      } else if (brand === 'kivos') {
        console.log('[SalesAnalytics] Loading Kivos data...');
        const { getAllSheetsData } = await import('../services/kivosKpi');
        console.log('[SalesAnalytics] Calling getAllSheetsData...');
        const sheetsData = await getAllSheetsData();
        console.log(`[SalesAnalytics] Sheets data loaded (${Date.now() - startSales}ms)`);
        console.log('[SalesAnalytics] Sheets data loaded records - 2025:', sheetsData.sales2025?.length || 0, '2024:', sheetsData.sales2024?.length || 0, '2023:', sheetsData.sales2023?.length || 0, '2022:', sheetsData.sales2022?.length || 0);
        
        // Filter to only include customers that exist in Firestore
        const filterByCustomer = (records) => records.filter(r => {
          const customerCode = String(r.customerCode || r.code || '').trim();
          return validCustomerCodes.size === 0 ? true : validCustomerCodes.has(customerCode);
        });
        
        const byYear = {
          [currentYear]: filterByCustomer(sheetsData[`sales${currentYear}`] || []),
          [previousYear]: filterByCustomer(sheetsData[`sales${previousYear}`] || []),
          [currentYear - 2]: filterByCustomer(sheetsData[`sales${currentYear - 2}`] || []),
          [currentYear - 3]: filterByCustomer(sheetsData[`sales${currentYear - 3}`] || []),
        };
        
        // Store filtered sales data (primary current/previous plus byYear map)
        sales = {
          current: byYear[currentYear] || [],
          previous: byYear[previousYear] || [],
          byYear,
        };
        
        console.log('[SalesAnalytics] Stored sales -', {
          current: sales.current.length,
          previous: sales.previous.length,
          y2: byYear[currentYear - 2]?.length || 0,
          y3: byYear[currentYear - 3]?.length || 0,
        });
        
        // Load customers
        console.log('[SalesAnalytics] Loading customers...');
        const startCustomers = Date.now();
        const { getCustomersFromLocal } = await import('../utils/localData');
        customers = await getCustomersFromLocal(brand);
        console.log(`[SalesAnalytics] Customers loaded (${Date.now() - startCustomers}ms):`, customers.length);
      }
      
      console.log('[SalesAnalytics] Setting state with loaded data...');
      setSalesData(sales);
      setCustomersData(customers);
      setStatus(STATUS.READY);
      console.log(`[SalesAnalytics] ===== LOAD DATA SUCCESS (${Date.now() - startSales}ms total) =====`);
      
    } catch (err) {
      console.error('[SalesAnalytics] ===== LOAD DATA ERROR =====');
      console.error('[SalesAnalytics] Error loading data:', err);
      console.error('[SalesAnalytics] Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack,
        brand: brand
      });
      setError(err.message || 'Αποτυχία φόρτωσης δεδομένων');
      setStatus(STATUS.ERROR);
    }
  };

  // Filter sales data by selected salesmen
  const filteredSalesData = useMemo(() => {
    if (!salesData) return null;

    // If no salesmen available, user is not linked to any salesmen - show empty data
    if (availableSalesmen.length === 0) {
      console.log('[SalesAnalytics] No salesmen available, showing empty data');
      return {
        current: [],
        previous: [],
      };
    }

    const salesmenToFilter =
      selectedSalesmen.length > 0
        ? availableSalesmen.filter((s) => selectedSalesmen.includes(s.code))
        : availableSalesmen;

    const salesmenNames = salesmenToFilter.map((s) => s.name);
    const salesmenKeys = new Set(
      salesmenToFilter.flatMap((s) => [s.name, s.code]).map((v) => String(v || '').trim().toLowerCase())
    );

    const isKivos = brand === 'kivos';
    const merchMap = isKivos
      ? customersData.reduce((acc, customer) => {
          const code = String(customer.customerCode || customer.code || '').trim().toUpperCase();
          const merch = Array.isArray(customer.merch) ? customer.merch : [];
          acc[code] = merch.map((m) => String(m || '').trim().toLowerCase());
          return acc;
        }, {})
      : null;

    console.log('[SalesAnalytics] Selected salesman codes:', selectedSalesmen);
    console.log('[SalesAnalytics] Filtering by salesman names:', salesmenNames);

    const filterBySalesman = (record) => {
      if (!isKivos) {
        const handledBy = (record.handledBy || '').trim();
        return salesmenNames.includes(handledBy);
      }
      const code = String(record.customerCode || record.code || '').trim().toUpperCase();
      const merchList = merchMap?.[code] || [];
      if (salesmenKeys.size === 0) return true;
      return merchList.some((m) => salesmenKeys.has(m));
    };

    const filteredCurrent = (salesData.current || salesData.byYear?.[currentYear] || []).filter(filterBySalesman);
    const filteredPrevious = (salesData.previous || salesData.byYear?.[previousYear] || []).filter(filterBySalesman);
    const filteredByYear = salesData.byYear
      ? Object.fromEntries(
          Object.entries(salesData.byYear).map(([year, arr]) => [year, arr.filter(filterBySalesman)])
        )
      : null;

    console.log('[SalesAnalytics] After salesman filter - current:', filteredCurrent.length, 'previous:', filteredPrevious.length);

    return {
      current: filteredCurrent,
      previous: filteredPrevious,
      byYear: filteredByYear,
    };
  }, [salesData, selectedSalesmen, availableSalesmen, customersData, brand]);

  // Calculate overview metrics
  const overviewMetrics = useMemo(() => {
    console.log('[SalesAnalytics] Calculating overview metrics...');
    if (!filteredSalesData) {
      console.log('[SalesAnalytics] No sales data, skipping overview');
      return null;
    }
    
    const startCalc = Date.now();
    const sumAmount = (arr = []) =>
      arr.reduce((sum, r) => {
        const amount = parseFloat(r.amount || r.total || r.value || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    const totalInvoiced = sumAmount(filteredSalesData.current);
    const previousTotal = sumAmount(filteredSalesData.previous);
    const prev2Total = filteredSalesData.byYear ? sumAmount(filteredSalesData.byYear[currentYear - 2]) : 0;
    const prev3Total = filteredSalesData.byYear ? sumAmount(filteredSalesData.byYear[currentYear - 3]) : 0;
    
    const uniqueCustomers = new Set(
      filteredSalesData.current.map(r => r.customerCode || r.code)
    ).size;
    
    // Count unique invoices (only count documents marked as "Invoice")
    const documentKeys = new Set(
      filteredSalesData.current
        .filter(r => {
          const docType = (r.documentType || '').toLowerCase();
          return r.documentNumber && docType.includes('invoice');
        })
        .map(r => r.documentNumber)
    ).size;
    
    console.log(`[SalesAnalytics] Overview calculated in ${Date.now() - startCalc}ms`);
    return {
      totalInvoiced,
      previousTotal,
      prev2Total,
      prev3Total,
      invoicedCustomers: uniqueCustomers,
      totalOrders: documentKeys,
    };
  }, [filteredSalesData, currentYear]);

  // Calculate monthly data for line chart
  const monthlyChartData = useMemo(() => {
    if (!filteredSalesData) return null;
    
    const currentYearMonthly = Array(12).fill(0);
    const previousYearMonthly = Array(12).fill(0);
    const year3Monthly = Array(12).fill(0);
    const year4Monthly = Array(12).fill(0);
    
    filteredSalesData.current.forEach(record => {
      const date = new Date(record.date || record.invoiceDate || record.Date);
      if (date.getFullYear() === currentYear) {
        const month = date.getMonth();
        const amount = parseFloat(record.amount || record.total || record.value || 0);
        if (Number.isFinite(amount)) {
          currentYearMonthly[month] += amount;
        }
      }
    });
    
    const process = (arr, targetYear, bucket) => {
      (arr || []).forEach((record) => {
        const date = new Date(record.date || record.invoiceDate || record.Date);
        if (date.getFullYear() === targetYear) {
          const month = date.getMonth();
          const amount = parseFloat(record.amount || record.total || record.value || 0);
          if (Number.isFinite(amount)) {
            bucket[month] += amount;
          }
        }
      });
    };

    process(filteredSalesData.previous, previousYear, previousYearMonthly);
    if (filteredSalesData.byYear) {
      process(filteredSalesData.byYear[currentYear - 2], currentYear - 2, year3Monthly);
      process(filteredSalesData.byYear[currentYear - 3], currentYear - 3, year4Monthly);
    }
    
    return {
      labels: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'],
      datasets: [
        {
          data: currentYearMonthly,
          color: (opacity = 1) => `rgba(98, 0, 238, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: previousYearMonthly,
          color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
          strokeWidth: 2,
          withDots: false,
        },
        {
          data: year3Monthly,
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
          strokeWidth: 2,
          withDots: false,
        },
        {
          data: year4Monthly,
          color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
          strokeWidth: 2,
          withDots: false,
        },
      ],
      legend: [`${currentYear}`, `${previousYear}`, `${currentYear - 2}`, `${currentYear - 3}`],
    };
  }, [filteredSalesData, currentYear, previousYear]);

  // Calculate top/bottom customers by ranking filter
  const rankedCustomers = useMemo(() => {
    console.log('[SalesAnalytics] Calculating ranked customers...');
    if (!filteredSalesData || !customersData) {
      console.log('[SalesAnalytics] Missing data for ranking, skipping');
      return [];
    }
    
    const startCalc = Date.now();
    // Group sales by customer
    const customerSales = {};
    
    filteredSalesData.current.forEach(record => {
      const customerCode = record.customerCode || record.code;
      const amount = parseFloat(record.amount || record.total || record.value || 0);
      
      if (!customerSales[customerCode]) {
        customerSales[customerCode] = {
          currentYear: 0,
          previousYear: 0,
          customerCode,
        };
      }
      
      if (Number.isFinite(amount)) {
        customerSales[customerCode].currentYear += amount;
      }
    });
    
    filteredSalesData.previous.forEach(record => {
      const customerCode = record.customerCode || record.code;
      const amount = parseFloat(record.amount || record.total || record.value || 0);
      
      if (!customerSales[customerCode]) {
        customerSales[customerCode] = {
          currentYear: 0,
          previousYear: 0,
          customerCode,
        };
      }
      
      if (Number.isFinite(amount)) {
        customerSales[customerCode].previousYear += amount;
      }
    });
    
    console.log(`[SalesAnalytics] Grouped ${Object.keys(customerSales).length} customers`);
    
    // Calculate growth/contraction
    const customersArray = Object.values(customerSales).map(cs => {
      const customer = customersData.find(c => 
        String(c.customerCode || c.code).trim() === String(cs.customerCode).trim()
      );
      
      // Calculate growth as absolute volume difference (not percentage)
      const growthVolume = cs.currentYear - cs.previousYear;
      const growthPercentage = cs.previousYear > 0
        ? ((cs.currentYear - cs.previousYear) / cs.previousYear) * 100
        : (cs.currentYear > 0 ? 100 : 0);
      
      return {
        ...cs,
        customerName: customer?.name || cs.customerCode,
        customerId: customer?.id || cs.customerCode,
        growth: growthPercentage,
        growthVolume,
      };
    });
    
    // Sort based on filter
    let sorted = [...customersArray];
    
    switch (rankingFilter) {
      case RANKING_FILTERS.VOLUME:
        sorted.sort((a, b) => b.currentYear - a.currentYear);
        break;
      case RANKING_FILTERS.GROWTH:
        // Sort by absolute growth volume (biggest increase)
        sorted.sort((a, b) => b.growthVolume - a.growthVolume);
        break;
      case RANKING_FILTERS.CONTRACTION:
        // Sort by absolute contraction volume (biggest decrease)
        sorted.sort((a, b) => a.growthVolume - b.growthVolume);
        break;
    }
    
    console.log(`[SalesAnalytics] Ranked customers calculated in ${Date.now() - startCalc}ms`);
    return sorted.slice(0, 10);
  }, [filteredSalesData, customersData, rankingFilter]);

  // Calculate activity breakdown
  const activityBreakdown = useMemo(() => {
    if (!filteredSalesData || !customersData) return [];
    
    const breakdown = {};
    
    // Process current year data
    filteredSalesData.current.forEach(record => {
      const customerCode = record.customerCode || record.code;
      const customer = customersData.find(c => 
        String(c.customerCode || c.code).trim() === String(customerCode).trim()
      );
      
      if (!customer) return;
      
      let category = 'Άλλο';
      switch (activityFilter) {
        case ACTIVITY_FILTERS.REGION:
          // Use transportation.zone from Firestore customer document
          category = customer.transportation?.zone || customer.transportationZone || customer.shippingZone || 'Χωρίς Περιοχή';
          break;
        case ACTIVITY_FILTERS.SALES_GROUP:
          // Use salesInfo.description for grouping (Sales Group filter)
          category = customer.salesInfo?.description || customer.salesInfo?.groupKeyText || customer.salesGroup || customer.descriptionSalesGroup || 'Χωρίς Sales Group';
          break;
        case ACTIVITY_FILTERS.PREFECTURE:
          // Use region.name from Firestore (region is a map with id and name)
          category = customer.region?.name || customer.prefecture || customer.city || 'Χωρίς Νομό';
          break;
        case ACTIVITY_FILTERS.CITY:
          category = customer.city || customer.address?.city || 'Χωρίς Νομό';
          break;
        case ACTIVITY_FILTERS.TAX_OFFICE:
          category =
            customer.vatInfo?.office ||
            customer.vatInfo?.taxoffice ||
            customer.taxOffice ||
            'Χωρίς ΔΟΥ';
          break;
      }
      
      const amount = parseFloat(record.amount || record.total || record.value || 0);
      
      if (!breakdown[category]) {
        breakdown[category] = {
          name: category,
          currentYear: 0,
          previousYear: 0,
          customers: new Set(),
          customerDetails: {}, // Track individual customer sales
        };
      }
      
      if (Number.isFinite(amount)) {
        breakdown[category].currentYear += amount;
      }
      breakdown[category].customers.add(customerCode);
      
      // Track customer details for drill-down
      if (!breakdown[category].customerDetails[customerCode]) {
        breakdown[category].customerDetails[customerCode] = {
          customerCode,
          customerName: customer.name || customerCode,
          customerId: customer.id || customerCode,
          currentYear: 0,
          previousYear: 0,
        };
      }
      breakdown[category].customerDetails[customerCode].currentYear += amount;
    });
    
    // Process previous year data
    filteredSalesData.previous.forEach(record => {
      const customerCode = record.customerCode || record.code;
      const customer = customersData.find(c => 
        String(c.customerCode || c.code).trim() === String(customerCode).trim()
      );
      
      if (!customer) return;
      
      let category = 'Άλλο';
      
      switch (activityFilter) {
        case ACTIVITY_FILTERS.REGION:
          category = customer.transportation?.zone || customer.transportationZone || customer.shippingZone || 'Χωρίς Περιοχή';
          break;
        case ACTIVITY_FILTERS.SALES_GROUP:
          category = customer.salesInfo?.description || customer.salesInfo?.groupKeyText || customer.salesGroup || customer.descriptionSalesGroup || 'Χωρίς Sales Group';
          break;
        case ACTIVITY_FILTERS.PREFECTURE:
          category = customer.region?.name || customer.prefecture || customer.city || 'Χωρίς Νομό';
          break;
        case ACTIVITY_FILTERS.CITY:
          category = customer.city || customer.address?.city || 'Χωρίς Νομό';
          break;
        case ACTIVITY_FILTERS.TAX_OFFICE:
          category =
            customer.vatInfo?.office ||
            customer.vatInfo?.taxoffice ||
            customer.taxOffice ||
            'Χωρίς ΔΟΥ';
          break;
      }
      
      const amount = parseFloat(record.amount || record.total || record.value || 0);
      
      if (!breakdown[category]) {
        breakdown[category] = {
          name: category,
          currentYear: 0,
          previousYear: 0,
          customers: new Set(),
          customerDetails: {},
        };
      }
      
      if (Number.isFinite(amount)) {
        breakdown[category].previousYear += amount;
      }
      
      // Track customer details for drill-down
      if (!breakdown[category].customerDetails[customerCode]) {
        breakdown[category].customerDetails[customerCode] = {
          customerCode,
          customerName: customer.name || customerCode,
          customerId: customer.id || customerCode,
          currentYear: 0,
          previousYear: 0,
        };
      }
      breakdown[category].customerDetails[customerCode].previousYear += amount;
    });
    
    return Object.values(breakdown)
      .map(b => {
        const growthVolume = b.currentYear - b.previousYear;
        const growthPercentage = b.previousYear > 0
          ? ((b.currentYear - b.previousYear) / b.previousYear) * 100
          : (b.currentYear > 0 ? 100 : 0);
        
        return {
          ...b,
          customers: b.customers.size,
          customerList: Object.values(b.customerDetails).sort((a, b) => b.currentYear - a.currentYear),
          growthVolume,
          growthPercentage,
        };
      })
      .sort((a, b) => b.currentYear - a.currentYear);
  }, [filteredSalesData, customersData, activityFilter]);

  // Calculate real-time metrics (MTD)
  const realTimeMetrics = useMemo(() => {
    if (!filteredSalesData) return null;
    
    const today = new Date();
    const currentDay = today.getDate();
    
    // MTD Current Year Sales (up to current day of month)
    const mtdCurrentSales = filteredSalesData.current
      .filter(record => {
        const date = new Date(record.date || record.invoiceDate || record.Date);
        return date.getFullYear() === currentYear && 
               date.getMonth() === currentMonth &&
               date.getDate() <= currentDay;
      })
      .reduce((sum, r) => {
        const amount = parseFloat(r.amount || r.total || r.value || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    
    // MTD Previous Year Sales (same period - up to same day of month)
    const mtdPreviousSales = filteredSalesData.previous
      .filter(record => {
        const date = new Date(record.date || record.invoiceDate || record.Date);
        return date.getFullYear() === previousYear && 
               date.getMonth() === currentMonth &&
               date.getDate() <= currentDay;
      })
      .reduce((sum, r) => {
        const amount = parseFloat(r.amount || r.total || r.value || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    
    // Full Month Previous Year Sales (entire month)
    const fullMonthPreviousSales = filteredSalesData.previous
      .filter(record => {
        const date = new Date(record.date || record.invoiceDate || record.Date);
        return date.getFullYear() === previousYear && date.getMonth() === currentMonth;
      })
      .reduce((sum, r) => {
        const amount = parseFloat(r.amount || r.total || r.value || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    
    const mtdSalesChange = mtdPreviousSales > 0
      ? ((mtdCurrentSales - mtdPreviousSales) / mtdPreviousSales) * 100
      : (mtdCurrentSales > 0 ? 100 : 0);
    
    // MTD Current Year Active Customers
    const mtdCurrentCustomers = new Set(
      filteredSalesData.current
        .filter(record => {
          const date = new Date(record.date || record.invoiceDate || record.Date);
          return date.getFullYear() === currentYear && 
                 date.getMonth() === currentMonth &&
                 date.getDate() <= currentDay;
        })
        .map(r => r.customerCode || r.code)
    ).size;
    
    // MTD Previous Year Active Customers (same period)
    const mtdPreviousCustomers = new Set(
      filteredSalesData.previous
        .filter(record => {
          const date = new Date(record.date || record.invoiceDate || record.Date);
          return date.getFullYear() === previousYear && 
                 date.getMonth() === currentMonth &&
                 date.getDate() <= currentDay;
        })
        .map(r => r.customerCode || r.code)
    ).size;
    
    // Full Month Previous Year Active Customers (entire month)
    const fullMonthPreviousCustomers = new Set(
      filteredSalesData.previous
        .filter(record => {
          const date = new Date(record.date || record.invoiceDate || record.Date);
          return date.getFullYear() === previousYear && date.getMonth() === currentMonth;
        })
        .map(r => r.customerCode || r.code)
    ).size;
    
    const mtdCustomersChange = mtdCurrentCustomers - mtdPreviousCustomers;
    
    // New customers activated this month (invoiced for first time in current year during current month)
    const customersBeforeThisMonth = new Set(
      filteredSalesData.current
        .filter(record => {
          const date = new Date(record.date || record.invoiceDate || record.Date);
          return date.getFullYear() === currentYear && date.getMonth() < currentMonth;
        })
        .map(r => r.customerCode || r.code)
    );
    
    const customersThisMonth = new Set(
      filteredSalesData.current
        .filter(record => {
          const date = new Date(record.date || record.invoiceDate || record.Date);
          return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
        })
        .map(r => r.customerCode || r.code)
    );
    
    const newCustomers = [...customersThisMonth].filter(
      code => !customersBeforeThisMonth.has(code)
    ).length;
    
    return {
      mtdSales: mtdCurrentSales,
      mtdPreviousSales,
      fullMonthPreviousSales,
      mtdSalesChange,
      mtdCustomers: mtdCurrentCustomers,
      mtdPreviousCustomers,
      fullMonthPreviousCustomers,
      mtdCustomersChange,
      newCustomers,
      monthlyBudget: null, // Will be added later
    };
  }, [filteredSalesData, currentYear, previousYear, currentMonth]);

  const handleCustomerPress = (customerCode, customerId) => {
    const screenName = brand === 'playmobil' ? 'CustomerSalesSummary' :
                       brand === 'kivos' ? 'KivosCustomerDetail' :
                       'JohnCustomerDetail';
    
    navigation.navigate(screenName, { 
      customerId: customerId || customerCode, 
      brand 
    });
  };

  if (status === STATUS.LOADING) {
    return (
      <SafeScreen title="Αναλυτικά Πωλήσεων">
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Φόρτωση δεδομένων...</Text>
        </View>
      </SafeScreen>
    );
  }

  if (status === STATUS.ERROR) {
    return (
      <SafeScreen title="Αναλυτικά Πωλήσεων">
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Επανάληψη</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  // Check if user has no linked salesmen after data loads
  if (status === STATUS.READY && availableSalesmen.length === 0) {
    return (
      <SafeScreen title="Αναλυτικά Πωλήσεων">
        <View style={styles.center}>
          <Ionicons name="people-outline" size={64} color={colors.gray} />
          <Text style={styles.errorText}>Δεν έχετε συνδεδεμένους πωλητές</Text>
          <Text style={styles.infoText}>
            Επικοινωνήστε με τον διαχειριστή για να συνδέσετε πωλητές στον λογαριασμό σας.
          </Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen title="Αναλυτικά Πωλήσεων" scroll>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Salesmen Filter - Only show if salesmen are available */}
        {availableSalesmen.length > 0 && (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Πωλητές:</Text>
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setShowSalesmenPicker(!showSalesmenPicker)}
            >
              <Text style={styles.filterButtonText}>
                {selectedSalesmen.length === availableSalesmen.length 
                  ? 'Όλοι οι πωλητές' 
                  : `${selectedSalesmen.length} επιλεγμένοι`}
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
                setSelectedSalesmen(availableSalesmen.map(s => s.code));
                setShowSalesmenPicker(false);
              }}
            >
              <Text style={styles.pickerOptionText}>Όλοι</Text>
            </TouchableOpacity>
            {availableSalesmen.map(salesman => (
              <TouchableOpacity
                key={salesman.code}
                style={styles.pickerOption}
                onPress={() => {
                  if (selectedSalesmen.includes(salesman.code)) {
                    setSelectedSalesmen(selectedSalesmen.filter(c => c !== salesman.code));
                  } else {
                    setSelectedSalesmen([...selectedSalesmen, salesman.code]);
                  }
                }}
              >
                <Ionicons 
                  name={selectedSalesmen.includes(salesman.code) ? "checkbox" : "square-outline"} 
                  size={20} 
                  color={colors.primary} 
                />
                <Text style={styles.pickerOptionText}>{salesman.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Overview Cards */}
        {overviewMetrics && (
          <View style={styles.overviewSection}>
            <Text style={styles.sectionTitle}>Επισκόπηση</Text>
            <View style={styles.overviewCards}>
              <View style={styles.overviewCard}>
                <Text style={styles.overviewValue}>{formatCurrency(overviewMetrics.totalInvoiced)}</Text>
                <Text style={styles.overviewLabel}>Συνολικές Πωλήσεις</Text>
              </View>
              <View style={styles.overviewCard}>
                <Text style={styles.overviewValue}>{overviewMetrics.invoicedCustomers}</Text>
                <Text style={styles.overviewLabel}>Πελάτες</Text>
              </View>
              <View style={styles.overviewCard}>
                <Text style={styles.overviewValue}>{overviewMetrics.totalOrders}</Text>
                <Text style={styles.overviewLabel}>Παραστατικά</Text>
                <Text style={styles.overviewSubLabel}>(Μοναδικά Τιμολόγια)</Text>
              </View>
            </View>
          </View>
        )}

        {/* Real-Time Metrics */}
        {realTimeMetrics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Τρέχων Μήνας</Text>
            <View style={styles.metricsGrid}>
              {/* MTD Sales Card */}
              <View style={styles.metricCard}>
                <Ionicons name="trending-up" size={32} color={colors.primary} />
                <Text style={styles.metricValue}>{formatCurrency(realTimeMetrics.mtdSales)}</Text>
                <Text style={styles.metricLabel}>Πωλήσεις MTD {currentYear}</Text>
                <Text style={styles.metricSubLabel}>
                  vs {formatCurrency(realTimeMetrics.mtdPreviousSales)} MTD {previousYear}
                </Text>
                <Text style={[styles.metricChange, { color: realTimeMetrics.mtdSalesChange >= 0 ? '#4caf50' : '#f44336' }]}>
                  {formatPercentage(realTimeMetrics.mtdSalesChange)}
                </Text>
                <Text style={styles.metricSubLabel}>
                  Ολόκληρος {previousYear}: {formatCurrency(realTimeMetrics.fullMonthPreviousSales)}
                </Text>
              </View>
              
              {/* MTD Active Customers Card */}
              <View style={styles.metricCard}>
                <Ionicons name="people" size={32} color={colors.primary} />
                <Text style={styles.metricValue}>{realTimeMetrics.mtdCustomers}</Text>
                <Text style={styles.metricLabel}>Ενεργοί Πελάτες MTD {currentYear}</Text>
                <Text style={styles.metricSubLabel}>
                  vs {realTimeMetrics.mtdPreviousCustomers} MTD {previousYear}
                </Text>
                <Text style={[styles.metricChange, { color: realTimeMetrics.mtdCustomersChange >= 0 ? '#4caf50' : '#f44336' }]}>
                  {realTimeMetrics.mtdCustomersChange >= 0 ? '+' : ''}{realTimeMetrics.mtdCustomersChange}
                </Text>
                <Text style={styles.metricSubLabel}>
                  Ολόκληρος {previousYear}: {realTimeMetrics.fullMonthPreviousCustomers}
                </Text>
              </View>
              
              {/* New Customers Card */}
              <View style={styles.metricCard}>
                <Ionicons name="person-add" size={32} color={colors.primary} />
                <Text style={styles.metricValue}>{realTimeMetrics.newCustomers}</Text>
                <Text style={styles.metricLabel}>Νέοι Πελάτες {currentYear}</Text>
                <Text style={styles.metricSubLabel}>
                  (Τιμολόγηση για 1η φορά φέτος)
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Performance Graph */}
        {monthlyChartData && (
          <TouchableOpacity 
            style={styles.section}
            onPress={() => {
              console.log('[SalesAnalytics] Navigating to MonthlyComparison...');
              console.log('[SalesAnalytics] selectedSalesmen (codes):', selectedSalesmen);
              console.log('[SalesAnalytics] availableSalesmen:', availableSalesmen.map(s => ({ code: s.code, name: s.name })));
              console.log('[SalesAnalytics] filteredSalesData sizes:', {
                current: filteredSalesData?.current?.length || 0,
                previous: filteredSalesData?.previous?.length || 0,
              });
              
              // salesman.code is already in merchId format (e.g., "playmobil_ΑΝΑΝΙΑΔΗΣ ΧΑΡΗΣ")
              // This is what the hook expects
              const selectedIds = selectedSalesmen.length > 0 
                ? availableSalesmen
                    .filter(s => selectedSalesmen.includes(s.code))
                    .map(s => s.code)
                : availableSalesmen.map(s => s.code);
              
              console.log('[SalesAnalytics] Calculated selectedIds (merchId format):', selectedIds);
              console.log('[SalesAnalytics] Navigation params:', {
                brand
              });
              console.log('[SalesAnalytics] Navigating with brand:', brand, 'selectedIds length:', selectedIds.length);
              
              navigation.navigate('MonthlyComparison', {
                brand
              });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>Μηνιαία Απόδοση {currentYear}</Text>
            <LineChart
              data={monthlyChartData}
              width={SCREEN_WIDTH - 32}
              height={220}
              chartConfig={CHART_CONFIG}
              bezier
              style={styles.chart}
              withInnerLines={false}
              withOuterLines={true}
              withVerticalLabels={true}
              withHorizontalLabels={true}
            />
          </TouchableOpacity>
        )}

        {/* Top Performers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Κατάταξη Πελατών</Text>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.smallFilterButton, rankingFilter === RANKING_FILTERS.VOLUME && styles.activeFilterButton]}
              onPress={() => setRankingFilter(RANKING_FILTERS.VOLUME)}
            >
              <Text style={[styles.smallFilterText, rankingFilter === RANKING_FILTERS.VOLUME && styles.activeFilterText]}>
                Μεγαλύτεροι Πελάτες
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallFilterButton, rankingFilter === RANKING_FILTERS.GROWTH && styles.activeFilterButton]}
              onPress={() => setRankingFilter(RANKING_FILTERS.GROWTH)}
            >
              <Text style={[styles.smallFilterText, rankingFilter === RANKING_FILTERS.GROWTH && styles.activeFilterText]}>
                Μεγαλύτερη Αύξηση
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallFilterButton, rankingFilter === RANKING_FILTERS.CONTRACTION && styles.activeFilterButton]}
              onPress={() => setRankingFilter(RANKING_FILTERS.CONTRACTION)}
            >
              <Text style={[styles.smallFilterText, rankingFilter === RANKING_FILTERS.CONTRACTION && styles.activeFilterText]}>
                Μεγαλύτερη Μείωση
              </Text>
            </TouchableOpacity>
          </View>
          
          {rankedCustomers.map((customer, index) => (
            <TouchableOpacity
              key={customer.customerCode}
              style={styles.customerRow}
              onPress={() => handleCustomerPress(customer.customerCode, customer.customerId)}
            >
              <View style={styles.customerRank}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{customer.customerName}</Text>
                <Text style={styles.customerAmount}>
                  {currentYear}: {formatCurrency(customer.currentYear)}
                </Text>
                <Text style={styles.customerAmountSecondary}>
                  {previousYear}: {formatCurrency(customer.previousYear)}
                </Text>
              </View>
              <View style={styles.customerMetric}>
                <Text style={[styles.growthText, { color: customer.growth >= 0 ? '#4caf50' : '#f44336' }]}>
                  {formatPercentage(customer.growth)}
                </Text>
                <Text style={[styles.growthVolumeText, { color: customer.growthVolume >= 0 ? '#4caf50' : '#f44336' }]}>
                  {customer.growthVolume >= 0 ? '+' : ''}{formatCurrency(customer.growthVolume)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Activity Sources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ανάλυση Δραστηριότητας</Text>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.smallFilterButton, activityFilter === ACTIVITY_FILTERS.REGION && styles.activeFilterButton]}
              onPress={() => setActivityFilter(ACTIVITY_FILTERS.REGION)}
            >
              <Text style={[styles.smallFilterText, activityFilter === ACTIVITY_FILTERS.REGION && styles.activeFilterText]}>
                Περιοχή
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallFilterButton, activityFilter === ACTIVITY_FILTERS.SALES_GROUP && styles.activeFilterButton]}
              onPress={() => setActivityFilter(ACTIVITY_FILTERS.SALES_GROUP)}
            >
              <Text style={[styles.smallFilterText, activityFilter === ACTIVITY_FILTERS.SALES_GROUP && styles.activeFilterText]}>
                Sales Group
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallFilterButton, activityFilter === ACTIVITY_FILTERS.PREFECTURE && styles.activeFilterButton]}
              onPress={() => setActivityFilter(ACTIVITY_FILTERS.PREFECTURE)}
            >
              <Text style={[styles.smallFilterText, activityFilter === ACTIVITY_FILTERS.PREFECTURE && styles.activeFilterText]}>
                Νομός
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallFilterButton, activityFilter === ACTIVITY_FILTERS.CITY && styles.activeFilterButton]}
              onPress={() => setActivityFilter(ACTIVITY_FILTERS.CITY)}
            >
              <Text style={[styles.smallFilterText, activityFilter === ACTIVITY_FILTERS.CITY && styles.activeFilterText]}>
                Πόλη
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallFilterButton, activityFilter === ACTIVITY_FILTERS.TAX_OFFICE && styles.activeFilterButton]}
              onPress={() => setActivityFilter(ACTIVITY_FILTERS.TAX_OFFICE)}
            >
              <Text style={[styles.smallFilterText, activityFilter === ACTIVITY_FILTERS.TAX_OFFICE && styles.activeFilterText]}>
                ΔΟΥ
              </Text>
            </TouchableOpacity>
          </View>
          
          {activityBreakdown.slice(0, 8).map((item, index) => {
            const totalAmount = activityBreakdown.reduce((sum, i) => sum + i.currentYear, 0);
            const percentage = totalAmount > 0 ? (item.currentYear / totalAmount) * 100 : 0;
            const isExpanded = expandedActivityCategory === item.name;
            
            return (
              <View key={index}>
                <TouchableOpacity
                  style={styles.activityRow}
                  onPress={() => setExpandedActivityCategory(isExpanded ? null : item.name)}
                >
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>{item.name}</Text>
                    <Text style={styles.activityAmount}>
                      {currentYear}: {formatCurrency(item.currentYear)}
                    </Text>
                    <Text style={styles.activityAmountSecondary}>
                      {previousYear}: {formatCurrency(item.previousYear)}
                    </Text>
                    <View style={styles.activityBar}>
                      <View style={[styles.activityBarFill, { width: `${percentage}%` }]} />
                    </View>
                    <Text style={styles.activityStats}>
                      {percentage.toFixed(1)}% • {item.customers} πελάτες • 
                      <Text style={{ color: item.growthVolume >= 0 ? '#4caf50' : '#f44336' }}>
                        {item.growthVolume >= 0 ? '+' : ''}{formatCurrency(item.growthVolume)} ({formatPercentage(item.growthPercentage)})
                      </Text>
                    </Text>
                  </View>
                  <Ionicons 
                    name={isExpanded ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>
                
                {/* Expanded customer list */}
                {isExpanded && item.customerList && (
                  <View style={styles.expandedCustomerList}>
                    {item.customerList.map((cust, custIndex) => (
                      <TouchableOpacity
                        key={cust.customerCode}
                        style={styles.expandedCustomerRow}
                        onPress={() => handleCustomerPress(cust.customerCode, cust.customerId)}
                      >
                        <Text style={styles.expandedCustomerName} numberOfLines={1}>
                          {cust.customerName}
                        </Text>
                        <View style={styles.expandedCustomerAmounts}>
                          <Text style={styles.expandedCustomerAmount}>
                            {formatCurrency(cust.currentYear)}
                          </Text>
                          <Text style={styles.expandedCustomerAmountSecondary}>
                            vs {formatCurrency(cust.previousYear)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
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
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
  },
  infoText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  filterSection: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginRight: 8,
  },
  pickerContainer: {
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  pickerOptionText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 8,
  },
  overviewSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  overviewCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewCard: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: colors.white,
    textAlign: 'center',
  },
  overviewSubLabel: {
    fontSize: 10,
    color: colors.white,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  metricSubLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.8,
  },
  metricChange: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  filterButtons: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  smallFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeFilterButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  smallFilterText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  activeFilterText: {
    color: colors.white,
    fontWeight: '600',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  customerRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  customerAmount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  customerAmountSecondary: {
    fontSize: 11,
    color: colors.textSecondary,
    opacity: 0.7,
    marginTop: 2,
  },
  customerMetric: {
    marginRight: 8,
    alignItems: 'flex-end',
  },
  growthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  growthVolumeText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  activityAmount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  activityAmountSecondary: {
    fontSize: 11,
    color: colors.textSecondary,
    opacity: 0.7,
    marginBottom: 4,
  },
  activityBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 4,
  },
  activityBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  activityStats: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  expandedCustomerList: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    marginLeft: 8,
  },
  expandedCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderRadius: 6,
    marginBottom: 4,
  },
  expandedCustomerName: {
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  expandedCustomerAmounts: {
    alignItems: 'flex-end',
  },
  expandedCustomerAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  expandedCustomerAmountSecondary: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
