const db = require('./db');
const bcrypt = require('bcrypt');

async function seed() {
  try {
    console.log('Seeding initial SuperAdmin...');
    const hash = await bcrypt.hash('admin123', 12);
    await db.query(`
      INSERT INTO users (username, password_hash, role) 
      VALUES ('admin', $1, 'SuperAdmin')
      ON CONFLICT (username) DO NOTHING
    `, [hash]);

    console.log('Seeding initial Scheduler...');
    const hash2 = await bcrypt.hash('scheduler123', 12);
    await db.query(`
      INSERT INTO users (username, password_hash, role) 
      VALUES ('scheduler', $1, 'Scheduler')
      ON CONFLICT (username) DO NOTHING
    `, [hash2]);

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
