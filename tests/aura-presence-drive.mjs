import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import { CABINET_CAPTURE_SCALE, CABINET_EXPORT_WIDTH } from '../src/lib/aura-cabinet-card-capture.ts';

// The card's own geometry, read from the renderer so the gate cannot drift.
const CARD_EXPORT_WIDTH = CABINET_EXPORT_WIDTH;
const CARD_DENSITY = CABINET_CAPTURE_SCALE;

const fixedNow = '2026-07-16T12:00:00.000Z';
const checkedAt = '2026-07-16T11:58:00.000Z';
const address = '11111111111111111111111111111111';
const expectedHoldings = [
  { sign: 'cancer', finish: 'pastel' },
  { sign: 'leo', finish: 'bronze' },
  { sign: 'scorpio', finish: 'silver' },
  { sign: 'aquarius', finish: 'gold', goldCount: '3' },
];
const expectedSampleHoldings = [
  { sign: 'aries', finish: 'gold', goldCount: '12' },
  ...expectedHoldings,
];
const expectedHeldSigns = expectedHoldings.map(({ sign }) => sign);
// A true v2 record: gold carries no count and migrates to one Masterwork.
const restoredAura = {
  version: 2,
  address,
  chain: 'solana',
  holdings: expectedHoldings.map(({ sign, finish }) => ({ sign, finish })),
  checkedAt,
  savedAt: '2026-07-16T11:59:00.000Z',
  expiresAt: '2026-07-17T11:59:00.000Z',
  chartId: 'aura-presence-fixture',
};
const profile = {
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [{
    id: 'aura-presence-fixture',
    name: 'Private fixture name',
    createdAt: fixedNow,
    updatedAt: fixedNow,
    birth: { date: '1994-05-02', time: '12:00', timeKnown: true, place: null },
    summary: {
      engineVersion: 'fixture',
      utcISO: '1994-05-02T12:00:00.000Z',
      houseSystem: 'whole',
      bodies: [
        { body: 'Sun', lon: 42, retrograde: false },
        { body: 'Moon', lon: 105, retrograde: false },
        { body: 'Mercury', lon: 100, retrograde: false },
        { body: 'Venus', lon: 102, retrograde: false },
        { body: 'Mars', lon: 132, retrograde: false },
      ],
      angles: { asc: 190, mc: 100 },
      flags: [],
    },
  }],
};

// The owner's voice law plus the cabinet's own bans: planner register never
// ships, absence is never shouted, and the count grammar never goes metric.
const BANNED_PAGE_TEXT = [
  /illustrative/i,
  /the short version/i,
  /without the jargon/i,
  /new to crypto/i,
  /two-minute/i,
  /built into this page/i,
  /NOT REPRESENTED/,
  /×[\d.]+[KMBT]/,
  // System vocabulary stays internal; the page speaks plain collector English.
  /masterwork/i,
  /accession/i,
  /hallmark/i,
  /deterministic/i,
  /\bniches?\b/i,
  // The product is the Cabinet of Twelve; "aura" stays internal.
  /\baura\b/i,
];

function normalized(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function waitForSettledMotion(locator) {
  await locator.evaluate(async (node) => {
    const animations = node
      .getAnimations({ subtree: true })
      .filter((animation) => (
        (animation.playState === 'pending' || animation.playState === 'running')
        && animation.effect?.getTiming().iterations !== Infinity
      ));
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function installState(context, storedProfile = profile, storedAura = null) {
  await context.addInitScript(({ storedProfile, storedAura, now }) => {
    if (storedProfile) {
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify(storedProfile));
    }
    if (storedAura) {
      sessionStorage.setItem('zodiacs.aura.session.v2', JSON.stringify(storedAura));
    }
    const NativeDate = Date;
    const fixed = new NativeDate(now).valueOf();
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    globalThis.Date = FixedDate;
    globalThis.__auraPaintedText = [];
    const nativeFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function captureAuraText(text, ...args) {
      globalThis.__auraPaintedText.push(String(text));
      return nativeFillText.call(this, text, ...args);
    };
    // The cabinet card rasters an SVG capture of the live case; record every
    // SVG image source so the drive can inspect the flattened document.
    globalThis.__auraCabinetSvg = [];
    const nativeImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      enumerable: nativeImageSrc.enumerable,
      get: nativeImageSrc.get,
      set(value) {
        if (typeof value === 'string' && value.startsWith('data:image/svg+xml')) {
          globalThis.__auraCabinetSvg.push(value);
        }
        return nativeImageSrc.set.call(this, value);
      },
    });
  }, { storedProfile, storedAura, now: fixedNow });
}

async function talismanGeometry(page) {
  return page.locator('.aura-result [data-aura-talisman]').evaluate((talisman) => {
    const svg = talisman.querySelector('.aura-talisman__svg');
    const segments = Array.from(talisman.querySelectorAll('.aura-talisman__segments line'))
      .map((line) => ['x1', 'y1', 'x2', 'y2'].map((key) => line.getAttribute(key)).join(':'));
    const represented = Array.from(
      talisman.querySelectorAll('[data-aura-talisman-represented="true"]'),
    ).map((node) => node.getAttribute('data-aura-talisman-node'));
    return {
      mode: svg?.getAttribute('data-aura-talisman-mode'),
      full: svg?.getAttribute('data-aura-talisman-full'),
      segmentCount: talisman
        .querySelector('.aura-talisman__segments')
        ?.getAttribute('data-aura-talisman-segment-count'),
      segments,
      represented,
      skyMarks: talisman.querySelectorAll('[data-aura-talisman-sky]').length,
    };
  });
}

async function installCabinetStageRecorder(page) {
  await page.evaluate(() => {
    globalThis.__auraCabinetStageObserver?.disconnect();
    globalThis.__auraCabinetStages = [];
    let lastStage = '';
    let queued = false;
    const capture = () => {
      queued = false;
      const cabinet = document.querySelector('.aura-stage .aura-collection-cabinet');
      const stage = cabinet?.getAttribute('data-aura-cabinet-stage') || '';
      if (!cabinet || !stage || stage === lastStage) return;
      lastStage = stage;
      const materials = Object.fromEntries(
        Array.from(cabinet.querySelectorAll('[data-aura-cabinet-represented="true"]'))
          .map((item) => {
            // The pastel disc legitimately stays current beneath a struck rim;
            // the topmost current layer names the displayed edition.
            const layers = item.querySelectorAll('.aura-collection-cabinet__material.is-current');
            return [
              item.getAttribute('data-aura-cabinet-sign'),
              layers.length
                ? layers[layers.length - 1].getAttribute('data-aura-cabinet-material')
                : null,
            ];
          }),
      );
      globalThis.__auraCabinetStages.push({ stage, materials });
    };
    const scheduleCapture = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(capture);
    };
    const observer = new MutationObserver(scheduleCapture);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-aura-cabinet-stage', 'class'],
    });
    globalThis.__auraCabinetStageObserver = observer;
    scheduleCapture();
  });
}

async function recordedCabinetStages(page) {
  return page.evaluate(() => globalThis.__auraCabinetStages || []);
}

function stageCabinet(page) {
  return page.locator('.aura-stage .aura-collection-cabinet');
}

async function waitForStageSettled(page) {
  const cabinet = stageCabinet(page);
  await cabinet.waitFor();
  await page.waitForFunction(() => (
    document.querySelector('.aura-stage .aura-collection-cabinet')
      ?.getAttribute('data-aura-cabinet-stage') === 'settled'
  ));
  await waitForSettledMotion(cabinet);
  return cabinet;
}

async function waitForStageRevealStart(page) {
  // The stage remounts on a fresh accession; wait until the new cabinet has
  // actually left "settled" so the settled-wait below cannot pass on the
  // previous cabinet.
  await page.waitForFunction(() => (
    document.querySelector('.aura-stage .aura-collection-cabinet')
      ?.getAttribute('data-aura-cabinet-stage') !== 'settled'
  ));
}

async function waitForStageKicker(page, expected) {
  await page.waitForFunction((text) => (
    document.querySelector('.aura-stage .aura-collection-cabinet__kicker')
      ?.textContent?.trim() === text
  ), expected);
}

function assertUpgradeSequence(stages, label, expected = expectedHoldings) {
  const names = stages.map(({ stage }) => stage);
  let cursor = -1;
  for (const expected of ['light', 'pastel', 'bronze', 'silver', 'gold', 'strike', 'settled']) {
    const next = names.indexOf(expected, cursor + 1);
    assert.ok(next > cursor, `${label} should progress through ${expected}: ${names.join(' -> ')}`);
    cursor = next;
  }

  const materialOrder = ['pastel', 'bronze', 'silver', 'gold'];
  const expectedAtStage = Object.fromEntries(
    [...materialOrder, 'settled'].map((stage) => {
      const stageRank = stage === 'settled'
        ? materialOrder.length - 1
        : materialOrder.indexOf(stage);
      return [stage, Object.fromEntries(expected.map(({ sign, finish }) => {
        const finishRank = materialOrder.indexOf(finish);
        return [sign, materialOrder[Math.min(stageRank, finishRank)]];
      }))];
    }),
  );
  for (const [stage, expectedMaterials] of Object.entries(expectedAtStage)) {
    assert.deepEqual(
      stages.findLast((entry) => entry.stage === stage)?.materials,
      expectedMaterials,
      `${label} should show the correct material editions at ${stage}`,
    );
  }
}

async function assertSettledEditions(cabinet, label, expected = expectedHoldings) {
  assert.equal(await cabinet.getAttribute('data-aura-cabinet-stage'), 'settled');
  const observed = await cabinet.locator('[data-aura-cabinet-finish]').evaluateAll((items) => (
    items.map((item) => {
      const layers = item.querySelectorAll('.aura-collection-cabinet__material.is-current');
      return {
        sign: item.getAttribute('data-aura-cabinet-sign'),
        finish: item.getAttribute('data-aura-cabinet-finish'),
        current: layers.length
          ? layers[layers.length - 1].getAttribute('data-aura-cabinet-material')
          : null,
      };
    })
  ));
  assert.deepEqual(
    observed,
    expected.map(({ sign, finish }) => ({ sign, finish, current: finish })),
    `${label} should settle every represented sign at its verified edition`,
  );
}

async function assertCabinetCraft(cabinet, label) {
  const violations = await cabinet.locator('[data-aura-cabinet-sign]').evaluateAll((items) => (
    items.flatMap((item) => {
      const niche = item.querySelector('.aura-collection-cabinet__niche');
      const object = item.querySelector('.aura-collection-cabinet__object');
      const name = item.querySelector('.aura-collection-cabinet__name');
      if (!niche || !object || !name) return ['missing niche, object stage, or name'];
      const problems = [];
      const nicheRect = niche.getBoundingClientRect();
      const objectRect = object.getBoundingClientRect();
      const tolerance = 0.75;
      if (
        objectRect.left < nicheRect.left - tolerance
        || objectRect.right > nicheRect.right + tolerance
        || objectRect.top < nicheRect.top - tolerance
        || objectRect.bottom > nicheRect.bottom + tolerance
      ) {
        problems.push('object escapes its niche');
      }
      if (getComputedStyle(niche).overflow !== 'hidden') {
        problems.push('niche does not clip');
      }
      // A museum label never truncates the name of the work.
      if (name.scrollWidth > name.clientWidth + 1) {
        problems.push(`name truncates (${name.textContent})`);
      }
      return problems.length
        ? [`${item.getAttribute('data-aura-cabinet-sign')}: ${problems.join(', ')}`]
        : [];
    })
  ));
  assert.deepEqual(violations, [], `${label} must keep artwork clipped and names whole`);
}

async function assertHouseVoice(page, label) {
  const text = await page.locator('.aura-page').innerText();
  for (const banned of BANNED_PAGE_TEXT) {
    assert.doesNotMatch(text, banned, `${label} must not ship the banned register ${banned}`);
  }
}

async function verifyNoJavaScriptSample(browser, baseURL) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/registry/collection/`, { waitUntil: 'domcontentloaded' });

  assert.equal(
    normalized(await page.locator('.aura-page__hero .kicker').innerText()).toLowerCase(),
    'astrofolio',
  );
  assert.equal(
    normalized(await page.locator('h1').innerText()),
    'See your Zodiac collection.',
  );
  // The address box server-renders inside the hero band, consumer-labelled.
  assert.equal(await page.locator('#aura-address').count(), 1);
  assert.equal(
    normalized(await page.locator('label[for="aura-address"]').innerText()),
    'Wallet address',
  );

  // The stage server-renders the curator's sample: no JavaScript, full case.
  const cabinet = stageCabinet(page);
  assert.equal(await cabinet.locator('[data-aura-cabinet-sign]').count(), 12);
  assert.equal(await cabinet.locator('[data-aura-cabinet-represented="true"]').count(), 5);
  assert.equal(await cabinet.locator('[data-zodiac-medallion]').count(), 5);
  assert.equal(await cabinet.locator('.aura-collection-cabinet__reserved-mark').count(), 7);
  assert.equal(
    normalized(await cabinet.locator('.aura-collection-cabinet__kicker').first().innerText()).toLowerCase(),
    'curator’s sample',
  );
  await assertSettledEditions(cabinet, 'the static sample stage', expectedSampleHoldings);
  await assertCabinetCraft(cabinet, 'the 390px static sample stage');
  assert.equal(
    normalized(await page.locator('.aura-desk .aura-desk-details > summary').innerText()),
    'Wallet, storage, and method',
  );
  await assertHouseVoice(page, 'the no-JavaScript page');
  await context.close();
}

async function verifySampleAndLiveCollection(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await installState(context);
  const page = await context.newPage();
  const browserErrors = [];
  const productFailures = [];
  const failedResources = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`);
  });
  let lookups = 0;
  let requestKeys = [];
  await page.route('**/api/aura-holdings', async (route) => {
    lookups += 1;
    const body = JSON.parse(route.request().postData() || '{}');
    requestKeys = Object.keys(body).sort();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        chain: 'solana',
        heldSigns: expectedHeldSigns,
        holdings: expectedHoldings,
        checkedAt,
      }),
    });
  });

  await page.goto(`${baseURL}/registry/collection/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve('/tmp', 'zodiacs-registry-aura-cabinet-top.png') });
  assert.equal(await stageCabinet(page).locator('[data-aura-cabinet-sign]').count(), 12);
  // The sample opens on its principal work: Crown Gold, not the first pastel
  // in zodiac order.
  assert.equal(
    await page.locator('.aura-stage [data-aura-cabinet-placard]').getAttribute('data-aura-cabinet-placard'),
    'aries',
  );

  await installCabinetStageRecorder(page);
  await page.locator('#aura-primer-example').click();
  await waitForStageRevealStart(page);
  await waitForStageKicker(page, 'Curator’s sample');
  const sampleCabinet = await waitForStageSettled(page);
  assertUpgradeSequence(
    await recordedCabinetStages(page),
    'the explicitly opened sample',
    expectedSampleHoldings,
  );
  await assertSettledEditions(sampleCabinet, 'the explicitly opened sample', expectedSampleHoldings);
  await assertCabinetCraft(sampleCabinet, 'the 390px opened sample');
  assert.equal(await page.locator('.aura-result__room--talisman [data-aura-talisman]').count(), 1);
  assert.match(
    normalized(await page.locator('.aura-result__room--talisman').innerText()),
    /The sample’s dated seal\./,
  );
  assert.equal(await page.locator('.aura-result__room--provenance [data-aura-ledger-sign]').count(), 5);
  assert.match(
    normalized(await page.locator('.aura-result__room--provenance').innerText()),
    /Curator’s sample — no address was looked up/,
  );
  assert.ok(
    await page.locator('.aura-result__room--talisman [data-aura-talisman-chart-echo]').count() > 0,
    'the finished sample should demonstrate the optional private echo layer',
  );
  assert.equal(await page.getByRole('button', { name: 'Share the dated seal' }).count(), 0);
  await assertHouseVoice(page, 'the opened sample');

  await page.getByRole('button', { name: 'Open my collection' }).click();
  await page.waitForFunction(() => (
    document.querySelector('#aura-status')?.textContent?.includes('Sample closed.')
  ));

  await installCabinetStageRecorder(page);
  await page.locator('#aura-address').fill(address);
  await page.getByRole('button', { name: 'Show my collection', exact: true }).click();
  await waitForStageRevealStart(page);
  await waitForStageKicker(page, 'Collection opened');
  const liveCabinet = await waitForStageSettled(page);
  assert.equal(lookups, 1);
  assert.deepEqual(requestKeys, ['address'], 'the holdings request may contain only the public address');
  assertUpgradeSequence(await recordedCabinetStages(page), 'a fresh public-address lookup');
  await assertSettledEditions(liveCabinet, 'a fresh public-address lookup');
  await assertCabinetCraft(liveCabinet, 'the 390px live cabinet');
  assert.match(
    normalized(await page.locator('#aura-status').innerText()),
    /4 official Zodiacs were found\./,
  );

  const talisman = page.locator('.aura-result__room--talisman');
  const provenance = page.locator('.aura-result__room--provenance');
  assert.equal(await talisman.locator('[data-aura-talisman]').count(), 1);
  assert.match(
    normalized(await talisman.innerText()),
    /The collection’s dated seal\./,
  );
  assert.equal(await provenance.locator('[data-aura-ledger-sign]').count(), 4);
  assert.match(normalized(await provenance.innerText()), /8 places remain reserved\./);
  assert.match(normalized(await provenance.innerText()), /Solana · checked July 16, 2026/);
  // The record keeps the exact edition count visible.
  assert.match(normalized(await provenance.innerText()), /×3 editions/i);

  await waitForSettledMotion(page.locator('.aura-result'));

  const geometryBeforeSelection = await talismanGeometry(page);
  assert.deepEqual(geometryBeforeSelection, {
    mode: 'polygon',
    full: 'false',
    segmentCount: '4',
    segments: geometryBeforeSelection.segments,
    represented: expectedHeldSigns,
    skyMarks: 2,
  });
  assert.equal(geometryBeforeSelection.segments.length, 4);

  await stageCabinet(page).locator('[data-aura-cabinet-sign="leo"] button').click();
  await page.waitForFunction(() => (
    document.querySelector('.aura-stage [data-aura-cabinet-placard]')
      ?.getAttribute('data-aura-cabinet-placard') === 'leo'
  ));
  const placard = page.locator('.aura-stage [data-aura-cabinet-placard="leo"]');
  assert.match(await placard.innerText(), /Catalogue\s+Nº 05 \/ XII/i);
  assert.match(await placard.innerText(), /Bronze Edition/);
  assert.match(await placard.innerText(), /From 10,000 held/i);
  assert.match(await placard.innerText(), /set in a cast bronze rim and sealed II/);
  assert.match(await placard.innerText(), /Recorded July 16, 2026 UTC · Solana/);
  assert.deepEqual(
    await talismanGeometry(page),
    geometryBeforeSelection,
    'cabinet selection may update emphasis, but not the deterministic public seal',
  );

  const chartSelect = page.locator('#aura-result-chart');
  await chartSelect.selectOption(profile.charts[0].id);
  await page.getByText(/chart echo was added/i).waitFor();
  assert.equal(lookups, 1, 'adding a local chart must not re-query the public address');
  assert.ok(
    await talisman.locator('[data-aura-talisman-chart-echo]').count() > 0,
    'the saved chart should add private inner echo marks',
  );
  assert.match(await page.locator('.aura-result__chart-control').innerText(), /Private fixture name adds the inner echo marks/i);
  assert.equal(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem('zodiacs.aura.session.v3') || 'null')?.chartId),
    profile.charts[0].id,
    'the stored session should retain the optional chart choice',
  );
  assert.deepEqual(
    await page.evaluate(() => {
      const record = JSON.parse(sessionStorage.getItem('zodiacs.aura.session.v3') || 'null');
      return record && {
        version: record.version,
        holdings: record.holdings,
        hasHeldSigns: Object.hasOwn(record, 'heldSigns'),
        hasAmounts: Object.keys(record).some((key) => /amount|balance|quantity/i.test(key)),
      };
    }),
    { version: 3, holdings: expectedHoldings, hasHeldSigns: false, hasAmounts: false },
    'v3 persistence should retain only the classified material editions',
  );
  assert.deepEqual(
    await talismanGeometry(page),
    geometryBeforeSelection,
    'the private chart layer must not change public collection geometry',
  );
  await page.screenshot({ path: resolve('/tmp', 'zodiacs-registry-aura-gallery-result.png') });

  const shareSection = page.locator('[data-aura-share-disclosure]');
  await shareSection.scrollIntoViewIfNeeded();
  assert.match(
    normalized(await shareSection.innerText()),
    /never the address/i,
  );
  await page.evaluate(() => { globalThis.__auraPaintedText = []; });
  const saveButton = shareSection.getByRole('button', { name: 'Share the dated seal', exact: true });
  await saveButton.waitFor({ state: 'visible' });
  assert.equal(await saveButton.isEnabled(), true);
  await saveButton.click();
  await page.locator('.aura-share-preview').waitFor();
  const painted = await page.evaluate(() => globalThis.__auraPaintedText);
  const paintedText = painted.join(' ');
  const paintedLower = paintedText.toLowerCase();
  for (const expected of [
    'collection seal',
    'the cabinet of twelve',
    'cancer',
    'leo',
    'scorpio',
    'aquarius',
  ]) {
    assert.equal(paintedLower.includes(expected), true, `share image should include ${expected}`);
  }
  assert.equal(paintedLower.includes('×3'), true, 'share image should carry the capped count grammar');
  for (const forbidden of [address, profile.charts[0].name, profile.charts[0].birth.date]) {
    assert.equal(paintedText.includes(forbidden), false, `share image must omit ${forbidden}`);
  }

  // The cabinet card is a capture of the live case. Drive it on the 390px
  // viewport and verify the drawn chrome, the flattened capture document —
  // fixed portrait three-column layout, base resets intact, settled state,
  // no page placard, no surviving media condition — and the exported size.
  await page.evaluate(() => { globalThis.__auraPaintedText = []; });
  const cabinetShareButton = page.getByRole('button', { name: 'Share this cabinet', exact: true });
  await cabinetShareButton.scrollIntoViewIfNeeded();
  await cabinetShareButton.click();
  const cabinetPreviewImage = page.locator('.aura-stage .aura-share-preview img');
  await cabinetPreviewImage.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('.aura-stage .aura-share-preview img');
    return image !== null && image.naturalWidth > 0;
  });
  const cabinetPainted = (await page.evaluate(() => globalThis.__auraPaintedText)).join(' ');
  const cabinetPaintedLower = cabinetPainted.toLowerCase();
  for (const expected of [
    'collection display',
    'the cabinet of twelve',
    '4 of the twelve',
    'solana · jul 16, 2026 utc',
    'editions read from the public record',
    // The brand lockup (DESIGN.md, "Brand Lockup"), painted as ZODIACS, the dot and ORG.
    'zodiacs · org',
  ]) {
    assert.equal(
      cabinetPaintedLower.includes(expected),
      true,
      `cabinet card chrome should include ${expected}`,
    );
  }
  assert.equal(cabinetPainted.includes('Zodiacs.org'), false, 'cabinet card must not paint the earlier sentence-case wordmark');
  for (const forbidden of [address, profile.charts[0].name, profile.charts[0].birth.date]) {
    assert.equal(cabinetPainted.includes(forbidden), false, `cabinet card must omit ${forbidden}`);
  }
  const capturedSvg = await page.evaluate(() => {
    const entries = globalThis.__auraCabinetSvg || [];
    return entries.length ? decodeURIComponent(entries[entries.length - 1]) : null;
  });
  assert.notEqual(capturedSvg, null, 'the cabinet card should raster an SVG capture');
  assert.match(
    capturedSvg,
    /repeat\(3,\s*minmax\(0(px)?,\s*1fr\)\)/,
    'the capture must lay out the portrait three-column case',
  );
  assert.equal(
    capturedSvg.includes('box-sizing: border-box'),
    true,
    'the capture must keep the box-sizing reset',
  );
  assert.match(
    capturedSvg,
    /button[^{}]*\{[^}]*font(-family)?:\s*inherit/,
    'the capture must keep the button reset behind every niche',
  );
  assert.equal(
    capturedSvg.includes('data-aura-cabinet-stage="settled"'),
    true,
    'the capture must export the settled case',
  );
  assert.equal(
    capturedSvg.includes('aura-collection-cabinet__frame'),
    true,
    'the capture must carry the case frame',
  );
  // Stylesheet selectors legitimately mention the class; the markup must not.
  assert.equal(
    capturedSvg.includes('class="aura-collection-cabinet__placard'),
    false,
    'the page placard stays out of the card',
  );
  assert.equal(
    capturedSvg.includes('class="aura-collection-cabinet__header'),
    false,
    'the page header stays out of the card',
  );
  assert.equal(
    capturedSvg.includes('@media'),
    false,
    'no media condition may survive into the capture',
  );
  // Announcements are written for assistive technology, not for a picture.
  assert.equal(
    capturedSvg.includes('class="sr-only"'),
    false,
    'screen-reader-only nodes stay out of the card',
  );
  assert.equal(
    capturedSvg.includes('Cabinet editions displayed'),
    false,
    'the live-region announcement must never be lettered across the case',
  );
  assert.equal(
    /will-change:\s*(?!auto)/.test(capturedSvg),
    false,
    'nothing in a still export should promise future change',
  );
  const cabinetCardSize = await cabinetPreviewImage.evaluate((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
  assert.equal(
    cabinetCardSize.width,
    1080,
    'the cabinet card is 1080 device pixels wide on every device',
  );
  assert.equal(cabinetCardSize.height > cabinetCardSize.width, true, 'the cabinet card is portrait');
  assert.equal(
    cabinetCardSize.height >= 1750 && cabinetCardSize.height <= 2150,
    true,
    `the cabinet card height should sit near the three-column case (got ${cabinetCardSize.height})`,
  );
  // A card can carry perfect chrome around an empty box if the capture
  // decodes but draws nothing, so read the pixels: the band between the
  // header and the footer must be a rendered case, not void.
  const cabinetInk = await cabinetPreviewImage.evaluate(async (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const top = Math.round(canvas.height * 0.12);
    const bottom = Math.round(canvas.height * 0.86);
    const { data } = context.getImageData(0, top, canvas.width, bottom - top);
    let lit = 0;
    // #07080B is the card ground; anything brighter is the case itself.
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] > 22 || data[index + 1] > 23 || data[index + 2] > 26) lit += 1;
    }
    return { lit, total: data.length / 4 };
  });
  assert.equal(
    cabinetInk.lit / cabinetInk.total > 0.05,
    true,
    `the exported case must not be blank (only ${((cabinetInk.lit / cabinetInk.total) * 100).toFixed(2)}% of the band carried ink)`,
  );
  // Invisible material layers are pruned, so every layer that travels shows.
  const strayMaterials = (capturedSvg.match(/class="[^"]*aura-collection-cabinet__material[^"]*"/g) ?? [])
    .filter((attribute) => !attribute.includes('is-current'));
  assert.deepEqual(strayMaterials, [], 'only the current material layer belongs in the capture');
  // A card can carry a full case and still lose every sculpture, so read the
  // artwork itself: each represented seat's own picture must be embedded and
  // must be asked to resolve immediately, and its pixels must be on the card.
  const embeddedArtwork = (capturedSvg.match(/<img[^>]*>/g) ?? []);
  assert.equal(
    embeddedArtwork.length > 0,
    true,
    'the capture must carry the artwork for the represented seats',
  );
  for (const tag of embeddedArtwork) {
    assert.match(tag, /src="data:image\//, 'every exported image must be inlined');
    assert.equal(/loading="lazy"/.test(tag), false, 'a still export cannot defer an image');
    assert.equal(/decoding="async"/.test(tag), false, 'a still export cannot defer a decode');
  }
  const artworkInk = await cabinetPreviewImage.evaluate(async (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    // The upper middle of the first seat: sculpture territory, clear of the
    // frame, the Nº label, the badge, the roundels, and the name.
    const box = {
      x: Math.round(canvas.width * 0.12),
      y: Math.round(canvas.height * 0.1),
      w: Math.round(canvas.width * 0.16),
      h: Math.round(canvas.height * 0.05),
    };
    const { data } = context.getImageData(box.x, box.y, box.w, box.h);
    let brightest = 0;
    for (let index = 0; index < data.length; index += 4) {
      brightest = Math.max(brightest, data[index], data[index + 1], data[index + 2]);
    }
    return brightest;
  });
  assert.equal(
    artworkInk > 90,
    true,
    `the first seat must show its sculpture, not an empty niche (brightest sample ${artworkInk})`,
  );
  await page
    .locator('.aura-stage .aura-share-preview')
    .getByRole('button', { name: 'Close preview' })
    .click();

  await page.screenshot({ path: resolve('/tmp', 'zodiacs-registry-aura-mobile-gallery.png'), fullPage: true });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    true,
    'the 390px Aura page must not overflow horizontally',
  );
  await assertHouseVoice(page, 'the live collection page');
  if (browserErrors.length > 0) {
    productFailures.push(
      `browser console failures (${browserErrors.join('; ')}); resources: ${failedResources.join(', ')}`,
    );
  }
  await context.close();
  return productFailures;
}

async function verifyReducedMotion(browser, baseURL) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/registry/collection/`, { waitUntil: 'networkidle' });

  await assertSettledEditions(
    stageCabinet(page),
    'the reduced-motion static sample',
    expectedSampleHoldings,
  );

  await installCabinetStageRecorder(page);
  await page.locator('#aura-primer-example').click();
  await page.waitForFunction(() => (
    document.querySelector('.aura-result__room--talisman [data-aura-talisman]') !== null
  ));
  const cabinet = await waitForStageSettled(page);
  assert.equal(
    await page.locator('.aura-result--gallery').evaluate((node) => getComputedStyle(node).animationName),
    'none',
  );
  const stages = await recordedCabinetStages(page);
  assert.equal(
    stages.some(({ stage }) => ['light', 'pastel', 'bronze', 'silver', 'gold', 'strike'].includes(stage)),
    false,
    `reduced motion should settle without upgrade stages: ${stages.map(({ stage }) => stage).join(' -> ')}`,
  );
  await assertSettledEditions(cabinet, 'the reduced-motion opened sample', expectedSampleHoldings);
  assert.equal(
    await page.locator('.aura-result__room--talisman .aura-talisman__segments')
      .evaluate((node) => getComputedStyle(node).animationName),
    'none',
  );
  await context.close();
}

async function verifyRestoredCabinet(browser, baseURL) {
  const context = await browser.newContext({
    viewport: { width: 768, height: 900 },
    colorScheme: 'dark',
  });
  await installState(context, profile, restoredAura);
  const page = await context.newPage();
  let lookups = 0;
  await page.route('**/api/aura-holdings', async (route) => {
    lookups += 1;
    await route.abort();
  });

  await page.goto(`${baseURL}/registry/collection/`, { waitUntil: 'networkidle' });
  await waitForStageKicker(page, 'Collection restored');
  const cabinet = stageCabinet(page);
  assert.match(await page.locator('#aura-status').innerText(), /restored from this device/i);
  assert.equal(lookups, 0, 'restoring v2 material editions must not repeat the public lookup');
  await assertSettledEditions(cabinet, 'a restored v2 cabinet');
  await assertCabinetCraft(cabinet, 'the 768px restored cabinet');
  assert.equal(
    await page.locator('.aura-stage [data-aura-cabinet-stage="pastel"]').count(),
    0,
    'a restored cabinet must not replay the tier ascent',
  );
  await context.close();
}

async function verifyDesktopFold(browser, baseURL) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/registry/collection/`, { waitUntil: 'networkidle' });

  // The thesis and the case itself both land inside the first screen.
  const headline = await page.locator('.aura-page__hero h1').boundingBox();
  assert.ok(headline, 'hero headline must render');
  assert.ok(
    headline.y >= 0 && headline.y + headline.height <= 800,
    `the one-line thesis must sit fully inside a 1280x800 first screen (bottom at ${Math.round(headline.y + headline.height)}px)`,
  );
  const firstNiche = await page
    .locator('.aura-stage [data-aura-cabinet-sign="aries"] .aura-collection-cabinet__niche')
    .boundingBox();
  assert.ok(firstNiche, 'the stage cabinet must render');
  assert.ok(
    firstNiche.y + firstNiche.height <= 800,
    `the case's first register must be visible on the first screen (niche bottom at ${Math.round(firstNiche.y + firstNiche.height)}px)`,
  );

  const cabinet = stageCabinet(page);
  await assertSettledEditions(cabinet, 'the desktop static sample', expectedSampleHoldings);
  await assertCabinetCraft(cabinet, 'the 1280px static sample');
  // The case owns the full width; its label hangs beneath it.
  const frame = await page.locator('.aura-stage .aura-collection-cabinet__frame').boundingBox();
  const placard = await page.locator('.aura-stage .aura-collection-cabinet__placard').boundingBox();
  assert.ok(
    frame && placard && placard.y >= frame.y + frame.height - 1,
    'the placard must sit beneath the full-width case',
  );
  assert.ok(
    frame && frame.width > 1000,
    `the case must own the container width (got ${frame && Math.round(frame.width)}px)`,
  );
  // The address box itself lands inside the first screen.
  const addressBox = await page.locator('#aura-address').boundingBox();
  assert.ok(
    addressBox && addressBox.y + addressBox.height <= 800,
    'the wallet-address box must sit inside the first screen',
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    true,
    'the desktop Aura page must not overflow horizontally',
  );
  await assertHouseVoice(page, 'the desktop page');
  await page.screenshot({ path: resolve('/tmp', 'zodiacs-registry-aura-desktop-cabinet.png') });
  await context.close();
}

/**
 * The card claims to be a photograph of the case, so prove it: render the live
 * case at the export's own width and density, and diff it against the case
 * region of the exported PNG. Every share-card regression so far — a clipped
 * grid, a blank case, missing sculptures, a stray announcement — would have
 * failed here, because each one made the picture stop matching the page.
 */
async function verifyCardMatchesPage(browser, baseURL) {
  const context = await browser.newContext({
    viewport: { width: CARD_EXPORT_WIDTH, height: 900 },
    deviceScaleFactor: CARD_DENSITY,
    colorScheme: 'dark',
  });
  await installState(context);
  const page = await context.newPage();
  await page.route('**/api/aura-holdings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      chain: 'solana',
      heldSigns: expectedHeldSigns,
      holdings: expectedHoldings,
      checkedAt,
    }),
  }));
  await page.goto(`${baseURL}/registry/collection/`, { waitUntil: 'networkidle' });
  await page.locator('#aura-address').fill(address);
  await page.getByRole('button', { name: 'Show my collection', exact: true }).click();
  await waitForStageRevealStart(page);
  await waitForStageSettled(page);

  // This comparison isolates the cabinet renderer. Guide is deliberately
  // fixed above page content in production, so exclude its launcher/invite
  // from the live element capture just as the exported cabinet excludes all
  // surrounding site chrome.
  await page.addStyleTag({
    content: '.zassistant, .zguide-launcher, .zguide-invite { display: none !important; }',
  });

  // A focus ring belongs to the page, not to a still of it.
  await page.evaluate(() => document.activeElement?.blur());
  const caseElement = page.locator('.aura-stage .aura-collection-cabinet__frame');
  // The export lays the case out at the full export width, while on the page
  // the same case sits inside the page's own gutters. Widen the viewport until
  // the live case measures what the export gives it, so the two are compared
  // at one scale rather than across a silent resize.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const measured = await caseElement.evaluate((node) => node.getBoundingClientRect().width);
    const delta = CARD_EXPORT_WIDTH - measured;
    if (Math.abs(delta) < 0.5) break;
    const size = page.viewportSize();
    await page.setViewportSize({ width: Math.round(size.width + delta), height: size.height });
  }
  const pageShot = PNG.sync.read(await caseElement.screenshot());

  await page.getByRole('button', { name: 'Share this cabinet', exact: true }).click();
  const preview = page.locator('.aura-stage .aura-share-preview img');
  await preview.waitFor();
  await page.waitForFunction(() => {
    const node = document.querySelector('.aura-stage .aura-share-preview img');
    return node !== null && node.naturalWidth > 0;
  });
  const cardBase64 = await preview.evaluate(async (image) => {
    const blob = await (await fetch(image.src)).blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
  });
  const card = PNG.sync.read(Buffer.from(cardBase64, 'base64'));
  await context.close();

  // The case sits inset by the card's own padding and header, both derived
  // from the export width exactly as the renderer derives them.
  const pad = Math.round(CARD_EXPORT_WIDTH * 0.055);
  const headerH = Math.round(CARD_EXPORT_WIDTH * 0.105);
  const originX = Math.round(pad * CARD_DENSITY);
  const originY = Math.round((pad + headerH) * CARD_DENSITY);
  const width = Math.min(pageShot.width, card.width - originX);
  const height = Math.min(pageShot.height, card.height - originY);
  assert.ok(
    width > 600 && height > 600,
    `the case region should be substantial (got ${width}×${height})`,
  );

  const fromCard = new PNG({ width, height });
  PNG.bitblt(card, fromCard, originX, originY, width, height, 0, 0);
  const fromPage = new PNG({ width, height });
  PNG.bitblt(pageShot, fromPage, 0, 0, width, height, 0, 0);
  const diff = pixelmatch(fromPage.data, fromCard.data, null, width, height, {
    threshold: 0.12,
    includeAA: false,
  });
  const ratio = diff / (width * height);
  // Both halves come from one browser in one run, so type rendering cancels
  // out and what remains is sub-pixel edge noise — measured at ~2%. The
  // ceiling leaves headroom for that without tolerating a real divergence: a
  // lost sculpture, a dropped frame, or a blank case all read far higher.
  assert.ok(
    ratio <= 0.035,
    `the exported case must match the live case (${(ratio * 100).toFixed(2)}% of pixels differ over ${width}×${height})`,
  );
  return ratio;
}

const executablePath = await findChromium();
const browser = await chromium.launch({ executablePath, headless: true, args: STABLE_CHROMIUM_ARGS });
try {
  await withPreview({ port: 4331 }, async (baseURL) => {
    await verifyNoJavaScriptSample(browser, baseURL);
    const productFailures = await verifySampleAndLiveCollection(browser, baseURL);
    await verifyReducedMotion(browser, baseURL);
    await verifyRestoredCabinet(browser, baseURL);
    await verifyDesktopFold(browser, baseURL);
    const cardDrift = await verifyCardMatchesPage(browser, baseURL);
    console.log(`aura-presence-drive: exported case matches the live case within ${(cardDrift * 100).toFixed(2)}%`);
    assert.deepEqual(productFailures, [], 'the gallery browser verification found product regressions');
  });
} finally {
  await browser.close();
}

console.log('aura-presence-drive: one-stage cabinet, five material editions, light-to-strike reveal, principal-work placard, accession ledger, settled v2 restoration, dated seal, fixed-portrait cabinet share capture, chart echoes, restricted preview, house voice, desktop fold, and reduced motion verified');
