$ErrorActionPreference = 'Stop'

Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "Deploying Firestore rules for project mysalesapp-38ccf..." -ForegroundColor Cyan

$sourceRules = Join-Path (Get-Location) "firebase\firestore.rules"
$mirrorRules = Join-Path (Get-Location) "warehouse-web\firestore.rules"

if (Test-Path $sourceRules) {
	Copy-Item -Path $sourceRules -Destination $mirrorRules -Force
	Write-Host "Synchronized warehouse-web/firestore.rules from firebase/firestore.rules" -ForegroundColor DarkGray
}

# If you're not logged in yet, run:
#   npx firebase-tools login

npx --yes firebase-tools deploy --only firestore:rules --project mysalesapp-38ccf

Write-Host "Done." -ForegroundColor Green
