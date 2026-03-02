// INVENTORY IMPLEMENTATION PROGRESS TRACKER
// Last Updated: December 15, 2025

=== COMPLETED TASKS ===

✅ Task 1: Create Inventory Service
   File: src/services/inventoryService.js
   Features:
   - Session management (createSession, addLineToSession)
   - Offline queue storage (AsyncStorage)
   - Firestore sync (syncOfflineQueue)
   - Product matching by barcode/SKU
   - Line merging to prevent duplicates
   - Active inventory tracking per customer
   
✅ Task 2: Create Barcode Scan Screen
   File: src/screens/ScanInventoryScreen.js
   Features:
   - Camera-based scanning (expo-camera)
   - Manual entry mode
   - Debounced barcode processing
   - Session line management
   - Offline indicator
   - Confirmation modal

✅ Task 3: Create CSV/XLS Upload Screen
   File: src/screens/InventoryUploadScreen.js
   Features:
   - File picker (DocumentPicker)
   - XLSX parsing
   - Auto-detect column names
   - Interactive column mapping UI
   - Preview of first 5 rows
   - Confirmation with note entry
   - Bulk product matching

✅ Task 4: Create Inventory Hook
   File: src/hooks/useCustomerInventory.js
   Features:
   - Fetch active inventory from Firestore
   - Auto-sync on online status change
   - Loading state management
   - Sync status tracking
   - Manual refresh capability

✅ Task 5: Create Inventory Badge Component
   File: src/components/CustomerInventoryBadge.js
   Features:
   - 3 variants: badge (small), inline (text), full (details)
   - Stock status visualization
   - Location display
   - UoM display
   - Color-coded (green/red)


=== REMAINING TASKS ===

⏳ Task 6: Integrate Stock Display in Playmobil Order Flow
   Target File: src/screens/OrderProductSelectionScreen.js
   
   STEPS:
   1. Import the hook and badge component:
      ```javascript
      import { useCustomerInventory } from '../hooks/useCustomerInventory';
      import CustomerInventoryBadge from '../components/CustomerInventoryBadge';
      ```
   
   2. Get customer ID from order context:
      ```javascript
      const customerId = orderCustomer?.id;
      ```
   
   3. Call the hook at the top of the component:
      ```javascript
      const { lines: inventoryLines, loading: inventoryLoading } = useCustomerInventory(customerId);
      ```
   
   4. In your product list item, add the badge:
      ```javascript
      <CustomerInventoryBadge 
        lines={inventoryLines}
        productId={item.id}
        variant="inline"
      />
      ```
   
   5. Optionally add an "In Stock Only" filter toggle:
      ```javascript
      const [showInStockOnly, setShowInStockOnly] = useState(false);
      
      const filteredProducts = useMemo(() => {
        let result = products; // existing filtering logic
        
        if (showInStockOnly && inventoryLines?.length > 0) {
          result = result.filter(p => {
            const stock = inventoryLines.find(l => l.productId === p.id);
            return stock && stock.qty > 0;
          });
        }
        
        return result;
      }, [products, inventoryLines, showInStockOnly]);
      ```


⏳ Task 7: Add Navigation Routes for Inventory
   Target File: src/navigation/PlaymobilStackNavigator.js (or main navigation file)
   
   STEPS:
   1. Import the screens:
      ```javascript
      import ScanInventoryScreen from '../screens/ScanInventoryScreen';
      import InventoryUploadScreen from '../screens/InventoryUploadScreen';
      ```
   
   2. Add Stack.Screen entries:
      ```javascript
      <Stack.Screen 
        name="ScanInventory" 
        component={ScanInventoryScreen}
        options={{ 
          title: 'Scan Inventory',
          headerShown: false 
        }}
      />
      
      <Stack.Screen 
        name="InventoryUpload" 
        component={InventoryUploadScreen}
        options={{ 
          title: 'Upload Inventory',
          headerShown: false 
        }}
      />
      ```
   
   3. To navigate from customer screen:
      ```javascript
      navigation.navigate('ScanInventory', { customerId: customer.id });
      // OR
      navigation.navigate('InventoryUpload', { customerId: customer.id });
      ```


⏳ Task 8: Set Up Firestore Schema & Rules
   
   FIRESTORE COLLECTION STRUCTURE:
   ```
   /customers/{customerId}
     - currentInventoryId: string
     - lastInventorySyncAt: timestamp
     
     /inventories/{inventoryId}
       - inventoryId: string
       - customerId: string
       - version: number
       - status: 'active' | 'archived' | 'deleted'
       - source: 'scan' | 'upload'
       - note: string
       - rowCount: number
       - totalQty: number
       - createdAt: timestamp
       - createdBy: string (userId)
       
       /lines/{lineId}
         - lineId: string
         - productId: string
         - barcode: string
         - sku: string
         - name: string
         - qty: number
         - uom: string
         - location: string (optional)
         - price: number (optional)
         - updatedAt: timestamp
   ```
   
   FIRESTORE SECURITY RULES:
   Add to your firestore.rules file:
   ```
   // Inventory management
   match /customers/{customerId}/inventories/{inventoryId} {
     allow read: if request.auth.uid != null && 
                    (request.auth.token.inventory_read == true ||
                     request.auth.token.order_read == true);
     allow create: if request.auth.uid != null && 
                      request.auth.token.inventory_write == true &&
                      request.resource.data.customerId == customerId;
     allow update: if request.auth.uid != null && 
                      request.auth.token.inventory_write == true &&
                      request.resource.data.status == 'archived' &&
                      resource.data.status == 'active';
     allow delete: if false; // Use soft deletes only
     
     match /lines/{lineId} {
       allow read: if parent.data.status in ['active', 'archived'];
       allow create: if request.auth.uid != null;
     }
   }
   ```


⏳ Task 9: Integrate Offline Sync in App Startup
   Target File: src/App.js
   
   STEPS:
   1. Import the service:
      ```javascript
      import InventoryService from './src/services/inventoryService';
      ```
   
   2. In your app initialization (after auth is ready):
      ```javascript
      useEffect(() => {
        if (user) {
          // Attempt to sync any pending offline inventories
          InventoryService.syncOfflineQueue(user.uid)
            .then(result => {
              console.log('[App] Inventory sync result:', result);
            })
            .catch(err => console.error('[App] Inventory sync error:', err));
        }
      }, [user]);
      ```
   
   3. Optional: Add to online status listener in OnlineStatusContext:
      ```javascript
      // In src/utils/OnlineStatusContext.js NetInfo listener
      const handleConnectivityChange = (state) => {
        setIsConnected(state.isConnected);
        
        if (state.isConnected && user) {
          // Auto-sync when going online
          InventoryService.syncOfflineQueue(user.uid).catch(err => 
            console.error('[OnlineStatus] Sync error:', err)
          );
        }
      };
      ```


⏳ Task 10: Test End-to-End Flow
   
   TEST CHECKLIST:
   
   [ ] Barcode Scanning:
       - Open customer detail screen
       - Navigate to "Scan Inventory"
       - Test camera mode (scan a barcode)
       - Test manual mode (type barcode)
       - Add multiple items
       - Remove an item
       - Save inventory offline
       - Verify data in AsyncStorage (DevTools)
   
   [ ] CSV Upload:
       - Create test CSV with columns: Barcode, SKU, Name, Quantity, Location
       - Upload file
       - Verify column auto-detection
       - Manually map columns if needed
       - Preview first 5 rows
       - Confirm upload
       - Verify offline queue
   
   [ ] Offline Sync:
       - Disable network
       - Create inventory (scan or upload)
       - Verify saved in AsyncStorage
       - Enable network
       - Verify sync happens automatically
       - Check Firestore for created inventories
       - Verify /customers/{customerId}/currentInventoryId is set
   
   [ ] Order Flow Integration:
       - Go to Playmobil order for customer with inventory
       - Verify stock badges appear on products
       - Check badge color (green = in stock, red = out of stock)
       - Try "In Stock Only" filter if implemented
       - Add items to order from available stock
   
   [ ] Edge Cases:
       - Upload file with missing products (should skip with error count)
       - Scan duplicate products multiple times (should merge quantities)
       - Switch to different customer (inventory should clear/reload)
       - Try scanning unknown barcode (should show error)
       - Create offline inventory, then switch customer, then sync


=== DEPENDENCIES REQUIRED ===

Already should be installed:
✓ react-native-async-storage/async-storage
✓ @react-native-firebase/firestore
✓ expo-camera
✓ react-native-vector-icons
✓ @react-navigation/native

May need to install:
- react-native-document-picker (for file upload)
- xlsx (for Excel parsing)
- lodash.debounce (for barcode debouncing)

Install with:
```bash
npm install react-native-document-picker xlsx lodash.debounce
```


=== QUICK START NEXT STEPS ===

1. Check your navigation structure to find where to add inventory routes
2. Update OrderProductSelectionScreen with the hook and badge component
3. Run a test scan and CSV upload with offline mode
4. Monitor Firestore to see synced data
5. Test the complete order flow with stock display
