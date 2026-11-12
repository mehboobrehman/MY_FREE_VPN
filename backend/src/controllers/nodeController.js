const { vpnNodes, nodePeers, allocateIp } = require('../models/store');

async function getNodes(req, res) {
  const { country, streaming, smart_dns } = req.query;
  let nodes = Array.from(vpnNodes.values());

  if (country) {
    const upperCountry = country.toUpperCase();
    nodes = nodes.filter(n => n.country_code === upperCountry);
  }

  if (streaming === 'true') {
    nodes = nodes.filter(n => n.is_streaming === true);
  }

  if (smart_dns === 'true') {
    nodes = nodes.filter(n => n.smart_dns_enabled === true);
  }

  return res.status(200).json({
    nodes
  });
}

function provisionPeer(node_id, device_uuid, client_public_key) {
  if (!vpnNodes.has(node_id)) {
    throw new Error('Node not found');
  }
  
  if (!nodePeers.has(node_id)) {
    nodePeers.set(node_id, new Map());
  }

  const client_ip = allocateIp();
  const peerInfo = {
    client_ip,
    device_uuid,
    added_at: Date.now()
  };

  nodePeers.get(node_id).set(client_public_key, peerInfo);
  
  // Simulate wg set command
  console.log(`[WG SIMULATION] wg set wg0 peer ${client_public_key} allowed-ips ${client_ip}/32`);
  
  return { client_ip };
}

module.exports = {
  getNodes,
  provisionPeer
};
