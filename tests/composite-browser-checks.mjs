import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { isSiteFooterIconTeardownAbort } from './visual/browser.mjs';

const BODY_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node'];
// Deliberately synthetic imported positions, using the released s1/v2 grammar.
// Sun is exactly opposite; Moon–Venus is an exact composite sextile. These
// are presentation fixtures, never a substituted ephemeris calculation.
const FIRST = [0, 120, 60, 30, 220, 10, 300, 200, 250, 180, 40, 220];
const SECOND = [180, 120, 120, 90, 260, 70, 320, 240, 290, 200, 80, 260];
const MIDPOINTS = [90, 120, 90, 60, 240, 40, 310, 220, 270, 190, 60, 240];
const MOON_CONTACT = 'composite:aspect:Moon:sextile:Venus';
const EXPECTED_ASPECTS = [
  ['Sun', 'conjunction', 'Mercury', 0], ['Sun', 'opposition', 'Neptune', 0],
  ['Moon', 'sextile', 'Venus', 0], ['Moon', 'trine', 'Mars', 0],
  ['Mercury', 'opposition', 'Neptune', 0], ['Venus', 'opposition', 'Mars', 0],
  ['Jupiter', 'square', 'Saturn', 0], ['Jupiter', 'opposition', 'Uranus', 0],
  ['Saturn', 'square', 'Uranus', 0], ['Saturn', 'trine', 'Pluto', 0],
  ['Moon', 'opposition', 'Saturn', 10],
].map(([a, type, b, orb]) => ({ id: `composite:aspect:${a}:${type}:${b}`, orb }));
const PRIVATE_VALUES = ['1907-07-06', '08:30', 'Coyoacán', 'America/Mexico_City', '19.35', '-99.16'];
// What the image says in place of the page's provisional Moon when a chart has no birth time.
const IMAGE_NO_TIME = {
  en: 'A chart without a birth time is drawn from the sky at 12:00 UTC on its date, without the Moon.',
  es: 'Una carta sin hora de nacimiento se dibuja con el cielo de las 12:00 UTC de su fecha, sin la Luna.',
  pt: 'Um mapa sem hora de nascimento é desenhado com o céu das 12:00 UTC da sua data, sem a Lua.',
  fr: 'Un thème sans heure de naissance est dessiné avec le ciel de 12:00 UTC à sa date, sans la Lune.',
  it: 'Un tema senza ora di nascita è disegnato con il cielo delle 12:00 UTC della sua data, senza la Luna.',
  ru: 'Карта без времени рождения нарисована по небу на 12:00 UTC в её дату, без Луны.',
};
const EXPECTED = {
  en: { title: 'Composite chart', wheel: 'Composite chart wheel', receipt: 'Midpoints of two charts · No houses or angles', provisional: 'Provisional Moon', cue: '', ready: 'Image ready. Choose Share or Download.', shared: 'Composite image shared.', downloaded: 'Composite image downloaded.', cancelled: 'Sharing cancelled. The image is still ready.' },
  es: { title: 'Carta compuesta', wheel: 'Rueda de la carta compuesta', receipt: 'Puntos medios de dos cartas · Sin casas ni ángulos', provisional: 'Luna provisional', cue: 'La interpretación que sigue está en inglés.', ready: 'Imagen lista. Elige Compartir o Descargar.', shared: 'Imagen de la carta compuesta compartida.', downloaded: 'Imagen de la carta compuesta descargada.', cancelled: 'Se canceló el envío. La imagen sigue lista.' },
  pt: { title: 'Mapa composto', wheel: 'Roda do mapa composto', receipt: 'Pontos médios de dois mapas · Sem casas nem ângulos', provisional: 'Lua provisória', cue: 'A interpretação a seguir está em inglês.', ready: 'Imagem pronta. Escolha Compartilhar ou Baixar.', shared: 'Imagem do mapa composto compartilhada.', downloaded: 'Imagem do mapa composto baixada.', cancelled: 'Compartilhamento cancelado. A imagem continua pronta.' },
  fr: { title: 'Thème composite', wheel: 'Roue du thème composite', receipt: 'Points médians de deux thèmes · Sans maisons ni angles', provisional: 'Lune provisoire', cue: 'L’interprétation qui suit est en anglais.', ready: 'Image prête. Choisis Partager ou Télécharger.', shared: 'Image du thème composite partagée.', downloaded: 'Image du thème composite téléchargée.', cancelled: 'Partage annulé. L’image reste prête.' },
  it: { title: 'Tema composito', wheel: 'Ruota del tema composito', receipt: 'Punti medi di due temi · Senza case né angoli', provisional: 'Luna provvisoria', cue: 'L’interpretazione che segue è in inglese.', ready: 'Immagine pronta. Scegli Condividi o Scarica.', shared: 'Immagine del tema composito condivisa.', downloaded: 'Immagine del tema composito scaricata.', cancelled: 'Condivisione annullata. L’immagine è ancora pronta.' },
  ru: { title: 'Композитная карта', wheel: 'Колесо композитной карты', receipt: 'Средние точки двух карт · Без домов и углов', provisional: 'Предварительное положение Луны', cue: 'Следующее толкование дано на английском языке.', ready: 'Изображение готово. Выберите «Поделиться» или «Скачать».', shared: 'Вы поделились изображением композитной карты.', downloaded: 'Изображение композитной карты скачано.', cancelled: 'Отправка отменена. Изображение по-прежнему готово.' },
};

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
export function compositeFixtureToken({ unknown = false, bothUnknown = false, reversed = false } = {}) {
  const positions = (longitudes, known) => `2.${encode({ b: longitudes, ...(known ? { a: [15, 105] } : {}), h: 'w', v: '0.1.0' })}`;
  const sides = [[FIRST, !bothUnknown, 'Composite fixture A'], [SECOND, !unknown && !bothUnknown, 'Composite fixture B']];
  if (reversed) sides.reverse();
  return `s1.${encode({ p: sides.map(([values, known]) => positions(values, known)), l: sides.map(([, , name]) => name), k: sides.map(([, known]) => known) })}`;
}

export function compositeSavedFixtures() {
  return [true, false].flatMap((known) => [FIRST, SECOND].map((values, index) => ({
    id: `composite-${index}-${known ? 'timed' : 'unknown'}`,
    name: `Composite fixture ${index === 0 ? 'A' : 'B'}`,
    createdAt: '2026-07-11T00:00:00Z', updatedAt: '2026-07-11T00:00:00Z',
    birth: { date: '2000-01-01', time: known ? '12:00' : null, timeKnown: known, place: null },
    summary: {
      engineVersion: '0.1.0', utcISO: '2000-01-01T12:00:00Z', houseSystem: 'whole',
      bodies: BODY_ORDER.map((body, i) => ({ body, lon: values[i], retrograde: false })),
      angles: known ? { asc: 15, mc: 105 } : null, flags: [],
    },
  })));
}

/** Inspect the bytes from the actual browser download, including image body. */
export function inspectCompositePng(bytes) {
  const png = PNG.sync.read(bytes);
  let foreground = 0;
  let middleForeground = 0;
  let wheelForeground = 0;
  for (let y = 0; y < png.height; y += 3) {
    for (let x = 0; x < png.width; x += 3) {
      const i = (y * png.width + x) * 4;
      if (png.data[i + 3] > 0 && Math.max(png.data[i], png.data[i + 1], png.data[i + 2]) > 95) {
        foreground += 1;
        if (y > png.height * 0.2 && y < png.height * 0.8) middleForeground += 1;
        if (x > png.width * 0.18 && x < png.width * 0.82 && y > png.height * 0.13 && y < png.height * 0.6) wheelForeground += 1;
      }
    }
  }
  return { width: png.width, height: png.height, foreground, middleForeground, wheelForeground, bytes: bytes.length };
}

/** Native canvas ink observations, independent of the painter's line wrapping. */
export function inspectCompositeTextLayout(rows) {
  const clipped = rows.filter((row) => ![row.left, row.right, row.top, row.bottom].every(Number.isFinite)
    || row.left < 32 || row.right > 1048 || row.top < 32 || row.bottom > 1325);
  const overlaps = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i]; const b = rows[j];
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
        && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) overlaps.push([a.text, b.text]);
    }
  }
  return { clipped, overlaps };
}

export const isExpectedCompositeAbort = (request, expected) => expected.has(request)
  && request.resourceType() === 'fetch' && request.failure()?.errorText === 'net::ERR_ABORTED';

async function boundedWait(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Controlled composite request did not arrive')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function artworkTimeout({ page, check, output, expectedAborts }) {
  const path = '/assets/zodiac-icons/128/aries.webp';
  const matcher = (url) => url.pathname === path;
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let intercepted;
  const requested = new Promise((resolve) => { intercepted = resolve; });
  let first = null;
  let began = 0;
  let settled;
  const handling = new Promise((resolve) => { settled = resolve; });
  let handlingError;
  const handler = async (route) => {
    // Keep normal DOM/SVG image loading genuine; stall only export's fetch.
    if (route.request().resourceType() !== 'fetch' || first) return route.continue();
    first = route.request(); began = performance.now(); expectedAborts.add(first);
    intercepted();
    try {
      await held;
      // The deadline already aborted the held fetch. Do not continue an
      // aborted request, and finish this handler before removing its route.
      if (!first.failure()) await route.continue();
    } catch (error) {
      handlingError = error;
    } finally { settled(); }
  };
  await page.route(matcher, handler);
  try {
    await page.locator('[data-composite-export]').click();
    await boundedWait(requested, 30_000);
    const aborted = page.waitForEvent('requestfailed', { predicate: (request) => request === first, timeout: 22_000 });
    check('composite stalled artwork keeps the chart, reading and Close available', await pressed(point(page, 'Sun'))
      && await page.locator('[data-composite-reading]').isVisible() && await page.locator('[data-composite-export-close]').isEnabled());
    await Promise.all([page.locator('[data-composite-panel] [role="alert"]').waitFor({ state: 'visible', timeout: 22_000 }), aborted]);
    const elapsed = performance.now() - began;
    check('composite artwork download has a bounded15s abort and retry state', elapsed >= 14_000 && elapsed <= 22_000
      && first.failure()?.errorText === 'net::ERR_ABORTED' && await page.locator('[data-composite-export]').isEnabled()
      && await page.locator('[data-composite-image]').count() === 0, JSON.stringify({ elapsed, failure: first.failure() }));
    if (output) await page.locator('[data-composite-panel]').screenshot({ path: `${output}/en-390-artwork-timeout.png`, animations: 'disabled' });
    release();
    await handling;
    if (handlingError) throw handlingError;
    await page.unroute(matcher, handler);
    const requestedAgain = page.waitForRequest((request) => request.resourceType() === 'fetch' && new URL(request.url()).pathname === path, { timeout: 30_000 });
    await Promise.all([requestedAgain, page.locator('[data-composite-export]').click()]);
    await page.locator('[data-composite-image]').waitFor({ state: 'visible', timeout: 30_000 });
    await waitStatus(page, EXPECTED.en.ready);
    check('composite artwork retry refetches the failed cache entry and preserves selection', await pressed(point(page, 'Sun'))
      && await page.locator('[data-composite-panel] [role="alert"]').count() === 0);
    if (output) await page.locator('[data-composite-panel]').screenshot({ path: `${output}/en-390-artwork-recovered.png`, animations: 'disabled' });
    await page.locator('[data-composite-export-close]').click();
  } finally {
    release();
    if (first) await handling;
    await page.unroute(matcher, handler);
    if (first) expectedAborts.delete(first);
    if (handlingError) throw handlingError;
  }
}

const normalize = (value) => value.replace(/\s+/gu, ' ').trim();
const point = (page, body) => page.locator(`[data-composite-point="${body}"]`);
const aspect = (page, id) => page.locator(`[data-composite-aspect="${id}"]`);
const hit = (page, id) => page.locator(`[data-composite-hit="${id}"]`);
const pressed = async (locator) => await locator.getAttribute('aria-pressed') === 'true';
const frames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function clickAspectStroke(page, id) {
  const target = hit(page, id);
  await target.scrollIntoViewIfNeeded();
  const candidate = await target.evaluate((node) => {
    const line = node.querySelector('line.wheel__hit');
    const matrix = line?.getScreenCTM();
    if (!line || !matrix) return null;
    for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9]) {
      const x = line.x1.baseVal.value + fraction * (line.x2.baseVal.value - line.x1.baseVal.value);
      const y = line.y1.baseVal.value + fraction * (line.y2.baseVal.value - line.y1.baseVal.value);
      const at = new DOMPoint(x, y).matrixTransform(matrix);
      if (document.elementFromPoint(at.x, at.y)?.closest('[data-composite-hit]') === node) return { x: at.x, y: at.y };
    }
    return null;
  });
  if (!candidate) return false;
  await page.mouse.click(candidate.x, candidate.y);
  return true;
}

async function installObservation(context, profile) {
  await context.addInitScript((saved) => {
    if (location.origin === 'null') return;
    const key = 'zodiacs.profile.v1';
    if (!sessionStorage.getItem('composite-fixture-seeded')) {
      localStorage.setItem(key, JSON.stringify(saved, null, 2));
      sessionStorage.setItem('composite-fixture-seeded', '1');
    }
    window.__compositeProbe = { text: [], shares: [], shareOutcome: 'shared', failNextEncode: false, encodeFailures: 0 };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      const ink = this.measureText(text);
      const [x, y] = rest;
      window.__compositeProbe.text.push({ text: String(text), width: this.canvas.width, height: this.canvas.height,
        left: x - ink.actualBoundingBoxLeft, right: x + ink.actualBoundingBoxRight,
        top: y - ink.actualBoundingBoxAscent, bottom: y + ink.actualBoundingBoxDescent });
      return fillText.call(this, text, ...rest);
    };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
      if (window.__compositeProbe.failNextEncode) {
        window.__compositeProbe.failNextEncode = false;
        window.__compositeProbe.encodeFailures += 1;
        queueMicrotask(() => callback(null));
        return;
      }
      return toBlob.call(this, callback, ...rest);
    };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (data) => Array.isArray(data?.files) && data.files.every((file) => file.type === 'image/png') });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        const files = await Promise.all((data.files ?? []).map(async (file) => ({ name: file.name, type: file.type, size: file.size, signature: [...new Uint8Array(await file.arrayBuffer()).slice(0, 8)] })));
        window.__compositeProbe.shares.push({ files, title: data.title ?? '', text: data.text ?? '', url: data.url ?? '', outcome: window.__compositeProbe.shareOutcome });
        if (window.__compositeProbe.shareOutcome === 'cancelled') throw new DOMException('Fixture cancellation', 'AbortError');
        if (window.__compositeProbe.shareOutcome === 'error') throw new DOMException('Fixture share unavailable', 'NotAllowedError');
      },
    });
  }, { ...profile, charts: [...profile.charts, ...compositeSavedFixtures()] });
}

async function openFixture(page, baseURL, locale, options = {}) {
  const route = locale === 'en' ? '/compatibility/' : `/${locale}/compatibility/`;
  // The returned-reading fragment is invite-feature-gated and English-only.
  // Exercise the public saved-chart comparison path in every locale instead.
  await page.goto('about:blank');
  const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  if (response?.status() !== 200) throw new Error(`Composite fixture ${locale}: HTTP ${response?.status()}`);
  const ids = [
    `composite-0-${options.bothUnknown ? 'unknown' : 'timed'}`,
    `composite-1-${options.unknown || options.bothUnknown ? 'unknown' : 'timed'}`,
  ];
  if (options.reversed) ids.reverse();
  await page.locator('#syn-a-source').selectOption(ids[0]);
  await page.locator('#syn-b-source').selectOption(ids[1]);
  await page.locator('.calc__submit').click();
  await page.locator('[data-relationship-tab="composite"]').waitFor({ timeout: 30000 });
  await page.locator('[data-relationship-tab="composite"]').click();
  await page.locator('[data-composite-panel]').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function waitStatus(page, text) {
  await page.waitForFunction((value) => document.querySelector('[data-composite-export-status]')?.textContent?.includes(value), text);
}

async function createAndDownload({ page, locale, label, check, outDir, measurements, provisional }) {
  const c = EXPECTED[locale];
  const placements = await page.locator('[data-composite-point]').evaluateAll((nodes) => nodes.map((node) => {
    const spans = [...node.children].filter((child) => child.tagName === 'SPAN');
    return { body: node.getAttribute('data-composite-point'), label: spans[0]?.textContent?.trim() ?? '', receipt: spans[1]?.textContent?.trim() ?? '' };
  }));
  const moonNotice = provisional ? normalize(await page.locator('[data-composite-provisional]').textContent()) : '';
  const aspectTitle = normalize(await page.locator('#composite-aspects-heading').textContent());
  await page.evaluate(() => { window.__compositeProbe.text = []; });
  await page.locator('[data-composite-export]').click();
  await page.locator('[data-composite-image]').waitFor({ state: 'visible', timeout: 30000 });
  await waitStatus(page, c.ready);
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-composite-image]');
    return node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0;
  });
  const image = await page.locator('[data-composite-image]').evaluate((node) => ({ loaded: node.complete && node.naturalWidth > 0, alt: node.alt, width: node.naturalWidth, height: node.naturalHeight }));
  check(`${label}: image preview loads with localized alternative text`, image.loaded && image.alt.length > 15 && (locale === 'en' || !image.alt.startsWith('Composite chart image')));
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-composite-download]').click()]);
  const path = await download.path();
  if (!path) throw new Error(`${label}: browser produced no downloadable PNG`);
  const bytes = await readFile(path);
  const png = inspectCompositePng(bytes);
  const inkRows = await page.evaluate(() => window.__compositeProbe.text.filter((row) => row.width === 1080 && row.height === 1350));
  const textLayout = inspectCompositeTextLayout(inkRows);
  check(`${label}: native image text stays inside the card without overlapping ink`, inkRows.length >= 16 && !textLayout.clipped.length && !textLayout.overlaps.length, JSON.stringify(textLayout));
  const textRows = inkRows.map((row) => row.text);
  const drawnText = normalize(textRows.join(' '));
  check(`${label}: downloads a dedicated nonblank composite PNG`, download.suggestedFilename() === 'zodiacs-composite.png' && png.width === 1080 && png.height === 1350 && png.foreground > 1000 && png.wheelForeground > 400, JSON.stringify(png));
  check(`${label}: PNG title and house-free receipt are localized`, drawnText.includes(c.title) && drawnText.includes(normalize(c.receipt)), drawnText.slice(0, 250));
  if (provisional) {
    // A saved chart without a birth time is drawn as its link carries it
    // (compositePictureData): the sky at 12:00 UTC on its birth date, not the
    // positions stored for its noon at the birthplace, and without the Moon.
    // These fixtures store synthetic positions, so every drawn midpoint moves.
    const rows = textRows.map(normalize);
    const drawn = placements.filter((row) => row.body !== 'Moon')
      .map((row) => ({ page: normalize(`${row.label} · ${row.receipt}`), image: rows.find((text) => text.startsWith(`${normalize(row.label)} · `)) }));
    check(`${label}: image draws the eleven placements besides the Moon from the sky at 12:00 UTC, and their aspect count`, placements.length === 12
      && drawn.every(({ image }) => image && /· \d{1,2}°\d{2}′ \S+$/u.test(image)) && drawn.some(({ page, image }) => image !== page)
      && !rows.some((text) => text.startsWith(`${normalize(placements.find((row) => row.body === 'Moon')?.label ?? 'Moon')} `))
      && new RegExp(`${aspectTitle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}: \\d+`, 'u').test(drawnText), JSON.stringify(drawn.slice(0, 3)));
  } else {
    check(`${label}: image contains all twelve exact localized placements and aspect count`, placements.length === 12 && placements.every((row) => {
      const value = row.receipt.replace(` · ${c.provisional}`, '');
      return drawnText.includes(normalize(`${row.label} · ${value}`));
    }) && drawnText.includes(`${aspectTitle}: ${EXPECTED_ASPECTS.length}`));
  }
  check(`${label}: image contains no stored birth inputs or natal verdict`, PRIVATE_VALUES.every((value) => !drawnText.includes(value)) && !/A birth chart|Your big three|Flow, with useful friction|Chemistry that asks/u.test(drawnText));
  const moonLabel = placements.find((row) => row.body === 'Moon')?.label;
  const noTimeNote = normalize(IMAGE_NO_TIME[locale]);
  const pageNoTimeNote = provisional ? normalize(await page.locator('[data-composite-image-no-time]').textContent()) : '';
  check(`${label}: image uncertainty matches its inputs`, provisional ? moonNotice.length > 30 && pageNoTimeNote === noTimeNote && drawnText.includes(noTimeNote)
    && !textRows.some((row) => row.startsWith(`${moonLabel} `) || row.includes(' * ·')) && !drawnText.includes(c.provisional)
    : !drawnText.includes(noTimeNote) && await page.locator('[data-composite-image-no-time]').count() === 0 && !textRows.some((row) => row.includes(' * ·')) && !drawnText.includes(c.provisional));
  await waitStatus(page, c.downloaded);
  check(`${label}: download status is distinct and preview remains`, await page.locator('[data-composite-image]').isVisible() && !(await page.locator('[data-composite-export-status]').textContent()).includes(c.shared));
  if (outDir) await writeFile(`${outDir}/${label}.png`, bytes);
  measurements.push({ label, ...png, preview: image, drawnText, textLayout });
}

/** Called only by the existing CI compatibility drive; never launches a browser. */
export async function runCompositeBrowserChecks({ browser, baseURL, check, outDir, profile }) {
  const output = outDir ? `${outDir}/composite` : null;
  if (output) await mkdir(output, { recursive: true });
  const measurements = [];
  const errors = [];
  for (const locale of Object.keys(EXPECTED)) {
    for (const width of [390, 1440]) {
      const label = `${locale}-${width}`;
      const c = EXPECTED[locale];
      const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: true });
      await installObservation(context, profile);
      const page = await context.newPage();
      const expectedAborts = new Set();
      page.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`${label}: ${message.text()}`); });
      page.on('requestfailed', (request) => {
        if (!isExpectedCompositeAbort(request, expectedAborts) && !isSiteFooterIconTeardownAbort(request)) errors.push(`${label}: ${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
      });
      context.on('request', (request) => {
        const url = new URL(request.url());
        if (/^https?:$/u.test(url.protocol) && url.origin !== new URL(baseURL).origin) errors.push(`${label}: unexpected external request ${request.url()}`);
      });
      try {
        await openFixture(page, baseURL, locale);
        const originalProfile = await page.evaluate(() => localStorage.getItem('zodiacs.profile.v1'));
        const panel = page.locator('[data-composite-panel]');
        const receipts = await page.locator('[data-composite-point]').evaluateAll((nodes) => nodes.map((node) => ({ body: node.getAttribute('data-composite-point'), tag: node.tagName, lon: node.getAttribute('data-composite-longitude'), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
        check(`${label}: all twelve placements are native 44px controls`, receipts.length === 12 && receipts.every((row, i) => row.body === BODY_ORDER[i] && row.tag === 'BUTTON' && row.width >= 44 && row.height >= 44), JSON.stringify(receipts));
        check(`${label}: complete midpoint values preserve the documented convention`, receipts.every((row, i) => Number(row.lon) === MIDPOINTS[i]), JSON.stringify(receipts.map(({ body, lon }) => ({ body, lon }))));
        check(`${label}: composite wheel is named accurately and has no houses or angles`, await page.locator('[data-composite-wheel] svg.wheel').getAttribute('aria-label') === c.wheel && await page.locator('[data-composite-wheel] .wheel__house').count() === 0 && !/Birth chart wheel|\bASC\b|\bMC\b/u.test(await page.locator('[data-composite-wheel]').textContent()));
        check(`${label}: eleven visible body targets accompany all twelve receipts`, await page.locator('[data-composite-hit^="composite:body:"]').count() === 11);

        for (const body of BODY_ORDER) {
          await point(page, body).focus();
          await page.keyboard.press('Enter');
          await frames(page);
          check(`${label}: keyboard selects ${body} with its detail`, await pressed(point(page, body)) && await page.locator('[data-composite-detail]').isVisible());
        }
        await point(page, 'Sun').focus();
        await page.keyboard.press('Tab');
        check(`${label}: native Tab reaches the next placement`, await point(page, 'Moon').evaluate((node) => node === document.activeElement));
        check(`${label}: native keyboard focus has a visible indicator`, await point(page, 'Moon').evaluate((node) => {
          const style = getComputedStyle(node);
          return (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
        }));
        await page.keyboard.press('Space');
        check(`${label}: native Space activates the focused placement`, await pressed(point(page, 'Moon')));

        const contacts = await page.locator('[data-composite-aspect]').evaluateAll((nodes) => nodes.map((node) => ({ id: node.getAttribute('data-composite-aspect'), orb: Number(node.getAttribute('data-composite-orb')), hasOrb: node.hasAttribute('data-composite-orb'), tag: node.tagName, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
        check(`${label}: every aspect has a native 44px selection control`, contacts.length > 0 && contacts.every((row) => row.tag === 'BUTTON' && row.hasOrb && row.width >= 44 && row.height >= 44), JSON.stringify(contacts));
        check(`${label}: all eleven expected aspects and exact orbs are present`, JSON.stringify(contacts.map(({ id, orb }) => ({ id, orb }))) === JSON.stringify(EXPECTED_ASPECTS), JSON.stringify(contacts));
        for (const contact of contacts) {
          await aspect(page, contact.id).click();
          check(`${label}: pointer selects ${contact.id}`, await pressed(aspect(page, contact.id)) && await page.locator('[data-composite-detail]').isVisible());
        }
        await aspect(page, contacts[0].id).focus();
        await page.keyboard.press('Space');
        check(`${label}: native keyboard activates an aspect with the same selection ID`, await pressed(aspect(page, contacts[0].id)) && await hit(page, contacts[0].id).getAttribute('data-selected') === 'true');
        await page.locator('[data-composite-clear]').click();
        check(`${label}: clearing restores focus to its native receipt`, await aspect(page, contacts[0].id).evaluate((node) => node === document.activeElement));
        check(`${label}: clearing resets selection in the live detail region`, await page.locator('[data-composite-point][aria-pressed="true"], [data-composite-aspect][aria-pressed="true"]').count() === 0 && await page.locator('[data-composite-detail]').getAttribute('aria-live') === 'polite');
        for (const body of BODY_ORDER.filter((name) => name !== 'South Node')) {
          await page.locator(`[data-composite-marker="${body}"]`).click();
          check(`${label}: ${body} SVG marker and placement share selection`, await pressed(point(page, body)) && await hit(page, `composite:body:${body}`).getAttribute('data-selected') === 'true');
        }
        await page.locator('[data-composite-clear]').click();
        const strokeClicked = await clickAspectStroke(page, MOON_CONTACT);
        check(`${label}: native SVG aspect hit and aspect receipt share selection`, strokeClicked && await pressed(aspect(page, MOON_CONTACT)));
        await point(page, 'Sun').click();
        const readingText = await page.locator('[data-composite-reading]').textContent();
        check(`${label}: timed selection has substantive composite reading`, normalize(readingText ?? '').length > 50);
        check(`${label}: English interpretation has an explicit localized cue`, locale === 'en' || ((await panel.textContent()).includes(c.cue) && await page.locator('[data-composite-reading]').getAttribute('lang') === 'en'));

        await page.locator('[data-relationship-tab="grid"]').click();
        await page.locator('[data-relationship-tab="composite"]').click();
        check(`${label}: selection persists across tab changes`, await pressed(point(page, 'Sun')));
        await page.locator('[data-relationship-tab="wheel"]').click();
        await page.locator('[data-swap]').click();
        await page.locator('[data-relationship-tab="composite"]').click();
        check(`${label}: ring swap preserves canonical composite and selection`, await pressed(point(page, 'Sun')) && Number(await point(page, 'Sun').getAttribute('data-composite-longitude')) === 90);
        check(`${label}: panel does not overflow its viewport`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        if (output) await panel.screenshot({ path: `${output}/${label}-selection.png`, animations: 'disabled' });
        if (locale === 'en' && width === 390) await artworkTimeout({ page, check, output, expectedAborts });
        await createAndDownload({ page, locale, label: `${label}-timed`, check, outDir: output, measurements, provisional: false });

        if (locale === 'en' && width === 1440) {
          await page.evaluate(() => { window.__compositeProbe.shareOutcome = 'cancelled'; });
          await page.locator('[data-composite-share]').click();
          await waitStatus(page, c.cancelled);
          check('composite cancellation keeps the prepared image without an error', await page.locator('[data-composite-image]').isVisible() && await page.locator('[data-composite-panel] [role="alert"]').count() === 0);
          await page.evaluate(() => { window.__compositeProbe.shareOutcome = 'error'; });
          const [fallback] = await Promise.all([page.waitForEvent('download'), page.locator('[data-composite-share]').click()]);
          await waitStatus(page, c.downloaded);
          check('composite rejected native share falls back to a download and preserves image', fallback.suggestedFilename() === 'zodiacs-composite.png' && await page.locator('[data-composite-image]').isVisible() && await pressed(point(page, 'Sun')) && await page.locator('[data-composite-share]').isEnabled());
          await page.evaluate(() => { window.__compositeProbe.shareOutcome = 'shared'; });
          await page.locator('[data-composite-share]').click();
          await waitStatus(page, c.shared);
          const shared = await page.evaluate(() => window.__compositeProbe.shares.at(-1));
          check('composite share retries with the actual prepared PNG', shared.outcome === 'shared' && shared.files.length === 1 && shared.files[0].name === 'zodiacs-composite.png' && shared.files[0].size > 1000 && JSON.stringify(shared.files[0].signature) === '[137,80,78,71,13,10,26,10]' && shared.url === '');
          await page.locator('[data-composite-export-close]').click();
          check('composite closing image retains chart and selected reading', await page.locator('[data-composite-image]').count() === 0 && await pressed(point(page, 'Sun')) && await page.locator('[data-composite-reading]').isVisible());
          await page.evaluate(() => { window.__compositeProbe.failNextEncode = true; });
          await page.locator('[data-composite-export]').click();
          await page.locator('[data-composite-panel] [role="alert"]').waitFor();
          check('composite encode failure leaves calculation and retry available', await page.locator('[data-composite-export]').isEnabled() && await point(page, 'Sun').isVisible() && await page.locator('[data-composite-image]').count() === 0 && await page.evaluate(() => window.__compositeProbe.encodeFailures === 1));
          await page.locator('[data-composite-export]').click();
          await page.locator('[data-composite-image]').waitFor({ state: 'visible' });
          await waitStatus(page, c.ready);
          check('composite encode retry succeeds without re-comparison', await pressed(point(page, 'Sun')));
        }
        check(`${label}: exploring and exporting never changes stored birth data`, await page.evaluate(() => localStorage.getItem('zodiacs.profile.v1')) === originalProfile);

        await openFixture(page, baseURL, locale, { unknown: true });
        check(`${label}: new comparison starts with no stale composite selection`, await page.locator('[data-composite-point][aria-pressed="true"], [data-composite-aspect][aria-pressed="true"]').count() === 0 && await page.locator('[data-composite-image]').count() === 0);
        await point(page, 'Moon').click();
        check(`${label}: unknown Moon remains a provisional receipt without interpretation`, await pressed(point(page, 'Moon')) && (await point(page, 'Moon').textContent()).includes(c.provisional) && await page.locator('[data-composite-provisional]').count() > 0 && await page.locator('[data-composite-reading]').count() === 0 && await page.locator('[data-composite-detail] a, [data-composite-detail] button:not([data-composite-clear])').count() === 0);
        await aspect(page, MOON_CONTACT).click();
        check(`${label}: unknown Moon aspect also withholds substantive copy and actions`, await pressed(aspect(page, MOON_CONTACT)) && await page.locator('[data-composite-provisional]').count() > 0 && await page.locator('[data-composite-reading]').count() === 0 && await page.locator('[data-composite-detail] a, [data-composite-detail] button:not([data-composite-clear])').count() === 0);
        await point(page, 'Sun').click();
        check(`${label}: unknown Moon does not suppress other composite interpretations`, await page.locator('[data-composite-reading]').count() === 1);
        await createAndDownload({ page, locale, label: `${label}-unknown`, check, outDir: output, measurements, provisional: true });
        if (output) await page.locator('[data-composite-panel]').screenshot({ path: `${output}/${label}-unknown-preview.png`, animations: 'disabled' });

        if (locale === 'en' && width === 1440) {
          await openFixture(page, baseURL, locale, { bothUnknown: true });
          await point(page, 'Moon').click();
          check('composite both unknown birth times retain only the provisional Moon receipt', (await point(page, 'Moon').textContent()).includes(c.provisional) && await page.locator('[data-composite-reading]').count() === 0 && Number(await point(page, 'Moon').getAttribute('data-composite-longitude')) === 120);
          await openFixture(page, baseURL, locale, { reversed: true });
          check('composite reversing source charts preserves exact-opposite convention', Number(await point(page, 'Sun').getAttribute('data-composite-longitude')) === 270);
          await point(page, 'Sun').click();
          await page.locator('#syn-a-source').selectOption('drive-frida');
          await page.locator('#syn-b-source').selectOption('drive-diego');
          await page.locator('.calc__submit').click();
          await page.waitForFunction(() => document.querySelector('[data-relationship-tab="wheel"]')?.getAttribute('aria-selected') === 'true');
          await page.locator('[data-relationship-tab="composite"]').click();
          check('composite a new form comparison clears the preceding selection', await page.locator('[data-composite-point][aria-pressed="true"], [data-composite-aspect][aria-pressed="true"]').count() === 0 && Number(await point(page, 'Sun').getAttribute('data-composite-longitude')) !== 270);
        }
      } catch (error) {
        check(`${label}: composite acceptance completes`, false, error?.stack ?? String(error));
      } finally {
        await context.close();
      }
    }
  }
  check('composite twelve locale/width contexts have no browser errors', errors.length === 0, errors.join(' | '));
  if (output) await writeFile(`${output}/measurements.json`, JSON.stringify({ contexts: 12, measurements, errors }, null, 2));
}
