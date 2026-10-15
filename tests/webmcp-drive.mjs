/**
 * WebMCP interoperability drive against the production build, or against a deployment with --base-url.
 *
 *   npm run build
 *   npm run test:webmcp
 *   node tests/webmcp-drive.mjs --base-url https://zodiacs.org   (the production check; polyfill only)
 *
 * Search registers on English pages. Every calculator page registers its own tool in every locale it is built in
 * (Track A2): the drive visits each, calls the tool with a synthetic input and with one its schema refuses, and checks
 * that the calculations load only on the first call. On /birth-chart/ it also opens the page itself on the same birth
 * and compares the Sun, Moon and rising the page prints with the tool's.
 */
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { projectRoot, withPreview } from './visual/preview-server.mjs';

const polyfillPath = resolve(
  projectRoot,
  'node_modules/@mcp-b/webmcp-polyfill/dist/index.iife.js',
);
await access(polyfillPath);

const baseUrlFlag = process.argv.indexOf('--base-url');
const remoteBase = baseUrlFlag > 0 ? process.argv[baseUrlFlag + 1] : null;
const REGISTER_KEY = '/assets/webmcp-register.js?v=calculators-1';

// Synthetic births only.
const LONDON = { latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' };
const TOKYO = { latitude: 35.6762, longitude: 139.6503, timeZone: 'Asia/Tokyo' };
const BIRTH = { date: '1990-06-15', time: '14:30', place: LONDON };
const UNTIMED = { date: '1985-03-02', place: TOKYO };
const LOCALES = ['es', 'pt', 'fr', 'it', 'ru'];
const NOWHERE = { ...LONDON, timeZone: 'Mars/Olympus_Mons' };

/**
 * Each calculator tool: its page, the locales its page is built in, a call and what its answer must hold, and a call
 * its schema refuses.
 */
const CALCULATORS = [
  {
    name: 'zodiacs.birth_chart', path: '/birth-chart/', locales: LOCALES,
    call: { ...BIRTH, houseSystem: 'placidus' },
    holds: (data) => data.houses?.length === 12 && data.bigThree?.rising?.sign && data.aspects?.length > 0,
    refuse: { date: '1990-06-15' }, unread: { ...BIRTH, place: NOWHERE },
  },
  {
    name: 'zodiacs.moon_sign', path: '/moon-sign/', locales: LOCALES, call: UNTIMED,
    holds: (data) => data.moon === null && data.moonSignStatus === 'unverified' && typeof data.moonPhase === 'string',
    refuse: { ...UNTIMED, time: '25:00' }, unread: { ...UNTIMED, date: '1985-02-29' },
  },
  {
    name: 'zodiacs.rising_sign', path: '/rising-sign/', locales: LOCALES, call: BIRTH,
    holds: (data) => typeof data.rising?.sign === 'string', refuse: UNTIMED, unread: { ...BIRTH, place: NOWHERE },
  },
  {
    name: 'zodiacs.big_three', path: '/big-three/', locales: LOCALES, call: BIRTH,
    holds: (data) => data.sun?.sign && data.moon?.sign && data.rising?.sign, refuse: UNTIMED,
    unread: { ...BIRTH, date: '1990-02-30' },
  },
  {
    name: 'zodiacs.compatibility', path: '/compatibility/', locales: LOCALES, call: { first: BIRTH, second: UNTIMED },
    holds: (data) => data.people?.length === 2 && data.topContacts?.length > 0 && data.people[1].rising === null,
    refuse: { first: BIRTH }, unread: { first: BIRTH, second: { ...UNTIMED, place: NOWHERE } },
  },
  {
    name: 'zodiacs.transits', path: '/transits/', locales: LOCALES, call: { birth: BIRTH, at: '2026-10-15T12:00:00Z' },
    holds: (data) => data.sky?.length === 10 && Array.isArray(data.contacts) && data.contacts.every((c) => c.orb <= 3),
    refuse: { birth: BIRTH, at: 'tomorrow' }, unread: { birth: BIRTH, at: '2026-02-30T12:00:00Z' },
  },
  {
    name: 'zodiacs.saturn_return', path: '/saturn-return/', locales: LOCALES, call: BIRTH,
    holds: (data) => data.seasons?.length >= 2 && data.seasons[0].passes.length >= 1, refuse: { date: '1990-13-01' },
    unread: { date: '1990-06-15', time: '14:30' },
  },
  {
    name: 'zodiacs.solar_return', path: '/solar-return/', locales: [], call: { birth: BIRTH, year: 2027 },
    holds: (data) => data.returnYear === 2027 && data.angles?.ascendant?.sign, refuse: { birth: BIRTH, year: 1500 },
    unread: { birth: BIRTH, castPlace: NOWHERE },
  },
  {
    name: 'zodiacs.lunar_return', path: '/lunar-return/', locales: [], call: { birth: BIRTH, after: '2026-10-15T00:00:00Z' },
    holds: (data) => data.instant > '2026-10-15' && data.instant < '2026-11-15', refuse: { birth: UNTIMED },
    unread: { birth: { ...BIRTH, date: '2021-03-28', time: '01:30' } },
  },
  {
    name: 'zodiacs.numerology', path: '/numerology/', locales: [],
    call: { birthDate: '1990-06-15', fullName: 'Alex Synthetic Example', today: '2026-10-15' },
    holds: (data) => data.lifePath?.value === 4 && data.nameUsed === true, refuse: { birthDate: '15/06/1990' },
    unread: { birthDate: '1990-06-15', fullName: 'Алекс' },
  },
  {
    name: 'zodiacs.moon_phase', path: '/moon-phase/', locales: LOCALES,
    call: { date: '2024-03-20', time: '21:45', place: { latitude: 13.7563, longitude: 100.5018, timeZone: 'Asia/Bangkok' } },
    holds: (data) => data.basis === 'local-time' && typeof data.phase === 'string', refuse: { date: '2024-3-20' },
    unread: { date: '2023-02-29' },
  },
  {
    name: 'zodiacs.baby_zodiac', path: '/baby-zodiac/', locales: LOCALES, call: { dueDate: '2027-02-10' },
    holds: (data) => data.sun?.signs?.length >= 1 && data.moonSpans?.length >= 1 && Array.isArray(data.retrograde),
    refuse: { dueDate: '2035-01-01' }, unread: { dueDate: '2027-02-29' },
  },
  {
    name: 'zodiacs.chart_twins', path: '/chart-twins/', locales: LOCALES, call: BIRTH,
    holds: (data) => data.sunSign === 'Gemini' && data.matches?.length > 0, refuse: { date: '1990-06-15' },
    unread: { ...BIRTH, place: NOWHERE },
  },
  {
    name: 'zodiacs.group_chart', path: '/group-charts/', locales: LOCALES,
    call: { people: [{ name: 'A', birth: BIRTH }, { name: 'B', birth: UNTIMED }, { name: 'C', birth: { ...BIRTH, date: '2003-11-20' } }] },
    holds: (data) => data.people?.length === 3 && data.people.every((person) => typeof person.role === 'string'),
    refuse: { people: [{ birth: BIRTH }] },
    unread: { people: [{ name: 'A', birth: BIRTH }, { name: 'a', birth: BIRTH }, { birth: UNTIMED }] },
  },
  {
    name: 'zodiacs.chart_pdf', path: '/astrologer-kit/', locales: LOCALES, call: UNTIMED,
    holds: (data) => data.positions?.length === 12 && data.houses === null
      && data.aspects.every((aspect) => aspect.a !== 'Moon' && aspect.b !== 'Moon'),
    refuse: { place: TOKYO }, unread: { ...UNTIMED, place: NOWHERE },
  },
  {
    name: 'zodiacs.year_wrapped', path: '/your-sky-wrapped/', locales: LOCALES, call: { birth: BIRTH, year: 2026 },
    holds: (data) => data.year === 2026 && data.natalPoints?.length === 3 && Array.isArray(data.contacts),
    refuse: { birth: BIRTH, year: 'this year' }, unread: { birth: { ...BIRTH, date: '1990-02-30' } },
  },
];

/** The code each tool's own refusal (`unread`) must carry: inputs its schema passes and its reader cannot use. */
const UNREAD_CODES = {
  'zodiacs.saturn_return': 'TIME_NEEDS_PLACE',
  'zodiacs.lunar_return': 'CLOCK_CHANGE',
  'zodiacs.numerology': 'UNSUPPORTED_NAME',
  'zodiacs.group_chart': 'DUPLICATE_PERSON',
};

/** A calculator page: its tools, the calculations loading only on a call, the tool's answer and its refusals. */
async function calculatorPage(page, calculator, path) {
  await page.waitForFunction((name) => (
    navigator.modelContextTesting?.listTools().some((tool) => tool.name === name)
  ), calculator.name);
  return page.evaluate(async ({ name, call, refuse, unread }) => {
    const testing = navigator.modelContextTesting;
    const loaded = () => performance.getEntriesByType('resource')
      .some((entry) => new URL(entry.name).pathname === '/assets/webmcp-calculators.js');
    const decode = (wire) => {
      const decoded = JSON.parse(wire);
      return decoded?.structuredContent ?? decoded;
    };
    const tools = testing.listTools().map((tool) => tool.name).sort();
    const loadedBeforeCall = loaded();
    const answer = decode(await testing.executeTool(name, JSON.stringify(call)));
    let refusal;
    try {
      refusal = decode(await testing.executeTool(name, JSON.stringify(refuse)));
    } catch (error) {
      // MCP-B validates the input schema before the tool runs and rejects the call itself.
      refusal = { ok: false, rejectedBy: 'schema', message: String(error?.message ?? error) };
    }
    // An input the schema passes and the tool itself refuses, with its own envelope.
    const unreadRefusal = decode(await testing.executeTool(name, JSON.stringify(unread)));
    return { tools, loadedBeforeCall, loadedAfterCall: loaded(), answer, refusal, unreadRefusal };
  }, {
    name: calculator.name, call: calculator.call, refuse: calculator.refuse, unread: calculator.unread,
  }).then((result) => ({ path, ...result }));
}

function assertCalculatorPage(label, calculator, result) {
  const english = !LOCALES.some((locale) => result.path.startsWith(`/${locale}/`));
  const expected = (english ? [calculator.name, 'zodiacs.search'] : [calculator.name]).sort();
  if (JSON.stringify(result.tools) !== JSON.stringify(expected)) {
    throw new Error(`${label} ${result.path}: expected tools ${expected.join(', ')}, got ${result.tools.join(', ')}`);
  }
  if (result.loadedBeforeCall || !result.loadedAfterCall) {
    throw new Error(`${label} ${result.path}: the calculations must load on the first call, not before`);
  }
  if (!result.answer?.ok || !calculator.holds(result.answer.data)) {
    throw new Error(`${label} ${result.path}: ${calculator.name} did not answer as expected: ${JSON.stringify(result.answer).slice(0, 400)}`);
  }
  if (result.answer.data.page !== `https://zodiacs.org${calculator.path}`) {
    throw new Error(`${label} ${result.path}: ${calculator.name} must name its page`);
  }
  const refused = result.refusal?.ok === false && (result.refusal.rejectedBy === 'schema' || result.refusal.error?.code === 'INVALID_INPUT');
  if (!refused) throw new Error(`${label} ${result.path}: ${calculator.name} must refuse an input its schema refuses`);
  const code = UNREAD_CODES[calculator.name] ?? 'INVALID_INPUT';
  if (result.unreadRefusal?.ok !== false || result.unreadRefusal.error?.code !== code) {
    throw new Error(`${label} ${result.path}: ${calculator.name} must refuse an input it cannot read with ${code}`);
  }
}

/** The pages each calculator is built at: English, and each locale the build has the page in. */
async function calculatorPaths(baseURL, calculator) {
  const paths = [calculator.path];
  for (const locale of calculator.locales) {
    const path = `/${locale}${calculator.path}`;
    const response = await fetch(`${baseURL}${path}`, { redirect: 'manual' });
    if (response.status === 200) paths.push(path);
    else if (locale !== 'ru') throw new Error(`${path}: expected the page, got HTTP ${response.status}`);
  }
  return paths;
}

/** Visits every calculator page in a context and checks it. */
async function checkCalculatorPages(label, newPage, baseURL) {
  const results = [];
  for (const calculator of CALCULATORS) {
    for (const path of await calculatorPaths(baseURL, calculator)) {
      const page = await newPage();
      await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
      const result = await calculatorPage(page, calculator, path);
      assertCalculatorPage(label, calculator, result);
      results.push({
        path, tool: calculator.name, refusedBy: result.refusal.rejectedBy ?? result.refusal.error.code,
        toolRefusal: result.unreadRefusal.error.code,
      });
      await page.close();
    }
  }
  return results;
}

/** /birth-chart/ opened on the tool's birth: the page's own Sun, Moon and rising against the tool's. */
async function chartPageAgainstTool(newPage, baseURL) {
  const { date, time, place } = BIRTH;
  const wire = { d: date, z: place.timeZone, la: place.latitude, lo: place.longitude, t: time };
  const link = `1.${Buffer.from(JSON.stringify(wire)).toString('base64url')}`;
  const page = await newPage();
  await page.goto(`${baseURL}/birth-chart/#c=${link}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('.three-card__deg').length === 3, null, { timeout: 30_000 });
  const shown = await page.$$eval('.three-card__deg', (cells) => cells.map((cell) => cell.textContent.trim()));
  const answer = await page.evaluate(async (call) => {
    const decoded = JSON.parse(await navigator.modelContextTesting.executeTool('zodiacs.birth_chart', JSON.stringify(call)));
    return decoded?.structuredContent ?? decoded;
  }, { date, time, place });
  await page.close();
  const told = [answer.data.bigThree.sun.label, answer.data.bigThree.moon.label, answer.data.bigThree.rising.label];
  if (JSON.stringify(shown) !== JSON.stringify(told)) {
    throw new Error(`/birth-chart/: the page shows ${shown.join(' · ')} and the tool says ${told.join(' · ')}`);
  }
  return { shown, told };
}

async function enumerateAndCall(page) {
  await page.waitForFunction(() => (
    navigator.modelContextTesting?.listTools()
      .some((tool) => tool.name === 'zodiacs.search')
  ));
  return page.evaluate(async () => {
    const testing = navigator.modelContextTesting;
    if (!testing) throw new Error('modelContextTesting is unavailable');
    const tools = testing.listTools().map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema: inputSchema ? JSON.parse(inputSchema) : null,
    }));
    const wire = await testing.executeTool(
      'zodiacs.search',
      JSON.stringify({ query: 'birth charts' }),
    );
    if (!wire) throw new Error('zodiacs.search returned no wire result');
    const decoded = JSON.parse(wire);
    const envelope = decoded?.structuredContent ?? decoded;
    return {
      tools,
      assetRequests: performance.getEntriesByType('resource')
        .map((entry) => new URL(entry.name))
        .filter((url) => url.pathname === '/assets/webmcp-register.js')
        .map((url) => `${url.pathname}${url.search}`),
      responseShape: decoded?.structuredContent ? 'CallToolResult' : 'raw envelope',
      envelope,
    };
  });
}

function assertCall(label, capture) {
  if (!capture.assetRequests.length || capture.assetRequests.some((url) => url !== REGISTER_KEY)) {
    throw new Error(`${label}: WebMCP must load the bundle with the calculator tools (${REGISTER_KEY})`);
  }
  if (capture.tools.length !== 1 || capture.tools[0].name !== 'zodiacs.search') {
    throw new Error(`${label}: expected only zodiacs.search on the home page`);
  }
  if (!capture.envelope?.ok) throw new Error(`${label}: search returned an error envelope`);
  const results = capture.envelope.data.results;
  const paths = results.map((entry) => entry.path);
  if (!paths.slice(0, 3).includes('/birth-chart/')) {
    throw new Error(`${label}: /birth-chart/ is not in the top three`);
  }
  if (results.some((entry) => (
    entry.kind === 'registry'
    || /^\/(?:registry|thesis|sdk|archive|collect)(?:\/|$)/.test(entry.path)
  ))) {
    throw new Error(`${label}: wing entry leaked`);
  }
}

async function drive(baseURL) {
  const executablePath = await findChromium();

  let native;
  if (remoteBase) {
    native = { skipped: 'the production check drives the polyfill only' };
  } else {
    const nativeBrowser = await chromium.launch({
      executablePath,
      args: [
        ...STABLE_CHROMIUM_ARGS,
        '--enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport',
      ],
    });
    try {
      const page = await nativeBrowser.newPage();
      await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
      // Chrome's testing surface comes and goes with its WebMCP flags (Chrome 155 exposes modelContext without
      // modelContextTesting). Without it the native pass cannot enumerate or call tools, so it is reported as
      // unavailable, with the browser's version, rather than counted; the polyfill pass below always runs.
      const testing = await page.evaluate(() => Boolean(navigator.modelContextTesting));
      if (testing) {
        native = await enumerateAndCall(page);
        assertCall('Chrome testing flag', native);
        native.calculators = await checkCalculatorPages('Chrome testing flag', () => nativeBrowser.newPage(), baseURL);
      } else {
        native = { unavailable: `navigator.modelContextTesting is not exposed by ${await nativeBrowser.version()} with the WebMCP flags` };
        console.warn(`native WebMCP pass not run: ${native.unavailable}`);
      }
    } finally {
      await nativeBrowser.close();
    }
  }

  const polyfillBrowser = await chromium.launch({
    executablePath,
    args: STABLE_CHROMIUM_ARGS,
  });
  let polyfill;
  let exclusions;
  let chartPage;
  try {
    const context = await polyfillBrowser.newContext();
    await context.addInitScript({ path: polyfillPath });
    const page = await context.newPage();
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    polyfill = await enumerateAndCall(page);
    assertCall('MCP-B 4.0.0', polyfill);
    polyfill.calculators = await checkCalculatorPages('MCP-B 4.0.0', () => context.newPage(), baseURL);
    chartPage = await chartPageAgainstTool(() => context.newPage(), baseURL);

    // Pages without a calculator outside English, the someone-else hand-off, and the wings register nothing.
    exclusions = {};
    for (const path of ['/es/', '/fr/horoscopes/', '/terminal/', '/registry/', '/thesis/', '/sdk/', '/archive/']) {
      const excludedPage = await context.newPage();
      await excludedPage.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
      await excludedPage.waitForTimeout(100);
      exclusions[path] = await excludedPage.evaluate(() => ({
        tools: navigator.modelContextTesting?.listTools().map((tool) => tool.name) ?? [],
        requestedAsset: performance.getEntriesByType('resource')
          .some((entry) => entry.name.includes('/assets/webmcp-')),
      }));
      await excludedPage.close();
    }
    if (Object.values(exclusions).some((entry) => entry.tools.length || entry.requestedAsset)) {
      throw new Error('A page without a calculator outside English, or a wing page, loaded WebMCP tools');
    }
    const someoneElse = await context.newPage();
    await someoneElse.goto(`${baseURL}/birth-chart/someone-else/`, { waitUntil: 'networkidle' });
    await someoneElse.waitForFunction(() => navigator.modelContextTesting?.listTools().length > 0);
    exclusions['/birth-chart/someone-else/'] = await someoneElse.evaluate(() => ({
      tools: navigator.modelContextTesting.listTools().map((tool) => tool.name),
    }));
    await someoneElse.close();
    if (JSON.stringify(exclusions['/birth-chart/someone-else/'].tools) !== JSON.stringify(['zodiacs.search'])) {
      throw new Error('/birth-chart/someone-else/ hands off to /birth-chart/ and must register Search alone');
    }
  } finally {
    await polyfillBrowser.close();
  }

  const pages = polyfill.calculators.length;
  console.log(JSON.stringify({ base: baseURL, native, polyfill, chartPage, exclusions, calculatorPages: pages }, null, 2));
  console.log(`webmcp drive: ${pages} calculator pages and their tools checked against ${baseURL}`);
}

if (remoteBase) await drive(remoteBase.replace(/\/$/, ''));
else await withPreview({ port: 4412 }, drive);
