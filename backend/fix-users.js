const db = require('./src/db');
const bcrypt = require('bcryptjs');

async function fix() {
  try {
    console.log('Fixing users to match UI...');
    
    // Clear old users (cascading might fail if there are bookings, but this is a fresh db)
    await db.query('DELETE FROM audit_log');
    await db.query('DELETE FROM bookings');
    await db.query('DELETE FROM users');

    const hash1 = await bcrypt.hash('dispatch123', 12);
    await db.query(`
      INSERT INTO users (username, password_hash, role) 
      VALUES ('admin', $1, 'Scheduler')
    `, [hash1]);

    const hash2 = await bcrypt.hash('Super#2026', 12);
    await db.query(`
      INSERT INTO users (username, password_hash, role) 
      VALUES ('superadmin', $1, 'SuperAdmin')
    `, [hash2]);

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fix();
