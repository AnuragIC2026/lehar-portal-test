/* Live adapter: talks to the Node/Express API on the same server. */
(function () {
  const L = (window.L = window.L || {});
  const base = (window.LEHAR_CONFIG && window.LEHAR_CONFIG.apiBase) || '/api';

  async function request(method, path, body) {
    const opts = { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'lehar' } };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(base + path, opts);
    } catch (e) {
      throw Object.assign(new Error('Cannot reach the server. Check your internet connection.'), { status: 0 });
    }
    let data = {};
    const type = res.headers.get('content-type') || '';
    if (type.includes('application/json')) data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status}).`);
      err.status = res.status;
      err.code = data.code;
      if (L.onAuthError && (res.status === 401 || data.code === 'MUST_CHANGE_PASSWORD') && !path.startsWith('/auth/')) L.onAuthError(err);
      throw err;
    }
    return data;
  }

  L.apiLive = {
    mode: 'live',
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b ?? {}),
    put: (p, b) => request('PUT', p, b ?? {}),
    patch: (p, b) => request('PATCH', p, b ?? {}),
    del: (p) => request('DELETE', p),
    upload: (p, formData) => request('POST', p, formData),
    openDocument(id, { download = false } = {}) {
      window.open(`${base}/documents/${id}/download${download ? '' : '?inline=1'}`, '_blank', 'noopener');
    },
    exportExcel() {
      window.location.href = `${base}/reports/export.xlsx`;
    }
  };
})();
