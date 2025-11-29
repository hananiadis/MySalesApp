# Automatic Versioning System

## Version Format

The app uses automatic versioning with the following format:

```
BASE.WEEK.YEAR.BUILD
```

- **BASE**: Fixed base version (currently `0.4`)
- **WEEK**: ISO week number (1-53)
- **YEAR**: Full year (e.g., 2025)
- **BUILD**: Build number for the current week (resets every Monday)

**Example**: `0.4.47.2025.14`
- Base version 0.4
- Week 47 of the year
- Year 2025
- 14th build this week

## Version Code

The Android `versionCode` is automatically calculated as:
```
YYYYWWBBBB
```

Example: `202547001` = Year 2025, Week 47, Build 0001

This ensures each build has a unique, incrementing version code.

## Usage

### Method 1: PowerShell Script (Recommended)

Run the build script which automatically updates version and builds:

```powershell
.\build-release.ps1
```

### Method 2: npm Script

```bash
npm run build:release
```

### Method 3: Manual Version Update

Update version only (without building):

```bash
npm run update-version
```

Then build manually:

```bash
cd android
.\gradlew assembleRelease
```

## How It Works

1. **Week Detection**: The script calculates the current ISO week number and finds Monday of the week
2. **Build Counter**: Tracks build number in `scripts/.build-counter.json` (gitignored)
3. **Auto-Increment**: Each build increments the counter; resets to 1 on new week
4. **File Updates**: Automatically updates:
   - `app.json` → `expo.version`
   - `android/app/build.gradle` → `versionCode` and `versionName`

## Build Counter

The build counter is stored in `scripts/.build-counter.json`:

```json
{
  "weekStart": "2025-11-18",
  "buildNumber": 5
}
```

- **weekStart**: Monday of the current week (ISO format)
- **buildNumber**: Current build number for this week

This file is excluded from git to maintain local build tracking.

## Changing Base Version

To change the base version (e.g., from 0.4 to 0.5):

Edit `scripts/update-version.js`:

```javascript
const BASE_VERSION = '0.5'; // Change this line
```

## Output Location

After successful build:
```
android/app/build/outputs/apk/release/app-release.apk
```

## Notes

- Build numbers reset every Monday at 00:00
- Version code is guaranteed to be unique and incrementing
- Maximum 9999 builds per week (realistically more than enough)
- The system works across multiple developers by using local build counters
