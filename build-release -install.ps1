# build-release.ps1
# Build script that updates version, builds release APK, and installs it via ADB

Write-Host ""
Write-Host "===============================" -ForegroundColor Cyan
Write-Host " Starting release build process" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host ""

# Step 1 — Update version
Write-Host "Updating version..." -ForegroundColor Yellow
node scripts/update-version.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Version update failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✔ Version updated successfully." -ForegroundColor Green
Write-Host ""

# Step 2 — Build release APK
Write-Host "Building release APK..." -ForegroundColor Yellow
Write-Host ""

Push-Location android
try {
    .\gradlew assembleRelease

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "======================" -ForegroundColor Green
        Write-Host " ✔ Build successful!" -ForegroundColor Green
        Write-Host "======================" -ForegroundColor Green
        Write-Host ""
        Write-Host "APK path:" -ForegroundColor Cyan
        Write-Host "C:\MySalesApp\android\app\build\outputs\apk\release\app-release.apk" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ Build failed!" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

# Step 3 — Install APK through ADB
$apkPath = "C:\MySalesApp\android\app\build\outputs\apk\release\app-release.apk"

Write-Host ""
Write-Host "Installing APK via ADB..." -ForegroundColor Yellow
Write-Host "Command:" -ForegroundColor Gray
Write-Host "adb install -r $apkPath" -ForegroundColor Gray
Write-Host ""

adb install -r $apkPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================" -ForegroundColor Green
    Write-Host " ✔ APK installed!" -ForegroundColor Green
    Write-Host "========================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ ADB installation failed!" -ForegroundColor Red
    exit 1
}
