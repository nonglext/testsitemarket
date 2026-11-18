let refreshRequest;

export async function api(path, options = {}) {
  const request = () => fetch('/api' + path, {
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/json'},
    ...options,
  });
  let response = await request();
  if (response.status === 401 && path !== '/auth/refresh' && path !== '/auth/login' && path !== '/auth/register') {
    if (!refreshRequest) {
      refreshRequest = fetch('/api/auth/refresh', {method: 'POST', credentials: 'same-origin'})
        .finally(() => { refreshRequest = null; });
    }
    const refreshed = await refreshRequest;
    if (refreshed.ok) response = await request();
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'Ошибка запроса');
  return data;
}
