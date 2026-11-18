/* Students list with filters, and the add / edit lead form. */
(function () {
  const L = window.L;
  const esc = L.esc;
  L.views = L.views || {};

  /* ---------- Add / edit lead ---------- */
  L.leadForm = function (student, ctx, onDone) {
    const u = ctx.user;
    const s = student || { countries: [] };
    const managers = L.managers();
    const countryChecks = L.COUNTRIES.map((c) => `<label><input type="checkbox" name="countries[]" value="${esc(c)}"${(s.countries || []).includes(c) ? ' checked' : ''}> ${esc(c)}</label>`).join('');
    const extraCountries = (s.countries || []).filter((c) => !L.COUNTRIES.includes(c));
    const managerField = L.can.assignManager(u) ? `<div class="field"><label for="lf-mgr">Assigned counsellor</label>
        <select id="lf-mgr" name="managerId">${L.options(managers.map((m) => [m.id, m.name]), s.managerId, { blank: 'Not assigned yet' })}</select></div>`
      : (u.role === 'manager' && !student ? '<div class="field"><span class="label-text">Assigned counsellor</span><span class="muted">You</span></div>' : '');
    L.modal({
      title: student ? `Edit ${student.fullName}` : 'Add lead',
      submitLabel: student ? 'Save changes' : 'Add lead',
      body: `<div class="form-grid">
        <div class="form-section">Contact</div>
        <div class="field"><label for="lf-name">Student name <span class="req">*</span></label><input id="lf-name" name="fullName" type="text" required value="${esc(s.fullName || '')}"></div>
        <div class="field"><label for="lf-phone">Phone <span class="req">*</span></label><input id="lf-phone" name="phone" type="tel" required value="${esc(s.phone || '')}"></div>
        <div class="field"><label for="lf-email">Email</label><input id="lf-email" name="email" type="email" value="${esc(s.email || '')}"></div>
        <div class="field"><label for="lf-city">City</label><input id="lf-city" name="city" type="text" value="${esc(s.city || '')}"></div>
        <div class="field"><label for="lf-src">Lead source</label><select id="lf-src" name="leadSource">${L.options(L.LEAD_SOURCES.includes(s.leadSource) || !s.leadSource ? L.LEAD_SOURCES : [...L.LEAD_SOURCES, s.leadSource], s.leadSource, { blank: 'Choose…' })}</select></div>
        ${managerField || '<div></div>'}
        <div class="form-section">Preferences</div>
        <fieldset class="field full" style="border:0;padding:0;margin:0"><legend class="label-text" style="margin-bottom:6px">Target countries</legend><div class="checks">${countryChecks}</div>
          ${extraCountries.length ? `<input type="hidden" name="extraCountries" value="${esc(extraCountries.join(', '))}">` : ''}</fieldset>
        <div class="field"><label for="lf-course">Course</label><input id="lf-course" name="course" type="text" placeholder="e.g. MS Computer Science" value="${esc(s.course || '')}"></div>
        <div class="field"><label for="lf-intake">Intake</label><input id="lf-intake" name="intake" type="text" placeholder="e.g. Fall 2027" value="${esc(s.intake || '')}"></div>
        <div class="field"><label for="lf-budget">Budget</label><input id="lf-budget" name="budget" type="text" placeholder="e.g. ₹30–40 lakh" value="${esc(s.budget || '')}"></div>
        <div></div>
        <div class="form-section">Parent / guardian</div>
        <div class="field"><label for="lf-pn">Parent name</label><input id="lf-pn" name="parentName" type="text" value="${esc(s.parentName || '')}"></div>
        <div class="field"><label for="lf-pp">Parent phone</label><input id="lf-pp" name="parentPhone" type="tel" value="${esc(s.parentPhone || '')}"></div>
        <div class="field full"><label for="lf-notes">Notes</label><textarea id="lf-notes" name="notes">${esc(s.notes || '')}</textarea></div>
      </div>`,
      onSubmit: async (fd) => {
        const data = L.formObject(fd);
        data.countries = [...(data.countries || []), ...String(data.extraCountries || '').split(',').map((c) => c.trim()).filter(Boolean)];
        delete data.extraCountries;
        if (!data.fullName) throw new Error('Enter the student name.');
        if (!data.phone) throw new Error('Enter a phone number.');
        if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) throw new Error('Enter a valid email or leave it blank.');
        if (data.managerId !== undefined) data.managerId = data.managerId ? Number(data.managerId) : null;
        if (student) {
          await L.api.patch(`/students/${student.id}`, data);
          L.toast('Details saved.');
          if (onDone) onDone(); else L.refresh();
        } else {
          const res = await L.api.post('/students', data);
          L.toast('Lead added.');
          L.go(`#/students/${res.student.id}`);
        }
      }
    });
  };

  /* ---------- List ---------- */
  L.views.students = async (el, ctx) => {
    const u = ctx.user;
    const refs = L.state.refs;
    const q = { q: ctx.query.q || '', phase: ctx.query.phase || '', manager: ctx.query.manager || '', country: ctx.query.country || '', intake: ctx.query.intake || '' };
    const phases = refs.phases.filter((p) => p.active || String(p.id) === q.phase);
    const all = await L.api.get('/students');
    const intakes = [...new Set(all.students.map((s) => s.intake).filter(Boolean))].sort();
    const showManager = L.can.seeAllStudents(u);

    el.innerHTML = `
      <div class="page-head">
        <div><h1>Students</h1><p class="sub">${u.role === 'manager' ? 'Students assigned to you' : 'Every student and lead'}</p></div>
        <div class="actions">${L.can.addLead(u) ? `<button class="btn btn-primary" data-add>${L.icon('plus')}Add lead</button>` : ''}</div>
      </div>
      <section class="card">
        <form class="filters" data-filters role="search" aria-label="Filter students">
          <div class="field search"><label for="f-q" class="sr-only">Search</label><input id="f-q" name="q" type="search" placeholder="Search name, phone, email or city" value="${esc(q.q)}"></div>
          <div class="field"><label for="f-phase" class="sr-only">Phase</label><select id="f-phase" name="phase">${L.options(phases.map((p) => [p.id, p.name]), q.phase, { blank: 'All phases' })}</select></div>
          ${showManager ? `<div class="field"><label for="f-mgr" class="sr-only">Counsellor</label><select id="f-mgr" name="manager">${L.options([...L.managers().map((m) => [m.id, m.name]), ['none', 'Not assigned']], q.manager, { blank: 'All counsellors' })}</select></div>` : ''}
          <div class="field"><label for="f-country" class="sr-only">Country</label><select id="f-country" name="country">${L.options(L.COUNTRIES.filter((c) => c !== 'Other'), q.country, { blank: 'All countries' })}</select></div>
          <div class="field"><label for="f-intake" class="sr-only">Intake</label><select id="f-intake" name="intake">${L.options(intakes, q.intake, { blank: 'All intakes' })}</select></div>
        </form>
        <div data-results><div class="empty">Loading…</div></div>
      </section>`;

    const form = el.querySelector('[data-filters]');
    const results = el.querySelector('[data-results]');
    async function load() {
      const data = L.formObject(new FormData(form));
      L.setQuery(data);
      const qs = new URLSearchParams(Object.entries(data).filter(([, v]) => v)).toString();
      const res = await L.api.get(`/students${qs ? `?${qs}` : ''}`);
      results.innerHTML = table(res.students, showManager, all.students.length);
    }
    let timer;
    form.addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => load().catch(L.fail), e.target.type === 'search' ? 250 : 0); });
    form.addEventListener('submit', (e) => { e.preventDefault(); load().catch(L.fail); });
    results.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const tr = e.target.closest('tr[data-id]');
      if (tr) L.go(`#/students/${tr.dataset.id}`);
    });
    const add = el.querySelector('[data-add]');
    if (add) add.addEventListener('click', () => L.leadForm(null, ctx));
    await load();
  };

  function table(list, showManager, total) {
    if (!list.length) return `<div class="empty">${total ? 'No students match these filters.' : 'No students yet. Use “Add lead” to add the first one.'}</div>`;
    return `<div class="table-wrap"><table>
      <caption class="sr-only">Students</caption>
      <thead><tr><th>Student</th><th>Phase</th>${showManager ? '<th class="hide-sm">Counsellor</th>' : ''}<th class="hide-sm">Countries</th><th class="hide-sm">Intake</th>
        <th class="num">Docs to review</th><th class="num">Offers</th><th class="hide-sm">Updated</th></tr></thead>
      <tbody>${list.map((s) => `<tr class="clickable" data-id="${s.id}">
        <td><div class="cell-title"><a href="#/students/${s.id}">${esc(s.fullName)}</a></div><div class="small soft">${esc(s.phone || '')}${s.city ? ` · ${esc(s.city)}` : ''}</div></td>
        <td>${L.phasePill(s.currentPhaseName)}</td>
        ${showManager ? `<td class="hide-sm">${s.managerName ? esc(s.managerName) : '<span class="soft">Not assigned</span>'}</td>` : ''}
        <td class="hide-sm">${esc((s.countries || []).join(', ') || '—')}</td>
        <td class="hide-sm nowrap">${esc(s.intake || '—')}</td>
        <td class="num">${s.pendingDocs ? `<span class="badge st-in_review">${s.pendingDocs}</span>` : '<span class="soft">0</span>'}</td>
        <td class="num">${s.applicationCount ? `${s.acceptedCount} / ${s.applicationCount}` : '<span class="soft">—</span>'}</td>
        <td class="hide-sm small soft nowrap">${esc(L.fmtDate(s.updatedAt))}</td></tr>`).join('')}</tbody></table></div>
      <p class="small soft" style="padding:10px 16px">${list.length} student${list.length === 1 ? '' : 's'} shown. “Offers” is accepted out of applications made.</p>`;
  }
})();
