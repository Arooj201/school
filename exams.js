const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/exams — list exams
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, c.name AS class_name FROM exams e
      LEFT JOIN classes c ON e.class_id = c.id ORDER BY e.exam_date DESC
    `);
    res.json({ exams: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch exams.' });
  }
});

// POST /api/exams — create a new exam. Admin & staff only.
router.post('/', requireRole('admin', 'staff'), async (req, res) => {
  const { title, class_id, exam_date, total_marks } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required.' });

  try {
    const result = await pool.query(
      `INSERT INTO exams (title, class_id, exam_date, total_marks) VALUES ($1,$2,$3,$4) RETURNING *`,
      [title, class_id, exam_date, total_marks || 100]
    );
    res.status(201).json({ exam: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create exam.' });
  }
});

// GET /api/exams/:id/results — results for one exam
router.get('/:id/results', async (req, res) => {
  const { id } = req.params;
  try {
    let query = `
      SELECT er.*, s.full_name, s.roll_number FROM exam_results er
      JOIN students s ON er.student_id = s.id WHERE er.exam_id = $1`;
    const values = [id];

    if (req.user.role === 'student') {
      query += ' AND er.student_id = $2';
      values.push(req.user.student_id);
    }
    const result = await pool.query(query, values);
    res.json({ results: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch results.' });
  }
});

// POST /api/exams/:id/results — enter/update results (bulk). Admin & staff only.
// body: { results: [{ student_id, subject, marks_obtained, grade, remarks }, ...] }
router.post('/:id/results', requireRole('admin', 'staff'), async (req, res) => {
  const { id } = req.params;
  const { results } = req.body;
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: 'A non-empty results array is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];
    for (const r of results) {
      const row = await client.query(
        `INSERT INTO exam_results (exam_id, student_id, subject, marks_obtained, grade, remarks)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, r.student_id, r.subject, r.marks_obtained, r.grade, r.remarks]
      );
      inserted.push(row.rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json({ results: inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not save results.' });
  } finally {
    client.release();
  }
});

module.exports = router;
