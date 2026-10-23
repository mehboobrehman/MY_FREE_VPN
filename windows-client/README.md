# MY_FREE_VPN Windows 'No-Admin' Client

The **MY_FREE_VPN Windows Client** is engineered specifically to provide secure, encrypted lifetime free VPN protection on Windows **without requiring administrator privileges**, **without installing WinTUN/TAP drivers**, and **without registry modifications or service installations**.

## The 'No-Admin' Guarantee

Traditional Windows VPN clients require administrator rights because they create OS-level kernel virtual network adapters (such as WinTUN or TAP-Windows) and manipulate system routing tables via `netsh` or PowerShell service manager.

**MY_FREE_VPN takes a completely modern, zero-privilege userspace approach:**
1. **Userspace WireGuard (netstack)**: We embed `wireguard-go` coupled with gVisor's userspace TCP/IP networking stack (`netstack`). The entire VPN packet encapsulation and IP stack runs inside unprivileged application ring-3 memory.
2. **Local Proxies**: Instead of forcing a system-wide TUN/TAP default gateway (which requires admin rights), the client spins up high-performance local proxy endpoints:
   - **SOCKS5 Proxy** (Default: `127.0.0.1:1080`)
   - **HTTP CONNECT Proxy** (Default: `127.0.0.1:8080`)
3. Applications configured to use the local SOCKS5 or HTTP proxy route their traffic securely through the WireGuard tunnel without touching system routing tables or network adapters.

## Architecture & Modules

- `proxy/`: High-performance SOCKS5 (RFC 1928) and HTTP CONNECT proxy servers.
- `tunnel/`: Userspace WireGuard device initialization, `netstack` IP routing, and API integration adhering strictly to `contracts/api-spec.yaml`.
- `main.go`: CLI entrypoint supporting configurable proxy ports and device UUID authentication.

## Quick Start & Usage

### Build
```bash
go build -o my-free-vpn.exe main.go
```

### Run
```bash
./my-free-vpn.exe -socks 127.0.0.1:1080 -http 127.0.0.1:8080 -api https://api.myfreevpn.example/v1
```
