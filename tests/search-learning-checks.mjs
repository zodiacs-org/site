/** Shared browser assertions, called by explorer-drive's existing CI entrypoint. */
import { mkdir } from 'node:fs/promises';

const PROGRESS_KEY = 'zodiacs:learning-path:v2';
const LEGACY_KEY = 'zodiacs:learning-path:v1';
const PROFILE_KEY = 'zodiacs.profile.v1';
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const STEP_LINKS = ['/birth-chart/', '/learn/houses/', '/learn/aspects/', '/today/', '/horoscopes/'];
const PROFILE = JSON.stringify({
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [{
    id: PROFILE_ID, name: 'Learning fixture', relationship: 'other',
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
    birth: {
      date: '1907-07-06', time: '08:30', timeKnown: true,
      place: { name: 'Coyoacán', admin1: 'Ciudad de México', country: 'MX', lat: 19.35, lon: -99.16, tz: 'America/Mexico_City' },
    },
    summary: {
      engineVersion: 'test', utcISO: '1907-07-06T15:06:36.000Z', houseSystem: 'whole',
      bodies: [{ body: 'Sun', lon: 103.91, retrograde: false }, { body: 'Moon', lon: 59.44, retrograde: false }],
      angles: { asc: 143.2, mc: 58.4 }, flags: [],
    },
  }],
});

// Profile readers legitimately refresh derived engine summaries. The handoff
// must preserve every source/identity field and the selected house system.
function savedProfileSourceUnchanged(raw) {
  try {
    const source = (profile) => ({ ...profile, charts: profile.charts.map(({ summary, ...chart }) => (
      { ...chart, summary: { houseSystem: summary.houseSystem } }
    )) });
    return JSON.stringify(source(JSON.parse(raw))) === JSON.stringify(source(JSON.parse(PROFILE)));
  } catch { return false; }
}

export function savedChartContinuationFailures(state, prefix) {
  const saved = JSON.parse(PROFILE).charts[0];
  return [
    state.pathname === `${prefix}/birth-chart/` || 'wrong chart route',
    state.hash === '' || 'private chart handoff was not consumed',
    state.date === saved.birth.date && state.time === saved.birth.time || 'saved birth inputs were not restored',
    state.subjectMode === 'other' && state.subjectNotices.length === 1
      && state.subjectNotices[0].includes(saved.name) || 'named other-person result is missing',
    JSON.stringify(state.computedEvents) === JSON.stringify([{ mode: 'full', sunSign: 'cancer' }])
      || 'fresh full-chart computation did not finish with the expected Sun sign',
    savedProfileSourceUnchanged(state.profile) || 'saved private profile was changed',
  ].filter((failure) => failure !== true);
}

async function ready(page) {
  await page.locator('.learning-path__bar[role="progressbar"]').waitFor({ state: 'visible' });
}

async function expectProgress(page, complete, started) {
  await page.waitForFunction(({ complete, started }) => (
    document.querySelector('.learning-path__bar')?.getAttribute('aria-valuenow') === String(complete)
    && document.querySelectorAll('[data-learning-state="completed"]').length === complete
    && document.querySelectorAll('[data-learning-state="started"]').length === started
  ), { complete, started });
}

export async function runSearchLearningChecks({ browser, baseURL, check, outDir = null }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  const shot = async (page, name) => {
    if (!outDir) return;
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.locator('.learning-path').screenshot({ path: `${outDir}/${name}.png`, animations: 'disabled' });
  };
  const verifyTarget = async (target, name) => {
    await target.scrollIntoViewIfNeeded();
    const geometry = await target.evaluate(async (node) => {
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = node.getBoundingClientRect();
      const control = node instanceof HTMLLabelElement ? node.control : node;
      const points = [[2, 2], [rect.width - 2, 2], [rect.width - 2, rect.height - 2], [2, rect.height - 2], [rect.width / 2, rect.height / 2]];
      const ownsPoints = points.every(([x, y]) => {
        const hit = document.elementFromPoint(rect.left + x, rect.top + y);
        return hit && node.contains(hit);
      });
      const overlaps = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')]
        .filter((other) => other !== node && !node.contains(other) && !other.contains(node))
        .filter((other) => {
          const style = getComputedStyle(other);
          const box = other.getBoundingClientRect();
          // Closed details can retain descendant boxes without painted hit targets.
          return !other.closest('details:not([open])')
            && style.visibility === 'visible' && style.display !== 'none' && style.pointerEvents !== 'none'
            && Math.min(box.right, rect.right) > Math.max(box.left, rect.left)
            && Math.min(box.bottom, rect.bottom) > Math.max(box.top, rect.top);
        }).map((other) => ({ tag: other.tagName, class: other.className }));
      return {
        width: rect.width, height: rect.height, left: rect.left, right: rect.right,
        top: rect.top, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight,
        ownsPoints, overlaps,
        nativeControl: node instanceof HTMLLabelElement
          ? control instanceof HTMLInputElement && control.type === 'checkbox' && node.contains(control) && !control.disabled
          : node instanceof HTMLButtonElement && !node.disabled,
        paddingPoint: { x: rect.width - 2, y: rect.height - 2 },
      };
    });
    check(name, Object.values(geometry).filter((value) => typeof value === 'number').every(Number.isFinite)
      && geometry.width >= 44 && geometry.height >= 44
      && geometry.left >= 0 && geometry.right <= geometry.viewportWidth
      && geometry.top >= 0 && geometry.bottom <= geometry.viewportHeight
      && geometry.nativeControl && geometry.ownsPoints && geometry.overlaps.length === 0,
    JSON.stringify(geometry));
    return geometry.paddingPoint;
  };

  for (const width of [390, 1440]) {
    const noJs = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled: false });
    try {
      const page = await noJs.newPage();
      await page.goto(`${baseURL}/learn/`, { waitUntil: 'load' });
      const links = await page.locator('.learning-step__action').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
      check(`learning ${width}: all five steps and destinations exist without JavaScript`,
        JSON.stringify(links) === JSON.stringify(STEP_LINKS)
        && await page.locator('[data-learning-step]').count() === 5
        && !/Opening your saved path|Loading your progress/.test(await page.locator('.learning-path').textContent()));
      await shot(page, `learning-no-js-${width}`);
    } finally {
      await noJs.close();
    }

    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    try {
      const page = await context.newPage();
      const searchAssetRequests = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname === '/assets/search-ui.js') searchAssetRequests.push(url);
      });
      // Click the actual rendered search result so the badge and destination
      // are verified together; index-only assertions would miss dialog bugs.
      for (const [query, title, path] of [
        ['birth charts', 'Free Birth Chart Calculator — Sun, Moon & Rising', '/birth-chart/'],
        ['BIRTH CHARTS', 'Free Birth Chart Calculator — Sun, Moon & Rising', '/birth-chart/'],
        ['big three', 'Big Three Calculator — Sun, Moon, and Rising in Seconds', '/big-three/'],
        ['solar return', 'Solar Return Calculator — Your Birthday Chart for Any Year', '/solar-return/'],
      ]) {
        await page.goto(`${baseURL}/learn/`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-search-open]').click();
        await page.locator('.zsearch__input').fill(query);
        const result = page.locator('.zsearch__opt').filter({ has: page.getByText(title, { exact: true }) });
        await result.waitFor({ state: 'visible' });
        check(`search ${width}: ${query} loads the refreshed ranking cache key`,
          searchAssetRequests.length > 0
          && searchAssetRequests.every((url) => url.search === '?v=search-ranking-2'),
          searchAssetRequests.map((url) => `${url.pathname}${url.search}`).join(', '));
        check(`search ${width}: ${query} exposes its Tool result`,
          await result.locator('.zsearch__kind').textContent() === 'Tool');
        await result.click();
        await page.waitForURL((url) => url.pathname === path);
        check(`search ${width}: ${query} opens ${path}`, new URL(page.url()).pathname === path);
      }

      await page.goto(`${baseURL}/learn/`, { waitUntil: 'domcontentloaded' });
      await ready(page);
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: PROFILE_KEY, value: PROFILE });
      await expectProgress(page, 0, 0);
      await shot(page, `learning-new-${width}`);
      const first = page.locator('[data-learning-step="big-three"]');
      await first.locator('.learning-step__action').click();
      await page.waitForURL((url) => url.pathname === '/birth-chart/');
      await page.locator('.calc__form').waitFor({ state: 'visible' });
      check(`learning ${width}: opening the first lesson only opens the empty chart form`,
        await page.locator('.calc__result').count() === 0);
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await ready(page);
      await expectProgress(page, 0, 1);
      const storedStart = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PROGRESS_KEY);
      check(`learning ${width}: returning without calculating is started, never completed`,
        JSON.stringify(storedStart) === JSON.stringify({ version: 2, started: ['big-three'], completed: [] }));
      await shot(page, `learning-started-${width}`);

      const reflection = first.getByRole('checkbox', { name: 'I have read my available chart placements and can describe what one means.' });
      await verifyTarget(first.locator('.learning-step__reflection'), `learning ${width}: native reflection label has an unobstructed 44px target`);
      await reflection.focus();
      check(`learning ${width}: reflection receives keyboard focus`, await reflection.evaluate((node) => document.activeElement === node));
      await page.keyboard.press('Space');
      await expectProgress(page, 1, 0);
      check(`learning ${width}: explicit keyboard reflection records one self-marked completion`, true);
      await shot(page, `learning-completed-${width}`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ready(page);
      await expectProgress(page, 1, 0);
      check(`learning ${width}: confirmed progress survives reload`, true);
      await verifyTarget(page.getByRole('button', { name: 'Start this path over', exact: true }), `learning ${width}: Restart has an unobstructed 44px target`);
      await page.getByRole('button', { name: 'Start this path over', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expectProgress(page, 0, 0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ready(page);
      await expectProgress(page, 0, 0);
      check(`learning ${width}: keyboard restart persists and preserves the saved chart`,
        await page.evaluate((key) => localStorage.getItem(key), PROFILE_KEY) === PROFILE);

      // Activate the real label padding as well as the existing keyboard path.
      // Its click area is the in-flow label, never an overlapping pseudo-element.
      const second = page.locator('[data-learning-step="planets-houses"]');
      const [lesson] = await Promise.all([
        context.waitForEvent('page'),
        second.locator('.learning-step__action').click({ modifiers: ['ControlOrMeta'] }),
      ]);
      await expectProgress(page, 0, 1);
      await lesson.close();
      const label = second.locator('.learning-step__reflection');
      const labelPadding = await verifyTarget(label, `learning ${width}: another reflection label preserves the native 44px click area`);
      await label.click({ position: labelPadding });
      await expectProgress(page, 1, 0);
      check(`learning ${width}: clicking label padding confirms the associated native checkbox`, true);
      const restart = page.getByRole('button', { name: 'Start this path over', exact: true });
      const restartPadding = await verifyTarget(restart, `learning ${width}: Restart padding remains unobstructed after reflection`);
      await restart.click({ position: restartPadding });
      await expectProgress(page, 0, 0);
      check(`learning ${width}: clicking Restart padding clears progress and preserves the saved chart`,
        await page.evaluate((key) => localStorage.getItem(key), PROFILE_KEY) === PROFILE);

      // Exercise the existing opaque saved-chart handoff in both registers;
      // learning progress must neither clear the profile nor rewrite its link.
      const prefix = width === 390 ? '' : '/es';
      await page.goto(`${baseURL}${prefix}/profile/`, { waitUntil: 'domcontentloaded' });
      const savedLink = page.locator(`.pf-chart__actions a[href="${prefix}/birth-chart/#profileChartId=${PROFILE_ID}"]`);
      await savedLink.waitFor({ state: 'visible' });
      // Install before navigating: only a fresh runChart calculation emits
      // this event. A cached summary or positions-only view cannot supply it.
      await page.addInitScript(() => {
        window.__searchLearningComputed = [];
        window.addEventListener('zodiacs:chart-computed', (event) => {
          window.__searchLearningComputed.push({ mode: event.detail?.mode, sunSign: event.detail?.sunSign });
        });
      });
      await savedLink.click();
      await page.locator('.calc__result').waitFor({ state: 'visible', timeout: 30000 });
      const continuation = await page.evaluate((key) => ({
        pathname: location.pathname,
        hash: location.hash,
        date: document.querySelector('#birth-date')?.value,
        time: document.querySelector('#birth-time')?.value,
        subjectMode: document.querySelector('.calc')?.getAttribute('data-subject-mode'),
        subjectNotices: Array.from(document.querySelectorAll('.calc__result [data-chart-subject]'), (node) => node.textContent ?? ''),
        computedEvents: window.__searchLearningComputed,
        profile: localStorage.getItem(key),
      }), PROFILE_KEY);
      const continuationFailures = savedChartContinuationFailures(continuation, prefix);
      check(`learning ${width}: ${prefix || '/en'} saved-chart continuation still computes from private local input`,
        continuationFailures.length === 0, continuationFailures.join(' | '));
    } finally {
      await context.close();
    }
  }

  const legacy = await browser.newContext({ viewport: { width: 390, height: 1000 } });
  try {
    await legacy.addInitScript(({ key }) => localStorage.setItem(key, JSON.stringify(['aspects', 'big-three', 'aspects'])), { key: LEGACY_KEY });
    const page = await legacy.newPage();
    await page.goto(`${baseURL}/learn/`, { waitUntil: 'domcontentloaded' });
    await ready(page);
    await expectProgress(page, 0, 2);
    check('learning: legacy link-open completions migrate to started with reflection controls',
      await page.locator('.learning-step__reflection input').count() === 2);
    await shot(page, 'learning-legacy-390');
  } finally {
    await legacy.close();
  }

  const blocked = await browser.newContext({ viewport: { width: 390, height: 1000 } });
  try {
    await blocked.addInitScript(() => {
      for (const method of ['getItem', 'setItem']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (key, ...args) {
          if (String(key).startsWith('zodiacs:learning-path:')) throw new DOMException('Storage blocked', 'SecurityError');
          return original.call(this, key, ...args);
        };
      }
    });
    const page = await blocked.newPage();
    await page.goto(`${baseURL}/learn/`, { waitUntil: 'domcontentloaded' });
    await ready(page);
    // A real new-tab activation leaves this visit open to exercise the
    // in-memory fallback even though both storage reads and writes throw.
    const [lesson] = await Promise.all([
      blocked.waitForEvent('page'),
      page.locator('[data-learning-step="planets-houses"] .learning-step__action').click({ modifiers: ['ControlOrMeta'] }),
    ]);
    await expectProgress(page, 0, 1);
    await lesson.close();
    await page.getByRole('checkbox', { name: 'I can name one house and the area of life it describes.' }).focus();
    await page.keyboard.press('Space');
    await expectProgress(page, 1, 0);
    check('learning: blocked progress storage still permits explicit completion during this visit', true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    await expectProgress(page, 0, 0);
    check('learning: blocked storage does not claim the transient completion survived reload', true);
  } finally {
    await blocked.close();
  }
}
