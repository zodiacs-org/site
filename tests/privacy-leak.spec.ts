/**
 * Zero network leak proof for the calculators: no request the browser makes
 * while a birth chart, a two-person comparison, a chart without a birth time
 * or an invitation is worked out carries the birth date, the birth time, the
 * birthplace or its coordinates. Plain `npm test` skips it (it needs Chrome
 * and a server). Run it after `npm run build`:
 *
 *   npm run test:privacy-leak                              the build in dist/, served on 127.0.0.1
 *   BASE_URL=https://<preview-host> npm run test:privacy-leak     a deployment
 *
 *   VERCEL_BYPASS         a protected preview's bypass token. It is sent once, to the
 *                         deployment's own host, to obtain Vercel's bypass cookie, and
 *                         is never printed or written to the report.
 *   PRIVACY_LEAK_REPORT   where the JSON report goes (default: the system temp directory).
 *   PRIVACY_LEAK_ALLOW_HOSTS   comma-separated hosts other than the site's own that the
 *                         pages may address (default: plausible.io, the analytics
 *                         processor the privacy page names). Any other host fails the run.
 *   PRIVACY_LEAK_THIRD_PARTY   "block" (default): a request to another host is recorded,
 *                         scanned and then dropped, so the run itself sends nothing to a
 *                         third party. "allow-get": its GET requests go through (an
 *                         analytics script then loads and tries to report), while every
 *                         other method is still recorded, scanned and dropped, so no
 *                         analytics event is ever written by this test.
 *
 * (The npm script hands BASE_URL over as PRIVACY_LEAK_BASE_URL, because Vitest
 * sets BASE_URL itself inside the test process.)
 *
 * How it listens. Every request of the browser context is recorded through
 * Playwright, with service worker requests included, and again through the
 * DevTools protocol's Network domain, which also reports beacons and
 * WebSocket frames. Inside the page, fetch, XMLHttpRequest, sendBeacon,
 * WebSocket and EventSource are wrapped before any site script runs, so a call
 * is seen even if the request never leaves. `zodiacsAnalytics.track` is
 * wrapped too: what the page would hand to analytics is scanned whether or not
 * this build loads an analytics script.
 *
 * What counts as a leak. For each person entered, every recorded URL, header
 * and body is searched for the birth date in the common written forms, the
 * birth time (local and UTC, 24 and 12 hour), the instant as an epoch number,
 * the place as typed, the city's name, its time zone's name, and its
 * coordinates to two decimals; long base64 runs are decoded and searched as
 * well. The expected number of matches is 0.
 *
 * The boundary, which is not zero information. The files a flow downloads
 * depend on three things, and the test holds the dependence to exactly these:
 *   1. the first letter of the place typed: /data/cities/<letter>.json
 *      (one request per letter, none per keystroke), as the privacy page says;
 *   2. for a birth before 1970, one file of time zone history, named for a
 *      group of zones, as the privacy page says;
 *   3. whether a birth time was given: a chart without one downloads one more
 *      script (share-positions-noon). The privacy page does not say this yet.
 * Apart from those, two different births produce the same set of requests.
 *
 * All birth data here is invented for the test.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser, BrowserContext, Page, Request } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { startPreview } from './visual/preview-server.mjs';

const ENABLED = process.env.PRIVACY_LEAK === '1';
const EXTERNAL = (process.env.PRIVACY_LEAK_BASE_URL ?? '').trim().replace(/\/$/, '');
const BYPASS = (process.env.VERCEL_BYPASS ?? '').trim();
const REPORT_PATH = process.env.PRIVACY_LEAK_REPORT ?? join(tmpdir(), 'privacy-leak-report.json');
const ALLOWED_HOSTS = (process.env.PRIVACY_LEAK_ALLOW_HOSTS ?? 'plausible.io').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
const THIRD_PARTY = process.env.PRIVACY_LEAK_THIRD_PARTY === 'allow-get' ? 'allow-get' : 'block';

interface Person {
  label: string;
  date: string;
  time: string;
  /** What is typed into the place field. */
  typed: string;
  /** The row the search must offer first, as scripts/build-cities.mjs files it. */
  city: string;
  timeZone: string;
  /** The city's coordinates in hundredths of a degree, as the city file holds them. */
  lat100: number;
  lon100: number;
  /** The birth instant in UTC, worked out by hand from the zone's offset on that date. */
  utc: string;
}

// Invented people. A is the sprint's fixture; B differs from A in every field; C was born before 1970.
const PERSON_A: Person = { label: 'A', date: '1990-06-15', time: '14:30', typed: 'New York', city: 'New York City', timeZone: 'America/New_York', lat100: 4071, lon100: -7401, utc: '1990-06-15T18:30:00Z' };
const PERSON_B: Person = { label: 'B', date: '1987-03-09', time: '06:45', typed: 'Lisbon', city: 'Lisbon', timeZone: 'Europe/Lisbon', lat100: 3873, lon100: -915, utc: '1987-03-09T06:45:00Z' };
const PERSON_C: Person = { label: 'C', date: '1961-11-04', time: '09:20', typed: 'Mumbai', city: 'Mumbai', timeZone: 'Asia/Kolkata', lat100: 1907, lon100: 7288, utc: '1961-11-04T03:50:00Z' };

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

type Kind = 'date' | 'time' | 'place' | 'coordinates';
interface Needle {
  kind: Kind;
  text: string;
  /**
   * 'anywhere': searched in the whole URL, the headers and the body.
   * 'data': not in the URL's path, where a file's content hash or a page's own
   * address could hold the same characters by chance; only in the query string,
   * the headers and the body.
   */
  where: 'anywhere' | 'data';
}

/** Every written form of a person's birth data the scan looks for, lower case. */
function needlesFor(person: Person, timeKnown = true): Needle[] {
  const [year, month, day] = person.date.split('-') as [string, string, string];
  const [m, d] = [String(Number(month)), String(Number(day))];
  const name = MONTHS[Number(month) - 1]!;
  const short = name.slice(0, 3);
  const list: Needle[] = [];
  const add = (kind: Kind, where: Needle['where'], ...texts: string[]) => texts.forEach((text) => list.push({ kind, text: text.toLowerCase(), where }));

  add('date', 'anywhere', `${year}-${month}-${day}`, `${year}/${month}/${day}`, `${year}.${month}.${day}`,
    `${month}/${day}/${year}`, `${day}/${month}/${year}`, `${m}/${d}/${year}`, `${d}/${m}/${year}`,
    `${day}.${month}.${year}`, `${day}-${month}-${year}`, `${month}-${day}-${year}`, `${d}.${m}.${year}`);
  add('date', 'data', `${year}${month}${day}`, `${day}${month}${year}`, `${month}${day}${year}`, year,
    `${name} ${d}`, `${d} ${name}`, `${short} ${d}`, `${d} ${short}`, `${name} ${day}`, `${day} ${name}`);

  if (timeKnown) {
    const [hour, minute] = person.time.split(':') as [string, string];
    const h12 = ((Number(hour) + 11) % 12) + 1;
    const meridiem = Number(hour) < 12 ? 'am' : 'pm';
    const utcClock = person.utc.slice(11, 16);
    add('time', 'anywhere', `${hour}:${minute}`, `${h12}:${minute} ${meridiem}`, `${h12}:${minute}${meridiem}`, `t${utcClock}`, `${person.date}t${hour}`);
    add('time', 'data', `${hour}${minute}`, `${hour}.${minute}`, `${hour}h${minute}`, utcClock, utcClock.replace(':', ''));
    const epoch = Date.parse(person.utc);
    add('time', 'anywhere', String(epoch), String(epoch / 1000), String(epoch / 60_000));
  }

  const zoneCity = person.timeZone.split('/').pop()!.replace(/_/g, ' ');
  add('place', 'anywhere', person.typed, person.city, person.timeZone, zoneCity, person.typed.replace(/\s+/g, ''), zoneCity.replace(/\s+/g, ''));

  const lat = (person.lat100 / 100).toFixed(2);
  const lon = (person.lon100 / 100).toFixed(2);
  add('coordinates', 'anywhere', lat, lon, lon.replace('-', ''));
  add('coordinates', 'data', String(Math.abs(person.lat100)), String(Math.abs(person.lon100)));
  return [...new Map(list.map((needle) => [`${needle.where}:${needle.text}`, needle])).values()];
}

interface Recorded {
  phase: string;
  channel: 'playwright' | 'devtools' | 'page-hook' | 'websocket' | 'analytics';
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  serviceWorker: boolean;
}

/** Headers the browser or the server writes the same for every visitor, whose digits and clock times are not the page's. */
const VALIDATOR_HEADERS = new Set(['if-none-match', 'if-modified-since', 'if-range', 'date', 'user-agent', 'sec-ch-ua', 'sec-ch-ua-platform', 'sec-ch-ua-mobile']);

const loosen = (text: string) => text.toLowerCase().replace(/[\s+_-]+/g, ' ');
function decodings(text: string): string[] {
  const forms = new Set<string>([text]);
  try { forms.add(decodeURIComponent(text.replace(/\+/g, ' '))); } catch { /* not percent-encoded */ }
  // Long base64 or base64url runs, decoded: a token must not smuggle the fields either.
  for (const run of text.match(/[A-Za-z0-9+/_-]{16,}={0,2}/g) ?? []) {
    const decoded = Buffer.from(run.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
    if (/^[\x20-\x7e\s]{8,}$/.test(decoded)) forms.add(decoded);
  }
  return [...forms].flatMap((form) => [form.toLowerCase(), loosen(form)]);
}

interface Leak { phase: string; channel: string; kind: Kind; needle: string; part: string; method: string; where: string }

/** Every place a needle occurs in what was recorded. An empty list is the proof. */
function scan(recorded: Recorded[], needles: Needle[]): Leak[] {
  const leaks: Leak[] = [];
  for (const entry of recorded) {
    let path = entry.url;
    let query = '';
    try {
      const parsed = new URL(entry.url);
      path = `${parsed.origin}${parsed.pathname}`;
      query = `${parsed.search}${parsed.hash}`;
    } catch { /* an event name or a relative address: all of it is data */
      query = entry.url;
      path = '';
    }
    const parts: [string, string, boolean][] = [['url path', path, false], ['url query', query, true], ['body', entry.body, true]];
    for (const [name, value] of Object.entries(entry.headers)) {
      const lower = name.toLowerCase();
      if (lower.startsWith(':') || VALIDATOR_HEADERS.has(lower)) continue;
      parts.push([`header ${lower}`, value, lower !== 'referer' && lower !== 'origin']);
    }
    for (const [part, value, isData] of parts) {
      if (!value) continue;
      const forms = decodings(value);
      for (const needle of needles) {
        if (needle.where === 'data' && !isData) continue;
        if (forms.some((form) => form.includes(needle.text) || form.includes(loosen(needle.text)))) {
          leaks.push({ phase: entry.phase, channel: entry.channel, kind: needle.kind, needle: needle.text, part, method: entry.method, where: path || entry.url.slice(0, 80) });
        }
      }
    }
  }
  return leaks;
}

/** Runs before any site script, in every frame: reports each way a page can send bytes. */
function installPageHooks(): void {
  // Analytics scripts stay silent in an automated browser. Here they must behave as they do for a visitor.
  try { Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }); } catch { /* left as it is */ }
  const report = (kind: string, url: unknown, body?: unknown) => {
    let text = '';
    try {
      if (typeof body === 'string') text = body;
      else if (body instanceof URLSearchParams) text = body.toString();
      else if (body instanceof FormData) text = [...body.entries()].map(([key, value]) => `${key}=${typeof value === 'string' ? value : '[file]'}`).join('&');
      else if (body instanceof Blob) { void body.text().then((late) => (window as never as { __privacyLeakTap?: (...a: unknown[]) => void }).__privacyLeakTap?.(kind, String(url), late)); return; }
      else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) text = new TextDecoder('latin1').decode(body as ArrayBuffer);
      else if (body != null) text = JSON.stringify(body) ?? String(body);
    } catch { text = '[unreadable body]'; }
    try { (window as never as { __privacyLeakTap?: (...a: unknown[]) => void }).__privacyLeakTap?.(kind, String(url), text); } catch { /* the binding is gone with the page */ }
  };
  const nativeFetch = window.fetch;
  window.fetch = function fetch(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    report(`fetch ${init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')}`, url, init?.body);
    if (init?.headers) report('fetch headers', url, JSON.stringify(init.headers instanceof Headers ? [...init.headers.entries()] : init.headers));
    return nativeFetch.call(this, input, init);
  };
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function patchedOpen(this: XMLHttpRequest & { __leakUrl?: string }, method: string, url: string | URL, ...rest: unknown[]) {
    this.__leakUrl = `${method} ${String(url)}`;
    return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function patchedSend(this: XMLHttpRequest & { __leakUrl?: string }, body?: Document | XMLHttpRequestBodyInit | null) {
    report('xhr', this.__leakUrl ?? '', body);
    return send.call(this, body);
  };
  if (navigator.sendBeacon) {
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => { report('beacon', url, data); return beacon(url, data); };
  }
  for (const name of ['WebSocket', 'EventSource'] as const) {
    const Native = window[name] as unknown as new (...a: unknown[]) => { send?: (data: unknown) => void };
    if (!Native) continue;
    const Wrapped = function wrapped(this: unknown, ...args: unknown[]) {
      report(name.toLowerCase(), args[0]);
      const socket = new Native(...args);
      if (socket.send) {
        const nativeSend = socket.send.bind(socket);
        socket.send = (data: unknown) => { report('websocket frame', args[0], data); nativeSend(data); };
      }
      return socket;
    } as unknown as typeof Native;
    Wrapped.prototype = Native.prototype;
    Object.assign(Wrapped, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    (window as unknown as Record<string, unknown>)[name] = Wrapped;
  }
  // What the page hands to analytics, recorded whether or not an analytics script is loaded.
  let real: { track?: (event: string, props?: unknown) => void } | undefined;
  const wrapper = Object.freeze({
    track(event: string, props?: unknown) {
      report('analytics', `analytics-event:${String(event)}`, props);
      return real?.track?.(event, props);
    },
  });
  try {
    Object.defineProperty(window, 'zodiacsAnalytics', { configurable: true, get: () => wrapper, set: (value) => { if (value !== wrapper) real = value; } });
  } catch { /* already defined and locked: the network recording still sees what it sends */ }
}

class Recorder {
  readonly entries: Recorded[] = [];
  readonly serviceWorkers: string[] = [];
  phase = 'load';
  private readonly pending: Promise<unknown>[] = [];

  async attach(context: BrowserContext): Promise<void> {
    context.on('request', (request: Request) => {
      const entry: Recorded = { phase: this.phase, channel: 'playwright', method: request.method(), url: request.url(), headers: request.headers(), body: request.postDataBuffer()?.toString('latin1') ?? '', serviceWorker: Boolean(request.serviceWorker()) };
      this.entries.push(entry);
      // The full header set (cookies included) arrives later, and never for a request the browser drops: wait 3 s at most.
      this.pending.push(Promise.race([
        request.allHeaders().then((headers) => { entry.headers = headers; }).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 3_000)),
      ]));
    });
    context.on('serviceworker', (worker) => this.serviceWorkers.push(worker.url()));
    await context.exposeBinding('__privacyLeakTap', (_source, kind: string, url: string, body: string) => {
      this.entries.push({ phase: this.phase, channel: kind === 'analytics' ? 'analytics' : 'page-hook', method: kind, url, headers: {}, body: body ?? '', serviceWorker: false });
    });
    await context.addInitScript(installPageHooks);
    context.on('page', (page) => this.pending.push(this.attachPage(context, page)));
  }

  private async attachPage(context: BrowserContext, page: Page): Promise<void> {
    page.on('websocket', (socket) => {
      this.entries.push({ phase: this.phase, channel: 'websocket', method: 'WEBSOCKET', url: socket.url(), headers: {}, body: '', serviceWorker: false });
      socket.on('framesent', (frame) => this.entries.push({ phase: this.phase, channel: 'websocket', method: 'FRAME', url: socket.url(), headers: {}, body: String(frame.payload), serviceWorker: false }));
    });
    const devtools = await context.newCDPSession(page);
    await devtools.send('Network.enable');
    devtools.on('Network.requestWillBeSent', (event) => {
      this.entries.push({ phase: this.phase, channel: 'devtools', method: event.request.method, url: event.request.url + (event.request.urlFragment ?? ''), headers: event.request.headers as Record<string, string>, body: event.request.postData ?? '', serviceWorker: false });
    });
    devtools.on('Network.webSocketCreated', (event) => this.entries.push({ phase: this.phase, channel: 'devtools', method: 'WEBSOCKET', url: event.url, headers: {}, body: '', serviceWorker: false }));
    devtools.on('Network.webSocketFrameSent', (event) => this.entries.push({ phase: this.phase, channel: 'devtools', method: 'FRAME', url: 'websocket', headers: {}, body: event.response.payloadData, serviceWorker: false }));
  }

  async settle(): Promise<void> {
    await Promise.all(this.pending.splice(0));
  }

  /** The network requests proper, as Playwright saw them (page and service worker). */
  get requests(): Recorded[] {
    return this.entries.filter((entry) => entry.channel === 'playwright' && !/^(?:data|blob|about):/u.test(entry.url));
  }
}

/** A dropped connection to a deployment is tried again, twice, a few seconds apart. */
async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(url, BYPASS ? { headers: { 'x-vercel-protection-bypass': BYPASS } } : undefined);
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
}

interface FlowResult { name: string; recorder: Recorder; leaks: Leak[]; pageUrl: string; storageKeys: string[]; cookies: number; extra: Record<string, unknown> }

describe.skipIf(!ENABLED)('zero network leak: birth data never leaves the browser during a calculation', () => {
  let browser: Browser;
  let base = EXTERNAL;
  let stopPreview: (() => Promise<void>) | undefined;
  let origin = '';
  const flows = new Map<string, FlowResult>();

  beforeAll(async () => {
    // Service worker requests reach Playwright's request event only with this switch (Chromium).
    process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
    const { chromium } = await import('playwright-core');
    if (!base) {
      const preview = await startPreview({ port: 4488 });
      base = preview.baseURL;
      stopPreview = preview.stop;
    }
    origin = new URL(base).origin;
    browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });

    // The needles are only as good as the fixture: each city must be in the served file with these coordinates.
    for (const person of [PERSON_A, PERSON_B, PERSON_C]) {
      const response = await fetchWithRetry(`${base}/data/cities/${person.typed[0]!.toLowerCase()}.json`);
      expect(response.ok, `city file for ${person.typed}`).toBe(true);
      const rows = await response.json() as [string, string | 0, number, number, number, number, number, number][];
      const row = rows.find((candidate) => candidate[0] === person.city && candidate[4] === person.lat100 && candidate[5] === person.lon100);
      expect(row, `${person.city} at ${person.lat100}, ${person.lon100} in the served city file`).toBeTruthy();
    }
  }, 240_000);

  afterAll(async () => {
    await browser?.close();
    await stopPreview?.();
    if (!flows.size) return;
    const report = {
      schema: 'zodiacs.privacy-leak-report.v1',
      base,
      hooks: 'playwright request events with service workers, DevTools Network domain, in-page fetch/XHR/sendBeacon/WebSocket/EventSource wrappers, zodiacsAnalytics.track wrapper',
      leakedBirthDataMatches: [...flows.values()].reduce((sum, flow) => sum + flow.leaks.length, 0),
      flows: [...flows.values()].map((flow) => {
        const requests = flow.recorder.requests;
        const pathOf = (url: string) => { try { return new URL(url).pathname; } catch { return url; } };
        return {
          flow: flow.name,
          requests: requests.length,
          fromServiceWorker: requests.filter((entry) => entry.serviceWorker).length,
          serviceWorkers: flow.recorder.serviceWorkers.map(pathOf),
          hosts: [...new Set(requests.map((entry) => new URL(entry.url).host))],
          notGet: requests.filter((entry) => entry.method !== 'GET').map((entry) => `${entry.method} ${pathOf(entry.url)}`),
          thirdParty: [...new Set(requests.filter((entry) => new URL(entry.url).host !== new URL(base).host).map((entry) => {
            let keys = '';
            try { keys = entry.body ? ` body keys: ${Object.keys(JSON.parse(entry.body) as object).join(',')}; event: ${String((JSON.parse(entry.body) as { n?: unknown }).n ?? '')}; props: ${Object.keys(((JSON.parse(entry.body) as { p?: object }).p) ?? {}).join(',')}` : ''; } catch { keys = ' body: not JSON'; }
            return `${entry.phase}: ${entry.method} ${new URL(entry.url).host}${pathOf(entry.url)}${keys}`;
          }))],
          thirdPartyMode: THIRD_PARTY,
          withQueryString: [...new Set(requests.filter((entry) => new URL(entry.url).search).map((entry) => new URL(entry.url).search.replace(/=.*$/u, '=…')))],
          webSockets: flow.recorder.entries.filter((entry) => entry.method === 'WEBSOCKET').length,
          pageCalls: flow.recorder.entries.filter((entry) => entry.channel === 'page-hook').length,
          analyticsEvents: [...new Set(flow.recorder.entries.filter((entry) => entry.channel === 'analytics').map((entry) => entry.url.replace('analytics-event:', '')))],
          afterTyping: [...new Set(requests.filter((entry) => !entry.serviceWorker && (entry.phase === 'form' || entry.phase === 'submit')).map((entry) => pathOf(entry.url)).filter((path) => /^\/data\/|tzdb-|share-positions-noon/u.test(path)))],
          pageAddressAfter: flow.pageUrl.replace(origin, ''),
          storageKeys: flow.storageKeys,
          cookies: flow.cookies,
          leaks: flow.leaks,
          ...flow.extra,
        };
      }),
    };
    await mkdir(dirname(REPORT_PATH), { recursive: true });
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 1)}\n`);
  });

  async function newContext(): Promise<{ context: BrowserContext; recorder: Recorder }> {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'allow', locale: 'en-US' });
    if (BYPASS) {
      // One request to the deployment's own host sets Vercel's bypass cookie; the token goes nowhere else.
      await context.request.get(`${base}/robots.txt`, { headers: { 'x-vercel-protection-bypass': BYPASS, 'x-vercel-set-bypass-cookie': 'samesitenone' } });
    }
    const recorder = new Recorder();
    await recorder.attach(context);
    // A request to any other host is recorded (the request event fires first) and then stopped here.
    const own = new URL(base).host;
    await context.route((url) => /^https?:$/u.test(url.protocol) && url.host !== own, (route) => (
      THIRD_PARTY === 'allow-get' && route.request().method() === 'GET' ? route.continue() : route.abort('blockedbyclient')
    ));
    return { context, recorder };
  }

  async function choosePlace(page: Page, selector: string, person: Person): Promise<void> {
    await page.locator(selector).pressSequentially(person.typed, { delay: 40 });
    const option = page.locator('[role="option"]').first();
    await option.waitFor({ timeout: 15_000 });
    expect((await option.innerText()).split('\n')[0], `first place offered for "${person.typed}"`).toBe(person.city);
    await option.click();
  }

  async function fillPerson(page: Page, prefix: string, placeSelector: string, person: Person, timeKnown: boolean): Promise<void> {
    await page.fill(`#${prefix}date`, person.date);
    if (timeKnown) await page.fill(`#${prefix}time`, person.time);
    else await page.locator(`#${prefix}time`).locator('xpath=ancestor::*[.//input[@type="checkbox"]][1]').locator('input[type="checkbox"]').first().check();
    await choosePlace(page, placeSelector, person);
  }

  /** One calculator flow, start to finish: load, type, submit, wait, leave the page. */
  async function runFlow(name: string, path: string, people: { person: Person; timeKnown: boolean }[], drive: (page: Page, recorder: Recorder) => Promise<Record<string, unknown> | void>): Promise<FlowResult> {
    const { context, recorder } = await newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      const later = page.getByRole('button', { name: 'Not now' });
      if (await later.count() && await later.first().isVisible()) await later.first().click().catch(() => {});
      recorder.phase = 'form';
      const extra = await drive(page, recorder) ?? {};
      // Long enough for the service worker to register (3 s after load) and for anything deferred to go.
      await page.waitForTimeout(6_000);
      const pageUrl = page.url();
      const storageKeys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
      const cookies = (await context.cookies()).filter((cookie) => !cookie.name.startsWith('_vercel')).length;
      // Leaving the page is when beacons go: hide it, then navigate away, so the next page's referrer is this one.
      recorder.phase = 'leave';
      await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
      await page.goto(`${base}/about/`, { waitUntil: 'networkidle' });
      await recorder.settle();
      const needles = people.flatMap(({ person, timeKnown }) => needlesFor(person, timeKnown));
      const result: FlowResult = { name, recorder, leaks: scan(recorder.entries, needles), pageUrl, storageKeys, cookies, extra };
      flows.set(name, result);
      return result;
    } finally {
      await context.close();
    }
  }

  const natal = (name: string, person: Person, timeKnown: boolean) => runFlow(name, '/birth-chart/', [{ person, timeKnown }], async (page, recorder) => {
    await fillPerson(page, 'birth-', '#place', person, timeKnown);
    recorder.phase = 'submit';
    await page.getByRole('button', { name: /Get your free birth chart/u }).click();
    await page.locator('.calc__result').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    const text = (await page.locator('.calc__result').first().innerText()).replace(/\s+/gu, ' ');
    return {
      risingSignNamed: /Rising (?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\b/u.test(text),
      housesNamed: (text.match(/\b\d+(?:st|nd|rd|th) house/gu) ?? []).length,
      saysNoRisingOrHouses: /birth time unknown; no rising sign or houses/u.test(text),
    };
  });

  /** What every flow must satisfy, whatever was entered. */
  function expectNoLeak(flow: FlowResult): void {
    const requests = flow.recorder.requests;
    expect(requests.length, `${flow.name}: requests were recorded`).toBeGreaterThan(20);
    expect(flow.recorder.entries.some((entry) => entry.channel === 'devtools'), `${flow.name}: the DevTools recording ran`).toBe(true);
    expect(flow.recorder.entries.some((entry) => entry.channel === 'page-hook'), `${flow.name}: the in-page wrappers ran`).toBe(true);
    // The proof: nothing recorded on any channel holds any written form of the birth data.
    expect(flow.leaks, `${flow.name}: leaked birth data`).toEqual([]);
    // Requests go to the site's own host, or to a named processor, whose requests were scanned with the rest.
    const foreign = [...new Set(requests.map((entry) => new URL(entry.url).host.toLowerCase()))].filter((host) => host !== new URL(base).host && !ALLOWED_HOSTS.includes(host));
    expect(foreign, `${flow.name}: hosts other than the site's own and the named processors`).toEqual([]);
    // What a processor is sent: its own script's address, and events with the page's address and nothing typed.
    for (const entry of requests.filter((candidate) => new URL(candidate.url).host !== new URL(base).host)) {
      expect(new URL(entry.url).search, `${flow.name}: query string to ${new URL(entry.url).host}`).toBe('');
      if (!entry.body) continue;
      const sent = JSON.parse(entry.body) as Record<string, unknown>;
      const address = new URL(String(sent.u ?? sent.url ?? origin));
      expect(`${address.search}${address.hash}`, `${flow.name}: the page address an event carries has no query or fragment`).toBe('');
      expect(sent.r ?? sent.referrer ?? null, `${flow.name}: an event carries no referrer`).toBeNull();
    }
    // After the first keystroke the page only downloads files: GET, no body, and no query string a field could ride in.
    const afterTyping = requests.filter((entry) => !entry.serviceWorker && (entry.phase === 'form' || entry.phase === 'submit'));
    expect(afterTyping.filter((entry) => entry.method !== 'GET' || entry.body).map((entry) => `${entry.method} ${entry.url}`), `${flow.name}: writes after typing`).toEqual([]);
    for (const entry of afterTyping) {
      const { search, pathname } = new URL(entry.url);
      expect(search === '' || /^\?(?:v|surface)=[a-z0-9-]+$/u.test(search), `${flow.name}: query string on ${pathname}${search}`).toBe(true);
    }
    expect(flow.recorder.entries.filter((entry) => /WEBSOCKET|FRAME|eventsource|websocket/u.test(entry.method)), `${flow.name}: sockets`).toEqual([]);
    // The page's own address holds no birth data, in the path, the query or the fragment.
    expect(flow.pageUrl.replace(origin, ''), `${flow.name}: page address after the result`).toMatch(/^\/[a-z-]+\/(?:invite\/)?$/u);
    expect(flow.cookies, `${flow.name}: cookies set`).toBe(0);
  }

  const cityFiles = (flow: FlowResult) => flow.recorder.requests.filter((entry) => !entry.serviceWorker && new URL(entry.url).pathname.startsWith('/data/cities/')).map((entry) => new URL(entry.url).pathname + new URL(entry.url).search);
  /** The files asked for after the first keystroke, less the pictures (always all twelve signs) and worker blobs. */
  const filesAfterTyping = (flow: FlowResult) => new Set(flow.recorder.requests
    .filter((entry) => !entry.serviceWorker && (entry.phase === 'form' || entry.phase === 'submit'))
    .map((entry) => new URL(entry.url).pathname + new URL(entry.url).search));
  const onlyIn = (a: Set<string>, b: Set<string>) => [...a].filter((file) => !b.has(file)).sort();

  it('natal chart with a birth time: 0 leaked bytes', async () => {
    const flow = await natal('natal', PERSON_A, true);
    expectNoLeak(flow);
    expect(flow.extra.risingSignNamed, 'the chart with a time names a rising sign').toBe(true);
    expect(flow.extra.saysNoRisingOrHouses).toBe(false);
    // The place search: the index and one file named by the first letter, once each, however many keys were pressed.
    expect(cityFiles(flow).sort()).toEqual(['/data/cities/index.json', '/data/cities/n.json']);
    // A service worker did register and its requests were seen, so the count above includes them.
    expect(flow.recorder.serviceWorkers.length, 'service worker registered and observed').toBeGreaterThan(0);
    expect(flow.recorder.requests.filter((entry) => entry.serviceWorker).length).toBeGreaterThan(0);
  }, 240_000);

  it('natal chart without a birth time: 0 leaked bytes, no rising sign and no houses', async () => {
    const flow = await natal('natal-unknown-time', PERSON_A, false);
    expectNoLeak(flow);
    // The page says what it left out, and names no house.
    expect(flow.extra.saysNoRisingOrHouses, 'the result says there is no rising sign or houses').toBe(true);
    expect(flow.extra.risingSignNamed, 'no rising sign is named without a birth time').toBe(false);
    expect(flow.extra.housesNamed, 'no house is named without a birth time').toBe(0);
    expect(cityFiles(flow).sort()).toEqual(['/data/cities/index.json', '/data/cities/n.json']);
  }, 240_000);

  it('natal chart for a birth before 1970: 0 leaked bytes, one time zone history file', async () => {
    const flow = await natal('natal-before-1970', PERSON_C, true);
    expectNoLeak(flow);
    expect(cityFiles(flow).sort()).toEqual(['/data/cities/index.json', '/data/cities/m.json']);
    const history = [...filesAfterTyping(flow)].filter((file) => /\/tzdb-/u.test(file));
    expect(history, 'one file of zone history, named for a group of zones').toHaveLength(1);
    expect(history[0]).toMatch(/^\/_astro\/tzdb-[0-9a-z]+-\d\d-[A-Z0-9]+\.[\w-]+\.js$/u);
    expect(loosen(history[0]!)).not.toMatch(/kolkata|mumbai|asia/u);
  }, 240_000);

  it('synastry, two people entered by hand: 0 leaked bytes', async () => {
    const flow = await runFlow('synastry', '/compatibility/', [{ person: PERSON_A, timeKnown: true }, { person: PERSON_B, timeKnown: true }], async (page, recorder) => {
      await fillPerson(page, 'syn-a-', '#syn-a-place', PERSON_A, true);
      await fillPerson(page, 'syn-b-', '#syn-b-place', PERSON_B, true);
      recorder.phase = 'submit';
      await page.locator('.calc__submit').click();
      await page.locator('.rwheel').first().waitFor({ timeout: 30_000 });
    });
    expectNoLeak(flow);
    expect(cityFiles(flow).sort()).toEqual(['/data/cities/index.json', '/data/cities/l.json', '/data/cities/n.json']);
  }, 240_000);

  it('invitation link: the chart code stays after the #, and opening the link sends none of it', async () => {
    let link = '';
    const flow = await runFlow('invite', '/compatibility/invite/', [{ person: PERSON_A, timeKnown: true }], async (page, recorder) => {
      await fillPerson(page, 'share-person-1-', '#share-person-1-place', PERSON_A, true);
      recorder.phase = 'submit';
      await page.getByRole('button', { name: /Make an invite link/u }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('input, textarea')].some((element) => /#p=/u.test((element as HTMLInputElement).value)), null, { timeout: 30_000 });
      link = await page.evaluate(() => ([...document.querySelectorAll('input, textarea')] as HTMLInputElement[]).map((element) => element.value).find((value) => /#p=/u.test(value)) ?? '');
      return {};
    });
    expectNoLeak(flow);
    const parsed = new URL(link);
    // Path and query carry nothing; the code is in the fragment, which a browser does not send.
    expect(`${parsed.pathname}${parsed.search}`).toBe('/compatibility/');
    expect(parsed.hash).toMatch(/^#p=2\.[A-Za-z0-9_-]+$/u);
    const token = parsed.hash.slice('#p='.length);
    const code = Buffer.from(token.slice(2), 'base64url').toString('utf8');
    // The code is positions only: no date, time, place or coordinates in any written form.
    expect(scan([{ phase: 'link', channel: 'page-hook', method: 'LINK', url: 'invite-link-code', headers: {}, body: code, serviceWorker: false }], needlesFor(PERSON_A, true))).toEqual([]);
    expect(Object.keys(JSON.parse(code) as object).sort()).toEqual(['a', 'b', 'h', 'v']);
    // Nothing recorded while it was made holds the code either.
    expect(flow.recorder.entries.filter((entry) => `${entry.url} ${entry.body} ${Object.values(entry.headers).join(' ')}`.includes(token.slice(0, 24))).map((entry) => `${entry.channel} ${entry.method}`)).toEqual([]);

    // The recipient: a fresh browser opens the link. No request, header or body may hold the code.
    const { context, recorder } = await newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${base}${parsed.pathname}${parsed.hash}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(5_000);
      recorder.phase = 'leave';
      await page.goto(`${base}/about/`, { waitUntil: 'networkidle' });
      await recorder.settle();
      const carried = recorder.entries.filter((entry) => `${entry.url} ${entry.body} ${Object.values(entry.headers).join(' ')}`.includes(token.slice(0, 24)));
      expect(carried.map((entry) => `${entry.channel} ${entry.method} ${entry.url.slice(0, 60)}`), 'requests carrying the chart code').toEqual([]);
      expect(recorder.requests.length).toBeGreaterThan(10);
      flows.get('invite')!.extra = { recipientRequests: recorder.requests.length, recipientRequestsCarryingTheCode: carried.length, linkShape: `${parsed.pathname}#p=2.<${token.length - 2} characters>` };
    } finally {
      await context.close();
    }
  }, 300_000);

  it('the request trace does not depend on the birth data, beyond the documented boundary', async () => {
    const known = flows.get('natal')!;
    const unknown = flows.get('natal-unknown-time')!;
    const before1970 = flows.get('natal-before-1970')!;
    expect(known && unknown && before1970, 'the natal flows above ran').toBeTruthy();
    // A second person, different in every field, through the same flow.
    const other = await natal('natal-second-person', PERSON_B, true);
    expectNoLeak(other);
    const strip = (files: Set<string>) => new Set([...files].filter((file) => !file.startsWith('/data/cities/')));
    const [a, b, c, u] = [strip(filesAfterTyping(known)), strip(filesAfterTyping(other)), strip(filesAfterTyping(before1970)), strip(filesAfterTyping(unknown))];
    // Two different births: the same files, apart from the city file's first letter.
    expect(onlyIn(a, b), 'files only the first person asked for').toEqual([]);
    expect(onlyIn(b, a), 'files only the second person asked for').toEqual([]);
    // A birth before 1970 adds the one zone history file and nothing else.
    expect(onlyIn(a, c)).toEqual([]);
    expect(onlyIn(c, a).every((file) => /^\/_astro\/tzdb-/u.test(file)), `a birth before 1970 adds only zone history: ${onlyIn(c, a).join(' ')}`).toBe(true);
    // No birth time adds one script, which tells the host only that no time was given (the third boundary above).
    expect(onlyIn(a, u)).toEqual([]);
    expect(onlyIn(u, a).every((file) => /^\/_astro\/share-positions-noon\./u.test(file)), `no birth time adds only the noon script: ${onlyIn(u, a).join(' ')}`).toBe(true);
    // The sign pictures: all twelve, whatever the chart holds.
    const pictures = (flow: FlowResult) => new Set([...filesAfterTyping(flow)].filter((file) => file.startsWith('/assets/zodiac-icons/')).map((file) => file.replace(/^.*\/([a-z]+)\.webp.*$/u, '$1')));
    expect(pictures(known).size).toBe(12);
    expect([...pictures(other)].sort()).toEqual([...pictures(known)].sort());
  }, 240_000);

  it('the scan itself finds a planted leak on every channel', () => {
    // The proof is only as good as the scan: each written form, in each part of a request, must be caught.
    const needles = needlesFor(PERSON_A, true);
    const plant = (part: Partial<Recorded>): Recorded => ({ phase: 'planted', channel: 'playwright', method: 'GET', url: 'https://example.test/x', headers: {}, body: '', serviceWorker: false, ...part });
    const planted: [string, Recorded][] = [
      ['ISO date in a query', plant({ url: 'https://example.test/collect?d=1990-06-15' })],
      ['US date, percent-encoded', plant({ url: 'https://example.test/collect?d=06%2F15%2F1990' })],
      ['compact date in a body', plant({ method: 'POST', body: '{"dob":"19900615"}' })],
      ['month name in a body', plant({ method: 'POST', body: 'born=June+15' })],
      ['time in a query', plant({ url: 'https://example.test/collect?t=14%3A30' })],
      ['12-hour time in a body', plant({ method: 'POST', body: 'time=2:30 PM' })],
      ['epoch seconds in a path', plant({ url: 'https://example.test/e/645474600' })],
      ['place in a path', plant({ url: 'https://example.test/geocode/new-york' })],
      ['place in a referrer', plant({ headers: { referer: 'https://example.test/birth-chart/?place=New%20York' } })],
      ['time zone in a cookie', plant({ headers: { cookie: 'tz=America/New_York' } })],
      ['latitude in a query', plant({ url: 'https://example.test/collect?lat=40.71' })],
      ['longitude in a body', plant({ method: 'POST', body: '{"lon":-74.01}' })],
      ['hundredths in a body', plant({ method: 'POST', body: 'lat100=4071' })],
      ['base64 JSON in a query', plant({ url: `https://example.test/c?p=${Buffer.from('{"date":"1990-06-15","time":"14:30"}').toString('base64url')}` })],
      ['an analytics property', plant({ channel: 'analytics', method: 'analytics', url: 'analytics-event:chart_computed', body: '{"year":1990}' })],
      ['a beacon body', plant({ channel: 'page-hook', method: 'beacon', url: '/api/x', body: 'New York' })],
      ['a WebSocket frame', plant({ channel: 'websocket', method: 'FRAME', url: 'wss://example.test/', body: '{"place":"New York City"}' })],
    ];
    for (const [what, entry] of planted) expect(scan([entry], needles).length, `planted: ${what}`).toBeGreaterThan(0);
    // And it is quiet on what the flows really send: a hashed file, a city file, a versioned picture.
    const clean = [plant({ url: 'https://example.test/_astro/natal.B-ECGcE7.js' }), plant({ url: 'https://example.test/data/cities/n.json' }), plant({ url: 'https://example.test/assets/zodiac-icons/128/gemini.webp?surface=sample-chart', headers: { referer: 'https://example.test/birth-chart/' } })];
    expect(scan(clean, needles)).toEqual([]);
  });
});
