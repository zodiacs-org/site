import { mkdir, writeFile } from 'node:fs/promises';
const id = 'c5c1e710-ae43-4f98-a27c-2976aaf4a5de';
const unknownId = 'fae733a3-70fa-40a1-9b25-76c8d7a9a151';
const chart = (chartId, timeKnown) => ({ id: chartId, name: timeKnown ? 'Synthetic practice chart' : 'Synthetic unknown time',
  createdAt: '2026-09-06T00:00:00Z', updatedAt: '2026-09-06T00:00:00Z',
  birth: { date: '1999-08-11', time: timeKnown ? '12:00' : null, timeKnown,
    place: { name: 'Synthetic UTC location', admin1: '', country: '', lat: 51.5, lon: 0, tz: 'Etc/UTC' } },
  summary: { engineVersion: 'stale-test-cache', utcISO: '1999-08-11T12:00:00Z', houseSystem: 'whole', bodies: [], angles: null, flags: [] },
});

export async function runLearningPracticeChecks({ browser, baseURL, check, outDir }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  const receipts = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    context.on('page', (page) => {
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('requestfailed', (request) => errors.push(request.url()));
    });
    try {
      await context.addInitScript((charts) => {
        // Initial about:blank documents have no storage origin; seed real pages only.
        if (location.origin === 'null') return;
        if (!localStorage.getItem('zodiacs.profile.v1')) localStorage.setItem('zodiacs.profile.v1', JSON.stringify({ version: 1, settings: { houseSystem: 'whole' }, charts }));
      }, [chart(id, true), chart(unknownId, false)]);
      const page = await context.newPage();
      await page.goto(`${baseURL}/learn/`, { waitUntil: 'networkidle' });
      // The saved-chart practice entry sits behind a disclosure on the learn page.
      await page.locator('.learning-path__practice > summary').click();
      await page.getByRole('button', { name: 'Choose a saved chart', exact: true }).click();
      await page.getByRole('button', { name: 'Practice with this saved chart', exact: true }).waitFor();
      check(`practice ${width}: ordinary five destinations remain`, await page.locator('[data-learning-step] a').count() === 5);
      const handoffs = [];
      page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) handoffs.push(frame.url()); });
      await page.getByRole('button', { name: 'Practice with this saved chart', exact: true }).click();
      await page.waitForURL(`**/birth-chart/#profileChartId=${id}`);
      const practice = page.getByRole('region', { name: 'Try it with your chart', exact: true });
      await practice.getByRole('button', { name: 'Begin this exercise', exact: true }).waitFor({ timeout: 45_000 });
      check(`practice ${width}: opaque-only handoff`, handoffs.some((value) => { const url = new URL(value); return url.pathname === '/birth-chart/' && url.hash === `#profileChartId=${id}` && !url.search; })
        && !new URL(page.url()).hash && !new URL(page.url()).search);
      const initial = await page.evaluate(() => JSON.parse(localStorage.getItem('zodiacs:learning-path:v2')));
      check(`practice ${width}: entry starts only big three, completes nothing`, JSON.stringify(initial) === JSON.stringify({ version: 2, started: ['big-three'], completed: [] }));
      await practice.getByRole('button', { name: 'Begin this exercise', exact: true }).click();
      await practice.getByRole('radio', { name: 'Leo', exact: true }).check();
      await practice.getByRole('button', { name: 'Check my answer', exact: true }).click();
      await practice.getByRole('checkbox').waitFor();
      check(`practice ${width}: correctness alone does not complete`, (await page.evaluate(() => JSON.parse(localStorage.getItem('zodiacs:learning-path:v2')).completed)).length === 0);
      await practice.getByRole('button', { name: 'Show on chart', exact: true }).click();
      check(`practice ${width}: native exercise spotlight reaches the wheel`, await page.locator('.wheel--interactive').isVisible());
      await practice.getByRole('checkbox').check();
      await practice.getByRole('button', { name: 'Mark this lesson complete', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('zodiacs:learning-path:v2')).completed.includes('big-three'));
      const fits = await practice.evaluate((node) => document.documentElement.scrollWidth <= innerWidth
        && node.scrollWidth <= node.clientWidth + 1 && [...node.querySelectorAll('button,select')].filter((el) => el.getClientRects().length).every((el) => el.getBoundingClientRect().height >= 44));
      check(`practice ${width}: no overflow and 44px controls`, fits);
      if (outDir) await practice.screenshot({ path: `${outDir}/practice-${width}.png`, animations: 'disabled' });

      const other = await context.newPage(); await other.goto(`${baseURL}/learn/`, { waitUntil: 'networkidle' });
      await other.evaluate((chartId) => {
        const profile = JSON.parse(localStorage.getItem('zodiacs.profile.v1'));
        profile.charts.find((entry) => entry.id === chartId).birth.date = '1999-08-12';
        localStorage.setItem('zodiacs.profile.v1', JSON.stringify(profile));
      }, id);
      await practice.getByText('This practice no longer matches an available saved chart.', { exact: false }).waitFor();
      check(`practice ${width}: real cross-tab source edit scrubs attempt controls`, await practice.getByRole('button', { name: 'Check my answer', exact: true }).count() === 0);

      // A fragment-only navigation does not remount the calculator. Enter the
      // second saved chart from another page, as the learning handoff does.
      await page.goto(`${baseURL}/learn/`, { waitUntil: 'networkidle' });
      await page.goto(`${baseURL}/birth-chart/#profileChartId=${unknownId}`, { waitUntil: 'networkidle' });
      await practice.getByRole('button', { name: 'Begin this exercise', exact: true }).waitFor({ timeout: 45_000 });
      check(`practice unknown ${width}: fresh saved source has no birth time`, await page.locator('#birth-time').inputValue() === '');
      await practice.getByLabel('Choose a reference point', { exact: true }).selectOption('Rising');
      check(`practice unknown ${width}: no invented rising exercise`, await practice.getByRole('button', { name: 'Begin this exercise', exact: true }).count() === 0);
      await practice.getByLabel('Practice', { exact: true }).selectOption('planets-houses');
      check(`practice unknown ${width}: no invented house exercise`, await practice.getByRole('button', { name: 'Begin this exercise', exact: true }).count() === 0);
      if (outDir) await practice.screenshot({ path: `${outDir}/unknown-${width}.png`, animations: 'disabled' });
      check(`practice ${width}: no unexpected browser failures`, errors.length === 0, JSON.stringify(errors));
      receipts.push({ width, fits, errors });
    } finally { await context.close(); }
  }
  // Exercise the browser's actual lock queue and storage events. Unit mocks
  // establish handler lifetime separately; these are native platform checks.
  const lockContext = await browser.newContext({ viewport: { width: 390, height: 1000 } });
  try {
    const page = await lockContext.newPage(); const holder = await lockContext.newPage();
    await page.goto(`${baseURL}/learn/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('zodiacs:learning-path:v2', JSON.stringify({ version: 2, started: ['aspects'], completed: [] })));
    await page.reload({ waitUntil: 'networkidle' });
    await holder.goto(`${baseURL}/learn/`, { waitUntil: 'networkidle' });
    await holder.evaluate(() => {
      window.__learningLockReleased = false;
      void navigator.locks.request('zodiacs:learning-path:v2:write', { mode: 'exclusive' }, () => new Promise((resolve) => {
        window.__releaseLearningLock = () => { window.__learningLockReleased = true; resolve(); };
      }));
    });
    await holder.waitForFunction(() => typeof window.__releaseLearningLock === 'function');
    const started = Date.now();
    await page.locator('[data-learning-step="aspects"] input[type="checkbox"]').check();
    await page.getByText('Changes on this page cannot be saved. Returning may show your last saved progress.', { exact: false }).waitFor({ timeout: 5000 });
    check('practice lock: bounded page-only fallback', Date.now() - started < 5000);
    check('practice lock: completed on page but not on disk', await page.locator('[data-learning-step="aspects"]').getAttribute('data-learning-state') === 'completed'
      && (await page.evaluate(() => JSON.parse(localStorage.getItem('zodiacs:learning-path:v2')).completed)).length === 0);
    await holder.evaluate(() => window.__releaseLearningLock());
    // A barrier behind the released lock proves the timed-out queue position
    // has drained; no sleep or synthetic lock implementation substitutes here.
    await holder.evaluate(() => navigator.locks.request('zodiacs:learning-path:v2:write', { mode: 'exclusive' }, () => true));
    check('practice lock: timed-out request never writes after release', (await page.evaluate(() => JSON.parse(localStorage.getItem('zodiacs:learning-path:v2')).completed)).length === 0);
    await holder.evaluate(() => localStorage.setItem('zodiacs:learning-path:v2', JSON.stringify({ version: 2, started: [], completed: [] })));
    await page.getByRole('button', { name: 'Start this path over', exact: true }).click();
    check('practice lock: page-only reset remains page-only', await page.locator('[data-learning-step="aspects"]').getAttribute('data-learning-state') === 'new');
    if (outDir) await page.locator('.learning-path').screenshot({ path: `${outDir}/page-only-lock-390.png`, animations: 'disabled' });
  } finally { await lockContext.close(); }

  for (const mode of ['missing-locks', 'denied-locks', 'blocked-storage']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    try {
      await context.addInitScript((failure) => {
        // Initial about:blank documents have no storage origin; seed real pages only.
        if (location.origin === 'null') return;
        localStorage.setItem('zodiacs:learning-path:v2', JSON.stringify({ version: 2, started: ['aspects'], completed: [] }));
        if (failure === 'missing-locks') Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
        if (failure === 'denied-locks') Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: () => Promise.reject(new DOMException('Denied', 'SecurityError')) } });
        if (failure === 'blocked-storage') {
          const write = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) {
            if (key === 'zodiacs:learning-path:v2') throw new DOMException('Blocked', 'QuotaExceededError');
            return write.call(this, key, value);
          };
        }
      }, mode);
      const page = await context.newPage(); await page.goto(`${baseURL}/learn/`, { waitUntil: 'networkidle' });
      // Completion intentionally removes this input; check() cannot verify an
      // already-unmounted checkbox. Use its native keyboard action, then assert
      // the durable/page-only completion state below.
      await page.locator('[data-learning-step="aspects"] input[type="checkbox"]').focus();
      await page.keyboard.press('Space');
      await page.getByText('Changes on this page cannot be saved. Returning may show your last saved progress.', { exact: false }).waitFor();
      check(`practice ${mode}: honest in-memory completion, disk unchanged`, await page.locator('[data-learning-step="aspects"]').getAttribute('data-learning-state') === 'completed'
        && (await page.evaluate(() => JSON.parse(localStorage.getItem('zodiacs:learning-path:v2')).completed)).length === 0);
    } finally { await context.close(); }
  }
  if (outDir) await writeFile(`${outDir}/measurements.json`, JSON.stringify(receipts, null, 2));
}
