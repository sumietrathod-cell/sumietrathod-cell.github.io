import { api, signIn, signOut, showStatus } from './backend.js';

const byId = id => document.getElementById(id);
const login = byId('login');
const manager = byId('manager');
const status = byId('manager-status');
const form = byId('configuration');
const selection = byId('selection');
const activity = byId('activity');
let token;
let expiration;
let deployments = [];

function clearSession() {
  clearTimeout(expiration);
  token = undefined;
  deployments = [];
  selection.replaceChildren(new Option('New deployment',''));
  form.reset();
  activity.replaceChildren();
  byId('last-activity').textContent = '';
  byId('runtime-link').hidden = true;
  manager.hidden = true;
  byId('manager-login').hidden = false;
}

async function loadDeployments(selectedId = selection.value) {
  const session = token;
  const rows = await api('/rest/v1/voice_deployments?select=*&order=name.asc&limit=200', { token: session });
  if (session !== token) return;
  deployments = rows;
  selection.replaceChildren(new Option('New deployment',''), ...rows.map(row => new Option(row.name, row.id)));
  selection.value = rows.some(row => row.id === selectedId) ? selectedId : '';
}

function showConfiguration() {
  const selected = deployments.find(row => row.id === selection.value);
  byId('name').value = selected?.name ?? '';
  byId('locale').value = selected?.locale ?? 'en-IN';
  byId('greeting').value = selected?.greeting ?? '';
  byId('answer').value = selected?.answer ?? '';
  byId('operator').value = selected?.operator_user_id ?? '';
  byId('enabled').checked = selected?.enabled ?? true;
  const link = byId('runtime-link');
  link.href = selected ? './?agent=' + encodeURIComponent(selected.id) : './';
  link.hidden = !selected?.enabled;
}

async function refreshActivity() {
  activity.replaceChildren();
  const deployment = selection.value;
  const session = token;
  byId('last-activity').textContent = deployment ? 'Loading activity…' : 'Select a saved deployment to view activity.';
  if (!deployment || !session) return;
  const rows = await api('/rest/v1/voice_events?select=event_type,created_at&order=created_at.desc&limit=30&deployment_id=eq.' + encodeURIComponent(deployment), { token: session });
  if (session !== token || deployment !== selection.value) return;
  const labels = { connected: 'Agent connected', turn_completed: 'Voice turn completed', runtime_error: 'Voice turn failed' };
  byId('last-activity').textContent = rows.length ? 'Last activity ' + new Date(rows[0].created_at).toLocaleString() : 'No activity received.';
  activity.replaceChildren(...rows.map(row => {
    const item = document.createElement('li');
    item.textContent = (labels[row.event_type] ?? 'Agent activity') + ' · ' + new Date(row.created_at).toLocaleString();
    return item;
  }));
}

function handleError(error, message) {
  if (error.status === 401) clearSession();
  showStatus(status, error.status === 401 ? 'Sign in again to continue.' : message, true);
}

login.addEventListener('submit', async event => {
  event.preventDefault();
  const button = login.querySelector('button');
  button.disabled = true;
  showStatus(status, 'Signing in…');
  let session;
  try {
    session = await signIn(byId('email').value, byId('password').value);
    if (session.user?.app_metadata?.campaign_manager_role !== 'admin') {
      await signOut(session.access_token).catch(() => {});
      showStatus(status, 'Remote Manager requires an Admin account.', true);
      return;
    }
    token = session.access_token;
    expiration = setTimeout(() => {
      clearSession();
      showStatus(status, 'Session expired. Sign in again.');
    }, session.expires_in * 1000);
    await loadDeployments();
    showConfiguration();
    if (!token) return;
    byId('manager-login').hidden = true;
    manager.hidden = false;
    showStatus(status, '');
    await refreshActivity();
  } catch (error) {
    if (token) await signOut(token).catch(() => {});
    clearSession();
    handleError(error, session ? 'Could not load deployments.' : 'Sign-in failed. Check your email and password.');
  } finally {
    byId('password').value = '';
    button.disabled = false;
  }
});

selection.addEventListener('change', () => {
  showConfiguration();
  refreshActivity().catch(error => handleError(error, 'Could not load activity.'));
});
byId('refresh').addEventListener('click', () => refreshActivity().catch(error => handleError(error, 'Could not load activity.')));

form.addEventListener('submit', async event => {
  event.preventDefault();
  const session = token;
  if (!session) return;
  const button = form.querySelector('button');
  button.disabled = true;
  selection.disabled = true;
  showStatus(status, 'Saving…');
  const deployment = selection.value;
  const fields = {
    name: byId('name').value.trim(), locale: byId('locale').value,
    greeting: byId('greeting').value.trim(), answer: byId('answer').value.trim(),
    operator_user_id: byId('operator').value.trim() || null, enabled: byId('enabled').checked,
    updated_at: new Date().toISOString(),
  };
  try {
    const path = '/rest/v1/voice_deployments' + (deployment ? '?id=eq.' + encodeURIComponent(deployment) : '');
    const saved = await api(path, { token: session, method: deployment ? 'PATCH' : 'POST', data: fields, prefer: 'return=representation' });
    if (session !== token) return;
    if (!saved?.length) throw new Error('Deployment unavailable');
    showStatus(status, 'Deployment saved.');
    await loadDeployments(saved[0].id);
    if (session !== token) return;
    showConfiguration();
    await refreshActivity();
  } catch (error) {
    if (session === token) handleError(error, 'Could not complete the save. Check the fields and refresh before retrying.');
  } finally {
    button.disabled = false;
    selection.disabled = false;
  }
});

byId('logout').addEventListener('click', async () => {
  const previous = token;
  clearSession();
  showStatus(status, 'Signed out.');
  if (previous) await signOut(previous).catch(() => {});
});
