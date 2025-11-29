# Troubleshooting MonthlyComparisonScreen Infinite Loop

## ADB Logcat Command

Use this command to get filtered logs relevant to the problem:

```powershell
adb logcat -c; adb logcat *:S ReactNative:V ReactNativeJS:V | Select-String -Pattern "MonthlyComparison|usePlaymobilKpi"
```

### What this does:
- `adb logcat -c` - Clears the existing log buffer
- `adb logcat *:S ReactNative:V ReactNativeJS:V` - Only shows ReactNative and ReactNativeJS logs
- `Select-String -Pattern "MonthlyComparison|usePlaymobilKpi"` - Filters to only our component logs

### Alternative (if you want more context):
```powershell
adb logcat -c; adb logcat *:S ReactNativeJS:V
```

This shows all React Native JS logs without filtering by component name.

## What to Look For

### 1. **Render Loop Detection**
Look for rapidly incrementing render numbers:
```
[MonthlyComparison] ===== RENDER #1 =====
[MonthlyComparison] ===== RENDER #2 =====
[MonthlyComparison] ===== RENDER #3 =====
```
If these increment rapidly (multiple per second), you have an infinite render loop.

### 2. **Hook Status Changes**
Check if the hook status keeps cycling:
```
[MonthlyComparison] Current year hook returned: { status: 'awaiting_selection', ... }
[MonthlyComparison] Current year hook returned: { status: 'loading', ... }
[MonthlyComparison] Current year hook returned: { status: 'awaiting_selection', ... }
```
The status should stabilize, not keep changing.

### 3. **selectedSalesmenIds Value**
Check what IDs are being passed:
```
[MonthlyComparison] Route params: { ..., initialSelection: [...] }
[MonthlyComparison] Default IDs calculated: [...]
[MonthlyComparison] Current state: { selectedSalesmenIds: [...] }
```
If `selectedSalesmenIds` is `null` or `undefined`, that's the problem.

### 4. **useMemo Recalculations**
Look for repeated useMemo calculations:
```
[MonthlyComparison] useMemo[availableCategories] calculating...
[MonthlyComparison] useMemo[monthlyData] calculating...
[MonthlyComparison] useMemo[pieChartData] calculating...
```
These should only calculate once per state/prop change, not continuously.

### 5. **useEffect Triggers**
Check if useEffect keeps triggering:
```
[MonthlyComparison] useEffect[brand] triggered, brand: playmobil
```
This should only appear once when the screen mounts, not repeatedly.

## Common Causes

### A. selectedSalesmenIds is null
**Symptom**: Hook returns `awaiting_selection` status
**Fix**: Ensure IDs are passed from navigation params

### B. Filter dependencies causing re-renders
**Symptom**: useMemo calculations repeat constantly
**Fix**: Check that filter state changes aren't triggering unnecessary recalculations

### C. State updates in render
**Symptom**: Render count increases rapidly
**Fix**: Ensure no setState calls are happening directly in render or in useMemo without proper dependencies

### D. Hook object reference changes
**Symptom**: Hook results trigger re-renders even when data hasn't changed
**Fix**: Ensure hook returns are properly memoized

## Steps to Fix

1. **Run the logcat command** and observe the output
2. **Count render cycles** - If more than 3-4 in quick succession, it's a loop
3. **Check selectedSalesmenIds** - Must be an array of valid IDs, never null
4. **Verify useMemo dependencies** - Should only include values that actually change
5. **Check for setState in render** - None should exist outside useEffect/callbacks

## Expected Behavior

After navigating to the screen, you should see:
1. **RENDER #1** - Initial mount
2. **RENDER #2** - After route params are processed
3. **RENDER #3** - After hooks load data
4. **RENDER #4** (maybe) - After customers data loads

Then renders should stop unless user interacts (changes filters, etc.)
