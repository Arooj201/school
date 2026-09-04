// Reference data: branches, shifts, classes.
// Grouped together since they're small, related lookup tables.
const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// NOTE: this router is mounted at '/api/reference' in server.js, so full
// paths are /api/reference/branches, /api/reference/shifts, /api/reference/classes.

// ---------- BRANCHES ----------
router.get('/branches', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM branches ORDER BY id');
    res.json({ branches: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch branches.' });
  }
});

// ---------- SHIFTS ----------
router.get('/shifts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sh.*, b.name AS branch_name,
        (SELECT COUNT(*) FROM students s WHERE s.shift_id = sh.id AND s.status = 'active') AS student_count,
        (SELECT COUNT(*) FROM staff st WHERE st.shift_id = sh.id AND st.is_active = true) AS teacher_count,
        (SELECT COUNT(*) FROM classes c WHERE c.shift_id = sh.id) AS class_count
      FROM shifts sh LEFT JOIN branches b ON sh.branch_id = b.id ORDER BY sh.id
    `);
    res.json({ shifts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch shifts.' });
  }
});

router.post('/shifts', requireRole('admin'), async (req, res) => {
  const { branch_id, name, start_time, end_time } = req.body;
  if (!branch_id || !name) return res.status(400).json({ error: 'branch_id and name are required.' });

  try {
    const result = await pool.query(
      'INSERT INTO shifts (branch_id, name, start_time, end_time) VALUES ($1,$2,$3,$4) RETURNING *',
      [branch_id, name, start_time, end_time]
    );
    res.status(201).json({ shift: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create shift.' });
  }
});

// ---------- CLASSES ----------
router.get('/classes', async (req, res) => {
  const { shift_id } = req.query;
  try {
    const query = shift_id
      ? { text: 'SELECT * FROM classes WHERE shift_id = $1 ORDER BY id', values: [shift_id] }
      : { text: 'SELECT c.*, sh.name AS shift_name FROM classes c LEFT JOIN shifts sh ON c.shift_id = sh.id ORDER BY c.id', values: [] };
    const result = await pool.query(query);
    res.json({ classes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch classes.' });
  }
});

router.post('/classes', requireRole('admin', 'staff'), async (req, res) => {
  const { shift_id, name, monthly_fee } = req.body;
  if (!shift_id || !name) return res.status(400).json({ error: 'shift_id and name are required.' });

  try {
    const result = await pool.query(
      'INSERT INTO classes (shift_id, name, monthly_fee) VALUES ($1,$2,$3) RETURNING *',
      [shift_id, name, monthly_fee || 0]
    );
    res.status(201).json({ class: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create class.' });
  }
});

module.exports = router;
