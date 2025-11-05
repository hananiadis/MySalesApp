CREATE TABLE [users] (
  [uid] nvarchar(255),
  [lastName] nvarchar(255),
  [createdAt] json,
  [email] nvarchar(255),
  [role] nvarchar(255),
  [firstName] nvarchar(255),
  [name] nvarchar(255),
  [brands] json,
  [merchIds] json,
  [updatedAt] json
)
GO

CREATE TABLE [products] (
  [productCode] nvarchar(255),
  [barcode] nvarchar(255),
  [playingTheme] nvarchar(255),
  [description] nvarchar(255),
  [launchDate] nvarchar(255),
  [package] nvarchar(255),
  [wholesalePrice] float,
  [srp] nvarchar(255),
  [suggestedAge] nvarchar(255),
  [gender] nvarchar(255),
  [frontCover] nvarchar(255),
  [isActive] boolean,
  [brand] nvarchar(255),
  [importedAt] json,
  [lastUpdated] json,
  [aa2025] nvarchar(255),
  [cataloguePage] nvarchar(255),
  [availableStock] float
)
GO

CREATE TABLE [products_kivos] (
  [productCode] nvarchar(255),
  [description] nvarchar(255),
  [descriptionFull] nvarchar(255),
  [supplierBrand] nvarchar(255),
  [category] nvarchar(255),
  [mm] nvarchar(255),
  [packaging] nvarchar(255),
  [piecesPerPack] nvarchar(255),
  [piecesPerBox] nvarchar(255),
  [piecesPerCarton] nvarchar(255),
  [wholesalePrice] float,
  [barcodeUnit] nvarchar(255),
  [barcodeBox] nvarchar(255),
  [barcodeCarton] nvarchar(255),
  [productUrl] nvarchar(255),
  [frontCover] nvarchar(255),
  [brand] nvarchar(255),
  [lastUpdated] json,
  [importedAt] json,
  [offerPrice] float,
  [discount] float,
  [discountEndsAt] nvarchar(255)
)
GO

CREATE TABLE [products_john] (
  [productCode] nvarchar(255),
  [generalCategory] nvarchar(255),
  [subCategory] nvarchar(255),
  [packaging] nvarchar(255),
  [sheetCategory] nvarchar(255),
  [brand] nvarchar(255),
  [wholesalePrice] float,
  [frontCover] nvarchar(255),
  [importedAt] json,
  [barcode] nvarchar(255),
  [priceList] float,
  [category] nvarchar(255),
  [srp] float,
  [lastUpdated] json,
  [description] nvarchar(255)
)
GO

CREATE TABLE [customers] (
  [customerCode] nvarchar(255),
  [name] nvarchar(255),
  [name3] nvarchar(255),
  [contact] json,
  [vatInfo] json,
  [region] json,
  [transportation] json,
  [merch] nvarchar(255),
  [brand] nvarchar(255),
  [address] nvarchar(255),
  [city] nvarchar(255),
  [postalCode] nvarchar(255),
  [vat] nvarchar(255),
  [telephone1] nvarchar(255),
  [importedAt] json,
  [salesInfo] json
)
GO

CREATE TABLE [customers_kivos] (
  [customerCode] nvarchar(255),
  [name] nvarchar(255),
  [address] json,
  [contact] json,
  [vatInfo] json,
  [profession] nvarchar(255),
  [merch] nvarchar(255),
  [InvSales2022] nvarchar(255),
  [InvSales2023] nvarchar(255),
  [InvSales2024] nvarchar(255),
  [isActive] nvarchar(255),
  [channel] nvarchar(255),
  [brand] nvarchar(255),
  [importedAt] json
)
GO

CREATE TABLE [customers_john] (
  [customerCode] nvarchar(255),
  [name] nvarchar(255),
  [address] json,
  [contact] json,
  [vatInfo] json,
  [profession] nvarchar(255),
  [merch] nvarchar(255),
  [brand] nvarchar(255),
  [importedAt] json
)
GO

CREATE TABLE [orders_playmobil] (
  [id] nvarchar(255)
)
GO

CREATE TABLE [orders_kivos] (
  [deliveryInfo] nvarchar(255),
  [notes] nvarchar(255),
  [startedLocation] nvarchar(255),
  [startedAt] nvarchar(255),
  [userId] nvarchar(255),
  [createdAt] nvarchar(255),
  [number] nvarchar(255),
  [exportedLocation] nvarchar(255),
  [createdBy] nvarchar(255),
  [paymentMethod] nvarchar(255),
  [id] nvarchar(255),
  [brand] nvarchar(255),
  [discount] float,
  [netValue] float,
  [vat] float,
  [finalValue] float,
  [lines] json,
  [paymentMethodLabel] nvarchar(255),
  [sent] boolean,
  [exported] boolean,
  [exportedAt] nvarchar(255),
  [status] nvarchar(255),
  [customerId] nvarchar(255),
  [firestoreUpdatedAt] json,
  [updatedAt] nvarchar(255),
  [customer] json,
  [orderType] nvarchar(255),
  [salesmanName] nvarchar(255),
  [createdByName] nvarchar(255),
  [salesmanEmail] nvarchar(255),
  [salesmanId] nvarchar(255),
  [createdByEmail] nvarchar(255),
  [uid] nvarchar(255),
  [salesmanMerchIds] json,
  [firestoreCreatedAt] json,
  [firestoreId] nvarchar(255)
)
GO

CREATE TABLE [orders_john] (
  [deliveryInfo] nvarchar(255),
  [notes] nvarchar(255),
  [startedLocation] nvarchar(255),
  [startedAt] nvarchar(255),
  [userId] nvarchar(255),
  [number] nvarchar(255),
  [createdAt] nvarchar(255),
  [exportedLocation] nvarchar(255),
  [createdBy] nvarchar(255),
  [customerId] nvarchar(255),
  [paymentMethod] nvarchar(255),
  [id] nvarchar(255),
  [brand] nvarchar(255),
  [customer] json,
  [netValue] float,
  [vat] float,
  [discount] float,
  [finalValue] float,
  [lines] json,
  [paymentMethodLabel] nvarchar(255),
  [exported] boolean,
  [exportedAt] nvarchar(255),
  [sent] boolean,
  [status] nvarchar(255),
  [firestoreUpdatedAt] json,
  [updatedAt] nvarchar(255),
  [orderType] nvarchar(255),
  [salesmanName] nvarchar(255),
  [createdByName] nvarchar(255),
  [salesmanEmail] nvarchar(255),
  [salesmanId] nvarchar(255),
  [createdByEmail] nvarchar(255),
  [uid] nvarchar(255),
  [salesmanMerchIds] json,
  [firestoreCreatedAt] json,
  [firestoreId] nvarchar(255)
)
GO

CREATE TABLE [supermarket_listings] (
  [description] nvarchar(255),
  [packaging] nvarchar(255),
  [isNew] boolean,
  [productCategory] nvarchar(255),
  [isCActive] boolean,
  [photoUrl] nvarchar(255),
  [productCode] nvarchar(255),
  [superMarket] nvarchar(255),
  [barcode] nvarchar(255),
  [categoryHierarchyTree] json,
  [price] float,
  [brand] nvarchar(255),
  [isSummerActive] boolean,
  [isSummerActiveGrand] boolean,
  [isSummerActiveMegala] boolean,
  [isSummerActiveMikra] boolean,
  [isSummerActiveMesaia] boolean,
  [isSummerActiveMegalaPlus] boolean,
  [importedAt] json,
  [isBActive] boolean,
  [isAActive] boolean
)
GO

CREATE TABLE [supermarket_stores] (
  [area] nvarchar(255),
  [storeNumber] nvarchar(255),
  [address] nvarchar(255),
  [city] nvarchar(255),
  [hasToys] nvarchar(255),
  [companyName] nvarchar(255),
  [postalCode] nvarchar(255),
  [hasSummerItems] nvarchar(255),
  [storeCategory] nvarchar(255),
  [storeCodeNormalized] nvarchar(255),
  [typologyNotes] nvarchar(255),
  [openingStatus] nvarchar(255),
  [phone] nvarchar(255),
  [companySlug] nvarchar(255),
  [storeName] nvarchar(255),
  [category] nvarchar(255),
  [region] nvarchar(255),
  [brand] nvarchar(255),
  [storeCode] nvarchar(255),
  [updatedAt] json
)
GO

CREATE TABLE [supermarket_meta] (
  [order] json,
  [updatedAt] json
)
GO

CREATE TABLE [salesmen] (
  [merch] nvarchar(255),
  [normalized] nvarchar(255),
  [name] nvarchar(255),
  [brand] nvarchar(255),
  [updatedAt] json
)
GO

CREATE TABLE [brand_settings] (
  [id] nvarchar(255)
)
GO

CREATE TABLE [sync_log] (
  [id] nvarchar(255)
)
GO

CREATE TABLE [analytics_kpi] (
  [id] nvarchar(255)
)
GO

EXEC sp_addextendedproperty
@name = N'Column_Description',
@value = 'No fields found',
@level0type = N'Schema', @level0name = 'dbo',
@level1type = N'Table',  @level1name = 'orders_playmobil',
@level2type = N'Column', @level2name = 'id';
GO

EXEC sp_addextendedproperty
@name = N'Column_Description',
@value = 'No fields found',
@level0type = N'Schema', @level0name = 'dbo',
@level1type = N'Table',  @level1name = 'brand_settings',
@level2type = N'Column', @level2name = 'id';
GO

EXEC sp_addextendedproperty
@name = N'Column_Description',
@value = 'No fields found',
@level0type = N'Schema', @level0name = 'dbo',
@level1type = N'Table',  @level1name = 'sync_log',
@level2type = N'Column', @level2name = 'id';
GO

EXEC sp_addextendedproperty
@name = N'Column_Description',
@value = 'No fields found',
@level0type = N'Schema', @level0name = 'dbo',
@level1type = N'Table',  @level1name = 'analytics_kpi',
@level2type = N'Column', @level2name = 'id';
GO
