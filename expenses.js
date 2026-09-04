const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('admin', 'staff')); // students never see expenses

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ex.*, b.name AS branch_name FROM expenses ex
      LEFT JOIN branches b ON ex.branch_id = b.id ORDER BY ex.expense_date DESC
    `);
    res.json({ expenses: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch expenses.' });
  }
});

router.post('/', async (req, res) => {
  const { title, category, amount, branch_id, expense_date } = req.body;
  if (!title || amount == null) return res.status(400).json({ error: 'title and amount are required.' });

  try {
    const result = await pool.query(
      `INSERT INTO expenses (title, category, amount, branch_id, expense_date, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, category, amount, branch_id, expense_date || new Date(), req.user.staff_id]
    );
    res.status(201).json({ expense: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not record expense.' });
  }
});

module.exports = router;
