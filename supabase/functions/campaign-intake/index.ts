const allowedOrigins = new Set(['https://aarohanaiworld.com', 'https://www.aarohanaiworld.com']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const backend = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const whatsappAppSecret = Deno.env.get('WHATSAPP_APP_SECRET');
const whatsappVerifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
const whatsappNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

function respond(status, data, origin) {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin' });
  if (allowedOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'content-type, apikey');
  }
  if (data !== undefined) headers.set('Content-Type', 'application/json');
  return new Response(data === undefined ? null : JSON.stringify(data), { status, headers });
}

async function readBody(request, maxBytes) {
  if (Number(request.headers.get('content-length')) > maxBytes || !request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function parseJson(bytes) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

function database(path, payload, prefer) {
  if (!backend || !serviceKey) throw new Error('Backend configuration missing');
  const headers = { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  return fetch(backend + path, {
    method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
  });
}

function field(input) {
  return typeof input === 'string' ? input.trim() : '';
}

async function websiteEnquiry(request) {
  const origin = request.headers.get('origin');
  if (!allowedOrigins.has(origin)) return respond(403, { error: 'Origin not allowed' });
  if (request.method === 'OPTIONS') return respond(204, undefined, origin);
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed' }, origin);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return respond(415, { error: 'Expected JSON' }, origin);
  const bytes = await readBody(request, 16384);
  if (!bytes) return respond(413, { error: 'Enquiry too large' }, origin);
  const input = parseJson(bytes);
  const name = field(input?.name);
  const email = field(input?.email);
  const company = field(input?.company);
  const message = field(input?.message);
  if (!input || input.consent !== true || !['chatbot', 'voice'].includes(input.channel) || !name || name.length > 120 ||
      email.length > 254 || !emailPattern.test(email) || company.length > 200 || !message || message.length > 2000 ||
      [name, email, company, message].some(value => value.includes('\0'))) {
    return respond(400, { error: 'Invalid enquiry' }, origin);
  }
  const saved = await database('/rest/v1/rpc/campaign_web_enquiry', {
    channel_name: input.channel, contact_name: name, contact_email: email, business: company, enquiry: message,
  });
  if (!saved.ok) return respond(503, { error: 'Could not receive the enquiry' }, origin);
  return await saved.json()
    ? respond(201, { received: true }, origin)
    : respond(429, { error: 'Try again later' }, origin);
}

async function whatsappWebhook(request, url) {
  if (!whatsappAppSecret || !whatsappVerifyToken || !whatsappNumberId) return respond(503, { error: 'WhatsApp webhook is not configured' });
  if (request.method === 'GET') {
    const expected = new TextEncoder().encode(whatsappVerifyToken);
    const supplied = new TextEncoder().encode(url.searchParams.get('hub.verify_token') ?? '');
    const equal = expected.length === supplied.length && expected.reduce((difference, byte, index) => difference | (byte ^ supplied[index]), 0) === 0;
    const challenge = url.searchParams.get('hub.challenge');
    if (!equal || url.searchParams.get('hub.mode') !== 'subscribe' || !challenge || !/^\d{1,100}$/.test(challenge)) {
      return respond(403, { error: 'Verification failed' });
    }
    return new Response(challenge, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' } });
  }
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed' });
  const digest = request.headers.get('x-hub-signature-256')?.match(/^sha256=([a-f0-9]{64})$/i)?.[1];
  if (!digest) return respond(401, { error: 'Invalid signature' });
  const bytes = await readBody(request, 262144);
  if (!bytes) return respond(413, { error: 'Payload too large' });
  const signature = Uint8Array.from(digest.match(/../g), pair => Number.parseInt(pair, 16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(whatsappAppSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('HMAC', key, signature, bytes)) return respond(401, { error: 'Invalid signature' });
  const input = parseJson(bytes);
  if (input?.object !== 'whatsapp_business_account') return respond(400, { error: 'Invalid payload' });

  const records = new Map();
  for (const entry of (Array.isArray(input.entry) ? input.entry : [])) {
    for (const change of (Array.isArray(entry?.changes) ? entry.changes : [])) {
      const value = change?.value;
      if (change?.field !== 'messages' || value?.metadata?.phone_number_id !== whatsappNumberId) continue;
      const contacts = new Map((Array.isArray(value.contacts) ? value.contacts : [])
        .map(contact => [contact?.wa_id, field(contact?.profile?.name)]));
      for (const message of (Array.isArray(value.messages) ? value.messages : [])) {
        const from = field(message?.from);
        const id = field(message?.id);
        const text = field(message?.text?.body).replaceAll('\0', '');
        if (message?.type !== 'text' || !/^\d{5,20}$/.test(from) || !/^wamid\.[A-Za-z0-9_+=/-]{1,220}$/.test(id) || !text) continue;
        const name = (contacts.get(from) || 'WhatsApp ' + from).replaceAll('\0', '').trim() || 'WhatsApp ' + from;
        records.set(id, { channel: 'whatsapp', name: Array.from(name).slice(0, 120).join(''), phone: '+' + from,
          message: Array.from(text).slice(0, 2000).join(''), external_id: id, intake: 'provider' });
      }
    }
  }
  if (!records.size) return respond(200, { received: true });
  const saved = await database('/rest/v1/campaign_inbox?on_conflict=external_id', [...records.values()], 'resolution=ignore-duplicates,return=minimal');
  return saved.ok ? respond(200, { received: true }) : respond(503, { error: 'Could not receive messages' });
}

Deno.serve(async request => {
  try {
    const url = new URL(request.url);
    // Only the documented endpoints are recognized. Unknown paths must not
    // silently fall through to the unauthenticated website-enquiry intake.
    const route = '/functions/v1/campaign-intake';
    if (url.pathname === route || url.pathname === route + '/') {
      return await websiteEnquiry(request);
    }
    if (url.pathname === route + '/whatsapp') {
      return await whatsappWebhook(request, url);
    }
    return respond(404, { error: 'Not found' }, request.headers.get('origin'));
  } catch {
    return respond(503, { error: 'Service temporarily unavailable' }, request.headers.get('origin'));
  }
});
