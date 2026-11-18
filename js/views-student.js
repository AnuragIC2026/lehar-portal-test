/* One student: journey phases, university applications, documents, details and activity. */
(function () {
  const L = window.L;
  const esc = L.esc;
  L.views = L.views || {};

  const TABS = [['journey', 'Journey'], ['applications', 'Applications'], ['documents', 'Documents'], ['details', 'Details'], ['activity', 'Activity']];

  L.views.student = async (el, ctx) => {
    const u = ctx.user;
    let tab = TABS.some((t) => t[0] === ctx.query.tab) ? ctx.query.tab : 'journey';
    let data;

    async function reload() {
      data = await L.api.get(`/students/${ctx.params.id}`);
      draw();
    }

    function draw() {
      const s = data.student;
      const canEdit = L.can.editStudent(u, s);
      const counts = { applications: data.applications.length, documents: data.documents.length };
      el.innerHTML = `
        <p class="small" style="margin-bottom:10px"><a href="#/students">← All students</a></p>
        <section class="card">
          <div class="student-head">
            <div class="row" style="align-items:flex-start;gap:14px;flex-wrap:nowrap">
              <div class="avatar" aria-hidden="true">${esc(L.initials(s.fullName))}</div>
              <div><h1>${esc(s.fullName)}</h1>
                <div class="meta"><span>${esc(s.phone || '')}</span>${s.email ? `<span>${esc(s.email)}</span>` : ''}${s.city ? `<span>${esc(s.city)}</span>` : ''}
                  <span>Manager: ${s.managerName ? esc(s.managerName) : 'not assigned'}</span><span>Added ${esc(L.fmtDate(s.createdAt))}</span></div>
                <div class="row" style="margin-top:10px"><span class="small muted">Current phase</span>${L.phasePill(s.currentPhaseName)}</div>
              </div>
            </div>
            <div class="row">
              ${canEdit ? `<button class="btn" data-act="move">${L.icon('arrow')}Move phase</button><button class="btn" data-act="edit">${L.icon('edit')}Edit details</button>` : ''}
              ${L.can.delete(u) ? `<button class="btn btn-danger" data-act="delete">${L.icon('trash')}Delete</button>` : ''}
            </div>
          </div>
          ${!canEdit && u.role === 'viewer' ? '<div class="notice" style="margin:0 20px 16px">You have view-only access.</div>' : ''}
          <div class="tabs" role="tablist" aria-label="Student sections">
            ${TABS.map(([k, label]) => `<button role="tab" id="tab-${k}" aria-controls="panel" aria-selected="${tab === k}" data-tab="${k}">${label}${counts[k] != null ? `<span class="count">${counts[k]}</span>` : ''}</button>`).join('')}
          </div>
          <div id="panel" role="tabpanel" aria-labelledby="tab-${tab}" class="card-body" style="padding:20px">${panel(tab, canEdit)}</div>
        </section>`;
    }

    function panel(name, canEdit) {
      if (name === 'journey') return journeyPanel(canEdit);
      if (name === 'applications') return applicationsPanel(canEdit);
      if (name === 'documents') return documentsPanel(canEdit);
      if (name === 'details') return detailsPanel();
      return activityPanel();
    }

    /* ---------- Journey ---------- */
    function journeyPanel(canEdit) {
      const s = data.student;
      const visible = data.phases;
      const curIdx = visible.findIndex((p) => p.id === s.currentPhaseId);
      return `<p class="muted" style="margin-bottom:16px">Each phase has its own status. The highlighted phase is where ${esc(s.fullName.split(' ')[0])} is now.</p>
        <ol class="journey">${visible.map((p, i) => {
          const current = p.id === s.currentPhaseId;
          const dot = p.status === 'approved' ? L.icon('check') : p.status === 'rejected' ? L.icon('x') : String(i + 1);
          const next = current ? visible.slice(i + 1).find((x) => x.active) : null;
          return `<li class="s-${p.status}${current ? ' current' : ''}">
            <span class="dot" aria-hidden="true">${dot}</span>
            <div class="step">
              <div class="step-head"><span class="title">${esc(p.name)}</span>${L.statusBadge(L.PHASE_STATUS, p.status)}
                ${current ? '<span class="tag-current">Current</span>' : ''}${!p.active ? '<span class="small soft">(hidden phase)</span>' : ''}
                <span class="spacer"></span>
                ${canEdit && !current && p.active ? `<button class="btn btn-sm" data-act="make-current" data-phase="${p.id}">Make current</button>` : ''}
                ${canEdit && current && next ? `<button class="btn btn-sm btn-success" data-act="approve-next" data-phase="${p.id}" data-next="${next.id}">${L.icon('check')}Approve &amp; move to ${esc(next.name)}</button>` : ''}
              </div>
              ${p.note ? `<div class="step-note">${esc(p.note)}</div>` : ''}
              ${p.updatedAt && (p.status !== 'pending' || p.note) ? `<div class="step-meta">Updated ${esc(L.fmtDateTime(p.updatedAt))}${p.updatedByName ? ` by ${esc(p.updatedByName)}` : ''}</div>` : ''}
              ${canEdit && (current || i <= curIdx || p.status !== 'pending') ? (() => {
                const form = `<form class="step-edit" data-phase-form="${p.id}">
                  <label class="sr-only" for="ps-${p.id}">Status for ${esc(p.name)}</label>
                  <select id="ps-${p.id}" name="status">${L.options(L.PHASE_STATUS, p.status)}</select>
                  <label class="sr-only" for="pn-${p.id}">Note for ${esc(p.name)}</label>
                  <textarea id="pn-${p.id}" name="note" placeholder="Note (optional)">${esc(p.note || '')}</textarea>
                  <button class="btn btn-sm" type="submit">Save</button></form>`;
                return current ? form : `<details class="step-more"><summary>Update status or note</summary>${form}</details>`;
              })() : ''}
            </div></li>`;
        }).join('')}</ol>`;
    }

    /* ---------- Applications ---------- */
    function applicationsPanel(canEdit) {
      const apps = data.applications;
      const head = `<div class="row" style="margin-bottom:14px"><p class="muted">Each university gives its own decision.</p><span class="spacer"></span>
        ${canEdit ? `<button class="btn btn-primary btn-sm" data-act="add-app">${L.icon('plus')}Add application</button>` : ''}</div>`;
      if (!apps.length) return head + '<div class="empty">No university applications yet.</div>';
      return head + `<div class="table-wrap"><table><caption class="sr-only">University applications</caption>
        <thead><tr><th>University</th><th>Course · intake</th><th>Status</th><th class="hide-sm">Applied</th><th class="hide-sm">Decision</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${apps.map((a) => `<tr>
          <td><div class="cell-title">${esc(a.universityName)}</div><div class="small soft">${esc(a.country)}</div></td>
          <td>${esc(a.course || '—')}<div class="small soft">${esc(a.intake || '')}</div></td>
          <td>${L.statusBadge(L.APP_STATUS, a.status)}${a.note ? `<div class="small soft" style="margin-top:4px">${esc(a.note)}</div>` : ''}</td>
          <td class="hide-sm nowrap">${esc(a.appliedOn ? L.fmtDate(a.appliedOn) : '—')}</td>
          <td class="hide-sm nowrap">${esc(a.decisionOn ? L.fmtDate(a.decisionOn) : '—')}</td>
          <td class="nowrap" style="text-align:right">${canEdit ? `<button class="btn btn-sm" data-act="edit-app" data-id="${a.id}">Update</button>` : ''}
            ${L.can.delete(u) ? `<button class="btn btn-sm btn-danger" data-act="del-app" data-id="${a.id}" aria-label="Delete application to ${esc(a.universityName)}">${L.icon('trash')}</button>` : ''}</td>
        </tr>`).join('')}</tbody></table></div>`;
    }

    function appForm(app) {
      const unis = L.state.refs.universities.filter((x) => x.active || (app && x.id === app.universityId));
      const byCountry = {};
      unis.forEach((x) => { (byCountry[x.country] = byCountry[x.country] || []).push(x); });
      const uniOptions = '<option value="">Choose a university…</option>' + Object.keys(byCountry).sort().map((c) =>
        `<optgroup label="${esc(c)}">${byCountry[c].map((x) => `<option value="${x.id}"${app && app.universityId === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('');
      const s = data.student;
      const a = app || { course: s.course, intake: s.intake, status: 'applied', appliedOn: L.todayIST() };
      L.modal({
        title: app ? `Update application — ${app.universityName}` : 'Add application',
        submitLabel: app ? 'Save' : 'Add application',
        body: `<div class="form-grid">
          <div class="field full"><label for="af-uni">University <span class="req">*</span></label><select id="af-uni" name="universityId" required>${uniOptions}</select>
            <span class="help">${L.can.manageSettings(u) ? 'Missing one? Add it under Settings → Universities.' : 'Missing one? Ask an Admin to add it to the university list.'}</span></div>
          <div class="field"><label for="af-course">Course</label><input id="af-course" name="course" type="text" value="${esc(a.course || '')}"></div>
          <div class="field"><label for="af-intake">Intake</label><input id="af-intake" name="intake" type="text" value="${esc(a.intake || '')}"></div>
          <div class="field"><label for="af-status">Status</label><select id="af-status" name="status">${L.options(L.APP_STATUS, a.status)}</select></div>
          <div></div>
          <div class="field"><label for="af-applied">Applied on</label><input id="af-applied" name="appliedOn" type="date" value="${esc(a.appliedOn || '')}"></div>
          <div class="field"><label for="af-dec">Decision on</label><input id="af-dec" name="decisionOn" type="date" value="${esc(a.decisionOn || '')}"></div>
          <div class="field full"><label for="af-note">Note</label><textarea id="af-note" name="note" placeholder="e.g. Scholarship offered, conditional offer, reason for rejection">${esc(a.note || '')}</textarea></div>
        </div>`,
        onSubmit: async (fd) => {
          const d = L.formObject(fd);
          if (!d.universityId) throw new Error('Choose a university from the list.');
          d.universityId = Number(d.universityId);
          if (app) await L.api.patch(`/students/applications/${app.id}`, d);
          else await L.api.post(`/students/${s.id}/applications`, d);
          L.toast(app ? 'Application updated.' : 'Application added.');
          await reload();
        }
      });
    }

    /* ---------- Documents ---------- */
    function documentsPanel(canEdit) {
      const docs = data.documents;
      const head = `<div class="row" style="margin-bottom:14px"><p class="muted">Uploaded files and their review status. PDF, JPG, PNG, WEBP, DOC or DOCX, up to 10 MB.</p><span class="spacer"></span>
        ${canEdit ? `<button class="btn btn-primary btn-sm" data-act="upload">${L.icon('plus')}Upload document</button>` : ''}</div>`;
      if (!docs.length) return head + '<div class="empty">No documents uploaded yet.</div>';
      return head + `<div class="table-wrap"><table><caption class="sr-only">Documents</caption>
        <thead><tr><th>Document</th><th>Status</th><th class="hide-sm">Uploaded</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${docs.map((d) => {
          const ext = (d.originalName.split('.').pop() || '').toUpperCase().slice(0, 4);
          return `<tr class="doc-row">
          <td><div class="file"><span class="doc-icon" aria-hidden="true">${esc(ext)}</span><div>
            <div class="cell-title">${esc(d.docType)}</div><div class="small soft">${esc(d.originalName)} · ${esc(L.fmtSize(d.sizeBytes))}${d.phaseName ? ` · ${esc(d.phaseName)}` : ''}</div></div></div></td>
          <td>${L.statusBadge(L.DOC_STATUS, d.status)}
            ${d.reviewComment ? `<div class="comment${d.status === 'approved' ? ' ok' : ''}">${esc(d.reviewComment)}</div>` : ''}
            ${d.reviewedByName && d.status !== 'pending' ? `<div class="small soft">by ${esc(d.reviewedByName)}, ${esc(L.fmtDate(d.reviewedAt))}</div>` : ''}</td>
          <td class="hide-sm small"><span class="nowrap">${esc(L.fmtDateTime(d.createdAt))}</span><div class="soft">${esc(d.uploadedByName || '')}</div></td>
          <td style="text-align:right" class="nowrap">
            <button class="btn btn-sm" data-act="view-doc" data-id="${d.id}" aria-label="Open ${esc(d.docType)}">${L.icon('eye')}<span class="hide-sm">Open</span></button>
            ${canEdit ? `<button class="btn btn-sm" data-act="review-doc" data-id="${d.id}">Review</button>` : ''}
            ${L.can.delete(u) ? `<button class="btn btn-sm btn-danger" data-act="del-doc" data-id="${d.id}" aria-label="Delete ${esc(d.docType)}">${L.icon('trash')}</button>` : ''}
          </td></tr>`;
        }).join('')}</tbody></table></div>`;
    }

    function uploadForm() {
      const s = data.student;
      const phases = data.phases.filter((p) => p.active);
      const defPhase = phases.find((p) => p.id === s.currentPhaseId);
      L.modal({
        title: 'Upload document',
        submitLabel: 'Upload',
        body: `<div class="field"><label for="uf-type">Document type <span class="req">*</span></label><select id="uf-type" name="docType" required>${L.options(L.DOC_TYPES, '', { blank: 'Choose…' })}</select></div>
          <div class="field"><label for="uf-phase">For phase</label><select id="uf-phase" name="phaseId">${L.options(phases.map((p) => [p.id, p.name]), defPhase ? defPhase.id : '', { blank: 'No specific phase' })}</select></div>
          <div class="field"><label for="uf-file">File <span class="req">*</span></label><input id="uf-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" required>
            <span class="help">PDF, JPG, PNG, WEBP, DOC or DOCX, up to 10 MB.</span></div>`,
        onSubmit: async (fd) => {
          const file = fd.get('file');
          if (!fd.get('docType')) throw new Error('Choose the document type.');
          if (!file || !file.name) throw new Error('Choose a file to upload.');
          if (file.size > 10 * 1024 * 1024) throw new Error('File is larger than 10 MB.');
          const res = await L.api.upload(`/students/${s.id}/documents`, fd);
          L.toast(L.isDemo && res.storedFile === false ? 'Uploaded. (Demo: file too large to keep in the browser, so only its details were saved.)' : 'Document uploaded.');
          await reload();
        }
      });
    }

    function reviewForm(doc) {
      L.modal({
        title: `Review ${doc.docType}`,
        submitLabel: 'Save review',
        body: `<p class="muted">${esc(doc.originalName)} · uploaded ${esc(L.fmtDateTime(doc.createdAt))}${doc.uploadedByName ? ` by ${esc(doc.uploadedByName)}` : ''}</p>
          <p><button type="button" class="btn btn-sm" data-open-doc>${L.icon('eye')}Open file</button></p>
          <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label-text" style="margin-bottom:6px">Decision</legend>
            <div class="checks">${[['approved', 'Approve'], ['rejected', 'Reject'], ['pending', 'Back to pending']].map(([v, t]) =>
              `<label><input type="radio" name="status" value="${v}"${doc.status === v || (doc.status === 'pending' && v === 'approved') ? ' checked' : ''}> ${t}</label>`).join('')}</div></fieldset>
          <div class="field"><label for="rv-c">Comment</label><textarea id="rv-c" name="comment" placeholder="Required when rejecting — say what needs fixing">${esc(doc.reviewComment || '')}</textarea></div>`,
        onOpen: (form) => form.querySelector('[data-open-doc]').addEventListener('click', () => L.api.openDocument(doc.id)),
        onSubmit: async (fd) => {
          const d = L.formObject(fd);
          if (d.status === 'rejected' && !d.comment) throw new Error('Add a comment saying why it was rejected.');
          await L.api.patch(`/documents/${doc.id}/review`, d);
          L.toast('Review saved.');
          await reload();
        }
      });
    }

    /* ---------- Details and activity ---------- */
    function detailsPanel() {
      const s = data.student;
      const row = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v ? esc(v) : '<span class="soft">—</span>'}</dd></div>`;
      return `<h2 style="margin-bottom:12px">Contact</h2><dl class="details-list">${row('Phone', s.phone)}${row('Email', s.email)}${row('City', s.city)}${row('Lead source', s.leadSource)}</dl>
        <h2 style="margin:22px 0 12px">Preferences</h2><dl class="details-list">${row('Target countries', (s.countries || []).join(', '))}${row('Course', s.course)}${row('Intake', s.intake)}${row('Budget', s.budget)}</dl>
        <h2 style="margin:22px 0 12px">Parent / guardian</h2><dl class="details-list">${row('Name', s.parentName)}${row('Phone', s.parentPhone)}</dl>
        <h2 style="margin:22px 0 12px">Other</h2><dl class="details-list">${row('Assigned manager', s.managerName || 'Not assigned')}${row('Added on', L.fmtDateTime(s.createdAt))}
          <div style="grid-column:1/-1"><dt>Notes</dt><dd style="white-space:pre-wrap">${s.notes ? esc(s.notes) : '<span class="soft">—</span>'}</dd></div></dl>`;
    }
    function activityPanel() {
      if (!data.activity.length) return '<div class="empty">No activity yet.</div>';
      return `<p class="muted" style="margin-bottom:8px">Every change, with who made it and when (IST).</p><ul class="timeline">${data.activity.map((a) =>
        `<li><span class="when">${esc(L.fmtDateTime(a.createdAt))}</span><span>${L.activityText(a)}</span></li>`).join('')}</ul>`;
    }

    /* ---------- Phase moves ---------- */
    async function move(phaseId) {
      await L.api.post(`/students/${data.student.id}/move`, { phaseId: Number(phaseId) });
      L.toast('Phase updated.');
      await reload();
    }
    function moveForm() {
      const s = data.student;
      const phases = data.phases.filter((p) => p.active);
      L.modal({
        title: 'Move to phase', size: 'sm', submitLabel: 'Move',
        body: `<div class="field"><label for="mv-p">Phase</label><select id="mv-p" name="phaseId">${L.options(phases.map((p) => [p.id, p.name]), s.currentPhaseId)}</select>
          <span class="help">The phase you move to is set to “In review” if it was pending.</span></div>`,
        onSubmit: async (fd) => move(fd.get('phaseId'))
      });
    }

    /* ---------- Events ---------- */
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) {
        tab = t.dataset.tab;
        L.setQuery({ tab: tab === 'journey' ? '' : tab });
        draw();
        const btn = el.querySelector(`[data-tab="${tab}"]`);
        if (btn) btn.focus();
        return;
      }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      const id = Number(b.dataset.id);
      try {
        if (act === 'edit') L.leadForm(data.student, ctx, () => reload().catch(L.fail));
        if (act === 'move') moveForm();
        if (act === 'make-current') await move(b.dataset.phase);
        if (act === 'approve-next') {
          b.disabled = true;
          const p = data.phases.find((x) => x.id === Number(b.dataset.phase));
          await L.api.put(`/students/${data.student.id}/phases/${p.id}`, { status: 'approved', note: p.note || '' });
          await move(b.dataset.next);
        }
        if (act === 'delete') {
          if (await L.confirm(`Delete ${data.student.fullName}?`, 'This removes the student with all their phases, applications, documents and history. It cannot be undone.', { confirmLabel: 'Delete student' })) {
            await L.api.del(`/students/${data.student.id}`);
            L.toast('Student deleted.');
            L.go('#/students');
          }
        }
        if (act === 'add-app') appForm(null);
        if (act === 'edit-app') appForm(data.applications.find((a) => a.id === id));
        if (act === 'del-app') {
          const a = data.applications.find((x) => x.id === id);
          if (await L.confirm('Delete application?', `Remove the application to ${a.universityName}? This cannot be undone.`, { confirmLabel: 'Delete' })) {
            await L.api.del(`/students/applications/${id}`);
            L.toast('Application deleted.');
            await reload();
          }
        }
        if (act === 'upload') uploadForm();
        if (act === 'view-doc') L.api.openDocument(id);
        if (act === 'review-doc') reviewForm(data.documents.find((d) => d.id === id));
        if (act === 'del-doc') {
          const d = data.documents.find((x) => x.id === id);
          if (await L.confirm('Delete document?', `Delete ${d.docType} (${d.originalName})? The file is removed for good.`, { confirmLabel: 'Delete' })) {
            await L.api.del(`/documents/${id}`);
            L.toast('Document deleted.');
            await reload();
          }
        }
      } catch (err) { L.fail(err); b.disabled = false; }
    });
    el.addEventListener('submit', async (e) => {
      const f = e.target.closest('[data-phase-form]');
      if (!f) return;
      e.preventDefault();
      const btn = f.querySelector('button');
      btn.disabled = true;
      try {
        const d = L.formObject(new FormData(f));
        await L.api.put(`/students/${data.student.id}/phases/${f.dataset.phaseForm}`, d);
        L.toast('Saved.');
        await reload();
      } catch (err) { L.fail(err); btn.disabled = false; }
    });

    await reload();
  };
})();
