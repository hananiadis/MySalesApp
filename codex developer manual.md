# Codex Developer Manual

## Project Overview

MySalesApp is a React Native application built with Expo (SDK 54) that allows sales teams to manage catalog data, customer records, and multistep order creation. The app targets Android and leverages Firebase (Auth + Firestore) plus local caches to provide online and offline workflows.

## Key Technologies

- React 19 and React Native 0.81 (Expo managed workflow with prebuild support)
- Expo CLI for development and EAS for cloud builds
- Firebase modules (`@react-native-firebase/auth`, `@react-native-firebase/firestore`)
- AsyncStorage for offline caches and FlashList for performant lists
- React Navigation (native stack) for authenticated flows
- React Native Paper for UI components and theming

## Repository Layout

```
App.js                  # Navigation container and provider wiring
app.json                # Expo project configuration
babel.config.js         # Babel presets/plugins
metro.config.js         # Metro bundler tweaks
eas.json                # EAS build profiles
android/                # Generated native Android project (after prebuild)
assets/                 # Images, fonts, app icon resources
firebase/               # Firebase service files (google-services.json, rules, exports)
scripts/                # Import/export utilities and asset tooling
src/
  components/           # Reusable presentation components (tables, rows, UI widgets)
  config/               # Firebase bootstrap and shared configuration
  constants/            # Brand definitions, payment options, UI constants
  context/              # React context providers (auth, orders, connectivity)
  navigation/           # Auth stack definitions and route helpers
  screens/              # Feature screens for brands, orders, customers, etc.
  services/             # External integration helpers (Firestore, spreadsheets)
  utils/                # Cross-cutting utilities (online status, formatters, exports)
```

> The `package-lock.json` in the root describes dependencies when the corresponding `package.json` is not present in source control. Recreate the manifest by running `npm init` or restoring the committed version if needed.

## Prerequisites

- Node.js 18 LTS (Expo SDK 54 requires Node 18.x)
- npm 9+ (bundled with Node 18) or Yarn 1.x
- Expo CLI (`npx expo`) for local development
- Java 17 and Android SDK (if you build native binaries locally)
- Firebase project configured with Auth and Firestore plus `google-services.json`

Optional tooling:

- Watchman (macOS) for faster rebuilds
- VS Code with React Native Tools and ESLint extensions

## Environment Setup

1. Clone or extract the repository.
2. Restore the dependency manifest if missing:
   ```bash
   # only if package.json is missing
   npx expo install --fix
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Ensure the Firebase configuration exists:
   - Place `firebase/google-services.json` (Android) and update `src/config/firebase.js` with the correct project settings.
   - Add any Firestore security rules to `firebase/firestore.rules`.
5. Create a `.env` (or `.env.local`) with values required by runtime utilities:
   ```ini
   NODE_ENV=development
   FIREBASE_PROJECT_ID=<your-project-id>
   FIREBASE_REGION=europe-west1
   ```

## Development Workflow

### Start the Expo dev server

```bash
npm run start        # expo start --clear recommended after dependency updates
```

- Press `a` in the CLI to launch the Android emulator, `w` for the web preview, or scan the QR code with Expo Go on a device.
- Use `npm run android` or `npm run ios` if those scripts exist in `package.json`. Add them if absent:
  ```json
  {
    "scripts": {
      "start": "expo start",
      "android": "expo run:android",
      "ios": "expo run:ios",
      "test": "jest"
    }
  }
  ```

### Code organization guidelines

- **State management**: Authentication lives in `src/context/AuthProvider.js`, orders in `src/context/OrderContext.js`, and online/offline awareness in `src/utils/OnlineStatusContext`.
- **Navigation**: Update `App.js` and the stack definitions in `src/navigation/` when adding new screens. Every screen must be registered with the stack navigator or nested navigator.
- **Brand-specific logic**: Keep brand constants in `src/constants/brands.js` and reuse helper selectors. Shared UI for brand dashboards lives in `src/screens/*Screen.js`.
- **Offline-first**: When storing data locally, use AsyncStorage wrappers defined in the services/utils layer to avoid duplicating serialization logic.

## Testing and Quality

- Unit tests use Jest with setup from `jest.config.js` and `jest.setup.js`.
- Place tests under `src/**/__tests__` or alongside modules using the `.test.js` convention.
- Run:
  ```bash
  npm test
  ```
- Consider adding integration tests for order flows and data formatting, as those areas are high risk for regressions.

Static analysis recommendations:

- Add ESLint/Prettier (if removed) to enforce styles. Sample install:
  ```bash
  npx expo install eslint prettier
  npx eslint --init
  ```

## Data and Tooling Scripts

Utilities in the `scripts/` directory help sync products and customers with Firestore and validate asset completeness:

- `exportProducts.js` / `exportCustomers.js`: Push JSON data to Firestore using service account credentials.
- `checkImages.js`: Detect missing product images relative to catalog data.
- `test_fetch.js`: Smoke-test Firestore connectivity.

> Store `serviceAccountKey.json` securely. Exclude it from version control and rotate regularly.

Run scripts with:

```bash
node scripts/exportProducts.js
```

Ensure environment variables and Firebase Admin credentials are set before execution.

## Build and Release

### Expo prebuild & native builds

1. Generate native projects after dependency changes:
   ```bash
   npx expo prebuild --platform android
   ```
2. Build locally:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

### EAS Build

Configure profiles in `eas.json` (already present). Example:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

Trigger builds with:

```bash
npx eas build -p android --profile preview
```

Make sure credentials (keystore) are uploaded or provided locally during the first run.

## Firebase and Security

- Collections in use: `products`, `products_john`, `products_kivos`, `customers`, `customers_john`, `customers_kivos`, `users`, `orders`, `salesmen`.
- Keep Firestore rules aligned with role-based access. Sample rules reside in existing documentation; update them when adding new collections.
- Enable Firebase App Check and audit Auth providers if the app is distributed externally.

## Troubleshooting

- **Metro cache issues**: `expo start -c`
- **Native module version mismatch**: Rerun `npx expo install` to align versions, then regenerate native projects.
- **Gradle failures**: Delete `android/.gradle` and `android/build`, then rerun `npx expo prebuild`.
- **Authentication errors**: Verify Firebase project ID in `src/config/firebase.js` and environment variables.
- **Offline sync problems**: Inspect `OrderContext` persistence logic and ensure AsyncStorage entries are not cleared unexpectedly.

## Recommended Development Practices

- Use feature branches and follow conventional commits.
- Maintain parity between JSON exports (products/customers) and Firestore data by scheduling regular syncs.
- Document any schema changes in `DEVELOPER_README.md` or create migration scripts.
- Keep user-facing copy in both English and Greek updated when adding new features.

---

For questions specific to build automation or infrastructure, coordinate with the release engineering contact listed in the primary developer README.
