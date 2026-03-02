#!/usr/bin/env bash
# Year-end automation helper: backs up configs and applies year bumps
# Usage:
#   ./scripts/prepare-year-end.sh --from 2026 --to 2027 [--dry-run]
# Notes:
#   - Requires bash, sed, date utilities
#   - Run from repo root

set -euo pipefail

FROM_YEAR=""
TO_YEAR=""
DRY_RUN=false
BACKUP_DIR="backups/year-end-$(date +%Y%m%d-%H%M%S)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      FROM_YEAR="$2"; shift 2;;
    --to)
      TO_YEAR="$2"; shift 2;;
    --dry-run)
      DRY_RUN=true; shift;;
    *)
      echo "Unknown argument: $1" >&2; exit 1;;
  esac
done

if [[ -z "$FROM_YEAR" || -z "$TO_YEAR" ]]; then
  echo "Usage: $0 --from <YYYY> --to <YYYY> [--dry-run]" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

backup() {
  local path="$1"
  if [[ -f "$path" ]]; then
    cp "$path" "$BACKUP_DIR"/
  elif [[ -d "$path" ]]; then
    cp -r "$path" "$BACKUP_DIR"/
  fi
}

replace_in_file() {
  local search="$1"; shift
  local replace="$1"; shift
  local file="$1"; shift
  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY-RUN] Would replace '$search' -> '$replace' in $file"
  else
    # Portable sed -i replacement
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/${search}/${replace}/g" "$file"
    else
      sed -i "s/${search}/${replace}/g" "$file"
    fi
  fi
}

SUMMARY=()

# Backup key configs
backup "src/services/spreadsheets.js"
backup "src/services/playmobilKpi.js"
backup "src/services/kivosKpi.js"
backup "src/services/playmobilCustomerMetrics.js"
backup "src/screens/CustomerSalesSummary.js"
backup "src/screens/CustomerMonthlySales.js"

# Replace year references in common files
FILES=(
  "src/services/spreadsheets.js"
  "src/services/playmobilKpi.js"
  "src/services/kivosKpi.js"
  "src/services/playmobilCustomerMetrics.js"
  "src/screens/CustomerSalesSummary.js"
  "src/screens/CustomerMonthlySales.js"
)

for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    replace_in_file "$FROM_YEAR" "$TO_YEAR" "$f"
    SUMMARY+=("Updated years in $f")
  fi
done

# Reminder for manual URL updates
SUMMARY+=("Review and update sheet URLs for new year (spreadsheets.js)")
SUMMARY+=("Verify date parsing expectations in kivosKpi.js for the new year")

# Validation: ensure spreadsheets.js contains the new year token
if [[ -f "src/services/spreadsheets.js" ]]; then
  if grep -q "$TO_YEAR" src/services/spreadsheets.js; then
    SUMMARY+=("Validation: spreadsheets.js contains $TO_YEAR ✅")
  else
    SUMMARY+=("Validation: spreadsheets.js missing $TO_YEAR ❌ (update URLs/keys manually)")
  fi
fi

echo ""
echo "=== Summary ==="
printf '%s
' "${SUMMARY[@]}"

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry-run complete. No files were modified."
else
  echo "Completed. Backups stored in: $BACKUP_DIR"
fi
