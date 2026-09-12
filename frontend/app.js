// ============================================================
// Al-Noor Institute — Frontend <-> Backend connector
// Handles auth guard, API calls, and populating the dashboard
// with real data from PostgreSQL via the Express API.
// ============================================================

// ---------- Auth guard: redirect to login if no token ----------
const TOKEN = localStorage.getItem('sms_token');
const CURRENT_USER = JSON.parse(localStorage.getItem('sms_user') || 'null');

if (!TOKEN || !CURRENT_USER) {
  window.location.href = 'index.html';
}

// ---------- Small API helper ----------
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    // Session expired or invalid — send back to login
    localStorage.removeItem('sms_token');
    localStorage.removeItem('sms_user');
    window.location.href = 'index.html';
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function logout() {
  localStorage.removeItem('sms_token');
  localStorage.removeItem('sms_user');
  window.location.href = 'index.html';
}

// ---------- Format helpers ----------
function pkr(n) {
  const num = Number(n) || 0;
  return '₨ ' + num.toLocaleString('en-PK');
}

function initials(name) {
  return (name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ---------- Apply role-based UI restrictions ----------
function applyRoleRestrictions() {
  const role = CURRENT_USER.role;

  // Show the logged-in user's name/initials in the topbar avatar
  const avatarEls = document.querySelectorAll('.topbar .avatar');
  avatarEls.forEach((el) => (el.textContent = initials(CURRENT_USER.name)));

  if (role === 'student') {
    // Students only see their own profile, fees, attendance, results —
    // hide admin/staff-only nav sections.
    const hideForStudent = ['shifts', 'staff', 'expenses', 'settings'];
    hideForStudent.forEach((pageId) => {
      const navItem = document.querySelector(`.nav-item[onclick*="'${pageId}'"]`);
      if (navItem) navItem.style.display = 'none';
    });
    // Hide "New Admission" and quick actions meant for staff
    const admBtn = document.querySelector('.topbar-right .btn-primary');
    if (admBtn) admBtn.style.display = 'none';
    const quickActions = document.querySelector('.quick-actions');
    if (quickActions) quickActions.style.display = 'none';
  }

  if (role === 'staff') {
    // Staff can't edit system settings or add other staff
    const navItem = document.querySelector(`.nav-item[onclick*="'settings'"]`);
    if (navItem) navItem.style.display = 'none';
  }
}

// ---------- Load dashboard stats (admin/staff) ----------
async function loadDashboardStats() {
  if (CURRENT_USER.role === 'student') return; // students get their own profile view instead
  try {
    const data = await api('/api/dashboard/stats');
    if (!data) return;

    const cards = document.querySelectorAll('.stat-card');
    if (cards[0]) cards[0].querySelector('.stat-value').textContent = data.total_students;
    if (cards[1]) cards[1].querySelector('.stat-value').textContent = data.attendance_today_pct + '%';
    if (cards[2]) cards[2].querySelector('.stat-value').textContent = pkr(data.fee_collected_this_month);
    if (cards[3]) cards[3].querySelector('.stat-value').textContent = data.active_staff;
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
  }
}

// ---------- Load students table ----------
async function loadStudents() {
  try {
    const data = await api('/api/students');
    if (!data) return;
    renderStudentsTable(data.students);
  } catch (err) {
    console.error('Load students error:', err.message);
  }
}

function renderStudentsTable(students) {
  const tbody = document.querySelector('#students table tbody');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px">Koi student nahi mila.</td></tr>';
    return;
  }

  tbody.innerHTML = students.map((s) => {
    const feeBadge = s.status === 'active'
      ? '<span class="badge badge-green">Active</span>'
      : '<span class="badge badge-red">Inactive</span>';

    return `
      <tr>
        <td><div style="display:flex;align-items:center;gap:9px">
          <div class="avatar">${initials(s.full_name)}</div>
          <div><div style="font-weight:500">${s.full_name}</div><div style="font-size:11px;color:var(--text-muted)">S/O: ${s.father_name || '-'}</div></div>
        </div></td>
        <td><code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-size:11px">${s.roll_number}</code></td>
        <td>${s.class_name || '-'}</td>
        <td><span class="shift-pill shift-morning">${s.shift_name || '-'}</span><br><span style="font-size:10px;color:var(--text-muted)">${s.branch_name || ''}</span></td>
        <td style="font-size:12px">${s.phone || '-'}</td>
        <td>${feeBadge}</td>
        <td><label class="toggle" onclick="toggleStudentStatus(${s.id}, this)"><div class="toggle-track ${s.status === 'active' ? 'on' : ''}"><div class="toggle-thumb"></div></div><span style="font-size:11px;color:${s.status === 'active' ? 'var(--secondary)' : 'var(--danger)'}">${s.status === 'active' ? 'Active' : 'Inactive'}</span></label></td>
        <td><div style="display:flex;gap:4px"><button class="btn btn-secondary btn-sm" onclick="viewStudent(${s.id})">👁</button></div></td>
      </tr>`;
  }).join('');
}

async function toggleStudentStatus(studentId, el) {
  const track = el.querySelector('.toggle-track');
  const isCurrentlyActive = track.classList.contains('on');
  const newStatus = isCurrentlyActive ? 'inactive' : 'active';

  try {
    await api(`/api/students/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    loadStudents(); // refresh table with real data
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

async function viewStudent(studentId) {
  try {
    const data = await api(`/api/students/${studentId}`);
    if (!data) return;
    // Populate the existing detail modal with real data, then open it
    const modal = document.getElementById('detailModal');
    if (modal) {
      // This assumes detailModal has elements with matching IDs/classes;
      // adapt selectors here if your modal markup differs.
      const nameEl = modal.querySelector('.student-photo-big + div .info-item p, [data-field="full_name"]');
      if (nameEl) nameEl.textContent = data.student.full_name;
    }
    openModal('detailModal');
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

// ---------- New admission form submit (real API call) ----------
async function submitAdmission() {
  const modal = document.getElementById('admModal');
  const rollInput = modal.querySelector('[data-field="roll_number"]');
  const nameInput = modal.querySelector('[data-field="full_name"]');
  const fatherInput = modal.querySelector('[data-field="father_name"]');
  const phoneInput = modal.querySelector('[data-field="phone"]');
  const branchSel = document.getElementById('branchSel');
  const shiftSel = document.getElementById('shiftSel');
  const classSel = document.getElementById('classSel');

  if (!nameInput || !nameInput.value) {
    alert('⚠️ Student ka naam likhna zaroori hai.');
    return;
  }

  try {
    const data = await api('/api/students', {
      method: 'POST',
      body: JSON.stringify({
        roll_number: rollInput ? rollInput.value : `SN-${Date.now().toString().slice(-4)}`,
        full_name: nameInput.value,
        father_name: fatherInput ? fatherInput.value : '',
        phone: phoneInput ? phoneInput.value : '',
        branch_id: branchSel ? branchSel.value : null,
        shift_id: shiftSel ? shiftSel.value : null,
        class_id: classSel ? classSel.value : null,
      }),
    });
    alert(`✅ Student successfully admit ho gaye!\nRoll Number: ${data.student.roll_number}`);
    closeModal('admModal');
    loadStudents();
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

// ---------- Fee collection (real API call) ----------
async function submitFeeCollection(studentId, month, amountDue, amountPaid, method) {
  try {
    await api('/api/fees/collect', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, month, amount_due: amountDue, amount_paid: amountPaid, payment_method: method }),
    });
    alert('✅ Fee collected! Receipt print ho rahi hai...');
    closeModal('feeModal');
    loadDashboardStats();
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

// ---------- Fee modal submit handler ----------
async function handleFeeModalSubmit() {
  const studentId = document.getElementById('feeStudentSel').value;
  const month = document.getElementById('feeMonthSel').value;
  const method = document.getElementById('feeMethodSel').value;
  const amountPaidRaw = document.getElementById('feeAmountIn').value.replace(/[^\d.]/g, '');
  const amountDueRaw = document.getElementById('feeTotalDue').textContent.replace(/[^\d.]/g, '');

  const amountPaid = Number(amountPaidRaw) || 0;
  const amountDue = Number(amountDueRaw) || 0;

  if (amountPaid <= 0) {
    alert('⚠️ Amount received likhna zaroori hai.');
    return;
  }

  await submitFeeCollection(studentId, month, amountDue, amountPaid, method);
}

// ---------- Notice modal submit handler ----------
async function handleNoticeSubmit() {
  const recipients = document.getElementById('noticeRecipientsSel').value;
  const subject = document.getElementById('noticeSubjectIn').value;
  const message = document.getElementById('noticeMessageIn').value;

  if (!message) {
    alert('⚠️ SMS message likhna zaroori hai.');
    return;
  }

  try {
    await api('/api/notices', {
      method: 'POST',
      body: JSON.stringify({ subject, message, recipients }),
    });
    alert('✅ Notice save ho gaya! (Asal SMS bhejne ke liye Twilio jaisa SMS gateway connect karna hoga — README dekhein)');
    closeModal('noticeModal');
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

// ---------- Attendance save handler ----------
async function handleAttendanceSave(btnEl) {
  const tbody = document.getElementById('attendanceTbody');
  if (!tbody) return;

  const records = [];
  tbody.querySelectorAll('tr[data-student-id]').forEach((row) => {
    const studentId = row.getAttribute('data-student-id');
    const checked = row.querySelector('input[type="radio"]:checked');
    if (checked) {
      records.push({ student_id: Number(studentId), status: checked.value });
    }
  });

  if (records.length === 0) {
    alert('⚠️ Koi attendance mark nahi ki gayi.');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const originalText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Saving...';

  try {
    const data = await api('/api/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ date: today, records }),
    });
    alert('✅ ' + (data.message || 'Attendance save ho gayi!'));
  } catch (err) {
    alert('❌ ' + err.message);
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = originalText;
  }
}

// ---------- Add staff handler (simple prompt-based flow) ----------
async function handleAddStaff() {
  const full_name = prompt('Staff member ka poora naam likhein:');
  if (!full_name) return;

  const designation = prompt('Designation (e.g. Teacher, Principal, Clerk):', 'Teacher') || 'Teacher';
  const phone = prompt('Phone number:', '03XX-XXXXXXX') || '';
  const salaryRaw = prompt('Monthly salary (numbers only):', '30000') || '0';
  const salary = Number(salaryRaw.replace(/[^\d.]/g, '')) || 0;

  try {
    const data = await api('/api/staff', {
      method: 'POST',
      body: JSON.stringify({ full_name, designation, phone, salary, joining_date: new Date().toISOString().slice(0, 10) }),
    });
    alert(`✅ ${data.staff.full_name} add ho gaye staff mein!`);
    location.reload();
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  applyRoleRestrictions();
  loadDashboardStats();
  loadStudents();

  // Wire up the logout button if present, otherwise add one to the topbar
  const topbarRight = document.querySelector('.topbar-right');
  if (topbarRight && !document.getElementById('logoutBtn')) {
    const btn = document.createElement('button');
    btn.id = 'logoutBtn';
    btn.className = 'btn btn-secondary';
    btn.textContent = '🚪 Logout';
    btn.onclick = logout;
    topbarRight.appendChild(btn);
  }
});
