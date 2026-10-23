package tunnel

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetchConfigFromAPI(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/nodes" {
			resp := map[string]interface{}{
				"nodes": []map[string]interface{}{
					{
						"id":           "node-1",
						"name":         "US Fast 1",
						"endpoint":     "123.45.67.89:51820",
						"public_key":   "dGhpcy1pcy1hLW1vY2stcHVibGljLWtleS0zMmJ5dGVzCg==",
						"country":      "US",
						"load_percent": 25,
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}
		if r.URL.Path == "/session/connect" {
			resp := map[string]interface{}{
				"session_id":         "sess-123",
				"assigned_ip":        "10.8.0.2/32",
				"client_private_key": "",
				"client_public_key":  "",
				"server_public_key":  "dGhpcy1pcy1hLW1vY2stcHVibGljLWtleS0zMmJ5dGVzCg==",
				"endpoint":           "123.45.67.89:51820",
				"preshared_key":      "",
				"allowed_ips":        "0.0.0.0/0",
				"dns":                "1.1.1.1",
				"mtu":                1420,
			}
			json.NewEncoder(w).Encode(resp)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer ts.Close()

	cfg, err := FetchConfigFromAPI(ts.URL, "test-device-uuid-12345")
	if err != nil {
		t.Fatalf("FetchConfigFromAPI failed: %v", err)
	}

	if cfg.Endpoint != "123.45.67.89:51820" {
		t.Errorf("expected endpoint 123.45.67.89:51820, got %s", cfg.Endpoint)
	}
	if cfg.AssignedIP != "10.8.0.2/32" {
		t.Errorf("expected assigned IP 10.8.0.2/32, got %s", cfg.AssignedIP)
	}
	if cfg.PrivateKey == "" {
		t.Errorf("expected generated private key, got empty")
	}
}
