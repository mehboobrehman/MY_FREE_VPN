# Zero-Admin Android Emulator & Live Debugging Guide for MY_FREE_VPN

This guide provides comprehensive, step-by-step instructions for setting up a fully functional Android development and testing environment in user space (`C:\Users\<username>\Android\sdk`) **without requiring administrative (admin) rights or Android Studio**. It also details live debugging, AVD management, third-party emulator connection, and real-time telemetry verification for **MY_FREE_VPN**.

---

## 1. Overview & Architecture

For developers and testers working in restricted corporate environments or standard user accounts without administrator privileges, installing Android Studio is often blocked. However, Google provides standalone Android Command-line Tools that can be downloaded, unpacked, and run entirely within user profile space.

### Key Components
- **Android Command-line Tools (`sdkmanager`, `avdmanager`)**: Command-line utilities for downloading SDK platforms, system images, and tools.
- **Platform Tools (`adb`, `fastboot`)**: Android Debug Bridge for device communication, port forwarding, and log inspection.
- **Android Emulator (`emulator`)**: Standalone QEMU-based virtualization engine for running Android virtual devices.
- **Telemetry & Diagnostics Pipeline**: Intercepts and forwards anonymized diagnostic events to the local telemetry collector (`http://localhost:48392`) via `adb reverse`.

---

## 2. Automated User-Space Setup Script

To automate the entire installation process, you can run the provided PowerShell setup script located at `tools/setup_zero_admin_emulator.ps1`.

Open PowerShell as a **standard user** (do **not** run as Administrator) and execute:
```powershell
powershell -ExecutionPolicy Bypass -File tools\setup_zero_admin_emulator.ps1
```

What the script automates:
1. Creates user-space SDK directory at `$env:USERPROFILE\Android\sdk`.
2. Downloads official Android command-line tools (`commandlinetools-win-*_latest.zip`) directly from Google repository.
3. Sets user-level environment variables (`ANDROID_HOME` and updates user `PATH`).
4. Installs required SDK components (`platform-tools`, `emulator`, `platforms;android-34`, `system-images;android-34;google_apis;x86_64`).
5. Automatically accepts Android SDK licenses.
6. Creates a virtual device (`Pixel_6_API_34`) via `avdmanager`.

---

## 3. Manual Step-by-Step Installation

If you prefer to perform the setup manually step-by-step, follow these instructions:

### Step 3.1: Create User-Space SDK Directory
Open PowerShell and create the target directory structure:
```powershell
$sdkPath = "$env:USERPROFILE\Android\sdk"
New-Item -ItemType Directory -Force -Path "$sdkPath\cmdline-tools"
```

### Step 3.2: Download and Extract Command-line Tools
Download the latest official command-line tools zip from Google:
```powershell
$url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
$zipPath = "$env:TEMP\commandlinetools.zip"
Invoke-WebRequest -Uri $url -OutFile $zipPath
Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\cmdline-tools-extract" -Force

# Move into cmdline-tools/latest (required folder structure for sdkmanager)
New-Item -ItemType Directory -Force -Path "$sdkPath\cmdline-tools\latest"
Move-Item -Path "$env:TEMP\cmdline-tools-extract\cmdline-tools\*" -Destination "$sdkPath\cmdline-tools\latest\" -Force
```

### Step 3.3: Set User-Level Environment Variables
Configure `ANDROID_HOME` and update the user `PATH` persistently without admin rights:
```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkPath, "User")

$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$newPaths = @(
    "$sdkPath\platform-tools",
    "$sdkPath\emulator",
    "$sdkPath\cmdline-tools\latest\bin"
)

foreach ($p in $newPaths) {
    if ($currentPath -notlike "*$p*") {
        $currentPath = "$currentPath;$p"
    }
}
[Environment]::SetEnvironmentVariable("PATH", $currentPath, "User")

# Refresh current session environment variables
$env:ANDROID_HOME = $sdkPath
$env:PATH = [Environment]::GetEnvironmentVariable("PATH", "User")
```

### Step 3.4: Install SDK Packages via `sdkmanager`
Accept licenses and install required platform tools, emulator, platform, and system image:
```powershell
# Accept all SDK licenses automatically
yes | sdkmanager --licenses

# Install core tooling and API 34 system image
sdkmanager "platform-tools" "emulator" "platforms;android-34" "system-images;android-34;google_apis;x86_64"
```

### Step 3.5: Create Android Virtual Device (AVD)
Create the virtual device using `avdmanager`:
```powershell
echo "no" | avdmanager create avd -n "Pixel_6_API_34" -k "system-images;android-34;google_apis;x86_64" --device "pixel_6"
```

---

## 4. Running the Emulator

### 4.1: Launching Standalone Android Emulator
To launch the emulator from any PowerShell window:
```powershell
emulator -avd Pixel_6_API_34 -netdelay none -netspeed full -gpu host
```
*Note*: If hardware acceleration (HAXM / Hyper-V / WHPX) is unavailable on your host machine, you can run with software rendering:
```powershell
emulator -avd Pixel_6_API_34 -gpu swiftshader_indirect
```

### 4.2: Alternative Lightweight / Third-Party Emulators (No Admin Rights)
If standard QEMU emulator performance is slow or hardware virtualization is disabled, several lightweight Android emulators install entirely as normal user-space applications without requiring administrator privileges:
- **LDPlayer** (LdPlayer9)
- **BlueStacks** (Hyper-V / Pie 64-bit)
- **MuMu Player** (NetEase MuMu)
- **NoxPlayer**

#### Connecting Third-Party Emulators via ADB:
1. Launch your third-party emulator app.
2. Connect ADB to the emulator's local debugging port (commonly `5555` or `5534` depending on the emulator):
   ```powershell
   adb connect 127.0.0.1:5555
   ```
3. Verify connection:
   ```powershell
   adb devices
   ```

---

## 5. Live Debugging Workflow

### 5.1: Running the Flutter Client
1. Navigate to the client directory:
   ```powershell
   cd client
   ```
2. Fetch dependencies:
   ```powershell
   flutter pub get
   ```
3. Run the app in debug mode on the emulator:
   ```powershell
   flutter run
   ```

### 5.2: Hot Reload & Hot Restart
- Press **`r`** in the terminal running `flutter run` for instant **Hot Reload**.
- Press **`R`** (Shift + r) for **Hot Restart** (full app state re-initialization).

### 5.3: Logcat Filtering
To inspect native Android logs, WireGuard background service events (`VpnServiceImpl`), and platform channel communications:
```powershell
adb logcat -s MY_FREE_VPN VpnServiceImpl flutter
```
Or filter by tag in Android Studio / VS Code:
```regex
tag:MY_FREE_VPN
```

### 5.4: Flutter DevTools & Breakpoint Debugging
1. Note the DevTools URI printed in the console upon running `flutter run` (e.g., `http://127.0.0.1:9100/...`).
2. Open DevTools to inspect widget trees, memory leaks, CPU profiles, and network performance.
3. Set breakpoints in VS Code / Android Studio to debug Dart logic live.

---

## 6. Telemetry Integration & Verification

### 6.1: ADB Port Forwarding / Reverse
Because the backend API and telemetry collector run on your host machine at port `48392`, the Android emulator requires port reverse mapping so requests originating from the app (`http://10.0.2.2:48392` or `http://localhost:48392`) reach the host machine:
```powershell
adb reverse tcp:48392 tcp:48392
```
Verify active reverse mappings:
```powershell
adb reverse --list
```

### 6.2: Diagnostics Screen in App
1. Open the **MY_FREE_VPN** app on the emulator.
2. Navigate to the **Diagnostics** or **Telemetry Debug Screen** (accessible via settings or debug banner).
3. Verify that telemetry events (`vpn_connect`, `state_inspection`, network metrics) are actively being recorded and flushed to the collector.

### 6.3: Exporting Sanitized Debug Reports
- Use the **Developer Viewer Dashboard** (`http://localhost:48392/viewer`) to inspect real-time events, replay sessions, or export HTTP Archive (`.har`) and JSON debug reports.
- All telemetry payloads automatically pass through `TelemetryRedactor` (`client/lib/services/telemetry_redactor.dart`) to ensure zero PII or credentials leakage.

---

## 7. Privacy & Security Compliance

**MY_FREE_VPN** strictly adheres to zero-knowledge privacy principles:
1. **Zero PII**: No personal data, real names, emails, IP addresses, or browsing destinations are logged or transmitted.
2. **Automatic Redaction**: Sensitive fields (`Authorization`, `Cookie`, `X-API-Key`, passwords, WireGuard keys) are scrubbed prior to transmission.
3. **Tunnel Privacy**: Telemetry records high-level app lifecycle and connection outcomes only. It **never** inspects, logs, or intercepts user traffic passing through the WireGuard VPN tunnel.
4. **Debug Gating**: Telemetry collectors are strictly guarded with `kDebugMode` and compiled out of production release builds.
