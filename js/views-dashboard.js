/* Dashboard: headline numbers, students per phase, what needs attention, recent activity. */
(function () {
  const L = window.L;
  const esc = L.esc;
  L.views = L.views || {};

  L.activityText = (a) => {
    const who = a.userName ? `<span class="who">${esc(a.userName)}</span>` : '<span class="who">Someone</span>';
    return `${who} · ${esc(a.detail || a.action)}`;
  };

  L.views.dashboard = async (el, ctx) => {
    const u = ctx.user;
    const [sum, act, list] = await Promise.all([
      L.api.get('/reports/summary'),
      L.api.get('/reports/activity?limit=12'),
      L.api.get('/students')
    ]);
    const needsReview = list.students.filter((s) => s.pendingDocs > 0).slice(0, 8);
    const visaRate = sum.visa.approvalRate == null ? '—' : `${sum.visa.approvalRate}%`;
    const scopeNote = u.role === 'manager' ? 'Your assigned students' : 'All students';
    const phases = sum.byPhase.filter((p) => p.active || p.students);

    el.innerHTML = `
      <div class="page-head">
        <div><h1>Good ${greeting()}, ${esc(u.name.split(' ')[0])}</h1><p class="sub">${esc(scopeNote)} · ${esc(L.label(L.ROLES, u.role))}</p></div>
        <div class="actions">${L.can.addLead(u) ? `<button class="btn btn-primary" data-add-lead>${L.icon('plus')}Add lead</button>` : ''}
          <a class="btn" href="#/students">View students</a></div>
      </div>
      <div class="grid grid-4" style="margin-bottom:16px">
        ${kpi('Students', sum.totals.students, scopeNote)}
        ${kpi('New leads, last 30 days', sum.totals.new30d, 'Added in the last 30 days')}
        ${kpi('Documents to review', sum.totals.pendingDocs, 'Uploaded, not yet approved or rejected')}
        ${kpi('Visa approval rate', visaRate, `${sum.visa.approved} approved · ${sum.visa.rejected} rejected`)}
      </div>
      <div class="grid grid-3-1">
        <section class="card">
          <div class="card-head"><h2>Students by phase</h2><a href="#/reports" class="small">Full reports</a></div>
          <div class="card-body">${phases.length ? L.bars(phases.map((p) => ({ label: p.name, value: p.students, id: p.id })), { hrefFor: (r) => `#/students?phase=${r.id}` }) : '<p class="empty">No phases set up.</p>'}
          ${sum.unassigned ? `<p class="small muted" style="margin-top:12px"><a href="#/students?manager=none">${sum.unassigned} student${sum.unassigned === 1 ? '' : 's'} not assigned to a manager</a></p>` : ''}</div>
        </section>
        <section class="card">
          <div class="card-head"><h2>Documents waiting</h2></div>
          ${needsReview.length ? `<div class="table-wrap"><table><tbody>${needsReview.map((s) => `<tr>
              <td><div class="cell-title"><a href="#/students/${s.id}?tab=documents">${esc(s.fullName)}</a></div><div class="small soft">${esc(s.currentPhaseName || '')}</div></td>
              <td class="num"><span class="badge st-in_review">${s.pendingDocs}</span></td></tr>`).join('')}</tbody></table></div>`
            : '<p class="empty">Nothing waiting for review.</p>'}
        </section>
      </div>
      <section class="card" style="margin-top:16px">
        <div class="card-head"><h2>Recent activity</h2></div>
        ${act.activity.length ? `<ul class="timeline card-body">${act.activity.map((a) => `<li>
            <span class="when">${esc(L.fmtDateTime(a.createdAt))}</span>
            <span><a href="#/students/${a.studentId}" class="cell-title">${esc(a.studentName || '')}</a> — ${L.activityText(a)}</span></li>`).join('')}</ul>`
          : '<p class="empty">No activity yet.</p>'}
      </section>`;
    const add = el.querySelector('[data-add-lead]');
    if (add) add.addEventListener('click', () => L.leadForm(null, ctx));
  };

  function kpi(label, value, hint) {
    return `<div class="card kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="hint">${esc(hint)}</div></div>`;
  }
  function greeting() {
    const h = Number(L.nowIST().slice(11, 13));
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  }
})();
