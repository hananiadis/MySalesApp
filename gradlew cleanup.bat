@echo off
echo Running Gradle clean for Android...

rem Change directory to the 'android' folder
cd android

rem Check if the change directory was successful
if %errorlevel% neq 0 (
    echo Error: Could not change to 'android' directory. Make sure you are in the project root.
    goto :eof
)

rem Execute the gradlew clean command
rem On Windows, the executable is gradlew.bat
call gradlew.bat clean

rem Check if the gradlew command was successful
if %errorlevel% neq 0 (
    echo Error: gradlew clean failed.
) else (
    echo gradlew clean completed successfully.
)

rem Change back to the parent directory
cd ..

echo Script finished.
pause