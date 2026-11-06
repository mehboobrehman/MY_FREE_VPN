# Live Debug Telemetry Architecture & Developer Guide

## 1. Executive Summary & Philosophy

The **MY_FREE_VPN Live Debug Telemetry** system is an enterprise-grade, zero-PII, production-gated observability and diagnostic telemetry pipeline designed for Flutter (Android & Windows) clients and backend coordination nodes.

### What This Is and Is Not
- **This IS:** A secure, structured telemetry pipeline for capturing anonymized diagnostics, network request tracing, crash/ANR reporting, runtime logpoints, and device state inspections to aid developers and QA engineers in troubleshooting connectivity and performance issues.
- **This IS NOT:** An interactive debugger (such as GDB, LLDB, or Dart Observatory remote execution) capable of modifying memory state, injecting arbitrary code, or halting thread execution in production environments.

---

## 2. Architecture Diagram

```
+-------------------------------------------------------------------------+
|                         Flutter Client (Client App)                     |
|  +--------------------+   +-------------------+   +------------------+  |
|  | AgentLogger        |-->| SQLite Local Store|-->| Versioned JSON   |  |
|  | (Intercepts Logs)  |   | (Offline Buffer)  |   | Envelopes (v1.0) |  |
|  +--------------------+   +-------------------+   +--------+---------+  |
+------------------------------------------------------------|------------+
                                                             | HTTP POST / WS
                                                             v
+-------------------------------------------------------------------------+
|                  Backend API & Collector (Node.js / Express)            |
|  +-------------------------------------------------------------------+  |
|  | Strict Debug Gating Middleware (ENABLE_DEBUG_TELEMETRY=true)      |  |
|  +---------------------------------+---------------------------------+  |
|                                    |                                    |
|         +--------------------------+--------------------------+         |
|         v                                                     v         |
|  +-----------------------------+               +---------------------+  |
|  | Ephemeral RAM Storage       |               | Persistent JSONL    |  |
|  | (In-Memory Ring Buffers)    |               | (/backend/data/)    |  |
|  +-----------------------------+               +----------------------+  |
+---------------------------------------|---------------------------------+
                                        v
+-------------------------------------------------------------------------+
|                     Developer Dashboard & Tooling                       |
|  +-------------------------------------------------------------------+  |
|  | developer-viewer/index.html (HAR Export, Replay, Logs, Metrics)   |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 3. Core Components

1. **Client Agent (`AgentLogger` & Interceptors)**:
   - Captures logs, network requests, state changes, and crashes.
   - Persists telemetry locally in SQLite (`my_free_vpn_telemetry.db`) when offline.
   - Batches and flushes versioned telemetry envelopes to the backend collector.

2. **Backend Telemetry Service (`backend/src/routes/telemetry.js`)**:
   - Ingests versioned JSON envelopes (`/api/v1/telemetry/events`).
   - Supports Endpoint Discovery (`/api/v1/telemetry/discovery`).
   - Manages session storage (`/api/v1/telemetry/sessions`), HAR/JSON export, and per-device debug configuration (`/api/v1/telemetry/config/:deviceId`).

3. **Strict Debug-Only Gating**:
   - Enforces `NODE_ENV === 'production' && ENABLE_DEBUG_TELEMETRY !== 'true'` checks, automatically returning `404 Not Found` for all telemetry routes in unconfigured production builds.

4. **Developer Viewer Dashboard (`developer-viewer/index.html`)**:
   - Real-time telemetry inspector, session replayer, network traffic HAR viewer, and log filter.

---

## 4. Quickstart Guide

### Quickstart: Single-Command Live Debug Telemetry
To start the backend, set up ADB, launch the viewer, install the debug app, and verify telemetry all in one go, use the following command:
```bash
npm run debug
```
This command executes the full Live Debug pipeline:
1.  Automatically starts the Telemetry Server (`backend/src/index.js` on port `48392`) if not already running.
2.  Initializes developer tooling, detects connected ADB devices, and establishes ADB port forwarding (`adb forward tcp:48392 tcp:48392`).
3.  Launches the Developer Viewer Dashboard (`http://localhost:48392/viewer`).
4.  Installs and launches the debug app on the connected ADB device/emulator (using `artifacts/MY_FREE_VPN_v1.1.18_debug.apk` or `client/build/app/outputs/flutter-apk/app-debug.apk`) and sends a test telemetry verification payload.

Alternatively, you can run the `live_debug.js` tool directly:
```bash
node tools/live_debug.js --all
```

### Step 3: Ingest Test Telemetry (Manual Verification)
If you need to manually ingest a test telemetry event after the full pipeline is running, use:
```bash
curl -X POST http://localhost:48392/api/v1/telemetry/events \\
  -H "Content-Type: application/json" \\
  -d '{
    "schema_version": "1.0.0",
    "session_id": "session-test-01",
    "device_id": "device-test-01",
    "sequence_number": 1,
    "monotonic_timestamp": 123.45,
    "wall_clock_timestamp": 1710000000000,
    "message_type": "vpn_connect",
    "payload": {
      "event_type": "vpn_connect",
      "nodeId": "node-sg-01",
      "bytesTransferred": 2048
    }
  }'

### Step 3: Ingest Test Telemetry
Send a sample telemetry envelope:
```bash
curl -X POST http://localhost:3000/api/v1/telemetry/events \
  -H "Content-Type: application/json" \
  -d '{
    "schema_version": "1.0.0",
    "session_id": "session-test-01",
    "device_id": "device-test-01",
    "sequence_number": 1,
    "monotonic_timestamp": 123.45,
    "wall_clock_timestamp": 1710000000000,
    "message_type": "vpn_connect",
    "payload": {
      "event_type": "vpn_connect",
      "nodeId": "node-sg-01",
      "bytesTransferred": 2048
    }
  }'
```

---

## 5. Protocol Specification

### Versioned Envelope Schema (`contracts/telemetry_envelope.json`)
Every telemetry message sent from client to backend must adhere to the versioned envelope specification:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TelemetryEnvelope",
  "type": "object",
  "properties": {
    "schema_version": { "type": "string", "default": "1.0.0" },
    "session_id": { "type": "string" },
    "device_id": { "type": "string" },
    "sequence_number": { "type": "integer" },
    "monotonic_timestamp": { "type": "number" },
    "wall_clock_timestamp": { "type": "integer" },
    "level": { "type": "string", "enum": ["info", "warn", "error", "debug"] },
    "tag": { "type": "string" },
    "message_type": { 
      "type": "string",
      "enum": [
        "vpn_connect", "vpn_disconnect", "state_inspection", "debugger_session",
        "runtime_logpoint", "trigger_snapshot", "crash", "anr", "network",
        "performance", "command_ack"
      ]
    },
    "payload": { "type": "object" }
  },
  "required": [
    "schema_version", "session_id", "device_id", "sequence_number",
    "monotonic_timestamp", "wall_clock_timestamp", "message_type", "payload"
  ]
}
```

### Supported API Endpoints
- `GET /api/v1/telemetry/discovery` — Returns available Local Wi-Fi and Cloud Relay endpoints.
- `POST /api/v1/telemetry/events` — Ingests single telemetry event or batched array of envelopes.
- `GET /api/v1/telemetry/sessions` — Lists recorded debug sessions with metadata and event type distribution.
- `GET /api/v1/telemetry/sessions/:id` — Retrieves events for a specific session with optional filtering (`?type=network&level=error&search=auth`).
- `GET /api/v1/telemetry/sessions/:id/export?format=json|har` — Exports session logs as raw JSON or HTTP Archive (HAR v1.2) for network inspection.
- `GET /api/v1/telemetry/config/:deviceId` — Fetches dynamic per-device debug configuration (log levels, enabled tags).
- `POST /api/v1/telemetry/config/:deviceId` — Updates per-device debug configuration.

---

## 6. Security Model & Privacy Guarantees

1. **Strict Debug Gating**:
   - In production builds (`NODE_ENV=production`), telemetry routes and agent debug UI are disabled by default unless explicitly unlocked via signed developer provisioning (`ENABLE_DEBUG_TELEMETRY=true`).
2. **Zero-PII Compliance**:
   - Telemetry payloads never log user credentials, private keys, WireGuard private keys, passwords, or personal identifying information.
3. **Automatic Redaction**:
   - HTTP request/response headers and bodies automatically redact sensitive keys (`Authorization`, `Cookie`, `X-API-Key`, `password`).
4. **RAM-Only Ephemeral Exit Nodes / Storage**:
   - Telemetry session logs stored on backend nodes can be configured for ephemeral in-memory storage or automatic TTL purging.

---

## 7. Troubleshooting Guide

- **Error 404 on Telemetry Endpoints**:
  - *Cause*: `NODE_ENV=production` is set without `ENABLE_DEBUG_TELEMETRY=true`.
  - *Solution*: Set environment variables appropriately in non-production test/staging environments.
- **ADB Port Forwarding Failure**:
  - *Cause*: ADB server not running or device not authorized.
  - *Solution*: Run `adb kill-server`, `adb start-server`, reconnect device, and re-run `node tools/live_debug.js`.
- **Missing Telemetry Events**:
  - *Cause*: Client offline queue buffering; events flush upon reconnection or manual sync.
  - *Solution*: Check SQLite local DB connection and network reachability of collector.
