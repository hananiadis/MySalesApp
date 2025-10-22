// src/components/BottomSheet.js
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function BottomSheet({ visible, onClose, children, title }) {
  return (
    <Modal isVisible={visible} onBackdropPress={onClose} style={styles.modalWrap}>
      <View style={styles.modalContainer}>
        {title && (
          <View style={styles.header}>
            <Ionicons name="information-circle-outline" size={23} color="#007AFF" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.content}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { justifyContent: 'flex-end', margin: 0 },
  modalContainer: {
    backgroundColor: '#fff', borderTopLeftRadius: 23, borderTopRightRadius: 23,
    padding: 20, alignItems: 'center'
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 7, width: '100%',
    justifyContent: 'space-between'
  },
  title: { fontWeight: 'bold', fontSize: 17, color: '#007AFF', flex: 1 },
  content: { width: '100%', alignItems: 'center' },
});
