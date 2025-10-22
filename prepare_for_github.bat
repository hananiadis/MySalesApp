@echo off
echo Preparing MySalesApp for GitHub upload...

REM Clean up unnecessary files and folders for GitHub
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
if exist "android" rmdir /s /q "android"

echo Cleanup completed!

REM Create .gitignore for the repository
echo Creating .gitignore file...
(
echo node_modules/
echo android/
echo ios/
echo .expo/
echo dist/
echo npm-debug.*
echo *.jks
echo *.p8
echo *.p12
echo *.key
echo *.mobileprovision
echo *.orig.*
echo web-build/
echo .env.local
echo .env.development.local
echo .env.test.local
echo .env.production.local
echo .DS_Store
echo Thumbs.db
) > .gitignore

echo Repository prepared for GitHub upload!
echo.
echo Files to upload:
echo - All source files in src/
echo - Configuration files (App.js, package.json, app.json, etc.)
echo - Assets folder
echo - Firebase configuration
echo - Documentation files (README.md, DEVELOPER_README.md, USER_GUIDE_GREEK.md)
echo - Build setup files (setup_build.bat, setup_build.ps1, BUILD_SETUP_GUIDE.md)
echo.
echo To rebuild the project after cloning:
echo 1. Run setup_build.bat
echo 2. cd android
echo 3. ./gradlew assembleRelease
pause
