const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 40');
    // Map to match the frontend expectations
    const logs = result.rows.map(row => ({
      id: row.id,
      bookingId: row.booking_id,
      action: row.action,
      details: row.details ? JSON.parse(row.details) : '',
      by: row.performed_by, // actually it's a UUID, we might need a join to get the username
      role: row.role,
      ts: row.created_at
    }));

    // To get usernames:
    const usersRes = await db.query('SELECT id, username FROM users');
    const usersMap = {};
    usersRes.rows.forEach(u => usersMap[u.id] = u.username);
    
    logs.forEach(l => {
      l.by = usersMap[l.by] || 'system';
      if (typeof l.details === 'object' && l.details !== null) {
        if (l.details.username) l.details = `Login: ${l.details.username}`;
        else if (l.details.new_status) l.details = `Status changed to ${l.details.new_status}`;
        else l.details = 'Updated booking details';
      }
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
