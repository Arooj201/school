const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/attendance?date=2024-07-24&shift_id=1&class_id=3
router.get('/', async (req, res) => {
  const { date, shift_id, class_id } = req.query;

  if (req.user.role === 'student') {
    const result = await pool.query(
      'SELECT * FROM attendance WHERE student_id = $1 ORDER BY date DESC LIMIT 60',
      [req.user.student_id]
    );
    return res.json({ attendance: result.rows });
  }

  const conditions = [];
  const values = [];
  if (date) { values.push(date); conditions.push(`a.date = $${values.length}`); }
  if (shift_id) { values.push(shift_id); conditions.push(`s.shift_id = $${values.length}`); }
  if (class_id) { values.push(class_id); conditions.push(`s.class_id = $${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await pool.query(
      `SELECT a.*, s.full_name, s.roll_number FROM attendance a
       JOIN students s ON a.student_id = s.id
       ${where} ORDER BY a.date DESC`,
      values
    );
    res.json({ attendance: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch attendance.' });
  }
});

// POST /api/attendance/mark — bulk mark attendance for a date
// body: { date: '2024-07-24', records: [{ student_id, status }, ...] }
router.post('/mark', requireRole('admin', 'staff'), async (req, res) => {
  const { date, records } = req.body;
  if (!date || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'date and a non-empty records array are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of records) {
      await client.query(
        `INSERT INTO attendance (student_id, date, status, marked_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (student_id, date) DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by`,
        [r.student_id, date, r.status, req.user.staff_id]
      );
    }
    await client.query('COMMIT');
    res.json({ message: `Attendance marked for ${records.length} students.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not mark attendance.' });
  } finally {
    client.release();
  }
});

// GET /api/attendance/defaulters — students with low attendance this month
router.get('/defaulters', requireRole('admin', 'staff'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.full_name, s.roll_number,
        COUNT(*) FILTER (WHERE a.status = 'present') AS present_days,
        COUNT(*) AS total_marked,
        ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / NULLIF(COUNT(*),0), 1) AS attendance_pct
      FROM students s
      JOIN attendance a ON a.student_id = s.id
      WHERE a.date >= date_trunc('month', CURRENT_DATE)
      GROUP BY s.id, s.full_name, s.roll_number
      HAVING ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / NULLIF(COUNT(*),0), 1) < 75
      ORDER BY attendance_pct ASC
    `);
    res.json({ defaulters: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch defaulters.' });
  }
});

module.exports = router;
