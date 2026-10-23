/**
 * Zero-signup Cryptographic Identity Module for MY_FREE_VPN Browser Extension
 * Generates an Ed25519 keypair, binds it to a Device UUID, signs the UUID,
 * and authenticates with the backend API.
 */

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a new Ed25519 identity (UUID + KeyPair)
 */
export async function generateIdentity() {
  const deviceUuid = crypto.randomUUID();
  
  // Generate Ed25519 keypair using Web Crypto API
  const keyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  );

  // Export public key as raw 32-byte buffer
  const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(pubRaw);

  // Sign device_uuid UTF-8 string
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(deviceUuid);
  const sigRaw = await crypto.subtle.sign({ name: 'Ed25519' }, keyPair.privateKey, messageBytes);
  const signatureBase64 = arrayBufferToBase64(sigRaw);

  // Export private key as JWK for persistence
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return {
    deviceUuid,
    publicKeyBase64,
    signatureBase64,
    privateJwk
  };
}

/**
 * Re-sign device_uuid with private key JWK
 */
export async function signWithJwk(deviceUuid, privateJwk) {
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'Ed25519' },
    true,
    ['sign']
  );

  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(deviceUuid);
  const sigRaw = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, messageBytes);
  return arrayBufferToBase64(sigRaw);
}

/**
 * Ensures a valid registered identity exists in chrome.storage.local
 */
export async function getOrCreateIdentity(apiBaseUrl) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['device_identity'], async (result) => {
      let identity = result.device_identity;

      if (identity && identity.registered) {
        return resolve(identity);
      }

      try {
        if (!identity) {
          const generated = await generateIdentity();
          identity = {
            deviceUuid: generated.deviceUuid,
            publicKeyBase64: generated.publicKeyBase64,
            signatureBase64: generated.signatureBase64,
            privateJwk: generated.privateJwk,
            registered: false
          };
        }

        // Register with backend
        const regUrl = `${apiBaseUrl}/auth/register`;
        const response = await fetch(regUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_uuid: identity.deviceUuid,
            public_key: identity.publicKeyBase64,
            signature: identity.signatureBase64,
            platform: 'browser',
            app_version: '1.0.0'
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || `Registration failed with HTTP ${response.status}`);
        }

        identity.registered = true;
        identity.registeredAt = Date.now();

        chrome.storage.local.set({ device_identity: identity }, () => {
          resolve(identity);
        });
      } catch (err) {
        console.error('[MY_FREE_VPN] Identity registration error:', err);
        // Store un-registered identity anyway so user can retry
        if (identity) {
          chrome.storage.local.set({ device_identity: identity });
        }
        reject(err);
      }
    });
  });
}
