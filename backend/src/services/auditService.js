const db = require('../db');

const logAction = async (action, details, performedBy, role, bookingId = null) => {
  try {
    await db.query(
      `INSERT INTO audit_log (action, details, performed_by, role, booking_id) 
       VALUES ($1, $2, $3, $4, $5)`,
      [action, details ? JSON.stringify(details) : null, performedBy, role, bookingId]
    );
  } catch (error) {
    console.error('Failed to write to audit log:', error);
  }
};

module.exports = { logAction };
