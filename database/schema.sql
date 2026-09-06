-- ============================================================
-- Al-Noor Institute — School Management System
-- PostgreSQL Schema
-- ============================================================

-- Clean slate (safe to re-run during setup)
DROP TABLE IF EXISTS notices CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS fee_payments CASCADE;
DROP TABLE IF EXISTS exam_results CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ------------------------------------------------------------
-- USERS (login accounts — admin, staff, student/parent)
-- ------------------------------------------------------------
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin','staff','student')),
  -- Links a login to its underlying record (nullable; admin has neither)
  staff_id      INTEGER,      -- FK added after staff table exists
  student_id    INTEGER,      -- FK added after students table exists
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- BRANCHES (School / Academy / College)
-- ------------------------------------------------------------
CREATE TABLE branches (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,        -- e.g. 'School', 'Academy', 'College'
  code        VARCHAR(10) NOT NULL UNIQUE, -- e.g. 'SN', 'AC', 'CL'
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- SHIFTS (Morning / Afternoon / Evening — tied to a branch)
-- ------------------------------------------------------------
CREATE TABLE shifts (
  id          SERIAL PRIMARY KEY,
  branch_id   INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name        VARCHAR(40) NOT NULL,   -- 'Morning', 'Afternoon', 'Evening'
  start_time  TIME,
  end_time    TIME,
  incharge_staff_id INTEGER,          -- FK added after staff table exists
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- CLASSES / SECTIONS
-- ------------------------------------------------------------
CREATE TABLE classes (
  id          SERIAL PRIMARY KEY,
  shift_id    INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  name        VARCHAR(60) NOT NULL,   -- 'Class 8-A', 'FSc Part-1', 'B.Com P2'
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- STAFF (Teachers / Admin staff)
-- ------------------------------------------------------------
CREATE TABLE staff (
  id            SERIAL PRIMARY KEY,
  staff_code    VARCHAR(20) UNIQUE,
  full_name     VARCHAR(120) NOT NULL,
  designation   VARCHAR(80),           -- 'Teacher', 'Principal', 'Clerk'
  branch_id     INTEGER REFERENCES branches(id),
  shift_id      INTEGER REFERENCES shifts(id),
  phone         VARCHAR(30),
  cnic          VARCHAR(20),
  salary        NUMERIC(10,2),
  joining_date  DATE,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

ALTER TABLE shifts ADD CONSTRAINT fk_shift_incharge
  FOREIGN KEY (incharge_staff_id) REFERENCES staff(id);

-- ------------------------------------------------------------
-- STUDENTS
-- ------------------------------------------------------------
CREATE TABLE students (
  id              SERIAL PRIMARY KEY,
  roll_number     VARCHAR(20) UNIQUE NOT NULL,   -- e.g. SN-001, AC-047, CL-012
  full_name       VARCHAR(120) NOT NULL,
  father_name     VARCHAR(120),
  gender          VARCHAR(10),
  date_of_birth   DATE,
  branch_id       INTEGER REFERENCES branches(id),
  shift_id        INTEGER REFERENCES shifts(id),
  class_id        INTEGER REFERENCES classes(id),
  phone           VARCHAR(30),
  address         TEXT,
  photo_url       TEXT,
  admission_date  DATE DEFAULT CURRENT_DATE,
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Now that students/staff exist, link users table properly
ALTER TABLE users ADD CONSTRAINT fk_user_staff FOREIGN KEY (staff_id) REFERENCES staff(id);
ALTER TABLE users ADD CONSTRAINT fk_user_student FOREIGN KEY (student_id) REFERENCES students(id);

-- ------------------------------------------------------------
-- DOCUMENTS (uploaded student documents metadata)
-- ------------------------------------------------------------
CREATE TABLE documents (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  file_name   VARCHAR(255) NOT NULL,
  file_url    TEXT NOT NULL,
  file_type   VARCHAR(50),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ATTENDANCE
-- ------------------------------------------------------------
CREATE TABLE attendance (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      VARCHAR(20) NOT NULL CHECK (status IN ('present','absent','leave','holiday')),
  marked_by   INTEGER REFERENCES staff(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- ------------------------------------------------------------
-- EXAMS & RESULTS
-- ------------------------------------------------------------
CREATE TABLE exams (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(120) NOT NULL,   -- 'Mid Term 2024', 'Final Exam 2024'
  class_id    INTEGER REFERENCES classes(id),
  exam_date   DATE,
  total_marks NUMERIC(6,2) DEFAULT 100,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exam_results (
  id           SERIAL PRIMARY KEY,
  exam_id      INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject      VARCHAR(80),
  marks_obtained NUMERIC(6,2),
  grade        VARCHAR(5),
  remarks      TEXT,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- FEE PAYMENTS
-- ------------------------------------------------------------
CREATE TABLE fee_payments (
  id              SERIAL PRIMARY KEY,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  month           VARCHAR(20) NOT NULL,   -- 'July 2024'
  amount_due      NUMERIC(10,2) NOT NULL,
  amount_paid     NUMERIC(10,2) DEFAULT 0,
  payment_method  VARCHAR(30),            -- Cash, Easypaisa, JazzCash, Bank Transfer
  status          VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('paid','partial','unpaid')),
  paid_at         TIMESTAMP,
  received_by     INTEGER REFERENCES staff(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, month)
);

-- ------------------------------------------------------------
-- EXPENSES
-- ------------------------------------------------------------
CREATE TABLE expenses (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(160) NOT NULL,
  category    VARCHAR(80),           -- 'Utilities', 'Salaries', 'Maintenance'
  amount      NUMERIC(10,2) NOT NULL,
  branch_id   INTEGER REFERENCES branches(id),
  expense_date DATE DEFAULT CURRENT_DATE,
  recorded_by INTEGER REFERENCES staff(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- NOTICES / SMS
-- ------------------------------------------------------------
CREATE TABLE notices (
  id           SERIAL PRIMARY KEY,
  subject      VARCHAR(200),
  message      TEXT NOT NULL,
  recipients   VARCHAR(60),   -- 'all', 'morning', 'afternoon', 'evening', 'defaulters'
  sent_by      INTEGER REFERENCES staff(id),
  sent_at      TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Helpful indexes
-- ------------------------------------------------------------
CREATE INDEX idx_students_shift ON students(shift_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_fee_student ON fee_payments(student_id);
CREATE INDEX idx_results_exam ON exam_results(exam_id);
CREATE INDEX idx_results_student ON exam_results(student_id);
