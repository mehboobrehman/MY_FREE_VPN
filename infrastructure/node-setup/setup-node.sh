#!/bin/sh

# Alpine Linux RAM-only (Diskless) Node Setup
# This script is intended to be run during the boot process (e.g., via local.d or custom init)

set -e

echo "Starting RAM-only VPN node setup..."

# 1. Update package index and install WireGuard
apk update
apk add wireguard-tools iptables

# 2. Configure WireGuard
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

# Generate server keypair if not exists (in RAM)
if [ ! -f /etc/wireguard/private.key ]; then
    wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key
fi

PRIVATE_KEY=$(cat /etc/wireguard/private.key)

# Create initial wg0 config
cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
PrivateKey = $PRIVATE_KEY
ListenPort = 51820
# Internal IP range for clients
Address = 10.0.0.1/24

# PostUp/PostDown for NAT
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
EOF

# 3. Enable IP Forwarding
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sysctl -p

# 4. Start WireGuard
wg-quick up wg0

# 5. Redirect all logs to /dev/null to ensure "No-Logs" policy
# Disable syslog/klogd or redirect their output
if [ -f /etc/init.d/syslog ]; then
    /etc/init.d/syslog stop
    rc-update del syslog default || true
fi

# Ensure /var/log is a tmpfs (usually is in diskless Alpine)
mount -t tmpfs -o size=1M tmpfs /var/log

echo "RAM-only VPN node setup complete."
