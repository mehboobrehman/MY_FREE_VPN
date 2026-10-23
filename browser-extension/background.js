/**
 * MY_FREE_VPN Background Service Worker (Manifest V3)
 * Manages proxy configuration, backend synchronization, and cryptographic identity.
 */

import { getOrCreateIdentity } from './lib/crypto-identity.js';

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api/v1';

// Initial state
let extensionState = {
  status: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'
  selectedNode: null,
  nodes: [],
  identity: null,
  lastError: null,
  connectedAt: null,
  bytesTransferred: 0
};

// Sync state to chrome.storage.local
async function updateState(partialState) {
  extensionState = { ...extensionState, ...partialState };
  await chrome.storage.local.set({ vpn_state: extensionState });
  
  // Update Extension Badge
  updateBadge();
}

function updateBadge() {
  switch (extensionState.status) {
    case 'connected':
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Green
      break;
    case 'connecting':
      chrome.action.setBadgeText({ text: '...' });
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' }); // Amber
      break;
    case 'error':
      chrome.action.setBadgeText({ text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }); // Red
      break;
    default:
      chrome.action.setBadgeText({ text: '' });
  }
}

// Get API base URL
async function getApiBaseUrl() {
  const data = await chrome.storage.local.get(['api_base_url']);
  return data.api_base_url || DEFAULT_API_BASE_URL;
}

// Fetch available nodes from backend
async function fetchNodes() {
  const baseUrl = await getApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/nodes`);
    if (!response.ok) {
      throw new Error(`Failed to fetch nodes: HTTP ${response.status}`);
    }
    const data = await response.json();
    const nodes = data.nodes || [];
    
    // Select default node if none selected
    let selectedNode = extensionState.selectedNode;
    if (!selectedNode || !nodes.some(n => n.node_id === selectedNode.node_id)) {
      selectedNode = nodes[0] || null;
    }

    await updateState({ nodes, selectedNode });
    return nodes;
  } catch (err) {
    console.error('[MY_FREE_VPN] Error fetching nodes:', err);
    await updateState({ lastError: err.message });
    throw err;
  }
}

// Apply Chrome proxy settings
function applyProxySettings(node) {
  return new Promise((resolve, reject) => {
    if (!node || (!node.endpoint_ip && !node.ip)) {
      return reject(new Error('Invalid node selected for proxy'));
    }

    const host = node.endpoint_ip || node.ip;
    const port = node.proxy_port || 1080;

    const proxyConfig = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: 'socks5',
          host: host,
          port: parseInt(port, 10)
        },
        bypassList: ['localhost', '127.0.0.1', '::1', '<local>']
      }
    };

    chrome.proxy.settings.set({ value: proxyConfig, scope: 'regular' }, () => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve();
    });
  });
}

// Clear Chrome proxy settings
function clearProxySettings() {
  return new Promise((resolve) => {
    chrome.proxy.settings.clear({ scope: 'regular' }, () => {
      resolve();
    });
  });
}

// Connect to selected VPN node
async function connectVpn(targetNode) {
  try {
    await updateState({ status: 'connecting', lastError: null });

    const baseUrl = await getApiBaseUrl();

    // 1. Ensure cryptographic identity is registered
    const identity = await getOrCreateIdentity(baseUrl);

    // 2. Refresh nodes if needed
    let nodeToConnect = targetNode || extensionState.selectedNode;
    if (!nodeToConnect) {
      const nodes = await fetchNodes();
      nodeToConnect = nodes[0];
    }

    if (!nodeToConnect) {
      throw new Error('No VPN nodes available');
    }

    // 3. Configure browser proxy settings
    await applyProxySettings(nodeToConnect);

    // 4. Update state to connected
    await updateState({
      status: 'connected',
      selectedNode: nodeToConnect,
      identity,
      connectedAt: Date.now(),
      lastError: null
    });

    console.log(`[MY_FREE_VPN] Connected to proxy node: ${nodeToConnect.city} (${nodeToConnect.country_code})`);
    return extensionState;
  } catch (err) {
    console.error('[MY_FREE_VPN] Connection failed:', err);
    await clearProxySettings();
    await updateState({
      status: 'disconnected',
      lastError: err.message || 'Connection failed'
    });
    throw err;
  }
}

// Disconnect VPN
async function disconnectVpn() {
  try {
    await clearProxySettings();
    await updateState({
      status: 'disconnected',
      connectedAt: null
    });
    console.log('[MY_FREE_VPN] Disconnected from VPN proxy.');
    return extensionState;
  } catch (err) {
    console.error('[MY_FREE_VPN] Disconnection error:', err);
    await updateState({ lastError: err.message });
    throw err;
  }
}

// Listen for message requests from popup UI
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'GET_STATE': {
          const baseUrl = await getApiBaseUrl();
          // Ensure stored state is up to date
          const stored = await chrome.storage.local.get(['vpn_state']);
          if (stored.vpn_state) {
            extensionState = { ...extensionState, ...stored.vpn_state };
          }
          sendResponse({ success: true, state: extensionState, apiBaseUrl: baseUrl });
          break;
        }

        case 'FETCH_NODES': {
          const nodes = await fetchNodes();
          sendResponse({ success: true, nodes, selectedNode: extensionState.selectedNode });
          break;
        }

        case 'CONNECT': {
          const state = await connectVpn(message.node);
          sendResponse({ success: true, state });
          break;
        }

        case 'DISCONNECT': {
          const state = await disconnectVpn();
          sendResponse({ success: true, state });
          break;
        }

        case 'SELECT_NODE': {
          await updateState({ selectedNode: message.node });
          if (extensionState.status === 'connected') {
            await applyProxySettings(message.node);
          }
          sendResponse({ success: true, state: extensionState });
          break;
        }

        case 'REGISTER_IDENTITY': {
          const baseUrl = await getApiBaseUrl();
          const identity = await getOrCreateIdentity(baseUrl);
          await updateState({ identity });
          sendResponse({ success: true, identity });
          break;
        }

        case 'SET_API_BASE_URL': {
          await chrome.storage.local.set({ api_base_url: message.url });
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // async response indicator
});

// Proxy error listener
chrome.proxy.onProxyError.addListener((details) => {
  console.error('[MY_FREE_VPN] Chrome Proxy Error:', details);
  updateState({
    status: 'error',
    lastError: `Proxy Error: ${details.error}`
  });
});

// Service Worker Startup & Installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[MY_FREE_VPN] Extension installed/updated.');
  await clearProxySettings();
  await updateState({ status: 'disconnected' });
});

chrome.runtime.onStartup.addListener(async () => {
  const stored = await chrome.storage.local.get(['vpn_state']);
  if (stored.vpn_state) {
    extensionState = { ...extensionState, ...stored.vpn_state };
  }
  updateBadge();
});
