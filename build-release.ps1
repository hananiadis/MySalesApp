# build-release.ps1
# Build script that updates version and builds release APK

Write-Host "Starting release build process..." -ForegroundColor Cyan
Write-Host ""

# Update version
Write-Host "Updating version..." -ForegroundColor Yellow
node scripts/update-version.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "Version update failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Building release APK..." -ForegroundColor Yellow
Write-Host ""

# Navigate to android directory and run gradle
Push-Location android
try {
    .\gradlew assembleRelease
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Build successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "APK location: android\app\build\outputs\apk\release\app-release.apk" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
