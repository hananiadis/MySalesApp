# Firestore Import Manager

This note explains how `firestoreManager_full.js` pulls data from Google Sheets and writes it into Firestore for the three supported brands.

## Source → Firestore mapping

| Brand     | Products source (Google Sheet) | Parsed as              | Firestore collection | Customers source (Google Sheet) | Parsed as              | Firestore collection |
|-----------|--------------------------------|------------------------|----------------------|----------------------------------|------------------------|----------------------|
| Playmobil | `101kDd35o6MBky5KYx0i8MNA5GxIUiNGgYf_01T_7I4c` | CSV (`gid=0`)          | `products`          | `15iBRyUE0izGRi7qY_VhZgbdH7tojL1hq3F0LI6oIjqQ` | CSV (`gid=0`)          | `customers`          |
| Kivos     | `18qaTqILCUFuEvqcEM47gc-Ytj3GyNS1LI3Xkfx46Z48` | XLSX (first worksheet) | `products_kivos`    | `1pCVVgFiutK92nZFYSCkQCQbedqaKgvQahnix6bHSRIU` | XLSX (first worksheet) | `customers_kivos`    |
| John      | `18IFOPzzFvzXEgGOXNN0X1_mfZcxk2LlT_mRQj3Fqsv8` | XLSX (all worksheets)  | `products_john`     | `16E6ErNMb_kTyCYQIzpjaODo3aye0VQq9u_MbyNsd38o` | XLSX (first worksheet) | `customers_john`     |

> The spreadsheet IDs live in the `GOOGLE_SHEETS` constant and are combined with `https://docs.google.com/spreadsheets/d/<ID>/export?...` when the script runs.

## How each import works

1. **Fetch** – `fetchCsvRows` or `fetchXlsxWorkbook` downloads the sheet as a stream/array buffer depending on the format.
2. **Parse & normalise** – Helpers (`sanitizeText`, `sanitizeUrl`, `normalizeDecimal`, `roundCurrency`) clean each field before building the payload.
3. **Target collection lookup** – `BRAND_CONFIG` provides the Firestore collections (products/customers/orders) per brand.
4. **Upsert** – Rows are processed in batches (`db.batch()`), creating new docs with `importedAt` or updating changed fields and touching `lastUpdated`.
5. **Progress reporting** – `printProgress` renders a progress bar and totals for every batch.

## Command menu overview

Running `node firestoreManager_full.js` opens a CLI menu:

- **Playmobil** – `1.1` imports products (`products`), `1.2` imports customers (`customers`).
- **Kivos** – `2.1` imports products (`products_kivos`), `2.2` imports customers (`customers_kivos`).
- **John** – `3.1` imports products (`products_john`), `3.2` imports customers (`customers_john`).

## Column mapping reference

The script recognises both English and Greek headers. Below are the expected column families and the Firestore fields they populate.

### Playmobil products → `products`

- Product Code → `productCode` (document id)
- Barcode → `barcode`
- Playing Theme → `playingTheme`
- Product Description → `description`
- Launch Date → `launchDate`
- Package → `package`
- Wholesales Price → `wholesalePrice`
- SRP → `srp`
- Catalogue Page → `cataloguePage`
- Suggested playing Age → `suggestedAge`
- Gender → `gender`
- Front Cover (URL or `=IMAGE(...)`) → `frontCover`
- Available Stock GR → `availableStock`
- IsActive → `isActive`
- 2025AA → `aa2025`
- implicit: `brand: "playmobil"`, `lastUpdated`, `importedAt`

### Kivos products → `products_kivos`

- Κωδικός Προϊόντος / Product Code → `productCode` (document id)
- Περιγραφή / Description → `description`
- Brand → `supplierBrand`
- Κατηγορία Λιανικής → `category`
- MM → `mm`
- Τεμάχια ανά κιβώτιο / Pieces per box → `piecesPerBox`
- Τεμάχια ανά χαρτοκιβώτιο / Pieces per carton → `piecesPerCarton`
- Τεμάχια ανά συσκευασία / Pieces per pack → `piecesPerPack`
- Συσκευασία → `packaging`
- Τιμή Χονδρικής → `wholesalePrice`
- Τιμή Προσφοράς → `offerPrice`
- Barcode τεμαχίου / BARCODE Unit → `barcodeUnit`
- Barcode κιβωτίου / BARCODE Box → `barcodeBox`
- Barcode χαρτοκιβωτίου / BARCODE Carton → `barcodeCarton`
- Έκπτωση → `discount`
- Λήξη Έκπτωσης / Discount.End.Date → `discountEndsAt`
- Πλήρης Περιγραφή → `descriptionFull`
- Product Url → `productUrl`
- Cloudinary Image Url / Product Image Url → `frontCover`
- implicit: `brand: "kivos"`, `lastUpdated`, `importedAt`

### John products → `products_john`

- Κωδικός / Product Code → `productCode` (document id)
- Γενική Κατηγορία → `generalCategory`
- Υποκατηγορία → `subCategory`
- Barcode → `barcode`
- Περιγραφή / Description → `description`
- Συσκευασία → `packaging`
- Τιμοκατάλογος / Price List → `priceList`
- Τιμή Χονδρικής / Wholesale Price → `wholesalePrice`
- Λιανική Τιμή / Suggested Retail Price → `srp`
- Διαστάσεις Προϊόντος (cm) → `productDimensions`
- Διαστάσεις Συσκευασίας (cm) → `packageDimensions`
- Cloudinary Url / Photo → `frontCover`
- implicit: worksheet name → `sheetCategory`, plus `brand: "john"`, timestamps

### Playmobil customers → `customers`

- Customer Code → `customerCode` (document id)
- Name → `name`
- Name 3 → `name3`
- Street → `address.street`
- Postal Code → `address.postalCode`
- City → `address.city`
- Telephone 1 → `contact.telephone1`
- Telephone 2 → `contact.telephone2`
- Fax Number → `contact.fax`
- E-Mail Address → `contact.email`
- VAT Registration No. → `vatInfo.registrationNo`
- VAT Office → `vatInfo.office`
- Description Sales Group → `salesInfo.description`
- Group key → `salesInfo.groupKey`
- Group key 1 Text → `salesInfo.groupKeyText`
- Region ID → `region.id`
- Region → `region.name`
- Transportation Zone ID → `transportation.zoneId`
- Transportation Zone → `transportation.zone`
- Merch → `merch`
- implicit: `brand: "playmobil"`, timestamps

### Kivos customers → `customers_kivos`

- Κωδικός Πελάτη / Customer Code → `customerCode` (document id)
- Επωνυμία / Name → `name`
- Οδός / Street → `address.street`
- Τ.Κ. / Postal Code → `address.postalCode`
- Πόλη / City → `address.city`
- Τηλ.1 / Telephone 1 → `contact.telephone1`
- Τηλ.2 / Telephone 2 → `contact.telephone2`
- Fax → `contact.fax`
- Email → `contact.email`
- Α.Φ.Μ. / VAT Registration No. → `vatInfo.registrationNo`
- Δ.Ο.Υ. / VAT Office → `vatInfo.office`
- Επάγγελμα / Profession → `profession`
- Merch → `merch`
- Πωλήσεις 2022 / Sales 2022 → `InvSales2022`
- Πωλήσεις 2023 / Sales 2023 → `InvSales2023`
- Πωλήσεις 2024 / Sales 2024 → `InvSales2024`
- Ενεργός / Active → `isActive`
- Κανάλι / Channel → `channel`
- implicit: `brand: "kivos"`, timestamps

### John customers → `customers_john`

- Κωδικός Πελάτη / Customer Code → `customerCode` (document id)
- Επωνυμία / Name → `name`
- Οδός / Street → `address.street`
- Τ.Κ. / Postal Code → `address.postalCode`
- Πόλη / City → `address.city`
- Τηλ.1 / Telephone 1 → `contact.telephone1`
- Τηλ.2 / Telephone 2 → `contact.telephone2`
- Fax → `contact.fax`
- Email → `contact.email`
- Α.Φ.Μ. / VAT Registration No. → `vatInfo.registrationNo`
- Δ.Ο.Υ. / VAT Office → `vatInfo.office`
- Επάγγελμα / Profession → `profession`
- Merch → `merch`
- implicit: `brand: "john"`, timestamps

## Notes & prerequisites

- The script initialises Firebase with the service account stored in `serviceAccountKey.json`; ensure it targets the correct environment.
- Network access to the Google Sheets URLs is required.
- Imports are idempotent: rerunning them updates changed rows and skips identical ones.
