const { registeredDevices } = require('../models/store');
const nacl = require('tweetnacl');

function verifyDeviceSignature(req, res, next) {
  const deviceUuid = req.headers['x-device-uuid'];
  const signature = req.headers['x-signature'];

  if (!deviceUuid || !signature) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing auth headers' });
  }

  const device = registeredDevices.get(deviceUuid);
  if (!device) {
    return res.status(401).json({ error: 'DEVICE_NOT_REGISTERED', message: 'Device not registered' });
  }

  const pubKeyBytes = Buffer.from(device.public_key, 'base64');
  const sigBytes = Buffer.from(signature, 'base64');
  const messageBytes = Buffer.from(deviceUuid, 'utf8');

  if (!nacl.sign.detached.verify(messageBytes, sigBytes, pubKeyBytes)) {
    return res.status(401).json({ error: 'INVALID_SIGNATURE', message: 'Signature verification failed' });
  }

  req.device = device;
  next();
}

module.exports = { verifyDeviceSignature };
