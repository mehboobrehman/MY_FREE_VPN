#!/usr/bin/env bash
set -e

echo "========================================================"
echo "    MY_FREE_VPN Unified Bootstrap & Launch Script       "
echo "========================================================"

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is required but not installed. Please install Node.js (v16+)."
    exit 1
fi

# 2. Setup & Start Backend API Server
echo "[INFO] Setting up Backend API Server..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing backend dependencies..."
    npm install --production
fi

echo "[INFO] Starting Backend API Server on port 3000..."
nohup node src/index.js > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid
cd ..

echo "[SUCCESS] Backend API Server started successfully (PID: $BACKEND_PID)."
echo "[INFO] Logs are being written to backend.log."

echo ""
echo "========================================================"
echo " Client Artifacts Available in this Unified Package:"
echo "   - Windows Portable: clients/MY_FREE_VPN_Windows_v1.1.3.zip"
echo "   - Windows Installer: clients/MY_FREE_VPN_Setup_v1.1.3.exe"
echo "   - Android APK: clients/MY_FREE_VPN_v1.1.3.apk"
echo "   - Browser Extension: clients/MY_FREE_VPN_Browser_Extension_v1.1.3.zip"
echo "========================================================"
echo "To stop the backend server, run: kill \$(cat backend.pid)"
echo "Note: Android APK and Setup Installer are coming soon."
