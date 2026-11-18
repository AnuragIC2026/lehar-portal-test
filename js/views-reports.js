/* Reports: pipeline by phase, per manager, results by country and university, visa outcomes, lead sources, Excel export. */
(function () {
  const L = window.L;
  const esc = L.esc;
  L.views = L.views || {};

  const pct = (v) => (v == null ? '<span class="soft">—</span>' : `${v}%`);

  L.views.reports = async (el, ctx) => {
    const u = ctx.user;
    const sum = await L.api.get('/reports/summary');
    const phases = sum.byPhase.filter((p) => p.active || p.students);
    const v = sum.visa;
    el.innerHTML = `
      <div class="page-head">
        <div><h1>Reports</h1><p class="sub">${u.role === 'manager' ? 'Your assigned students' : 'All students'} · figures update as soon as anything changes</p></div>
        <div class="actions">${L.can.export(u) ? `<button class="btn btn-primary" data-export>${L.icon('download')}Export to Excel</button>` : ''}</div>
      </div>
      <div class="grid grid-2">
        <section class="card">
          <div class="card-head"><h2>Pipeline by phase</h2><span class="small muted">${sum.totals.students} students</span></div>
          <div class="card-body">${L.bars(phases.map((p) => ({ label: p.name, value: p.students, id: p.id })), { hrefFor: (r) => `#/students?phase=${r.id}` })}</div>
        </section>
        <section class="card">
          <div class="card-head"><h2>Visa outcomes</h2><span class="small muted">From the “Visa result” phase</span></div>
          <div class="card-body">
            <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
              ${mini('Approval rate', v.approvalRate == null ? '—' : `${v.approvalRate}%`)}${mini('Approved', v.approved)}${mini('Rejected', v.rejected)}${mini('Waiting', v.in_review + v.pending)}
            </div>
            <h3 style="margin:20px 0 10px">Lead sources</h3>
            ${sum.leadSources.length ? L.bars(sum.leadSources.map((s) => ({ label: s.source, value: s.students })), {}) : '<p class="muted">No leads yet.</p>'}
          </div>
        </section>
      </div>
      <section class="card" style="margin-top:16px">
        <div class="card-head"><h2>By manager</h2>${sum.unassigned ? `<a class="small" href="#/students?manager=none">${sum.unassigned} not assigned</a>` : ''}</div>
        ${sum.byManager.length ? `<div class="table-wrap"><table><caption class="sr-only">Students by manager</caption>
          <thead><tr><th>Manager</th><th class="num">Students</th><th class="num">Documents to review</th><th class="num">Awaiting university decision</th><th class="num">Offers accepted</th></tr></thead>
          <tbody>${sum.byManager.map((m) => `<tr><td class="cell-title">${L.can.seeAllStudents(u) ? `<a href="#/students?manager=${m.id}">${esc(m.name)}</a>` : esc(m.name)}</td>
            <td class="num">${m.students}</td><td class="num">${m.pendingDocs ? `<span class="badge st-in_review">${m.pendingDocs}</span>` : '0'}</td>
            <td class="num">${m.awaitingDecision}</td><td class="num">${m.accepted}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No active managers.</p>'}
      </section>
      <section class="card" style="margin-top:16px">
        <div class="card-head"><h2>Results by country</h2></div>
        ${resultsTable(sum.byCountry, false)}
      </section>
      <section class="card" style="margin-top:16px">
        <div class="card-head"><h2>Results by university</h2></div>
        ${resultsTable(sum.byUniversity, true)}
      </section>
      <p class="small soft" style="margin-top:12px">Acceptance rate = accepted ÷ (accepted + rejected). “Waiting” means applied with no decision yet. Waiting and waitlisted applications are not counted in the rate.</p>`;
    const ex = el.querySelector('[data-export]');
    if (ex) ex.addEventListener('click', () => L.api.exportExcel());
  };

  function mini(label, value) {
    return `<div style="border:1px solid var(--line);border-radius:10px;padding:12px"><div class="small muted">${esc(label)}</div>
      <div style="font-family:Outfit,sans-serif;font-size:24px;font-weight:700;color:var(--navy)">${esc(value)}</div></div>`;
  }
  function resultsTable(rows, withCountry) {
    if (!rows.length) return '<p class="empty">No applications yet.</p>';
    return `<div class="table-wrap"><table>
      <thead><tr><th>${withCountry ? 'University' : 'Country'}</th><th class="num">Applications</th><th class="num">Accepted</th><th class="num">Rejected</th><th class="num">Waitlisted</th><th class="num">Waiting</th><th class="num">Acceptance rate</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td><span class="cell-title">${esc(r.name)}</span>${withCountry ? `<div class="small soft">${esc(r.country)}</div>` : ''}</td>
        <td class="num">${r.total}</td><td class="num">${r.accepted}</td><td class="num">${r.rejected}</td><td class="num">${r.waitlisted}</td><td class="num">${r.applied}</td><td class="num">${pct(r.acceptanceRate)}</td></tr>`).join('')}</tbody></table></div>`;
  }
})();
