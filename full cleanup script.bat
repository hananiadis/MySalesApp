@echo off
echo Cleaning up project directories...

echo Deleting node_modules...
if exist node_modules (
    rd /s /q node_modules
    echo node_modules deleted.
) else (
    echo node_modules not found, skipping.
)

echo Deleting android/build...
if exist android\build (
    rd /s /q android\build
    echo android/build deleted.
) else (
    echo android/build not found, skipping.
)

echo Deleting android/app/build...
if exist android\app\build (
    rd /s /q android\app\build
    echo android/app/build deleted.
) else (
    echo android/app/build not found, skipping.
)

echo Deleting ios/build...
if exist ios\build (
    rd /s /q ios\build
    echo ios/build deleted.
) else (
    echo ios/build not found, skipping.
)

echo Deleting ios/Pods...
if exist ios\Pods (
    rd /s /q ios\Pods
    echo ios/Pods deleted.
) else (
    echo ios/Pods not found, skipping.
)

echo Cleanup complete.
pause