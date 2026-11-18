/* Demo adapter: the whole API runs inside the browser on sample data saved in localStorage.
   It follows the same rules as the server (roles, permissions, activity log, email alerts),
   so the demo behaves like the real portal. Emails go to a "Demo outbox" page instead of being sent. */
(function () {
  const L = (window.L = window.L || {});
  const KEY = 'lehar-demo-v3';
  const SESSION_KEY = 'lehar-demo-session';
  const MAX_STORED_FILE = 1.5 * 1024 * 1024;
  const MAX_UPLOAD = 10 * 1024 * 1024;
  const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const STATUS_LABEL = { pending: 'Pending', in_review: 'In review', approved: 'Approved', rejected: 'Rejected',
    applied: 'Applied', accepted: 'Accepted', waitlisted: 'Waitlisted' };

  /* ---------- Store ---------- */
  let db = null;
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || db.v !== 3) { db = seed(); save(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { throw httpErr(507, 'The demo storage in this browser is full. Use "Reset demo data" or upload smaller files.'); }
  }
  const nextId = (t) => (db.seq[t] = (db.seq[t] || 0) + 1);
  const now = () => L.nowIST();
  function httpErr(status, message, code) { return Object.assign(new Error(message), { status, code }); }
  const sessionUser = () => {
    const id = Number(localStorage.getItem(SESSION_KEY));
    const u = db.users.find((x) => x.id === id);
    return u && u.active ? u : null;
  };
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, mustChangePassword: !!u.mustChange, active: !!u.active });

  /* ---------- Sample data ---------- */
  function daysAgo(n, hour = 11, min = 0) {
    const d = new Date(Date.now() + 5.5 * 3600 * 1000 - n * 86400000);
    d.setUTCHours(hour, min, 0, 0);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  function seed() {
    const s = { v: 3, seq: {}, users: [], phases: [], universities: [], students: [], studentPhases: [], applications: [], documents: [], activity: [], outbox: [], otps: [] };
    const id = (t) => (s.seq[t] = (s.seq[t] || 0) + 1);
    const user = (name, email, password, role) => { const u = { id: id('users'), name, email, password, role, mustChange: false, active: true, createdAt: daysAgo(60), lastLoginAt: null }; s.users.push(u); return u; };
    // The three demo logins
    const admin = user('Admin', 'admin@icsoln.com', 'Admin123', 'admin');
    const manager = user('Counsellor', 'counsellor@icsoln.com', 'Counsellor123', 'manager');
    user('User', 'user@icsoln.com', 'User123', 'viewer');

    ['Lead', 'Counselling', 'Document review', 'University shortlist', 'Applications', 'SOP / LOR', 'Offer', 'Visa apply', 'Visa result', 'Pre-departure', 'Departed']
      .forEach((name, i) => s.phases.push({ id: id('phases'), name, sortOrder: i + 1, isVisaResult: name === 'Visa result', active: true }));
    const P = (name) => s.phases.find((p) => p.name === name).id;

    [['Arizona State University', 'USA'], ['University of Texas at Dallas', 'USA'], ['Northeastern University', 'USA'], ['University of Illinois Chicago', 'USA'],
      ['University of Toronto', 'Canada'], ['University of Waterloo', 'Canada'], ['Conestoga College', 'Canada'],
      ['University of Manchester', 'UK'], ['University of Leeds', 'UK'], ['Coventry University', 'UK'],
      ['University College Dublin', 'Ireland'], ['Trinity College Dublin', 'Ireland'],
      ['Technical University of Munich', 'Germany'], ['RWTH Aachen University', 'Germany'],
      ['Monash University', 'Australia'], ['University of Melbourne', 'Australia'],
      ['University of Auckland', 'New Zealand'], ['National University of Singapore', 'Singapore'], ['University of Amsterdam', 'Netherlands']]
      .forEach(([name, country]) => s.universities.push({ id: id('universities'), name, country, active: true }));
    const U = (name) => s.universities.find((u) => u.name === name).id;

    const log = (studentId, userId, action, detail, at) => s.activity.push({ id: id('activity'), studentId, userId, action, detail, createdAt: at });
    const ORDER = s.phases.map((p) => p.id);

    // [name, phone, city, source, countries, course, intake, budget, parent, counsellor, phase, daysAgoAdded]
    const people = [
      ['Ananya Rao', '98450 11223', 'Bengaluru', 'Walk-in', ['USA'], 'MS Computer Science', 'Fall 2027', '₹40–50 lakh', 'Suresh Rao', manager, 'Lead', 2],
      ['Karthik Iyer', '99001 44556', 'Bengaluru', 'Instagram', ['Canada'], 'PG Diploma, Project Management', 'Sep 2027', '₹20–25 lakh', 'Lakshmi Iyer', manager, 'Counselling', 5],
      ['Meera Shetty', '98862 77889', 'Mangaluru', 'Referral', ['UK', 'Ireland'], 'MSc Data Science', 'Sep 2027', '₹25–30 lakh', 'Ramesh Shetty', manager, 'Document review', 12],
      ['Rohan Gowda', '97411 22334', 'Mysuru', 'Website', ['Germany'], 'MSc Mechanical Engineering', 'Winter 2027', '₹15–20 lakh', 'Manjunath Gowda', manager, 'University shortlist', 20],
      ['Sneha Kulkarni', '98440 55667', 'Hubballi', 'Event / seminar', ['USA', 'Canada'], 'MS Business Analytics', 'Fall 2027', '₹40 lakh', 'Vinay Kulkarni', manager, 'Applications', 34],
      ['Aditya Menon', '99459 88990', 'Bengaluru', 'Phone call', ['Australia'], 'Master of IT', 'Feb 2027', '₹35 lakh', 'Sunil Menon', manager, 'SOP / LOR', 41],
      ['Divya Prakash', '97390 11447', 'Bengaluru', 'Referral', ['UK'], 'MSc Finance', 'Jan 2027', '₹30 lakh', 'Prakash K', manager, 'Offer', 55],
      ['Nikhil Reddy', '98455 66771', 'Kolar', 'Walk-in', ['Canada'], 'MEng Electrical', 'Jan 2027', '₹30 lakh', 'Srinivas Reddy', manager, 'Visa apply', 70],
      ['Pooja Hegde', '99860 33448', 'Udupi', 'Instagram', ['Ireland'], 'MSc Marketing', 'Jan 2027', '₹25 lakh', 'Ganesh Hegde', manager, 'Visa result', 90],
      ['Varun Bhat', '97412 99001', 'Bengaluru', 'Website', ['USA'], 'MS Data Science', 'Fall 2026', '₹45 lakh', 'Mohan Bhat', manager, 'Pre-departure', 150],
      ['Ishita Sharma', '98451 20202', 'Bengaluru', 'Referral', ['New Zealand'], 'Master of Engineering', 'Jul 2026', '₹28 lakh', 'Ajay Sharma', manager, 'Departed', 220],
      ['Farhan Ali', '99000 12121', 'Bengaluru', 'Facebook', ['Australia', 'New Zealand'], 'Master of Nursing', 'Jul 2027', '₹30 lakh', 'Imran Ali', null, 'Lead', 1]
    ];
    const docsFor = ['Passport', '12th marksheet', 'Degree certificate', 'Transcripts', 'IELTS / TOEFL / PTE scorecard'];
    people.forEach((p, i) => {
      const [fullName, phone, city, leadSource, countries, course, intake, budget, parentName, mgr, phaseName, added] = p;
      const createdAt = daysAgo(added, 10 + (i % 6), (i * 7) % 60);
      const st = { id: id('students'), fullName, phone, email: `${fullName.split(' ')[0].toLowerCase()}.${fullName.split(' ')[1].toLowerCase()}@example.com`,
        city, leadSource, countries, course, intake, budget, parentName, parentPhone: phone.replace(/^9/, '8'), notes: '',
        managerId: mgr ? mgr.id : null, currentPhaseId: P(phaseName), createdBy: (mgr || admin).id, createdAt, updatedAt: createdAt };
      s.students.push(st);
      log(st.id, (mgr || admin).id, 'lead_created', `Lead added (${leadSource})`, createdAt);
      const reached = ORDER.indexOf(st.currentPhaseId);
      ORDER.slice(0, reached + 1).forEach((pid, k) => {
        const isCurrent = k === reached;
        const status = isCurrent ? (phaseName === 'Departed' ? 'approved' : 'in_review') : 'approved';
        const at = daysAgo(Math.max(0, added - Math.round(((k + 1) * added) / (reached + 2))), 12, 15);
        s.studentPhases.push({ studentId: st.id, phaseId: pid, status, note: null, updatedBy: (mgr || admin).id, updatedAt: at });
        if (k > 0) log(st.id, (mgr || admin).id, 'phase_moved', `Moved from ${s.phases[k - 1].name} to ${s.phases[k].name}`, at);
      });
      st.updatedAt = s.studentPhases.filter((x) => x.studentId === st.id).map((x) => x.updatedAt).sort().pop() || createdAt;
      if (reached >= 2) {
        docsFor.slice(0, phaseName === 'Document review' ? docsFor.length : Math.min(docsFor.length, reached + 1)).forEach((t, k) => {
          const pending = phaseName === 'Document review' && k >= 3;
          const at = daysAgo(Math.max(0, added - 6 - k), 15, 10 + k);
          s.documents.push({ id: id('documents'), studentId: st.id, phaseId: P('Document review'), docType: t,
            originalName: `${fullName.split(' ')[0]}_${t.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`, mime: 'application/pdf', sizeBytes: 180000 + k * 53000,
            status: pending ? 'pending' : 'approved', reviewComment: null, uploadedBy: (mgr || admin).id, reviewedBy: pending ? null : (mgr || admin).id,
            createdAt: at, reviewedAt: pending ? null : at, dataUrl: null });
        });
      }
      if (reached >= ORDER.indexOf(P('SOP / LOR'))) {
        const at = daysAgo(Math.max(0, added - 20), 16, 40);
        s.documents.push({ id: id('documents'), studentId: st.id, phaseId: P('SOP / LOR'), docType: 'SOP', originalName: `${fullName.split(' ')[0]}_SOP_v2.pdf`,
          mime: 'application/pdf', sizeBytes: 96000, status: phaseName === 'SOP / LOR' ? 'pending' : 'approved', reviewComment: null,
          uploadedBy: (mgr || admin).id, reviewedBy: null, createdAt: at, reviewedAt: null, dataUrl: null });
      }
    });

    // Applications with university decisions
    const app = (studentName, uni, status, course, intake, applied, decided) => {
      const st = s.students.find((x) => x.fullName === studentName);
      s.applications.push({ id: id('applications'), studentId: st.id, universityId: U(uni), course, intake, status,
        appliedOn: applied ? daysAgo(applied).slice(0, 10) : null, decisionOn: decided ? daysAgo(decided).slice(0, 10) : null, note: null,
        updatedBy: st.managerId || admin.id, createdAt: daysAgo(applied || 1), updatedAt: daysAgo(decided || applied || 1) });
      log(st.id, st.managerId || admin.id, 'application_added', `Application added: ${uni} — Applied`, daysAgo(applied || 1));
      if (status !== 'applied') log(st.id, st.managerId || admin.id, 'application_status', `${uni}: Applied → ${STATUS_LABEL[status]}`, daysAgo(decided || 1));
    };
    app('Sneha Kulkarni', 'Arizona State University', 'applied', 'MS Business Analytics', 'Fall 2027', 10);
    app('Sneha Kulkarni', 'Northeastern University', 'applied', 'MS Business Analytics', 'Fall 2027', 8);
    app('Sneha Kulkarni', 'University of Toronto', 'applied', 'MMA', 'Fall 2027', 6);
    app('Aditya Menon', 'Monash University', 'accepted', 'Master of IT', 'Feb 2027', 30, 9);
    app('Aditya Menon', 'University of Melbourne', 'waitlisted', 'Master of IT', 'Feb 2027', 30, 7);
    app('Divya Prakash', 'University of Manchester', 'accepted', 'MSc Finance', 'Jan 2027', 45, 20);
    app('Divya Prakash', 'University of Leeds', 'accepted', 'MSc Finance', 'Jan 2027', 45, 18);
    app('Divya Prakash', 'Coventry University', 'rejected', 'MSc Finance', 'Jan 2027', 44, 25);
    app('Nikhil Reddy', 'University of Waterloo', 'rejected', 'MEng Electrical', 'Jan 2027', 60, 35);
    app('Nikhil Reddy', 'Conestoga College', 'accepted', 'PG Diploma, Electrical', 'Jan 2027', 58, 30);
    app('Pooja Hegde', 'University College Dublin', 'accepted', 'MSc Marketing', 'Jan 2027', 75, 50);
    app('Pooja Hegde', 'Trinity College Dublin', 'rejected', 'MSc Marketing', 'Jan 2027', 75, 48);
    app('Varun Bhat', 'University of Texas at Dallas', 'accepted', 'MS Data Science', 'Fall 2026', 140, 110);
    app('Varun Bhat', 'University of Illinois Chicago', 'accepted', 'MS Data Science', 'Fall 2026', 140, 105);
    app('Varun Bhat', 'Northeastern University', 'rejected', 'MS Data Science', 'Fall 2026', 139, 112);
    app('Ishita Sharma', 'University of Auckland', 'accepted', 'Master of Engineering', 'Jul 2026', 200, 170);

    // A few outcomes and notes
    const sp = (name, phase, status, note) => {
      const st = s.students.find((x) => x.fullName === name);
      const row = s.studentPhases.find((x) => x.studentId === st.id && x.phaseId === P(phase));
      row.status = status; row.note = note;
    };
    sp('Varun Bhat', 'Visa result', 'approved', 'F-1 visa approved at Chennai consulate.');
    sp('Ishita Sharma', 'Visa result', 'approved', 'Student visa granted.');
    sp('Pooja Hegde', 'Visa result', 'in_review', 'Biometrics done; waiting for decision.');
    sp('Meera Shetty', 'Document review', 'in_review', 'Transcripts and IELTS scorecard still to check.');
    sp('Karthik Iyer', 'Counselling', 'in_review', 'Second counselling session booked with parents.');
    const meera = s.students.find((x) => x.fullName === 'Meera Shetty');
    const rejectedDoc = s.documents.find((d) => d.studentId === meera.id && d.docType === 'Degree certificate');
    if (rejectedDoc) { rejectedDoc.status = 'rejected'; rejectedDoc.reviewComment = 'Scan is cut off at the bottom — please re-upload the full page.'; }

    s.activity.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    s.activity.forEach((a, i) => { a.id = i + 1; });
    s.seq.activity = s.activity.length;
    return s;
  }

  /* ---------- Rules shared with the server ---------- */
  const viewAll = (u) => u.role === 'admin' || u.role === 'viewer';
  const visibleStudents = (u) => db.students.filter((s) => viewAll(u) || s.managerId === u.id);
  function studentFor(u, id, { edit = false } = {}) {
    const s = db.students.find((x) => x.id === Number(id));
    if (!s || (!viewAll(u) && s.managerId !== u.id)) throw httpErr(404, 'Student not found.');
    if (edit && !(u.role === 'admin' || (u.role === 'manager' && s.managerId === u.id))) throw httpErr(403, 'You can view this student but not change them.');
    return s;
  }
  const requireRole = (u, ...roles) => { if (!roles.includes(u.role)) throw httpErr(403, 'You do not have permission to do this.'); };
  const userName = (id) => (db.users.find((u) => u.id === id) || {}).name || null;
  const phaseById = (id) => db.phases.find((p) => p.id === id);
  const uniById = (id) => db.universities.find((u) => u.id === id);
  function log(studentId, userId, action, detail) {
    db.activity.push({ id: nextId('activity'), studentId, userId, action, detail, createdAt: now() });
    const s = db.students.find((x) => x.id === studentId);
    if (s) s.updatedAt = now();
  }
  function notify({ student, actor, subject, title, lines, important = false }) {
    const to = [];
    const mgr = db.users.find((u) => u.id === student.managerId && u.active);
    if (mgr && mgr.id !== actor.id) to.push(mgr.email);
    if (important) db.users.filter((u) => u.role === 'admin' && u.active && u.id !== actor.id).forEach((u) => to.push(u.email));
    const recipients = [...new Set(to)];
    if (!recipients.length) return;
    db.outbox.unshift({ id: nextId('outbox'), to: recipients, subject: `[Lehar] ${subject} — ${student.fullName}`, title,
      lines: [...lines, `By ${actor.name}`], studentId: student.id, createdAt: now() });
    db.outbox = db.outbox.slice(0, 200);
  }
  const clean = (v) => { const t = String(v ?? '').trim(); return t === '' ? null : t; };
  function cleanStudent(body) {
    const out = {};
    ['fullName', 'phone', 'email', 'city', 'leadSource', 'course', 'intake', 'budget', 'parentName', 'parentPhone', 'notes'].forEach((k) => {
      if (body[k] !== undefined) out[k] = clean(body[k]);
    });
    if (body.countries !== undefined) out.countries = (Array.isArray(body.countries) ? body.countries : String(body.countries || '').split(','))
      .map((c) => String(c).trim()).filter(Boolean);
    return out;
  }
  function validManager(id) {
    if (id === null || id === undefined || id === '') return null;
    const m = db.users.find((u) => u.id === Number(id) && u.role === 'manager' && u.active);
    return m ? m.id : undefined;
  }
  const PHASE_STATUSES = ['pending', 'in_review', 'approved', 'rejected'];
  const APP_STATUSES = ['applied', 'accepted', 'rejected', 'waitlisted'];

  function studentListItem(s) {
    const p = phaseById(s.currentPhaseId);
    const apps = db.applications.filter((a) => a.studentId === s.id);
    return { ...s, managerName: userName(s.managerId), currentPhaseName: p ? p.name : null,
      pendingDocs: db.documents.filter((d) => d.studentId === s.id && d.status === 'pending').length,
      applicationCount: apps.length, acceptedCount: apps.filter((a) => a.status === 'accepted').length };
  }

  /* ---------- Routes ---------- */
  const routes = [];
  const route = (method, pattern, fn, { auth = true } = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, fn, auth });
  };

  // Auth
  route('POST', '/auth/login', (b) => {
    const email = String(b.email || '').trim().toLowerCase();
    const u = db.users.find((x) => x.email === email);
    if (!u || !u.active || u.password !== String(b.password || '')) throw httpErr(401, 'Email or password is incorrect.');
    u.lastLoginAt = now();
    localStorage.setItem(SESSION_KEY, String(u.id));
    save();
    return { user: publicUser(u) };
  }, { auth: false });
  route('POST', '/auth/logout', () => { localStorage.removeItem(SESSION_KEY); return { ok: true }; }, { auth: false });
  route('GET', '/auth/me', () => {
    const u = sessionUser();
    if (!u) throw httpErr(401, 'Please sign in.');
    return { user: publicUser(u) };
  }, { auth: false });
  route('POST', '/auth/change-password', (b) => {
    const u = sessionUser();
    if (!u) throw httpErr(401, 'Please sign in.');
    if (u.password !== String(b.currentPassword || '')) throw httpErr(400, 'Your current password is incorrect.');
    if (!b.newPassword || b.newPassword.length < 8) throw httpErr(400, 'New password must be at least 8 characters.');
    if (b.newPassword === b.currentPassword) throw httpErr(400, 'Choose a password different from the current one.');
    u.password = b.newPassword; u.mustChange = false; save();
    return { user: publicUser(u) };
  }, { auth: false });
  route('POST', '/auth/forgot', (b) => {
    const email = String(b.email || '').trim().toLowerCase();
    const u = db.users.find((x) => x.email === email && x.active);
    let demoCode = null;
    if (u) {
      demoCode = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
      db.otps = db.otps.filter((o) => o.userId !== u.id);
      db.otps.push({ userId: u.id, otp: demoCode, expires: Date.now() + 10 * 60000, attempts: 0 });
      db.outbox.unshift({ id: nextId('outbox'), to: [u.email], subject: 'Your Lehar password reset code', title: 'Password reset code',
        lines: [`Your code is ${demoCode}. It expires in 10 minutes.`], createdAt: now() });
      save();
    }
    return { ok: true, message: 'If that email has an account, a code has been sent.', demoCode };
  }, { auth: false });
  route('POST', '/auth/reset', (b) => {
    const email = String(b.email || '').trim().toLowerCase();
    const u = db.users.find((x) => x.email === email && x.active);
    const o = u && db.otps.find((x) => x.userId === u.id && x.expires > Date.now());
    if (!b.newPassword || b.newPassword.length < 8) throw httpErr(400, 'New password must be at least 8 characters.');
    if (!o || o.attempts >= 5 || o.otp !== String(b.otp || '').trim()) {
      if (o) o.attempts++;
      save();
      throw httpErr(400, 'The code is wrong or has expired. Request a new one.');
    }
    u.password = b.newPassword; u.mustChange = false;
    db.otps = db.otps.filter((x) => x !== o);
    save();
    return { ok: true };
  }, { auth: false });

  // Users
  const tempPassword = () => `Lehar-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  route('GET', '/users/lite', () => ({ users: db.users.map((u) => ({ id: u.id, name: u.name, role: u.role, active: u.active })).sort((a, b) => a.name.localeCompare(b.name)) }));
  route('GET', '/users', (b, q, u) => {
    requireRole(u, 'admin');
    return { users: db.users.map((x) => ({ ...publicUser(x), studentCount: db.students.filter((s) => s.managerId === x.id).length, lastLoginAt: x.lastLoginAt, createdAt: x.createdAt })) };
  });
  route('POST', '/users', (b, q, u) => {
    requireRole(u, 'admin');
    const name = String(b.name || '').trim();
    const email = String(b.email || '').trim().toLowerCase();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !['admin', 'manager', 'viewer'].includes(b.role)) throw httpErr(400, 'Enter a name, a valid email and a role.');
    if (db.users.some((x) => x.email === email)) throw httpErr(409, 'Someone already has an account with that email.');
    const password = tempPassword();
    const nu = { id: nextId('users'), name, email, password, role: b.role, mustChange: true, active: true, createdAt: now(), lastLoginAt: null };
    db.users.push(nu);
    db.outbox.unshift({ id: nextId('outbox'), to: [email], subject: 'Your Lehar Portal account', title: 'Welcome to Lehar',
      lines: [`Email: ${email}`, `Temporary password: ${password}`, 'You will be asked to set your own password when you sign in.'], createdAt: now() });
    save();
    return { user: publicUser(nu), tempPassword: password };
  });
  route('PATCH', '/users/:id', (b, q, u, p) => {
    requireRole(u, 'admin');
    const t = db.users.find((x) => x.id === Number(p.id));
    if (!t) throw httpErr(404, 'User not found.');
    if (b.role !== undefined && !['admin', 'manager', 'viewer'].includes(b.role)) throw httpErr(400, 'Unknown role.');
    if (t.id === u.id && ((b.role && b.role !== 'admin') || b.active === false)) throw httpErr(400, 'You cannot remove your own Admin access.');
    if (b.name !== undefined) t.name = String(b.name).trim() || t.name;
    if (b.role !== undefined) { t.role = b.role; if (b.role !== 'manager') db.students.forEach((s) => { if (s.managerId === t.id) s.managerId = null; }); }
    if (b.active !== undefined) t.active = !!b.active;
    save();
    return { user: publicUser(t) };
  });
  route('POST', '/users/:id/reset-password', (b, q, u, p) => {
    requireRole(u, 'admin');
    const t = db.users.find((x) => x.id === Number(p.id));
    if (!t) throw httpErr(404, 'User not found.');
    const password = tempPassword();
    t.password = password; t.mustChange = true;
    db.outbox.unshift({ id: nextId('outbox'), to: [t.email], subject: 'Your Lehar password was reset', title: 'Password reset by Admin',
      lines: [`Temporary password: ${password}`], createdAt: now() });
    save();
    return { ok: true, tempPassword: password };
  });
  route('DELETE', '/users/:id', (b, q, u, p) => {
    requireRole(u, 'admin');
    const id = Number(p.id);
    if (id === u.id) throw httpErr(400, 'You cannot delete your own account.');
    if (!db.users.some((x) => x.id === id)) throw httpErr(404, 'User not found.');
    db.students.forEach((s) => { if (s.managerId === id) s.managerId = null; });
    db.users = db.users.filter((x) => x.id !== id);
    save();
    return { ok: true };
  });

  // Phases
  route('GET', '/settings/phases', () => ({ phases: [...db.phases].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id) }));
  route('POST', '/settings/phases', (b, q, u) => {
    requireRole(u, 'admin');
    const name = String(b.name || '').trim();
    if (!name) throw httpErr(400, 'Enter a phase name.');
    const ph = { id: nextId('phases'), name, sortOrder: Math.max(0, ...db.phases.map((x) => x.sortOrder)) + 1, isVisaResult: false, active: true };
    db.phases.push(ph); save();
    return { id: ph.id };
  });
  route('PATCH', '/settings/phases/:id', (b, q, u, p) => {
    requireRole(u, 'admin');
    const ph = phaseById(Number(p.id));
    if (!ph) throw httpErr(404, 'Phase not found.');
    if (b.name !== undefined) { const n = String(b.name).trim(); if (!n) throw httpErr(400, 'Phase name cannot be empty.'); ph.name = n; }
    if (b.active !== undefined) ph.active = !!b.active;
    if (b.isVisaResult !== undefined) { if (b.isVisaResult) db.phases.forEach((x) => { x.isVisaResult = false; }); ph.isVisaResult = !!b.isVisaResult; }
    save();
    return { ok: true };
  });
  route('POST', '/settings/phases/reorder', (b, q, u) => {
    requireRole(u, 'admin');
    (b.ids || []).forEach((id, i) => { const ph = phaseById(Number(id)); if (ph) ph.sortOrder = i + 1; });
    save();
    return { ok: true };
  });
  route('DELETE', '/settings/phases/:id', (b, q, u, p) => {
    requireRole(u, 'admin');
    const id = Number(p.id);
    const used = db.students.some((s) => s.currentPhaseId === id) || db.studentPhases.some((x) => x.phaseId === id);
    if (used) { const ph = phaseById(id); if (ph) ph.active = false; save(); return { ok: true, hidden: true, message: 'This phase has student history, so it was hidden instead of deleted.' }; }
    db.phases = db.phases.filter((x) => x.id !== id); save();
    return { ok: true };
  });

  // Universities
  route('GET', '/settings/universities', () => ({
    universities: [...db.universities].sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name))
      .map((x) => ({ ...x, applicationCount: db.applications.filter((a) => a.universityId === x.id).length }))
  }));
  route('POST', '/settings/universities', (b, q, u) => {
    requireRole(u, 'admin');
    const name = String(b.name || '').trim();
    const country = String(b.country || '').trim();
    if (!name || !country) throw httpErr(400, 'Enter the university name and country.');
    if (db.universities.some((x) => x.name === name && x.country === country)) throw httpErr(409, 'That university is already on the list.');
    const un = { id: nextId('universities'), name, country, active: true };
    db.universities.push(un); save();
    return { id: un.id };
  });
  route('PATCH', '/settings/universities/:id', (b, q, u, p) => {
    requireRole(u, 'admin');
    const un = uniById(Number(p.id));
    if (!un) throw httpErr(404, 'University not found.');
    if (b.name !== undefined) { if (!String(b.name).trim()) throw httpErr(400, 'Name and country cannot be empty.'); un.name = String(b.name).trim(); }
    if (b.country !== undefined) { if (!String(b.country).trim()) throw httpErr(400, 'Name and country cannot be empty.'); un.country = String(b.country).trim(); }
    if (b.active !== undefined) un.active = !!b.active;
    save();
    return { ok: true };
  });
  route('DELETE', '/settings/universities/:id', (b, q, u, p) => {
    requireRole(u, 'admin');
    const id = Number(p.id);
    if (db.applications.some((a) => a.universityId === id)) { const un = uniById(id); if (un) un.active = false; save(); return { ok: true, hidden: true, message: 'Students have applied here, so it was hidden instead of deleted.' }; }
    db.universities = db.universities.filter((x) => x.id !== id); save();
    return { ok: true };
  });

  // Students
  route('GET', '/students', (b, q, u) => {
    let list = visibleStudents(u);
    if (q.q) { const t = q.q.toLowerCase(); list = list.filter((s) => [s.fullName, s.phone, s.email, s.city].some((v) => String(v || '').toLowerCase().includes(t))); }
    if (q.phase) list = list.filter((s) => s.currentPhaseId === Number(q.phase));
    if (q.manager === 'none') list = list.filter((s) => !s.managerId);
    else if (q.manager) list = list.filter((s) => s.managerId === Number(q.manager));
    if (q.country) list = list.filter((s) => (s.countries || []).some((c) => c.toLowerCase().includes(q.country.toLowerCase())));
    if (q.intake) list = list.filter((s) => s.intake === q.intake);
    return { students: [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).map(studentListItem) };
  });
  route('POST', '/students', (b, q, u) => {
    requireRole(u, 'admin', 'manager');
    const f = cleanStudent(b);
    if (!f.fullName || !f.phone) throw httpErr(400, 'Student name and phone are required.');
    let managerId;
    if (u.role === 'manager') managerId = u.id;
    else { managerId = validManager(b.managerId); if (managerId === undefined) throw httpErr(400, 'Choose an active counsellor.'); }
    const first = [...db.phases].filter((x) => x.active).sort((a, c) => a.sortOrder - c.sortOrder)[0];
    const st = { id: nextId('students'), fullName: null, phone: null, email: null, city: null, leadSource: null, countries: [], course: null, intake: null,
      budget: null, parentName: null, parentPhone: null, notes: null, ...f, managerId, currentPhaseId: first ? first.id : null, createdBy: u.id, createdAt: now(), updatedAt: now() };
    db.students.push(st);
    log(st.id, u.id, 'lead_created', `Lead added (${st.leadSource || 'source not set'})`);
    notify({ student: st, actor: u, subject: 'New lead', title: 'New lead assigned',
      lines: [`Phone: ${st.phone}`, `Interested in: ${st.countries.join(', ') || '—'} · ${st.course || '—'} · ${st.intake || '—'}`], important: true });
    save();
    return { student: studentListItem(st) };
  });
  route('GET', '/students/:id', (b, q, u, p) => {
    const s = studentFor(u, p.id);
    const phases = [...db.phases].sort((a, c) => a.sortOrder - c.sortOrder || a.id - c.id)
      .map((ph) => ({ ph, row: db.studentPhases.find((x) => x.studentId === s.id && x.phaseId === ph.id) }))
      .filter(({ ph, row }) => ph.active || row || ph.id === s.currentPhaseId)
      .map(({ ph, row }) => ({ id: ph.id, name: ph.name, active: ph.active, isVisaResult: ph.isVisaResult, status: row ? row.status : 'pending',
        note: row ? row.note : null, updatedAt: row ? row.updatedAt : null, updatedByName: row ? userName(row.updatedBy) : null }));
    const applications = db.applications.filter((a) => a.studentId === s.id).sort((a, c) => (a.createdAt < c.createdAt ? 1 : -1))
      .map((a) => { const un = uniById(a.universityId) || {}; return { ...a, universityName: un.name, country: un.country, updatedByName: userName(a.updatedBy) }; });
    const documents = db.documents.filter((d) => d.studentId === s.id).sort((a, c) => (a.createdAt < c.createdAt ? 1 : -1))
      .map((d) => { const { dataUrl, ...rest } = d; return { ...rest, phaseName: d.phaseId ? (phaseById(d.phaseId) || {}).name : null, uploadedByName: userName(d.uploadedBy), reviewedByName: userName(d.reviewedBy) }; });
    const activity = db.activity.filter((a) => a.studentId === s.id).sort((a, c) => c.id - a.id).slice(0, 200)
      .map((a) => ({ id: a.id, action: a.action, detail: a.detail, userName: userName(a.userId), createdAt: a.createdAt }));
    return { student: studentListItem(s), phases, applications, documents, activity };
  });
  route('PATCH', '/students/:id', (b, q, u, p) => {
    const s = studentFor(u, p.id, { edit: true });
    const f = cleanStudent(b);
    if ('fullName' in f && !f.fullName) throw httpErr(400, 'Student name cannot be empty.');
    if ('phone' in f && !f.phone) throw httpErr(400, 'Phone cannot be empty.');
    const changes = Object.keys(f).filter((k) => JSON.stringify(s[k] ?? null) !== JSON.stringify(f[k]))
      .map((k) => k.replace(/([A-Z])/g, ' $1').toLowerCase());
    let reassigned = false;
    if (b.managerId !== undefined && u.role === 'admin') {
      const m = validManager(b.managerId);
      if (m === undefined) throw httpErr(400, 'Choose an active counsellor.');
      if (m !== s.managerId) { f.managerId = m; reassigned = true; changes.push('counsellor'); }
    }
    Object.assign(s, f);
    if (changes.length) log(s.id, u.id, 'details_updated', `Updated ${changes.join(', ')}`);
    if (reassigned && s.managerId) notify({ student: s, actor: u, subject: 'Student assigned to you', title: 'Student assigned to you',
      lines: [`Current phase: ${(phaseById(s.currentPhaseId) || {}).name || 'none'}`] });
    save();
    return { student: studentListItem(s) };
  });
  route('DELETE', '/students/:id', (b, q, u, p) => {
    requireRole(u, 'admin');
    const s = studentFor(u, p.id);
    db.students = db.students.filter((x) => x.id !== s.id);
    db.studentPhases = db.studentPhases.filter((x) => x.studentId !== s.id);
    db.applications = db.applications.filter((x) => x.studentId !== s.id);
    db.documents = db.documents.filter((x) => x.studentId !== s.id);
    db.activity = db.activity.filter((x) => x.studentId !== s.id);
    save();
    return { ok: true };
  });

  // Journey
  route('POST', '/students/:id/move', (b, q, u, p) => {
    const s = studentFor(u, p.id, { edit: true });
    const ph = db.phases.find((x) => x.id === Number(b.phaseId) && x.active);
    if (!ph) throw httpErr(400, 'Choose an active phase.');
    if (ph.id === s.currentPhaseId) return { ok: true };
    const from = (phaseById(s.currentPhaseId) || {}).name || 'none';
    s.currentPhaseId = ph.id;
    let row = db.studentPhases.find((x) => x.studentId === s.id && x.phaseId === ph.id);
    if (!row) { row = { studentId: s.id, phaseId: ph.id, status: 'in_review', note: null, updatedBy: u.id, updatedAt: now() }; db.studentPhases.push(row); }
    else if (row.status === 'pending') { row.status = 'in_review'; row.updatedBy = u.id; row.updatedAt = now(); }
    log(s.id, u.id, 'phase_moved', `Moved from ${from} to ${ph.name}`);
    notify({ student: s, actor: u, subject: `Moved to ${ph.name}`, title: 'Phase changed', lines: [`From ${from} to ${ph.name}`] });
    save();
    return { ok: true };
  });
  route('PUT', '/students/:id/phases/:phaseId', (b, q, u, p) => {
    const s = studentFor(u, p.id, { edit: true });
    const ph = phaseById(Number(p.phaseId));
    if (!ph) throw httpErr(404, 'Phase not found.');
    if (!PHASE_STATUSES.includes(b.status)) throw httpErr(400, 'Unknown status.');
    const note = b.note === undefined ? null : clean(b.note);
    let row = db.studentPhases.find((x) => x.studentId === s.id && x.phaseId === ph.id);
    const prevStatus = row ? row.status : 'pending';
    const prevNote = row ? row.note : null;
    if (!row) { row = { studentId: s.id, phaseId: ph.id }; db.studentPhases.push(row); }
    Object.assign(row, { status: b.status, note, updatedBy: u.id, updatedAt: now() });
    if (prevStatus !== b.status || prevNote !== note) {
      const detail = `${ph.name}: ${STATUS_LABEL[prevStatus]} → ${STATUS_LABEL[b.status]}${note ? ` — “${note}”` : ''}`;
      log(s.id, u.id, 'phase_status', detail);
      if (prevStatus !== b.status) {
        const important = ph.isVisaResult && (b.status === 'approved' || b.status === 'rejected');
        notify({ student: s, actor: u, subject: important ? `Visa ${b.status === 'approved' ? 'approved' : 'rejected'}` : `${ph.name} ${STATUS_LABEL[b.status].toLowerCase()}`,
          title: important ? 'Visa result' : 'Phase status changed', lines: [detail], important });
      }
    }
    save();
    return { ok: true };
  });

  // Applications
  function cleanApp(b) {
    const out = {};
    ['course', 'intake', 'note'].forEach((k) => { if (b[k] !== undefined) out[k] = clean(b[k]); });
    for (const k of ['appliedOn', 'decisionOn']) {
      if (b[k] === undefined) continue;
      const v = String(b[k] || '').trim();
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw httpErr(400, 'Dates must be YYYY-MM-DD.');
      out[k] = v || null;
    }
    if (b.status !== undefined) { if (!APP_STATUSES.includes(b.status)) throw httpErr(400, 'Unknown application status.'); out.status = b.status; }
    return out;
  }
  route('POST', '/students/:id/applications', (b, q, u, p) => {
    const s = studentFor(u, p.id, { edit: true });
    const un = db.universities.find((x) => x.id === Number(b.universityId) && x.active);
    if (!un) throw httpErr(400, 'Choose a university from the list.');
    const f = cleanApp({ status: 'applied', ...b });
    const a = { id: nextId('applications'), studentId: s.id, universityId: un.id, course: null, intake: null, status: 'applied', appliedOn: null, decisionOn: null, note: null,
      ...f, updatedBy: u.id, createdAt: now(), updatedAt: now() };
    db.applications.push(a);
    const detail = `Application added: ${un.name} (${un.country}) — ${STATUS_LABEL[a.status]}`;
    log(s.id, u.id, 'application_added', detail);
    notify({ student: s, actor: u, subject: `Application: ${un.name}`, title: 'Application added', lines: [detail], important: a.status !== 'applied' });
    save();
    return { id: a.id };
  });
  const findApp = (id) => { const a = db.applications.find((x) => x.id === Number(id)); if (!a) throw httpErr(404, 'Application not found.'); return a; };
  route('PATCH', '/students/applications/:appId', (b, q, u, p) => {
    const a = findApp(p.appId);
    const s = studentFor(u, a.studentId, { edit: true });
    const f = cleanApp(b);
    const un = uniById(a.universityId);
    if (b.universityId !== undefined && Number(b.universityId) !== a.universityId) {
      const nu = db.universities.find((x) => x.id === Number(b.universityId) && x.active);
      if (!nu) throw httpErr(400, 'Choose a university from the list.');
      f.universityId = nu.id;
    }
    if (!Object.keys(f).length) return { ok: true };
    const prev = a.status;
    Object.assign(a, f, { updatedBy: u.id, updatedAt: now() });
    if (f.status && f.status !== prev) {
      const detail = `${un.name}: ${STATUS_LABEL[prev]} → ${STATUS_LABEL[f.status]}`;
      log(s.id, u.id, 'application_status', detail);
      notify({ student: s, actor: u, subject: `${STATUS_LABEL[f.status]} by ${un.name}`, title: 'University decision', lines: [detail], important: f.status !== 'applied' });
    } else log(s.id, u.id, 'application_updated', `Updated application: ${un.name}`);
    save();
    return { ok: true };
  });
  route('DELETE', '/students/applications/:appId', (b, q, u, p) => {
    requireRole(u, 'admin');
    const a = findApp(p.appId);
    studentFor(u, a.studentId);
    db.applications = db.applications.filter((x) => x.id !== a.id);
    log(a.studentId, u.id, 'application_deleted', `Deleted application: ${(uniById(a.universityId) || {}).name}`);
    save();
    return { ok: true };
  });

  // Documents
  route('POST', '/students/:id/documents', async (b, q, u, p) => {
    const s = studentFor(u, p.id, { edit: true });
    const file = b.file;
    if (!file || !file.name) throw httpErr(400, 'Choose a file to upload.');
    if (!ALLOWED.includes(file.type)) throw httpErr(400, 'Only PDF, JPG, PNG, WEBP, DOC and DOCX files can be uploaded.');
    if (file.size > MAX_UPLOAD) throw httpErr(400, 'File is larger than 10 MB.');
    const docType = String(b.docType || '').trim();
    if (!docType) throw httpErr(400, 'Choose the document type.');
    let dataUrl = null;
    if (file.size <= MAX_STORED_FILE) {
      dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    }
    const phaseId = b.phaseId && phaseById(Number(b.phaseId)) ? Number(b.phaseId) : null;
    const d = { id: nextId('documents'), studentId: s.id, phaseId, docType, originalName: file.name.slice(0, 250), mime: file.type, sizeBytes: file.size,
      status: 'pending', reviewComment: null, uploadedBy: u.id, reviewedBy: null, createdAt: now(), reviewedAt: null, dataUrl };
    db.documents.push(d);
    const detail = `Uploaded ${docType}: ${file.name}`;
    log(s.id, u.id, 'document_uploaded', detail);
    notify({ student: s, actor: u, subject: `${docType} uploaded`, title: 'Document waiting for review', lines: [detail] });
    try { save(); } catch (e) { d.dataUrl = null; save(); }
    return { id: d.id, storedFile: !!d.dataUrl };
  });
  const findDoc = (id) => { const d = db.documents.find((x) => x.id === Number(id)); if (!d) throw httpErr(404, 'Document not found.'); return d; };
  route('PATCH', '/documents/:docId/review', (b, q, u, p) => {
    const d = findDoc(p.docId);
    const s = studentFor(u, d.studentId, { edit: true });
    if (!['approved', 'rejected', 'pending'].includes(b.status)) throw httpErr(400, 'Unknown status.');
    const comment = clean(b.comment);
    if (b.status === 'rejected' && !comment) throw httpErr(400, 'Add a comment saying why it was rejected.');
    Object.assign(d, { status: b.status, reviewComment: comment, reviewedBy: u.id, reviewedAt: now() });
    const label = { approved: 'Approved', rejected: 'Rejected', pending: 'Back to pending' }[b.status];
    const detail = `${d.docType} (${d.originalName}): ${label}${comment ? ` — “${comment}”` : ''}`;
    log(s.id, u.id, 'document_reviewed', detail);
    notify({ student: s, actor: u, subject: `${d.docType} ${label.toLowerCase()}`, title: 'Document reviewed', lines: [detail] });
    save();
    return { ok: true };
  });
  route('DELETE', '/documents/:docId', (b, q, u, p) => {
    requireRole(u, 'admin');
    const d = findDoc(p.docId);
    studentFor(u, d.studentId);
    db.documents = db.documents.filter((x) => x.id !== d.id);
    log(d.studentId, u.id, 'document_deleted', `Deleted ${d.docType}: ${d.originalName}`);
    save();
    return { ok: true };
  });

  // Reports
  function summary(u) {
    const students = visibleStudents(u);
    const ids = new Set(students.map((s) => s.id));
    const byPhase = [...db.phases].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((p) => ({ id: p.id, name: p.name, active: p.active, students: students.filter((s) => s.currentPhaseId === p.id).length }));
    const managers = db.users.filter((x) => x.role === 'manager' && x.active && (u.role !== 'manager' || x.id === u.id)).sort((a, b) => a.name.localeCompare(b.name));
    const byManager = managers.map((m) => {
      const mine = db.students.filter((s) => s.managerId === m.id).map((s) => s.id);
      const apps = db.applications.filter((a) => mine.includes(a.studentId));
      return { id: m.id, name: m.name, students: mine.length,
        pendingDocs: db.documents.filter((d) => mine.includes(d.studentId) && d.status === 'pending').length,
        awaitingDecision: apps.filter((a) => a.status === 'applied').length, accepted: apps.filter((a) => a.status === 'accepted').length };
    });
    const apps = db.applications.filter((a) => ids.has(a.studentId));
    const tally = (keyFn, extra) => {
      const map = new Map();
      apps.forEach((a) => {
        const un = uniById(a.universityId) || { name: '?', country: '?' };
        const k = keyFn(un);
        if (!map.has(k)) map.set(k, { ...extra(un), applied: 0, accepted: 0, rejected: 0, waitlisted: 0, total: 0 });
        const t = map.get(k); t[a.status]++; t.total++;
      });
      return [...map.values()].map((t) => ({ ...t, acceptanceRate: t.accepted + t.rejected ? Math.round((t.accepted / (t.accepted + t.rejected)) * 100) : null }))
        .sort((a, b) => b.total - a.total);
    };
    const visaPhase = db.phases.find((p) => p.isVisaResult);
    const visa = { approved: 0, rejected: 0, pending: 0, in_review: 0 };
    if (visaPhase) db.studentPhases.filter((x) => x.phaseId === visaPhase.id && ids.has(x.studentId)).forEach((x) => { visa[x.status]++; });
    visa.approvalRate = visa.approved + visa.rejected ? Math.round((visa.approved / (visa.approved + visa.rejected)) * 100) : null;
    const cutoff = (() => { const d = new Date(Date.now() + 5.5 * 3600 * 1000 - 30 * 86400000); return d.toISOString().slice(0, 19).replace('T', ' '); })();
    const sources = {};
    students.forEach((s) => { const k = s.leadSource || 'Not set'; sources[k] = (sources[k] || 0) + 1; });
    return {
      totals: { students: students.length, new30d: students.filter((s) => s.createdAt >= cutoff).length,
        pendingDocs: db.documents.filter((d) => ids.has(d.studentId) && d.status === 'pending').length },
      byPhase, byManager, unassigned: u.role === 'manager' ? 0 : db.students.filter((s) => !s.managerId).length,
      byCountry: tally((un) => un.country, (un) => ({ name: un.country })),
      byUniversity: tally((un) => `${un.name}||${un.country}`, (un) => ({ name: un.name, country: un.country })),
      visa,
      leadSources: Object.entries(sources).map(([source, n]) => ({ source, students: n })).sort((a, b) => b.students - a.students)
    };
  }
  route('GET', '/reports/summary', (b, q, u) => summary(u));
  route('GET', '/reports/activity', (b, q, u) => {
    const ids = new Set(visibleStudents(u).map((s) => s.id));
    const limit = Math.min(Number(q.limit) || 20, 100);
    return { activity: db.activity.filter((a) => ids.has(a.studentId)).sort((a, b) => b.id - a.id).slice(0, limit)
      .map((a) => ({ ...a, userName: userName(a.userId), studentName: (db.students.find((s) => s.id === a.studentId) || {}).fullName })) };
  });
  route('GET', '/demo/outbox', (b, q, u) => { requireRole(u, 'admin'); return { emails: db.outbox }; });

  /* ---------- Dispatcher ---------- */
  async function request(method, fullPath, body) {
    if (!db) load();
    else { try { const fresh = JSON.parse(localStorage.getItem(KEY)); if (fresh && fresh.v === 3) db = fresh; } catch (e) { /* keep memory copy */ } }
    const [path, qs] = fullPath.split('?');
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      await new Promise((res) => setTimeout(res, 60));
      let user = null;
      if (r.auth) {
        user = sessionUser();
        if (!user) { const e = httpErr(401, 'Please sign in.'); if (L.onAuthError) L.onAuthError(e); throw e; }
        if (user.mustChange) { const e = httpErr(403, 'Please set a new password first.', 'MUST_CHANGE_PASSWORD'); if (L.onAuthError) L.onAuthError(e); throw e; }
      }
      const result = await r.fn(body || {}, q, user, params);
      return JSON.parse(JSON.stringify(result));
    }
    throw httpErr(404, 'Not found.');
  }

  /* ---------- Sample PDF for seeded documents (they have no real file) ---------- */
  function samplePdf(doc, student) {
    const lines = ['Lehar demo document', '', `Type: ${doc.docType}`, `Student: ${student ? student.fullName : ''}`, `File: ${doc.originalName}`, '',
      'This is placeholder sample data in the Lehar demo.', 'Files you upload yourself open as the real file.'];
    const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 72 ${740 - i * 22} Td (${l.replace(/[()\\]/g, '\\$&').replace(/[^\x20-\x7E]/g, '-')}) Tj ET`).join('\n');
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    let out = '%PDF-1.4\n';
    const offsets = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([out], { type: 'application/pdf' });
  }
  function dataUrlToBlob(dataUrl) {
    const [head, b64] = dataUrl.split(',');
    const mime = head.match(/data:([^;]+)/)[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  L.apiDemo = {
    mode: 'demo',
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b ?? {}),
    put: (p, b) => request('PUT', p, b ?? {}),
    patch: (p, b) => request('PATCH', p, b ?? {}),
    del: (p) => request('DELETE', p),
    upload: (p, formData) => request('POST', p, Object.fromEntries(formData.entries())),
    openDocument(id, { download = false } = {}) {
      if (!db) load();
      const u = sessionUser();
      const d = db.documents.find((x) => x.id === Number(id));
      if (!u || !d) return L.toast('Document not found.', 'err');
      try { studentFor(u, d.studentId); } catch (e) { return L.toast(e.message, 'err'); }
      const blob = d.dataUrl ? dataUrlToBlob(d.dataUrl) : (d.mime === 'application/pdf' ? samplePdf(d, db.students.find((s) => s.id === d.studentId)) : null);
      if (!blob) return L.toast('This demo file was too large to keep in the browser, so only its details were saved.', 'err');
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement('a'); a.href = url; a.download = d.originalName; document.body.appendChild(a); a.click(); a.remove();
      } else window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    exportExcel() {
      if (!db) load();
      const u = sessionUser();
      if (!u || u.role !== 'admin') return L.toast('Only Admin can export.', 'err');
      const sum = summary(u);
      const ph = (id) => (phaseById(id) || {}).name || '';
      L.xlsx.download(`lehar-export-${L.todayIST()}.xlsx`, [
        { name: 'Students', columns: [{ header: 'ID', width: 6 }, { header: 'Name', width: 24 }, { header: 'Phone', width: 15 }, { header: 'Email', width: 28 },
          { header: 'City', width: 14 }, { header: 'Lead source', width: 14 }, { header: 'Countries', width: 22 }, { header: 'Course', width: 26 },
          { header: 'Intake', width: 12 }, { header: 'Budget', width: 14 }, { header: 'Parent', width: 18 }, { header: 'Parent phone', width: 15 },
          { header: 'Counsellor', width: 18 }, { header: 'Current phase', width: 18 }, { header: 'Applications', width: 12 }, { header: 'Accepted', width: 10 }, { header: 'Added on', width: 18 }],
          rows: [...db.students].sort((a, b) => a.fullName.localeCompare(b.fullName)).map((s) => { const it = studentListItem(s); return [s.id, s.fullName, s.phone, s.email, s.city, s.leadSource,
            (s.countries || []).join(', '), s.course, s.intake, s.budget, s.parentName, s.parentPhone, it.managerName, ph(s.currentPhaseId), it.applicationCount, it.acceptedCount, s.createdAt]; }) },
        { name: 'Applications', columns: [{ header: 'Student', width: 24 }, { header: 'University', width: 34 }, { header: 'Country', width: 14 }, { header: 'Course', width: 26 },
          { header: 'Intake', width: 12 }, { header: 'Status', width: 12 }, { header: 'Applied on', width: 12 }, { header: 'Decision on', width: 12 }, { header: 'Note', width: 30 }],
          rows: db.applications.map((a) => { const s = db.students.find((x) => x.id === a.studentId) || {}; const un = uniById(a.universityId) || {};
            return [s.fullName, un.name, un.country, a.course, a.intake, STATUS_LABEL[a.status], a.appliedOn, a.decisionOn, a.note]; })
            .sort((a, b) => String(a[0]).localeCompare(String(b[0]))) },
        { name: 'Pipeline', columns: [{ header: 'Phase', width: 24 }, { header: 'Students', width: 12 }], rows: sum.byPhase.filter((p) => p.active || p.students).map((p) => [p.name, p.students]) },
        { name: 'Counsellors', columns: [{ header: 'Counsellor', width: 22 }, { header: 'Students', width: 10 }, { header: 'Documents to review', width: 20 },
          { header: 'Awaiting university decision', width: 28 }, { header: 'Offers accepted', width: 16 }],
          rows: sum.byManager.map((m) => [m.name, m.students, m.pendingDocs, m.awaitingDecision, m.accepted]) },
        { name: 'Results by university', columns: [{ header: 'University', width: 34 }, { header: 'Country', width: 14 }, { header: 'Applications', width: 13 },
          { header: 'Accepted', width: 10 }, { header: 'Rejected', width: 10 }, { header: 'Waitlisted', width: 11 }, { header: 'Waiting for decision', width: 20 }, { header: 'Acceptance rate %', width: 17 }],
          rows: sum.byUniversity.map((x) => [x.name, x.country, x.total, x.accepted, x.rejected, x.waitlisted, x.applied, x.acceptanceRate ?? '']) }
      ]);
    },
    reset() { localStorage.removeItem(KEY); localStorage.removeItem(SESSION_KEY); db = null; load(); },
    accounts: () => [
      { label: 'Admin', email: 'admin@icsoln.com', password: 'Admin123', note: 'Full access' },
      { label: 'Counsellor', email: 'counsellor@icsoln.com', password: 'Counsellor123', note: 'Edits assigned students' },
      { label: 'User', email: 'user@icsoln.com', password: 'User123', note: 'View only' }
    ]
  };
})();
