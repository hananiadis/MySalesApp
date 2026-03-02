# Year-end automation helper (PowerShell)
# Usage examples (run from repo root):
#   pwsh ./scripts/prepare-year-end.ps1 -FromYear 2026 -ToYear 2027 -DryRun
#   pwsh ./scripts/prepare-year-end.ps1 -FromYear 2026 -ToYear 2027
# Notes:
#   - Creates backups under backups/year-end-<timestamp>
#   - Does simple string replacements; review diffs after run

param(
  [Parameter(Mandatory=$true)][int]$FromYear,
  [Parameter(Mandatory=$true)][int]$ToYear,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path -Path 'backups' -ChildPath "year-end-$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

function Backup-Path($path) {
  if (Test-Path $path) {
    $destination = Join-Path $backupDir (Split-Path $path -Leaf)
    Copy-Item -Recurse -Force -Path $path -Destination $destination
  }
}

function Replace-InFile($search, $replace, $file) {
  if (-not (Test-Path $file)) { return }
  if ($DryRun) {
    Write-Output "[DRY-RUN] Would replace '$search' -> '$replace' in $file"
    return
  }
  (Get-Content -Raw -Path $file) -replace [regex]::Escape($search), $replace | Set-Content -NoNewline -Path $file
}

$files = @(
  'src/services/spreadsheets.js',
  'src/services/playmobilKpi.js',
  'src/services/kivosKpi.js',
  'src/services/playmobilCustomerMetrics.js',
  'src/screens/CustomerSalesSummary.js',
  'src/screens/CustomerMonthlySales.js'
)

# Backups
foreach ($f in $files) { Backup-Path $f }

# Replacements
foreach ($f in $files) { Replace-InFile $FromYear $ToYear $f }

# Summary
Write-Output ""
Write-Output "=== Summary ==="
foreach ($f in $files) {
  if (Test-Path $f) { Write-Output "Updated years in $f" }
}
Write-Output "Review and update sheet URLs for new year (src/services/spreadsheets.js)"
Write-Output "Verify date parsing expectations in src/services/kivosKpi.js for the new year"
# Validation: ensure spreadsheets.js contains the new year token
if (Test-Path 'src/services/spreadsheets.js') {
  $content = Get-Content -Raw -Path 'src/services/spreadsheets.js'
  if ($content -like "*${ToYear}*") {
    Write-Output "Validation: spreadsheets.js contains $ToYear ✅"
  } else {
    Write-Output "Validation: spreadsheets.js missing $ToYear ❌ (update URLs/keys manually)"
  }
}
if ($DryRun) {
  Write-Output "Dry-run complete. No files were modified."
} else {
  Write-Output "Completed. Backups stored in: $backupDir"
}
