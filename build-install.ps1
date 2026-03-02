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

        # Show the newest APK produced under outputs\apk\release (handles flavors/splits better)
        $apkDir = Join-Path (Get-Location) "app\build\outputs\apk\release"
        if (Test-Path $apkDir) {
            $latestApk = Get-ChildItem -Path $apkDir -Filter *.apk -Recurse |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1

            if ($null -ne $latestApk) {
                Write-Host "APK path (latest):" -ForegroundColor Cyan
                Write-Host $latestApk.FullName -ForegroundColor Cyan
            } else {
                Write-Host "⚠ No APK found in: $apkDir" -ForegroundColor Yellow
            }
        } else {
            Write-Host "⚠ APK output directory not found: $apkDir" -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        Write-Host "❌ Build failed!" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

# Step 3 — Install APK through ADB

# Prefer the newest APK from the release output folder (more robust than hardcoding)
$apkDir = "C:\MySalesApp\android\app\build\outputs\apk\release"
$apkFile = Get-ChildItem -Path $apkDir -Filter *.apk -Recurse |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($null -eq $apkFile) {
    Write-Host "❌ Could not find any release APK under: $apkDir" -ForegroundColor Red
    exit 1
}

$apkPath = $apkFile.FullName

# Use explicit adb.exe path to avoid PATH/alias issues
$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
    # Fallback to PATH if SDK location differs
    $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($null -eq $adbCmd) {
        Write-Host "❌ adb not found (neither at default SDK path nor in PATH)." -ForegroundColor Red
        exit 1
    }
    $adb = $adbCmd.Source
}

Write-Host ""
Write-Host "Installing APK via ADB..." -ForegroundColor Yellow
Write-Host "ADB:" -ForegroundColor Gray
Write-Host $adb -ForegroundColor Gray
Write-Host "APK:" -ForegroundColor Gray
Write-Host $apkPath -ForegroundColor Gray
Write-Host ""

# Reset adb server and show connected devices (helps when script targets wrong device/session)
& $adb kill-server | Out-Null
& $adb start-server | Out-Null

Write-Host "Connected devices:" -ForegroundColor Cyan
& $adb devices -l

Write-Host ""
Write-Host "Command:" -ForegroundColor Gray
Write-Host "`"$adb`" install -r `"$apkPath`"" -ForegroundColor Gray
Write-Host ""

# Capture output and require "Success" to avoid false-positive banners
$adbOut = & $adb install -r "$apkPath" 2>&1
$adbOut | ForEach-Object { Write-Host $_ }

if ($adbOut -match "Success") {
    Write-Host ""
    Write-Host "========================" -ForegroundColor Green
    Write-Host " ✔ APK installed!" -ForegroundColor Green
    Write-Host "========================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ ADB installation failed (no 'Success' in output)!" -ForegroundColor Red
    exit 1
}
