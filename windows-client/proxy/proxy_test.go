package proxy

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"strings"
	"testing"
	"time"
)

func TestSOCKS5Server(t *testing.T) {
	// Mock backend dialer that echoes or connects to a test listener
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to start test target: %v", err)
	}
	defer l.Close()

	go func() {
		conn, err := l.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		io.Copy(conn, conn) // Echo
	}()

	proxy := NewSOCKS5Server("127.0.0.1:0")
	err = proxy.Start(func(network, addr string) (net.Conn, error) {
		return net.Dial(network, l.Addr().String())
	})
	if err != nil {
		t.Fatalf("failed to start SOCKS5 proxy: %v", err)
	}
	defer proxy.Close()

	// Connect to SOCKS5 proxy
	cc, err := net.Dial("tcp", proxy.listener.Addr().String())
	if err != nil {
		t.Fatalf("failed to connect to proxy: %v", err)
	}
	defer cc.Close()

	// 1. Handshake: VER=5, NMETHODS=1, METHODS=[0]
	cc.Write([]byte{0x05, 0x01, 0x00})
	resp := make([]byte, 2)
	if _, err := io.ReadFull(cc, resp); err != nil {
		t.Fatalf("failed to read handshake response: %v", err)
	}
	if resp[0] != 0x05 || resp[1] != 0x00 {
		t.Fatalf("invalid SOCKS5 handshake response: %x", resp)
	}

	// 2. Request CONNECT to target (IPv4: 127.0.0.1 + port)
	// VER=5, CMD=1 (CONNECT), RSV=0, ATYP=1 (IPv4), IP(4 bytes), PORT(2 bytes)
	targetTCPAddr := l.Addr().(*net.TCPAddr)
	req := []byte{0x05, 0x01, 0x00, 0x01}
	req = append(req, targetTCPAddr.IP.To4()...)
	portBytes := make([]byte, 2)
	// big endian port
	portBytes[0] = byte(targetTCPAddr.Port >> 8)
	portBytes[1] = byte(targetTCPAddr.Port & 0xff)
	req = append(req, portBytes...)

	if _, err := cc.Write(req); err != nil {
		t.Fatalf("failed to send SOCKS5 request: %v", err)
	}

	reply := make([]byte, 10)
	if _, err := io.ReadFull(cc, reply); err != nil {
		t.Fatalf("failed to read SOCKS5 reply: %v", err)
	}
	if reply[1] != 0x00 {
		t.Fatalf("SOCKS5 connect failed with reply code: %d", reply[1])
	}

	// Test data transfer
	_, err = cc.Write([]byte("hello socks5"))
	if err != nil {
		t.Fatalf("failed to write data through socks5: %v", err)
	}

	buf := make([]byte, 12)
	cc.SetReadDeadline(time.Now().Add(2 * time.Second))
	if _, err := io.ReadFull(cc, buf); err != nil {
		t.Fatalf("failed to read echoed data: %v", err)
	}
	if string(buf) != "hello socks5" {
		t.Fatalf("expected 'hello socks5', got '%s'", string(buf))
	}
}

func TestHTTPServer(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to start test target: %v", err)
	}
	defer l.Close()

	go func() {
		conn, err := l.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		io.Copy(conn, conn)
	}()

	proxy := NewHTTPServer("127.0.0.1:0")
	err = proxy.Start(func(network, addr string) (net.Conn, error) {
		return net.Dial(network, l.Addr().String())
	})
	if err != nil {
		t.Fatalf("failed to start HTTP proxy: %v", err)
	}
	defer proxy.Close()

	cc, err := net.Dial("tcp", proxy.listener.Addr().String())
	if err != nil {
		t.Fatalf("failed to connect to proxy: %v", err)
	}
	defer cc.Close()

	connectReq := fmt.Sprintf("CONNECT %s HTTP/1.1\r\nHost: %s\r\n\r\n", l.Addr().String(), l.Addr().String())
	if _, err := cc.Write([]byte(connectReq)); err != nil {
		t.Fatalf("failed to send CONNECT request: %v", err)
	}

	reader := bufio.NewReader(cc)
	statusLine, err := reader.ReadString('\n')
	if err != nil {
		t.Fatalf("failed to read CONNECT response: %v", err)
	}
	if !strings.Contains(statusLine, "200 Connection Established") {
		t.Fatalf("expected 200 Connection Established, got: %s", statusLine)
	}

	// Read remaining headers until blank line
	for {
		line, err := reader.ReadString('\n')
		if err != nil || line == "\r\n" || line == "\n" {
			break
		}
	}

	// Test data transfer
	_, err = cc.Write([]byte("hello http connect"))
	if err != nil {
		t.Fatalf("failed to write data: %v", err)
	}

	buf := make([]byte, 18)
	cc.SetReadDeadline(time.Now().Add(2 * time.Second))
	if _, err := io.ReadFull(cc, buf); err != nil {
		t.Fatalf("failed to read echoed data: %v", err)
	}
	if string(buf) != "hello http connect" {
		t.Fatalf("expected 'hello http connect', got '%s'", string(buf))
	}
}
