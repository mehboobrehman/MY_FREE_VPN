<div align="center">

# 🛡️ MY_FREE_VPN

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Release v1.1.3](https://img.shields.io/badge/Release-v1.1.3-brightgreen.svg)](https://github.com/mehboobrehman/MY_FREE_VPN/releases/tag/v1.1.3)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Windows%20%7C%20Browser-orange.svg)](https://github.com/mehboobrehman/MY_FREE_VPN/releases)
[![Protocol: WireGuard](https://img.shields.io/badge/Protocol-WireGuard-purple.svg)](https://www.wireguard.com/)

**Lifetime Free VPN for Android & Windows with Zero Setup and Zero-Logs Architecture.**

[Key Features](#-key-features) • [Architecture & Security](#️-architecture--security) • [Installation & User Guide](#-installation--user-guide) • [Developer Guide & Backend](#-developer-guide--backend-services) • [Release Artifacts](#-release-artifacts-v111)

</div>

---

## 🌟 Overview & Key Features

**MY_FREE_VPN** is engineered to provide unrestricted, high-speed, and secure internet access without subscriptions, accounts, or privacy compromises.

*   🚀 **Lifetime Free & Unlimited**: Zero subscription fees, zero bandwidth caps, and no throttling. Enjoy uncompromised high-speed tunneling worldwide.
*   ⚡ **Zero Setup & Zero PII**: No email registration, no passwords, and no KYC. Instant connection powered by cryptographic device authentication.
*   🔒 **Strict No-Logs & RAM-Only Nodes**: Exit nodes operate entirely in RAM (`tmpfs`). Zero persistent storage of traffic metadata, ensuring complete user anonymity.
*   🌍 **Smart DNS & Streaming Unblocking**: Optimized multi-hop routing designed to bypass geo-restrictions and stream seamlessly on Netflix, Hulu, BBC iPlayer, Disney+, and Prime Video.
*   📱 **Multi-Platform Native Support**: Seamless clients built for Android, Windows, and Browser Extensions.

---

## 🏗️ Architecture & Security

MY_FREE_VPN utilizes industry-standard cryptographic protocols to ensure uncompromising security and speed:

```
+-----------------------------------------------------------------------------+
|                          CLIENT (Android / Windows)                         |
|  - Generates Local Ed25519 & WireGuard Keypair                              |
|  - Cryptographically Signs Device UUID for Authentication                   |
+-----------------------------------------------------------------------------+
                                       │
                                       ▼ (TLS / HTTPS API)
+-----------------------------------------------------------------------------+
|                        BACKEND AUTH & NODE ORCHESTRATOR                     |
|  - Validates Cryptographic Signature                                        |
|  - Assigns Optimal RAM-Only Exit Node                                       |
+-----------------------------------------------------------------------------+
                                       │
                                       ▼ (WireGuard UDP Tunnel)
+-----------------------------------------------------------------------------+
|                        RAM-ONLY EXIT NODE (tmpfs)                           |
|  - ChaCha20-Poly1305 Encryption                                             |
|  - /dev/null Log Redirection (Zero PII / Zero Storage)                      |
+-----------------------------------------------------------------------------+
```

*   **WireGuard Protocol**: Powered by state-of-the-art cryptography (ChaCha20 for symmetry encryption, Curve25519 for key exchange). Offers superior performance, faster connection times, and significantly lower battery consumption compared to OpenVPN or IPsec.
*   **Device UUID Cryptographic Key Binding**: Instead of passwords or emails, the client generates a local private/public key pair. The Device UUID is cryptographically signed and verified by the backend registration service, preventing spoofing while keeping users completely anonymous.

---

## 📦 Installation & User Guide

Download the latest production release (**v1.1.3**) directly from GitHub Releases:
🔗 [GitHub Releases v1.1.3](https://github.com/mehboobrehman/MY_FREE_VPN/releases/tag/v1.1.3)

### 🪟 Windows (Portable & Installer)
1.  **Installer (`MY_FREE_VPN_Setup_v1.1.3.exe`)**:
    *   Download the setup executable.
    *   Run the installer wizard (installs with the official VPN Shield icon and sets up WinTUN driver bindings).
    *   Launch **MY_FREE_VPN** from your Start Menu or desktop shortcut.
2.  **Portable (`MY_FREE_VPN_Windows_v1.1.3.zip`)**:
    *   Download and extract the portable `.zip` package to any folder.
    *   Run `my-free-vpn.exe` directly without requiring administrative installation privileges.

### 🤖 Android (`v1.1.3`)
1.  Download `MY_FREE_VPN_v1.1.3.apk` to your Android device.
2.  Tap the APK file to install (allow "Install from unknown sources" if prompted by Android).
3.  Open the app, grant VpnService permissions when prompted, and tap **"Connect"** to activate secure tunneling.

### 🌐 Browser Extension (Manifest V3)
1.  Download and extract `MY_FREE_VPN_Browser_Extension_v1.1.3.zip`.
2.  Open your browser extension page (`chrome://extensions` or `edge://extensions`).
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked** and select the extracted extension directory.

---

## 🛠️ Developer Guide & Backend Services

For developers looking to inspect, build, or self-host backend infrastructure:

### Repository Structure
*   `/client` & `/clientandroid` — Flutter cross-platform applications (`VpnService` / WinTUN integration).
*   `/clientwindows` — Windows native wrapper & Go/WinTUN client implementation.
*   `/backend` — REST API service for device registration, node discovery, and health checks.
*   `/browser-extension` — Manifest V3 browser proxy extension.
*   `/infrastructure` — Ansible and Docker orchestration scripts for RAM-only VPN exit nodes (`tmpfs`).

### Backend Setup & Local Development
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## 🏷️ Release Artifacts (`v1.1.3`)

All official production artifacts for release **v1.1.3** are available on GitHub:
*   [MY_FREE_VPN_Setup_v1.1.3.exe](https://github.com/mehboobrehman/MY_FREE_VPN/releases/tag/v1.1.3) — Windows Installer
*   [MY_FREE_VPN_Windows_v1.1.3.zip](https://github.com/mehboobrehman/MY_FREE_VPN/releases/tag/v1.1.3) — Windows Portable Archive
*   [MY_FREE_VPN_v1.1.3.apk](https://github.com/mehboobrehman/MY_FREE_VPN/releases/tag/v1.1.3) — Android Client App
*   [MY_FREE_VPN_Browser_Extension_v1.1.3.zip](https://github.com/mehboobrehman/MY_FREE_VPN/releases/tag/v1.1.3) — Browser Extension (Manifest V3)

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.
