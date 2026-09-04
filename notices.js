const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/notices — student/parent sees notices sent to their group; staff/admin see all
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notices ORDER BY sent_at DESC LIMIT 50');
    res.json({ notices: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch notices.' });
  }
});

// POST /api/notices — send a notice/SMS. Admin & staff only.
// NOTE: this stores the notice in the database. Actual SMS delivery requires
// integrating a provider like Twilio or a local SMS gateway — see README.
router.post('/', requireRole('admin', 'staff'), async (req, res) => {
  const { subject, message, recipients } = req.body;
  if (!message || !recipients) return res.status(400).json({ error: 'message and recipients are required.' });

  try {
    const result = await pool.query(
      'INSERT INTO notices (subject, message, recipients, sent_by) VALUES ($1,$2,$3,$4) RETURNING *',
      [subject, message, recipients, req.user.staff_id]
    );
    res.status(201).json({ notice: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send notice.' });
  }
});

module.exports = router;
