# Essential Files and Folders for APK Building

## Files/Folders to KEEP (Essential for building APK):

### Root Configuration Files
- `App.js` - Main application entry point
- `package.json` - Dependencies and scripts
- `app.json` - Expo configuration
- `babel.config.js` - Babel configuration
- `metro.config.js` - Metro bundler configuration
- `eas.json` - EAS Build configuration
- `jest.config.js` - Jest testing configuration
- `jest.setup.js` - Jest setup file

### Source Code
- `src/` - Complete source code directory
  - All subdirectories and files are essential

### Assets
- `assets/` - All image assets and icons

### Firebase Configuration
- `firebase/` - Firebase configuration files
  - `google-services.json` - Essential for Firebase
  - `firestore.rules` - Security rules

### Generated Android Project
- `android/` - Generated Android project (after prebuild)

## Files/Folders to DELETE (Not needed for APK building):

### Development Tools
- `.bundle/` - Ruby bundler cache
- `__tests__/` - Test files (optional, can be kept for development)
- `.eslintrc.js` - ESLint configuration (optional)
- `.prettierrc.js` - Prettier configuration (optional)
- `.watchmanconfig` - Watchman configuration (optional)
- `.gitattributes` - Git attributes (optional)
- `.gitignore` - Git ignore rules (optional)

### Backup/Development Files
- `App - Copy.js` - Backup file
- `DEVELOPER_README.md` - Documentation (can be kept)
- `USER_GUIDE_GREEK.md` - Documentation (can be kept)
- `USER_GUIDE.md` - Old user guide (can be deleted)

### Import/Export Scripts
- `firestore-import/` - Data import scripts (not needed for app)
- `scripts/` - Utility scripts (not needed for app)

### Build Artifacts
- `node_modules/` - Will be regenerated with `npm install`
- `android/build/` - Build cache (will be regenerated)
- `android/.gradle/` - Gradle cache (will be regenerated)

## Batch Commands for Clean Build Setup

### Windows Batch File (setup_build.bat)

```batch
@echo off
echo Setting up MySalesApp for APK building...

REM Clean up unnecessary files and folders
echo Cleaning up unnecessary files...
if exist ".bundle" rmdir /s /q ".bundle"
if exist "__tests__" rmdir /s /q "__tests__"
if exist ".eslintrc.js" del ".eslintrc.js"
if exist ".prettierrc.js" del ".prettierrc.js"
if exist ".watchmanconfig" del ".watchmanconfig"
if exist ".gitattributes" del ".gitattributes"
if exist ".gitignore" del ".gitignore"
if exist "App - Copy.js" del "App - Copy.js"
if exist "USER_GUIDE.md" del "USER_GUIDE.md"

REM Clean up import/export scripts
if exist "firestore-import" rmdir /s /q "firestore-import"
if exist "scripts" rmdir /s /q "scripts"

REM Clean up build artifacts
if exist "node_modules" rmdir /s /q "node_modules"
if exist "android\build" rmdir /s /q "android\build"
if exist "android\.gradle" rmdir /s /q "android\.gradle"

echo Cleanup completed!

REM Install dependencies
echo Installing dependencies...
npm install

REM Check Expo dependencies
echo Checking Expo dependencies...
npx expo install --check

REM Generate Android project
echo Generating Android project...
npx expo prebuild --platform android --clean

echo Setup completed! You can now build the APK with:
echo cd android
echo ./gradlew assembleRelease
pause
```

### PowerShell Script (setup_build.ps1)

```powershell
Write-Host "Setting up MySalesApp for APK building..." -ForegroundColor Green

# Clean up unnecessary files and folders
Write-Host "Cleaning up unnecessary files..." -ForegroundColor Yellow
if (Test-Path ".bundle") { Remove-Item -Recurse -Force ".bundle" }
if (Test-Path "__tests__") { Remove-Item -Recurse -Force "__tests__" }
if (Test-Path ".eslintrc.js") { Remove-Item -Force ".eslintrc.js" }
if (Test-Path ".prettierrc.js") { Remove-Item -Force ".prettierrc.js" }
if (Test-Path ".watchmanconfig") { Remove-Item -Force ".watchmanconfig" }
if (Test-Path ".gitattributes") { Remove-Item -Force ".gitattributes" }
if (Test-Path ".gitignore") { Remove-Item -Force ".gitignore" }
if (Test-Path "App - Copy.js") { Remove-Item -Force "App - Copy.js" }
if (Test-Path "USER_GUIDE.md") { Remove-Item -Force "USER_GUIDE.md" }

# Clean up import/export scripts
if (Test-Path "firestore-import") { Remove-Item -Recurse -Force "firestore-import" }
if (Test-Path "scripts") { Remove-Item -Recurse -Force "scripts" }

# Clean up build artifacts
if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }
if (Test-Path "android\build") { Remove-Item -Recurse -Force "android\build" }
if (Test-Path "android\.gradle") { Remove-Item -Recurse -Force "android\.gradle" }

Write-Host "Cleanup completed!" -ForegroundColor Green

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Check Expo dependencies
Write-Host "Checking Expo dependencies..." -ForegroundColor Yellow
npx expo install --check

# Generate Android project
Write-Host "Generating Android project..." -ForegroundColor Yellow
npx expo prebuild --platform android --clean

Write-Host "Setup completed! You can now build the APK with:" -ForegroundColor Green
Write-Host "cd android" -ForegroundColor Cyan
Write-Host "./gradlew assembleRelease" -ForegroundColor Cyan
```

### Manual Commands (if you prefer to run individually)

```bash
# Clean up unnecessary files
rm -rf .bundle
rm -rf __tests__
rm -f .eslintrc.js
rm -f .prettierrc.js
rm -f .watchmanconfig
rm -f .gitattributes
rm -f .gitignore
rm -f "App - Copy.js"
rm -f USER_GUIDE.md

# Clean up import/export scripts
rm -rf firestore-import
rm -rf scripts

# Clean up build artifacts
rm -rf node_modules
rm -rf android/build
rm -rf android/.gradle

# Install dependencies
npm install

# Check Expo dependencies
npx expo install --check

# Generate Android project
npx expo prebuild --platform android --clean

# Build APK
cd android
./gradlew assembleRelease
```

## Final Directory Structure (After Cleanup)

```
MySalesApp/
├── App.js
├── package.json
├── app.json
├── babel.config.js
├── metro.config.js
├── eas.json
├── jest.config.js
├── jest.setup.js
├── DEVELOPER_README.md
├── USER_GUIDE_GREEK.md
├── src/
│   ├── components/
│   ├── config/
│   ├── constants/
│   ├── context/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   └── utils/
├── assets/
├── firebase/
│   ├── google-services.json
│   └── firestore.rules
└── android/ (generated after prebuild)
```

## Quick Build Commands

After running the setup script, use these commands to build the APK:

```bash
# Navigate to android directory
cd android

# Build release APK
./gradlew assembleRelease

# The APK will be located at:
# android/app/build/outputs/apk/release/app-release.apk
```

## Notes

- The `node_modules` folder will be regenerated with `npm install`
- The `android` folder will be regenerated with `npx expo prebuild`
- Keep the `firebase/google-services.json` file as it's essential for Firebase functionality
- The documentation files (`DEVELOPER_README.md`, `USER_GUIDE_GREEK.md`) can be kept for reference
