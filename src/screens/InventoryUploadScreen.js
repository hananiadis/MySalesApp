// src/screens/InventoryUploadScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import XLSX from 'xlsx';
import colors from '../theme/colors';
import InventoryService from '../services/inventoryService';
import { getProductsFromLocal } from '../utils/localData';
import { useAuth } from '../context/AuthProvider';

const COLUMN_TYPES = [
  { key: 'barcode', label: 'Barcode (EAN/UPC)', icon: 'barcode' },
  { key: 'sku', label: 'SKU / Product Code', icon: 'pricetag' },
  { key: 'name', label: 'Product Name', icon: 'text' },
  { key: 'quantity', label: 'Quantity', icon: 'calculator' },
  { key: 'uom', label: 'Unit (piece/box/etc)', icon: 'cube' },
  { key: 'location', label: 'Location (optional)', icon: 'location' },
  { key: 'price', label: 'Price (optional)', icon: 'cash' },
  { key: 'skip', label: 'Skip Column', icon: 'close' },
];

export default function InventoryUploadScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const customerId = route?.params?.customerId;

  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeColumn, setActiveColumn] = useState(null);
  const [note, setNote] = useState('');
  const [csvText, setCsvText] = useState('');
  const [step, setStep] = useState('upload'); // 'upload' | 'mapping' | 'preview' | 'confirm'

  if (!customerId) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No customer selected</Text>
      </SafeAreaView>
    );
  }

  const pickFile = async () => {
    try {
      console.log('[InventoryUpload] pickFile: Launching document picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        console.log('[InventoryUpload] pickFile: User cancelled');
        return;
      }

      const pickedFile = result.assets?.[0];
      if (!pickedFile) {
        Alert.alert('Error', 'No file selected');
        return;
      }

      console.log('[InventoryUpload] File selected:', pickedFile.name, 'Type:', pickedFile.mimeType, 'Size:', pickedFile.size, 'URI:', pickedFile.uri);

      setLoading(true);
      setFile(pickedFile);

      const isExcel = (pickedFile.name || '').toLowerCase().endsWith('.xlsx')
        || (pickedFile.name || '').toLowerCase().endsWith('.xls')
        || (pickedFile.mimeType || '').includes('spreadsheet')
        || (pickedFile.mimeType || '').includes('excel');

      if (isExcel) {
        console.log('[InventoryUpload] Reading Excel as base64 via legacy API');
        const base64Contents = await FileSystem.readAsStringAsync(pickedFile.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log('[InventoryUpload] Base64 length:', base64Contents.length);

        try {
          console.log('[InventoryUpload] Attempting XLSX parse...');
          const workbook = XLSX.read(base64Contents, { type: 'base64' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet);
          console.log('[InventoryUpload] XLSX parsed successfully. Rows:', rawRows.length);

          if (!rawRows.length) {
            Alert.alert('Error', 'No data found in file');
            return;
          }

          setRows(rawRows);
          autoDetectColumns(rawRows);
          setStep('mapping');
        } catch (xlsxError) {
          console.error('[InventoryUpload] XLSX parse failed:', xlsxError);
          Alert.alert('Error', 'Could not parse Excel file: ' + xlsxError.message);
        }
      } else {
        console.log('[InventoryUpload] Reading CSV as UTF-8 via legacy API');
        const textContents = await FileSystem.readAsStringAsync(pickedFile.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        console.log('[InventoryUpload] Text length:', textContents.length);
        parseCSVText(textContents);
      }
    } catch (error) {
      console.error('[InventoryUpload] pickFile error:', error);
      Alert.alert('Error', 'Failed to pick or read file: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const autoDetectColumns = (rawRows) => {
    const firstRow = rawRows[0];
    const detected = {};
    Object.keys(firstRow).forEach((col) => {
      const lower = col.toLowerCase();
      if (lower.includes('barcode') || lower.includes('ean') || lower.includes('upc')) {
        if (!detected.barcode) detected.barcode = col;
      } else if (lower.includes('sku') || lower.includes('product code') || lower.includes('code')) {
        if (!detected.sku) detected.sku = col;
      } else if (lower.includes('name') || lower.includes('product') || lower.includes('description')) {
        if (!detected.name) detected.name = col;
      } else if (lower.includes('qty') || lower.includes('quantity') || lower.includes('stock')) {
        if (!detected.quantity) detected.quantity = col;
      } else if (lower.includes('unit') || lower.includes('uom')) {
        if (!detected.uom) detected.uom = col;
      } else if (lower.includes('location') || lower.includes('shelf')) {
        if (!detected.location) detected.location = col;
      } else if (lower.includes('price')) {
        if (!detected.price) detected.price = col;
      }
    });

    console.log('[InventoryUpload] Auto-detected columns:', detected);
    setColumnMapping(detected);
  };

  const parseCSVText = (csvData) => {
    try {
      console.log('[InventoryUpload] parseCSVText: Parsing CSV data');
      setLoading(true);
      // Parse CSV manually
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        Alert.alert('Error', 'CSV must have headers and at least one row');
        setLoading(false);
        return;
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim());
      console.log('[InventoryUpload] CSV headers:', headers);
      
      // Parse rows
      const rawRows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        if (Object.values(row).some(v => v)) { // Only add non-empty rows
          rawRows.push(row);
        }
      }

      console.log('[InventoryUpload] CSV parsed. Rows:', rawRows.length);

      if (!rawRows.length) {
        Alert.alert('Error', 'No valid data rows found');
        setLoading(false);
        return;
      }

      setRows(rawRows);
      setFile({ name: 'csv-data.csv', size: csvData.length });
      autoDetectColumns(rawRows);
      setStep('mapping');
    } catch (error) {
      console.error('[InventoryUpload] CSV parse error:', error);
      Alert.alert('Error', 'Failed to parse CSV: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (columnName, type) => {
    setColumnMapping((prev) => {
      const updated = { ...prev };
      // Remove old mapping if reassigning
      Object.keys(updated).forEach((k) => {
        if (updated[k] === columnName) delete updated[k];
      });
      if (type !== 'skip') {
        updated[type] = columnName;
      }
      return updated;
    });
  };

  const generatePreview = () => {
    console.log('[InventoryUpload] generatePreview: Mapping=', columnMapping);
    const products = [];
    for (const row of rows.slice(0, 5)) {
      try {
        const barcode = columnMapping.barcode ? String(row[columnMapping.barcode]).trim() : '';
        const sku = columnMapping.sku ? String(row[columnMapping.sku]).trim() : '';
        const name = columnMapping.name ? String(row[columnMapping.name]).trim() : '';
        const qty = columnMapping.quantity ? parseInt(row[columnMapping.quantity], 10) || 0 : 0;

        products.push({
          barcode,
          sku,
          name,
          qty,
          status: barcode || sku ? 'ok' : 'warn',
        });
      } catch {}
    }
    console.log('[InventoryUpload] Preview data:', products);
    setPreviewData(products);
    setStep('preview');
  };

  const processUpload = async () => {
    console.log('[InventoryUpload] processUpload started. Mapping:', columnMapping);
    
    if (!columnMapping.quantity) {
      Alert.alert('Error', 'Quantity column is required');
      return;
    }

    if (!columnMapping.barcode && !columnMapping.sku) {
      Alert.alert('Error', 'Barcode or SKU column is required');
      return;
    }

    setLoading(true);
    try {
      const allProducts = await getProductsFromLocal('playmobil');
      console.log('[InventoryUpload] Total products available:', allProducts.length);      console.log('[InventoryUpload] Sample products:', allProducts.slice(0, 3).map(p => ({ 
        id: p.id, 
        barcode: p.barcode, 
        sku: p.sku, 
        name: p.name 
      })));      
      const session = InventoryService.createSession(customerId, 'upload');

      let successCount = 0;
      let errorCount = 0;
      const matchedProducts = [];
      const unmatchedRows = [];

      for (const row of rows) {
        try {
          const barcode = columnMapping.barcode ? String(row[columnMapping.barcode]).trim() : '';
          const sku = columnMapping.sku ? String(row[columnMapping.sku]).trim() : '';
          const qty = parseInt(row[columnMapping.quantity], 10) || 0;

          if (qty <= 0) continue;

          console.log('[InventoryUpload] Processing row - Barcode:', barcode, 'SKU:', sku, 'Qty:', qty);

          // Find product by barcode or SKU (case-insensitive)
          let product = null;
          if (barcode) {
            const barcodeSearchLower = barcode.toLowerCase();
            product = allProducts.find((p) => 
              (p.barcode && String(p.barcode).trim().toLowerCase() === barcodeSearchLower) || 
              (p.sku && String(p.sku).trim().toLowerCase() === barcodeSearchLower)
            );
            if (product) console.log('[InventoryUpload] Matched by barcode:', barcode, '→', product.id, product.name);
          }
          if (!product && sku) {
            const skuSearchLower = sku.toLowerCase();
            product = allProducts.find((p) => 
              p.sku && String(p.sku).trim().toLowerCase() === skuSearchLower
            );
            if (product) console.log('[InventoryUpload] Matched by SKU:', sku, '→', product.id, product.name);
          }

          if (!product) {
            console.log('[InventoryUpload] NO MATCH for barcode:', barcode, 'SKU:', sku);
            unmatchedRows.push({ barcode, sku, qty });
            errorCount++;
            continue;
          }

          const location = columnMapping.location ? String(row[columnMapping.location]).trim() : '';
          const price = columnMapping.price ? parseFloat(row[columnMapping.price]) : undefined;

          // Create line
          const line = {
            lineId: InventoryService.generateUUID(),
            productId: product.id,
            barcode: product.barcode || barcode,
            sku: product.sku,
            name: product.name,
            qty,
            uom: columnMapping.uom ? String(row[columnMapping.uom]).trim() : 'piece',
            location,
            price,
            updatedAt: new Date().toISOString(),
          };

          session.lines.push(line);
          matchedProducts.push(line);
          successCount++;
        } catch (error) {
          console.error('[InventoryUpload] Row error:', error);
          errorCount++;
        }
      }

      console.log('[InventoryUpload] Matching complete. Matched:', successCount, 'Unmatched:', errorCount);
      if (unmatchedRows.length > 0) {
        console.log('[InventoryUpload] Unmatched rows:', unmatchedRows);
      }

      if (!session.lines.length) {
        Alert.alert('Error', 'No valid products found in file');
        setLoading(false);
        return;
      }

      await InventoryService.commitSessionOffline(session, note);
      Alert.alert('Success', `${successCount} items uploaded (${errorCount} skipped)`, [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Step: Upload
  if (step === 'upload') {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Upload Inventory</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.uploadBox}>
            <Ionicons name="document-outline" size={64} color={colors.primary} />
            <Text style={styles.uploadTitle}>Import Inventory</Text>
            <Text style={styles.uploadSubtitle}>
              Select a CSV or XLSX file
            </Text>

            {!file ? (
              <TouchableOpacity
                style={styles.pickBtn}
                onPress={pickFile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={48} color={colors.primary} />
                    <Text style={styles.pickBtnText}>Choose File</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.fileInfo}>
                  <Ionicons name="checkmark-circle" size={24} color="green" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName}>{file.name}</Text>
                    <Text style={styles.fileSize}>
                      {rows.length} rows • {(file.size / 1024).toFixed(1)} KB
                    </Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setFile(null);
                      setRows([]);
                      setColumnMapping({});
                      setCsvText('');
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '600' }}>Change File</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]}
                    onPress={() => setStep('mapping')}
                  >
                    <Text style={{ color: 'white', fontWeight: '600' }}>Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step: Mapping
  if (step === 'mapping') {
    const availableColumns = Object.keys(rows[0] || {});
    const mappedColumns = new Set(Object.values(columnMapping));

    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('upload')}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Map Columns</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>File has {availableColumns.length} columns</Text>
            <Text style={styles.sectionSubtitle}>Select what each column represents</Text>

            {COLUMN_TYPES.map((ct) => {
              const mapped = columnMapping[ct.key];
              return (
                <TouchableOpacity
                  key={ct.key}
                  style={styles.mappingItem}
                  onPress={() => setActiveColumn(ct.key)}
                >
                  <View style={styles.mappingInfo}>
                    <Ionicons name={ct.icon} size={20} color={colors.primary} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.mappingLabel}>{ct.label}</Text>
                      <Text style={styles.mappingValue}>{mapped || 'Not mapped'}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Column selector modal */}
        <Modal visible={!!activeColumn} transparent animationType="slide">
          <View style={styles.selectorOverlay}>
            <View style={styles.selectorContent}>
              <View style={styles.selectorHeader}>
                <Text style={styles.selectorTitle}>
                  Select Column for: {COLUMN_TYPES.find((c) => c.key === activeColumn)?.label}
                </Text>
                <TouchableOpacity onPress={() => setActiveColumn(null)}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={availableColumns}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.columnOption,
                      columnMapping[activeColumn] === item && styles.columnOptionSelected,
                    ]}
                    onPress={() => {
                      updateMapping(item, activeColumn);
                      setActiveColumn(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.columnOptionText,
                        columnMapping[activeColumn] === item && { color: colors.primary, fontWeight: '700' },
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />

              {/* Skip option */}
              <TouchableOpacity
                style={styles.columnOption}
                onPress={() => {
                  updateMapping(null, 'skip');
                  setActiveColumn(null);
                }}
              >
                <Text style={styles.columnOptionText}>Skip this column</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={generatePreview}>
            <Text style={styles.nextBtnText}>Preview Data</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Step: Preview
  if (step === 'preview') {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('mapping')}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Preview</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>First 5 rows</Text>
            {previewData.map((item, idx) => (
              <View key={idx} style={[styles.previewRow, item.status === 'warn' && styles.previewRowWarn]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewRowName}>{item.name || '(no name)'}</Text>
                  <Text style={styles.previewRowMeta}>{item.sku || item.barcode || '(no identifier)'}</Text>
                  <Text style={styles.previewRowQty}>Qty: {item.qty}</Text>
                </View>
                <Ionicons
                  name={item.status === 'ok' ? 'checkmark-circle' : 'warning'}
                  size={24}
                  color={item.status === 'ok' ? 'green' : 'orange'}
                />
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep('confirm')}>
            <Text style={styles.nextBtnText}>Continue ({rows.length} items)</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Step: Confirm
  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('preview')}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Confirm Upload</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.confirmBox}>
          <Ionicons name="checkmark-done-circle" size={64} color={colors.primary} />
          <Text style={styles.confirmTitle}>Ready to Upload</Text>
          <Text style={styles.confirmSubtitle}>{rows.length} inventory items will be imported</Text>

          <View style={styles.confirmStats}>
            <View style={styles.confirmStat}>
              <Text style={styles.confirmStatValue}>{rows.length}</Text>
              <Text style={styles.confirmStatLabel}>Total Items</Text>
            </View>
          </View>

          <Text style={styles.label}>Add a note (optional)</Text>
          <View style={styles.textAreaContainer}>
            <TextInput
              style={styles.textArea}
              placeholder="e.g., Stock count from warehouse on Dec 15"
              value={note}
              onChangeText={setNote}
              multiline
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          onPress={processUpload}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="white" />
              <Text style={styles.submitBtnText}>Upload Inventory</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 16, paddingVertical: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  uploadBox: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f5f7fa',
  },
  uploadTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 16 },
  uploadSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  pickBtn: { marginTop: 16, alignItems: 'center' },
  pickBtnText: { marginTop: 8, fontSize: 14, fontWeight: '600', color: colors.primary },
  fileInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 },
  fileName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  fileSize: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  infoText: { flex: 1, fontSize: 12, color: colors.textPrimary },
  mappingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  mappingInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  mappingLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  mappingValue: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  selectorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  selectorContent: { backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16, height: '70%' },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectorTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  columnOption: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  columnOptionSelected: { backgroundColor: '#f0f0f0' },
  columnOptionText: { fontSize: 13, color: colors.textPrimary },
  previewRow: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    borderLeftColor: 'green',
  },
  previewRowWarn: { borderLeftColor: 'orange' },
  previewRowName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  previewRowMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  previewRowQty: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 2 },
  confirmBox: { alignItems: 'center', marginBottom: 20 },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 16 },
  confirmSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, textAlign: 'center' },
  confirmStats: { flexDirection: 'row', marginTop: 20, gap: 16 },
  confirmStat: { alignItems: 'center', flex: 1, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8 },
  confirmStatValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
  confirmStatLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
  textAreaContainer: { width: '100%' },
  textArea: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  csvTextArea: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.textPrimary,
    minHeight: 200,
    textAlignVertical: 'top',
    backgroundColor: 'white',
  },
  footer: { borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingHorizontal: 16, paddingVertical: 12 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  nextBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  submitBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  errorText: { color: 'red', fontSize: 16, textAlign: 'center' },
});
