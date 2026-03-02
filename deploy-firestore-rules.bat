@echo off
setlocal
cd /d %~dp0
echo Deploying Firestore rules for project mysalesapp-38ccf...
REM If you're not logged in yet, run: npx firebase-tools login
npx --yes firebase-tools deploy --only firestore:rules --project mysalesapp-38ccf
if errorlevel 1 exit /b 1
echo Done.
endlocal
