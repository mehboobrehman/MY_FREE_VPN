package proxy

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
)

// HTTPServer implements a local HTTP CONNECT proxy server.
type HTTPServer struct {
	Addr     string
	listener net.Listener
	closed   bool
}

func NewHTTPServer(addr string) *HTTPServer {
	return &HTTPServer{Addr: addr}
}

func (s *HTTPServer) Start(dialer func(network, addr string) (net.Conn, error)) error {
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

func (s *HTTPServer) Close() error {
	s.closed = true
	if s.listener != nil {
		return s.listener.Close()
	}
	return nil
}

func (s *HTTPServer) handleConnection(client net.Conn, dialer func(network, addr string) (net.Conn, error)) {
	defer client.Close()

	reader := bufio.NewReader(client)
	req, err := http.ReadRequest(reader)
	if err != nil {
		return
	}

	if req.Method != http.MethodConnect {
		resp := &http.Response{
			StatusCode: http.StatusMethodNotAllowed,
			ProtoMajor: 1,
			ProtoMinor: 1,
			Body:       io.NopCloser(strings.NewReader("Method Not Allowed. Only CONNECT is supported.")),
		}
		resp.Write(client)
		return
	}

	targetAddr := req.Host
	if !strings.Contains(targetAddr, ":") {
		targetAddr = net.JoinHostPort(targetAddr, "80")
	}

	target, err := dialer("tcp", targetAddr)
	if err != nil {
		resp := &http.Response{
			StatusCode: http.StatusBadGateway,
			ProtoMajor: 1,
			ProtoMinor: 1,
			Body:       io.NopCloser(strings.NewReader(fmt.Sprintf("Bad Gateway: %v", err))),
		}
		resp.Write(client)
		return
	}
	defer target.Close()

	// Send 200 Connection Established to client
	_, err = client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))
	if err != nil {
		return
	}

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
