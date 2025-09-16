import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { loadImmediateAvailabilityFromCache } from '../utils/stockAvailability';

const SHEET_ID = '1VG7QzMgj0Ib0jNXZM5dLFgDyyer8gvSmkkaVZzMZcEM';
const SHEET_NAME = 'Sheet1';

const HEADER_RANGE = `A2:U2`;
const DATA_RANGE = `A3:U`;

const HIGHLIGHTED_COLUMNS = [
  "Απόθεμα ΡΜΗ",
  "Άμεσα Διαθέσιμα (για παραγγελίες προς άμεση εκτέλεση)",
  "Διαθέσιμα για νέες παραγγελίες παράδοσης εντός 10ημ"
];

function formatGoogleDate(str) {
  if (!str || typeof str !== 'string') return str;
  const match = str.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?/);
  if (match) {
    const [, year, month, day, hour, minute] = match.map(x => x === undefined ? undefined : Number(x));
    const pad = n => n < 10 ? '0' + n : n;
    if (hour !== undefined && minute !== undefined) {
      return `${pad(day)}/${pad(month + 1)}/${year} ${pad(hour)}:${pad(minute)}`;
    } else {
      return `${pad(day)}/${pad(month + 1)}/${year}`;
    }
  }
  return str;
}

function parseSheetJSON(text) {
  const json = JSON.parse(text.substr(47).slice(0, -2));
  const rows = json.table.rows;
  return rows.map(row => row.c.map(cell => (cell ? cell.v : '')));
}

function getStockColor(val) {
  const n = Number(val);
  if (isNaN(n)) return '#222';
  if (n === 0) return '#ff2222';
  if (n > 0 && n < 10) return '#FFC300';
  return '#222';
}

const StockDetailsScreen = ({ route }) => {
  const { product } = route.params || {};
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productCode, setProductCode] = useState('');
  const [immediateStock, setImmediateStock] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await loadImmediateAvailabilityFromCache();
        const code = product?.productCode ? String(product.productCode).trim() : null;
        if (!cancelled && code && map && map.has(code)) {
          setImmediateStock(map.get(code));
        }
      } catch {
        // ignore cache preload errors
      }
    })();
    return () => { cancelled = true; };
  }, [product?.productCode]);

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Fetch header row
        const headerRes = await fetch(
          `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}&range=${HEADER_RANGE}`
        );
        const headerText = await headerRes.text();
        const headersRaw = parseSheetJSON(headerText)[0];

        // 2. Fetch data rows
        const dataRes = await fetch(
          `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}&range=${DATA_RANGE}`
        );
        const dataText = await dataRes.text();
        const dataRows = parseSheetJSON(dataText);

        // 3. Fetch timestamp from C1 and format
        const lastUpdatedRes = await fetch(
          `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}&range=C1:C1`
        );
        const lastUpdatedText = await lastUpdatedRes.text();
        const lastUpdatedJson = JSON.parse(lastUpdatedText.substr(47).slice(0, -2));
        let lastUpdatedVal = lastUpdatedJson.table.rows?.[0]?.c?.[0]?.v || '';
        lastUpdatedVal = formatGoogleDate(lastUpdatedVal);
        setLastUpdated(lastUpdatedVal);

        // Always: Product code = index 1, Description = index 2, Απόθεμα PMH = 3
        const productCodeIndex = 1, descriptionIndex = 2, colUIndex = 20;

        // Find matching row
        const matchingRows = dataRows.filter(row =>
          (row[productCodeIndex] !== undefined && row[productCodeIndex] !== null) &&
          row[productCodeIndex].toString().trim() === product.productCode.toString().trim()
        );

        let fetchedImmediate = null;
        // Grab code & desc from first match, if any
        if (matchingRows.length) {
          setProductCode(matchingRows[0][productCodeIndex]);
          setProductDescription(matchingRows[0][descriptionIndex]);
        } else {
          setProductCode('');
          setProductDescription('');
        }

        // --- NEW LOGIC FOR ORDER ---
        // Remove product code, description, col U, blanks, as before
        // Remove row under ΣΧΟΛΙΟ and 3 under No (or low) stock in GERMANY
        // Remove repeated headers for core fields after first occurrence
        const idx_SXOLIO = headersRaw.findIndex(h => h && h.toString().startsWith("ΣΧΟΛΙΟ"));
        const idx_NOLOW = headersRaw.findIndex(h => h && h.toString().startsWith("No (or low) stock"));

        const headersToRemoveIfRepeated = [
          "1η Κυκλοφ. Νέου Κωδικού",
          "Απόθεμα ΡΜΗ",
          "Παραγγελίες πελατών σε delivery",
          "Ανεκτέλεστες παραγγελίες σε αναμονή"
        ];

        // Find our two special fields (to be moved)
        const idx_Amesa = headersRaw.findIndex(h =>
          h && h.includes("Άμεσα Διαθέσιμα")
        );
        const idx_Neew = headersRaw.findIndex(h =>
          h && h.includes("Διαθέσιμα για νέες παραγγελίες παράδοσης")
        );

        // Remember their values, so we can re-insert them later in the new spot
        let amesaField = null, neewField = null;
        if (idx_Amesa !== -1) { amesaField = { h: headersRaw[idx_Amesa], idx: idx_Amesa }; }
        if (matchingRows.length && idx_Amesa !== -1) fetchedImmediate = matchingRows[0][idx_Amesa];
        if (idx_Neew !== -1) neewField = { h: headersRaw[idx_Neew], idx: idx_Neew };

        // Build headers, skipping the two special fields for now
        const usedOnce = new Set();
        let orderedHeaders = [];
        for (let i = 0; i < headersRaw.length; ++i) {
          if (
            [productCodeIndex, descriptionIndex, colUIndex, idx_Amesa, idx_Neew].includes(i) ||
            !headersRaw[i] ||
            headersRaw[i].toString().trim() === ""
          )
            continue;
          if (i === idx_SXOLIO + 1) continue;
          if (i === idx_NOLOW + 1 || i === idx_NOLOW + 2 || i === idx_NOLOW + 3)
            continue;
          if (headersToRemoveIfRepeated.includes(headersRaw[i])) {
            if (usedOnce.has(headersRaw[i])) continue;
            usedOnce.add(headersRaw[i]);
          }
          orderedHeaders.push({ h: headersRaw[i], idx: i });
        }

        // Insert our two special fields just after "Ανεκτέλεστες παραγγελίες σε αναμονή"
        const idx_Ank = orderedHeaders.findIndex(obj =>
          obj.h && obj.h.includes("Ανεκτέλεστες παραγγελίες σε αναμονή")
        );
        if (idx_Ank !== -1) {
          let insertAt = idx_Ank + 1;
          const insertArr = [];
          if (amesaField) insertArr.push(amesaField);
          if (neewField) insertArr.push(neewField);
          orderedHeaders = [
            ...orderedHeaders.slice(0, insertAt),
            ...insertArr,
            ...orderedHeaders.slice(insertAt)
          ];
        }

        // Compose rows as before
        const fixedRows = matchingRows.map(row =>
          orderedHeaders.map(obj =>
            obj.idx === 0 ? formatGoogleDate(row[obj.idx]) : row[obj.idx]
          )
        );
        setRows(fixedRows);
        setHeaders(orderedHeaders.map(obj => obj.h));
        if (fetchedImmediate != null && fetchedImmediate !== '') setImmediateStock(fetchedImmediate);

        // DEBUG
        let debugOutput = `HEADER ROW: ${JSON.stringify(headersRaw)}\n`;
        debugOutput += `product.productCode: "${product.productCode}"\n`;
        debugOutput += `Συνολικοί Matches: ${matchingRows.length}\n`;
        debugOutput += `Matching rows:\n${JSON.stringify(matchingRows)}\n`;
        setDebug(debugOutput);

      } catch (e) {
        setDebug('Error: ' + e.message);
        setHeaders([]);
        setRows([]);
        setProductCode('');
        setProductDescription('');
        try {
          const map = await loadImmediateAvailabilityFromCache();
          const code = product?.productCode ? String(product.productCode).trim() : null;
          if (code && map && map.has(code)) setImmediateStock(map.get(code));
        } catch {
          // ignore cache fallback errors
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [product]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!rows.length) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#777', fontSize: 17 }}>
          Δεν βρέθηκαν στοιχεία αποθέματος για αυτό το προϊόν.
        </Text>
        <ScrollView>
          <Text selectable style={{ fontSize: 11, color: 'crimson', marginTop: 30, backgroundColor: '#fffbe6' }}>
            {debug}
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Αναλυτικά Αποθέματα</Text>
      {lastUpdated ? (
        <Text style={styles.lastUpdated}>Τελευταία ενημέρωση: {lastUpdated}</Text>
      ) : null}
      {(productCode || productDescription) && (
        <View style={styles.productHeader}>
          <Text style={styles.productHeaderText}>
            <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>{productCode}</Text>
            {" — "}
            <Text style={{ color: '#007AFF' }}>{productDescription}</Text>
          </Text>
        </View>
      )}
      {immediateStock != null ? (
        <View style={styles.stockSummary}>
          <Text style={styles.stockSummaryLabel}>Stock:</Text>
          <Text style={styles.stockSummaryValue}>{String(immediateStock)}</Text>
        </View>
      ) : null}
      {rows.map((row, i) => (
        <View key={i} style={styles.block}>
          {headers.map((header, j) => {
            const isApoThema = header && header.toString().includes("Απόθεμα");
            const highlight = HIGHLIGHTED_COLUMNS.includes(header);
            const cellColor = highlight ? getStockColor(row[j]) : '#222';
            const labelColor = highlight ? cellColor : '#007AFF';
            return (
              <View
                key={j}
                style={[
                  styles.tableRow,
                  isApoThema && styles.apothemaRow,
                  highlight && !isApoThema && styles.highlightRow,
                ]}
              >
                <View style={styles.cell}>
                  <Text
                    style={[
                      styles.label,
                      highlight && { color: labelColor, fontWeight: 'bold', textDecorationLine: 'underline' },
                    ]}
                  >
                    {header}
                  </Text>
                </View>
                <View style={styles.cell}>
                  <Text
                    style={[
                      styles.value,
                      highlight && { color: cellColor, fontWeight: 'bold', fontSize: 16 },
                    ]}
                  >
                    {row[j]}
                  </Text>
                </View>
              </View>
            );
          })}
          {i < rows.length - 1 && <View style={styles.separator} />}
        </View>
      ))}
      {/* Hide debug in production */}
      {/* <ScrollView>
        <Text selectable style={{ fontSize: 11, color: '#444', marginTop: 30, backgroundColor: '#fffbe6' }}>
          {debug}
        </Text>
      </ScrollView> */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#007AFF', marginBottom: 6, textAlign: 'center' },
  lastUpdated: { fontSize: 14, color: '#555', marginBottom: 10, textAlign: 'center' },
  productHeader: { marginBottom: 14, padding: 8, borderRadius: 8, backgroundColor: '#e9f4ff' },
  productHeaderText: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center' },
  block: { marginBottom: 22 },
  separator: {
    height: 1,
    backgroundColor: '#dde5ec',
    marginVertical: 6,
    borderRadius: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  apothemaRow: {
    backgroundColor: '#FFFACD', // highlighted yellow for Απόθεμα PMH row
  },
  highlightRow: {
    backgroundColor: '#fffbe6',
  },
  cell: {
    flex: 1,
    minWidth: 110,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  label: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#007AFF',
    marginBottom: 2,
    marginLeft: 2,
  },
  value: {
    fontSize: 15,
    color: '#222',
    marginBottom: 2,
  },
  stockSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, alignSelf: 'flex-start' },
  stockSummaryLabel: { fontWeight: 'bold', color: '#007AFF', fontSize: 15, marginRight: 6 },
  stockSummaryValue: { fontSize: 15, fontWeight: 'bold', color: '#222' },
});

export default StockDetailsScreen;
