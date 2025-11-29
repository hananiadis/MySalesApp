// src/components/KpiDataModal.js
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import colors from '../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatCurrency = (value) =>
  Number(value ?? 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' });

const formatDate = (dateValue) => {
  if (!dateValue) return 'N/A';
  
  // If it's already a Date object
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    return dateValue.toLocaleDateString('el-GR');
  }
  
  // Try parsing as string
  const parsed = new Date(dateValue);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('el-GR');
  }
  
  return String(dateValue);
};

export default function KpiDataModal({ 
  visible, 
  onClose, 
  title, 
  data, 
  previousData = [], 
  year2023Data = [],
  year2022Data = [],
  type, 
  activeSalesmenIds = [], 
  availableSalesmen = [] 
}) {
  const [activeTab, setActiveTab] = useState('current'); // 'current', 'previous', 'year2023', 'year2022'
  
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  
  // Determine if we have 4-year data (Kivos) or 2-year data (Playmobil)
  const has4Years = year2023Data?.length > 0 || year2022Data?.length > 0;
  
  const { displayData, totalAmount } = useMemo(() => {
    let sourceData;
    if (activeTab === 'current') {
      sourceData = data;
    } else if (activeTab === 'previous') {
      sourceData = previousData;
    } else if (activeTab === 'year2023') {
      sourceData = year2023Data;
    } else if (activeTab === 'year2022') {
      sourceData = year2022Data;
    }
    
    console.log('[KpiDataModal] Processing data:', { 
      dataLength: sourceData?.length, 
      type,
      activeTab,
      sampleRecord: sourceData?.[0] 
    });
    
    if (!sourceData || !Array.isArray(sourceData)) {
      console.log('[KpiDataModal] No valid data');
      return { displayData: [], totalAmount: 0 };
    }

    let processedData = [...sourceData];
    let total = 0;

    // For yearly data, show top 25 customers by amount
    if (type === 'yearly') {
      console.log('[KpiDataModal] Processing yearly data - grouping by customer');
      // Group by customer and sum amounts
      const customerTotals = {};
      processedData.forEach(record => {
        const customerCode = record.customerCode || record.Payer || record['Bill-to'] || 'Unknown';
        const amount = parseFloat(
          record.amount || 
          record.total || 
          record.value || 
          record['Sales revenue'] || 
          0
        );
        
        if (!customerTotals[customerCode]) {
          customerTotals[customerCode] = {
            customerCode,
            customerName: record.customerName || record['Bill-to name'] || '',
            amount: 0,
            count: 0,
          };
        }
        customerTotals[customerCode].amount += amount;
        customerTotals[customerCode].count += 1;
      });
      
      // Convert to array and sort by amount
      processedData = Object.values(customerTotals)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 25);
      
      console.log('[KpiDataModal] Yearly: grouped into', processedData.length, 'customers');
    }
    // For monthly/ytd/mtd data, show individual transactions
    else if (type === 'monthly' || type === 'mtd' || type === 'ytd') {
      console.log('[KpiDataModal] Processing monthly/ytd/mtd data - individual transactions');
      // Sort by date descending
      processedData = processedData.sort((a, b) => {
        const dateA = new Date(a.date || a.Date || 0);
        const dateB = new Date(b.date || b.Date || 0);
        return dateB - dateA;
      });
      console.log('[KpiDataModal] Sorted', processedData.length, 'transactions');
    }
    // For customer sales (show all individual transactions, not grouped)
    else if (type === 'customer-sales') {
      console.log('[KpiDataModal] Processing customer-sales data - individual transactions');
      // Sort by date descending and limit to 25
      processedData = processedData
        .sort((a, b) => {
          const dateA = new Date(a.date || a.Date || a.invoiceDate || 0);
          const dateB = new Date(b.date || b.Date || b.invoiceDate || 0);
          return dateB - dateA;
        })
        .slice(0, 25);
      console.log('[KpiDataModal] Customer sales: showing', processedData.length, 'most recent transactions');
    }

    // Calculate total
    total = processedData.reduce((sum, record) => {
      const amount = parseFloat(
        record.amount || 
        record.total || 
        record.value || 
        record['Sales revenue'] || 
        0
      );
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    console.log('[KpiDataModal] Final:', { 
      displayCount: processedData.length, 
      totalAmount: total 
    });

    return { displayData: processedData, totalAmount: total };
  }, [data, previousData, year2023Data, year2022Data, type, activeTab]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close-outline" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            {activeSalesmenIds?.length ? (
              <Text style={styles.scopeNote}>
                Φίλτρο πωλητών: {activeSalesmenIds.length === (availableSalesmen?.length || 0)
                  ? 'Όλοι'
                  : activeSalesmenIds.map(id => {
                      const found = availableSalesmen.find(s => s.id === id);
                      return found ? found.label : id;
                    }).join(', ')}
              </Text>
            ) : null}
          </View>

          {/* Year Tabs - show 2 or 4 years depending on data */}
          {previousData && previousData.length > 0 && (
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'current' && styles.tabActive]}
                onPress={() => setActiveTab('current')}
              >
                <Text style={[styles.tabText, activeTab === 'current' && styles.tabTextActive]}>
                  {currentYear}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'previous' && styles.tabActive]}
                onPress={() => setActiveTab('previous')}
              >
                <Text style={[styles.tabText, activeTab === 'previous' && styles.tabTextActive]}>
                  {previousYear}
                </Text>
              </TouchableOpacity>
              {has4Years && year2023Data && year2023Data.length > 0 && (
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'year2023' && styles.tabActive]}
                  onPress={() => setActiveTab('year2023')}
                >
                  <Text style={[styles.tabText, activeTab === 'year2023' && styles.tabTextActive]}>
                    2023
                  </Text>
                </TouchableOpacity>
              )}
              {has4Years && year2022Data && year2022Data.length > 0 && (
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'year2022' && styles.tabActive]}
                  onPress={() => setActiveTab('year2022')}
                >
                  <Text style={[styles.tabText, activeTab === 'year2022' && styles.tabTextActive]}>
                    2022
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Summary */}
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Σύνολο εγγραφών:</Text>
              <Text style={styles.summaryValue}>{displayData.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Συνολικό ποσό:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
            </View>
          </View>

          {/* Data List */}
          <ScrollView style={styles.scrollView}>
            {(() => {
              console.log('[KpiDataModal] About to render list:', {
                hasDisplayData: !!displayData,
                displayDataLength: displayData?.length,
                isEmpty: displayData.length === 0,
                firstRecord: displayData[0]
              });
              return null;
            })()}
            {displayData.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={48} color={colors.border} />
                <Text style={styles.emptyText}>Δεν υπάρχουν δεδομένα</Text>
              </View>
            ) : (
              <>
                {/* Header row for Kivos sales data */}
                {type === 'sales' && displayData.length > 0 && displayData[0].amountWithVAT !== undefined && (
                  <View style={[styles.compactRow, styles.headerRow]}>
                    <Text style={[styles.compactDate, styles.headerText]}>Ημ/νία</Text>
                    <Text style={[styles.compactAmount, styles.headerText]}>Καθαρό</Text>
                    <Text style={[styles.compactAmount, styles.headerText]}>Τιμολ.</Text>
                  </View>
                )}
                {displayData.map((record, index) => {
                  // For yearly view - show customer summary in compact format
                  if (type === 'yearly') {
                    const customerName = record.customerCode || 'Unknown';
                    const amount = formatCurrency(record.amount);
                    const count = record.count ? ` (${record.count} συναλλαγές)` : '';
                    
                    return (
                      <View key={index} style={styles.compactRow}>
                        <Text style={styles.compactCustomer} numberOfLines={1}>
                          {customerName}
                        </Text>
                        <Text style={styles.compactAmount}>{amount}</Text>
                      </View>
                    );
                  }
                  
                  // For transaction view - show in single line: Date Customer Amount
                  const date = formatDate(record.date || record.Date || record.documentDate || record.invoiceDate);
                  const customer = type !== 'customer-sales' && type !== 'sales'
                    ? (record.customerName || record.customerCode || record.Payer || record['Bill-to'] || 'N/A')
                    : null;
                  
                  // Get handling salesman for badge
                  const handledBy = record.handledBy || null;
                  
                  // For Kivos sales data, show both net and invoiced amounts
                  const hasInvoicedAmount = record.amountWithVAT !== undefined;
                  const netAmount = formatCurrency(
                    record.amount || 
                    record.netAmount ||
                    record.total || 
                    record.value || 
                    record['Sales revenue'] || 
                    0
                  );
                  const invoicedAmount = hasInvoicedAmount 
                    ? formatCurrency(record.amountWithVAT)
                    : null;
                  
                  console.log(`[KpiDataModal] Row ${index} customer:`, {
                    customerName: record.customerName,
                    customerCode: record.customerCode,
                    selected: customer,
                    hasInvoicedAmount,
                    netAmount: record.amount,
                    invoicedAmount: record.amountWithVAT,
                    handledBy
                  });
                  
                  return (
                    <View key={index} style={styles.transactionRow}>
                      <View style={styles.compactRow}>
                        <Text style={styles.compactDate}>{date}</Text>
                        {customer && <Text style={styles.compactCustomer} numberOfLines={1}>{customer}</Text>}
                        {hasInvoicedAmount ? (
                          <>
                            <Text style={styles.compactAmount}>{netAmount}</Text>
                            <Text style={styles.compactAmount}>{invoicedAmount}</Text>
                          </>
                        ) : (
                          <Text style={styles.compactAmount}>{netAmount}</Text>
                        )}
                      </View>
                      {handledBy && (
                        <View style={styles.salesmanBadgeContainer}>
                          <View style={styles.salesmanBadge}>
                            <Ionicons name="person-outline" size={10} color="#6b7280" />
                            <Text style={styles.salesmanBadgeText}>{handledBy}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeFooterButton} onPress={onClose}>
              <Text style={styles.closeFooterButtonText}>Κλείσιμο</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    width: '95%',
    maxHeight: SCREEN_HEIGHT * 0.9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  scopeNote: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1e88e5',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#1e88e5',
  },
  summary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  scrollView: {
    flexGrow: 0,
    flexShrink: 1,
    paddingVertical: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  headerRow: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
  },
  headerText: {
    fontWeight: '700',
    fontSize: 13,
    color: colors.textSecondary,
  },
  compactDate: {
    fontSize: 14,
    color: colors.text,
    width: 80,
    fontWeight: '500',
    marginRight: 8,
  },
  compactCustomer: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    fontWeight: '400',
    marginRight: 8,
  },
  compactAmount: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 100,
  },
  transactionRow: {
    marginBottom: 4,
  },
  salesmanBadgeContainer: {
    paddingLeft: 8,
    marginTop: 2,
  },
  salesmanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  salesmanBadgeText: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeFooterButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
