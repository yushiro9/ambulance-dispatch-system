const db = require('../lib/db');
const { requireAuth, requireRole } = require('../lib/auth');

const GAP_MS = 3 * 60 * 60 * 1000; // 3-hour mandatory gap

const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGIN
  ? process.env.CORS_ALLOWED_ORIGIN.split(',').map(s => s.trim())
  : [];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function checkAvailability(ambulanceId, startISO, endISO, excludeId = null) {
  const startMs = new Date(startISO).getTime();
  const endMs = new Date(endISO).getTime();
  // Apply GAP_MS buffer: a booking blocks the ambulance for its duration PLUS 3h after
  const gapStart = startMs - GAP_MS;
  const gapEnd = endMs + GAP_MS;

  let query = `
    SELECT id FROM bookings
    WHERE ambulance_id = $1
      AND status IN ('Pending', 'Approved')
      AND scheduled_start < $3
      AND scheduled_end > $2
  `;
  const params = [ambulanceId, new Date(gapStart).toISOString(), new Date(gapEnd).toISOString()];

  if (excludeId) {
    query += ` AND id != $4`;
    params.push(excludeId);
  }

  const result = await db.query(query, params);
  return result.rows.length === 0; // true = available
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  // Extract id from path like /api/bookings/[id]/status or /api/bookings/[id]
  const parts = url.pathname.replace(/^\/api\/bookings\/?/, '').split('/').filter(Boolean);
  const bookingId = parts[0] || null;
  const subRoute = parts[1] || null;

  // GET /api/bookings — list all bookings
  if (req.method === 'GET' && !bookingId) {
    try {
      const result = await db.query(`
        SELECT b.*, u.username as created_by_name
        FROM bookings b
        LEFT JOIN users u ON b.created_by = u.id
        ORDER BY b.scheduled_start ASC
      `);
      return res.status(200).json(result.rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST /api/bookings — create a booking
  if (req.method === 'POST' && !bookingId) {
    const { ambulance_id, patient_name, procedure, destination, caller_ward, caller_name, caller_phone, sex, age, notes, return_trip, scheduled_start, scheduled_end } = req.body || {};

    if (!ambulance_id || !patient_name || !scheduled_start || !scheduled_end) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const available = await checkAvailability(ambulance_id, scheduled_start, scheduled_end);
      if (!available) {
        return res.status(409).json({ error: 'Ambulance unavailable — 3-hour gap rule violated' });
      }

      const result = await db.query(
        `INSERT INTO bookings 
          (ambulance_id, patient_name, procedure, destination, caller_ward, caller_name, caller_phone, sex, age, notes, return_trip, scheduled_start, scheduled_end, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Pending',$14)
         RETURNING *`,
        [ambulance_id, patient_name, procedure, destination, caller_ward, caller_name, caller_phone, sex, age || 0, notes, return_trip || 'No', scheduled_start, scheduled_end, user.id]
      );

      const booking = result.rows[0];
      await db.query(
        `INSERT INTO audit_log (action, details, performed_by, role, booking_id) VALUES ($1,$2,$3,$4,$5)`,
        ['CREATE', `New transport for ${patient_name}`, user.id, user.role, booking.id]
      );

      return res.status(201).json(booking);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  // PATCH /api/bookings/[id]/status — change status (SuperAdmin only for approve/reject, anyone for cancel own)
  if (req.method === 'PATCH' && bookingId && subRoute === 'status') {
    const { status, cancel_reason } = req.body || {};
    const validStatuses = ['Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    // Only SuperAdmin can Approve/Reject/Complete
    if (['Approved', 'Rejected', 'Completed'].includes(status)) {
      if (!requireRole(user, 'SuperAdmin', res)) return;
    }

    // If approving, re-check availability to prevent race conditions
    if (status === 'Approved') {
      try {
        const bkRes = await db.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
        if (bkRes.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
        const bk = bkRes.rows[0];
        const available = await checkAvailability(bk.ambulance_id, bk.scheduled_start, bk.scheduled_end, bookingId);
        if (!available) return res.status(409).json({ error: 'Cannot approve — ambulance now has a conflict (3-hour gap rule)' });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    try {
      const result = await db.query(
        `UPDATE bookings 
         SET status = $1, cancel_reason = $2, updated_at = now(), decided_by = $3, decided_at = CASE WHEN $1::text IN ('Approved','Rejected') THEN now() ELSE decided_at END
         WHERE id = $4 RETURNING *`,
        [status, cancel_reason || null, ['Approved', 'Rejected'].includes(status) ? user.id : null, bookingId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });

      await db.query(
        `INSERT INTO audit_log (action, details, performed_by, role, booking_id) VALUES ($1,$2,$3,$4,$5)`,
        [status.toUpperCase(), cancel_reason ? `Reason: ${cancel_reason}` : `Status → ${status}`, user.id, user.role, bookingId]
      );

      return res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PATCH /api/bookings/[id] — edit booking (SuperAdmin or original creator only for Pending)
  if (req.method === 'PATCH' && bookingId && !subRoute) {
    const { ambulance_id, patient_name, procedure, destination, caller_ward, caller_name, caller_phone, sex, age, notes, return_trip, scheduled_start, scheduled_end } = req.body || {};

    try {
      const existing = await db.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
      const bk = existing.rows[0];

      // Only SuperAdmin or original creator (if still Pending) can edit
      if (user.role !== 'SuperAdmin' && (bk.created_by !== user.id || bk.status !== 'Pending')) {
        return res.status(403).json({ error: 'Forbidden: You can only edit your own Pending bookings' });
      }

      const newAmbulance = ambulance_id || bk.ambulance_id;
      const newStart = scheduled_start || bk.scheduled_start;
      const newEnd = scheduled_end || bk.scheduled_end;

      if (bk.status !== 'Cancelled' && bk.status !== 'Rejected') {
        const available = await checkAvailability(newAmbulance, newStart, newEnd, bookingId);
        if (!available) return res.status(409).json({ error: 'Ambulance unavailable — 3-hour gap rule violated' });
      }

      const result = await db.query(
        `UPDATE bookings SET
          ambulance_id=$1, patient_name=$2, procedure=$3, destination=$4,
          caller_ward=$5, caller_name=$6, caller_phone=$7, sex=$8, age=$9,
          notes=$10, return_trip=$11, scheduled_start=$12, scheduled_end=$13, updated_at=now()
         WHERE id=$14 RETURNING *`,
        [newAmbulance, patient_name || bk.patient_name, procedure || bk.procedure,
         destination || bk.destination, caller_ward || bk.caller_ward,
         caller_name || bk.caller_name, caller_phone || bk.caller_phone,
         sex || bk.sex, age !== undefined ? age : bk.age, notes !== undefined ? notes : bk.notes,
         return_trip || bk.return_trip, newStart, newEnd, bookingId]
      );

      await db.query(
        `INSERT INTO audit_log (action, details, performed_by, role, booking_id) VALUES ($1,$2,$3,$4,$5)`,
        ['EDIT', `Updated booking for ${result.rows[0].patient_name}`, user.id, user.role, bookingId]
      );

      return res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
