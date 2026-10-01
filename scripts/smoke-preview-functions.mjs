import { randomBytes } from 'node:crypto';

const rawPreviewUrl = process.env.PREVIEW_URL;
const expectedProjectId = process.env.VERCEL_PROJECT_ID?.trim() ?? '';
const deploymentProjectId = process.env.DEPLOYMENT_PROJECT_ID?.trim() ?? '';

if (!rawPreviewUrl) {
  throw new Error('PREVIEW_URL is required.');
}
if (!expectedProjectId || deploymentProjectId !== expectedProjectId) {
  throw new Error('Refusing to probe a deployment outside the configured Vercel project.');
}

const previewUrl = new URL(rawPreviewUrl);
const allowedPreviewHostname = /^zodiacs(?:-org)?-[a-z0-9-]+-zodiacsofficial\.vercel\.app$/u;
if (
  previewUrl.protocol !== 'https:'
  || previewUrl.username
  || previewUrl.password
  || previewUrl.port
  || previewUrl.pathname !== '/'
  || previewUrl.search
  || previewUrl.hash
  || !allowedPreviewHostname.test(previewUrl.hostname)
) {
  throw new Error(`Refusing to probe a non-Vercel preview URL: ${previewUrl.origin}`);
}

const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? '';
if (/[\r\n]/.test(protectionBypass)) {
  throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET contains invalid header characters.');
}

const protectionFailure = protectionBypass
  ? 'Vercel rejected the configured automation bypass'
  : 'the no-secret smoke requires a public Preview deployment';
const sameOriginHeaders = {
  accept: 'application/json',
  origin: previewUrl.origin,
  referer: `${previewUrl.origin}/`,
  'user-agent': 'zodiacs-preview-function-smoke/1.0',
  ...(protectionBypass ? { 'x-vercel-protection-bypass': protectionBypass } : {}),
};
const syntheticUnsubscribeToken = randomBytes(32).toString('base64url');
if (syntheticUnsubscribeToken.length !== 43) {
  throw new Error('Failed to generate a valid synthetic unsubscribe token.');
}
// A well-formed calendar feed id that no feed has: the probes below make,
// read and remove nothing, and never present a removal key or the sweep's
// secret.
const syntheticFeedId = randomBytes(16).toString('base64url');
if (!/^[A-Za-z0-9_-]{21}[AQgw]$/u.test(syntheticFeedId)) {
  throw new Error('Failed to generate a well-formed synthetic calendar feed id.');
}

/** The body as JSON, or undefined when it is not JSON. */
function jsonBody(body) {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/** Null when the response is the calendar function's own JSON answer, else what is wrong. */
function calendarJson(response, body, expected) {
  if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return 'the answer is not the calendar function\'s JSON (is the rewrite in vercel.json deployed?)';
  }
  if (!(response.headers.get('cache-control') ?? '').toLowerCase().includes('no-store')) return 'the answer is cacheable';
  if (JSON.stringify(jsonBody(body)) !== JSON.stringify(expected)) return `expected ${JSON.stringify(expected)}`;
  return null;
}

/**
 * The calendar function answers 403 {"error":"forbidden"} to a write from an
 * origin it does not accept. From this deployment's own address that means it
 * cannot tell which deployment it is, and would refuse every page as well.
 */
const CALENDAR_ORIGIN_REFUSED = 'the calendar function refused this deployment\'s own origin: it needs VERCEL_ENV and VERCEL_URL '
  + '(project settings, Environment Variables, "Enable access to System Environment Variables"), '
  + 'without which every calendar creation and removal answers 403';

const probes = [
  {
    label: 'email subscribe',
    path: '/api/email/subscribe',
    init: {
      method: 'POST',
      headers: { ...sameOriginHeaders, 'content-type': 'application/json' },
      // The filled honeypot is still valid input, but prevents a configured
      // provider from sending mail if Preview gains ESP configuration later.
      body: JSON.stringify({
        email: 'preview-smoke@example.com',
        locale: 'en',
        website: 'preview-smoke',
      }),
    },
    accepts: (status) => status < 500 || status === 503,
    expectation: 'a non-5xx response or the designed HTTP 503 disabled response',
  },
  {
    label: 'email confirm',
    path: '/api/email/confirm?token=x',
    init: { method: 'GET', headers: sameOriginHeaders },
    accepts: (status) => status < 500 || status === 503,
    expectation: 'a non-5xx response or the designed HTTP 503 disabled response',
  },
  {
    label: 'weekly digest unsubscribe confirmation',
    path: `/api/unsubscribe?token=${syntheticUnsubscribeToken}`,
    init: { method: 'GET', headers: sameOriginHeaders },
    accepts: (status) => status === 200,
    expectation: 'HTTP 200 confirmation without invoking the unsubscribe RPC',
    redactRequest: true,
    redactBody: true,
    validate: (response, body) => {
      const cacheControl = response.headers.get('cache-control') ?? '';
      const robots = response.headers.get('x-robots-tag') ?? '';
      const referrer = response.headers.get('referrer-policy') ?? '';
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('text/html')) return 'confirmation response is not HTML';
      if (!cacheControl.toLowerCase().includes('no-store')) return 'confirmation response is cacheable';
      if (!robots.toLowerCase().includes('noindex')) return 'confirmation response is indexable';
      if (referrer.toLowerCase() !== 'no-referrer') return 'confirmation response can leak its URL as a referrer';
      if (!/<form\s[^>]*method=["']POST["']/u.test(body)) return 'confirmation response has no POST form';
      if (!body.includes('Confirm unsubscribe')) return 'confirmation response is missing its explicit action';
      if (body.includes('Done — you’re unsubscribed.')) return 'GET rendered the post-mutation success state';
      return null;
    },
  },
  {
    label: 'wallet birth',
    path: '/api/wallet-birth',
    init: {
      method: 'POST',
      headers: { ...sameOriginHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ address: 'preview-smoke' }),
    },
    accepts: (status) => status < 500,
    expectation: 'a non-5xx response',
  },
  {
    label: 'calendar method guard',
    path: '/api/calendar/transits',
    init: { method: 'POST', headers: sameOriginHeaders },
    accepts: (status) => status === 405,
    expectation: 'HTTP 405',
  },
  {
    label: 'calendar feed creation method guard',
    path: '/api/calendar/feeds',
    init: { method: 'GET', headers: sameOriginHeaders },
    accepts: (status) => status === 405,
    expectation: 'HTTP 405 from the calendar function',
    validate: (response, body) => ((response.headers.get('allow') ?? '') !== 'POST'
      ? 'the answer does not allow POST'
      : calendarJson(response, body, { error: 'method' })),
  },
  {
    label: 'calendar feed creation from a malformed code',
    path: '/api/calendar/feeds',
    init: {
      method: 'POST',
      headers: { ...sameOriginHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ positions: 'preview-smoke' }),
    },
    accepts: (status) => status === 400,
    expectation: 'HTTP 400 without making a feed',
    forbidden: CALENDAR_ORIGIN_REFUSED,
    validate: (response, body) => calendarJson(response, body, { error: 'invalid_positions' }),
  },
  {
    label: 'calendar feed by an id no feed has',
    path: `/api/calendar/feeds/${syntheticFeedId}`,
    init: { method: 'GET', headers: sameOriginHeaders },
    accepts: (status) => status === 404 || status === 503,
    expectation: 'HTTP 404, or the designed HTTP 503 where Preview has no feed store',
    validate: (response, body) => {
      const expected = response.status === 404
        ? 'There is no calendar at this address.'
        : 'The calendar is unavailable right now.';
      if (body !== expected) return 'the answer is not the calendar function\'s (is the rewrite in vercel.json deployed?)';
      if (!(response.headers.get('cache-control') ?? '').toLowerCase().includes('no-store')) return 'the answer is cacheable';
      if (response.headers.get('vercel-cache-tag')) return 'the answer carries a feed cache tag';
      return null;
    },
  },
  {
    label: 'calendar feed removal without its key',
    path: `/api/calendar/feeds/${syntheticFeedId}`,
    init: { method: 'DELETE', headers: sameOriginHeaders },
    accepts: (status) => status === 404,
    expectation: 'HTTP 404 without removing anything',
    forbidden: CALENDAR_ORIGIN_REFUSED,
    validate: (response, body) => calendarJson(response, body, { error: 'not_found' }),
  },
  {
    label: 'calendar feed sweep without its secret',
    path: '/api/calendar/feed-sweep',
    init: { method: 'POST', headers: sameOriginHeaders },
    accepts: (status) => status === 404,
    expectation: 'HTTP 404 without sweeping',
    validate: (response, body) => calendarJson(response, body, { error: 'not_found' }),
  },
  {
    label: 'assistant method guard',
    path: '/api/assistant',
    init: { method: 'GET', headers: sameOriginHeaders },
    accepts: (status) => status === 405,
    expectation: 'HTTP 405',
  },
  {
    label: 'sky data api index',
    path: '/api/v1/index.json',
    init: { method: 'GET', headers: sameOriginHeaders },
    accepts: (status) => status === 200,
    expectation: 'HTTP 200 static JSON with open CORS',
    validate: (response, body) => {
      const cors = response.headers.get('access-control-allow-origin') ?? '';
      const contentType = response.headers.get('content-type') ?? '';
      if (cors !== '*') return 'index.json is not readable cross-origin';
      if (!contentType.toLowerCase().includes('json')) return 'index.json is not served as JSON';
      let index;
      try {
        index = JSON.parse(body);
      } catch {
        return 'index.json is not valid JSON';
      }
      if (index.schema !== 'zodiacs.sky-api.index.v1') return 'index.json schema is not zodiacs.sky-api.index.v1';
      if (!Array.isArray(index.endpoints) || index.endpoints.length === 0) return 'index.json lists no endpoints';
      if (!Array.isArray(index.documents) || !index.documents.some((entry) => entry?.path === '/api/v1/llms.txt')) {
        return 'index.json does not advertise the agent guide';
      }
      return null;
    },
  },
  {
    label: 'sky data api openapi',
    path: '/api/v1/openapi.json',
    init: { method: 'GET', headers: sameOriginHeaders },
    accepts: (status) => status === 200,
    expectation: 'HTTP 200 OpenAPI document with open CORS',
    validate: (response, body) => {
      if ((response.headers.get('access-control-allow-origin') ?? '') !== '*') return 'openapi.json is not readable cross-origin';
      let document;
      try {
        document = JSON.parse(body);
      } catch {
        return 'openapi.json is not valid JSON';
      }
      if (typeof document.openapi !== 'string' || !document.openapi.startsWith('3.1')) return 'openapi.json is not OpenAPI 3.1';
      if (!document.paths?.['/api/v1/sky/today.json']) return 'openapi.json does not describe sky/today.json';
      if (!document.paths?.['/api/v1/chart']?.post) return 'openapi.json does not describe the compute endpoints';
      return null;
    },
  },
  {
    // A synthetic wall time in UTC: no one's birth. The compute function
    // answers 200 while its Firewall rules are in place; COMPUTE_API_ENABLED=0
    // answers the designed 503 disabled, and a missing or unreadable rate
    // limit the designed 503 rate-limit-unavailable (it fails closed).
    label: 'compute api time',
    path: '/api/v1/time',
    init: {
      method: 'POST',
      headers: { ...sameOriginHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ local: { date: '2000-01-01', time: '12:00', zone: 'UTC' } }),
    },
    accepts: (status) => status === 200 || status === 503,
    expectation: 'HTTP 200, or a designed HTTP 503 when the API is switched off or its rate limit is not in place',
    validate: (response, body) => {
      if ((response.headers.get('cache-control') ?? '') !== 'no-store') return 'a compute response is cacheable';
      if ((response.headers.get('access-control-allow-origin') ?? '') !== '*') return 'a compute response is not readable cross-origin';
      let answer;
      try {
        answer = JSON.parse(body);
      } catch {
        return 'the compute response is not valid JSON';
      }
      if (response.status === 503) {
        return ['disabled', 'rate-limit-unavailable'].includes(answer?.error?.code) && response.headers.get('retry-after')
          ? null : 'the 503 is not a designed refusal with Retry-After';
      }
      if (answer.schema !== 'zodiacs.compute-api.time.v1') return 'the time answer has the wrong schema';
      if (answer.result?.utc !== '2000-01-01T12:00:00.000Z') return 'the time answer resolved 12:00 UTC to another instant';
      if (answer.cite?.url !== 'https://zodiacs.org/developers/compute/#time') return 'the time answer does not cite its documentation';
      if (!/^sha256:[0-9a-f]{64}$/u.test(answer.cite?.receipt ?? '')) return 'the time answer does not cite its receipt digest';
      return null;
    },
  },
  {
    label: 'compute api method guard',
    path: '/api/v1/chart',
    init: { method: 'GET', headers: sameOriginHeaders },
    accepts: (status) => status === 405,
    expectation: 'HTTP 405',
    validate: (response) => ((response.headers.get('cache-control') ?? '') === 'no-store'
      ? null : 'the 405 from a compute path is cacheable'),
  },
];

function annotation(value) {
  return String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function bodyExcerpt(body) {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > 500 ? `${oneLine.slice(0, 500)}…` : oneLine;
}

function safeDiagnostic(probe, value) {
  const diagnostic = String(value);
  return probe.redactRequest
    ? diagnostic.replaceAll(syntheticUnsubscribeToken, '[redacted synthetic token]')
    : diagnostic;
}

const failures = [];
for (const probe of probes) {
  const endpoint = new URL(probe.path, previewUrl);
  let response;
  let body = '';
  try {
    response = await fetch(endpoint, {
      ...probe.init,
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    body = await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${probe.label}: request failed: ${safeDiagnostic(probe, message)}`);
    continue;
  }

  const vercelError = response.headers.get('x-vercel-error') ?? '';
  const location = response.headers.get('location') ?? '';
  const functionInvocationFailed = vercelError.toUpperCase().includes('FUNCTION_INVOCATION_FAILED')
    || body.toUpperCase().includes('FUNCTION_INVOCATION_FAILED');
  const requestTarget = probe.redactRequest
    ? `${endpoint.pathname}?[redacted synthetic token]`
    : `${endpoint.pathname}${endpoint.search}`;
  console.log(`\n${probe.init.method} ${requestTarget}`);
  console.log(`status: ${response.status}`);
  console.log(`content-type: ${response.headers.get('content-type') ?? '(none)'}`);
  console.log(`x-vercel-error: ${vercelError || '(none)'}`);
  if (location) console.log(`location: ${safeDiagnostic(probe, location)}`);
  console.log(`body: ${probe.redactBody ? '(redacted)' : bodyExcerpt(body) || '(empty)'}`);

  if (functionInvocationFailed) {
    failures.push(`${probe.label}: Vercel reported FUNCTION_INVOCATION_FAILED`);
    continue;
  }
  if (response.status >= 300 && response.status < 400) {
    failures.push(
      `${probe.label}: preview redirected (${response.status}) to ${safeDiagnostic(probe, location || '(missing location)')}; `
      + protectionFailure,
    );
    continue;
  }
  if (response.status === 403 && probe.forbidden
    && JSON.stringify(jsonBody(body)) === JSON.stringify({ error: 'forbidden' })) {
    failures.push(`${probe.label}: ${probe.forbidden}`);
    continue;
  }
  if (response.status === 401 || response.status === 403) {
    failures.push(
      `${probe.label}: preview returned ${response.status}; ${protectionFailure}`,
    );
    continue;
  }
  if (!probe.accepts(response.status)) {
    failures.push(`${probe.label}: expected ${probe.expectation}, received HTTP ${response.status}`);
    continue;
  }
  const validationFailure = probe.validate?.(response, body);
  if (validationFailure) {
    failures.push(`${probe.label}: ${validationFailure}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`::error title=Preview API smoke failed::${annotation(failure)}`);
  }
  process.exitCode = 1;
} else {
  console.log(`\nPreview API smoke passed for ${previewUrl.origin}`);
}
