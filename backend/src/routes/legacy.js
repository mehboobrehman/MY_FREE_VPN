const express = require('express');
const router = express.Router();
const { registeredDevices } = require('../models/store');

// Legacy protocol configuration profiles (OpenVPN / PPTP)
router.post('/config', (req, res) => {
  const { device_uuid, protocol } = req.body;

  if (!device_uuid || !registeredDevices.has(device_uuid)) {
    return res.status(400).json({
      error: 'UNREGISTERED_DEVICE',
      message: 'Valid registered device_uuid is required for legacy protocol configuration.'
    });
  }

  const requestedProtocol = (protocol || 'openvpn').toLowerCase();

  if (!['openvpn', 'pptp'].includes(requestedProtocol)) {
    return res.status(400).json({
      error: 'INVALID_PROTOCOL',
      message: 'Supported legacy protocols are openvpn and pptp.'
    });
  }

  if (requestedProtocol === 'openvpn') {
    return res.status(200).json({
      protocol: 'openvpn',
      server_endpoint: 'vpn.myfreevpn.net:1194',
      transport: 'udp',
      auth_type: 'certificate',
      cipher: 'AES-256-GCM',
      config_file_content: `client
dev tun
proto udp
remote vpn.myfreevpn.net 1194
resolv-retry infinite
nobind
persist-key
persist-tun
cipher AES-256-GCM
auth SHA256
remote-cert-tls server
verb 3
<ca>
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIUQz...
-----END CERTIFICATE-----
</ca>`,
      zero_log_policy: 'strictly_enforced'
    });
  } else {
    return res.status(200).json({
      protocol: 'pptp',
      server_endpoint: 'pptp.myfreevpn.net',
      encryption: 'MPPE-128',
      auth_type: 'MSCHAPv2',
      instructions: 'Use device_uuid as username and any password for zero-signup legacy PPTP authentication.',
      zero_log_policy: 'strictly_enforced'
    });
  }
});

module.exports = router;
