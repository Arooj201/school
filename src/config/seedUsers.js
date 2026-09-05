// Creates the default login accounts (admin, one staff member, one student)
// with properly bcrypt-hashed passwords. Run this once after migrate.
// Usage: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

const DEFAULT_USERS = [
  { name: 'Admin User',     email: 'admin@alnoor.edu.pk',   password: 'Admin@123',   role: 'admin',   staff_id: null, student_id: null },
  { name: 'Ali Hassan',     email: 'ali.hassan@alnoor.edu.pk', password: 'Staff@123', role: 'staff',   staff_id: 1,    student_id: null },
  { name: 'Ahmed Khalid',   email: 'ahmed.khalid@alnoor.edu.pk', password: 'Student@123', role: 'student', staff_id: null, student_id: 1 },
];

async function run() {
  try {
    for (const u of DEFAULT_USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, staff_id, student_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [u.name, u.email, hash, u.role, u.staff_id, u.student_id]
      );
      console.log(`✅ ${u.role.padEnd(7)} → ${u.email}  (password: ${u.password})`);
    }
    console.log('\n🎉 Default users ready. Use the credentials above to log in.');
  } catch (err) {
    console.error('❌ Seeding users failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
