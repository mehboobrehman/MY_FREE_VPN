# Android Emulator, Live Debugging & Privacy-Conscious Telemetry Guide

## 1. Android Studio Emulator Setup
Follow these steps to set up a high-performance Android Emulator for testing and debugging **MY_FREE_VPN**:

1. **Open Device Manager**: In Android Studio, go to **Tools > Device Manager** (or click the Device Manager icon in the right-hand toolbar).
2. **Create Virtual Device**: Click **Create Device**.
3. **Select Hardware**: Choose **Phone** category and select **Pixel 6** or **Pixel 7** (recommended for standard screen density and performance).
4. **Select System Image (API 34+)**:
   - Select **API 34** (Android 14.0) or **API 35** (Android 15.0).
   - Ensure you select the **x86_64** or **ARM64** system image matching your host CPU architecture.
   - *Note*: Ensure hardware acceleration (HAXM on Intel or Hypervisor Framework on Windows/macOS) is enabled in your BIOS/OS settings.
5. **Advanced Settings & Cold Boot**:
   - Name your AVD (e.g., `Pixel_6_API_34`).
   - Under **Emulated Performance**, select **Hardware - GLES 2.0** for graphics acceleration.
   - Set **Boot option** to **Cold boot** if you experience state inconsistency between debug sessions.
6. **Launch Emulator**: Click the **Play** button next to your virtual device in Device Manager.

---

## 2. Port Forwarding with `adb reverse`
Because the backend API and telemetry collector run on your host machine at port `48392`, the Android emulator (which sits behind a virtual router `10.0.2.2`) requires port reverse mapping so requests to `http://10.0.2.2:48392` successfully reach your local machine.

Run this command in your terminal before launching the Flutter app:
```bash
adb reverse tcp:48392 tcp:48392
```

To verify active reverse ports:
```bash
adb reverse --list
```

---

## 3. Live Debugging & Development Workflow

### Launching the App
1. Navigate to the Flutter client directory:
   ```bash
   cd client
   ```
2. Run the app in debug mode on the connected emulator:
   ```bash
   flutter run
   ```

### Hot Reload & Hot Restart
- Press **`r`** in the terminal running `flutter run` for **Hot Reload** (instant UI state updates).
- Press **`R`** (Shift + r) for **Hot Restart** (full app state restart).

### Logcat Filtering
To inspect native Android logs, WireGuard background service events, and platform channel communications:
1. Open Logcat in Android Studio.
2. Enter the filter tag:
   ```regex
   tag:MY_FREE_VPN
   ```
   or search by process ID / `VpnService`.

### Flutter DevTools Profiling
1. When running `flutter run`, note the DevTools URI printed in the console (e.g., `http://127.0.0.1:9100?...`).
2. Open DevTools to inspect CPU profiles, memory allocation, network traffic, and widget inspection.

### Breakpoint Debugging
- Set breakpoints directly in VS Code or Android Studio.
- Inspect variables, call stacks, and asynchronous execution flows in real time.

---

## 4. Privacy-Conscious Telemetry Guarantees
**MY_FREE_VPN** adheres to strict zero-knowledge privacy principles:

1. **Zero PII Collection**: No personal information, real names, email addresses, IP addresses, or browsing destinations are ever collected or transmitted.
2. **Automatic Redaction**: All telemetry payloads pass through `TelemetryRedactor` (`client/lib/services/telemetry_redactor.dart`), which automatically scrubs authorization headers, cookies, API tokens, passwords, and private keys.
3. **No VPN Traffic Collection**: The telemetry layer only records high-level diagnostic events (app lifecycle, VPN connect/disconnect outcomes, node-fetch duration, API status codes). It **never** inspects, intercepts, or logs user traffic passing through the WireGuard VPN tunnel.
4. **Debug-Only Gating**: Telemetry collectors and debug overlays are strictly guarded with `kDebugMode`. They are completely compiled out of production release builds.

---

## 5. Simulation & Testing Scenarios

| Scenario | How to Simulate | Expected Behavior |
| :--- | :--- | :--- |
| **1. Offline Mode** | Disable Wi-Fi/Cellular on emulator or disconnect backend runner. | App falls back to cached node or static default node (`195.201.0.1:51820`), records offline telemetry state in SQLite buffer. |
| **2. API Failures** | Stop the backend server on port 48392. | `VpnService.fetchNodes()` catches timeout/error, logs failure metric, and uses fallback node without crashing. |
| **3. Permission Denial** | Reject VPN permission dialog when connecting on Android. | Platform channel catches `PlatformException`, logs cancellation/denial, and safely resets connection state to disconnected. |
| **4. VPN Permission Prompts** | Tap "Connect" for the first time on Android. | System Android VpnService dialog prompts user to grant VpnService permission; upon approval, tunnel initializes. |
| **5. Slow Network Throttling** | Use Android Studio Emulator Network Speed Throttle (e.g. 2G / Edge). | Timeouts handled gracefully; async requests timeout within configured 8s/10s limits without blocking UI thread. |
| **6. Background/Foreground Transitions** | Press Home button, wait 10s, reopen app. | App lifecycle events logged; Device Agent Core pauses/resumes sync heartbeat and ANR checks appropriately. |
| **7. Windows vs. Android Behavior** | Run `flutter run -d windows` vs `-d android`. | Android uses platform channel `VpnService` with system VPN dialogs; Windows uses No-Admin proxy bound via Dart FFI in `WindowsVpnService`. Both share identical telemetry and debug screen logic. |
