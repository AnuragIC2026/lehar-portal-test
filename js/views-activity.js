/* Activity log (Admin only): counsellor overview, every sign-in, and everything everyone did. */
(function () {
  const L = window.L;
  const esc = L.esc;
  L.views = L.views || {};

  const PAGE = 50;

  L.lastSeen = (ts) => {
    if (!ts) return 'Never signed in';
    const day = ts.slice(0, 10);
    const today = L.todayIST();
    const y = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    const time = L.fmtDateTime(ts).split(', ').pop();
    if (day === today) return `Today, ${time}`;
    if (day === y) return `Yesterday, ${time}`;
    return L.fmtDateTime(ts);
  };

  L.counsellorCards = (list, { linkTo = true } = {}) => {
    if (!list.length) return '<p class="empty">No counsellors yet. Add them under Settings → Users.</p>';
    return `<div class="grid counsellor-grid">${list.map((c) => {
      const today = c.lastLoginAt && c.lastLoginAt.slice(0, 10) === L.todayIST();
      const tag = linkTo ? 'a' : 'div';
      return `<${tag} class="card counsellor-card${c.active ? '' : ' inactive'}"${linkTo ? ` href="#/activity?userId=${c.id}"` : ''}>
        <div class="row" style="flex-wrap:nowrap"><span class="avatar sm" aria-hidden="true">${esc(L.initials(c.name))}</span>
          <div style="min-width:0"><div class="cell-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</div>
          <div class="small soft">${c.active ? `${c.students} student${c.students === 1 ? '' : 's'}` : 'Deactivated'}</div></div></div>
        <div style="margin-top:8px">${today ? '<span class="badge st-green">Signed in today</span>' : '<span class="badge st-gray">Not signed in today</span>'}</div>
        <dl class="mini-dl"><div><dt>Last sign-in</dt><dd>${esc(L.lastSeen(c.lastLoginAt))}</dd></div>
          <div><dt>Today</dt><dd>${c.actionsToday} change${c.actionsToday === 1 ? '' : 's'}</dd></div>
          <div><dt>Last change</dt><dd>${c.lastActionAt ? esc(L.lastSeen(c.lastActionAt)) : '—'}</dd></div></dl>
      </${tag}>`;
    }).join('')}</div>`;
  };

  L.views.activity = async (el, ctx) => {
    const refs = L.state.refs;
    const people = [...refs.users].sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'manager' ? -1 : 1));
    const state = {
      tab: ctx.query.tab === 'actions' ? 'actions' : 'signins',
      userId: ctx.query.userId || '', from: ctx.query.from || '', to: ctx.query.to || '', event: ctx.query.event || '', q: ctx.query.q || ''
    };
    const { counsellors } = await L.api.get('/activity/counsellors');

    el.innerHTML = `
      <div class="page-head"><div><h1>Activity log</h1><p class="sub">When each counsellor signs in, and every change anyone makes (IST)</p></div></div>
      <section class="card" style="margin-bottom:16px">
        <div class="card-head"><h2>Counsellors</h2><span class="small muted">Click a counsellor to see only their activity</span></div>
        <div class="card-body">${L.counsellorCards(counsellors)}</div>
      </section>
      <section class="card">
        <div class="tabs" role="tablist" aria-label="Log type">
          <button role="tab" data-tab="signins" aria-selected="${state.tab === 'signins'}">Sign-ins</button>
          <button role="tab" data-tab="actions" aria-selected="${state.tab === 'actions'}">Changes</button>
        </div>
        <form class="filters log-filters" data-filters aria-label="Filter the log">
          <div class="field"><label for="lf-user">Person</label><select id="lf-user" name="userId">${L.options(people.map((p) => [p.id, `${p.name} (${L.label(L.ROLES, p.role)})`]), state.userId, { blank: 'Everyone' })}</select></div>
          <div class="field"><label for="lf-from">From</label><input id="lf-from" name="from" type="date" value="${esc(state.from)}"></div>
          <div class="field"><label for="lf-to">To</label><input id="lf-to" name="to" type="date" value="${esc(state.to)}"></div>
          <div class="field" data-only="signins"><label for="lf-ev">Event</label><select id="lf-ev" name="event">${L.options(L.LOGIN_EVENTS, state.event, { blank: 'All events' })}</select></div>
          <div class="field" data-only="actions"><label for="lf-q">Search</label><input id="lf-q" name="q" type="search" placeholder="Student or change" value="${esc(state.q)}"></div>
          <div class="field" style="align-self:end"><button type="button" class="btn" data-clear>Clear filters</button></div>
        </form>
        <div data-results><div class="empty">Loading…</div></div>
      </section>`;

    const form = el.querySelector('[data-filters]');
    const results = el.querySelector('[data-results]');
    let items = [];
    let total = 0;

    function syncForm() {
      el.querySelectorAll('[data-only]').forEach((f) => { f.hidden = f.dataset.only !== state.tab; });
      el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    }
    function readForm() {
      const d = L.formObject(new FormData(form));
      Object.assign(state, { userId: d.userId || '', from: d.from || '', to: d.to || '', event: d.event || '', q: d.q || '' });
    }
    function qs(offset) {
      const p = { userId: state.userId, from: state.from, to: state.to, limit: PAGE, offset };
      if (state.tab === 'signins') p.event = state.event; else p.q = state.q;
      return new URLSearchParams(Object.entries(p).filter(([, v]) => v !== '' && v != null)).toString();
    }
    async function load(more = false) {
      L.setQuery({ tab: state.tab === 'actions' ? 'actions' : '', userId: state.userId, from: state.from, to: state.to,
        event: state.tab === 'signins' ? state.event : '', q: state.tab === 'actions' ? state.q : '' });
      const path = state.tab === 'signins' ? '/activity/logins' : '/activity/log';
      const res = await L.api.get(`${path}?${qs(more ? items.length : 0)}`);
      items = more ? items.concat(res.items) : res.items;
      total = res.total;
      results.innerHTML = state.tab === 'signins' ? signinTable() : actionTable();
    }
    function moreButton() {
      return `<div class="row" style="padding:12px 16px"><span class="small soft">Showing ${items.length} of ${total}</span><span class="spacer"></span>
        ${items.length < total ? '<button class="btn btn-sm" data-more>Show more</button>' : ''}</div>`;
    }
    function signinTable() {
      if (!items.length) return '<div class="empty">No sign-ins match these filters.</div>';
      return `<div class="table-wrap"><table><caption class="sr-only">Sign-ins</caption>
        <thead><tr><th>When</th><th>Person</th><th>Event</th><th class="hide-sm">Device</th><th class="hide-sm">IP address</th></tr></thead>
        <tbody>${items.map((l) => `<tr>
          <td class="nowrap">${esc(L.fmtDateTime(l.createdAt))}</td>
          <td>${l.userName ? `<span class="cell-title">${esc(l.userName)}</span> <span class="small soft">${esc(L.label(L.ROLES, l.userRole))}</span>` : '<span class="muted">No account</span>'}
            <div class="small soft">${esc(l.email || '')}</div></td>
          <td>${L.loginBadge(l.event)}</td>
          <td class="hide-sm" title="${esc(l.userAgent || '')}">${esc(L.device(l.userAgent))}</td>
          <td class="hide-sm small">${esc(l.ip || '—')}</td></tr>`).join('')}</tbody></table></div>${moreButton()}`;
    }
    function actionTable() {
      if (!items.length) return '<div class="empty">No changes match these filters.</div>';
      return `<div class="table-wrap"><table><caption class="sr-only">Changes</caption>
        <thead><tr><th>When</th><th>Person</th><th>Student</th><th>What happened</th></tr></thead>
        <tbody>${items.map((a) => `<tr>
          <td class="nowrap">${esc(L.fmtDateTime(a.createdAt))}</td>
          <td><span class="cell-title">${esc(a.userName || 'Someone')}</span>${a.userRole ? `<div class="small soft">${esc(L.label(L.ROLES, a.userRole))}</div>` : ''}</td>
          <td>${a.studentId ? `<a href="#/students/${a.studentId}">${esc(a.studentName || 'Student')}</a>` : '<span class="soft">—</span>'}</td>
          <td>${esc(a.detail || a.action)}</td></tr>`).join('')}</tbody></table></div>${moreButton()}`;
    }

    syncForm();
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      state.tab = b.dataset.tab; syncForm(); load().catch(L.fail);
    }));
    let timer;
    form.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => { readForm(); load().catch(L.fail); }, e.target.type === 'search' ? 300 : 0);
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    el.querySelector('[data-clear]').addEventListener('click', () => {
      form.reset();
      form.querySelectorAll('input').forEach((i) => { i.value = ''; });
      form.querySelectorAll('select').forEach((s) => { s.value = ''; });
      readForm(); load().catch(L.fail);
    });
    results.addEventListener('click', (e) => { if (e.target.closest('[data-more]')) load(true).catch(L.fail); });
    await load();
  };
})();
