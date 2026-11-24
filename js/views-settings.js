/* Admin settings: users, journey phases, university master list, and the demo email outbox. */
(function () {
  const L = window.L;
  const esc = L.esc;
  L.views = L.views || {};

  function showTempPassword(name, email, password, isReset) {
    L.modal({
      title: isReset ? 'Password reset' : 'User added',
      size: 'sm', hideSubmit: true, cancelLabel: 'Done',
      body: `<p>${isReset ? `A new temporary password for <strong>${esc(name)}</strong>:` : `<strong>${esc(name)}</strong> can now sign in as ${esc(email)} with this temporary password:`}</p>
        <div class="temp-pass">${esc(password)}</div>
        <p class="small muted">${L.isDemo ? 'Demo: the email is in the Demo outbox.' : 'It has also been emailed to them.'} They must choose their own password the first time they sign in. This password is not shown again.</p>`
    });
  }

  /* ---------- Users ---------- */
  L.views.users = async (el, ctx) => {
    const me = ctx.user;
    const { users } = await L.api.get('/users');
    const isAdmin = me.role === 'admin'; // Managers get a read-only list of the Counsellors
    el.innerHTML = `
      <div class="page-head"><div><h1>${isAdmin ? 'Users' : 'Counsellors'}</h1><p class="sub">${isAdmin ? 'Who can sign in, and what they can do' : 'Read only. Only the Admin can add, change or remove people.'}</p></div>
        ${isAdmin ? `<div class="actions"><button class="btn btn-primary" data-add>${L.icon('plus')}Add user</button></div>` : ''}</div>
      <section class="card" style="margin-bottom:16px"><div class="card-body grid grid-3" style="gap:16px">
        <div>${L.roleBadge('admin')}<p class="small muted" style="margin-top:6px">Everything: all students, assigning students to counsellors, reports, the activity log, users, settings, deleting and Excel export.</p></div>
        <div>${L.roleBadge('supervisor')}<p class="small muted" style="margin-top:6px">Everything an Admin does except adding, changing or removing users, and deleting. Sees all students and assigns them, sees reports, the Counsellors and their sign-ins and changes, edits phases and universities, and joins every counsellor chat.</p></div>
        <div>${L.roleBadge('manager')}<p class="small muted" style="margin-top:6px">Only the students assigned to them: add and edit leads, move phases, set statuses, applications, upload and review documents. No reports, no deleting.</p></div>
      </div></section>
      <section class="card"><div class="table-wrap"><table><caption class="sr-only">Users</caption>
        <thead><tr><th>Name</th><th>Role</th><th class="num">Students</th><th class="hide-sm">Last sign-in</th><th class="num hide-sm">Sign-ins (30 days)</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${users.map((x) => `<tr>
          <td><div class="cell-title">${esc(x.name)}${x.id === me.id ? ' <span class="small soft">(you)</span>' : ''}</div><div class="small soft">${esc(x.email)}</div></td>
          <td>${L.roleBadge(x.role)}</td>
          <td class="num">${x.role === 'manager' ? x.studentCount : '<span class="soft">—</span>'}</td>
          <td class="hide-sm small">${x.lastLoginAt ? esc(L.lastSeen(x.lastLoginAt)) : '<span class="soft">Never</span>'}</td>
          <td class="num hide-sm"><a href="#/activity?userId=${x.id}" aria-label="Sign-in history for ${esc(x.name)}">${x.logins30d || 0}</a></td>
          <td>${x.active ? (x.mustChangePassword ? '<span class="badge st-amber">Password not set yet</span>' : '<span class="badge st-green">Active</span>') : '<span class="badge st-gray">Deactivated</span>'}</td>
          <td class="nowrap" style="text-align:right"><a class="btn btn-sm" href="#/activity?userId=${x.id}">Activity</a>${isAdmin ? ` <button class="btn btn-sm" data-edit="${x.id}">Edit</button>
            <button class="btn btn-sm" data-reset="${x.id}">Reset password</button>
            ${x.id !== me.id ? `<button class="btn btn-sm btn-danger" data-del="${x.id}" aria-label="Delete ${esc(x.name)}">${L.icon('trash')}</button>` : ''}` : ''}</td></tr>`).join('')}
        </tbody></table></div></section>`;

    if (!isAdmin) return; // nothing to change for a Manager
    el.querySelector('[data-add]').addEventListener('click', () => L.modal({
      title: 'Add user', submitLabel: 'Add user',
      body: `<div class="field"><label for="nu-name">Name <span class="req">*</span></label><input id="nu-name" name="name" type="text" required></div>
        <div class="field"><label for="nu-email">Email <span class="req">*</span></label><input id="nu-email" name="email" type="email" required></div>
        <div class="field"><label for="nu-role">Role <span class="req">*</span></label><select id="nu-role" name="role">${L.options(L.ROLES, 'manager')}</select></div>
        <p class="small muted">A temporary password is created and emailed. They set their own password the first time they sign in.</p>`,
      onSubmit: async (fd) => {
        const d = L.formObject(fd);
        if (!d.name || !/^\S+@\S+\.\S+$/.test(d.email || '')) throw new Error('Enter a name and a valid email.');
        const res = await L.api.post('/users', d);
        await L.loadRefs(true);
        L.refresh();
        setTimeout(() => showTempPassword(res.user.name, res.user.email, res.tempPassword, false), 50);
      }
    }));
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-edit],[data-reset],[data-del]');
      if (!b) return;
      const id = Number(b.dataset.edit || b.dataset.reset || b.dataset.del);
      const x = users.find((y) => y.id === id);
      try {
        if (b.dataset.edit) {
          L.modal({
            title: `Edit ${x.name}`,
            body: `<div class="field"><label for="eu-name">Name</label><input id="eu-name" name="name" type="text" value="${esc(x.name)}"></div>
              <div class="field"><span class="label-text">Email</span><span class="muted">${esc(x.email)}</span></div>
              <div class="field"><label for="eu-role">Role</label><select id="eu-role" name="role"${x.id === me.id ? ' disabled' : ''}>${L.options(L.ROLES, x.role)}</select>
                ${x.role === 'manager' && x.studentCount ? `<span class="help">If this person stops being a Counsellor, their ${x.studentCount} students become unassigned.</span>` : ''}</div>
              ${x.id !== me.id ? `<div class="checks"><label><input type="checkbox" name="active" value="1"${x.active ? ' checked' : ''}> Account active (can sign in)</label></div>` : ''}`,
            onSubmit: async (fd) => {
              const d = L.formObject(fd);
              const body = { name: d.name };
              if (x.id !== me.id) { body.role = d.role; body.active = d.active === '1'; }
              await L.api.patch(`/users/${x.id}`, body);
              await L.loadRefs(true);
              L.toast('User updated.');
              L.refresh();
            }
          });
        }
        if (b.dataset.reset) {
          if (await L.confirm(`Reset ${x.name}'s password?`, 'They get a new temporary password and must choose their own when they next sign in.', { confirmLabel: 'Reset password', danger: false })) {
            const res = await L.api.post(`/users/${x.id}/reset-password`);
            L.refresh();
            setTimeout(() => showTempPassword(x.name, x.email, res.tempPassword, true), 50);
          }
        }
        if (b.dataset.del) {
          if (await L.confirm(`Delete ${x.name}?`, `${x.role === 'manager' && x.studentCount ? `Their ${x.studentCount} students become unassigned. ` : ''}Their past activity stays in the history. To keep the account but stop sign-in, use Edit → Account active instead.`, { confirmLabel: 'Delete user' })) {
            await L.api.del(`/users/${x.id}`);
            await L.loadRefs(true);
            L.toast('User deleted.');
            L.refresh();
          }
        }
      } catch (err) { L.fail(err); }
    });
  };

  /* ---------- Phases ---------- */
  L.views.phases = async (el) => {
    const { phases } = await L.api.get('/settings/phases');
    el.innerHTML = `
      <div class="page-head"><div><h1>Journey phases</h1><p class="sub">The steps every student goes through, in order</p></div>
        <div class="actions"><button class="btn btn-primary" data-add>${L.icon('plus')}Add phase</button></div></div>
      <section class="card">
        <div class="card-body"><p class="muted small">Rename a phase by editing its name. Use the arrows to change the order. A phase students have already used is hidden instead of deleted, so their history stays intact. Mark one phase as the visa result so the visa approval rate can be reported.</p></div>
        <ol class="phase-list">${phases.map((p, i) => `<li class="${p.active ? '' : 'hidden-phase'}" data-id="${p.id}">
          <span class="num">${i + 1}</span>
          <span class="pname row"><label class="sr-only" for="pn-${p.id}">Phase ${i + 1} name</label><input id="pn-${p.id}" type="text" value="${esc(p.name)}" data-name="${p.id}">
            ${p.isVisaResult ? '<span class="badge st-blue plain">Visa result</span>' : ''}${p.active ? '' : '<span class="badge st-gray plain">Hidden</span>'}</span>
          <span class="row nowrap">
            <button class="icon-btn" data-up="${p.id}" aria-label="Move ${esc(p.name)} up"${i === 0 ? ' disabled' : ''}>${L.icon('up')}</button>
            <button class="icon-btn" data-down="${p.id}" aria-label="Move ${esc(p.name)} down"${i === phases.length - 1 ? ' disabled' : ''}>${L.icon('down')}</button>
            ${p.isVisaResult ? '' : `<button class="btn btn-sm" data-visa="${p.id}">Set as visa result</button>`}
            ${p.active ? `<button class="btn btn-sm btn-danger" data-remove="${p.id}">Remove</button>` : `<button class="btn btn-sm" data-show="${p.id}">Show again</button>`}
          </span></li>`).join('')}</ol>
      </section>`;
    const ids = phases.map((p) => p.id);
    const done = async (msg) => { await L.loadRefs(true); if (msg) L.toast(msg); L.refresh(); };
    el.querySelector('[data-add]').addEventListener('click', () => L.modal({
      title: 'Add phase', size: 'sm', submitLabel: 'Add',
      body: '<div class="field"><label for="np-name">Phase name</label><input id="np-name" name="name" type="text" required placeholder="e.g. Loan approval"></div><p class="small muted">It is added at the end. Move it with the arrows afterwards.</p>',
      onSubmit: async (fd) => { const name = String(fd.get('name') || '').trim(); if (!name) throw new Error('Enter a phase name.'); await L.api.post('/settings/phases', { name }); await done('Phase added.'); }
    }));
    el.addEventListener('change', async (e) => {
      const inp = e.target.closest('[data-name]');
      if (!inp) return;
      try { await L.api.patch(`/settings/phases/${inp.dataset.name}`, { name: inp.value }); await L.loadRefs(true); L.toast('Phase renamed.'); }
      catch (err) { L.fail(err); L.refresh(); }
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b || b.hasAttribute('data-add')) return;
      try {
        if (b.dataset.up || b.dataset.down) {
          const id = Number(b.dataset.up || b.dataset.down);
          const i = ids.indexOf(id);
          const j = b.dataset.up ? i - 1 : i + 1;
          [ids[i], ids[j]] = [ids[j], ids[i]];
          await L.api.post('/settings/phases/reorder', { ids });
          await done();
        }
        if (b.dataset.visa) { await L.api.patch(`/settings/phases/${b.dataset.visa}`, { isVisaResult: true }); await done('Visa result phase set.'); }
        if (b.dataset.show) { await L.api.patch(`/settings/phases/${b.dataset.show}`, { active: true }); await done('Phase shown again.'); }
        if (b.dataset.remove) {
          const p = phases.find((x) => x.id === Number(b.dataset.remove));
          if (await L.confirm(`Remove “${p.name}”?`, 'If any student has used this phase it is hidden instead, and their history stays. Otherwise it is deleted.', { confirmLabel: 'Remove phase' })) {
            const res = await L.api.del(`/settings/phases/${p.id}`);
            await done(res.message || 'Phase removed.');
          }
        }
      } catch (err) { L.fail(err); }
    });
  };

  /* ---------- Universities ---------- */
  L.views.universities = async (el, ctx) => {
    const { universities } = await L.api.get('/settings/universities');
    const countries = [...new Set([...L.COUNTRIES.filter((c) => c !== 'Other'), ...universities.map((u) => u.country)])].sort();
    let filter = ctx.query.country || '';
    function rows() {
      const list = universities.filter((u) => !filter || u.country === filter);
      if (!list.length) return '<tr><td colspan="4" class="empty">No universities for this country yet.</td></tr>';
      return list.map((u) => `<tr class="${u.active ? '' : 'muted'}">
        <td><span class="cell-title">${esc(u.name)}</span>${u.active ? '' : ' <span class="badge st-gray plain">Hidden</span>'}</td><td>${esc(u.country)}</td>
        <td class="num">${u.applicationCount}</td>
        <td class="nowrap" style="text-align:right"><button class="btn btn-sm" data-edit="${u.id}">Edit</button>
          ${u.active ? `<button class="btn btn-sm btn-danger" data-remove="${u.id}">Remove</button>` : `<button class="btn btn-sm" data-show="${u.id}">Show again</button>`}</td></tr>`).join('');
    }
    el.innerHTML = `
      <div class="page-head"><div><h1>Universities</h1><p class="sub">The master list counsellors pick from when adding applications</p></div>
        <div class="actions"><button class="btn btn-primary" data-add>${L.icon('plus')}Add university</button></div></div>
      <section class="card">
        <div class="filters" style="grid-template-columns:minmax(180px,260px)"><div class="field"><label for="uf-c" class="sr-only">Country</label>
          <select id="uf-c" data-filter>${L.options(countries, filter, { blank: `All countries (${universities.length})` })}</select></div></div>
        <div class="table-wrap"><table><caption class="sr-only">Universities</caption><thead><tr><th>University</th><th>Country</th><th class="num">Applications</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody data-rows>${rows()}</tbody></table></div>
      </section>`;
    const form = (u) => L.modal({
      title: u ? 'Edit university' : 'Add university', submitLabel: u ? 'Save' : 'Add',
      body: `<div class="field"><label for="un-n">University name <span class="req">*</span></label><input id="un-n" name="name" type="text" required value="${esc(u ? u.name : '')}"></div>
        <div class="field"><label for="un-c">Country <span class="req">*</span></label><input id="un-c" name="country" type="text" list="un-countries" required value="${esc(u ? u.country : filter)}">
          <datalist id="un-countries">${countries.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>`,
      onSubmit: async (fd) => {
        const d = L.formObject(fd);
        if (!d.name || !d.country) throw new Error('Enter the university name and country.');
        if (u) await L.api.patch(`/settings/universities/${u.id}`, d); else await L.api.post('/settings/universities', d);
        await L.loadRefs(true);
        L.toast(u ? 'University updated.' : 'University added.');
        L.refresh();
      }
    });
    el.querySelector('[data-add]').addEventListener('click', () => form(null));
    el.querySelector('[data-filter]').addEventListener('change', (e) => { filter = e.target.value; L.setQuery({ country: filter }); el.querySelector('[data-rows]').innerHTML = rows(); });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-edit],[data-remove],[data-show]');
      if (!b) return;
      const u = universities.find((x) => x.id === Number(b.dataset.edit || b.dataset.remove || b.dataset.show));
      try {
        if (b.dataset.edit) form(u);
        if (b.dataset.show) { await L.api.patch(`/settings/universities/${u.id}`, { active: true }); await L.loadRefs(true); L.refresh(); }
        if (b.dataset.remove && await L.confirm(`Remove ${u.name}?`, 'If students have applied here it is hidden from the list instead, so their applications stay.', { confirmLabel: 'Remove' })) {
          const res = await L.api.del(`/settings/universities/${u.id}`);
          await L.loadRefs(true);
          L.toast(res.message || 'University removed.');
          L.refresh();
        }
      } catch (err) { L.fail(err); }
    });
  };

  /* ---------- Demo outbox ---------- */
  L.views.outbox = async (el) => {
    const { emails } = await L.api.get('/demo/outbox');
    el.innerHTML = `
      <div class="page-head"><div><h1>Demo outbox</h1><p class="sub">Emails the live portal would send. Nothing is sent from the demo.</p></div></div>
      <section class="card">${emails.length ? emails.map((m) => `<div class="outbox-item">
        <div class="row"><span class="subject">${esc(m.subject)}</span><span class="spacer"></span><span class="small soft">${esc(L.fmtDateTime(m.createdAt))}</span></div>
        <div class="small muted">To: ${esc(m.to.join(', '))}</div>
        <div class="body">${esc(m.title)}\n${esc((m.lines || []).join('\n'))}</div>
        ${m.studentId ? `<a class="small" href="#/students/${m.studentId}">Open student</a>` : ''}</div>`).join('')
        : '<p class="empty">No emails yet. Try moving a student to another phase while signed in as Admin — the assigned counsellor gets an email.</p>'}</section>`;
  };
})();
