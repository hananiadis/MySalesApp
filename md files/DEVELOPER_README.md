# MySalesApp - Developer Documentation

## Overview

MySalesApp is a comprehensive React Native mobile application built with Expo SDK 54 for managing products, customers, and sales orders across multiple brands (Playmobil, Kivos, John Hellas). The app integrates Firebase (Auth + Firestore), supports offline functionality with AsyncStorage, and includes order workflows with location capture and export capabilities.

## Tech Stack

- **React Native**: 0.81.4
- **React**: 19.1.0
- **Expo SDK**: 54.0.0 (managed workflow with prebuild support)
- **Firebase**: 
  - `@react-native-firebase/auth` (v20.5.0)
  - `@react-native-firebase/firestore` (v20.5.0)
- **Navigation**: `@react-navigation/native` (v6.1.18)
- **Storage**: `@react-native-async-storage/async-storage` (v2.1.0)
- **Location**: `react-native-geolocation-service` (v5.3.1)
- **File System**: `react-native-fs` (v2.20.0)
- **UI Components**: `react-native-paper` (v5.12.3)
- **Icons**: `react-native-vector-icons` (v10.2.0)
- **Lists**: `@shopify/flash-list` (v2.0.2)
- **Utilities**: `lodash`, `xlsx`, `react-native-share`

## Project Structure

```
MySalesApp/
├── App.js                          # Main app component with navigation
├── app.json                        # Expo app configuration
├── package.json                    # Node.js dependencies and scripts
├── babel.config.js                 # Babel configuration
├── metro.config.js                 # Metro bundler configuration
├── eas.json                        # EAS Build configuration
├── jest.config.js                  # Jest testing configuration
├── jest.setup.js                   # Jest setup file
├── src/
│   ├── components/                 # Reusable UI components
│   │   ├── BottomSheet.js
│   │   ├── GlobalLogoutButton.js
│   │   ├── GlobalUserMenu.js
│   │   ├── OrderLineItem.js
│   │   ├── OrderProductRow.js
│   │   ├── ProductRow.js
│   │   └── SafeScreen.js
│   ├── config/                     # App-level configuration
│   │   └── firebase.js             # Firebase project settings
│   ├── constants/                  # App constants
│   │   ├── brands.js               # Brand definitions and mappings
│   │   └── paymentOptions.js       # Payment method definitions
│   ├── context/                    # React Context providers
│   │   ├── AuthProvider.js         # Authentication state management
│   │   └── OrderContext.js         # Order state management
│   ├── navigation/                 # Navigation configuration
│   │   └── AuthStack.js            # Authentication navigation stack
│   ├── screens/                    # Screen components
│   │   ├── HomeScreen.js           # Main dashboard
│   │   ├── PlaymobilScreen.js      # Playmobil brand section
│   │   ├── KivosScreen.js          # Kivos brand section
│   │   ├── JohnScreen.js           # John Hellas brand section
│   │   ├── ProductsScreen.js       # Product management
│   │   ├── CustomersScreen.js      # Customer management
│   │   ├── DataScreen.js           # Data management
│   │   ├── ProductDetailScreen.js  # Product details
│   │   ├── StockDetailsScreen.js   # Stock information
│   │   ├── CustomerDetailScreen.js # Customer details
│   │   ├── CustomerSalesSummary.js # Sales summary
│   │   ├── CustomerSalesDetail.js  # Sales details
│   │   ├── OrdersManagement.js     # Order management
│   │   ├── OrderCustomerSelectScreen.js
│   │   ├── OrderProductSelectionScreen.js
│   │   ├── OrderReviewScreen.js
│   │   ├── OrderSummaryScreen.js
│   │   ├── ExportSuccessScreen.js
│   │   ├── OrderDetailScreen.js
│   │   ├── ProfileScreen.js
│   │   ├── SettingsScreen.js
│   │   ├── UserManagementScreen.js
│   │   ├── LoginScreen.js
│   │   └── SignUpScreen.js
│   ├── services/                   # External service integrations
│   │   ├── firebase.js             # Firebase service exports
│   │   └── kivosSpreadsheet.js     # Google Sheets integration
│   └── utils/                      # Utility functions
│       ├── exportOrderUtils.js     # Order export functionality
│       ├── firestoreOrders.js      # Firestore order operations
│       ├── imageHelpers.js         # Image handling utilities
│       ├── localData.js            # Local data management
│       ├── localOrders.js          # Local order storage
│       ├── location.js             # GPS location utilities
│       ├── OnlineStatusBanner.js   # Network status indicator
│       ├── OnlineStatusContext.js  # Network status context
│       ├── orderTotals.js          # Order calculation utilities
│       ├── remoteOrders.js         # Remote order operations
│       ├── salesmen.js             # Salesperson management
│       └── stockAvailability.js    # Stock checking utilities
├── assets/                         # Static assets
│   ├── app_icon.PNG                # App icon
│   ├── splash.PNG                  # Splash screen
│   ├── playmobil_logo.png          # Playmobil logo
│   ├── kivos_logo.png              # Kivos logo
│   ├── john_hellas_logo.png        # John Hellas logo
│   └── [other image assets]
├── firebase/                       # Firebase configuration
│   ├── google-services.json        # Android Firebase config
│   └── firestore.rules             # Firestore security rules
├── android/                        # Generated Android project
└── node_modules/                   # Dependencies
```

## Key Features

### Authentication & User Management
- Firebase Authentication integration
- Role-based access control (Owner, Admin, Developer, Sales Manager, Salesman, Warehouse Manager, Customer)
- User profile management
- Multi-brand access permissions

### Product Management
- Multi-brand product catalogs (Playmobil, Kivos, John Hellas)
- Real-time stock availability
- Product search and filtering
- Image caching and management
- Barcode support

### Customer Management
- Customer database with detailed information
- Sales history tracking
- Customer-specific pricing
- Contact information management

### Order Management
- Complete order workflow (Customer → Products → Review → Summary → Export)
- Offline order drafting with AsyncStorage
- Real-time order synchronization
- Order export to Excel format
- GPS location capture for orders

### Data Synchronization
- Real-time Firestore synchronization
- Offline-first architecture
- Bulk data import/export capabilities
- Google Sheets integration for Kivos brand

## Development Setup

### Prerequisites

- **Node.js**: 20.x LTS
- **npm**: Latest version
- **Expo CLI**: `npm install -g @expo/cli`
- **Android Studio**: For Android development
- **Firebase Project**: With Firestore enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/hananiadis/MySalesApp.git
   cd MySalesApp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Firestore Database
   - Download `google-services.json` for Android
   - Place it in `firebase/google-services.json`

4. **Generate native projects**
   ```bash
   npx expo prebuild --platform android --clean
   ```

5. **Start development server**
   ```bash
   npm start
   ```

### Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS device/simulator (macOS only)
- `npm run web` - Run in web browser
- `npm run prebuild` - Generate native projects
- `npm run prebuild:android` - Generate Android project only
- `npm test` - Run Jest tests
- `npm run build:android` - Build APK using EAS Build
- `npm run build:android-prod` - Build production APK

## Building for Production

### Local Build (Windows)

1. **Ensure all dependencies are installed**
   ```bash
   npm install
   npx expo install --check
   ```

2. **Generate Android project**
   ```bash
   npx expo prebuild --platform android --clean
   ```

3. **Build APK**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

4. **Find the APK**
   The APK will be located at: `android/app/build/outputs/apk/release/app-release.apk`

### EAS Build (Cloud)

1. **Configure EAS**
   ```bash
   npx eas build:configure
   ```

2. **Build APK**
   ```bash
   npx eas build -p android --profile preview
   ```

## Firebase Configuration

### Firestore Collections

#### Products Collections
- `products` - Playmobil products
- `products_john` - John Hellas products  
- `products_kivos` - Kivos products

#### Customers Collections
- `customers` - Playmobil customers
- `customers_john` - John Hellas customers
- `customers_kivos` - Kivos customers

#### Other Collections
- `users` - User profiles and roles
- `orders` - Order records
- `salesmen` - Salesperson information

### Security Rules

Configure Firestore security rules to ensure proper access control:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Authenticated users can read products and customers
    match /{collection}/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        resource.data.role in ['owner', 'admin', 'developer'];
    }
  }
}
```

## Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
FIREBASE_PROJECT_ID=mysalesapp-38ccf
FIREBASE_REGION=europe-west1
```

## Testing

The project includes Jest configuration for unit testing:

```bash
npm test
```

Test files should be placed in the `__tests__` directory.

## Troubleshooting

### Common Issues

1. **Metro bundler cache issues**
   ```bash
   npm start -- --reset-cache
   ```

2. **Firebase connection problems**
   - Verify `google-services.json` is in the correct location
   - Check Firebase project configuration
   - Ensure Firestore is enabled

3. **Build failures**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Clean Expo cache: `npx expo install --check`
   - Regenerate native projects: `npx expo prebuild --clean`

4. **Android build issues**
   - Ensure Android SDK is properly installed
   - Check Java version compatibility
   - Verify Gradle configuration

### Debug Information

- App displays Firebase project ID for connection verification
- Console logs provide detailed debugging information
- Error states show user-friendly messages with retry options

## Performance Considerations

- **Image Optimization**: Images are cached locally to reduce network usage
- **Lazy Loading**: Large lists use FlashList for better performance
- **Offline Support**: Critical data is cached locally for offline access
- **Memory Management**: Proper cleanup of listeners and subscriptions

## Security Best Practices

- Firebase security rules enforce proper access control
- Sensitive data is not stored in plain text
- API keys are properly configured in Firebase
- User authentication is required for all operations

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -m 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Create a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For technical support or feature requests, please contact the development team or create an issue in the GitHub repository.

---

**MySalesApp** - Streamlining sales management with modern mobile technology.