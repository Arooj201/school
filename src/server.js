require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const feeRoutes = require('./routes/fees');
const examRoutes = require('./routes/exams');
const staffRoutes = require('./routes/staff');
const academicRoutes = require('./routes/academic');
const expenseRoutes = require('./routes/expenses');
const noticeRoutes = require('./routes/notices');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// Allow the frontend origin(s) listed in .env to call this API
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Health check — useful for confirming deployment worked
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/reference', academicRoutes); // /api/reference/branches, /shifts, /classes
app.use('/api/expenses', expenseRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Fallback 404
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Central error handler (catches anything thrown/rejected in routes)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 School Management API running on port ${PORT}`);
});
