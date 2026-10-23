const { registeredDevices } = require('../models/store');
const nacl = require('tweetnacl');

// Helper to verify Ed25519 signature of device_uuid
function verifySignature(deviceUuid, publicKeyBase64, signatureBase64) {
  try {
    const messageBytes = Buffer.from(deviceUuid, 'utf8');
    const pubKeyBytes = Buffer.from(publicKeyBase64, 'base64');
    const sigBytes = Buffer.from(signatureBase64, 'base64');

    if (pubKeyBytes.length !== 32 || sigBytes.length !== 64) {
      return false;
    }

    return nacl.sign.detached.verify(messageBytes, sigBytes, pubKeyBytes);
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

async function registerDevice(req, res) {
  const { device_uuid, public_key, signature, platform, app_version } = req.body;

  // Validation
  if (!device_uuid || !public_key || !signature || !platform) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'device_uuid, public_key, signature, and platform are required fields.'
    });
  }

  if (!['android', 'windows'].includes(platform)) {
    return res.status(400).json({
      error: 'INVALID_PLATFORM',
      message: 'Platform must be either android or windows.'
    });
  }

  // Cryptographic Binding Verification
  const isValid = verifySignature(device_uuid, public_key, signature);
  if (!isValid) {
    return res.status(400).json({
      error: 'INVALID_SIGNATURE',
      message: 'The cryptographic signature verification failed against the provided device_uuid and public_key.'
    });
  }

  // Store in memory (ephemeral, zero-PII)
  registeredDevices.set(device_uuid, {
    public_key,
    platform,
    app_version: app_version || '1.0.0',
    registered_at: Date.now()
  });

  return res.status(200).json({
    status: 'success',
    device_id: device_uuid,
    message: 'Device successfully registered with cryptographic key binding.'
  });
}

module.exports = {
  registerDevice,
  verifySignature
};
