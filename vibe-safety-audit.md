# 🛡️ Vibe-Safety & Security Audit: MY_FREE_VPN

**Project**: MY_FREE_VPN  
**Lead Auditor**: AI Architecture Sentinel  
**Status**: Initial Deep Audit Completed (October 20, 2026)  

---

## 1. Security Architecture: The "Zero-Trust Zero-Setup" Model

### 1.1 WireGuard + Device UUID Evaluation
The proposed setup is highly efficient but carries specific risks if implemented naively.

*   **Risk: UUID Spoofing**: If the API only checks for a raw UUID, an attacker could spoof another user's ID to consume their bandwidth or impersonate their session (if stateful).
*   **Recommendation: Cryptographic Binding**:
    *   **Registration**: On first launch, the app generates a WireGuard Keypair (Local). It sends the `PublicKey` + `DeviceUUID` + `Signature(UUID, PrivateKey)` to the API.
    *   **Identity**: The server uses the `PublicKey` as the primary identifier. The UUID is only used for initial rate-limiting (preventing bot-registrations) and simple device management.
    *   **Key Management**: Keys never leave the device. If the user deletes the app, they lose access to that "identity" (perfect for zero-setup privacy).

### 1.2 Encryption Standards
*   **Protocol**: **WireGuard** (ChaCha20-Poly1305). This is non-negotiable for performance and security.
*   **Handshake**: Curve25519 for key exchange.
*   **Post-Quantum Resistance**: Optional use of **WireGuard PSK (Pre-Shared Key)** for an additional layer of protection against future quantum threats.

### 1.3 RAM-Only Node Implementation (The "Vapor-Lock" Strategy)
To ENSURE no data persists, the nodes must be "Stateless by Design."

*   **OS Architecture**: Use a minimal **Alpine Linux** or **Talos Linux** image.
*   **Boot Process**: Boot via **iPXE** directly into RAM. The root filesystem (`/`) is a read-only **SquashFS** image.
*   **Persistence Prevention**:
    *   `/var/log` and `/tmp` are mounted as `tmpfs` (RAM-based, wiped on reboot).
    *   `syslog` and `dmesg` are disabled or piped to `/dev/null`.
    *   **No Swap**: Disable swap partitions to prevent data being written to disk.
    *   **Remote Attestation**: Use a hash of the running kernel/initramfs to verify the server hasn't been tampered with.

---

## 2. "No Logs" Policy & Verifiability

### 2.1 Technical Verifiability
Users shouldn't have to "trust" a promise. We provide "Technical Proof."

*   **Reproducible Builds**: All server-side images (the SquashFS files) are built via GitHub Actions with public logs. Users can verify that the hash of the image running on the server matches the hash of the open-source code.
*   **Public Checksums**: A public `/status` endpoint on each node displays the `sha256` hash of the current running OS image.
*   **Third-Party Attestations**: Periodically invite security researchers to "Try to find a log" on a live test node.

### 2.2 Technical "No-Logs" Protocol (The Audit Checklist)
1.  **Diskless**: `lsblk` shows 0 physical disks mounted.
2.  **Null-Logging**: `ls -l /var/log` shows symlinks to `/dev/null`.
3.  **Command History**: `HISTFILE` is set to `/dev/null` for all shells.
4.  **WireGuard Stats**: `wg show all dump` is never called or logged; bandwidth counters are only held in volatile memory for active session management.

---

## 3. Abuse Prevention & Vibe-Safety

### 3.1 Non-Intrusive Mitigation
We must protect the network without becoming a "Middleman."

*   **Port Blocking (Egress)**:
    *   **SMTP (25, 465, 587)**: Blocked by default to prevent the VPN from being used as a Spam-bot.
    *   **SSH (22)**: Optional blocking or rate-limiting to prevent brute-force attacks.
*   **Rate Limiting (eBPF/nftables)**:
    *   Implement per-IP/per-Key rate limits using **nftables** maps. This happens at the kernel level and does not involve packet inspection.
*   **CrowdSec Integration**:
    *   Install the **CrowdSec Firewall Bouncer**. It automatically pulls lists of "Bad IPs" (scanners, attackers) and blocks them at the node's edge. This is "Community-Powered Defense."

### 3.2 Handling DMCA & Legal Requests
*   **The "I Have No Mouth" Defense**: Since the nodes are RAM-only and logs are piped to `/dev/null`, there is technically no data to hand over. 
*   **Transparency**: Publish all requests in a **Transparency Report**.
*   **Warrant Canary**: A simple, regularly updated statement: "As of [Date], we have received 0 secret warrants." If it disappears, users know the system is compromised.

---

## 4. Building Trust: The Transparency Framework

### 4.1 Communication Strategy
*   **The "Why it's Free" Page**: Clearly explain the business model (Donations, Freemium, or minimal ads). Transparency about costs builds more trust than "Magic."
*   **Vibe-Safety Labels**: Use clean, human-centric UI labels like *"Private by Code, Not just by Promise."*

### 4.2 Open-Source Roadmap
*   **Phase 1**: Open-source the Flutter Client (High user trust).
*   **Phase 2**: Open-source the Node Deployment Scripts (Docker/Ansible/Dracut).
*   **Phase 3**: Open-source the Backend API (Full transparency).

---

## 🚀 Summary of Recommendations

| Action | Priority | Vibe-Impact |
| :--- | :--- | :--- |
| **Cryptographic Registration** | Critical | Prevents account hijacking without passwords. |
| **RAM-Only OS Image** | Critical | Physical proof of "No-Logs." |
| **Port 25 Blocking** | High | Prevents server IP blacklisting (Spam). |
| **Warrant Canary** | Medium | Legal "Early Warning System" for users. |
| **Reproducible Builds** | Medium | Proves the code you see is the code we run. |

---
**Audit performed by AI Architecture Sentinel**  
*Building Secure Vibes, One Tap at a Time.*
