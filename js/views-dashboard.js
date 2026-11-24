/* Dashboard.
   Admin: headline numbers for everyone, students per phase, counsellor sign-ins, recent changes.
   Counsellor: their own assigned students only (no reports). */
(function () {
  const L = window.L;
  const esc = L.esc;
  L.views = L.views || {};

  L.activityText = (a) => {
    const who = a.userName ? `<span class="who">${esc(a.userName)}</span>` : '<span class="who">Someone</span>';
    return `${who} · ${esc(a.detail || a.action)}`;
  };

  function kpi(label, value, hint) {
    return `<div class="card kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="hint">${esc(hint)}</div></div>`;
  }
  function greeting() {
    const h = Number(L.nowIST().slice(11, 13));
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  }
  function waitingCard(students) {
    const needsReview = students.filter((s) => s.pendingDocs > 0).slice(0, 8);
    return `<section class="card">
      <div class="card-head"><h2>Documents waiting</h2></div>
      ${needsReview.length ? `<div class="table-wrap"><table><tbody>${needsReview.map((s) => `<tr>
          <td><div class="cell-title"><a href="#/students/${s.id}?tab=documents">${esc(s.fullName)}</a></div><div class="small soft">${esc(s.currentPhaseName || '')}</div></td>
          <td class="num"><span class="badge st-in_review">${s.pendingDocs}</span></td></tr>`).join('')}</tbody></table></div>`
        : '<p class="empty">Nothing waiting for review.</p>'}
    </section>`;
  }
  function recentCard(activity, title = 'Recent changes') {
    return `<section class="card" style="margin-top:16px">
      <div class="card-head"><h2>${esc(title)}</h2></div>
      ${activity.length ? `<ul class="timeline card-body">${activity.map((a) => `<li>
          <span class="when">${esc(L.fmtDateTime(a.createdAt))}</span>
          <span><a href="#/students/${a.studentId}" class="cell-title">${esc(a.studentName || '')}</a> — ${L.activityText(a)}</span></li>`).join('')}</ul>`
        : '<p class="empty">No changes yet.</p>'}
    </section>`;
  }
  function phaseBars(rows) {
    return rows.length ? L.bars(rows, { hrefFor: (r) => `#/students?phase=${r.id}` }) : '<p class="empty">No phases set up.</p>';
  }

  L.views.dashboard = async (el, ctx) => {
    const u = ctx.user;
    const unreadNotice = `<a class="notice unread-notice" href="#/messages" data-unread-notice hidden>${L.icon('chat')}<strong data-unread-count></strong><span>${L.isStaff(u) ? 'from counsellors' : 'from the Admin team'} · Open Messages</span></a>`;
    const head = (sub) => unreadNotice + `<div class="page-head">
        <div><h1>Good ${greeting()}, ${esc(u.name.split(' ')[0])}</h1><p class="sub">${esc(sub)}</p></div>
        <div class="actions">${L.can.addLead(u) ? `<button class="btn btn-primary" data-add-lead>${L.icon('plus')}Add lead</button>` : ''}
          <a class="btn" href="#/students">${L.isStaff(u) ? 'View students' : 'My students'}</a></div>
      </div>`;

    if (L.isStaff(u)) {
      const [sum, act, list, team] = await Promise.all([
        L.api.get('/reports/summary'), L.api.get('/activity/recent?limit=10'), L.api.get('/students'), L.api.get('/activity/counsellors')
      ]);
      const visaRate = sum.visa.approvalRate == null ? '—' : `${sum.visa.approvalRate}%`;
      const phases = sum.byPhase.filter((p) => p.active || p.students).map((p) => ({ label: p.name, value: p.students, id: p.id }));
      const signedInToday = team.counsellors.filter((c) => c.active && c.lastLoginAt && c.lastLoginAt.slice(0, 10) === L.todayIST()).length;
      const activeCounsellors = team.counsellors.filter((c) => c.active).length;
      el.innerHTML = head('All students · Admin') + `
        <div class="grid grid-4" style="margin-bottom:16px">
          ${kpi('Students', sum.totals.students, `${sum.unassigned} not assigned to a counsellor`)}
          ${kpi('New leads, last 30 days', sum.totals.new30d, 'Added in the last 30 days')}
          ${kpi('Documents to review', sum.totals.pendingDocs, 'Uploaded, not yet approved or rejected')}
          ${kpi('Counsellors signed in today', `${signedInToday} / ${activeCounsellors}`, 'See the Activity log for details')}
        </div>
        <section class="card" style="margin-bottom:16px">
          <div class="card-head"><h2>Counsellors</h2><a href="#/activity" class="small">Full activity log</a></div>
          <div class="card-body">${L.counsellorCards(team.counsellors)}</div>
        </section>
        <div class="grid grid-3-1">
          <section class="card">
            <div class="card-head"><h2>Students by phase</h2><a href="#/reports" class="small">Reports · visa rate ${esc(visaRate)}</a></div>
            <div class="card-body">${phaseBars(phases)}
            ${sum.unassigned ? `<p class="small muted" style="margin-top:12px"><a href="#/students?manager=none">${sum.unassigned} student${sum.unassigned === 1 ? '' : 's'} not assigned to a counsellor</a></p>` : ''}</div>
          </section>
          ${waitingCard(list.students)}
        </div>
        ${recentCard(act.activity)}`;
    } else {
      const [list, act] = await Promise.all([L.api.get('/students'), L.api.get('/activity/recent?limit=10')]);
      const mine = list.students;
      const cutoff = new Date(Date.now() + 5.5 * 3600 * 1000 - 30 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      const counts = {};
      mine.forEach((s) => { counts[s.currentPhaseId] = (counts[s.currentPhaseId] || 0) + 1; });
      const phases = L.state.refs.phases.filter((p) => p.active || counts[p.id]).map((p) => ({ label: p.name, value: counts[p.id] || 0, id: p.id }));
      el.innerHTML = head('Students assigned to you · Counsellor') + `
        <div class="grid grid-4" style="margin-bottom:16px">
          ${kpi('My students', mine.length, 'Assigned to you by the Admin')}
          ${kpi('New in the last 30 days', mine.filter((s) => s.createdAt >= cutoff).length, 'Leads added in the last 30 days')}
          ${kpi('Documents to review', mine.reduce((n, s) => n + s.pendingDocs, 0), 'Waiting for your review')}
          ${kpi('Offers accepted', mine.reduce((n, s) => n + s.acceptedCount, 0), 'Across all your students')}
        </div>
        <div class="grid grid-3-1">
          <section class="card">
            <div class="card-head"><h2>My students by phase</h2></div>
            <div class="card-body">${mine.length ? phaseBars(phases) : '<p class="empty">No students assigned to you yet. The Admin assigns students to counsellors.</p>'}</div>
          </section>
          ${waitingCard(mine)}
        </div>
        ${recentCard(act.activity, 'Recent changes on my students')}`;
    }
    const add = el.querySelector('[data-add-lead]');
    if (add) add.addEventListener('click', () => L.leadForm(null, ctx));
  };
})();
