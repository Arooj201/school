-- ============================================================
-- Seed data — matches the demo data already in the HTML UI
-- Run this AFTER schema.sql
-- ============================================================

-- Branches
INSERT INTO branches (name, code) VALUES
  ('School', 'SN'),
  ('Academy', 'AC'),
  ('College', 'CL');

-- Shifts
INSERT INTO shifts (branch_id, name, start_time, end_time) VALUES
  (1, 'Morning',   '06:30', '12:30'),
  (2, 'Afternoon', '13:00', '17:00'),
  (3, 'Evening',   '17:30', '21:00');

-- Classes
INSERT INTO classes (shift_id, name, monthly_fee) VALUES
  (1, 'Class 6', 2500), (1, 'Class 7', 2500), (1, 'Class 8-A', 2500),
  (1, 'Class 8-B', 2500), (1, 'Class 9', 2500), (1, 'Class 10-B', 2500), (1, 'Matric', 2500),
  (2, 'FSc Pre-Med P1', 3500), (2, 'FSc Part-1', 3500), (2, 'ICS P1', 3500),
  (2, 'ICS P2', 3500), (2, 'ICom P1', 3500), (2, 'ICom P2', 3500), (2, 'FA', 3500),
  (3, 'B.Com P1', 4500), (3, 'B.Com P2', 4500), (3, 'BA', 4500),
  (3, 'BSc', 4500), (3, 'BCS P1', 4500), (3, 'BCS P2', 4500);

-- Staff
INSERT INTO staff (staff_code, full_name, designation, branch_id, shift_id, phone, joining_date) VALUES
  ('STF-001', 'Ustaad Ali Hassan',  'Shift In-charge', 1, 1, '0300-1111111', '2019-06-01'),
  ('STF-002', 'Ustaad Hamza Butt',  'Shift In-charge', 2, 2, '0300-2222222', '2020-01-15'),
  ('STF-003', 'Prof. Aslam Ch.',    'Principal',       3, 3, '0300-3333333', '2018-03-10');

UPDATE shifts SET incharge_staff_id = 1 WHERE id = 1;
UPDATE shifts SET incharge_staff_id = 2 WHERE id = 2;
UPDATE shifts SET incharge_staff_id = 3 WHERE id = 3;

-- Students (matching the demo table in the HTML)
INSERT INTO students (roll_number, full_name, father_name, branch_id, shift_id, class_id, phone, status) VALUES
  ('SN-001', 'Ahmed Khalid', 'Muhammad Khalid', 1, 1, 3, '0300-1234567', 'active'),
  ('AC-047', 'Sara Rashid',  'Tariq Rashid',    2, 2, 9, '0321-9876543', 'active'),
  ('CL-012', 'Bilal Tariq',  'Tariq Bashir',    3, 3, 16,'0333-5551234', 'inactive'),
  ('SN-028', 'Fatima Aziz',  'Abdul Aziz',      1, 1, 6, '0345-7890123', 'active');

-- Fee payments (July 2024)
INSERT INTO fee_payments (student_id, month, amount_due, amount_paid, status, payment_method, paid_at) VALUES
  (1, 'July 2024', 2500, 2500, 'paid',    'Cash', NOW()),
  (2, 'July 2024', 3500, 1500, 'partial', 'Easypaisa', NOW()),
  (3, 'July 2024', 4500, 0,    'unpaid',  NULL, NULL),
  (4, 'July 2024', 2500, 2500, 'paid',    'Bank Transfer', NOW());

-- Default login accounts
-- NOTE: password_hash values below correspond to the plaintext passwords
-- shown in backend/README.md — generated with bcrypt at setup time.
-- (Placeholder here; actual hashes are inserted by backend/src/config/seedUsers.js)
