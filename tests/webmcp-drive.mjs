/**
 * WebMCP interoperability drive against the production build.
 *
 *   npm run build
 *   npm run test:webmcp
 */
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { projectRoot, withPreview } from './visual/preview-server.mjs';

const polyfillPath = resolve(
  projectRoot,
  'node_modules/@mcp-b/webmcp-polyfill/dist/index.iife.js',
);
await access(polyfillPath);

const CALCULATOR_PAGES = ['/moon-phase/', '/es/moon-phase/', '/pt/moon-phase/', '/fr/moon-phase/', '/it/moon-phase/'];
const MOON_PHASE_CALLS = [
  { date: '2024-03-20', time: '21:45', place: { latitude: 13.7563, longitude: 100.5018, timeZone: 'Asia/Bangkok' } },
  { date: '1990-01-04' },
];

/** A calculator page: its tools, the calculation bundle loading only on a call, and the tool's answers. */
async function calculatorPage(page, path) {
  await page.waitForFunction(() => (
    navigator.modelContextTesting?.listTools().some((tool) => tool.name === 'zodiacs.moon_phase')
  ));
  const result = await page.evaluate(async (calls) => {
    const testing = navigator.modelContextTesting;
    const tools = testing.listTools().map(({ name }) => name).sort();
    const loaded = () => performance.getEntriesByType('resource')
      .some((entry) => new URL(entry.name).pathname === '/assets/webmcp-calculators.js');
    const loadedBeforeCall = loaded();
    const answers = [];
    for (const call of calls) {
      const decoded = JSON.parse(await testing.executeTool('zodiacs.moon_phase', JSON.stringify(call)));
      answers.push(decoded?.structuredContent ?? decoded);
    }
    const refused = JSON.parse(await testing.executeTool('zodiacs.moon_phase', JSON.stringify({ date: '2024-02-30' })));
    return { tools, loadedBeforeCall, loadedAfterCall: loaded(), answers, refusal: refused?.structuredContent ?? refused };
  }, MOON_PHASE_CALLS);
  return { path, ...result };
}

function assertCalculatorPage(label, result) {
  const expected = result.path === '/moon-phase/' ? ['zodiacs.moon_phase', 'zodiacs.search'] : ['zodiacs.moon_phase'];
  if (JSON.stringify(result.tools) !== JSON.stringify(expected)) {
    throw new Error(`${label} ${result.path}: expected tools ${expected.join(', ')}, got ${result.tools.join(', ')}`);
  }
  if (result.loadedBeforeCall || !result.loadedAfterCall) {
    throw new Error(`${label} ${result.path}: the calculation bundle must load on the first call, not before`);
  }
  const [local, utc] = result.answers;
  if (!local?.ok || local.data.basis !== 'local-time' || typeof local.data.phase !== 'string') {
    throw new Error(`${label} ${result.path}: the local-time moon phase failed`);
  }
  if (!utc?.ok || utc.data.basis !== 'utc-reference') throw new Error(`${label} ${result.path}: the noon UTC moon phase failed`);
  if (result.refusal?.ok !== false || result.refusal.error?.code !== 'INVALID_INPUT') {
    throw new Error(`${label} ${result.path}: a date that does not exist must be refused`);
  }
}

/** Visits every calculator page in a context and checks it. */
async function checkCalculatorPages(label, newPage, baseURL) {
  const results = [];
  for (const path of CALCULATOR_PAGES) {
    const page = await newPage();
    await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
    const result = await calculatorPage(page, path);
    assertCalculatorPage(label, result);
    results.push(result);
    await page.close();
  }
  return results;
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
  if (!capture.assetRequests.length || capture.assetRequests.some((url) => (
    url !== '/assets/webmcp-register.js?v=calculators-1'
  ))) {
    throw new Error(`${label}: WebMCP must load the bundle with the calculator tools (?v=calculators-1)`);
  }
  if (capture.tools.length !== 1 || capture.tools[0].name !== 'zodiacs.search') {
    throw new Error(`${label}: expected only zodiacs.search`);
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

await withPreview({ port: 4412 }, async (baseURL) => {
  const executablePath = await findChromium();

  const nativeBrowser = await chromium.launch({
    executablePath,
    args: [
      ...STABLE_CHROMIUM_ARGS,
      '--enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport',
    ],
  });
  let native;
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

  const polyfillBrowser = await chromium.launch({
    executablePath,
    args: STABLE_CHROMIUM_ARGS,
  });
  let polyfill;
  let exclusions;
  try {
    const context = await polyfillBrowser.newContext();
    await context.addInitScript({ path: polyfillPath });
    const page = await context.newPage();
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    polyfill = await enumerateAndCall(page);
    assertCall('MCP-B 4.0.0', polyfill);
    polyfill.calculators = await checkCalculatorPages('MCP-B 4.0.0', () => context.newPage(), baseURL);

    exclusions = {};
    for (const path of ['/es/', '/terminal/', '/registry/', '/thesis/', '/sdk/', '/archive/']) {
      const excludedPage = await context.newPage();
      await excludedPage.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
      await excludedPage.waitForTimeout(100);
      exclusions[path] = await excludedPage.evaluate(() => ({
        tools: navigator.modelContextTesting?.listTools().map((tool) => tool.name) ?? [],
        requestedAsset: performance.getEntriesByType('resource')
          .some((entry) => entry.name.includes('/assets/webmcp-register.js')),
      }));
      await excludedPage.close();
    }
    if (Object.values(exclusions).some((entry) => entry.tools.length || entry.requestedAsset)) {
      throw new Error('A page without a calculator outside English, or a registry page, loaded WebMCP tools');
    }
  } finally {
    await polyfillBrowser.close();
  }

  console.log(JSON.stringify({ native, polyfill, exclusions }, null, 2));
});
