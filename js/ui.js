/* Shared helpers: escaping, formatting, logo, icons, modal, toast, labels. */
(function () {
  const L = (window.L = window.L || {});

  L.esc = function (v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };
  const esc = L.esc;

  /* ---------- Labels ---------- */
  L.PHASE_STATUS = [
    ['pending', 'Pending'], ['in_review', 'In review'], ['approved', 'Approved'], ['rejected', 'Rejected']
  ];
  L.APP_STATUS = [
    ['applied', 'Applied'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['waitlisted', 'Waitlisted']
  ];
  L.DOC_STATUS = [['pending', 'Waiting for review'], ['approved', 'Approved'], ['rejected', 'Rejected']];
  L.ROLES = [['admin', 'Admin'], ['manager', 'Counsellor']]; // 'manager' is the stored name for Counsellor
  L.LEAD_SOURCES = ['Walk-in', 'Phone call', 'Website', 'Instagram', 'Facebook', 'Referral', 'Event / seminar', 'WhatsApp', 'Other'];
  L.COUNTRIES = ['USA', 'Canada', 'UK', 'Ireland', 'Germany', 'Sweden', 'Netherlands', 'France', 'Switzerland', 'Singapore', 'Australia', 'New Zealand', 'Other'];
  L.DOC_TYPES = ['Passport', '10th marksheet', '12th marksheet', 'Degree certificate', 'Transcripts', 'IELTS / TOEFL / PTE scorecard',
    'GRE / GMAT scorecard', 'Resume / CV', 'SOP', 'LOR', 'Financial documents', 'Offer letter', 'Visa documents', 'Other'];
  L.label = (pairs, key) => (pairs.find((p) => p[0] === key) || [key, key])[1];
  L.statusBadge = (pairs, key) => `<span class="badge st-${esc(key)}">${esc(L.label(pairs, key))}</span>`;
  L.roleBadge = (role) => `<span class="badge plain role-${esc(role)}">${esc(L.label(L.ROLES, role))}</span>`;
  L.phasePill = (name) => name ? `<span class="badge phase-pill">${esc(name)}</span>` : '<span class="soft">—</span>';

  /* ---------- Dates (all values are IST strings "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD") ---------- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function parts(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    return m ? { y: +m[1], mo: +m[2], d: +m[3], h: m[4] != null ? +m[4] : null, mi: m[5] != null ? +m[5] : null } : null;
  }
  L.fmtDate = (s) => {
    const p = parts(s);
    return p ? `${p.d} ${MONTHS[p.mo - 1]} ${p.y}` : '—';
  };
  L.fmtDateTime = (s) => {
    const p = parts(s);
    if (!p) return '—';
    if (p.h == null) return L.fmtDate(s);
    const ampm = p.h >= 12 ? 'pm' : 'am';
    const h12 = p.h % 12 || 12;
    return `${p.d} ${MONTHS[p.mo - 1]} ${p.y}, ${h12}:${String(p.mi).padStart(2, '0')} ${ampm}`;
  };
  L.nowIST = () => {
    const d = new Date(Date.now() + 5.5 * 3600 * 1000);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  };
  L.todayIST = () => L.nowIST().slice(0, 10);
  L.fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  L.initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  /* ---------- Logo ----------
     Interim Lehar logo in Samudra colours (royal blue + orange, splash, waves below).
     When the final logo is agreed, replace these files and keep their names:
       assets/logo.svg        (light backgrounds: sign-in page)
       assets/logo-white.svg  (dark sidebar and mobile top bar)
       assets/favicon.svg     (browser tab icon)
     PNG works too: change the file names below to .png. */
  L.LOGO_FILES = { color: 'assets/logo.svg', white: 'assets/logo-white.svg' };
  L.logo = function ({ variant = 'color', width = 200, className = '' } = {}) {
    const src = L.LOGO_FILES[variant] || L.LOGO_FILES.color;
    return `<img src="${src}" alt="Lehar" width="${width}" class="${esc(className)}" style="height:auto;display:block">`;
  };

  /* ---------- Icons (inline stroke SVG) ---------- */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    students: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6.2 4.6 1.9 5.3 5.4"/>',
    reports: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    users: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
    phases: '<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><path d="M5 8v8"/><path d="M10 6h10"/><path d="M10 18h10"/><path d="M10 12h10"/><circle cx="5" cy="12" r="2"/>',
    university: '<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/><path d="M21 9v6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5"/>'
  };
  L.icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ---------- Options ---------- */
  L.options = (list, selected, { blank } = {}) => {
    const sel = Array.isArray(selected) ? selected.map(String) : [String(selected ?? '')];
    return (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') +
      list.map((o) => {
        const [v, t] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}"${sel.includes(String(v)) ? ' selected' : ''}>${esc(t)}</option>`;
      }).join('');
  };

  /* ---------- Toast ---------- */
  L.toast = (msg, kind = '') => {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), kind === 'err' ? 6000 : 3500);
  };
  L.fail = (err) => L.toast(err && err.message ? err.message : 'Something went wrong.', 'err');

  /* ---------- Modal ----------
     L.modal({ title, body, submitLabel, danger, size, onSubmit(form) => Promise })
     The body can hold a <form>; submit runs onSubmit with FormData. Returning false keeps it open. */
  L.modal = function ({ title, body, submitLabel = 'Save', cancelLabel = 'Cancel', danger = false, size = '', onSubmit, onOpen, hideSubmit = false }) {
    const root = document.getElementById('modal-root');
    const prevFocus = document.activeElement;
    root.innerHTML = `<div class="modal-back" data-close>
      <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <form novalidate>
          <div class="modal-head"><h2 id="modal-title">${esc(title)}</h2>
            <button type="button" class="icon-btn" data-close aria-label="Close">${L.icon('close')}</button></div>
          <div class="modal-body">${body}<div class="error-text" data-error hidden></div></div>
          <div class="modal-foot">
            <button type="button" class="btn" data-close>${esc(cancelLabel)}</button>
            ${hideSubmit ? '' : `<button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submitLabel)}</button>`}
          </div>
        </form>
      </div></div>`;
    const back = root.firstElementChild;
    const form = back.querySelector('form');
    const errEl = back.querySelector('[data-error]');
    const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') && (e.target === back || e.target.closest('button[data-close]'))) close();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!onSubmit) return close();
      const btn = form.querySelector('button[type=submit]');
      errEl.hidden = true;
      btn.disabled = true;
      try {
        const keep = await onSubmit(new FormData(form), form);
        if (keep !== false) close();
      } catch (err) {
        errEl.textContent = err.message || 'Something went wrong.';
        errEl.hidden = false;
      } finally {
        if (btn.isConnected) btn.disabled = false;
      }
    });
    const first = form.querySelector('input:not([type=hidden]), select, textarea');
    (first || form.querySelector('button')).focus();
    if (onOpen) onOpen(form);
    return { close, form };
  };

  L.confirm = (title, message, { confirmLabel = 'Confirm', danger = true } = {}) => new Promise((resolve) => {
    let done = false;
    const m = L.modal({ title, size: 'sm', body: `<p>${esc(message)}</p>`, submitLabel: confirmLabel, danger,
      onSubmit: async () => { done = true; resolve(true); } });
    const root = document.getElementById('modal-root');
    const obs = new MutationObserver(() => { if (!root.firstChild) { obs.disconnect(); if (!done) resolve(false); } });
    obs.observe(root, { childList: true });
    return m;
  });

  L.formObject = (fd) => {
    const out = {};
    for (const [k, v] of fd.entries()) {
      if (k.endsWith('[]')) (out[k.slice(0, -2)] = out[k.slice(0, -2)] || []).push(v);
      else out[k] = typeof v === 'string' ? v.trim() : v;
    }
    return out;
  };

  /* ---------- Permissions (mirror of the server rules, for showing or hiding buttons) ---------- */
  L.can = {
    manageSettings: (u) => u.role === 'admin',
    addLead: (u) => u.role === 'admin' || u.role === 'manager',
    editStudent: (u, s) => u.role === 'admin' || (u.role === 'manager' && s && s.managerId === u.id),
    delete: (u) => u.role === 'admin',
    export: (u) => u.role === 'admin',
    assignManager: (u) => u.role === 'admin',
    seeAllStudents: (u) => u.role === 'admin',
    seeReports: (u) => u.role === 'admin',
    seeActivityLog: (u) => u.role === 'admin'
  };

  /* ---------- Sign-in log helpers ---------- */
  L.LOGIN_EVENTS = [['login', 'Signed in'], ['logout', 'Signed out'], ['failed', 'Failed sign-in']];
  L.loginBadge = (ev) => `<span class="badge ${ev === 'login' ? 'st-green' : ev === 'failed' ? 'st-red' : 'st-gray'}">${esc(L.label(L.LOGIN_EVENTS, ev))}</span>`;
  // "Chrome on Windows", "Safari on iPhone" … from a browser's user-agent text
  L.device = (ua) => {
    ua = String(ua || '');
    if (!ua) return 'Unknown device';
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
      : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
      : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'unknown system';
    return `${browser} on ${os}`;
  };

  /* ---------- Bars ---------- */
  L.bars = (rows, { hrefFor } = {}) => {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return `<div class="bars">${rows.map((r) => {
      const pct = r.value ? Math.max(2, Math.round((r.value / max) * 100)) : 0;
      const tag = hrefFor ? 'a' : 'div';
      const href = hrefFor ? ` href="${esc(hrefFor(r))}"` : '';
      return `<${tag} class="bar-row${r.value ? '' : ' zero'}"${href} aria-label="${esc(r.label)}: ${r.value}">
        <span class="name" title="${esc(r.label)}">${esc(r.label)}</span>
        <span class="track"><span class="fill" style="width:${pct}%;${r.color ? `background:${r.color}` : ''}"></span></span>
        <span class="count">${r.value}</span></${tag}>`;
    }).join('')}</div>`;
  };
})();
