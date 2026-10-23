package proxy

import (
	"encoding/binary"
	"io"
	"net"
	"strconv"
)

// SOCKS5Server implements a local SOCKS5 proxy server (RFC 1928).
type SOCKS5Server struct {
	Addr     string
	listener net.Listener
	closed   bool
}

func NewSOCKS5Server(addr string) *SOCKS5Server {
	return &SOCKS5Server{Addr: addr}
}

func (s *SOCKS5Server) Start(dialer func(network, addr string) (net.Conn, error)) error {
	var err error
	s.listener, err = net.Listen("tcp", s.Addr)
	if err != nil {
		return err
	}
	go func() {
		for {
			conn, err := s.listener.Accept()
			if err != nil {
				if s.closed {
					return
				}
				continue
			}
			go s.handleConnection(conn, dialer)
		}
	}()
	return nil
}

func (s *SOCKS5Server) Close() error {
	s.closed = true
	if s.listener != nil {
		return s.listener.Close()
	}
	return nil
}

func (s *SOCKS5Server) handleConnection(client net.Conn, dialer func(network, addr string) (net.Conn, error)) {
	defer client.Close()

	// 1. Greeting
	buf := make([]byte, 256)
	if _, err := io.ReadFull(client, buf[:2]); err != nil {
		return
	}
	if buf[0] != 0x05 {
		return // Not SOCKS5
	}
	nMethods := int(buf[1])
	if _, err := io.ReadFull(client, buf[:nMethods]); err != nil {
		return
	}

	// Respond: No auth required (0x00)
	if _, err := client.Write([]byte{0x05, 0x00}); err != nil {
		return
	}

	// 2. Request
	if _, err := io.ReadFull(client, buf[:4]); err != nil {
		return
	}
	ver, cmd, _, atyp := buf[0], buf[1], buf[2], buf[3]
	if ver != 0x05 || cmd != 0x01 { // Only CONNECT command (0x01) supported
		client.Write([]byte{0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0}) // Command not supported
		return
	}

	var targetAddr string
	switch atyp {
	case 0x01: // IPv4
		if _, err := io.ReadFull(client, buf[:4]); err != nil {
			return
		}
		ip := net.IP(buf[:4]).String()
		if _, err := io.ReadFull(client, buf[:2]); err != nil {
			return
		}
		port := binary.BigEndian.Uint16(buf[:2])
		targetAddr = net.JoinHostPort(ip, strconv.Itoa(int(port)))

	case 0x03: // Domain name
		if _, err := io.ReadFull(client, buf[:1]); err != nil {
			return
		}
		domainLen := int(buf[0])
		if _, err := io.ReadFull(client, buf[:domainLen]); err != nil {
			return
		}
		domain := string(buf[:domainLen])
		if _, err := io.ReadFull(client, buf[:2]); err != nil {
			return
		}
		port := binary.BigEndian.Uint16(buf[:2])
		targetAddr = net.JoinHostPort(domain, strconv.Itoa(int(port)))

	case 0x04: // IPv6
		if _, err := io.ReadFull(client, buf[:16]); err != nil {
			return
		}
		ip := net.IP(buf[:16]).String()
		if _, err := io.ReadFull(client, buf[:2]); err != nil {
			return
		}
		port := binary.BigEndian.Uint16(buf[:2])
		targetAddr = net.JoinHostPort(ip, strconv.Itoa(int(port)))

	default:
		client.Write([]byte{0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0}) // Address type not supported
		return
	}

	// Connect to target via dialer (e.g. netstack / WireGuard tunnel)
	target, err := dialer("tcp", targetAddr)
	if err != nil {
		client.Write([]byte{0x05, 0x04, 0x00, 0x01, 0, 0, 0, 0, 0, 0}) // Host unreachable
		return
	}
	defer target.Close()

	// Reply success
	// VER REP RSV ATYP BND.ADDR BND.PORT
	client.Write([]byte{0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0})

	// Relay data bidirectionally
	errChan := make(chan error, 2)
	go func() {
		_, err := io.Copy(target, client)
		errChan <- err
	}()
	go func() {
		_, err := io.Copy(client, target)
		errChan <- err
	}()
	<-errChan
}
