# Playmobil Best Sellers Feature

## Overview
This feature marks the top 100 selling Playmobil products with a trophy badge in the order product selection screen.

## Setup Instructions

### 1. Update Spreadsheet ID
In `firestore-import/firestoreManager_full.js`, line ~215, update the spreadsheet ID:

```javascript
const bestSellersSpreadsheetId = 'YOUR_18MB_SPREADSHEET_ID_HERE';
```

Replace with your large 18MB spreadsheet's Google Drive ID.

### 2. Sheet Name Configuration
The script looks for a sheet named **`Top 100`** by default. If your sheet has a different name:

```javascript
const bestSellerCodes = await fetchPlaymobilBestSellers(bestSellersSpreadsheetId, 'Your Sheet Name');
```

### 3. Column Name Requirements
The sheet should have a column with product codes. The script checks for these column names (case-sensitive):
- `Product Code`
- `Code`
- `ProductCode`
- `product_code`
- `ΚΩΔΙΚΟΣ`
- `Κωδικός`

If your column has a different name, add it to the list in `fetchPlaymobilBestSellers()`.

## How It Works

### Import Process
1. **Fetch Best Sellers**: Reads the "Top 100" sheet from your large spreadsheet
2. **Extract Codes**: Collects all product codes into a Set
3. **Mark Products**: During product import, adds `bestSeller: true` to matching products
4. **Summary**: Logs how many products were marked as best sellers

### Display
- **Badge**: Gold trophy icon (🏆) overlaid on product image
- **Position**: Top-left corner of product image with dark semi-transparent background
- **Visibility**: Only shown for Playmobil products where `bestSeller === true`

## Running the Import

```bash
cd firestore-import
node firestoreManager_full.js
```

Select: **1.1 Import Playmobil products**

### Expected Output
```
📊 Fetching best sellers from sheet: Top 100...
📊 Found 100 best seller rows
✅ Found 100 unique best seller product codes
📦 Importing Playmobil products...
📊 Total rows read from CSV: 2450
...
✅ Playmobil products import done. Processed: 2450, Skipped: 12
⭐ Best sellers marked: 98 out of 100 in list
```

## Troubleshooting

### Sheet Not Found
```
⚠️ Sheet "Top 100" not found. Available sheets: Sheet1, Data, Summary
```
**Solution**: Check the sheet name and update the parameter in `fetchPlaymobilBestSellers()`.

### No Best Sellers Marked
```
⭐ Best sellers marked: 0 out of 100 in list
```
**Possible causes**:
1. Product codes in spreadsheet don't match product CSV codes
2. Column name doesn't match the expected names
3. Codes have extra spaces or formatting differences

**Solution**: Check the first few rows in your spreadsheet and compare with product codes.

### Large File Performance
The 18MB spreadsheet may take 30-60 seconds to download and parse. This is normal.

## Data Structure

### Firestore Field
```javascript
{
  productCode: "71364",
  description: "PLAYMOBIL Castle",
  wholesalePrice: 45.50,
  srp: 60.00,
  bestSeller: true,  // ← New field
  brand: "playmobil",
  lastUpdated: Timestamp
}
```

### UI Component
```javascript
{isBestSeller && (
  <View style={styles.bestSellerBadge}>
    <Ionicons name="trophy" size={14} color="#FFD700" />
  </View>
)}
```

## Future Enhancements

### Monthly Updates
Consider scheduling the import monthly to refresh best seller status:
1. Update the spreadsheet with new sales data
2. Re-run the Playmobil product import
3. Old best sellers will automatically lose the badge
4. New top 100 products will get the badge

### Custom Badge Styles
Modify `styles.bestSellerBadge` in OrderProductSelectionScreen.js:
```javascript
bestSellerBadge: {
  position: 'absolute',
  top: 6,
  left: 6,
  backgroundColor: 'rgba(255, 215, 0, 0.95)', // Gold background
  borderRadius: 12,
  paddingHorizontal: 6,
  paddingVertical: 3,
  borderWidth: 1,
  borderColor: '#FFD700',
}
```

### Add Text Label
```javascript
<View style={styles.bestSellerBadge}>
  <Ionicons name="trophy" size={12} color="#000" />
  <Text style={{ color: '#000', fontSize: 10, marginLeft: 3, fontWeight: 'bold' }}>
    TOP 100
  </Text>
</View>
```

## Notes
- Best seller status is stored in Firestore, not calculated on the fly
- Badge only shows for Playmobil brand products
- Products retain their best seller status until the next import
- No performance impact on order screen (simple boolean check)
