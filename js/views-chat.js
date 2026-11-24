/* Messages: one conversation between the Admin team and each counsellor.
   Admin: list of counsellors on the left, the open conversation on the right.
   Counsellor: their single conversation with the Admin team. */
(function () {
  const L = window.L;
  const esc = L.esc;
  L.views = L.views || {};

  const POLL_MS = 4000;
  const MAX_LEN = 2000;

  // Escape, then turn web addresses into links and keep line breaks.
  function formatBody(text) {
    return esc(text)
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br>');
  }
  function dayLabel(ts) {
    const day = String(ts).slice(0, 10);
    const today = L.todayIST();
    const y = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    return day === today ? 'Today' : day === y ? 'Yesterday' : L.fmtDate(day);
  }
  const timeOf = (ts) => L.fmtDateTime(ts).split(', ').pop();

  L.views.messages = async (el, ctx) => {
    const me = ctx.user;
    const isAdmin = L.isStaff(me); // Admin or Manager: sees every counsellor's chat
    let cid = isAdmin ? Number(ctx.params.cid || 0) : me.id;
    let threads = [];

    el.innerHTML = `
      <div class="page-head"><div><h1>Messages</h1><p class="sub">${isAdmin ? 'One private chat with each counsellor. Admins and Managers can read and reply.' : 'Your chat with the Admin team'}</p></div></div>
      <section class="card chat-shell${isAdmin ? ' with-list' : ''}${isAdmin && cid ? ' has-open' : ''}">
        ${isAdmin ? '<aside class="chat-list" aria-label="Conversations" data-list><div class="empty">Loading…</div></aside>' : ''}
        <div class="chat-main" data-main><div class="empty">Loading…</div></div>
      </section>`;
    const listEl = el.querySelector('[data-list]');
    const mainEl = el.querySelector('[data-main]');

    /* ---------- Conversation list (Admin) ---------- */
    async function loadThreads() {
      if (!isAdmin) return;
      threads = (await L.api.get('/chat/threads')).threads;
      if (!threads.length) {
        listEl.innerHTML = '<div class="empty">No counsellors yet. Add them under Settings → Users.</div>';
        return;
      }
      listEl.innerHTML = `<ul>${threads.map((t) => {
        const last = t.lastMessage;
        const who = last ? (last.senderId === me.id ? 'You' : last.senderId === t.counsellorId ? t.name.split(' ')[0] : (last.senderName || 'Admin').split(' ')[0]) : '';
        return `<li><a href="#/messages/${t.counsellorId}" class="chat-item${t.counsellorId === cid ? ' active' : ''}${t.unread ? ' unread' : ''}"${t.counsellorId === cid ? ' aria-current="true"' : ''}>
          <span class="avatar sm" aria-hidden="true">${esc(L.initials(t.name))}</span>
          <span class="chat-item-text"><span class="row" style="flex-wrap:nowrap;gap:6px"><span class="chat-item-name">${esc(t.name)}</span>
            ${t.active ? '' : '<span class="badge st-gray plain">Inactive</span>'}<span class="spacer"></span>
            <span class="small soft nowrap">${last ? esc(dayLabel(last.createdAt) === 'Today' ? timeOf(last.createdAt) : dayLabel(last.createdAt)) : ''}</span></span>
            <span class="row" style="flex-wrap:nowrap;gap:6px"><span class="chat-item-preview">${last ? `${esc(who)}: ${esc(last.body.replace(/\n/g, ' '))}` : '<span class="soft">No messages yet</span>'}</span>
            ${t.unread ? `<span class="nav-badge" aria-label="${t.unread} unread">${t.unread}</span>` : ''}</span></span>
        </a></li>`;
      }).join('')}</ul>`;
    }

    /* ---------- One conversation ---------- */
    let messages = [];
    let otherReadId = 0;
    let counsellor = null;
    let hasOlder = false;

    function bubble(m, prev) {
      const mine = isAdmin ? m.senderId !== m.counsellorId : m.senderId === me.id;
      const showDay = !prev || String(prev.createdAt).slice(0, 10) !== String(m.createdAt).slice(0, 10);
      const sameSender = prev && !showDay && prev.senderId === m.senderId;
      const name = m.senderId === me.id ? 'You' : m.senderName;
      return `${showDay ? `<div class="chat-day"><span>${esc(dayLabel(m.createdAt))}</span></div>` : ''}
        <div class="msg ${mine ? 'mine' : 'theirs'}${sameSender ? ' cont' : ''}" data-id="${m.id}">
          ${sameSender ? '' : `<div class="msg-name">${esc(name)}${!isAdmin && m.senderRole && m.senderRole !== 'manager' ? ` <span class="soft">· ${esc(L.label(L.ROLES, m.senderRole))}</span>` : ''}</div>`}
          <div class="msg-bubble">${formatBody(m.body)}</div>
          <div class="msg-time">${esc(timeOf(m.createdAt))}</div>
        </div>`;
    }
    function seenLine() {
      const myLast = [...messages].reverse().find((m) => (isAdmin ? m.senderId !== m.counsellorId : m.senderId === me.id));
      const lastOverall = messages[messages.length - 1];
      if (!myLast || lastOverall !== myLast) return '';
      return otherReadId >= myLast.id
        ? `<div class="msg-seen">Seen${isAdmin ? ` by ${esc(counsellor.name.split(' ')[0])}` : ' by Admin'}</div>`
        : '<div class="msg-seen soft">Sent</div>';
    }
    function renderMessages(keepScroll) {
      const box = mainEl.querySelector('[data-msgs]');
      const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      const prevHeight = box.scrollHeight;
      box.innerHTML = (hasOlder ? '<div class="chat-older"><button type="button" class="btn btn-sm" data-older>Show earlier messages</button></div>' : '') +
        (messages.length ? messages.map((m, i) => bubble(m, messages[i - 1])).join('') + seenLine()
          : `<div class="chat-empty">${L.icon('mail')}<p>${isAdmin ? `No messages with ${esc(counsellor.name)} yet. Say hello.` : 'No messages yet. Write to the Admin team below.'}</p></div>`);
      if (keepScroll === 'older') box.scrollTop = box.scrollHeight - prevHeight;
      else if (keepScroll !== 'stay' || nearBottom) box.scrollTop = box.scrollHeight;
    }
    async function markRead() {
      const last = messages[messages.length - 1];
      if (!last) return;
      await L.api.post(`/chat/threads/${cid}/read`, { lastId: last.id }).catch(() => {});
      L.refreshUnread();
    }
    async function openThread() {
      if (!cid) {
        mainEl.innerHTML = `<div class="chat-empty">${L.icon('mail')}<p>Choose a counsellor to open your chat with them.</p></div>`;
        return;
      }
      const res = await L.api.get(`/chat/threads/${cid}/messages`);
      counsellor = res.counsellor; messages = res.messages; otherReadId = res.otherReadId; hasOlder = res.hasOlder;
      const title = isAdmin ? counsellor.name : 'Admin team';
      const sub = isAdmin ? `Counsellor · ${counsellor.email}` : 'Admins and Managers can read and reply';
      mainEl.innerHTML = `
        <div class="chat-head">
          ${isAdmin ? '<a href="#/messages" class="icon-btn chat-back" aria-label="Back to all conversations">' + L.icon('arrow').replace('<svg ', '<svg style="transform:rotate(180deg)" ') + '</a>' : ''}
          <span class="avatar sm" aria-hidden="true">${esc(isAdmin ? L.initials(counsellor.name) : 'A')}</span>
          <div style="min-width:0"><h2 style="font-size:16px">${esc(title)}</h2><div class="small soft">${esc(sub)}</div></div>
        </div>
        <div class="chat-msgs" data-msgs role="log" aria-live="polite" aria-label="Messages"></div>
        <form class="chat-compose" data-compose>
          ${counsellor.active ? `<label for="chat-input" class="sr-only">Message</label>
          <textarea id="chat-input" name="body" rows="1" maxlength="${MAX_LEN}" placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"></textarea>
          <button class="btn btn-primary" type="submit" aria-label="Send message">Send</button>`
          : '<p class="muted small" style="padding:4px 0">This counsellor account is deactivated, so new messages cannot be sent.</p>'}
        </form>`;
      renderMessages();
      markRead();
      const form = mainEl.querySelector('[data-compose]');
      const input = form.querySelector('textarea');
      if (!input) return;
      const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px`; };
      input.addEventListener('input', grow);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = input.value.trim();
        if (!body) return;
        const btn = form.querySelector('button');
        btn.disabled = true;
        try {
          const res2 = await L.api.post(`/chat/threads/${cid}/messages`, { body });
          if (!messages.some((m) => m.id === res2.message.id)) messages.push(res2.message);
          input.value = ''; grow();
          renderMessages();
          loadThreads().catch(() => {});
        } catch (err) { L.fail(err); } finally { btn.disabled = false; input.focus(); }
      });
      if (window.matchMedia('(min-width: 821px)').matches) input.focus();
    }

    mainEl.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-older]')) return;
      const res = await L.api.get(`/chat/threads/${cid}/messages?before=${messages[0].id}`);
      messages = res.messages.concat(messages); hasOlder = res.hasOlder;
      renderMessages('older');
    });

    // Live updates: fetch anything newer than what is on screen.
    let busy = false;
    async function poll() {
      if (busy || !el.isConnected) return;
      busy = true;
      try {
        if (cid && counsellor) {
          const lastId = messages.length ? messages[messages.length - 1].id : 0;
          const res = lastId ? await L.api.get(`/chat/threads/${cid}/messages?after=${lastId}`) : await L.api.get(`/chat/threads/${cid}/messages`);
          const fresh = res.messages.filter((m) => !messages.some((x) => x.id === m.id));
          const seenChanged = res.otherReadId !== otherReadId;
          otherReadId = res.otherReadId;
          if (fresh.length) { messages = messages.concat(fresh); renderMessages('stay'); markRead(); }
          else if (seenChanged) renderMessages('stay');
        }
        await loadThreads();
      } catch (e) { /* network blip: try again on the next tick */ } finally { busy = false; }
    }
    const timer = setInterval(poll, POLL_MS);
    const onStorage = () => poll();
    window.addEventListener('storage', onStorage); // demo: another tab wrote a message
    L.onLeave(() => { clearInterval(timer); window.removeEventListener('storage', onStorage); });

    await Promise.all([loadThreads(), openThread()]);
  };
})();
