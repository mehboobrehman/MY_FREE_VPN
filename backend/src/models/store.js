// In-memory ephemeral data store (No PII, RAM-only storage)
// In production, this would be backed by ephemeral Redis or in-memory DB with zero disk persistence.

const registeredDevices = new Map(); // device_uuid -> { public_key, platform, app_version, registered_at }
const vpnNodes = new Map(); // node_id -> node object
const activeSessions = new Map(); // session_token -> session object

// Seed initial default nodes (e.g. Singapore, Frankfurt, New York)
const defaultNodes = [
  {
    node_id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
    country_code: 'SG',
    city: 'Singapore',
    endpoint_ip: '195.201.0.1',
    endpoint_port: 51820,
    proxy_port: 1080,
    public_key: 'G+9v8k7L6m5n4o3p2q1r0s9t8u7v6w5x4y3z2A1B0C=',
    current_load_percent: 35,
    ping_ms: 45,
    is_streaming: false,
    smart_dns_enabled: false
  },
  {
    node_id: 'b2c3d4e5-f6a7-8901-bcde-f01234567890',
    country_code: 'DE',
    city: 'Frankfurt',
    endpoint_ip: '159.69.0.2',
    endpoint_port: 51820,
    public_key: 'H+0w9l8M7n6o5p4q3r2s1t0u9v8w7x6y5z4A3B2C1D=',
    current_load_percent: 50,
    ping_ms: 120,
    is_streaming: false,
    smart_dns_enabled: false
  },
  {
    node_id: 'c3d4e5f6-a7b8-9012-cdef-012345678901',
    country_code: 'US',
    city: 'New York',
    endpoint_ip: '138.201.0.3',
    endpoint_port: 51820,
    public_key: 'I+1x0m9N8o7p6q5r4s3t2u1v0w9x8y7z6A5B4C3D2E=',
    current_load_percent: 20,
    ping_ms: 85,
    is_streaming: false,
    smart_dns_enabled: false
  },
  {
    node_id: 'd4e5f6a7-b8c9-0123-defa-123456789012',
    country_code: 'US',
    city: 'US Streaming (Netflix/Hulu Optimized)',
    endpoint_ip: '138.201.0.4',
    endpoint_port: 51820,
    public_key: 'J+2y1n0O9p8q7r6s5t4u3v2w1x0y9z8A7B6C5D4E3F=',
    current_load_percent: 40,
    ping_ms: 70,
    is_streaming: true,
    smart_dns_enabled: true
  },
  {
    node_id: 'e5f6a7b8-c9d0-1234-efab-234567890123',
    country_code: 'GB',
    city: 'UK Streaming (BBC iPlayer Optimized)',
    endpoint_ip: '195.201.0.5',
    endpoint_port: 51820,
    public_key: 'K+3z2o1P0q9r8s7t6u5v4w3x2y1z0A9B8C7D6E5F4G=',
    current_load_percent: 45,
    ping_ms: 95,
    is_streaming: true,
    smart_dns_enabled: true
  }
];

defaultNodes.forEach(node => {
  vpnNodes.set(node.node_id, node);
});

module.exports = {
  registeredDevices,
  vpnNodes,
  activeSessions
};
