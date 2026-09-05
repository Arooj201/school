const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/staff — list all staff. Admin & staff only (students shouldn't browse staff list).
router.get('/', requireRole('admin', 'staff'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT st.*, b.name AS branch_name, sh.name AS shift_name FROM staff st
      LEFT JOIN branches b ON st.branch_id = b.id
      LEFT JOIN shifts sh ON st.shift_id = sh.id
      ORDER BY st.id DESC
    `);
    res.json({ staff: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch staff.' });
  }
});

// POST /api/staff — add new staff member. Admin only.
router.post('/', requireRole('admin'), async (req, res) => {
  const { staff_code, full_name, designation, branch_id, shift_id, phone, cnic, salary, joining_date } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required.' });

  try {
    const result = await pool.query(
      `INSERT INTO staff (staff_code, full_name, designation, branch_id, shift_id, phone, cnic, salary, joining_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [staff_code, full_name, designation, branch_id, shift_id, phone, cnic, salary, joining_date]
    );
    res.status(201).json({ staff: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Staff code already exists.' });
    res.status(500).json({ error: 'Could not add staff member.' });
  }
});

// PATCH /api/staff/:id — update staff info or active status. Admin only.
router.patch('/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const allowed = ['full_name', 'designation', 'branch_id', 'shift_id', 'phone', 'cnic', 'salary', 'is_active'];
  const updates = Object.keys(req.body).filter((k) => allowed.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  const setClause = updates.map((key, i) => `${key} = $${i + 1}`).join(', ');
  const values = updates.map((key) => req.body[key]);
  values.push(id);

  try {
    const result = await pool.query(`UPDATE staff SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return res.status(404).json({ error: 'Staff member not found.' });
    res.json({ staff: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update staff member.' });
  }
});

module.exports = router;
