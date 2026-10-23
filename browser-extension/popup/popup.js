/**
 * MY_FREE_VPN Popup Controller Script
 */

let currentState = {
  status: 'disconnected',
  selectedNode: null,
  nodes: [],
  identity: null,
  lastError: null,
  connectedAt: null
};

let timerInterval = null;

// DOM Elements
const connectBtn = document.getElementById('connect-btn');
const statusLabel = document.getElementById('status-label');
const connectionTimer = document.getElementById('connection-timer');
const refreshBtn = document.getElementById('refresh-btn');

const nodeTrigger = document.getElementById('selected-node-trigger');
const nodeFlag = document.getElementById('node-flag');
const nodeLocation = document.getElementById('node-location');
const nodeMeta = document.getElementById('node-meta');

const nodesModal = document.getElementById('nodes-modal');
const closeNodesBtn = document.getElementById('close-nodes-btn');
const nodesList = document.getElementById('nodes-list');

const deviceUuidVal = document.getElementById('device-uuid-val');
const errorToast = document.getElementById('error-toast');
const errorMessage = document.getElementById('error-message');
const dismissErrorBtn = document.getElementById('dismiss-error-btn');

// Convert 2-letter country code to flag emoji
function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Format duration in ms to HH:MM:SS
function formatDuration(ms) {
  if (!ms) return '00:00:00';
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = num => String(num).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Update UI based on current extension state
function renderState(state) {
  currentState = { ...currentState, ...state };

  // 1. Connection Button & Status
  connectBtn.className = `connect-button ${currentState.status}`;

  switch (currentState.status) {
    case 'connected':
      statusLabel.textContent = 'Protected & Connected';
      statusLabel.style.color = '#3fb950';
      connectionTimer.classList.remove('hidden');
      startTimer();
      break;

    case 'connecting':
      statusLabel.textContent = 'Securing Connection...';
      statusLabel.style.color = '#d29922';
      connectionTimer.classList.add('hidden');
      stopTimer();
      break;

    case 'error':
      statusLabel.textContent = 'Connection Error';
      statusLabel.style.color = '#f85149';
      connectionTimer.classList.add('hidden');
      stopTimer();
      break;

    default: // disconnected
      statusLabel.textContent = 'Tap to Connect';
      statusLabel.style.color = '#8b949e';
      connectionTimer.classList.add('hidden');
      stopTimer();
  }

  // 2. Selected Node Display
  const node = currentState.selectedNode;
  if (node) {
    nodeFlag.textContent = getFlagEmoji(node.country_code);
    nodeLocation.textContent = `${node.city}, ${node.country_code}`;
    nodeMeta.textContent = `Ping: ${node.ping_ms || 45}ms • Load: ${node.current_load_percent || 30}%`;
  } else {
    nodeFlag.textContent = '🌐';
    nodeLocation.textContent = 'No Server Selected';
    nodeMeta.textContent = 'Tap refresh to load servers';
  }

  // 3. Identity Card
  if (currentState.identity) {
    deviceUuidVal.textContent = currentState.identity.deviceUuid || 'Registered';
    deviceUuidVal.title = currentState.identity.deviceUuid || '';
  } else {
    deviceUuidVal.textContent = 'Registering...';
  }

  // 4. Error Toast
  if (currentState.lastError) {
    errorMessage.textContent = currentState.lastError;
    errorToast.classList.remove('hidden');
  } else {
    errorToast.classList.add('hidden');
  }
}

// Start Timer
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  const updateTimer = () => {
    if (!currentState.connectedAt) return;
    const elapsed = Date.now() - currentState.connectedAt;
    connectionTimer.textContent = formatDuration(elapsed);
  };
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

// Stop Timer
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Render Nodes List in Modal
function renderNodesList(nodes) {
  nodesList.innerHTML = '';

  if (!nodes || nodes.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'node-item-stats';
    emptyMsg.textContent = 'No servers available.';
    nodesList.appendChild(emptyMsg);
    return;
  }

  nodes.forEach(node => {
    const isSelected = currentState.selectedNode && currentState.selectedNode.node_id === node.node_id;

    const item = document.createElement('div');
    item.className = `node-item ${isSelected ? 'selected' : ''}`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

    item.innerHTML = `
      <div class="node-flag">${getFlagEmoji(node.country_code)}</div>
      <div class="node-item-info">
        <div class="node-item-name">${node.city}, ${node.country_code}</div>
        <div class="node-item-stats">
          <span class="ping-tag">${node.ping_ms || 40}ms</span> • Load ${node.current_load_percent || 20}%
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      selectNode(node);
      closeNodesModal();
    });

    nodesList.appendChild(item);
  });
}

// Select Node
function selectNode(node) {
  chrome.runtime.sendMessage({ type: 'SELECT_NODE', node }, (response) => {
    if (response && response.success) {
      renderState(response.state);
    }
  });
}

// Request Initial State
function init() {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      return;
    }

    if (response && response.success) {
      renderState(response.state);

      // Fetch fresh nodes list if empty
      if (!response.state.nodes || response.state.nodes.length === 0) {
        fetchNodes();
      }
    }
  });
}

// Fetch Nodes
function fetchNodes() {
  refreshBtn.classList.add('spinning');
  chrome.runtime.sendMessage({ type: 'FETCH_NODES' }, (response) => {
    refreshBtn.classList.remove('spinning');
    if (response && response.success) {
      currentState.nodes = response.nodes;
      if (response.selectedNode) {
        currentState.selectedNode = response.selectedNode;
      }
      renderState(currentState);
      renderNodesList(response.nodes);
    }
  });
}

// Open Nodes Modal
function openNodesModal() {
  renderNodesList(currentState.nodes);
  nodesModal.classList.remove('hidden');
  nodeTrigger.setAttribute('aria-expanded', 'true');
}

// Close Nodes Modal
function closeNodesModal() {
  nodesModal.classList.add('hidden');
  nodeTrigger.setAttribute('aria-expanded', 'false');
}

// Event Listeners
connectBtn.addEventListener('click', () => {
  if (currentState.status === 'connected' || currentState.status === 'connecting') {
    renderState({ status: 'connecting' });
    chrome.runtime.sendMessage({ type: 'DISCONNECT' }, (res) => {
      if (res && res.success) renderState(res.state);
    });
  } else {
    renderState({ status: 'connecting' });
    chrome.runtime.sendMessage({ type: 'CONNECT', node: currentState.selectedNode }, (res) => {
      if (res && res.success) {
        renderState(res.state);
      } else if (res && res.error) {
        renderState({ status: 'error', lastError: res.error });
      }
    });
  }
});

refreshBtn.addEventListener('click', () => {
  fetchNodes();
});

nodeTrigger.addEventListener('click', () => {
  openNodesModal();
});

nodeTrigger.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openNodesModal();
  }
});

closeNodesBtn.addEventListener('click', () => {
  closeNodesModal();
});

dismissErrorBtn.addEventListener('click', () => {
  errorToast.classList.add('hidden');
  currentState.lastError = null;
});

// Initialize Popup
document.addEventListener('DOMContentLoaded', init);
