/* Sign in, forgot password (OTP), change password. */
(function () {
  const L = window.L;
  const esc = L.esc;
  L.views = L.views || {};

  /* Layered ocean waves behind the sign-in card ("Lehar" means wave).
     Each layer is two identical wave periods wide and slides sideways forever, so it loops without a seam. */
  function wavePath(width, height, base, amp, length, phase) {
    const half = length / 2;
    let x = -phase;
    let up = true;
    let d = `M ${x.toFixed(1)} ${base}`;
    while (x < width + length) {
      const nx = x + half;
      const cy = up ? base - amp * 1.33 : base + amp * 1.33;
      d += ` C ${(x + half * 0.36).toFixed(1)} ${cy.toFixed(1)}, ${(x + half * 0.64).toFixed(1)} ${cy.toFixed(1)}, ${nx.toFixed(1)} ${base}`;
      x = nx;
      up = !up;
    }
    return { fill: `${d} L ${x.toFixed(1)} ${height} L ${(-phase).toFixed(1)} ${height} Z`, line: d };
  }
  // White caps on every crest, and thin streaks in every trough: both repeat once per wave, so they loop seamlessly.
  function foamCaps(width, l) {
    let d = '';
    for (let cx = -l.phase + l.len / 4; cx < width + l.len; cx += l.len) {
      const w = l.len * 0.2;
      d += `M ${(cx - w).toFixed(1)} ${(l.base - l.amp * 0.55).toFixed(1)} Q ${cx.toFixed(1)} ${(l.base - l.amp * 1.35).toFixed(1)} ${(cx + w).toFixed(1)} ${(l.base - l.amp * 0.55).toFixed(1)} `;
    }
    return d;
  }
  function foamStreaks(width, l) {
    let d = '';
    for (let cx = -l.phase + l.len * 0.75; cx < width + l.len; cx += l.len) {
      const y = l.base + l.amp + 22;
      d += `M ${(cx - l.len * 0.1).toFixed(1)} ${y.toFixed(1)} Q ${cx.toFixed(1)} ${(y - 6).toFixed(1)} ${(cx + l.len * 0.14).toFixed(1)} ${(y + 2).toFixed(1)} `;
    }
    return d;
  }

  // cls: 'auth-waves' fills the sign-in background, 'app-waves' is the band at the bottom of every page
  L.wavesBackground = function (cls = 'auth-waves') {
    const W = 2880; // two periods of 1440 so the slide loops cleanly
    const layers = [
      { h: 300, base: 60, amp: 24, len: 720, phase: 0, fill: '#CDEBFA', foam: 0.0, dur: 46, rev: false, height: '62%' },
      { h: 300, base: 70, amp: 28, len: 480, phase: 120, fill: '#8FD0F1', foam: 0.6, dur: 34, rev: true, height: '52%' },
      { h: 300, base: 75, amp: 26, len: 360, phase: 60, fill: '#4AAEE3', foam: 0.7, dur: 26, rev: false, height: '41%' },
      { h: 300, base: 80, amp: 22, len: 480, phase: 200, fill: '#2179C8', foam: 0.6, dur: 20, rev: true, height: '30%' },
      { h: 300, base: 85, amp: 16, len: 360, phase: 90, fill: '#1C3F94', foam: 0.45, dur: 16, rev: false, height: '18%' }
    ];
    return `<div class="${cls}" aria-hidden="true">${layers.map((l, i) => {
      const p = wavePath(W, l.h, l.base, l.amp, l.len, l.phase);
      const foam = l.foam ? `<path d="${foamCaps(W, l)}" fill="none" stroke="#FFFFFF" stroke-opacity="${l.foam}" stroke-width="7" stroke-linecap="round"/>
        <path d="${foamStreaks(W, l)}" fill="none" stroke="#FFFFFF" stroke-opacity="${(l.foam * 0.5).toFixed(2)}" stroke-width="3" stroke-linecap="round"/>` : '';
      return `<div class="wave-layer" style="height:${l.height};z-index:${i};animation-duration:${l.dur}s;animation-direction:${l.rev ? 'reverse' : 'normal'}">
        <svg viewBox="0 0 ${W} ${l.h}" preserveAspectRatio="none" focusable="false"><path d="${p.fill}" fill="${l.fill}"/>${foam}</svg></div>`;
    }).join('')}</div>`;
  };

  function card(inner) {
    return `<div class="auth-wrap">${L.wavesBackground()}<div class="card auth-card">
      <div class="logo">${L.logo({ width: 200 })}<div class="by">An initiative of Samudra Global</div></div>${inner}</div></div>`;
  }
  function showError(el, msg, kind = 'err') {
    const box = el.querySelector('[data-msg]');
    box.className = `notice ${kind}`;
    box.textContent = msg;
    box.hidden = false;
  }

  L.views.login = async (el) => {
    const demo = L.isDemo ? `<div class="demo-accounts"><span class="label-text">Demo accounts</span>
      <div class="list">${L.apiDemo.accounts().map((a) => `<button type="button" class="btn" data-demo="${esc(a.email)}" data-pass="${esc(a.password)}"><span class="acc-top"><span>${esc(a.label)}</span><span class="soft small">${esc(a.note)}</span></span><span class="acc-cred">${esc(a.email)} / ${esc(a.password)}</span></button>`).join('')}</div></div>` : '';
    el.innerHTML = card(`<h1 class="sr-only">Sign in</h1>
      <form data-form novalidate>
        <div class="notice err" data-msg hidden></div>
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-primary" type="submit">Sign in</button>
        <div class="alt"><a href="#/forgot">Forgot password?</a></div>
      </form>${demo}`);
    const form = el.querySelector('[data-form]');
    async function signIn(email, password) {
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const res = await L.api.post('/auth/login', { email, password });
        L.state.user = res.user;
        L.state.refs = null;
        L.go(res.user.mustChangePassword ? '#/change-password' : '#/dashboard');
      } catch (err) {
        showError(el, err.message);
      } finally { btn.disabled = false; }
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = L.formObject(new FormData(form));
      if (!fd.email || !fd.password) return showError(el, 'Enter your email and password.');
      signIn(fd.email, fd.password);
    });
    el.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
      form.email.value = b.dataset.demo;
      form.password.value = b.dataset.pass;
      signIn(b.dataset.demo, b.dataset.pass);
    }));
  };

  L.views.forgot = async (el) => {
    let email = '';
    function step1() {
      el.innerHTML = card(`<h1 style="font-size:20px;margin-bottom:6px">Reset your password</h1>
        <p class="muted" style="margin-bottom:16px">Enter your email and we will send you a 6-digit code.</p>
        <form data-form novalidate>
          <div class="notice err" data-msg hidden></div>
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required value="${esc(email)}"></div>
          <button class="btn btn-primary" type="submit">Send code</button>
          <div class="alt"><a href="#/login">Back to sign in</a></div>
        </form>`);
      const form = el.querySelector('[data-form]');
      form.email.focus();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        email = form.email.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) return showError(el, 'Enter a valid email.');
        form.querySelector('button').disabled = true;
        try {
          const res = await L.api.post('/auth/forgot', { email });
          step2(res.demoCode);
        } catch (err) { showError(el, err.message); form.querySelector('button').disabled = false; }
      });
    }
    function step2(demoCode) {
      el.innerHTML = card(`<h1 style="font-size:20px;margin-bottom:6px">Enter the code</h1>
        <p class="muted" style="margin-bottom:16px">If <strong>${esc(email)}</strong> has an account, a code is on its way. It expires in 10 minutes.</p>
        ${demoCode ? `<div class="notice warn" style="margin-bottom:14px">Demo: no email is sent. Your code is <strong>${esc(demoCode)}</strong> (also in the Demo outbox).</div>` : ''}
        <form data-form novalidate>
          <div class="notice err" data-msg hidden></div>
          <div class="field"><label for="otp">6-digit code</label><input id="otp" name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>
          <div class="field"><label for="np">New password</label><input id="np" name="newPassword" type="password" autocomplete="new-password" minlength="8" required><span class="help">At least 8 characters.</span></div>
          <div class="field"><label for="np2">Repeat new password</label><input id="np2" name="confirm" type="password" autocomplete="new-password" required></div>
          <button class="btn btn-primary" type="submit">Set new password</button>
          <div class="alt"><button type="button" class="btn-link" data-resend>Send a new code</button> · <a href="#/login">Back to sign in</a></div>
        </form>`);
      const form = el.querySelector('[data-form]');
      form.otp.focus();
      el.querySelector('[data-resend]').addEventListener('click', step1);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = L.formObject(new FormData(form));
        if (!/^\d{6}$/.test(fd.otp)) return showError(el, 'Enter the 6-digit code from the email.');
        if ((fd.newPassword || '').length < 8) return showError(el, 'New password must be at least 8 characters.');
        if (fd.newPassword !== fd.confirm) return showError(el, 'The two passwords do not match.');
        form.querySelector('button[type=submit]').disabled = true;
        try {
          await L.api.post('/auth/reset', { email, otp: fd.otp, newPassword: fd.newPassword });
          el.innerHTML = card('<div class="notice ok">Password changed. You can now sign in with your new password.</div><p style="margin-top:16px;text-align:center"><a class="btn btn-primary" href="#/login">Go to sign in</a></p>');
        } catch (err) { showError(el, err.message); form.querySelector('button[type=submit]').disabled = false; }
      });
    }
    step1();
  };

  L.views.changePassword = async (el, ctx) => {
    const forced = ctx.user.mustChangePassword;
    el.innerHTML = card(`<h1 style="font-size:20px;margin-bottom:6px">${forced ? 'Set your own password' : 'Change password'}</h1>
      <p class="muted" style="margin-bottom:16px">${forced ? 'You signed in with a temporary password. Choose a new one to continue.' : `Signed in as ${esc(ctx.user.email)}.`}</p>
      <form data-form novalidate>
        <div class="notice err" data-msg hidden></div>
        <div class="field"><label for="cp">${forced ? 'Temporary password' : 'Current password'}</label><input id="cp" name="currentPassword" type="password" autocomplete="current-password" required></div>
        <div class="field"><label for="np">New password</label><input id="np" name="newPassword" type="password" autocomplete="new-password" minlength="8" required><span class="help">At least 8 characters.</span></div>
        <div class="field"><label for="np2">Repeat new password</label><input id="np2" name="confirm" type="password" autocomplete="new-password" required></div>
        <button class="btn btn-primary" type="submit">Save password</button>
        <div class="alt">${forced ? '<button type="button" class="btn-link" data-action="logout">Sign out</button>' : '<a href="#/dashboard">Cancel</a>'}</div>
      </form>`);
    const form = el.querySelector('[data-form]');
    form.currentPassword.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = L.formObject(new FormData(form));
      if ((fd.newPassword || '').length < 8) return showError(el, 'New password must be at least 8 characters.');
      if (fd.newPassword !== fd.confirm) return showError(el, 'The two passwords do not match.');
      form.querySelector('button[type=submit]').disabled = true;
      try {
        const res = await L.api.post('/auth/change-password', { currentPassword: fd.currentPassword, newPassword: fd.newPassword });
        L.state.user = res.user;
        L.toast('Password saved.');
        document.getElementById('app').innerHTML = '';
        L.go('#/dashboard');
      } catch (err) { showError(el, err.message); form.querySelector('button[type=submit]').disabled = false; }
    });
  };
})();
