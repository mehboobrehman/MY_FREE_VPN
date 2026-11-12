const { vpnNodes, registeredDevices, activeSessions } = require('../models/store');
const { provisionPeer } = require('./nodeController');
const { v4: uuidv4 } = require('uuid');

async function connectSession(req, res) {
  const { device_uuid, node_id } = req.body;

  if (!device_uuid || !node_id) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'device_uuid and node_id are required.'
    });
  }

  // Verify device is registered and retrieve public_key
  const device = registeredDevices.get(device_uuid);
  if (!device) {
    return res.status(400).json({
      error: 'UNREGISTERED_DEVICE',
      message: 'This device is not registered. Please register first.'
    });
  }
  const public_key = device.public_key;

  // Verify node exists
  const node = vpnNodes.get(node_id);
  if (!node) {
    return res.status(400).json({
      error: 'INVALID_NODE',
      message: 'The requested VPN node does not exist.'
    });
  }

  // Provision peer and assign deterministic/managed IPAM IP (10.8.0.x)
  let provisionResult;
  try {
    provisionResult = provisionPeer(node_id, device_uuid, public_key);
  } catch (err) {
    return res.status(400).json({
      error: 'PROVISION_FAILED',
      message: err.message || 'Failed to provision peer.'
    });
  }

  const client_ip = `${provisionResult.client_ip}/32`;
  const session_token = uuidv4();

  const config = {
    session_token,
    client_ip,
    server_endpoint: `${node.endpoint_ip}:${node.endpoint_port}`,
    server_public_key: node.public_key,
    allowed_ips: ["0.0.0.0/0", "::/0"],
    dns_servers: ["1.1.1.1", "8.8.8.8"],
    persistent_keepalive: 25
  };

  // Track session
  activeSessions.set(session_token, {
    device_uuid,
    node_id,
    client_ip,
    started_at: Date.now()
  });

  return res.status(200).json(config);
}

async function disconnectSession(req, res) {
  const { device_uuid, session_token } = req.body;

  if (!device_uuid || !session_token) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'device_uuid and session_token are required.'
    });
  }

  const session = activeSessions.get(session_token);
  if (!session || session.device_uuid !== device_uuid) {
    return res.status(400).json({
      error: 'INVALID_SESSION',
      message: 'Session token is invalid or does not belong to this device.'
    });
  }

  // Release session
  activeSessions.delete(session_token);

  return res.status(200).json({
    status: 'disconnected'
  });
}

module.exports = {
  connectSession,
  disconnectSession
};
