CREATE TABLE "users" (
  "uid" varchar,
  "lastName" varchar,
  "createdAt" json,
  "email" varchar,
  "role" varchar,
  "firstName" varchar,
  "name" varchar,
  "brands" json,
  "merchIds" json,
  "updatedAt" json
);

CREATE TABLE "products" (
  "productCode" varchar,
  "barcode" varchar,
  "playingTheme" varchar,
  "description" varchar,
  "launchDate" varchar,
  "package" varchar,
  "wholesalePrice" float,
  "srp" varchar,
  "suggestedAge" varchar,
  "gender" varchar,
  "frontCover" varchar,
  "isActive" boolean,
  "brand" varchar,
  "importedAt" json,
  "lastUpdated" json,
  "aa2025" varchar,
  "cataloguePage" varchar,
  "availableStock" float
);

CREATE TABLE "products_kivos" (
  "productCode" varchar,
  "description" varchar,
  "descriptionFull" varchar,
  "supplierBrand" varchar,
  "category" varchar,
  "mm" varchar,
  "packaging" varchar,
  "piecesPerPack" varchar,
  "piecesPerBox" varchar,
  "piecesPerCarton" varchar,
  "wholesalePrice" float,
  "barcodeUnit" varchar,
  "barcodeBox" varchar,
  "barcodeCarton" varchar,
  "productUrl" varchar,
  "frontCover" varchar,
  "brand" varchar,
  "lastUpdated" json,
  "importedAt" json,
  "offerPrice" float,
  "discount" float,
  "discountEndsAt" varchar
);

CREATE TABLE "products_john" (
  "productCode" varchar,
  "generalCategory" varchar,
  "subCategory" varchar,
  "packaging" varchar,
  "sheetCategory" varchar,
  "brand" varchar,
  "wholesalePrice" float,
  "frontCover" varchar,
  "importedAt" json,
  "barcode" varchar,
  "priceList" float,
  "category" varchar,
  "srp" float,
  "lastUpdated" json,
  "description" varchar
);

CREATE TABLE "customers" (
  "customerCode" varchar,
  "name" varchar,
  "name3" varchar,
  "contact" json,
  "vatInfo" json,
  "region" json,
  "transportation" json,
  "merch" varchar,
  "brand" varchar,
  "address" varchar,
  "city" varchar,
  "postalCode" varchar,
  "vat" varchar,
  "telephone1" varchar,
  "importedAt" json,
  "salesInfo" json
);

CREATE TABLE "customers_kivos" (
  "customerCode" varchar,
  "name" varchar,
  "address" json,
  "contact" json,
  "vatInfo" json,
  "profession" varchar,
  "merch" varchar,
  "InvSales2022" varchar,
  "InvSales2023" varchar,
  "InvSales2024" varchar,
  "isActive" varchar,
  "channel" varchar,
  "brand" varchar,
  "importedAt" json
);

CREATE TABLE "customers_john" (
  "customerCode" varchar,
  "name" varchar,
  "address" json,
  "contact" json,
  "vatInfo" json,
  "profession" varchar,
  "merch" varchar,
  "brand" varchar,
  "importedAt" json
);

CREATE TABLE "orders_playmobil" (
  "id" varchar
);

CREATE TABLE "orders_kivos" (
  "deliveryInfo" varchar,
  "notes" varchar,
  "startedLocation" varchar,
  "startedAt" varchar,
  "userId" varchar,
  "createdAt" varchar,
  "number" varchar,
  "exportedLocation" varchar,
  "createdBy" varchar,
  "paymentMethod" varchar,
  "id" varchar,
  "brand" varchar,
  "discount" float,
  "netValue" float,
  "vat" float,
  "finalValue" float,
  "lines" json,
  "paymentMethodLabel" varchar,
  "sent" boolean,
  "exported" boolean,
  "exportedAt" varchar,
  "status" varchar,
  "customerId" varchar,
  "firestoreUpdatedAt" json,
  "updatedAt" varchar,
  "customer" json,
  "orderType" varchar,
  "salesmanName" varchar,
  "createdByName" varchar,
  "salesmanEmail" varchar,
  "salesmanId" varchar,
  "createdByEmail" varchar,
  "uid" varchar,
  "salesmanMerchIds" json,
  "firestoreCreatedAt" json,
  "firestoreId" varchar
);

CREATE TABLE "orders_john" (
  "deliveryInfo" varchar,
  "notes" varchar,
  "startedLocation" varchar,
  "startedAt" varchar,
  "userId" varchar,
  "number" varchar,
  "createdAt" varchar,
  "exportedLocation" varchar,
  "createdBy" varchar,
  "customerId" varchar,
  "paymentMethod" varchar,
  "id" varchar,
  "brand" varchar,
  "customer" json,
  "netValue" float,
  "vat" float,
  "discount" float,
  "finalValue" float,
  "lines" json,
  "paymentMethodLabel" varchar,
  "exported" boolean,
  "exportedAt" varchar,
  "sent" boolean,
  "status" varchar,
  "firestoreUpdatedAt" json,
  "updatedAt" varchar,
  "orderType" varchar,
  "salesmanName" varchar,
  "createdByName" varchar,
  "salesmanEmail" varchar,
  "salesmanId" varchar,
  "createdByEmail" varchar,
  "uid" varchar,
  "salesmanMerchIds" json,
  "firestoreCreatedAt" json,
  "firestoreId" varchar
);

CREATE TABLE "supermarket_listings" (
  "description" varchar,
  "packaging" varchar,
  "isNew" boolean,
  "productCategory" varchar,
  "isCActive" boolean,
  "photoUrl" varchar,
  "productCode" varchar,
  "superMarket" varchar,
  "barcode" varchar,
  "categoryHierarchyTree" json,
  "price" float,
  "brand" varchar,
  "isSummerActive" boolean,
  "isSummerActiveGrand" boolean,
  "isSummerActiveMegala" boolean,
  "isSummerActiveMikra" boolean,
  "isSummerActiveMesaia" boolean,
  "isSummerActiveMegalaPlus" boolean,
  "importedAt" json,
  "isBActive" boolean,
  "isAActive" boolean
);

CREATE TABLE "supermarket_stores" (
  "area" varchar,
  "storeNumber" varchar,
  "address" varchar,
  "city" varchar,
  "hasToys" varchar,
  "companyName" varchar,
  "postalCode" varchar,
  "hasSummerItems" varchar,
  "storeCategory" varchar,
  "storeCodeNormalized" varchar,
  "typologyNotes" varchar,
  "openingStatus" varchar,
  "phone" varchar,
  "companySlug" varchar,
  "storeName" varchar,
  "category" varchar,
  "region" varchar,
  "brand" varchar,
  "storeCode" varchar,
  "updatedAt" json
);

CREATE TABLE "supermarket_meta" (
  "order" json,
  "updatedAt" json
);

CREATE TABLE "salesmen" (
  "merch" varchar,
  "normalized" varchar,
  "name" varchar,
  "brand" varchar,
  "updatedAt" json
);

CREATE TABLE "brand_settings" (
  "id" varchar
);

CREATE TABLE "sync_log" (
  "id" varchar
);

CREATE TABLE "analytics_kpi" (
  "id" varchar
);

COMMENT ON COLUMN "orders_playmobil"."id" IS 'No fields found';

COMMENT ON COLUMN "brand_settings"."id" IS 'No fields found';

COMMENT ON COLUMN "sync_log"."id" IS 'No fields found';

COMMENT ON COLUMN "analytics_kpi"."id" IS 'No fields found';
