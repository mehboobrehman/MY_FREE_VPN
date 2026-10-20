# Architectural Decisions (DECISIONS.md)

This document tracks all core architectural, design, data model, and API contract decisions for **MY_FREE_VPN**.

---

## 1. Project Overview & Scope
- **Project**: MY_FREE_VPN (Lifetime Free VPN for Android & Windows with Zero Setup)
- **Tech Stack**:
  - **Client**: Flutter (Cross-platform Android & Windows, `VpnService` + `WinTUN`, Dart FFI / WireGuard-Go).
  - **Backend API**: Go (REST / gRPC / JSON over HTTPS, lightweight, highly concurrent, deployed on serverless/containers).
  - **Database & Storage**: Supabase (PostgreSQL) / Lightweight SQLite for nodes and metadata (RAM-only ephemeral session state, zero PII).
  - **VPN Protocol**: WireGuard (ChaCha20-Poly1305, Curve25519) with optional PSK.

---

## 2. Decision Log

### 2.1 Protocol Selection: WireGuard
- **Title**: Use WireGuard as primary VPN protocol
- **Rationale**: 4,000 lines of code vs 70,000+ for OpenVPN. Exceptional performance, fast handshakes, low battery usage on mobile, and native kernel support.
- **Impact**: Client apps and backend nodes must manage WireGuard public/private key pairs and peer configurations.

### 2.2 Auth Strategy: Device UUID + Cryptographic Key Binding
- **Title**: Zero-Signup Device Authentication via Cryptographic Key Binding
- **Rationale**: "Zero Setup" means no emails, passwords, or KYC for standard free tier. To prevent spoofing and unauthorized bandwidth consumption, the client generates a local WireGuard keypair and signs its Device UUID with the private key upon registration.
- **Impact**: Backend stores public keys and device UUID mappings without collecting PII (GDPR / privacy compliant).

### 2.3 Data Models & Contracts
- **Title**: Strict Shared Data Contracts (`contracts/`)
- **Rationale**: Frontend and backend agents must adhere to strict shared interface definitions for API payloads, node registration, session management, and configuration responses.
- **Impact**: Located in `contracts/` directory (JSON Schema, OpenAPI, TypeScript/Dart type definitions, or structured markdown specifications).

### 2.4 Infrastructure & No-Logs Architecture
- **Title**: RAM-Only Ephemeral Exit Nodes
- **Rationale**: Physical proof of "No-Logs" policy. Nodes run in RAM (tmpfs/SquashFS), logs piped to `/dev/null`, and zero persistent storage of traffic metadata.
- **Impact**: Automated deployment scripts (Ansible/Docker) must enforce RAM-only mounts and null logging.

## Establish Shared Data Models and API Contracts
**When**: 2026-10-20 16:25:21

Established standardized shared data contracts and API specifications for MY_FREE_VPN to ensure seamless cross-layer communication.

**Impact**: All agents (Frontend, Backend, DevOps, Client) referencing data models and API contracts
