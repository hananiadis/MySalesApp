// src/screens/CustomerMonthlySales.js
// Monthly sales breakdown screen showing month-by-month comparison for current and previous year

import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SafeScreen from '../components/SafeScreen';
import KpiDataModal from '../components/KpiDataModal';
import { getCustomersFromLocal } from '../utils/localData';
import colors from '../theme/colors';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'
];

const formatCurrency = (value) => {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' });
};

export default function CustomerMonthlySales({ route, navigation }) {
  const { customerId, brand = 'playmobil' } = route?.params || {};
  
  const [status, setStatus] = useState(STATUS.LOADING);
  const [customer, setCustomer] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [error, setError] = useState(null);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState({ 
    title: '', 
    data: [], 
    type: 'sales' 
  });

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus(STATUS.LOADING);
        
        console.log('[CustomerMonthlySales] Loading customer:', customerId, 'brand:', brand);
        
        // Load customer data
        const customers = await getCustomersFromLocal(brand);
        // For Kivos and John, customerId might be the customerCode, so check both
        const foundCustomer = customers?.find(c => {
          // Check multiple possible ID fields
          const customerIds = [
            c.id,
            c.customerCode,
            c.code,
            c.customer_id
          ].filter(Boolean).map(id => String(id).trim());
          
          const searchId = String(customerId).trim();
          return customerIds.includes(searchId);
        });
        
        if (!foundCustomer) {
          console.error('[CustomerMonthlySales] Customer not found:', customerId);
          console.log('[CustomerMonthlySales] Available customers:', customers?.map(c => ({
            id: c.id,
            code: c.customerCode,
            name: c.name
          })).slice(0, 5));
          throw new Error('Πελάτης δεν βρέθηκε');
        }
        
        console.log('[CustomerMonthlySales] Customer found:', foundCustomer.customerCode, foundCustomer.name);
        
        if (!cancelled) {
          setCustomer(foundCustomer);
        }

        // Load sales data based on brand
        let sales = null;
        
        if (brand === 'playmobil') {
          const { calculateCustomerMetrics } = await import('../services/playmobilCustomerMetrics');
          const metrics = await calculateCustomerMetrics(foundCustomer.customerCode);
          
          console.log('[CustomerMonthlySales] Loaded Playmobil metrics:', {
            hasInvoiced2025: !!metrics.records?.invoiced2025,
            hasInvoiced2024: !!metrics.records?.invoiced2024,
            hasOrders2025: !!metrics.records?.orders2025,
            hasOrders2024: !!metrics.records?.orders2024,
            invoiced2025Count: metrics.records?.invoiced2025?.length || 0,
            invoiced2024Count: metrics.records?.invoiced2024?.length || 0,
          });
          
          sales = {
            current: metrics.records?.invoiced2025 || [],
            previous: metrics.records?.invoiced2024 || []
          };
        } else if (brand === 'kivos') {
          const { getAllSheetsData } = await import('../services/kivosKpi');
          
          console.log('[CustomerMonthlySales] Loading Kivos sheets data...');
          const sheetsData = await getAllSheetsData();
          
          console.log('[CustomerMonthlySales] Sheets data loaded:', {
            sales2025Count: sheetsData.sales2025?.length || 0,
            sales2024Count: sheetsData.sales2024?.length || 0,
          });
          
          // Filter records for this customer
          const customerCodeStr = String(foundCustomer.customerCode || foundCustomer.code || customerId).trim();
          
          const current = (sheetsData.sales2025 || []).filter(record => {
            const recordCode = String(record.customerCode || record.code || '').trim();
            return recordCode === customerCodeStr;
          });
          
          const previous = (sheetsData.sales2024 || []).filter(record => {
            const recordCode = String(record.customerCode || record.code || '').trim();
            return recordCode === customerCodeStr;
          });
          
          console.log('[CustomerMonthlySales] Filtered Kivos data:', {
            currentCount: current.length,
            previousCount: previous.length,
          });
          
          sales = {
            current,
            previous
          };
        }

        if (!cancelled) {
          setSalesData(sales);
          setStatus(STATUS.READY);
        }
      } catch (err) {
        console.error('[CustomerMonthlySales] Error loading data:', err);
        if (!cancelled) {
          setError(err.message || 'Αποτυχία φόρτωσης δεδομένων');
          setStatus(STATUS.ERROR);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, brand]);

  // Calculate monthly totals
  const monthlyData = useMemo(() => {
    if (!salesData) return [];

    const data = [];
    
    for (let month = 0; month < 12; month++) {
      // Current year sales
      const currentSales = salesData.current.filter(record => {
        const date = new Date(record.date || record.invoiceDate || record.Date);
        return date.getFullYear() === currentYear && date.getMonth() === month;
      });
      
      const currentAmount = currentSales.reduce((sum, r) => {
        const amount = parseFloat(r.amount || r.total || r.value || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      
      // Previous year sales
      const previousSales = salesData.previous.filter(record => {
        const date = new Date(record.date || record.invoiceDate || record.Date);
        return date.getFullYear() === previousYear && date.getMonth() === month;
      });
      
      const previousAmount = previousSales.reduce((sum, r) => {
        const amount = parseFloat(r.amount || r.total || r.value || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      
      // Calculate percentage change
      const percentChange = previousAmount > 0 
        ? ((currentAmount - previousAmount) / previousAmount) * 100 
        : null;

      data.push({
        month,
        monthName: MONTH_NAMES[month],
        currentYear: {
          sales: currentAmount,
          salesRecords: currentSales,
        },
        previousYear: {
          sales: previousAmount,
          salesRecords: previousSales,
        },
        percentChange,
      });
    }

    console.log('[CustomerMonthlySales] Monthly data calculated:', {
      totalMonths: data.length,
      sample: data[0]
    });

    return data;
  }, [salesData, currentYear, previousYear]);

  const handleMonthPress = (monthData, year) => {
    const yearLabel = year === currentYear ? currentYear : previousYear;
    const records = year === currentYear 
      ? monthData.currentYear.salesRecords
      : monthData.previousYear.salesRecords;

    console.log('[CustomerMonthlySales] Opening modal:', {
      month: monthData.monthName,
      year: yearLabel,
      recordCount: records.length
    });

    setModalData({
      title: `Πωλήσεις - ${monthData.monthName} ${yearLabel}`,
      data: records,
      type: 'customer-sales'
    });
    setModalVisible(true);
  };

  if (status === STATUS.LOADING) {
    return (
      <SafeScreen title="Μηνιαία Ανάλυση Πωλήσεων">
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Φόρτωση δεδομένων...</Text>
        </View>
      </SafeScreen>
    );
  }

  if (status === STATUS.ERROR) {
    return (
      <SafeScreen title="Μηνιαία Ανάλυση Πωλήσεων">
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Επιστροφή</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen title="Μηνιαία Ανάλυση Πωλήσεων" scroll>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Navigation Buttons */}
        <View style={styles.topNavigationButtons}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('CustomerSalesSummary', { customerId, brand })}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Σύνοψη</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              // Navigate back twice to get to customer detail
              navigation.navigate(
                brand === 'playmobil' ? 'CustomerDetail' :
                brand === 'kivos' ? 'KivosCustomerDetail' :
                'JohnCustomerDetail',
                { customerId, brand }
              );
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Πελάτης</Text>
          </TouchableOpacity>
        </View>
        
        {/* Customer Header */}
        {customer && (
          <View style={styles.customerHeader}>
            <View style={styles.customerHeaderRow}>
              <Ionicons name="business-outline" size={24} color={colors.primary} />
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{customer.name}</Text>
                <Text style={styles.customerDetail}>Κωδικός: {customer.customerCode}</Text>
                {customer.address && (
                  <Text style={styles.customerDetail}>
                    {typeof customer.address === 'string' 
                      ? customer.address 
                      : [customer.address.street, customer.address.city, customer.address.postalCode]
                          .filter(Boolean)
                          .join(', ')
                    }
                  </Text>
                )}
                {!customer.address && customer.city && (
                  <Text style={styles.customerDetail}>{customer.city}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Year Headers */}
        <View style={styles.yearHeadersRow}>
          <View style={styles.monthLabelColumn}>
            <Text style={styles.yearHeaderText}>Μήνας</Text>
          </View>
          <View style={styles.yearColumn}>
            <Text style={styles.yearHeaderText}>{previousYear}</Text>
          </View>
          <View style={styles.yearColumn}>
            <Text style={styles.yearHeaderText}>{currentYear}</Text>
          </View>
          <View style={styles.changeColumn}>
            <Text style={styles.yearHeaderText}>Μεταβολή</Text>
          </View>
        </View>

        {/* Monthly Rows */}
        {monthlyData.map((monthData, index) => {
          const hasCurrentSales = monthData.currentYear.sales > 0;
          const hasPreviousSales = monthData.previousYear.sales > 0;
          const hasData = hasCurrentSales || hasPreviousSales;
          
          if (!hasData) return null; // Skip months with no data

          const changeColor = monthData.percentChange == null 
            ? colors.textSecondary 
            : monthData.percentChange >= 0 
            ? '#4caf50' 
            : '#f44336';

          return (
            <View key={index} style={styles.monthRow}>
              <View style={styles.monthLabelColumn}>
                <Text style={styles.monthName}>{monthData.monthName}</Text>
              </View>
              
              {/* Previous Year */}
              <TouchableOpacity 
                style={[styles.yearColumn, styles.clickableCell]}
                onPress={() => handleMonthPress(monthData, previousYear)}
                disabled={!hasPreviousSales}
                activeOpacity={hasPreviousSales ? 0.7 : 1}
              >
                <Text style={[styles.amountText, !hasPreviousSales && styles.noDataText]}>
                  {formatCurrency(monthData.previousYear.sales)}
                </Text>
                {monthData.previousYear.salesRecords.length > 0 && (
                  <Text style={styles.recordCount}>
                    {monthData.previousYear.salesRecords.length} τιμ.
                  </Text>
                )}
              </TouchableOpacity>
              
              {/* Current Year */}
              <TouchableOpacity 
                style={[styles.yearColumn, styles.clickableCell]}
                onPress={() => handleMonthPress(monthData, currentYear)}
                disabled={!hasCurrentSales}
                activeOpacity={hasCurrentSales ? 0.7 : 1}
              >
                <Text style={[styles.amountText, !hasCurrentSales && styles.noDataText]}>
                  {formatCurrency(monthData.currentYear.sales)}
                </Text>
                {monthData.currentYear.salesRecords.length > 0 && (
                  <Text style={styles.recordCount}>
                    {monthData.currentYear.salesRecords.length} τιμ.
                  </Text>
                )}
              </TouchableOpacity>
              
              {/* Change */}
              <View style={styles.changeColumn}>
                {monthData.percentChange != null && (
                  <Text style={[styles.changeText, { color: changeColor }]}>
                    {monthData.percentChange >= 0 ? '+' : ''}
                    {monthData.percentChange.toFixed(1)}%
                  </Text>
                )}
              </View>
            </View>
          );
        })}

        {/* Totals Row */}
        {(() => {
          const currentTotal = monthlyData.reduce((sum, m) => sum + m.currentYear.sales, 0);
          const previousTotal = monthlyData.reduce((sum, m) => sum + m.previousYear.sales, 0);
          const totalChange = previousTotal > 0 
            ? ((currentTotal - previousTotal) / previousTotal) * 100 
            : null;
          const changeColor = totalChange == null 
            ? colors.textSecondary 
            : totalChange >= 0 
            ? '#4caf50' 
            : '#f44336';

          return (
            <View style={[styles.monthRow, styles.totalRow]}>
              <View style={styles.monthLabelColumn}>
                <Text style={styles.totalLabel}>ΣΥΝΟΛΟ</Text>
              </View>
              <View style={styles.yearColumn}>
                <Text style={styles.totalAmount}>{formatCurrency(previousTotal)}</Text>
              </View>
              <View style={styles.yearColumn}>
                <Text style={styles.totalAmount}>{formatCurrency(currentTotal)}</Text>
              </View>
              <View style={styles.changeColumn}>
                {totalChange != null && (
                  <Text style={[styles.totalChange, { color: changeColor }]}>
                    {totalChange >= 0 ? '+' : ''}
                    {totalChange.toFixed(1)}%
                  </Text>
                )}
              </View>
            </View>
          );
        })()}
      </ScrollView>

      {/* Data Modal */}
      <KpiDataModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalData.title}
        data={modalData.data}
        type={modalData.type}
      />
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
  retryButton: {
    marginTop: 24,
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
  topNavigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    flex: 1,
    gap: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  customerHeader: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  customerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  yearHeadersRow: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  monthLabelColumn: {
    flex: 2,
    justifyContent: 'center',
  },
  yearColumn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeColumn: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  monthRow: {
    flexDirection: 'row',
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
  monthName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  clickableCell: {
    borderRadius: 6,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  noDataText: {
    color: colors.textSecondary,
  },
  recordCount: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  totalRow: {
    backgroundColor: '#f5f5f5',
    marginTop: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  totalChange: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
