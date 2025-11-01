// /src/screens/CustomerSalesSummaryTest.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import SafeScreen from '../components/SafeScreen';
import { loadSpreadsheet } from '../services/spreadsheetCache';
import colors from '../theme/colors';

// Helper for number parsing (comma decimals)
const toNumber = (v) => {
  if (v == null || v === '') return 0;
  const cleaned = String(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

export default function CustomerSalesSummaryTest() {
  const [rows2024, setRows2024] = useState([]);
  const [rows2025, setRows2025] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s24 = await loadSpreadsheet('playmobilSales2024', { force: false });
        const s25 = await loadSpreadsheet('playmobilSales2025', { force: false });
        setRows2024(s24);
        setRows2025(s25);
      } catch (err) {
        console.warn('[CustomerSalesSummaryTest]', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <SafeScreen>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeScreen>
    );

  // find header
  const headerIndex2024 = rows2024.findIndex((r) => String(r[4]).trim() === 'Bill-to');
  const headerIndex2025 = rows2025.findIndex((r) => String(r[4]).trim() === 'Bill-to');
  const data2024 = headerIndex2024 !== -1 ? rows2024.slice(headerIndex2024 + 1) : rows2024;
  const data2025 = headerIndex2025 !== -1 ? rows2025.slice(headerIndex2025 + 1) : rows2025;

  // merge by Bill-to
  const merged = data2025
    .map((r25) => {
      const code = String(r25[4]).trim();
      const match = data2024.find((r24) => String(r24[4]).trim() === code);
      const name = String(r25[5] || r24?.[5] || '');
      return { code, name, r25, r24: match };
    })
    .filter((r) =>
      !search ? true : r.name.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <SafeScreen title="Playmobil Sales Comparison 2024–2025" scroll>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>
          Σύγκριση Πωλήσεων 2024 – 2025 ({merged.length} πελάτες)
        </Text>

        <TextInput
          style={styles.search}
          placeholder="Αναζήτηση πελάτη..."
          value={search}
          onChangeText={setSearch}
        />

        {merged.map(({ code, name, r24, r25 }) => {
          // read comparable fields (using same indices as main file)
          const sales24 = r24 ? toNumber(r24[15]) : 0; // invoiced 2024
          const sales25 = r25 ? toNumber(r25[15]) : 0; // invoiced 2025
          const delta =
            sales24 && sales25
              ? ((sales25 - sales24) / sales24) * 100
              : 0;
          const color = delta >= 0 ? 'green' : 'red';

          return (
            <View key={code} style={styles.box}>
              <Text style={styles.name}>{name || 'Χωρίς όνομα'}</Text>
              <Text style={styles.code}>Κωδ: {code}</Text>
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>2024</Text>
                  <Text style={styles.value}>
                    {sales24.toLocaleString('el-GR', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </Text>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>2025</Text>
                  <Text style={styles.value}>
                    {sales25.toLocaleString('el-GR', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </Text>
                </View>
                <View style={styles.colSmall}>
                  <Text style={[styles.delta, { color }]}>
                    {delta.toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  header: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 10,
  },
  search: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  box: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  code: { fontSize: 13, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    justifyContent: 'space-between',
  },
  col: { width: '40%' },
  colSmall: { width: '20%', alignItems: 'center' },
  label: { fontSize: 13, color: colors.textSecondary },
  value: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  delta: { fontSize: 14, fontWeight: '700' },
});
