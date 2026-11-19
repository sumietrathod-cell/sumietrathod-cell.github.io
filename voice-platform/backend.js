const backend = 'https://zvrdbekyqbwrztckvkpw.supabase.co';
const publishableKey = 'sb_publishable_BEBIhj5Y3G5BETK9wFZFVw_URRhizrI';

export async function api(path, { token, method = 'GET', data, prefer } = {}) {
  const headers = new Headers({ apikey: publishableKey });
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (prefer) headers.set('Prefer', prefer);
  if (data !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(backend + path, {
    method, headers, cache: 'no-store', signal: AbortSignal.timeout(20000),
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.ok) {
    const error = new Error('Request failed');
    error.status = response.status;
    throw error;
  }
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

export function signIn(email, password) {
  return api('/auth/v1/token?grant_type=password', { method: 'POST', data: { email: email.trim(), password } });
}

export function signOut(token) {
  return api('/auth/v1/logout?scope=local', { token, method: 'POST' });
}

export function showStatus(target, text, error = false) {
  target.textContent = text;
  target.dataset.error = String(error);
}
