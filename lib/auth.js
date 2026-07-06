const jwt = require('jsonwebtoken');

const SECRET = process.env.SESSION_SECRET || 'dev_fallback_secret_change_in_prod';


function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  const token = req.cookies?.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return null;
  }

  try {
    return jwt.verify(token, SECRET);
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    return null;
  }
}

function requireRole(user, role, res) {
  if (!user || user.role !== role) {
    res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    return false;
  }
  return true;
}

module.exports = { requireAuth, requireRole };
