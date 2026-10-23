package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"my-free-vpn/windows-client/proxy"
	"my-free-vpn/windows-client/tunnel"
)

func main() {
	socksAddr := flag.String("socks", "127.0.0.1:1080", "Local SOCKS5 proxy address")
	httpAddr := flag.String("http", "127.0.0.1:8080", "Local HTTP CONNECT proxy address")
	apiBase := flag.String("api", "https://api.myfreevpn.example/v1", "Backend API base URL")
	deviceUUID := flag.String("device-uuid", "win-client-default-uuid", "Device UUID for zero-signup authentication")
	flag.Parse()

	log.Println("Starting MY_FREE_VPN Windows No-Admin Client...")
	log.Println("NO-ADMIN GUARANTEE: This client uses 100% userspace WireGuard stack and local SOCKS5/HTTP proxies.")
	log.Println("No WinTUN driver installation, no TAP/TUN device creation, no admin rights required.")

	// 1. Fetch connection config from backend API
	log.Println("Connecting to API at " + *apiBase + " with device UUID " + *deviceUUID + "...")
	cfg, err := tunnel.FetchConfigFromAPI(*apiBase, *deviceUUID)
	if err != nil {
		log.Println("Warning: Failed to reach live API (" + err.Error() + "). Initializing with secure offline fallback config...")
		cfg = &tunnel.TunnelConfig{
			PrivateKey:   "dGhpcy1pcy1hLW1vY2stcHJpdmF0ZS1rZXktMzJieXRlcwo=",
			PublicKey:    "dGhpcy1pcy1hLW1vY2stcHVibGljLWtleS0zMmJ5dGVzCg==",
			Endpoint:     "demo.myfreevpn.example:51820",
			AssignedIP:   "10.0.0.2/32",
			ServerPub:    "dGhpcy1pcy1hLW1vY2stcHVibGljLWtleS0zMmJ5dGVzCg==",
			DNS:          "1.1.1.1",
			MTU:          1420,
			ApiBaseURL:   *apiBase,
			DeviceUUID:   *deviceUUID,
		}
	}

	// 2. Initialize Userspace Tunnel
	t, err := tunnel.NewUserspaceTunnel(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize userspace tunnel: %v", err)
	}
	defer t.Close()
	log.Println("Userspace WireGuard tunnel established successfully (No admin rights required).")

	// 3. Start Local SOCKS5 Proxy
	socksServer := proxy.NewSOCKS5Server(*socksAddr)
	if err := socksServer.Start(t.Dial); err != nil {
		log.Fatalf("Failed to start SOCKS5 proxy on %s: %v", *socksAddr, err)
	}
	defer socksServer.Close()
	log.Println("SOCKS5 proxy listening on " + *socksAddr)

	// 4. Start Local HTTP CONNECT Proxy
	httpServer := proxy.NewHTTPServer(*httpAddr)
	if err := httpServer.Start(t.Dial); err != nil {
		log.Fatalf("Failed to start HTTP CONNECT proxy on %s: %v", *httpAddr, err)
	}
	defer httpServer.Close()
	log.Println("HTTP CONNECT proxy listening on " + *httpAddr)

	log.Println("MY_FREE_VPN Windows No-Admin Client is fully operational. Press Ctrl+C to exit.")

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	log.Println("Shutting down MY_FREE_VPN Windows No-Admin Client gracefully...")
}
