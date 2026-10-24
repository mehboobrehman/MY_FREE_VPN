@echo off
TITLE MY_FREE_VPN Unified Launcher
echo ========================================================
echo    MY_FREE_VPN Unified Bootstrap & Launch Script (Windows)
echo ========================================================

REM 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is required but not found in PATH. Please install Node.js.
    pause
    exit /b 1
)

REM 2. Setup Backend API Server
echo [INFO] Setting up Backend API Server...
cd backend
if not exist node_modules (
    echo [INFO] Installing backend dependencies...
    call npm install --production
)

echo [INFO] Starting Backend API Server...
start /B node src/index.js > ..\backend.log 2>&1
echo Backend started.
cd ..

echo.
echo ========================================================
echo  Client Artifacts Available in this Unified Package:
echo    - Windows Portable: clients\MY_FREE_VPN_Windows_v1.1.3.zip
echo    - Windows Installer: clients\MY_FREE_VPN_Setup_v1.1.3.exe
echo    - Android APK: clients\MY_FREE_VPN_v1.1.3.apk
echo    - Browser Extension: clients\MY_FREE_VPN_Browser_Extension_v1.1.3.zip
echo ========================================================
echo Backend is running in the background. Check backend.log for details.
echo Note: Android APK and Setup Installer are coming soon.
pause
