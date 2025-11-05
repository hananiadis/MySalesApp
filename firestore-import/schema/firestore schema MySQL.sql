CREATE TABLE `users` (
  `uid` varchar(255),
  `lastName` varchar(255),
  `createdAt` json,
  `email` varchar(255),
  `role` varchar(255),
  `firstName` varchar(255),
  `name` varchar(255),
  `brands` json,
  `merchIds` json,
  `updatedAt` json
);

CREATE TABLE `products` (
  `productCode` varchar(255),
  `barcode` varchar(255),
  `playingTheme` varchar(255),
  `description` varchar(255),
  `launchDate` varchar(255),
  `package` varchar(255),
  `wholesalePrice` float,
  `srp` varchar(255),
  `suggestedAge` varchar(255),
  `gender` varchar(255),
  `frontCover` varchar(255),
  `isActive` boolean,
  `brand` varchar(255),
  `importedAt` json,
  `lastUpdated` json,
  `aa2025` varchar(255),
  `cataloguePage` varchar(255),
  `availableStock` float
);

CREATE TABLE `products_kivos` (
  `productCode` varchar(255),
  `description` varchar(255),
  `descriptionFull` varchar(255),
  `supplierBrand` varchar(255),
  `category` varchar(255),
  `mm` varchar(255),
  `packaging` varchar(255),
  `piecesPerPack` varchar(255),
  `piecesPerBox` varchar(255),
  `piecesPerCarton` varchar(255),
  `wholesalePrice` float,
  `barcodeUnit` varchar(255),
  `barcodeBox` varchar(255),
  `barcodeCarton` varchar(255),
  `productUrl` varchar(255),
  `frontCover` varchar(255),
  `brand` varchar(255),
  `lastUpdated` json,
  `importedAt` json,
  `offerPrice` float,
  `discount` float,
  `discountEndsAt` varchar(255)
);

CREATE TABLE `products_john` (
  `productCode` varchar(255),
  `generalCategory` varchar(255),
  `subCategory` varchar(255),
  `packaging` varchar(255),
  `sheetCategory` varchar(255),
  `brand` varchar(255),
  `wholesalePrice` float,
  `frontCover` varchar(255),
  `importedAt` json,
  `barcode` varchar(255),
  `priceList` float,
  `category` varchar(255),
  `srp` float,
  `lastUpdated` json,
  `description` varchar(255)
);

CREATE TABLE `customers` (
  `customerCode` varchar(255),
  `name` varchar(255),
  `name3` varchar(255),
  `contact` json,
  `vatInfo` json,
  `region` json,
  `transportation` json,
  `merch` varchar(255),
  `brand` varchar(255),
  `address` varchar(255),
  `city` varchar(255),
  `postalCode` varchar(255),
  `vat` varchar(255),
  `telephone1` varchar(255),
  `importedAt` json,
  `salesInfo` json
);

CREATE TABLE `customers_kivos` (
  `customerCode` varchar(255),
  `name` varchar(255),
  `address` json,
  `contact` json,
  `vatInfo` json,
  `profession` varchar(255),
  `merch` varchar(255),
  `InvSales2022` varchar(255),
  `InvSales2023` varchar(255),
  `InvSales2024` varchar(255),
  `isActive` varchar(255),
  `channel` varchar(255),
  `brand` varchar(255),
  `importedAt` json
);

CREATE TABLE `customers_john` (
  `customerCode` varchar(255),
  `name` varchar(255),
  `address` json,
  `contact` json,
  `vatInfo` json,
  `profession` varchar(255),
  `merch` varchar(255),
  `brand` varchar(255),
  `importedAt` json
);

CREATE TABLE `orders_playmobil` (
  `id` varchar(255) COMMENT 'No fields found'
);

CREATE TABLE `orders_kivos` (
  `deliveryInfo` varchar(255),
  `notes` varchar(255),
  `startedLocation` varchar(255),
  `startedAt` varchar(255),
  `userId` varchar(255),
  `createdAt` varchar(255),
  `number` varchar(255),
  `exportedLocation` varchar(255),
  `createdBy` varchar(255),
  `paymentMethod` varchar(255),
  `id` varchar(255),
  `brand` varchar(255),
  `discount` float,
  `netValue` float,
  `vat` float,
  `finalValue` float,
  `lines` json,
  `paymentMethodLabel` varchar(255),
  `sent` boolean,
  `exported` boolean,
  `exportedAt` varchar(255),
  `status` varchar(255),
  `customerId` varchar(255),
  `firestoreUpdatedAt` json,
  `updatedAt` varchar(255),
  `customer` json,
  `orderType` varchar(255),
  `salesmanName` varchar(255),
  `createdByName` varchar(255),
  `salesmanEmail` varchar(255),
  `salesmanId` varchar(255),
  `createdByEmail` varchar(255),
  `uid` varchar(255),
  `salesmanMerchIds` json,
  `firestoreCreatedAt` json,
  `firestoreId` varchar(255)
);

CREATE TABLE `orders_john` (
  `deliveryInfo` varchar(255),
  `notes` varchar(255),
  `startedLocation` varchar(255),
  `startedAt` varchar(255),
  `userId` varchar(255),
  `number` varchar(255),
  `createdAt` varchar(255),
  `exportedLocation` varchar(255),
  `createdBy` varchar(255),
  `customerId` varchar(255),
  `paymentMethod` varchar(255),
  `id` varchar(255),
  `brand` varchar(255),
  `customer` json,
  `netValue` float,
  `vat` float,
  `discount` float,
  `finalValue` float,
  `lines` json,
  `paymentMethodLabel` varchar(255),
  `exported` boolean,
  `exportedAt` varchar(255),
  `sent` boolean,
  `status` varchar(255),
  `firestoreUpdatedAt` json,
  `updatedAt` varchar(255),
  `orderType` varchar(255),
  `salesmanName` varchar(255),
  `createdByName` varchar(255),
  `salesmanEmail` varchar(255),
  `salesmanId` varchar(255),
  `createdByEmail` varchar(255),
  `uid` varchar(255),
  `salesmanMerchIds` json,
  `firestoreCreatedAt` json,
  `firestoreId` varchar(255)
);

CREATE TABLE `supermarket_listings` (
  `description` varchar(255),
  `packaging` varchar(255),
  `isNew` boolean,
  `productCategory` varchar(255),
  `isCActive` boolean,
  `photoUrl` varchar(255),
  `productCode` varchar(255),
  `superMarket` varchar(255),
  `barcode` varchar(255),
  `categoryHierarchyTree` json,
  `price` float,
  `brand` varchar(255),
  `isSummerActive` boolean,
  `isSummerActiveGrand` boolean,
  `isSummerActiveMegala` boolean,
  `isSummerActiveMikra` boolean,
  `isSummerActiveMesaia` boolean,
  `isSummerActiveMegalaPlus` boolean,
  `importedAt` json,
  `isBActive` boolean,
  `isAActive` boolean
);

CREATE TABLE `supermarket_stores` (
  `area` varchar(255),
  `storeNumber` varchar(255),
  `address` varchar(255),
  `city` varchar(255),
  `hasToys` varchar(255),
  `companyName` varchar(255),
  `postalCode` varchar(255),
  `hasSummerItems` varchar(255),
  `storeCategory` varchar(255),
  `storeCodeNormalized` varchar(255),
  `typologyNotes` varchar(255),
  `openingStatus` varchar(255),
  `phone` varchar(255),
  `companySlug` varchar(255),
  `storeName` varchar(255),
  `category` varchar(255),
  `region` varchar(255),
  `brand` varchar(255),
  `storeCode` varchar(255),
  `updatedAt` json
);

CREATE TABLE `supermarket_meta` (
  `order` json,
  `updatedAt` json
);

CREATE TABLE `salesmen` (
  `merch` varchar(255),
  `normalized` varchar(255),
  `name` varchar(255),
  `brand` varchar(255),
  `updatedAt` json
);

CREATE TABLE `brand_settings` (
  `id` varchar(255) COMMENT 'No fields found'
);

CREATE TABLE `sync_log` (
  `id` varchar(255) COMMENT 'No fields found'
);

CREATE TABLE `analytics_kpi` (
  `id` varchar(255) COMMENT 'No fields found'
);
