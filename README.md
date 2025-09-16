# MySalesApp - React Native Sales Management Application

## Overview

MySalesApp is a comprehensive React Native sales management application designed for managing products, customers, and sales data. The app features a modern UI with Greek language support and integrates with Firebase Firestore for real-time data management.

## 🚀 Features

### Core Functionality
- **Multi-screen Navigation**: Intuitive navigation between different app sections
- **Firebase Integration**: Real-time data synchronization with Firestore
- **Greek Language Support**: Localized interface with Greek labels
- **Offline Data Management**: Scripts for managing data outside the app
- **Responsive Design**: Optimized for both Android and iOS platforms

### Screens & Navigation

#### 1. Home Screen (`HomeScreen.js`)
The main dashboard with 8 primary navigation buttons:
- **Playmobil**: Brand-specific section with Playmobil logo
- **Προϊόντα** (Products): View and manage product inventory
- **Πελάτες** (Customers): Customer database management
- **Δεδομένα** (Data): Data management and sync information
- **Πωλήσεις** (Sales): Sales tracking (placeholder)
- **Αναφορές** (Reports): Reporting functionality (placeholder)
- **Ρυθμίσεις** (Settings): App configuration (placeholder)
- **Exit**: Close the application

#### 2. Playmobil Screen (`PlaymobilScreen.js`)
Brand-specific section with Greek-labeled buttons:
- **Νεα Παραγγελία** (New Order): Create new orders
- **Προϊόντα** (Products): Navigate to products
- **Πελάτες** (Customers): Customer management
- **Δεδομένα** (Data): Data management
- **Button 5-7**: Additional functionality (placeholders)
- **Πίσω** (Back): Return to home screen

#### 3. Products Screen (`ProductsScreen.js`)
Comprehensive product management with:
- **Real-time Firestore Integration**: Loads products from Firebase
- **Stock Level Indicators**: Color-coded stock status (red=out, yellow=low, black=available)
- **Product Details**: Code, description, theme, SRP, stock levels
- **Pull-to-Refresh**: Refresh product data
- **Error Handling**: Graceful error display and retry functionality
- **Loading States**: Activity indicators during data fetch

#### 4. Customers Screen (`CustomersScreen.js`)
Customer database management featuring:
- **Customer Profiles**: Name, email, phone, address, company info
- **Status Indicators**: Active/inactive customer status
- **VAT Number Support**: Business customer information
- **Real-time Updates**: Live data from Firestore
- **Search & Filter**: Customer data management tools

#### 5. Data Screen (`DataScreen.js`)
Data management and system information:
- **App Status**: Current Firebase connection status
- **Data Flow Information**: How data moves through the system
- **Setup Verification**: Confirmation of configured services
- **User Guidance**: Tips for data management

## 🛠 Technical Architecture

### Dependencies
```json
{
  "@react-native-firebase/app": "^22.2.1",
  "@react-native-firebase/firestore": "^22.2.1",
  "@react-navigation/native": "^7.1.11",
  "@react-navigation/native-stack": "^7.3.16",
  "google-spreadsheet": "^4.1.4",
  "googleapis": "^150.0.1"
}
```

### Key Technologies
- **React Native**: Cross-platform mobile development
- **Firebase Firestore**: Real-time database
- **React Navigation**: Screen navigation management
- **Google Sheets API**: External data source integration

### Data Structure

#### Products Collection
```javascript
{
  id: "product_code",
  description: "Product description",
  playingTheme: "Theme name",
  availableStock: 100,
  srp: 29.99,
  wholesalePrice: 20.00,
  barcode: "123456789",
  cataloguePage: 15,
  suggestedAge: "4+",
  gender: "Unisex",
  frontCover: "image_url",
  launchDate: "2024-01-01",
  package: "Box",
  isActive: true,
  lastUpdated: "2024-01-01T00:00:00Z"
}
```

#### Customers Collection
```javascript
{
  id: "customer_id",
  name: "Customer Name",
  email: "customer@email.com",
  phone: "+1234567890",
  address: "Customer Address",
  city: "City",
  postalCode: "12345",
  country: "Country",
  company: "Company Name",
  vatNumber: "VAT123456",
  notes: "Customer notes",
  isActive: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
}
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- Firebase project setup

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MySalesApp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **iOS Setup** (macOS only)
   ```bash
   bundle install
   bundle exec pod install
   ```

4. **Firebase Configuration**
   - Create a Firebase project
   - Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
   - Place configuration files in appropriate directories
   - Enable Firestore in Firebase console

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Run the app**
   ```bash
   # Android
   npm run android
   
   # iOS (macOS only)
   npm run ios
   ```

## 📱 App Structure

```
MySalesApp/
├── App.js                 # Main app component with navigation
├── src/
│   └── screens/
│       ├── HomeScreen.js      # Main dashboard
│       ├── PlaymobilScreen.js # Brand-specific section
│       ├── ProductsScreen.js  # Product management
│       ├── CustomersScreen.js # Customer management
│       └── DataScreen.js      # Data management info
├── assets/
│   └── playmobil_logo.png     # Brand logo
└── android/ & ios/            # Platform-specific code
```

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Firestore Database
3. Set up security rules for your collections
4. Configure authentication if needed

### Google Sheets Integration
- Set up Google Cloud project
- Enable Google Sheets API
- Create service account credentials
- Share spreadsheet with service account email

## 📊 Data Management

### Real-time Synchronization
- Products and customers are stored in Firestore
- App automatically syncs with database changes
- Offline scripts available for bulk data operations
- Pull-to-refresh functionality for manual updates

### Stock Management
- Color-coded stock levels:
  - 🔴 Red: Out of stock (0 or N/A)
  - 🟡 Yellow: Low stock (< 10)
  - ⚫ Black: Available stock (≥ 10)

## 🎨 UI/UX Features

### Design System
- **Color Scheme**: Blue (#007AFF) primary, Green (#28a745) for main actions
- **Typography**: Clear hierarchy with proper font weights
- **Spacing**: Consistent padding and margins
- **Shadows**: Subtle elevation for depth

### Responsive Design
- Grid-based button layout
- Flexible content containers
- Platform-specific styling
- Safe area handling

## 🔒 Security

### Firebase Security Rules
- Configure appropriate read/write permissions
- Implement user authentication if needed
- Set up data validation rules

### API Security
- Secure credential storage
- Service account authentication
- HTTPS-only communication

## 🚀 Future Enhancements

### Planned Features
- [ ] Sales tracking and management
- [ ] Reporting and analytics
- [ ] User authentication
- [ ] Offline mode support
- [ ] Push notifications
- [ ] Barcode scanning
- [ ] Export functionality

### Technical Improvements
- [ ] Performance optimization
- [ ] Advanced filtering and search
- [ ] Data caching strategies
- [ ] Automated testing
- [ ] CI/CD pipeline

## 🐛 Troubleshooting

### Common Issues
1. **Metro bundler issues**: Clear cache with `npm start -- --reset-cache`
2. **Firebase connection**: Verify configuration files and project settings
3. **Build errors**: Ensure all dependencies are properly installed
4. **Navigation issues**: Check React Navigation setup

### Debug Information
- App displays Firebase project ID for connection verification
- Console logs provide detailed debugging information
- Error states show user-friendly messages with retry options

## 📄 License

This project is proprietary software. All rights reserved.

## 🤝 Support

For technical support or feature requests, please contact the development team.

---

**MySalesApp** - Streamlining sales management with modern mobile technology.
