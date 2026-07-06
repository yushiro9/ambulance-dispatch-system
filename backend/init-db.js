const fs = require('fs');
const path = require('path');
const db = require('./src/db');

async function init() {
  try {
    const sqlPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running schema migration...');
    await db.query(sql);
    console.log('Migration successful.');
    
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

init();
