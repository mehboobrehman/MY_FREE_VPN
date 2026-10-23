FROM alpine:3.18

LABEL maintainer="support@myfreevpn.net"
LABEL description="MY_FREE_VPN RAM-Only Immutable Node Image with WireGuard & Shadowsocks Obfuscation"

# Install WireGuard tools, iptables, shadowsocks-libev, curl, bash
RUN apk add --no-cache \
    wireguard-tools \
    iptables \
    iproute2 \
    shadowsocks-libev \
    v2ray \
    curl \
    bash \
    tzdata

# Create secure directories for RAM-only tmpfs mounts
RUN mkdir -p /etc/wireguard /var/run/wireguard /etc/v2ray

# Copy node setup and obfuscation scripts
COPY setup-node.sh /usr/local/bin/setup-node.sh
COPY obfuscate.sh /usr/local/bin/obfuscate.sh
RUN chmod +x /usr/local/bin/setup-node.sh /usr/local/bin/obfuscate.sh

# Expose WireGuard and Obfuscation ports
EXPOSE 51820/udp
EXPOSE 8388/tcp
EXPOSE 8388/udp

# Entrypoint for RAM-only initialization and obfuscation start
ENTRYPOINT ["/usr/local/bin/setup-node.sh"]
