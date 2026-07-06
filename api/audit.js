const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');

const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGIN
  ? process.env.CORS_ALLOWED_ORIGIN.split(',').map(s => s.trim())
  : [];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await db.query(`
      SELECT a.id, a.action, a.details, a.role, a.created_at as ts, a.booking_id,
             u.username as by
      FROM audit_log a
      LEFT JOIN users u ON a.performed_by = u.id
      ORDER BY a.created_at DESC
      LIMIT 40
    `);

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
