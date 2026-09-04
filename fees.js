const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/fees — list fee records (student sees only their own)
router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const result = await pool.query('SELECT * FROM fee_payments WHERE student_id = $1 ORDER BY id DESC', [req.user.student_id]);
      return res.json({ fees: result.rows });
    }

    const { status, month } = req.query;
    const conditions = [];
    const values = [];
    if (status) { values.push(status); conditions.push(`fp.status = $${values.length}`); }
    if (month)  { values.push(month);  conditions.push(`fp.month = $${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT fp.*, s.full_name, s.roll_number FROM fee_payments fp
       JOIN students s ON fp.student_id = s.id
       ${where} ORDER BY fp.id DESC`,
      values
    );
    res.json({ fees: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch fee records.' });
  }
});

// POST /api/fees/collect — record a fee payment. Admin & staff only.
router.post('/collect', requireRole('admin', 'staff'), async (req, res) => {
  const { student_id, month, amount_due, amount_paid, payment_method } = req.body;
  if (!student_id || !month || amount_due == null || amount_paid == null) {
    return res.status(400).json({ error: 'student_id, month, amount_due and amount_paid are required.' });
  }

  const status = amount_paid >= amount_due ? 'paid' : amount_paid > 0 ? 'partial' : 'unpaid';

  try {
    const result = await pool.query(
      `INSERT INTO fee_payments (student_id, month, amount_due, amount_paid, payment_method, status, paid_at, received_by)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7)
       ON CONFLICT (student_id, month) DO UPDATE SET
         amount_paid = fee_payments.amount_paid + EXCLUDED.amount_paid,
         payment_method = EXCLUDED.payment_method,
         status = CASE WHEN fee_payments.amount_paid + EXCLUDED.amount_paid >= fee_payments.amount_due THEN 'paid'
                       WHEN fee_payments.amount_paid + EXCLUDED.amount_paid > 0 THEN 'partial'
                       ELSE 'unpaid' END,
         paid_at = NOW(),
         received_by = EXCLUDED.received_by
       RETURNING *`,
      [student_id, month, amount_due, amount_paid, payment_method, status, req.user.staff_id]
    );
    res.status(201).json({ fee: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not record fee payment.' });
  }
});

// GET /api/fees/summary — monthly collection totals for dashboard chart
router.get('/summary', requireRole('admin', 'staff'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT month, SUM(amount_paid) AS collected, SUM(amount_due) AS total_due
      FROM fee_payments GROUP BY month ORDER BY MIN(created_at)
    `);
    res.json({ summary: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch fee summary.' });
  }
});

module.exports = router;
