/* App shell: picks the live or demo API, handles sign-in state, routing and the sidebar. */
(function () {
  const L = window.L;
  const esc = L.esc;
  const cfg = window.LEHAR_CONFIG || {};
  const isDemo = cfg.mode === 'demo' || (cfg.mode !== 'live' && (location.protocol === 'file:' || /\.github\.io$/.test(location.hostname)));
  L.api = isDemo ? L.apiDemo : L.apiLive;
  L.isDemo = isDemo;
  L.state = { user: null, refs: null };
  L.views = L.views || {};

  /* ---------- Reference data (phases, universities, users) ---------- */
  L.loadRefs = async function (force = false) {
    if (L.state.refs && !force) return L.state.refs;
    const [ph, un, us] = await Promise.all([L.api.get('/settings/phases'), L.api.get('/settings/universities'), L.api.get('/users/lite')]);
    L.state.refs = { phases: ph.phases, universities: un.universities, users: us.users };
    return L.state.refs;
  };
  L.managers = () => (L.state.refs ? L.state.refs.users.filter((u) => u.role === 'manager' && u.active) : []);

  /* ---------- Routing ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/dashboard';
    const [path, qs] = raw.split('?');
    return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  L.go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
  L.refresh = () => render();
  L.setQuery = (query) => {
    const { path } = parseHash();
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString();
    history.replaceState(null, '', `#${path}${qs ? `?${qs}` : ''}`);
  };

  const PUBLIC = ['/login', '/forgot'];
  const ROUTES = [
    { re: /^\/login$/, view: 'login', public: true },
    { re: /^\/forgot$/, view: 'forgot', public: true },
    { re: /^\/change-password$/, view: 'changePassword', bare: true },
    { re: /^\/dashboard$/, view: 'dashboard', nav: 'dashboard' },
    { re: /^\/students$/, view: 'students', nav: 'students' },
    { re: /^\/students\/(\d+)$/, view: 'student', nav: 'students', params: ['id'] },
    { re: /^\/reports$/, view: 'reports', nav: 'reports' },
    { re: /^\/settings\/users$/, view: 'users', nav: 'users', admin: true },
    { re: /^\/settings\/phases$/, view: 'phases', nav: 'phases', admin: true },
    { re: /^\/settings\/universities$/, view: 'universities', nav: 'universities', admin: true },
    { re: /^\/outbox$/, view: 'outbox', nav: 'outbox', admin: true, demoOnly: true }
  ];

  L.onAuthError = (err) => {
    if (err.code === 'MUST_CHANGE_PASSWORD') { if (parseHash().path !== '/change-password') L.go('#/change-password'); return; }
    L.state.user = null;
    L.state.refs = null;
    if (!PUBLIC.includes(parseHash().path)) L.go('#/login');
  };

  let renderSeq = 0;
  async function render() {
    const seq = ++renderSeq;
    const { path, query } = parseHash();
    const app = document.getElementById('app');
    document.getElementById('modal-root').innerHTML = '';
    const r = ROUTES.find((x) => x.re.test(path));
    if (!r) return L.go('#/dashboard');

    if (!r.public && !L.state.user) {
      try {
        const me = await L.api.get('/auth/me');
        L.state.user = me.user;
      } catch (e) {
        if (seq === renderSeq) L.go('#/login');
        return;
      }
    }
    const user = L.state.user;
    if (r.public && user && !user.mustChangePassword) return L.go('#/dashboard');
    if (user && user.mustChangePassword && r.view !== 'changePassword' && !r.public) return L.go('#/change-password');
    if (r.admin && user.role !== 'admin') return L.go('#/dashboard');
    if (r.demoOnly && !L.isDemo) return L.go('#/dashboard');

    const params = {};
    if (r.params) { const m = path.match(r.re); r.params.forEach((k, i) => { params[k] = m[i + 1]; }); }
    const ctx = { user, query, params, path };

    let target;
    if (r.public || r.bare) {
      app.innerHTML = '<div class="view"></div>';
      target = app.firstElementChild;
    } else {
      if (!app.querySelector('.shell')) app.innerHTML = shellHtml(user);
      else updateShell(user);
      markNav(r.nav);
      const main = app.querySelector('.page');
      main.innerHTML = '<div class="view"><div class="boot">Loading…</div></div>';
      target = main.firstElementChild;
      app.querySelector('.shell').classList.remove('nav-open');
    }
    try {
      if (!r.public && !r.bare) await L.loadRefs();
      if (seq !== renderSeq) return;
      await L.views[r.view](target, ctx);
      const h1 = target.querySelector('h1');
      document.title = `${h1 ? h1.textContent + ' · ' : ''}Lehar · Samudra Global`;
    } catch (err) {
      if (err.status === 401 || err.code === 'MUST_CHANGE_PASSWORD') return;
      target.innerHTML = `<div class="card card-pad"><div class="notice err">${esc(err.message || 'Could not load this page.')}</div></div>`;
    }
  }

  /* ---------- Shell ---------- */
  function navLink(href, key, icon, label) {
    return `<a href="${href}" data-nav="${key}">${L.icon(icon)}<span>${esc(label)}</span></a>`;
  }
  function shellHtml(user) {
    return `<div class="shell" data-uid="${esc(user.id)}">
      <aside class="sidebar" aria-label="Main menu">
        <div class="brand"><a href="#/dashboard" aria-label="Lehar home">${L.logo({ variant: 'white', width: 150 })}</a><div class="by">An initiative of Samudra Global</div></div>
        <nav class="nav" data-nav-links>${navLinks(user)}</nav>
        <div class="me" data-me>${meHtml(user)}</div>
      </aside>
      <div class="main">
        <div class="topbar"><button class="icon-btn" data-action="open-nav" aria-label="Open menu">${L.icon('menu')}</button>
          <a href="#/dashboard" aria-label="Lehar home">${L.logo({ variant: 'white', width: 96, className: 'logo' })}</a></div>
        ${L.isDemo ? `<div class="demo-bar"><strong>Demo</strong><span>Sample data stays in this browser. Emails appear in the Demo outbox instead of being sent.</span>
          <button class="btn btn-sm" data-action="reset-demo">Reset demo data</button></div>` : ''}
        <main class="page" id="main"></main>
      </div>
    </div>`;
  }
  function navLinks(user) {
    let html = navLink('#/dashboard', 'dashboard', 'dashboard', 'Dashboard') +
      navLink('#/students', 'students', 'students', 'Students') +
      navLink('#/reports', 'reports', 'reports', 'Reports');
    if (user.role === 'admin') {
      html += '<div class="group">Settings</div>' +
        navLink('#/settings/users', 'users', 'users', 'Users') +
        navLink('#/settings/phases', 'phases', 'phases', 'Journey phases') +
        navLink('#/settings/universities', 'universities', 'university', 'Universities');
      if (L.isDemo) html += navLink('#/outbox', 'outbox', 'mail', 'Demo outbox');
    }
    return html;
  }
  function meHtml(user) {
    return `<div class="name">${esc(user.name)}</div><div class="role">${esc(L.label(L.ROLES, user.role))} · ${esc(user.email)}</div>
      <div class="links"><button type="button" data-action="change-password">Change password</button><button type="button" data-action="logout">Sign out</button></div>`;
  }
  function updateShell(user) {
    const shell = document.querySelector('.shell');
    if (shell.dataset.uid !== String(user.id)) {
      shell.dataset.uid = String(user.id);
      shell.querySelector('[data-nav-links]').innerHTML = navLinks(user);
      shell.querySelector('[data-me]').innerHTML = meHtml(user);
    }
  }
  function markNav(key) {
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === key;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      const shell = document.querySelector('.shell.nav-open');
      if (shell && !e.target.closest('.sidebar')) shell.classList.remove('nav-open');
      return;
    }
    const action = btn.dataset.action;
    if (action === 'open-nav') { e.stopPropagation(); document.querySelector('.shell').classList.add('nav-open'); }
    if (action === 'logout') {
      await L.api.post('/auth/logout').catch(() => {});
      L.state.user = null; L.state.refs = null;
      document.getElementById('app').innerHTML = '';
      L.go('#/login');
    }
    if (action === 'change-password') L.go('#/change-password');
    if (action === 'reset-demo') {
      if (await L.confirm('Reset demo data?', 'This puts back the original sample students and signs you out. Changes you made in the demo will be lost.', { confirmLabel: 'Reset demo' })) {
        L.apiDemo.reset();
        L.state.user = null; L.state.refs = null;
        document.getElementById('app').innerHTML = '';
        L.go('#/login');
      }
    }
  });

  window.addEventListener('hashchange', render);
  render();
})();
