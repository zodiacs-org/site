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
    // A synthetic wall time in UTC: no one's birth. The compute function is
    // on unless COMPUTE_API_ENABLED=0, which answers the designed 503.
    label: 'compute api time',
    path: '/api/v1/time',
    init: {
      method: 'POST',
      headers: { ...sameOriginHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ local: { date: '2000-01-01', time: '12:00', zone: 'UTC' } }),
    },
    accepts: (status) => status === 200 || status === 503,
    expectation: 'HTTP 200, or the designed HTTP 503 when the API is switched off',
    validate: (response, body) => {
      if ((response.headers.get('cache-control') ?? '') !== 'no-store') return 'a compute response is cacheable';
      if ((response.headers.get('access-control-allow-origin') ?? '') !== '*') return 'a compute response is not readable cross-origin';
      let answer;
      try {
        answer = JSON.parse(body);
      } catch {
        return 'the compute response is not valid JSON';
      }
      if (response.status === 503) return answer?.error?.code === 'disabled' ? null : 'the 503 is not the designed disabled refusal';
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
