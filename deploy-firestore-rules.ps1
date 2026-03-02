$ErrorActionPreference = 'Stop'

Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "Deploying Firestore rules for project mysalesapp-38ccf..." -ForegroundColor Cyan

# If you're not logged in yet, run:
#   npx firebase-tools login

npx --yes firebase-tools deploy --only firestore:rules --project mysalesapp-38ccf

Write-Host "Done." -ForegroundColor Green
