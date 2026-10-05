(function () {
  const TOKEN_KEY = 'gs_auth_token';
  const USER_KEY = 'gs_auth_user';
  const originalFetch = window.fetch.bind(window);

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch (_error) { return null; }
  }

  function saveSession(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    window.dispatchEvent(new CustomEvent('gs:auth-ready', { detail: data.user }));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function goToLogin() {
    clearSession();
    if (!window.location.pathname.endsWith('/login.html')) window.location.replace('/login.html');
  }

  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const isApiRequest = new URL(url, window.location.origin).pathname.startsWith('/api/');
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
    const token = getToken();
    if (isApiRequest && token) headers.set('Authorization', `Bearer ${token}`);

    const response = await originalFetch(input, { ...init, headers });
    if (isApiRequest && (response.status === 401 || response.status === 403)) goToLogin();
    return response;
  };

  window.GSAuth = { getToken, getUser, saveSession, clearSession, goToLogin };

  if (!window.location.pathname.endsWith('/login.html') && !getToken()) goToLogin();
})();
