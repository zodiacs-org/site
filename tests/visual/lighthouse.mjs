import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import mobileConfig from 'lighthouse/core/config/default-config.js';
import * as chromeLauncher from 'chrome-launcher';
import { findChromium, STABLE_CHROMIUM_ARGS } from './browser.mjs';
import { withPreview } from './preview-server.mjs';
import { saveLighthouseAssets } from './lighthouse-assets.mjs';
import { calibrations, describeMisses, gateRoute, MAX_STALL_RETAKES, stallSummary } from './lighthouse-gate.mjs';
import { describeStalls } from './runner-stalls.mjs';

const visualRoot = dirname(fileURLToPath(import.meta.url));
const artifactRoot = resolve(visualRoot, 'artifacts/lighthouse');
const runCount = Number(process.env.LIGHTHOUSE_RUNS ?? 3);
const routes = [
  // The three highest-traffic EN routes gate every push alongside the newer
  // templates. They were excluded while older-baseline debt was being paid
  // down (SITE-AUDIT-2026-08-24 §Performance); they now pass the same
  // budgets, so the flagship funnel blocks merges exactly like /ru/ does.
  { name: 'home', path: '/' },
  { name: 'birth-chart', path: '/birth-chart/' },
  { name: 'lunar-return', path: '/lunar-return/' },
  { name: 'numerology', path: '/numerology/' },
  { name: 'life-path-7', path: '/numerology/life-path/7/' },
  { name: 'void-of-course-moon', path: '/void-of-course-moon/' },
  { name: 'aries', path: '/aries/' },
  { name: 'thesis', path: '/thesis/' },
  { name: 'today', path: '/today/' },
  { name: 'horoscopes', path: '/horoscopes/' },
  { name: 'horoscope-daily', path: '/horoscopes/aries/' },
  { name: 'horoscope-tomorrow', path: '/horoscopes/aries/tomorrow/' },
  { name: 'horoscope-weekly', path: '/horoscopes/aries/weekly/' },
  { name: 'horoscope-monthly', path: '/horoscopes/aries/monthly/' },
  { name: 'horoscope-love', path: '/horoscopes/aries/love/' },
  { name: 'horoscope-career', path: '/horoscopes/aries/career/' },
  { name: 'horoscope-yearly', path: '/horoscopes/aries/2027/' },
  { name: 'events-hub', path: '/events/' },
  { name: 'event-full-moon', path: '/full-moon/2026-07-29/' },
  { name: 'event-eclipse', path: '/eclipses/2026-08-12/' },
  { name: 'event-retrograde', path: '/mercury-retrograde/2026-06-29/' },
  { name: 'event-ingress', path: '/events/saturn-enters-aries-2026-02-14/' },
  { name: 'event-aspect', path: '/events/jupiter-trine-saturn-2026-08-31/' },
  { name: 'people-directory', path: '/people/' },
  { name: 'people-profile', path: '/people/ada-lovelace/' },
  { name: 'people-profile-new', path: '/people/marie-curie/' },
  { name: 'people-living-profile', path: '/people/serena-williams/', intentionalNoindex: true },
  // R2 makes the reviewed Russian core public. Gate each distinct Russian
  // template family instead of assuming the English scores transfer across
  // longer Cyrillic copy and the locale-specific font preload path.
  { name: 'ru-home', path: '/ru/' },
  { name: 'ru-birth-chart', path: '/ru/birth-chart/' },
  { name: 'ru-sign-guide', path: '/ru/aries/', intentionalNoindex: true },
];
// Registry Collection only exists in flag-on builds, so it cannot join the
// per-push gate; the scheduled lighthouse-collection workflow builds with the
// flag and audits it here.
if (process.env.LIGHTHOUSE_INCLUDE_AURA === '1') {
  routes.push({ name: 'registry-aura', path: '/registry/collection/' });
}
const routeFilter = new Set(
  (process.env.LIGHTHOUSE_ROUTES ?? '').split(',').map((name) => name.trim()).filter(Boolean),
);
const selectedRoutes = routeFilter.size > 0
  ? routes.filter((route) => routeFilter.has(route.name))
  : routes;
if (selectedRoutes.length === 0) {
  throw new Error(`LIGHTHOUSE_ROUTES did not match a route: ${[...routeFilter].join(', ')}`);
}
// The budgets, the per-route calibrations, the worst-of-runs summary and the
// runner-stall rule (audit finding F-51) that decides which samples count
// live in lighthouse-gate.mjs, where they are tested without a browser.

if (!Number.isInteger(runCount) || runCount < 1 || runCount > 5) {
  throw new Error('LIGHTHOUSE_RUNS must be an integer from 1 to 5.');
}

function incompleteRunReason(lhr) {
  if (lhr.runtimeError?.code) {
    return `${lhr.runtimeError.code}: ${lhr.runtimeError.message ?? 'unknown Lighthouse runtime error'}`;
  }
  const missing = [];
  for (const categoryId of ['performance', 'accessibility', 'seo']) {
    if (!Number.isFinite(lhr.categories[categoryId]?.score)) missing.push(`${categoryId} score`);
  }
  for (const auditId of ['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time']) {
    if (!Number.isFinite(lhr.audits[auditId]?.numericValue)) missing.push(`${auditId} value`);
  }
  return missing.length > 0 ? `missing ${missing.join(', ')}` : null;
}

function formatValues(values) {
  if (!values) return '  —     —     —        —         —         —';
  return `${Math.round(values.performance * 100).toString().padStart(3)}   ${Math.round(values.accessibility * 100).toString().padStart(3)}   ${Math.round(values.seo * 100).toString().padStart(3)}   ${(values.lcp / 1000).toFixed(2).padStart(6)}s   ${values.cls.toFixed(3).padStart(6)}   ${Math.round(values.tbt).toString().padStart(5)}ms`;
}

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(artifactRoot, { recursive: true });

const chromePath = await findChromium();
// CI keeps every sample's trace so a failed gate can be traced to actual tasks.
const saveAssets = process.env.LIGHTHOUSE_SAVE_ASSETS === '1' || process.env.CI === 'true';

async function takeSample(route, url, take) {
  // Each sample gets a fresh browser process. Reusing one process made
  // later samples inherit renderer/benchmark drift from earlier audits,
  // which obscured cold-load regressions instead of measuring them.
  let result;
  for (let attempt = 1; attempt <= 2 && !result; attempt += 1) {
    const chrome = await chromeLauncher.launch({
      chromePath,
      chromeFlags: [
        '--headless=new',
        '--disable-gpu',
        ...STABLE_CHROMIUM_ARGS,
      ],
      logLevel: 'silent',
    });
    try {
      const candidate = await lighthouse(url, {
        port: chrome.port,
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'seo'],
        maxWaitForLoad: 45_000,
        disableStorageReset: false,
      }, mobileConfig);
      const incompleteReason = incompleteRunReason(candidate.lhr);
      if (incompleteReason) {
        await writeFile(
          resolve(artifactRoot, `${route.name}-${take}-attempt-${attempt}-invalid.json`),
          JSON.stringify(candidate.lhr, null, 2),
        );
        throw new Error(`incomplete Lighthouse result (${incompleteReason})`);
      }
      result = candidate;
    } catch (error) {
      if (attempt === 2) throw error;
      console.warn(
        `     ↳ Lighthouse runtime failed for ${route.path} sample ${take} (${error.message}); retrying once in a fresh browser.`,
      );
    } finally {
      await chrome.kill();
    }
  }
  if (!result) throw new Error(`Lighthouse returned no result for ${url}.`);
  return result;
}

async function keepSample(route, result, sample) {
  // The audit and browser shutdown are complete before diagnostic disk I/O.
  if (sample.status === 'valid') {
    const name = `${route.name}-${sample.index}`;
    await writeFile(resolve(artifactRoot, `${name}.json`), JSON.stringify(result.lhr, null, 2));
    if (saveAssets) await saveLighthouseAssets(result, artifactRoot, name);
    return;
  }
  // A sample set aside for a runner stall always keeps its report and trace,
  // under a name of its own, so the stall can be checked afterwards.
  const name = `${route.name}-stalled-${sample.index}`;
  await writeFile(resolve(artifactRoot, `${name}.json`), JSON.stringify(result.lhr, null, 2));
  let kept = `${name}.json and ${name}.trace.json`;
  try {
    await saveLighthouseAssets(result, artifactRoot, name);
  } catch (error) {
    if (saveAssets) throw error;
    kept = `${name}.json (trace not kept: ${error.message})`;
  }
  console.warn(
    `     ↳ ${route.path} sample ${sample.take} missed ${describeMisses(sample.values, sample.misses, route)} while the runner held the page's main thread off the CPU (${describeStalls(sample.stalls)}).`,
  );
  console.warn(
    `       Set aside as ${kept}; ${sample.retaken ? `retake ${sample.index} of ${MAX_STALL_RETAKES}, in a fresh browser.` : 'no retakes left.'}`,
  );
}

let failures = 0;
const verdicts = [];
await withPreview({ port: Number(process.env.LIGHTHOUSE_PORT ?? 4328) }, async (baseURL) => {
    console.log(`Lighthouse · ${runCount} run${runCount === 1 ? '' : 's'} per route, up to ${MAX_STALL_RETAKES} more after a runner stall · ${baseURL}`);
    console.log('Route                         Perf  A11y   SEO     LCP       CLS       TBT');

    for (const route of selectedRoutes) {
      const url = `${baseURL}${route.path}`;
      const verdict = await gateRoute({
        route,
        runs: runCount,
        takeSample: (take) => takeSample(route, url, take),
        record: (result, sample) => keepSample(route, result, sample),
      });
      verdicts.push(verdict);
      if (verdict.failed) failures += 1;
      console.log(`${verdict.failed ? 'FAIL' : 'pass'} ${route.path.padEnd(22)} ${formatValues(verdict.values)}`);
      if (!verdict.complete) {
        console.log(
          `     ↳ ${stallSummary(verdict)}: ${verdict.valid.length} valid sample${verdict.valid.length === 1 ? '' : 's'} of the ${runCount} the gate needs, so the route fails.`,
        );
      }
      if (route.intentionalNoindex && verdict.values?.searchPrivate) {
        console.log('     ↳ SEO excludes only the intentional noindex audit; noindex remained active in every run.');
      }
    }

    const stalled = verdicts.filter((verdict) => verdict.setAside.length > 0);
    const setAside = stalled.reduce((sum, verdict) => sum + verdict.setAside.length, 0);
    const retakes = stalled.reduce((sum, verdict) => sum + verdict.retakes, 0);
    console.log(stalled.length === 0
      ? 'Runner stalls: none; no sample was retaken.'
      : `Runner stalls: ${setAside} sample${setAside === 1 ? '' : 's'} set aside and ${retakes} retaken — ${stalled.map((verdict) => `${verdict.route.path} ${verdict.setAside.length}`).join(', ')}.`);
});

if (failures > 0) {
  const stalledOut = verdicts.filter((verdict) => !verdict.complete);
  throw new Error(
    `${failures} route${failures === 1 ? '' : 's'} missed the Phase 1/2 Lighthouse gate: performance, accessibility, and SEO ≥95; LCP ≤2.50s; CLS =0; TBT ≤200ms — except the documented per-route calibrations (${Object.keys(calibrations).join(', ')}).${stalledOut.length > 0 ? ` Too few valid samples: ${stalledOut.map((verdict) => `${verdict.route.path} (${stallSummary(verdict)})`).join(', ')}.` : ''}`,
  );
}
