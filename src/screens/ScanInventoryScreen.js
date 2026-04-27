// src/screens/ScanInventoryScreen.js
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import debounce from 'lodash.debounce';
import colors from '../theme/colors';
import InventoryService from '../services/inventoryService';
import { useOnlineStatus } from '../utils/OnlineStatusContext';
import { useAuth } from '../context/AuthProvider';

export default function ScanInventoryScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { isConnected } = useOnlineStatus();
  const { user } = useAuth();

  const customerId = route?.params?.customerId;
  const [permission, requestPermission] = useCameraPermissions();

  const [scanMode, setScanMode] = useState('camera'); // 'camera' | 'manual'
  const [quantity, setQuantity] = useState('1');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const barcodeInputRef = useRef(null);
  const barcodeQueueRef = useRef([]);
  const lastScanTimeRef = useRef(0);

  // Initialize session
  useEffect(() => {
    if (customerId && !session) {
      const sess = InventoryService.createSession(customerId, 'scan');
      setSession(sess);
    }
  }, [customerId, session]);

  // Camera permission
  useFocusEffect(
    useCallback(() => {
      if (permission?.status !== 'granted' && scanMode === 'camera') {
        requestPermission();
      }
    }, [permission, scanMode, requestPermission])
  );

  // Debounced barcode processor
  const processBarcodeQueue = useCallback(
    debounce(async () => {
      if (barcodeQueueRef.current.length === 0) return;

      const barcode = barcodeQueueRef.current.shift();
      console.log('[ScanInventory] Processing barcode:', barcode);
      try {
        const qty = parseInt(quantity, 10) || 1;
        console.log('[ScanInventory] Qty:', qty);
        const updatedSession = await InventoryService.addLineToSession(session, barcode, qty);
        console.log('[ScanInventory] Line added successfully. Total lines:', updatedSession.lines.length);
        const addedLine = updatedSession.lines[updatedSession.lines.length - 1];
        console.log('[ScanInventory] Added line details - ID:', addedLine.productId, 'SKU:', addedLine.sku, 'Name:', addedLine.name, 'Qty:', addedLine.qty);
        setSession(updatedSession);
        setBarcodeInput('');
        setQuantity('1');

        // Auto-focus back to input
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
        }, 100);
      } catch (error) {
        console.error('[ScanInventory] Error processing barcode:', barcode, error);
        Alert.alert('Error', error.message);
      }

      // Process next barcode in queue if exists
      if (barcodeQueueRef.current.length > 0) {
        setTimeout(() => processBarcodeQueue(), 100);
      }
    }, 300),
    [session, quantity]
  );

  const handleBarcodeScan = (data) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 500) return; // Debounce
    lastScanTimeRef.current = now;

    barcodeQueueRef.current.push(data);
    processBarcodeQueue();
  };

  const handleManualEntry = () => {
    if (!barcodeInput.trim()) {
      Alert.alert('Error', 'Please enter a barcode or SKU');
      return;
    }
    handleBarcodeScan(barcodeInput.trim());
  };

  const handleRemoveLine = (lineId) => {
    const updated = {
      ...session,
      lines: session.lines.filter((l) => l.lineId !== lineId),
    };
    setSession(updated);
  };

  const handleCommit = async () => {
    if (!session?.lines.length) {
      Alert.alert('Error', 'No items scanned');
      return;
    }

    console.log('[ScanInventory] handleCommit: Saving', session.lines.length, 'lines. Note:', note);
    console.log('[ScanInventory] Session lines:', session.lines.map(l => ({ sku: l.sku, name: l.name, qty: l.qty })));

    setLoading(true);
    try {
      const savedInventory = await InventoryService.commitSessionOffline(session, note);
      console.log('[ScanInventory] Session saved. InventoryID:', savedInventory.inventoryId);
      Alert.alert('Success', 'Inventory saved offline. It will sync when you go online.', [
        {
          text: 'OK',
          onPress: () => {
            setSession(InventoryService.createSession(customerId, 'scan'));
            setNote('');
          },
        },
      ]);
    } catch (error) {
      console.error('[ScanInventory] Commit error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
    }
  };

  if (!customerId) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No customer selected</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Scan Inventory</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Status bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>Items: {session.lines.length}</Text>
          <Text style={styles.statusText}>Qty: {session.lines.reduce((s, l) => s + l.qty, 0)}</Text>
          <Text style={[styles.statusText, { color: isConnected ? 'green' : 'red' }]}>
            {isConnected ? '🟢 Online' : '🔴 Offline'}
          </Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, scanMode === 'camera' && styles.modeBtnActive]}
            onPress={() => setScanMode('camera')}
          >
            <Ionicons name="camera" size={20} color={scanMode === 'camera' ? 'white' : colors.textPrimary} />
            <Text style={[styles.modeBtnText, scanMode === 'camera' && { color: 'white' }]}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, scanMode === 'manual' && styles.modeBtnActive]}
            onPress={() => setScanMode('manual')}
          >
            <Ionicons name="create" size={20} color={scanMode === 'manual' ? 'white' : colors.textPrimary} />
            <Text style={[styles.modeBtnText, scanMode === 'manual' && { color: 'white' }]}>Manual</Text>
          </TouchableOpacity>
        </View>

        {/* Camera view */}
        {scanMode === 'camera' && permission?.granted && (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39'] }}
              onBarcodeScanned={({ data }) => handleBarcodeScan(data)}
            />
            <View style={styles.cameraOverlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanHint}>Point at barcode</Text>
            </View>
          </View>
        )}

        {/* Manual entry form */}
        {scanMode === 'manual' && (
          <View style={styles.form}>
            <Text style={styles.label}>Barcode / SKU</Text>
            <TextInput
              ref={barcodeInputRef}
              style={styles.input}
              placeholder="Scan or type barcode"
              value={barcodeInput}
              onChangeText={setBarcodeInput}
              autoFocus
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholderTextColor={colors.textSecondary}
            />

            <TouchableOpacity style={styles.addBtn} onPress={handleManualEntry} disabled={loading}>
              <Ionicons name="add-circle" size={24} color="white" />
              <Text style={styles.addBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scanned items list */}
        <View style={{ flex: 1, marginTop: 12 }}>
          <Text style={styles.listTitle}>Scanned Items</Text>
          <FlatList
            data={session.lines}
            keyExtractor={(item) => item.lineId}
            renderItem={({ item }) => (
              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName}>{item.name}</Text>
                  <Text style={styles.lineSku}>SKU: {item.sku}</Text>
                  <Text style={styles.lineQty}>Qty: {item.qty}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleRemoveLine(item.lineId)}
                >
                  <Ionicons name="trash" size={20} color="red" />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No items scanned yet</Text>}
          />
        </View>

        {/* Bottom actions */}
        {session.lines.length > 0 && (
          <View style={styles.footer}>
            <TextInput
              style={styles.noteInput}
              placeholder="Add note (optional)"
              value={note}
              onChangeText={setNote}
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => setShowConfirmModal(true)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="save" size={20} color="white" />
                  <Text style={styles.submitBtnText}>Save Inventory</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Confirm Modal */}
        <Modal visible={showConfirmModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirm Inventory</Text>
              <Text style={styles.modalText}>
                Items: {session.lines.length} | Total Qty: {session.lines.reduce((s, l) => s + l.qty, 0)}
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setShowConfirmModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleCommit}>
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
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
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
  },
  statusText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  modeToggle: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 12, gap: 8 },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeBtnText: { marginLeft: 6, fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  cameraContainer: { flex: 1, marginHorizontal: 16, marginVertical: 12, borderRadius: 8, overflow: 'hidden' },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: 'lime',
    borderRadius: 8,
  },
  scanHint: { marginTop: 16, color: 'white', fontSize: 14 },
  form: { marginHorizontal: 16, marginVertical: 12, gap: 8 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  listTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginHorizontal: 16, marginBottom: 8 },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  lineName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  lineSku: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  lineQty: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 2 },
  deleteBtn: { paddingHorizontal: 8 },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: 20 },
  footer: { borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  noteInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.textPrimary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  submitBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 20, width: '80%' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 },
  modalText: { fontSize: 13, color: colors.textSecondary, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  cancelBtn: { borderWidth: 1, borderColor: '#e0e0e0' },
  cancelBtnText: { color: colors.textPrimary, fontWeight: '600' },
  confirmBtn: { backgroundColor: colors.primary },
  confirmBtnText: { color: 'white', fontWeight: '600' },
  errorText: { color: 'red', fontSize: 16, textAlign: 'center' },
});
