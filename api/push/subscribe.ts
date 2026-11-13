// Vercel serverless function. Keep this endpoint self-contained: subscription
// records go straight to PostgREST with the server-only service-role key.

const MAX_ENDPOINT_LENGTH = 2_048;
const MAX_KEY_LENGTH = 512;

export interface PushSubscriptionInput {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  lang?: string;
  topic?: string;
}

/**
 * The streams one browser subscription can carry. `sky` is Sky Alerts, the
 * stream every subscription had before topics existed, and stays the default
 * when a request names none. `lunation` is the Moon journal's reminder on the
 * day of each new and full Moon.
 */
export type PushTopic = 'sky' | 'lunation';
const TOPIC_COLUMN: Record<PushTopic, 'sky_alerts' | 'lunation_reminders'> = {
  sky: 'sky_alerts',
  lunation: 'lunation_reminders',
};

/** A missing topic means Sky Alerts; anything else unknown is refused. */
export function parseTopic(value: unknown): PushTopic | null {
  if (value === undefined || value === null || value === 'sky') return 'sky';
  return value === 'lunation' ? 'lunation' : null;
}

function firstHeader(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

function requestHeader(req: any, name: string): string {
  if (typeof req.get === 'function') {
    const value = req.get(name);
    if (typeof value === 'string') return value;
  }
  return firstHeader(req.headers?.[name.toLowerCase()]);
}

function hostname(value: string): string {
  const first = value.split(',')[0]?.trim().toLowerCase() ?? '';
  if (!first) return '';
  try {
    return new URL(first.includes('://') ? first : `https://${first}`).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Allow only the production site or the Vercel preview serving this request. */
export function isAllowedSiteRequest(req: any): boolean {
  const source = requestHeader(req, 'origin') || requestHeader(req, 'referer');
  if (!source) return false;

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return false;
  }
  if (sourceUrl.protocol !== 'https:') return false;

  const sourceHost = sourceUrl.hostname.toLowerCase();
  const requestHost = hostname(requestHeader(req, 'x-forwarded-host') || requestHeader(req, 'host'));
  if (!requestHost || sourceHost !== requestHost) return false;
  return sourceHost === 'zodiacs.org'
    || sourceHost === 'www.zodiacs.org'
    || sourceHost.endsWith('.vercel.app');
}

function parseBody(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function validEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ENDPOINT_LENGTH) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

// Browser push endpoints come from a closed set of vendor push services;
// anything else is junk that would bloat the table and slow the daily
// delivery job against dead endpoints. Suffix entries cover the vendors'
// regional shards (web.push.apple.com, sin.notify.windows.com, …). The
// gate applies to inserts only — unsubscribe stays open so any
// previously stored endpoint can still be removed.
const PUSH_SERVICE_HOSTS = Object.freeze([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
]);
const PUSH_SERVICE_HOST_SUFFIXES = Object.freeze([
  '.push.apple.com',
  '.notify.windows.com',
  '.push.services.mozilla.com',
]);

export function isKnownPushServiceHost(host: string): boolean {
  const candidate = host.toLowerCase();
  return PUSH_SERVICE_HOSTS.includes(candidate)
    || PUSH_SERVICE_HOST_SUFFIXES.some((suffix) => candidate.endsWith(suffix));
}

function validKey(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_KEY_LENGTH
    && /^[A-Za-z0-9_-]+={0,2}$/.test(value);
}

export interface ParsedSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  lang: string;
}

export function parseSubscription(input: unknown): ParsedSubscription | null {
  const body = parseBody(input);
  if (!body || typeof body !== 'object') return null;
  const candidate = body as PushSubscriptionInput;
  if (!validEndpoint(candidate.endpoint)
    || !isKnownPushServiceHost(new URL(candidate.endpoint).hostname)
    || !validKey(candidate.keys?.p256dh)
    || !validKey(candidate.keys?.auth)) return null;
  const requestedLang = candidate.lang?.trim().toLowerCase() ?? '';
  const lang = requestedLang === 'es' || requestedLang.startsWith('es-')
    ? 'es'
    : requestedLang === 'pt' || requestedLang.startsWith('pt-')
      ? 'pt'
      : requestedLang === 'fr' || requestedLang.startsWith('fr-')
        ? 'fr'
        : requestedLang === 'it' || requestedLang.startsWith('it-') ? 'it' : 'en';
  return {
    endpoint: candidate.endpoint,
    keys: { p256dh: candidate.keys.p256dh, auth: candidate.keys.auth },
    lang,
  };
}

export function parseUnsubscribe(input: unknown): string | null {
  const body = parseBody(input);
  if (!body || typeof body !== 'object') return null;
  const endpoint = (body as { endpoint?: unknown }).endpoint;
  return validEndpoint(endpoint) ? endpoint : null;
}

/** The topic a request body names, or null when it names an unknown one. */
export function requestTopic(input: unknown): PushTopic | null {
  const body = parseBody(input);
  if (!body || typeof body !== 'object') return 'sky';
  return parseTopic((body as { topic?: unknown }).topic);
}

/** `{ action: 'status', endpoint }`: which streams this browser's endpoint carries. */
export function parseStatusRequest(input: unknown): string | null {
  const body = parseBody(input);
  if (!body || typeof body !== 'object' || (body as { action?: unknown }).action !== 'status') return null;
  return parseUnsubscribe(body);
}

/**
 * The row written for an enrollment. Only the chosen stream's column is
 * sent: on insert the other stream takes the column default (off), and on
 * conflict PostgREST's merge-duplicates updates only the columns sent, so an
 * existing opt-in to the other stream is kept. The language follows Sky
 * Alerts, whose copy is localized; adding the English-only Moon journal
 * reminder to an existing row leaves its language alone.
 */
export function enrollmentRow(subscription: ParsedSubscription, topic: PushTopic): Record<string, string | boolean> {
  const row: Record<string, string | boolean> = {
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    [TOPIC_COLUMN[topic]]: true,
  };
  if (topic === 'sky') Object.assign(row, {
    lang: subscription.lang,
  });
  return row;
}

type JsonValue = string | boolean | { [key: string]: boolean };

function sendJson(res: any, status: number, body: Record<string, JsonValue>): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function serviceHeaders(serviceKey: string, prefer: string): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    sendJson(res, 405, { error: 'method' });
    return;
  }
  if (!isAllowedSiteRequest(req)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }
  if (process.env.PUSH_ENABLED !== '1') {
    sendJson(res, 503, { error: 'disabled' });
    return;
  }

  const url = process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    sendJson(res, 503, { error: 'unavailable' });
    return;
  }

  const root = url.replace(/\/+$/, '');
  const rows = `${root}/rest/v1/push_subscriptions`;
  const topic = requestTopic(req.body);
  if (!topic) {
    sendJson(res, 400, { error: 'invalid' });
    return;
  }

  try {
    if (req.method === 'POST') {
      const statusEndpoint = parseStatusRequest(req.body);
      if (statusEndpoint) {
        // The endpoint is the browser's own unguessable capability; reading
        // back its two flags tells the page which streams are on.
        const response = await fetch(
          `${rows}?endpoint=eq.${encodeURIComponent(statusEndpoint)}&select=sky_alerts,lunation_reminders`,
          { headers: serviceHeaders(serviceKey, 'return=representation') },
        );
        if (!response.ok) throw new Error(`PostgREST ${response.status}`);
        const found = await response.json();
        const row = Array.isArray(found) ? found[0] : null;
        sendJson(res, 200, {
          ok: true,
          topics: { sky: row?.sky_alerts === true, lunation: row?.lunation_reminders === true },
        });
        return;
      }

      const subscription = parseSubscription(req.body);
      if (!subscription) {
        sendJson(res, 400, { error: 'invalid' });
        return;
      }
      const response = await fetch(`${rows}?on_conflict=endpoint`, {
        method: 'POST',
        headers: serviceHeaders(serviceKey, 'resolution=merge-duplicates,return=minimal'),
        body: JSON.stringify(enrollmentRow(subscription, topic)),
      });
      if (!response.ok) throw new Error(`PostgREST ${response.status}`);
      sendJson(res, 200, { ok: true });
      return;
    }

    const pushEndpoint = parseUnsubscribe(req.body);
    if (!pushEndpoint) {
      sendJson(res, 400, { error: 'invalid' });
      return;
    }
    const match = `endpoint=eq.${encodeURIComponent(pushEndpoint)}`;
    const named = (parseBody(req.body) as { topic?: unknown }).topic !== undefined;
    if (!named) {
      // A request that names no stream comes from a page built before
      // topics: it turns off everything this browser receives.
      const response = await fetch(`${rows}?${match}`, {
        method: 'DELETE',
        headers: serviceHeaders(serviceKey, 'return=minimal'),
      });
      if (!response.ok) throw new Error(`PostgREST ${response.status}`);
      sendJson(res, 200, { ok: true, remaining: false });
      return;
    }

    // Turning off one stream: when the other is off too the row goes, so a
    // subscription never outlives every stream it was kept for; otherwise
    // only this stream's flag is cleared and the other keeps working.
    const other = TOPIC_COLUMN[topic === 'sky' ? 'lunation' : 'sky'];
    const removed = await fetch(`${rows}?${match}&${other}=is.false&select=endpoint`, {
      method: 'DELETE',
      headers: serviceHeaders(serviceKey, 'return=representation'),
    });
    if (!removed.ok) throw new Error(`PostgREST ${removed.status}`);
    const removedRows = await removed.json();
    if (Array.isArray(removedRows) && removedRows.length > 0) {
      sendJson(res, 200, { ok: true, remaining: false });
      return;
    }
    const cleared = await fetch(`${rows}?${match}&select=endpoint`, {
      method: 'PATCH',
      headers: serviceHeaders(serviceKey, 'return=representation'),
      body: JSON.stringify({ [TOPIC_COLUMN[topic]]: false }),
    });
    if (!cleared.ok) throw new Error(`PostgREST ${cleared.status}`);
    const clearedRows = await cleared.json();
    sendJson(res, 200, { ok: true, remaining: Array.isArray(clearedRows) && clearedRows.length > 0 });
  } catch {
    sendJson(res, 502, { error: 'unavailable' });
  }
}
