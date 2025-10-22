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
