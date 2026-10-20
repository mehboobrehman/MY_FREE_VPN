# MY_FREE_VPN Shared Contracts & Data Models

This document and the associated files in `contracts/` define the official API contracts, data models, and communication protocols between the **Flutter Client (Android/Windows)**, **Backend API (Go)**, and **VPN Exit Nodes (WireGuard)**.

---

## 1. Directory Structure

```
contracts/
├── api-spec.yaml          # OpenAPI 3.0 specification for Backend API
├── models.json            # JSON Schema definitions for core data models
└── types.dart             # Dart type definitions / models for Flutter client
```

---

## 2. Core Data Models

### 2.1 Device Registration & Authentication (`DeviceRegistration`)
Used when a client first launches or re-registers. No PII (no email/password) is required.
*   `device_uuid` (string, UUIDv4): Unique installation identifier generated locally.
*   `public_key` (string, Base64 WireGuard Public Key): Client's WireGuard public key.
*   `signature` (string, Base64): Cryptographic signature of `device_uuid` signed by the client's WireGuard private key, proving possession of the private key.
*   `platform` (string): `android` or `windows`.
*   `app_version` (string): Client app version.

### 2.2 VPN Node (`VpnNode`)
Represents an exit node available for connection.
*   `node_id` (string, UUID): Unique node identifier.
*   `country_code` (string, ISO 3166-1 alpha-2): e.g., `SG`, `DE`, `US`.
*   `city` (string): City name.
*   `endpoint_ip` (string): Public IP address of the WireGuard node.
*   `endpoint_port` (integer): WireGuard listening port (default `51820`).
*   `public_key` (string, Base64): Server WireGuard public key.
*   `current_load_percent` (integer): 0-100 load metric.
*   `ping_ms` (integer, optional): Latency from client to node.

### 2.3 Connection Config Response (`ConnectionConfig`)
Returned by the backend when a client requests a connection to a node.
*   `session_token` (string): Ephemeral session token.
*   `client_ip` (string): Assigned internal VPN IP address within the WireGuard subnet (e.g., `10.8.0.2/32`).
*   `server_endpoint` (string): `IP:Port` of the chosen exit node.
*   `server_public_key` (string, Base64): Server public key.
*   `allowed_ips` (array of strings): Routing rules (e.g., `["0.0.0.0/0", "::/0"]`).
*   `dns_servers` (array of strings): DNS resolver IPs (e.g., `["1.1.1.1", "8.8.8.8"]`).
*   `persistent_keepalive` (integer): Keepalive interval in seconds (default `25`).

---

## 3. API Endpoints Overview

1.  `POST /api/v1/auth/register` — Register device keypair.
2.  `GET /api/v1/nodes` — List available exit nodes with load metrics.
3.  `POST /api/v1/session/connect` — Request connection configuration for a node.
4.  `POST /api/v1/session/disconnect` — Notify graceful session termination.
5.  `GET /api/v1/status` — Health check and server status.
