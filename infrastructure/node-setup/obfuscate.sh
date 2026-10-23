#!/bin/sh

# Shadowsocks / V2Ray / WebSocket Obfuscation Wrapper for Restricted Networks
# Wraps WireGuard or provides fallback proxy in strict DPI environments

set -e

echo "Initializing obfuscation layer (Shadowsocks/V2Ray/WebSocket fallback)..."

OBFUSCATION_MODE="${OBFUSCATION_MODE:-shadowsocks}"
PORT="${OBFUSCATION_PORT:-8388}"
SERVER_IP="${SERVER_IP:-0.0.0.0}"
PASSWORD="${OBFUSCATION_PASSWORD:-myfreevpnsecurekey}"

if [ "$OBFUSCATION_MODE" = "shadowsocks" ]; then
    echo "Starting Shadowsocks-libev server on $SERVER_IP:$PORT..."
    if command -v ss-server >/dev/null 2>&1; then
        ss-server -s "$SERVER_IP" -p "$PORT" -k "$PASSWORD" -m chacha20-ietf-poly1305 --fast-open -u &
        echo "Shadowsocks server started successfully."
    else
        echo "Warning: ss-server not found in PATH. Simulating obfuscation tunnel on port $PORT..."
    fi
elif [ "$OBFUSCATION_MODE" = "v2ray" ]; then
    echo "Starting V2Ray WebSocket/TLS obfuscation wrapper..."
    if command -v v2ray >/dev/null 2>&1; then
        v2ray -config /etc/v2ray/config.json &
        echo "V2Ray obfuscation wrapper started successfully."
    else
        echo "Warning: v2ray not found in PATH. Simulating V2Ray WebSocket proxy..."
    fi
else
    echo "Unknown obfuscation mode: $OBFUSCATION_MODE. Defaulting to direct WireGuard."
fi
