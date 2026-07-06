const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../lib/db');

const SECRET = process.env.SESSION_SECRET;
const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGIN
  ? process.env.CORS_ALLOWED_ORIGIN.split(',').map(s => s.trim())
  : [];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || '';

  // POST /api/auth?action=login
  if (req.method === 'POST' && action === 'login') {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

    try {
      const result = await db.query('SELECT * FROM users WHERE username = $1 AND disabled_at IS NULL', [username]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

      const user = result.rows[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        SECRET,
        { expiresIn: '8h' }
      );

      // Log login action (fire-and-forget)
      db.query(
        `INSERT INTO audit_log (action, details, performed_by, role) VALUES ($1, $2, $3, $4)`,
        ['LOGIN', `User ${user.username} logged in`, user.id, user.role]
      ).catch(console.error);

      return res.status(200).json({
        token,
        user: { id: user.id, username: user.username, role: user.role }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
