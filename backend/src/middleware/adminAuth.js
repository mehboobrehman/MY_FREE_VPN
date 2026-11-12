/**
 * Authentication middleware for Telemetry Control Plane and Admin routes.
 * Checks for a valid Bearer token in the Authorization header or x-debug-token header.
 */
const adminAuthMiddleware = (req, res, next) => {
  const adminToken = process.env.TELEMETRY_ADMIN_TOKEN || 'freevpn_debug_token_xyz';
  const authHeader = req.headers['authorization'];
  const debugTokenHeader = req.headers['x-debug-token'];
  
  let token = debugTokenHeader;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  if (token === adminToken) {
    return next();
  }
  
  return res.status(401).json({ 
    error: 'Unauthorized', 
    message: 'Valid telemetry admin token required in Authorization header or x-debug-token' 
  });
};

module.exports = adminAuthMiddleware;
