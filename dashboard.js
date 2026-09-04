const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('admin', 'staff'));

// GET /api/dashboard/stats — the 4 top cards + shift enrollment + recent activity
router.get('/stats', async (req, res) => {
  try {
    const totalStudents = await pool.query("SELECT COUNT(*) FROM students WHERE status = 'active'");

    const today = new Date().toISOString().slice(0, 10);
    const attendanceToday = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'present') AS present,
        COUNT(*) AS total
       FROM attendance WHERE date = $1`,
      [today]
    );

    const thisMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const feeThisMonth = await pool.query(
      'SELECT COALESCE(SUM(amount_paid),0) AS collected, COUNT(*) FILTER (WHERE status != $1) AS pending FROM fee_payments WHERE month = $2',
      ['paid', thisMonth]
    );

    const activeStaff = await pool.query("SELECT COUNT(*) FROM staff WHERE is_active = true");

    const shiftEnrollment = await pool.query(`
      SELECT sh.name, b.name AS branch_name, COUNT(s.id) AS student_count
      FROM shifts sh
      LEFT JOIN branches b ON sh.branch_id = b.id
      LEFT JOIN students s ON s.shift_id = sh.id AND s.status = 'active'
      GROUP BY sh.id, sh.name, b.name ORDER BY sh.id
    `);

    const present = Number(attendanceToday.rows[0].present || 0);
    const totalMarked = Number(attendanceToday.rows[0].total || 0);
    const attendancePct = totalMarked > 0 ? ((present / totalMarked) * 100).toFixed(1) : '0.0';

    res.json({
      total_students: Number(totalStudents.rows[0].count),
      attendance_today_pct: attendancePct,
      fee_collected_this_month: Number(feeThisMonth.rows[0].collected),
      fee_pending_count: Number(feeThisMonth.rows[0].pending),
      active_staff: Number(activeStaff.rows[0].count),
      shift_enrollment: shiftEnrollment.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch dashboard stats.' });
  }
});

module.exports = router;
