// Runs database/schema.sql and database/seed.sql against DATABASE_URL.
// Usage: npm run migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function run() {
  const schemaPath = path.join(__dirname, '../../../database/schema.sql');
  const seedPath = path.join(__dirname, '../../../database/seed.sql');

  try {
    console.log('📦 Running schema.sql ...');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('✅ Schema created.');

    if (process.argv.includes('--seed')) {
      console.log('🌱 Running seed.sql ...');
      const seed = fs.readFileSync(seedPath, 'utf8');
      await pool.query(seed);
      console.log('✅ Seed data inserted.');
    }

    console.log('🎉 Migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
