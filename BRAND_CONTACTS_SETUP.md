# Firestore Indexes for brand_contacts Collection

## Required Composite Index

To enable efficient querying of contacts by brand with ordering, create this composite index in Firebase Console:

### Index 1: brand + active + sortOrder + fullName
- Collection: `brand_contacts`
- Fields indexed:
  1. `brand` (Ascending)
  2. `active` (Ascending)  
  3. `sortOrder` (Ascending)
  4. `fullName` (Ascending)

### How to create:

1. Go to Firebase Console > Firestore Database > Indexes
2. Click "Create Index"
3. Collection ID: `brand_contacts`
4. Add fields in this order:
   - brand: Ascending
   - active: Ascending
   - sortOrder: Ascending
   - fullName: Ascending
5. Query scope: Collection
6. Click "Create"

Alternatively, run a query in your app and Firebase will show a link to auto-create the index.

## Data Structure Example

```json
{
  "id": "auto_generated_doc_id",
  "brand": "playmobil",
  "department": "LOGISTICS",
  "fullName": "ΙΩΑΝΝΗΣ ΠΑΠΑΔΟΠΟΥΛΟΣ",
  "mobile": "6912345678",
  "pmh": "123",
  "internal": "456",
  "fullPhone": "210-1234567",
  "email": "ioannis@company.gr",
  "active": true,
  "sortOrder": 0,
  "createdAt": "2025-11-20T10:00:00Z",
  "updatedAt": "2025-11-20T10:00:00Z"
}
```

## Import from firestoreManager_full.js (RECOMMENDED)

### Setup:
1. Navigate to firestore-import directory:
   ```powershell
   cd firestore-import
   ```

2. Install dependencies (if not already installed):
   ```powershell
   npm install
   ```

3. Run the manager:
   ```powershell
   node firestoreManager_full.js
   ```

### Import Contacts:

**For Playmobil:**
1. Select option `1` (Playmobil)
2. Select option `1.3` (Import Playmobil contacts)
3. Contacts will be imported from CSV and saved to Firestore with brand="playmobil"

**For Kivos:**
1. Select option `2` (Kivos)
2. Select option `2.3` (Import Kivos contacts)
3. Contacts will be imported with brand="kivos"

**For John:**
1. Select option `3` (John)
2. Select option `3.3` (Import John contacts)
3. Contacts will be imported with brand="john"

### What happens during import:
- Fetches CSV from Google Sheets
- Parses all contact rows
- **Deletes existing contacts for that brand** (to avoid duplicates)
- Imports new contacts with proper brand field
- Sets sortOrder, active=true, timestamps

## Alternative: Import from Mobile App (Dev Mode)

For testing/debugging only:

1. Open BrandContactsScreen for a brand (e.g., Playmobil)
2. Tap "Εισαγωγή από CSV" button (only visible in __DEV__ mode)
3. Confirm the import
4. The service will:
   - Fetch CSV from Google Sheets
   - Parse contacts
   - Clear existing contacts for that brand
   - Import new contacts with brand field set

## CSV Source

Google Sheets CSV URL:
```
https://docs.google.com/spreadsheets/d/e/2PACX-1vSi-P7gMMVUVBTxzZv7zFotre9UY9G3c91-r_jW1vexoxiUoA7aMUMJJRgz7neY566qVtpv92CbVH9A/pub?gid=734595660&single=true&output=csv
```

CSV Headers:
- Τμήμα (Department)
- ΟΝΟΜΑΤΕΠΩΝΥΜΟ (Full Name)
- ΚΙΝΗΤΟ (Mobile)
- PMH
- Internal
- Πλήρες Τηλ. (Full Phone)
- Email

## Updating Contacts

When HR updates the Google Sheet:

1. Run `node firestoreManager_full.js`
2. Navigate to the brand menu (1 for Playmobil, 2 for Kivos, 3 for John)
3. Select the contacts import option
4. The import will clear old data and sync new data

**Note:** Import is brand-specific. Updating Playmobil contacts won't affect Kivos or John contacts.
