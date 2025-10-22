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
