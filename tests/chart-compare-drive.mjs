/**
 * Browser acceptance for the chart-difference tool at /developers/compare/.
 *
 *   npm run test:compare:browser
 *
 * The page and the MCP adapter share one comparison module, so a change to
 * `src/lib/compare/` has to be re-accepted on both sides. The protocol side has
 * `tests/mcp-protocol-drive.mjs`; this is the browser side, and it exists
 * because the first drive of this page was ad hoc — its 33 checks were recorded
 * but the drive itself was not, so there was nothing to re-run.
 *
 * Every record it imports is built here from synthetic inputs by the real
 * engine: round coordinates for central London on a date chosen for having
 * nothing special about it.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { natalChart } from '@zodiacs/engine';
import { createNatalEnvelope, parseNatalEnvelope } from '@zodiacs/engine/receipt';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = resolve(ROOT, 'docs/platform/evidence/chart-compare');
const CHROMIUM = await findChromium();

const LONDON = { latitude: 51.5074, longitude: -0.1278 };
const T1 = '1990-06-15T13:30:00Z';
const T2 = '1990-06-15T14:30:00Z';

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined || ok ? '' : ` · ${JSON.stringify(detail)}`}`);
};

/** A record the engine's own parser accepts, or the fixture is not an input. */
function record(utc, houseSystem, edit) {
  const envelope = createNatalEnvelope(
    natalChart({ utc: new Date(utc), ...LONDON, houseSystem, timeKnown: true }),
    { sourceInstant: utc },
  );
  const copy = JSON.parse(JSON.stringify(envelope));
  if (edit) edit(copy);
  const text = JSON.stringify(copy);
  const parsed = parseNatalEnvelope(text);
  if (!parsed.ok) throw new Error(`fixture ${houseSystem} is not parser-accepted: ${parsed.code}`);
  return text;
}

/**
 * Rewrites the instant a record declares, and the ΔT and time basis that go
 * with it. From engine 0.1.1-rc.8 a record carries the ΔT it was computed
 * with, and from rc.15 how its instant became UT1 and TT (result.timeScale);
 * the parser checks both against the declared instant, so the instant alone
 * is refused. Both are public arithmetic, so the extra edits are no obstacle
 * to anyone, and the values still come from the other moment.
 */
const declaring = (utc) => (o) => {
  const declared = JSON.parse(record(utc, 'placidus')).result;
  o.receipt.instant = new Date(utc).toISOString();
  o.receipt.sourceInstant = utc;
  o.result.deltaT = declared.deltaT;
  o.result.timeScale = declared.timeScale;
};

const asFile = (name, text) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text, 'utf8') });

/** Import two records and read the verdict and the evidence badges back. */
async function compareInBrowser(page, leftText, rightText) {
  await page.locator('[data-compare-reset]').click();
  await page.locator('[data-compare-file="left"]').setInputFiles(asFile('left.json', leftText));
  await page.locator('[data-compare-file="right"]').setInputFiles(asFile('right.json', rightText));
  await page.locator('[data-compare-run]').click();
  await page.locator('[data-compare-result], [data-compare-error]').first().waitFor({ state: 'visible', timeout: 20000 });
  return page.evaluate(() => ({
    verdict: document.querySelector('[data-compare-result]')?.getAttribute('data-compare-result') ?? null,
    error: document.querySelector('[data-compare-error]')?.textContent?.trim() ?? null,
    evidence: [...document.querySelectorAll('[data-compare-explanations] li')]
      .map((item) => item.getAttribute('data-evidence')),
    statements: [...document.querySelectorAll('[data-compare-explanations] .cmp__statement')]
      .map((item) => item.textContent?.trim() ?? ''),
    limits: [...document.querySelectorAll('[data-compare-limits] li')].map((item) => item.textContent?.trim() ?? ''),
    rows: document.querySelectorAll('[data-compare-table] tbody tr').length,
  }));
}

const offOrigin = [];
const nonGet = [];
let storageWrites = 0;

await withPreview({ port: Number(process.env.COMPARE_DRIVE_PORT ?? 4437) }, async (BASE) => {
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: STABLE_CHROMIUM_ARGS });
  try {
    for (const viewport of [
      { name: 'desktop', width: 1280, height: 900, touch: false },
      { name: 'mobile', width: 390, height: 844, touch: true },
    ]) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: viewport.touch,
      });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('request', (request) => {
        if (!request.url().startsWith(BASE) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) {
          offOrigin.push(request.url());
        }
        if (request.method() !== 'GET') nonGet.push(`${request.method()} ${request.url()}`);
      });
      await page.goto(`${BASE}/developers/compare/`, { waitUntil: 'networkidle' });
      await page.addInitScript(() => {
        // Counted rather than blocked: the claim is that the page writes
        // nothing, and a blocked write would hide a page that tried.
        window.__writes = 0;
      });

      check(`${viewport.name}: the page renders its controls`,
        await page.locator('[data-chart-compare]').isVisible()
        && (await page.locator('[data-compare-preset]').count()) === 4);

      // --- the four presets, which are the page's own acceptance corpus ---
      for (const preset of await page.locator('[data-compare-preset]').evaluateAll(
        (nodes) => nodes.map((node) => node.getAttribute('data-compare-preset')),
      )) {
        await page.locator(`[data-compare-preset="${preset}"]`).click();
        await page.locator('[data-compare-result], [data-compare-error]').first().waitFor({ state: 'visible', timeout: 20000 });
        const verdict = await page.locator('[data-compare-result]').getAttribute('data-compare-result');
        check(`${viewport.name}: preset ${preset} reaches a verdict`, verdict !== null, verdict);
      }

      // --- the shared reproduced contract, read off the rendered page ---
      const genuineLeft = record(T1, 'placidus');
      const genuineRight = record(T1, 'whole');
      const control = await compareInBrowser(page, genuineLeft, genuineRight);
      check(`${viewport.name}: an ordinary house-system difference is reproduced`,
        control.evidence.includes('reproduced') && control.rows === 15, control);

      const foreignRight = record(T1, 'whole', (o) => { o.receipt.engine.version = '99.0.0'; });
      const foreign = await compareInBrowser(page, genuineLeft, foreignRight);
      check(`${viewport.name}: a receipt naming an engine this page lacks is not reproduced`,
        !foreign.evidence.includes('reproduced'), foreign.evidence);
      check(`${viewport.name}: and the page says why, in its stated limits`,
        foreign.limits.some((line) => /different calculation/.test(line)), foreign.limits);

      const foreignReversed = await compareInBrowser(page, foreignRight, genuineLeft);
      check(`${viewport.name}: the verdict does not depend on which file was chosen first`,
        JSON.stringify([...foreign.evidence].sort()) === JSON.stringify([...foreignReversed.evidence].sort()),
        { forward: foreign.evidence, reverse: foreignReversed.evidence });

      const drifted = record(T2, 'placidus', declaring(T1));
      const baseline = await compareInBrowser(page, drifted, genuineRight);
      check(`${viewport.name}: a record whose values do not follow from its own inputs is not reproduced`,
        !baseline.evidence.includes('reproduced'), baseline.evidence);
      check(`${viewport.name}: and the page names the baseline that failed`,
        baseline.limits.some((line) => /could not be reproduced from the inputs it declares/.test(line)),
        baseline.limits);

      // The same drift where the cusps cannot detect it. Whole-sign cusps sit on
      // sign boundaries, so they survive an hour of rewritten instant unchanged;
      // an AI review found a cusps-only baseline promoting this pair to the
      // strongest verdict while sixty-five rows sat unresolved. Driven here as
      // well as in the unit suite because this is the surface a person reads.
      const quantised = record(T2, 'whole', declaring(T1));
      const drift = await compareInBrowser(page, quantised, genuineLeft);
      check(`${viewport.name}: a rewritten instant hidden behind quantised cusps is not reproduced`,
        !drift.evidence.includes('reproduced'), drift.evidence);
      const driftReversed = await compareInBrowser(page, genuineLeft, quantised);
      check(`${viewport.name}: and that verdict does not depend on argument order either`,
        JSON.stringify([...drift.evidence].sort()) === JSON.stringify([...driftReversed.evidence].sort()),
        { forward: drift.evidence, reverse: driftReversed.evidence });

      // --- the privacy claims this page makes about itself ---
      const url = page.url();
      check(`${viewport.name}: no birth detail reaches the address bar`,
        !url.includes('1990') && !url.includes('51.5') && !/[?#]/.test(url.replace(`${BASE}`, '')), url);
      const stored = await page.evaluate(() => ({
        local: window.localStorage.length,
        session: window.sessionStorage.length,
        cookie: document.cookie.length,
      }));
      storageWrites += stored.local + stored.session + stored.cookie;
      check(`${viewport.name}: nothing was written to storage or cookies`,
        stored.local === 0 && stored.session === 0 && stored.cookie === 0, stored);

      check(`${viewport.name}: no page error`, pageErrors.length === 0, pageErrors);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

check('no request left the page origin', offOrigin.length === 0, offOrigin.slice(0, 5));
check('no request was anything but a GET', nonGet.length === 0, nonGet.slice(0, 5));

await mkdir(OUT, { recursive: true });
const passed = results.filter((row) => row.ok).length;
await writeFile(join(OUT, 'browser-drive.json'), `${JSON.stringify({
  type: 'browser acceptance for /developers/compare/ against a local preview of the built site;'
    + ' not a drive against the deployed origin, which is recorded separately in live-drive.json',
  completedAt: new Date().toISOString(),
  node: process.version,
  viewports: ['1280x900', '390x844 with touch'],
  inputs: 'synthetic records built here by the real engine; no real birth details',
  offOriginRequests: offOrigin,
  nonGetRequests: nonGet,
  storageWrites,
  checks: results.length,
  passed,
  results,
}, null, 2)}\n`);
console.log(`\nchart-compare-drive: ${passed}/${results.length} checks passed`);
if (passed !== results.length) process.exitCode = 1;
