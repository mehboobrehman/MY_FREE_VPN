# Chrome Web Store Submission: Permission Justifications

This document outlines the permissions required by the **MY_FREE_VPN** browser extension and provides the necessary justifications for the Chrome Web Store review process.

## Permissions

### 1. `proxy`
**Justification:**
This permission is essential to the core functionality of the extension. It allows the extension to modify the browser's proxy settings to securely route the user's internet traffic through our VPN infrastructure. Without this permission, the extension cannot provide the VPN service requested by the user.

### 2. `storage`
**Justification:**
This permission is required to locally store user-specific configurations, session preferences, and the generated cryptographic keys used for our "zero-signup" authentication mechanism. Storing this information locally ensures that the user's experience is persistent across browser restarts without requiring account registration, while maintaining the privacy-first, zero-logs architecture of the service.

### 3. `alarms`
**Justification:**
The `alarms` permission is used to perform background maintenance tasks, specifically scheduling periodic checks for VPN connection health. This ensures that the extension can automatically manage reconnection attempts if the connection to the VPN node is interrupted, providing a reliable and stable experience for the user without requiring manual intervention.

---
*Date: 2026-10-31*
