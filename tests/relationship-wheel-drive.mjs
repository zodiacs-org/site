/**
 * End-to-end drive of the Relationship Wheel against `astro preview`:
 * seed two saved charts, compare, and exercise the bi-wheel — both rings
 * render, cross-chart chords draw, tapping a row focuses its chord, and
 * the swap button puts the other person inside. Also drives saved
 * comparisons: save, reload, one-tap restore, remove, inline-side
 * restore, orphan pruning, and the ES strip. Captures evidence shots.
 *
 *   npm run build
 *   OUT_DIR=/tmp/shots node tests/relationship-wheel-drive.mjs
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { startPreview } from './visual/preview-server.mjs';
import { setTimeout as wait } from 'node:timers/promises';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { driveLegacyPolarProfile } from './legacy-polar-profile-drive.mjs';
import { runCompositeBrowserChecks } from './composite-browser-checks.mjs';

const OUT = process.env.OUT_DIR ?? null;
const PORT = 4399;
const CURATED_SUN_MOON = 'One of you runs on purpose, the other on feeling, and here they agree — what one wants to do is what the other wants to come home to. This is the classic ease that makes a relationship feel inevitable in retrospect.';
const FALLBACK_NEPTUNE_URANUS = 'Frida’s imagination pushes against Diego’s independence — friction that forces growth or starts fights, depending on the week.';
const COMPOSITE_NOTE = "A composite chart is the midpoint of two charts — a portrait of the relationship itself rather than either person. Composite houses need a location convention we won't fake, so this chart is shown without houses.";
const COMMUNICATION_FIRE_FIRE = 'Two minds that think at speaking speed — conversation as sparring, fast and warm. Nobody finishes their sentences here; nobody minds.';
const COMMUNICATION_MERCURY_MERCURY = 'Your minds are running compatible operating systems — shorthand develops fast, and it lasts. You will never run out of conversation, only of evening.';
const COMMUNICATION_MOON_MERCURY = 'Analysis meets emotion mid-sentence: one wants the feeling named precisely, the other wants it felt first. Ask "solve or listen?" and this aspect behaves.';
const COMMUNICATION_NO_CONTACT = "Your Mercuries make no major contact — the tradition reads that as neutral, not bad: your minds neither collide nor complete each other by default, so your conversational style is built, not given. The sign pairing above is the material you're building with.";
const SAVED_MC = {
  'drive-frida': 53.32837167390386,
  'drive-diego': 16.9870696472928,
  'drive-trine': 89.93171672845051,
};

const chart = (id, name, date, time, lat, lon, tz, place) => ({
  id, name, createdAt: '2026-07-11T00:00:00Z', updatedAt: '2026-07-11T00:00:00Z',
  birth: { date, time, timeKnown: time !== null, place: { name: place, admin1: '', country: '', lat, lon, tz } },
  summary: {
    engineVersion: '0-stale',
    utcISO: `${date}T18:00:00Z`,
    houseSystem: 'whole',
    bodies: [],
    // Stale bodies deliberately exercise recomputation; stored MC is still
    // the saved-profile source used by the relationship wheel.
    angles: { asc: 0, mc: SAVED_MC[id] },
    flags: [],
  },
});
const profile = {
  version: 1, settings: { houseSystem: 'whole' },
  charts: [
    chart('drive-frida', 'Frida', '1907-07-06', '08:30', 19.35, -99.16, 'America/Mexico_City', 'Coyoacán'),
    chart('drive-diego', 'Diego', '1886-12-08', '20:00', 21.02, -101.26, 'America/Mexico_City', 'Guanajuato'),
    chart('drive-trine', 'Trine fixture', '1886-09-30', '05:23', 19.43, -99.13, 'America/Mexico_City', 'Mexico City'),
  ],
};

const preview = await startPreview({ port: PORT });
const BASE = preview.baseURL;
if (OUT) await mkdir(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); };
const shot = async (t, p, o = {}) => { if (OUT) await t.screenshot({ path: `${OUT}/${p}`, ...o }).catch(() => {}); };

try {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: STABLE_CHROMIUM_ARGS,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
  await page.addInitScript((prof) => {
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(prof));
    globalThis.__relationshipEvents = [];
    globalThis.zodiacsAnalytics = Object.freeze({
      track(name, props) { globalThis.__relationshipEvents.push({ name, props }); },
    });
  }, profile);
  await page.goto(`${BASE}/compatibility/`, { waitUntil: 'networkidle' });

  // Pick the two saved charts and compare.
  await page.locator('#syn-a-source').selectOption('drive-frida');
  await page.locator('#syn-b-source').selectOption('drive-diego');
  await page.locator('.calc__submit').click();
  await page.waitForSelector('.rwheel', { timeout: 20000 });
  await page.waitForSelector('.wheel__transit', { timeout: 15000 });

  check('both locally computed charts show their UTC math receipts',
    await page.locator('[data-check-our-math] time').count() === 2
      && await page.locator('[data-check-our-math] a').first().getAttribute('href') === '/methodology/');
  const openings = page.locator('[data-result-opening]');
  check('the comparison begins with a human sentence before placements',
    await openings.count() === 1 && await openings.isVisible());
  check('astrology tools share navigation while keeping collection branding out of their footer',
    await page.locator('[data-nav] a[href="/astrofolio/"]').count() === 1
      && !/Astrofolio/.test(await page.locator('.zfooter').allTextContents().then(parts => parts.join(' '))));

  // Both rings render: inner natal marks (South Node hidden ⇒ 11) and the
  // outer partner ring (11, Moon included, South Node hidden).
  const innerMarks = await page.locator('.wheel__body:not(.wheel__transit)').count();
  const outerMarks = await page.locator('.wheel__transit').count();
  check('inner wheel renders 11 natal bodies', innerMarks === 11, `${innerMarks}`);
  check('outer ring renders 11 partner bodies', outerMarks === 11, `${outerMarks}`);
  check('cross-chart chords draw', (await page.locator('[data-transit-aspect]').count()) > 0);
  check('caption names both people', /Frida/.test(await page.locator('.tring__caption').textContent() ?? '')
    && /Diego/.test(await page.locator('.tring__caption').textContent() ?? ''));
  check('Wheel, Grid, Composite, and In-3D tabs render with Wheel selected',
    (await page.getByRole('tab').count()) === 4
      && await page.locator('[data-relationship-tab="wheel"]').getAttribute('aria-selected') === 'true');
  check('an uncurated top contact keeps the role-composed fallback verbatim',
    (await page.locator('.syn__aspect-read[data-fallback-line]').first().textContent())?.trim() === FALLBACK_NEPTUNE_URANUS);
  const communication = page.locator('[data-communication-read]');
  check('communication read follows top contacts and precedes balances', await communication.evaluate((node) => {
    const siblings = [...(node.parentElement?.children ?? [])];
    const contacts = siblings.findIndex((sibling) => sibling.matches('.syn__aspects'));
    const current = siblings.indexOf(node);
    const balances = siblings.findIndex((sibling) => sibling.matches('.syn__balances'));
    return contacts >= 0 && contacts < current && current < balances;
  }));
  check('Frida and Diego pin the fire-fire Mercury pairing',
    await communication.getAttribute('data-mercury-elements') === 'fire-fire'
      && (await communication.locator('.rcomm__receipt').textContent())?.trim() === 'Mercury: Leo · Mercury: Sagittarius'
      && (await communication.locator('.rcomm__framing').textContent())?.trim() === COMMUNICATION_FIRE_FIRE);
  const communicationLines = await communication.locator('[data-communication-contact] .rcomm__contact-read').allTextContents();
  check('the full aspect set renders both curated Frida-Diego communication contacts',
    communicationLines.length === 2
      && communicationLines.map((line) => line.trim()).includes(COMMUNICATION_MERCURY_MERCURY)
      && communicationLines.map((line) => line.trim()).includes(COMMUNICATION_MOON_MERCURY));
  await page.locator('.tring__wheelbox').evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await wait(800);
  await shot(page, 'rwheel-both.png', { clip: { x: 0, y: 0, width: 1440, height: 1200 } });

  // Tap a contact row → focus block + chord focus.
  await page.locator('.tring__row').first().click();
  await wait(200);
  check('tapping a row opens the contact reading', await page.locator('.tring__focus').isVisible());
  check('the row is marked focused', (await page.locator('.tring__row.is-focus').count()) === 1);
  await shot(page, 'rwheel-focus.png', { clip: { x: 0, y: 0, width: 1440, height: 1200 } });

  // Swap who's inside: the caption inverts and focus clears.
  const capBefore = await page.locator('.tring__caption').textContent();
  await page.locator('[data-swap]').click();
  await wait(400);
  const capAfter = await page.locator('.tring__caption').textContent();
  check('swap inverts the rings', capBefore !== capAfter && /Diego/.test(capAfter ?? ''), capAfter?.slice(0, 60) ?? '');
  check('swap clears the focused contact', (await page.locator('.tring__row.is-focus').count()) === 0);
  check('rings still render after swap', (await page.locator('.wheel__transit').count()) === 11);
  await shot(page, 'rwheel-swapped.png', { clip: { x: 0, y: 0, width: 1440, height: 1200 } });

  // Accessible tabs + shared selection: choose a body contact in the grid,
  // return to the wheel, then repeat with an angle contact.
  await page.locator('[data-relationship-tab="wheel"]').focus();
  await page.keyboard.press('ArrowRight');
  check('tab arrow keys switch from Wheel to Grid',
    await page.locator('[data-relationship-tab="grid"]').getAttribute('aria-selected') === 'true');
  check('grid includes ten aspect bodies plus known ASC and MC on both axes',
    (await page.locator('.rgrid__table tbody tr').count()) === 12
      && (await page.locator('.rgrid__table thead th').count()) === 13);

  const bodyContact = page.locator('[data-grid-contact="Neptune-square-Uranus"]');
  await bodyContact.click();
  check('grid body-cell selection opens the fallback detail',
    (await page.locator('[data-grid-detail] [data-fallback-line]').textContent())?.trim() === FALLBACK_NEPTUNE_URANUS);
  await page.locator('[data-relationship-tab="wheel"]').click();
  check('grid body selection stays focused on the wheel tab',
    (await page.locator('.tring__row.is-focus').count()) === 1
      && await page.locator('[data-transit-aspect="Neptune-square-Uranus"]').evaluate((node) => node.parentElement?.getAttribute('opacity') === '1'));
  await page.locator('[data-relationship-tab="grid"]').click();
  check('body-cell selection survives a round trip across tabs',
    await bodyContact.getAttribute('aria-pressed') === 'true');

  const angleContact = page.locator('[data-grid-contact="MC-sextile-ASC"]');
  await angleContact.click();
  await page.locator('[data-relationship-tab="wheel"]').click();
  check('angle-cell selection layers one module-local focused chord',
    (await page.locator('[data-relationship-angle-aspect="MC-sextile-ASC"]').count()) === 1);

  await page.locator('[data-relationship-tab="composite"]').click();
  check('composite tab renders a static house-free wheel',
    (await page.locator('[data-composite-wheel] svg.wheel').count()) === 1
      && (await page.locator('[data-composite-wheel] .wheel__body').count()) === 11
      && (await page.locator('[data-composite-wheel] .wheel__house').count()) === 0);
  check('composite lists all 12 midpoint placements',
    (await page.locator('[data-composite-point]').count()) === 12);
  check('the English composite note is verbatim',
    (await page.locator('[data-composite-note]').textContent())?.trim() === COMPOSITE_NOTE);
  await page.locator('[data-relationship-tab="grid"]').click();
  await page.locator('[data-relationship-tab="composite"]').click();
  const relationshipEvents = await page.evaluate(() => globalThis.__relationshipEvents);
  check('grid selection analytics fires without props',
    relationshipEvents.filter((event) => event.name === 'grid_select').length === 2
      && relationshipEvents.filter((event) => event.name === 'grid_select').every((event) => Object.keys(event.props).length === 0));
  check('composite analytics fires once per compare without props',
    relationshipEvents.filter((event) => event.name === 'composite_view').length === 1
      && Object.keys(relationshipEvents.find((event) => event.name === 'composite_view')?.props ?? { unexpected: true }).length === 0);

  // The In-3D tab lazy-loads the sphere with both charts and their contacts.
  await page.locator('[data-relationship-tab="depth"]').click();
  await page.waitForSelector('[data-relationship-panel="depth"] figure.ev', { timeout: 20000 });
  check('depth tab renders both charts on the sphere',
    (await page.locator('[data-relationship-panel="depth"] .ev-body').count()) === 20
      && (await page.locator('[data-relationship-panel="depth"] .ev-body.is-partner').count()) === 10);
  check('depth tab draws cross-chart contacts through space',
    (await page.locator('[data-relationship-panel="depth"] .ev-inter line').count()) >= 1);
  check('depth tab keys both charts in the legend',
    (await page.locator('[data-relationship-panel="depth"] .ev-key-yours').count()) === 1
      && (await page.locator('[data-relationship-panel="depth"] .ev-key-theirs').count()) === 1);
  check('depth tab shows the tightest contact readout',
    /from exact/.test(await page.locator('[data-relationship-panel="depth"] .ev-readout').first().textContent() ?? ''));
  await shot(page, 'rwheel-depth.png', { clip: { x: 0, y: 0, width: 1440, height: 1400 } });
  await page.locator('[data-relationship-tab="wheel"]').click();

  // The invite + pairing blocks survive below the module.
  check('pairing CTA renders', (await page.locator('.syn__next-action .btn--ghost').count()) === 1);

  // Save the comparison → it persists and advances to a quiet receipt.
  await page.locator('[data-save-pair]').click();
  await page.waitForSelector('[data-pair-status]', { timeout: 3000 });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('zodiacs.pairs.v1') ?? '[]'));
  check('saving stores one pair of chart references', stored.length === 1
    && stored[0].a.kind === 'chart' && stored[0].b.kind === 'chart');
  check('save action advances to a completed state',
    (await page.locator('[data-save-pair]').count()) === 0
      && /Comparison saved/.test(await page.locator('[data-pair-status]').textContent() ?? '')
      && (await page.locator('[data-pair-status] a[href="/profile/"]').count()) === 1);
  await shot(page, 'rwheel-saved.png', { clip: { x: 0, y: 0, width: 1440, height: 1200 } });

  // Reload: the saved comparison offers itself back and restores on tap.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.syn__pair-restore', { timeout: 10000 });
  const chipText = await page.locator('.syn__pair-restore').first().textContent();
  check('saved strip lists the pair by name', /Frida × Diego/.test(chipText ?? ''), chipText ?? '');
  await shot(page, 'rwheel-strip.png');
  await page.locator('.syn__pair-restore').first().click();
  await page.waitForSelector('.rwheel', { timeout: 20000 });
  check('tapping the chip re-runs the comparison', (await page.locator('.wheel__transit').count()) === 11);

  // Remove: the chip goes away and storage empties.
  await page.locator('.syn__pair-remove').first().click();
  await wait(200);
  const afterRemove = await page.evaluate(() => JSON.parse(localStorage.getItem('zodiacs.pairs.v1') ?? '[]'));
  check('removing clears the strip', (await page.locator('.syn__pair').count()) === 0);
  check('removing empties storage', afterRemove.length === 0);
  await page.close();

  // Deterministic real-chart fixture whose Sun–Moon trine lands in the top 8.
  const curated = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await curated.addInitScript((prof) => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(prof)), profile);
  await curated.goto(`${BASE}/compatibility/`, { waitUntil: 'networkidle' });
  await curated.locator('#syn-a-source').selectOption('drive-frida');
  await curated.locator('#syn-b-source').selectOption('drive-trine');
  await curated.locator('.calc__submit').click();
  await curated.waitForSelector('.rwheel', { timeout: 20000 });
  const curatedTopLine = curated.locator('.syn__aspect-read[data-curated-line]').filter({ hasText: CURATED_SUN_MOON });
  check('known Sun–Moon trine shows the curated top-contact line verbatim',
    (await curatedTopLine.count()) === 1
      && (await curatedTopLine.textContent())?.trim() === CURATED_SUN_MOON);
  await curated.locator('[data-relationship-tab="grid"]').click();
  await curated.locator('[data-grid-contact="Sun-trine-Moon"]').click();
  check('known Sun–Moon trine shows the same curated grid detail verbatim',
    (await curated.locator('[data-grid-detail] [data-curated-line]').textContent())?.trim() === CURATED_SUN_MOON);
  await curated.close();

  // The existing Diego/Trine pair has no Mercury-to-Mercury/Moon/Mars
  // contact even though it has unrelated cross-chart aspects.
  const noContact = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await noContact.addInitScript((prof) => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(prof)), profile);
  await noContact.goto(`${BASE}/compatibility/`, { waitUntil: 'networkidle' });
  await noContact.locator('#syn-a-source').selectOption('drive-diego');
  await noContact.locator('#syn-b-source').selectOption('drive-trine');
  await noContact.locator('.calc__submit').click();
  await noContact.waitForSelector('[data-communication-read]', { timeout: 20000 });
  check('a pair with no qualifying Mercury contact shows the fallback verbatim',
    (await noContact.locator('[data-communication-no-contact]').textContent())?.trim() === COMMUNICATION_NO_CONTACT
      && (await noContact.locator('[data-communication-contact]').count()) === 0);
  await noContact.close();

  // An inline (by-value) side restores as a locked chip and still
  // compares; a pair referencing a missing chart prunes itself.
  const seededPairs = [
    {
      id: 'seeded', createdAt: '2026-07-11T00:00:00Z',
      a: { kind: 'chart', chartId: 'drive-frida', label: 'Frida' },
      b: {
        kind: 'input', label: 'Diego',
        input: {
          date: '1886-12-08', time: '20:00', timeKnown: true,
          lat: 21.02, lon: -101.26, tz: 'America/Mexico_City',
          name: 'Diego', place: 'Guanajuato', houseSystem: 'whole',
        },
      },
    },
    {
      id: 'orphan', createdAt: '2026-07-11T00:00:00Z',
      a: { kind: 'chart', chartId: 'drive-ghost', label: 'Ghost' },
      b: { kind: 'chart', chartId: 'drive-frida', label: 'Frida' },
    },
  ];
  const mixed = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await mixed.addInitScript((prof) => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(prof)), profile);
  await mixed.addInitScript((pairs) => localStorage.setItem('zodiacs.pairs.v1', JSON.stringify(pairs)), seededPairs);
  await mixed.goto(`${BASE}/compatibility/`, { waitUntil: 'networkidle' });
  await mixed.waitForSelector('.syn__pair-restore', { timeout: 10000 });
  await wait(400);
  const pruned = await mixed.evaluate(() => JSON.parse(localStorage.getItem('zodiacs.pairs.v1') ?? '[]'));
  check('a pair referencing a missing chart prunes itself', pruned.length === 1 && pruned[0].id === 'seeded');
  check('only the restorable pair is offered', (await mixed.locator('.syn__pair').count()) === 1);
  await mixed.locator('.syn__pair-restore').first().click();
  await mixed.waitForSelector('.rwheel', { timeout: 20000 });
  check('an inline side restores and compares', (await mixed.locator('.wheel__transit').count()) === 11);
  check('the inline side shows as a saved-comparison chip',
    /from a saved comparison/.test(await mixed.locator('#syn-b-linked').inputValue()));
  // The invite button arrives via the lazily imported CopyLink module, a beat
  // after the result module paints .rwheel — an instant count races it on
  // slower hardware, so this check waits like the other async assertions.
  const inviteAppears = await mixed.waitForSelector('[data-invite-link]', { timeout: 10000 })
    .then(() => true).catch(() => false);
  check('a restored own side still offers the invite', inviteAppears);
  await shot(mixed, 'rwheel-restored-inline.png', { clip: { x: 0, y: 0, width: 1440, height: 1200 } });
  await mixed.close();

  // ES: the strip renders translated.
  const es = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await es.addInitScript((prof) => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(prof)), profile);
  await es.addInitScript((pairs) => localStorage.setItem('zodiacs.pairs.v1', JSON.stringify(pairs)), [seededPairs[0]]);
  await es.goto(`${BASE}/es/compatibility/`, { waitUntil: 'networkidle' });
  await es.waitForSelector('.syn__pair-restore', { timeout: 10000 });
  check('ES strip renders translated', /Comparaciones guardadas/.test(await es.locator('.syn__pairs').textContent() ?? ''));
  await es.locator('#syn-a-source').selectOption('drive-frida');
  await es.locator('#syn-b-source').selectOption('drive-diego');
  await es.locator('.calc__submit').click();
  await es.waitForSelector('.rwheel', { timeout: 20000 });
  check('ES keeps the localized Mercury receipt and suppresses all English communication narrative',
    (await es.locator('[data-communication-read] .rcomm__receipt').textContent())?.trim() === 'Mercurio: Leo · Mercurio: Sagitario'
      && (await es.locator('[data-communication-read] .rcomm__title, [data-communication-read] .rcomm__intro, [data-communication-read] .rcomm__framing, [data-communication-read] [data-communication-contact], [data-communication-read] [data-communication-no-contact]').count()) === 0
      && !(await es.locator('body').textContent() ?? '').includes(COMMUNICATION_FIRE_FIRE));
  await es.locator('[data-relationship-tab="grid"]').click();
  await es.locator('[data-grid-contact]').first().click();
  check('ES grid keeps receipts but suppresses English narrative',
    (await es.locator('[data-grid-contact]').count()) > 0
      && (await es.locator('[data-grid-detail] .tring__focus-read').count()) === 0
      && !(await es.locator('body').textContent() ?? '').includes(CURATED_SUN_MOON));
  check('ES relationship tabs use module-local Spanish chrome',
    /Rueda/.test(await es.locator('[data-relationship-tab="wheel"]').textContent() ?? '')
      && /Cuadrícula/.test(await es.locator('[data-relationship-tab="grid"]').textContent() ?? '')
      && /Compuesta/.test(await es.locator('[data-relationship-tab="composite"]').textContent() ?? ''));
  await es.locator('[data-relationship-tab="composite"]').click();
  check('ES composite shows localized receipts without the English note',
    /Posiciones de la carta compuesta/.test(await es.locator('[data-composite-panel]').textContent() ?? '')
      && !(await es.locator('[data-composite-panel]').textContent() ?? '').includes(COMPOSITE_NOTE));
  await es.close();

  // Profile page: saved comparisons live beside saved charts; the chip
  // deep-links to /compatibility/?pair= which restores and compares.
  const pf = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await pf.addInitScript((prof) => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(prof)), profile);
  await pf.addInitScript((pairs) => localStorage.setItem('zodiacs.pairs.v1', JSON.stringify(pairs)), [seededPairs[0]]);
  await pf.goto(`${BASE}/profile/`, { waitUntil: 'networkidle' });
  await pf.waitForSelector('.pf-pairs .syn__pair-restore', { timeout: 10000 });
  check('profile lists the saved comparison', /Frida × Diego/.test(await pf.locator('.pf-pairs').textContent() ?? ''));
  await shot(pf, 'pf-pairs.png');
  await pf.locator('.pf-pairs .syn__pair-restore').first().click();
  await pf.waitForURL(/compatibility\/\?pair=/, { timeout: 10000 });
  await pf.waitForSelector('.rwheel', { timeout: 20000 });
  check('profile chip deep-links into a live comparison', (await pf.locator('.wheel__transit').count()) === 11);
  await pf.close();

  // Removing from the profile page empties storage.
  const pf2 = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await pf2.addInitScript((prof) => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(prof)), profile);
  await pf2.addInitScript((pairs) => localStorage.setItem('zodiacs.pairs.v1', JSON.stringify(pairs)), [seededPairs[0]]);
  await pf2.goto(`${BASE}/profile/`, { waitUntil: 'networkidle' });
  await pf2.waitForSelector('.pf-pairs .syn__pair-remove', { timeout: 10000 });
  await pf2.locator('.pf-pairs .syn__pair-remove').first().click();
  await wait(200);
  const pfAfter = await pf2.evaluate(() => JSON.parse(localStorage.getItem('zodiacs.pairs.v1') ?? '[]'));
  check('removing from profile clears the pair', pfAfter.length === 0 && (await pf2.locator('.pf-pairs').count()) === 0);
  await pf2.close();

  // Mobile sanity — with a saved pair of hostile-length names (renamed
  // charts have no length cap; the chips must ellipsize, not overflow).
  const longProfile = JSON.parse(JSON.stringify(profile));
  longProfile.charts[0].name = 'Frida Kahlo de Rivera, painter of Coyoacán and La Casa Azul';
  const mob = await browser.newPage({ viewport: { width: 320, height: 900 }, deviceScaleFactor: 2, hasTouch: true });
  await mob.addInitScript((prof) => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(prof)), longProfile);
  await mob.addInitScript((pairs) => localStorage.setItem('zodiacs.pairs.v1', JSON.stringify(pairs)), [
    {
      id: 'long', createdAt: '2026-07-11T00:00:00Z',
      a: { kind: 'chart', chartId: 'drive-frida', label: 'Frida' },
      b: { kind: 'chart', chartId: 'drive-diego', label: 'Diego' },
    },
  ]);
  await mob.goto(`${BASE}/compatibility/`, { waitUntil: 'networkidle' });
  await mob.waitForSelector('.syn__pair-restore', { timeout: 10000 });
  const overflow = await mob.evaluate(() => ({
    doc: document.documentElement.scrollWidth, win: window.innerWidth,
  }));
  check('long-name chip never overflows a 320px screen', overflow.doc <= overflow.win, `${overflow.doc} vs ${overflow.win}`);
  await shot(mob, 'rwheel-mobile-longname.png');
  await mob.locator('#syn-a-source').selectOption('drive-frida');
  await mob.locator('#syn-b-source').selectOption('drive-diego');
  await mob.locator('.calc__submit').click();
  await mob.waitForSelector('.rwheel', { timeout: 20000 });
  check('mobile: bi-wheel renders', (await mob.locator('.wheel__transit').count()) === 11);
  const mobileCommunication = await mob.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }));
  check('communication block does not overflow a 320px screen',
    mobileCommunication.doc <= mobileCommunication.win,
    `${mobileCommunication.doc} vs ${mobileCommunication.win}`);
  await mob.locator('[data-relationship-tab="grid"]').click();
  await mob.waitForFunction(() => {
    const grid = document.querySelector('.rgrid__scroll');
    return grid && getComputedStyle(grid).overflowX === 'auto';
  });
  await wait(100);
  const mobileGrid = await mob.locator('.rgrid__scroll').evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    docWidth: document.documentElement.scrollWidth,
    winWidth: window.innerWidth,
  }));
  check('320px grid scrolls inside itself without page overflow',
    mobileGrid.scrollWidth > mobileGrid.clientWidth && mobileGrid.docWidth <= mobileGrid.winWidth,
    JSON.stringify(mobileGrid));
  await shot(mob, 'rwheel-mobile.png');
  await mob.close();

  await driveLegacyPolarProfile({ browser, baseURL: BASE, check, outDir: OUT });
  await runCompositeBrowserChecks({ browser, baseURL: BASE, check, outDir: OUT, profile });
  await browser.close();
} finally {
  await preview.stop();
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  · ${r.detail.slice(0, 90)}` : ''}`);
}
console.log(failed ? `\n${failed} FAILURES` : '\nALL PASS');
process.exit(failed ? 1 : 0);
