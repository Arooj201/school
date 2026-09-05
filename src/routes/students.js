const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/students — list students (admin/staff see all; student sees only self)
router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const result = await pool.query(
        `SELECT s.*, b.name AS branch_name, sh.name AS shift_name, c.name AS class_name
         FROM students s
         LEFT JOIN branches b ON s.branch_id = b.id
         LEFT JOIN shifts sh ON s.shift_id = sh.id
         LEFT JOIN classes c ON s.class_id = c.id
         WHERE s.id = $1`,
        [req.user.student_id]
      );
      return res.json({ students: result.rows });
    }

    // Admin & staff — support optional filters via query params
    const { shift_id, class_id, status, search } = req.query;
    const conditions = [];
    const values = [];

    if (shift_id) { values.push(shift_id); conditions.push(`s.shift_id = $${values.length}`); }
    if (class_id) { values.push(class_id); conditions.push(`s.class_id = $${values.length}`); }
    if (status)   { values.push(status);   conditions.push(`s.status = $${values.length}`); }
    if (search)   { values.push(`%${search}%`); conditions.push(`(s.full_name ILIKE $${values.length} OR s.roll_number ILIKE $${values.length})`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT s.*, b.name AS branch_name, sh.name AS shift_name, c.name AS class_name
       FROM students s
       LEFT JOIN branches b ON s.branch_id = b.id
       LEFT JOIN shifts sh ON s.shift_id = sh.id
       LEFT JOIN classes c ON s.class_id = c.id
       ${where}
       ORDER BY s.id DESC`,
      values
    );
    res.json({ students: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch students.' });
  }
});

// GET /api/students/:id — single student detail (with fee + attendance summary)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  // Students can only view their own record
  if (req.user.role === 'student' && String(req.user.student_id) !== String(id)) {
    return res.status(403).json({ error: 'You can only view your own record.' });
  }

  try {
    const student = await pool.query(
      `SELECT s.*, b.name AS branch_name, sh.name AS shift_name, c.name AS class_name, c.monthly_fee
       FROM students s
       LEFT JOIN branches b ON s.branch_id = b.id
       LEFT JOIN shifts sh ON s.shift_id = sh.id
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.id = $1`,
      [id]
    );
    if (!student.rows[0]) return res.status(404).json({ error: 'Student not found.' });

    const fees = await pool.query('SELECT * FROM fee_payments WHERE student_id = $1 ORDER BY id DESC', [id]);
    const attendance = await pool.query(
      'SELECT * FROM attendance WHERE student_id = $1 ORDER BY date DESC LIMIT 30',
      [id]
    );
    const results = await pool.query(
      `SELECT er.*, e.title AS exam_title FROM exam_results er
       JOIN exams e ON er.exam_id = e.id WHERE er.student_id = $1 ORDER BY er.id DESC`,
      [id]
    );

    res.json({ student: student.rows[0], fees: fees.rows, attendance: attendance.rows, results: results.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch student details.' });
  }
});

// POST /api/students — create (admission). Admin & staff only.
router.post('/', requireRole('admin', 'staff'), async (req, res) => {
  const { roll_number, full_name, father_name, gender, date_of_birth, branch_id, shift_id, class_id, phone, address } = req.body;

  if (!roll_number || !full_name || !branch_id || !shift_id || !class_id) {
    return res.status(400).json({ error: 'roll_number, full_name, branch_id, shift_id and class_id are required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO students (roll_number, full_name, father_name, gender, date_of_birth, branch_id, shift_id, class_id, phone, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [roll_number, full_name, father_name, gender, date_of_birth, branch_id, shift_id, class_id, phone, address]
    );
    res.status(201).json({ student: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'This roll number already exists.' });
    res.status(500).json({ error: 'Could not create student.' });
  }
});

// PATCH /api/students/:id — edit details or toggle status. Admin & staff only.
router.patch('/:id', requireRole('admin', 'staff'), async (req, res) => {
  const { id } = req.params;
  const allowed = ['full_name', 'father_name', 'gender', 'date_of_birth', 'branch_id', 'shift_id', 'class_id', 'phone', 'address', 'status', 'photo_url'];
  const updates = Object.keys(req.body).filter((k) => allowed.includes(k));

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  const setClause = updates.map((key, i) => `${key} = $${i + 1}`).join(', ');
  const values = updates.map((key) => req.body[key]);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE students SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Student not found.' });
    res.json({ student: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update student.' });
  }
});

// PATCH /api/students/:id/shift — shift transfer with reason logging
router.patch('/:id/shift', requireRole('admin', 'staff'), async (req, res) => {
  const { id } = req.params;
  const { new_shift_id, reason } = req.body;
  if (!new_shift_id) return res.status(400).json({ error: 'new_shift_id is required.' });

  try {
    const result = await pool.query(
      'UPDATE students SET shift_id = $1 WHERE id = $2 RETURNING *',
      [new_shift_id, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Student not found.' });
    // In a fuller build, log this transfer + reason into a shift_transfers table.
    res.json({ student: result.rows[0], reason: reason || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not transfer shift.' });
  }
});

module.exports = router;
