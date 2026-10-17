/**
 * Chart-book drive: name-at-save, named-chart framing, people copy, caps,
 * rename-safe round trips, keyboard focus, and analytics privacy.
 *
 *   npm run build
 *   node tests/chart-book-drive.mjs
 */
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const PROFILE_KEY = 'zodiacs.profile.v1';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

const kahloWire = (name) => ({
  d: '1907-07-06', t: '08:30', z: 'America/Mexico_City',
  la: 19.35, lo: -99.16, ...(name ? { n: name } : {}),
  p: 'Coyoacán, Mexico',
});

const chartFragment = (name, subject = 'other') => {
  const params = new URLSearchParams();
  params.set('c', `1.${Buffer.from(JSON.stringify(kahloWire(name))).toString('base64url')}`);
  if (subject === 'other') params.set('subject', 'other');
  return `#${params.toString()}`;
};

function savedChart(id, name, overrides = {}) {
  const lat = overrides.lat ?? 19.35;
  const lon = overrides.lon ?? -99.16;
  const date = overrides.date ?? '1907-07-06';
  return {
    id,
    name,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    birth: {
      date,
      time: '08:30',
      timeKnown: true,
      place: {
        name: 'Coyoacán', admin1: 'Ciudad de México', country: 'MX',
        lat, lon, tz: 'America/Mexico_City',
      },
    },
    summary: {
      engineVersion: 'test',
      utcISO: `${date}T15:06:36.000Z`,
      houseSystem: 'whole',
      bodies: [
        { body: 'Sun', lon: 103.91, retrograde: false },
        { body: 'Moon', lon: 59.44, retrograde: false },
      ],
      angles: { asc: 143.2, mc: 58.4 },
      flags: [],
    },
  };
}

const profile = (charts) => ({ version: 1, settings: { houseSystem: 'whole' }, charts });

await withPreview({ port: 4410 }, async (baseURL) => {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: STABLE_CHROMIUM_ARGS,
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  async function preparedPage(charts = [], viewport = null) {
    const page = await context.newPage();
    if (viewport) await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      window.__chartBookEvents = [];
      window.zodiacsAnalytics = Object.freeze({
        track: (name, props) => window.__chartBookEvents.push({ name, props: props ?? {} }),
      });
    });
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, { key: PROFILE_KEY, value: JSON.stringify(profile(charts)) });
    return page;
  }

  async function openChart(page, { name, locale = 'en', subject = 'other' } = {}) {
    const path = locale === 'es' ? '/es/birth-chart/' : '/birth-chart/';
    await page.goto(`${baseURL}${path}${chartFragment(name, subject)}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.calc__result').waitFor({ timeout: 30_000 });
    await page.locator('[data-save-chart]').waitFor();
  }

  async function openPrompt(page) {
    const saveButton = page.locator('[data-save-chart]');
    await saveButton.waitFor();
    await saveButton.evaluate((button) => {
      document.body.tabIndex = -1;
      document.body.focus();
      button.click();
    });
    const input = page.getByLabel(/Whose chart is this\?|¿De quién es esta carta\?/);
    await input.waitFor();
    await page.waitForFunction(() => document.activeElement?.id === 'chart-save-name');
    await page.waitForFunction(() => {
      const prompt = document.querySelector('.xplr__aside > .calc__actions [data-save-prompt]');
      const rect = prompt?.getBoundingClientRect();
      return Boolean(rect && rect.top >= 0 && rect.bottom <= window.innerHeight);
    });
    return input;
  }

  async function saveButtonHasFocus(page) {
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-save-chart'));
    return page.evaluate(() => document.activeElement?.hasAttribute('data-save-chart') ?? false);
  }

  async function nearbySaveConfirmation(page) {
    const feedback = page.locator('[data-chart-action-dock] [data-save-chart]');
    await feedback.waitFor();
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-chart-action-dock] [data-save-chart]');
      return button?.textContent === 'Saved · on this device✓'
        && button.getAttribute('aria-disabled') === 'true'
        && button.querySelectorAll('[aria-live="polite"]').length === 1;
    });
    return await feedback.textContent() === 'Saved · on this device✓'
      && await feedback.getAttribute('aria-disabled') === 'true'
      && await feedback.locator('[aria-live="polite"]').count() === 1;
  }

  async function confirmationHasFocus(page) {
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-save-chart'));
    return page.evaluate(() => document.activeElement?.isConnected === true);
  }

  // A personal chart honors the button's literal promise: one tap saves it,
  // leaves a visible confirmation in place, and does not ask for a name.
  {
    const page = await preparedPage([]);
    await openChart(page, { subject: 'self' });
    await page.locator('[data-save-chart]').click();
    const confirmed = await nearbySaveConfirmation(page);
    check('self chart saves in one tap', await page.locator('[data-save-prompt]').count() === 0
      && await page.locator('[data-save-chart]').count() === 1);
    check('self chart keeps visible save confirmation beside the action dock', confirmed);
    check('one-tap confirmation receives connected focus', await confirmationHasFocus(page));
    const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PROFILE_KEY);
    check('one-tap save persists the auto-name', state.charts[0]?.name === 'Cancer Sun · 1907-07-06');
    await page.close();
  }

  // Persistence failures remain explicit and retryable.
  {
    const page = await preparedPage([]);
    await openChart(page, { subject: 'self' });
    await page.evaluate(() => {
      Storage.prototype.setItem = () => { throw new Error('blocked for test'); };
    });
    await page.locator('[data-save-chart]').click();
    const alert = page.getByRole('alert');
    await alert.waitFor();
    const blockedFocus = await saveButtonHasFocus(page);
    await page.waitForFunction(() => {
      const element = document.querySelector('.xplr__aside > [role="alert"]');
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.top >= 0 && rect.bottom <= window.innerHeight);
    });
    check('blocked storage surfaces a clear error',
      await alert.textContent() === "Couldn't save. Your browser may be blocking local storage."
      && await page.locator('.xplr__aside > [role="alert"]').count() === 1
      && await page.evaluate(() => {
        const element = document.querySelector('.xplr__aside > [role="alert"]');
        const rect = element?.getBoundingClientRect();
        return Boolean(rect && rect.top >= 0 && rect.bottom <= window.innerHeight);
      })
      && blockedFocus);
    await page.close();
  }

  // Reduced calculators keep the same storage-error feedback contract.
  {
    const page = await preparedPage([]);
    await page.goto(`${baseURL}/moon-sign/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const form = document.querySelector('.calc__form');
      const island = form?.closest('astro-island');
      return island ? !island.hasAttribute('ssr') : Boolean(form);
    }, null, { timeout: 30_000 });
    await page.locator('#birth-date').fill('1907-07-06');
    await page.locator('#birth-time').fill('08:30');
    await page.locator('#place').fill('Coyoacan');
    const option = page.locator('#place-list [role="option"]:not([aria-disabled="true"])').first();
    await option.waitFor({ state: 'visible', timeout: 30_000 });
    await option.click();
    await page.locator('.calc__form button[type="submit"]').click();
    await page.locator('.calc__result').waitFor({ timeout: 30_000 });
    await page.locator('[data-save-chart]').waitFor();
    await page.evaluate(() => {
      Storage.prototype.setItem = () => { throw new Error('blocked for test'); };
    });
    await page.locator('[data-save-chart]').click();
    const alert = page.locator('.calc__result > .calc__error[role="alert"]');
    await alert.waitFor();
    check('reduced chart keeps blocked-storage feedback',
      await alert.textContent() === "Couldn't save. Your browser may be blocking local storage."
      && await saveButtonHasFocus(page));
    await page.close();
  }

  // Link name outranks a matching saved name, and unchanged Enter is `link`.
  {
    const page = await preparedPage([savedChart('mom', 'Saved current name')]);
    await openChart(page, { name: 'Link Name' });
    await page.getByText('You’re reading Link Name’s chart. “You” below means Link Name.', { exact: true }).waitFor();
    const input = await openPrompt(page);
    check('naming prompt stays immediately beside the chart action dock',
      await page.locator('.xplr__aside > .calc__actions [data-save-prompt]').count() === 1);
    check('naming prompt replaces competing chart actions', await page.locator('[data-chart-action-dock]').evaluate(
      (dock) => getComputedStyle(dock).display === 'none',
    ));
    check('naming prompt is in the mobile viewport after the tap', await page.evaluate(() => {
      const prompt = document.querySelector('.xplr__aside > .calc__actions [data-save-prompt]');
      if (!prompt) return false;
      const rect = prompt.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    }));
    check('link name is the first-priority prefill', await input.inputValue() === 'Link Name');
    check('EN prompt label is byte-identical', await input.getAttribute('aria-label') === null
      && await page.locator('label[for="chart-save-name"]').textContent() === 'Whose chart is this?');
    check('EN Save and Skip are byte-identical', await page.getByRole('button', { name: 'Save', exact: true }).count() === 1
      && await page.getByRole('button', { name: 'Skip', exact: true }).count() === 1);
    check('name input reuses the codec cap', await input.getAttribute('maxlength') === '24');

    await page.keyboard.press('Escape');
    await page.locator('[data-save-prompt]').waitFor({ state: 'detached' });
    check('Escape collapses without saving and returns focus', await saveButtonHasFocus(page));
    check('Escape made no naming event', await page.evaluate(() =>
      window.__chartBookEvents.every((event) => event.name !== 'chart_name_set')));

    await openPrompt(page);
    await page.keyboard.press('Enter');
    check('commit replaces the prompt with nearby confirmation', await nearbySaveConfirmation(page)
      && await page.locator('[data-save-prompt]').count() === 0
      && await page.locator('[data-save-chart]').count() === 1);
    check('named-save confirmation receives connected focus', await confirmationHasFocus(page));
    const event = await page.evaluate(() =>
      window.__chartBookEvents.find((item) => item.name === 'chart_name_set'));
    check('unchanged link prefill tracks only via=link', event?.props?.via === 'link'
      && Object.keys(event.props).length === 1
      && !JSON.stringify(event).includes('Link Name'), JSON.stringify(event));
    check('link name explicitly replaces the matched label', await page.evaluate((key) =>
      JSON.parse(localStorage.getItem(key)).charts[0].name, PROFILE_KEY) === 'Link Name');
    await page.close();
  }

  // A dedupe match supplies the second-priority prefill and framing.
  {
    const page = await preparedPage([savedChart('mom', 'Mom')]);
    await openChart(page);
    await page.getByText('You’re reading Mom’s chart. “You” below means Mom.', { exact: true }).waitFor();
    const input = await openPrompt(page);
    check('dedupe-matched saved name is the second-priority prefill', await input.inputValue() === 'Mom');
    await input.fill('  Mama edited  ');
    await page.keyboard.press('Enter');
    check('edited prompt becomes nearby confirmation', await nearbySaveConfirmation(page));
    const event = await page.evaluate(() =>
      window.__chartBookEvents.find((item) => item.name === 'chart_name_set'));
    check('edited name tracks only via=prompt', event?.props?.via === 'prompt'
      && Object.keys(event.props).length === 1
      && !JSON.stringify(event).includes('Mama edited'), JSON.stringify(event));
    check('explicit prompt name is trimmed at commit', await page.evaluate((key) =>
      JSON.parse(localStorage.getItem(key)).charts[0].name, PROFILE_KEY) === 'Mama edited');
    await page.close();
  }

  // An older roster rename can exceed the share-link input cap. Accepting its
  // capped prefill unchanged must remain non-explicit and preserve the full
  // stored name instead of silently shortening it.
  {
    const longName = 'Alexandria Catherine Montgomery';
    const page = await preparedPage([savedChart('alexandria', longName)]);
    await openChart(page);
    const input = await openPrompt(page);
    check('legacy long match is visibly capped', await input.inputValue() === longName.slice(0, 24));
    await page.keyboard.press('Enter');
    await page.getByText('Saved · on this device', { exact: true }).waitFor();
    const storedName = await page.evaluate((key) =>
      JSON.parse(localStorage.getItem(key)).charts[0].name, PROFILE_KEY);
    check('unchanged capped match preserves the full roster rename', storedName === longName, storedName);
    const event = await page.evaluate(() =>
      window.__chartBookEvents.find((item) => item.name === 'chart_name_set'));
    check('unchanged matched name stays privacy-safe', event?.props?.via === 'prompt'
      && Object.keys(event.props).length === 1
      && !JSON.stringify(event).includes(longName), JSON.stringify(event));
    await page.close();
  }

  // With no link or match, the auto-name is third; it never frames a person.
  {
    const page = await preparedPage([], { width: 320, height: 780 });
    await openChart(page);
    check('auto-named chart has no person framing', await page.locator('[data-chart-person]').count() === 0);
    const input = await openPrompt(page);
    check('auto-name is the third-priority prefill', await input.inputValue() === 'Cancer Sun · 1907-07-06', await input.inputValue());
    check('320px prompt does not overflow', await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    check('Skip becomes nearby confirmation', await nearbySaveConfirmation(page));
    const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PROFILE_KEY);
    const event = await page.evaluate(() =>
      window.__chartBookEvents.find((item) => item.name === 'chart_name_set'));
    check('Skip stores the auto-name', state.charts[0]?.name === 'Cancer Sun · 1907-07-06');
    check('Skip tracks only via=skip', event?.props?.via === 'skip'
      && Object.keys(event.props).length === 1, JSON.stringify(event));
    check('saved auto-name still has no framing', await page.locator('[data-chart-person]').count() === 0);
    await page.close();
  }

  // A dedupe-matched auto-name remains a label, not a person.
  {
    const auto = 'Cancer Sun · 1907-07-06';
    const page = await preparedPage([savedChart('auto', auto)]);
    await openChart(page);
    const input = await openPrompt(page);
    check('dedupe-matched auto-name does not frame a person', await page.locator('[data-chart-person]').count() === 0);
    check('dedupe-matched auto-name still prefills as the auto-name', await input.inputValue() === auto);
    await page.keyboard.press('Escape');
    await page.close();
  }

  // The tour's Save CTA hands off to the prompt instead of leaving focus
  // behind the mobile sheet.
  {
    const page = await preparedPage([], { width: 390, height: 844 });
    await openChart(page);
    await page.locator('[data-first-reading-dismiss]').click();
    await page.locator('[data-first-reading-prompt]').waitFor({ state: 'detached' });
    await page.locator('[data-tour-start]').click();
    await page.locator('[data-tour-card]').waitFor({ timeout: 10_000 });
    await page.locator('[data-tour-dot]').last().click();
    await page.locator('[data-tour-card]').getByRole('button', { name: 'Save this chart', exact: true }).click();
    const input = page.getByLabel('Whose chart is this?', { exact: true });
    await input.waitFor();
    await page.waitForFunction(() => document.activeElement?.id === 'chart-save-name');
    check('tour Save exits the sheet before focusing the prompt',
      await page.locator('[data-tour-card]').count() === 0
      && await input.inputValue() === 'Cancer Sun · 1907-07-06');
    await page.keyboard.press('Escape');
    check('tour-prompt Escape returns focus to the main save button', await saveButtonHasFocus(page));

    await page.locator('[data-tour-start]').click();
    await page.locator('[data-tour-card]').waitFor({ timeout: 10_000 });
    await page.locator('[data-tour-dot]').last().click();
    await page.locator('[data-tour-card]').getByRole('button', { name: 'Save this chart', exact: true }).click();
    await page.getByLabel('Whose chart is this?', { exact: true }).press('Enter');
    await page.getByText('Saved · on this device', { exact: true }).waitFor();
    const chartSave = await page.evaluate(() =>
      window.__chartBookEvents.find((event) => event.name === 'chart_save'));
    const chartSaved = await page.evaluate(() =>
      window.__chartBookEvents.find((event) => event.name === 'chart_saved'));
    check('tour source survives the prompt handoff', chartSave?.props?.source === 'tour'
      && Object.keys(chartSave.props).length === 1, JSON.stringify(chartSave));
    check('successful save emits chart_saved after persistence', chartSaved?.props?.source === 'tour'
      && Object.keys(chartSaved.props).length === 1, JSON.stringify(chartSaved));
    await page.close();
  }

  // The real regression: roster → named link → non-explicit Skip keeps Mom.
  {
    const page = await preparedPage([savedChart('11111111-1111-4111-8111-111111111111', 'Mom')]);
    await page.goto(`${baseURL}/profile/`, { waitUntil: 'domcontentloaded' });
    await page.locator('.pf-list').waitFor();
    check('EN count line is byte-identical', await page.locator('.pf-count').textContent()
      === '1 chart saved.');
    check('EN profile privacy is byte-identical', await page.locator('.pf-privacy').textContent()
      === 'Saved on this device. Nothing is uploaded unless you turn sync on.');
    check('privacy renders under the chart list', await page.evaluate(() => {
      const list = document.querySelector('.pf-list');
      const privacy = document.querySelector('.pf-privacy');
      return Boolean(list && privacy && (list.compareDocumentPosition(privacy) & Node.DOCUMENT_POSITION_FOLLOWING));
    }));
    check('EN people CTA is byte-identical', await page.locator('.pf-foot .btn').textContent()
      === "Add someone's chart+");

    check('roster uses an opaque profile handoff', await page.getByRole('link', { name: 'Open', exact: true })
      .getAttribute('href') === '/birth-chart/#profileChartId=11111111-1111-4111-8111-111111111111');
    await page.getByRole('link', { name: 'Open', exact: true }).click();
    await page.locator('.calc__result').waitFor({ timeout: 30_000 });
    await page.getByText('You’re reading Mom’s chart. “You” below means Mom.', { exact: true }).waitFor();
    const input = await openPrompt(page);
    check('roster link carries Mom into the prompt', await input.inputValue() === 'Mom');
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    const nameAfterSkip = await page.evaluate((key) =>
      JSON.parse(localStorage.getItem(key)).charts[0].name, PROFILE_KEY);
    check('roster → save round-trip does not clobber Mom', nameAfterSkip === 'Mom', nameAfterSkip);
    check('round-trip Skip becomes nearby confirmation', await nearbySaveConfirmation(page));
    await page.close();
  }

  // Spanish module-local copy and framing stay exact.
  {
    const page = await preparedPage([savedChart('mama', 'Mamá')]);
    await page.goto(`${baseURL}/es/profile/`, { waitUntil: 'domcontentloaded' });
    await page.locator('.pf-list').waitFor();
    check('ES count line is byte-identical', await page.locator('.pf-count').textContent()
      === '1 carta guardada.');
    check('ES profile privacy is byte-identical', await page.locator('.pf-privacy').textContent()
      === 'Guardado en este dispositivo. No se sube nada salvo que actives la sincronización.');
    check('ES people CTA is byte-identical', await page.locator('.pf-foot .btn').textContent()
      === 'Añade la carta de alguien+');

    await openChart(page, { name: 'Mamá', locale: 'es' });
    await page.getByText('Estás leyendo la carta de Mamá. El “tú” de abajo se refiere a Mamá.', { exact: true }).waitFor();
    const input = await openPrompt(page);
    check('ES prompt label is byte-identical', await page.locator('label[for="chart-save-name"]').textContent()
      === '¿De quién es esta carta?');
    check('ES Save and Skip are byte-identical', await page.getByRole('button', { name: 'Guardar', exact: true }).count() === 1
      && await page.getByRole('button', { name: 'Omitir', exact: true }).count() === 1);
    await page.keyboard.press('Escape');
    check('ES Escape returns focus', await saveButtonHasFocus(page));
    await page.close();
  }

  // Forty is the new chart cap; the 41st distinct input remains rejected.
  {
    const full = Array.from({ length: 40 }, (_, index) => savedChart(
      `chart-${index}`,
      `Person ${index}`,
      { date: `1990-01-${String((index % 28) + 1).padStart(2, '0')}`, lat: -20 + index },
    ));
    const page = await preparedPage(full);
    await openChart(page);
    await openPrompt(page);
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    const capAlert = page.getByText('You can save up to 40 charts. Remove one first.', { exact: true });
    await capAlert.waitFor();
    const count = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).charts.length, PROFILE_KEY);
    check('41st chart triggers the new cap without growing storage', count === 40, String(count));
    check('41st-chart alert is beside the dock and in view', await page.locator('.xplr__aside > [role="alert"]').count() === 1
      && await capAlert.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      }));
    check('rejected 41st chart does not track a committed name', await page.evaluate(() =>
      window.__chartBookEvents.every((event) => event.name !== 'chart_name_set')));
    check('full-path commit returns focus', await saveButtonHasFocus(page));
    await page.close();
  }

  await context.close();
  await browser.close();
});

let failed = 0;
for (const result of results) {
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `  · ${result.detail}` : ''}`);
}
if (failed) {
  console.error(`\n${failed} CHECK(S) FAILED`);
  process.exit(1);
}
console.log(`\nALL ${results.length} CHECKS PASS`);
