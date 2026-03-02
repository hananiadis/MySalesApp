import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { getLastSyncTime, listAllMetadata } from '../../services/cacheService';
import { forceRefreshAll } from '../../services/optimizedFirestoreService';

const collectionNames = [
  'brands_contacts',
  'customers',
  'customers_john',
  'customers_kivos',
  'orders',
  'orders_john',
  'orders_john_supermarket',
  'orders_kivos',
  'products',
  'products_john',
  'products_kivos',
  'salesmen',
  'sheetsCache',
  'stock_kivos',
  'stock_kivos_history',
  'supermarket_listings',
  'supermarket_meta',
  'supermarket_stores',
  'supplier_order_kivos', // singular per user's list
  'users',
];

const FirestoreDebugScreen = () => {
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tests');
  const [inputText, setInputText] = useState('');
  const [consoleHistory, setConsoleHistory] = useState([]);
  const consoleRef = useRef(null);
  const [sampleCount, setSampleCount] = useState(1);
  const [samples, setSamples] = useState({}); // { collectionName: [docs...] }

  const log = (msg) => setOutput((prev) => prev + msg + '\n');

  const addConsoleEntry = (text, type = 'info') => {
    const timestamp = new Date().toISOString();
    setConsoleHistory((prev) => [...prev, { timestamp, text, type }]);
  };

  const parseCommand = (input) => {
    const parts = input.trim().split(/\s+/);
    const command = parts[0] || '';
    const args = parts.slice(1);
    return { command, args };
  };

  const safeHandler = (fn) => async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      return `Error: ${err?.message || 'Unknown error'}`;
    }
  };

  const handlers = useMemo(
    () => ({
      help: safeHandler(async () =>
        [
          'Available commands:',
          'help',
          'whoami',
          'date',
          'ping',
          'getUserProfile',
          'myBrands',
          'myRole',
          'token',
          'rulesCheck',
          'readCollection <name>',
          'readDoc <collection> <id>',
          'runTest <testName>',
          'checkRulesVersion',
        ].join('\n'),
      ),
      whoami: safeHandler(async () => {
        const user = auth.currentUser;
        if (!user) return 'No authenticated user.';
        return {
          uid: user.uid,
          email: user.email || 'N/A',
          providerData: user.providerData || [],
        };
      }),
      date: safeHandler(async () => new Date().toISOString()),
      ping: safeHandler(async () => 'pong'),
      getUserProfile: safeHandler(async () => {
        const user = auth.currentUser;
        if (!user) return 'No authenticated user.';
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) return 'User profile not found.';
        return { id: snap.id, ...snap.data() };
      }),
      myBrands: safeHandler(async () => {
        const user = auth.currentUser;
        if (!user) return 'No authenticated user.';
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) return 'User profile not found.';
        return snap.data()?.brands ?? 'brands not set';
      }),
      myRole: safeHandler(async () => {
        const user = auth.currentUser;
        if (!user) return 'No authenticated user.';
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) return 'User profile not found.';
        return snap.data()?.role ?? 'role not set';
      }),
      token: safeHandler(async () => {
        const user = auth.currentUser;
        if (!user) return 'No authenticated user.';
        const tokenResult = await user.getIdTokenResult(true);
        return tokenResult?.claims || {};
      }),
      rulesCheck: safeHandler(async () => {
        const user = auth.currentUser;
        if (!user) return 'No authenticated user.';
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : {};
        const role = data.role;
        const brands = data.brands || [];
        const isKivosWarehouseUser =
          ['warehouse_manager', 'owner', 'admin'].includes(role) &&
          Array.isArray(brands) &&
          brands.includes('kivos');
        return {
          uid: user.uid,
          role: role ?? null,
          brands,
          isKivosWarehouseUser,
        };
      }),
      lastSync: safeHandler(async () => {
        const keys = ['orders_kivos', 'products_kivos', 'customers_kivos', 'stock_kivos'];
        const values = await Promise.all(keys.map((k) => getLastSyncTime(k)));
        const result = keys.reduce((acc, k, i) => {
          const ts = values[i];
          acc[k] = ts ? new Date(ts).toISOString() : null;
          return acc;
        }, {});
        return result;
      }),
      refreshAllAndSync: safeHandler(async () => {
        await forceRefreshAll();
        const keys = ['orders_kivos', 'products_kivos', 'customers_kivos', 'stock_kivos'];
        const values = await Promise.all(keys.map((k) => getLastSyncTime(k)));
        const result = keys.reduce((acc, k, i) => {
          const ts = values[i];
          acc[k] = ts ? new Date(ts).toISOString() : null;
          return acc;
        }, {});
        const metadata = await listAllMetadata();
        return { message: 'Force refresh completed', lastSync: result, metadata };
      }),
      readCollection: safeHandler(async (name) => {
        if (!name) return 'Usage: readCollection <name>';
        const snap = await getDocs(collection(db, name));
        const data = snap.docs.slice(0, 20).map((d) => ({ id: d.id, ...d.data() }));
        return { count: snap.size, items: data };
      }),
      readDoc: safeHandler(async (col, id) => {
        if (!col || !id) return 'Usage: readDoc <collection> <id>';
        const snap = await getDoc(doc(db, col, id));
        if (!snap.exists()) return 'document does not exist';
        return { id: snap.id, ...snap.data() };
      }),
      runTest: safeHandler(async (name) => {
        if (!name) return 'Usage: runTest <testName>';
        if (name.toLowerCase() === 'firestore') {
          await runTests();
          return 'Ran Firestore tests.';
        }
        return `Unknown test: ${name}`;
      }),
      checkRulesVersion: safeHandler(async () => 'rules-deployed-debug-2025-11-29'),
    }),
    [],
  );

  const handleCommandSubmit = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const { command, args } = parseCommand(trimmed);
    setInputText('');

    if (!handlers[command]) {
      addConsoleEntry(`Unknown command: ${command}. Type "help" for options.`, 'error');
      return;
    }

    try {
      const result = await handlers[command](...args);
      addConsoleEntry(typeof result === 'string' ? result : JSON.stringify(result, null, 2), 'info');
    } catch (err) {
      addConsoleEntry(err?.message || 'Command failed', 'error');
      console.error(err);
    }
  };

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleHistory]);

  const runTests = async () => {
    setOutput('');
    setIsLoading(true);

    try {
      log('Starting Firestore tests...\n');

      const aggregated = {};
      for (const name of collectionNames) {
        log(`=== ${name} ===`);
        const snapshot = await getDocs(collection(db, name));

        if (snapshot.empty) {
          log(`${name} is empty.\n`);
          continue;
        }

        log(`Count: ${snapshot.size}`);
        const take = Math.max(1, Math.min(Number(sampleCount) || 1, snapshot.size));
        const docs = [];
        for (let i = 0; i < take; i++) {
          const d = snapshot.docs[i];
          const ref = doc(db, name, d.id);
          const snap = await getDoc(ref);
          docs.push({ id: snap.id, ...snap.data() });
        }
        aggregated[name] = docs;
        log(
          `Sample documents (${take}): ${JSON.stringify(docs, null, 2)}\n`,
        );
      }

      setSamples(aggregated);

      log('Merging products_kivos + stock_kivos ...');
      const [productsSnap, stockSnap] = await Promise.all([
        getDocs(collection(db, 'products_kivos')),
        getDocs(collection(db, 'stock_kivos')),
      ]);

      const stockByCode = stockSnap.docs.reduce((acc, docSnap) => {
        const data = docSnap.data();
        if (data?.productCode) acc[data.productCode] = data;
        return acc;
      }, {});

      const merged = productsSnap.docs.map((docSnap) => {
        const product = docSnap.data();
        const stock = stockByCode[product.productCode] || {};

        return {
          productCode: product.productCode,
          description: product.description || product.ProductDescription || '',
          qtyOnHand: stock.qtyOnHand ?? 0,
          lowStockLimit: product.lowStockLimit ?? 0,
        };
      });

      log(`Merged array length: ${merged.length}`);
      if (merged.length > 0) {
        log(`First merged item: ${JSON.stringify(merged[0], null, 2)}\n`);
      } else {
        log('No merged items available (products_kivos empty).\n');
      }

      log('Firestore tests completed.');
    } catch (error) {
      console.error(error);
      log(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runRefreshAndShowSync = async () => {
    setIsLoading(true);
    setOutput('');
    try {
      log('Running Force Refresh + Sync Check...');
      const keys = ['orders_kivos', 'products_kivos', 'customers_kivos', 'stock_kivos'];
      // Force refresh via console handler path for consistency
      const refresh = await handlers.refreshAllAndSync();
      log(JSON.stringify(refresh, null, 2));
      // Also show the lastSync directly
      const values = await Promise.all(keys.map((k) => getLastSyncTime(k)));
      const result = keys.reduce((acc, k, i) => {
        const ts = values[i];
        acc[k] = ts ? new Date(ts).toLocaleString() : 'null';
        return acc;
      }, {});
      log('Last Sync (local time):');
      log(JSON.stringify(result, null, 2));
    } catch (e) {
      log(`Error: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Debug</p>
        <h1 className="text-2xl font-bold text-slate-900">Firestore Debug Page</h1>
        <p className="mt-1 text-sm text-slate-600">
          Run quick Firestore queries to validate connectivity and sample data.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('tests')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            activeTab === 'tests'
              ? 'bg-sky-600 text-white'
              : 'border border-slate-200 bg-white text-slate-700'
          }`}
        >
          Tests
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('console')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            activeTab === 'console'
              ? 'bg-sky-600 text-white'
              : 'border border-slate-200 bg-white text-slate-700'
          }`}
        >
          Console
        </button>
      </div>

      {activeTab === 'tests' ? (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-700">Samples per collection</label>
            <input
              type="number"
              min={1}
              max={50}
              value={sampleCount}
              onChange={(e) => setSampleCount(e.target.value)}
              className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm shadow-sm outline-none ring-2 ring-transparent transition focus:border-sky-500 focus:ring-sky-100"
            />
          </div>
          <button
            type="button"
            onClick={runTests}
            disabled={isLoading}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? 'Running…' : 'Run Firestore Tests'}
          </button>

          <button
            type="button"
            onClick={runRefreshAndShowSync}
            disabled={isLoading}
            className="ml-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? 'Running…' : 'Force Refresh + Show Sync'}
          </button>

          <button
            type="button"
            onClick={() => {
              try {
                const blob = new Blob([JSON.stringify(samples, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `firestore_samples_${new Date().toISOString().slice(0,10)}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              } catch (e) {
                addConsoleEntry(`Export failed: ${e?.message || 'Unknown error'}`, 'error');
              }
            }}
            className="ml-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100"
          >
            Export JSON
          </button>

          <pre className="h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-emerald-300">
            {output || 'Awaiting test output...'}
          </pre>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Debug Console</p>
            <button
              type="button"
              onClick={() => setConsoleHistory([])}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Clear Console
            </button>
          </div>
          <div
            ref={consoleRef}
            className="h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300"
          >
            {consoleHistory.length === 0 ? (
              <p className="text-slate-400">Console ready. Type "help" for commands.</p>
            ) : (
              consoleHistory.map((entry, idx) => (
                <pre
                  key={`${entry.timestamp}-${idx}`}
                  className={entry.type === 'error' ? 'text-rose-300' : 'text-emerald-300'}
                >
                  [{entry.timestamp}] {entry.text}
                </pre>
              ))
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCommandSubmit();
                }
              }}
              placeholder='Type a command (e.g., "help")'
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none ring-2 ring-transparent transition focus:border-sky-500 focus:ring-sky-100"
            />
            <button
              type="button"
              onClick={handleCommandSubmit}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              Run
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirestoreDebugScreen;
