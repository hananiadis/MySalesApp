@echo off
setlocal
cd /d %~dp0
echo Deploying Firestore rules for project mysalesapp-38ccf...
copy /Y "firebase\firestore.rules" "warehouse-web\firestore.rules" >nul
if errorlevel 1 exit /b 1
echo Synchronized warehouse-web\firestore.rules from firebase\firestore.rules
REM If you're not logged in yet, run: npx firebase-tools login
npx --yes firebase-tools deploy --only firestore:rules --project mysalesapp-38ccf
if errorlevel 1 exit /b 1
echo Done.
endlocal
