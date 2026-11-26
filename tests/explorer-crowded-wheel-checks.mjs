/** Rendered geometry and input correspondence; no claim of screen-reader or visual approval. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TIMEOUT = 30_000;
/** On a Moon surface of an unknown-time chart, any sign beyond the birth date's own is an unverified claim. */
const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
const namesIn = (text) => SIGN_NAMES.filter((name) => new RegExp(`\\b${name}\\b`).test(text));
const [demo, people] = await Promise.all([
  readFile(new URL('../src/data/demo-chart-frida.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../src/data/people.json', import.meta.url), 'utf8').then(JSON.parse),
]);
const fragment = (input) => `#c=1.${Buffer.from(JSON.stringify(input)).toString('base64url')}`;
const fixtures = [{
  slug: 'frida-kahlo', known: true, anchor: demo.angles.asc, tolerance: 0.001,
  bodies: demo.bodies.filter((body) => body.body !== 'South Node'),
  fragment: fragment({ d: '1907-07-06', t: '08:30', z: 'America/Mexico_City', la: 19.35, lo: -99.16, p: 'Coyoacán, Mexico' }),
}, ...['edgar-allan-poe', 'franz-kafka', 'alexander-graham-bell'].map((slug) => {
  const person = people.people.find((record) => record.slug === slug);
  if (!person || person.birthTime !== null) throw new Error(`Expected an unknown-time committed fixture: ${slug}`);
  return {
    slug, known: false, anchor: 0, tolerance: 0.006, moon: person.moon,
    bodies: person.placements.map((body) => ({ body: body.body, lon: body.longitude, retrograde: body.retrograde })),
    // Noon is only the engine's reference geometry. Never send it as a known birth time.
    fragment: fragment({ d: person.birthDate.computedGregorianDate, z: person.birthPlace.timeZone,
      la: person.birthPlace.coordinates.latitude, lo: person.birthPlace.coordinates.longitude,
      p: person.birthPlace.normalisedLabel }),
  };
})];

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleDistance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.05
  && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.05;
const boxCircleDistance = (box, circle) => Math.hypot(
  circle.x - Math.max(box.left, Math.min(circle.x, box.right)),
  circle.y - Math.max(box.top, Math.min(circle.y, box.bottom)),
);
const segmentDistance = (a, b, point) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return distance({ x: a.x + t * dx, y: a.y + t * dy }, point);
};
const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const interiorCrossing = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < -1e-8
  && cross(c, d, a) * cross(c, d, b) < -1e-8;

/** Independent inequalities on observed shapes, never a second call to the layout fan. */
export function inspectCrowdedGeometry(snapshot) {
  const failures = [];
  let minimumGutterPx = Infinity;
  const { bodies, scale } = snapshot;
  for (let i = 0; i < bodies.length; i += 1) {
    const body = bodies[i];
    const radius = body.r + body.stroke / 2;
    if (!(body.glyph.right > body.glyph.left && body.glyph.bottom > body.glyph.top)) failures.push(`${body.id}: glyph has no measurable ink bounds`);
    const tickAngle = Math.atan2(body.tick.y - snapshot.center.y, body.tick.x - snapshot.center.x);
    const markerAngle = Math.atan2(body.y - snapshot.center.y, body.x - snapshot.center.x);
    if (Math.abs(Math.sin(tickAngle - markerAngle)) > 0.001 && !body.leader) failures.push(`${body.id}: displaced marker has no true-position leader`);
    if (body.rx) {
      if (intersects(body.glyph, body.rx)) failures.push(`${body.id}: glyph intersects its own Rx bounds`);
      for (const x of [body.rx.left, body.rx.right]) for (const y of [body.rx.top, body.rx.bottom]) {
        if (distance(body, { x, y }) > radius + 0.05) failures.push(`${body.id}: Rx bounds escape its marker`);
      }
    }
    for (let j = i + 1; j < bodies.length; j += 1) {
      const other = bodies[j];
      const gutter = (distance(body, other) - radius - other.r - other.stroke / 2) * scale;
      minimumGutterPx = Math.min(minimumGutterPx, gutter);
      if (gutter < 1) failures.push(`${body.id}/${other.id}: only ${gutter.toFixed(3)} CSS px marker gutter`);
      for (const label of [body.glyph, body.rx].filter(Boolean)) {
        if (boxCircleDistance(label, other) < other.r + other.stroke / 2 - 0.05) failures.push(`${body.id}: ink bounds enter ${other.id}`);
        for (const otherLabel of [other.glyph, other.rx].filter(Boolean)) {
          if (intersects(label, otherLabel)) failures.push(`${body.id}/${other.id}: ink bounds intersect`);
        }
      }
      for (const label of [other.glyph, other.rx].filter(Boolean)) {
        if (boxCircleDistance(label, body) < radius - 0.05) failures.push(`${other.id}: ink bounds enter ${body.id}`);
      }
    }
    if (body.leader) {
      const points = body.leader;
      if (distance(points[0], body.tick) > 0.03) failures.push(`${body.id}: leader misses its true-position tick`);
      if (Math.abs(distance(points.at(-1), body) - body.r) > body.stroke / 2 + 0.05) failures.push(`${body.id}: leader misses its own rim`);
      for (let k = 1; k < points.length; k += 1) for (const other of bodies) {
        if (other.id !== body.id && segmentDistance(points[k - 1], points[k], other) < other.r + other.stroke / 2 - 0.05) {
          failures.push(`${body.id}: leader enters ${other.id}`);
        }
      }
      for (const other of bodies.slice(i + 1).filter((item) => item.leader)) {
        for (let a = 1; a < points.length; a += 1) for (let b = 1; b < other.leader.length; b += 1) {
          if (interiorCrossing(points[a - 1], points[a], other.leader[b - 1], other.leader[b])) {
            failures.push(`${body.id}/${other.id}: leaders cross in their interiors`);
          }
        }
      }
    }
  }
  return { failures: [...new Set(failures)], minimumGutterPx };
}

async function renderedGeometry(page, fixture) {
  return page.locator('.wheel--interactive').evaluate((svg, { anchor }) => {
    const viewBox = svg.viewBox.baseVal;
    const center = { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 };
    const matrix = (node) => svg.getScreenCTM().inverse().multiply(node.getScreenCTM());
    const point = (node, x, y) => { const p = new DOMPoint(x, y).matrixTransform(matrix(node)); return { x: p.x, y: p.y }; };
    const stroke = (node) => getComputedStyle(node).stroke === 'none' ? 0 : parseFloat(getComputedStyle(node).strokeWidth) || 0;
    const bounds = (node) => {
      const box = node.getBBox(), padding = stroke(node) / 2;
      const points = [box.x - padding, box.x + box.width + padding].flatMap((x) =>
        [box.y - padding, box.y + box.height + padding].map((y) => point(node, x, y)));
      return { left: Math.min(...points.map((p) => p.x)), right: Math.max(...points.map((p) => p.x)),
        top: Math.min(...points.map((p) => p.y)), bottom: Math.max(...points.map((p) => p.y)) };
    };
    const bodies = [...svg.querySelectorAll('g[data-entity^="body:"]')].map((group) => {
      const marker = group.querySelector('[data-body-marker]'), glyph = group.querySelector('[data-body-glyph]');
      if (!marker || !glyph) throw new Error(`Missing actual marker/glyph hooks: ${group.dataset.entity}`);
      const p = point(marker, marker.cx.baseVal.value, marker.cy.baseVal.value);
      const box = marker.getBBox();
      const tickLine = group.querySelector(':scope > line');
      const tick = point(tickLine, tickLine.x2.baseVal.value, tickLine.y2.baseVal.value);
      const rx = group.querySelector('[data-body-retrograde]');
      const path = group.querySelector('[data-body-leader]');
      let leader = null;
      if (path) {
        const d = path.getAttribute('d');
        if (/[^ML\s\d.,eE+\-]/.test(d)) throw new Error('Expected the measured polyline leader contract');
        const values = d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number);
        leader = [];
        for (let i = 0; i < values.length; i += 2) leader.push(point(path, values[i], values[i + 1]));
      }
      return { id: group.dataset.entity.slice(5), ...p, r: box.width / 2, stroke: stroke(marker),
        glyph: bounds(glyph), rx: rx ? bounds(rx) : null, tick, leader,
        trueLon: ((anchor + Math.atan2(center.y - tick.y, tick.x - center.x) * 180 / Math.PI - 180) % 360 + 360) % 360 };
    });
    const aspectErrors = [];
    const aspectGroups = [...svg.querySelectorAll('g[data-entity^="aspect:"]')];
    for (const group of aspectGroups) {
      const match = /^aspect:(.+)-(?:conjunction|sextile|square|trine|opposition)-(.+)$/.exec(group.dataset.entity);
      const line = group.querySelector(':scope > line');
      if (!match || !line) continue;
      for (const [name, x, y] of [[match[1], line.x1.baseVal.value, line.y1.baseVal.value], [match[2], line.x2.baseVal.value, line.y2.baseVal.value]]) {
        const body = bodies.find((item) => item.id === name), endpoint = point(line, x, y);
        const tickAngle = Math.atan2(body.tick.y - center.y, body.tick.x - center.x);
        const aspectAngle = Math.atan2(endpoint.y - center.y, endpoint.x - center.x);
        if (Math.abs(Math.sin(tickAngle - aspectAngle)) > 1e-6 || Math.cos(tickAngle - aspectAngle) < 0) aspectErrors.push(group.dataset.entity);
      }
    }
    return { center, bodies, aspectErrors, aspectCount: aspectGroups.length, svgWidth: svg.getBoundingClientRect().width,
      viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height },
      scale: svg.getBoundingClientRect().width / viewBox.width };
  }, { anchor: fixture.anchor });
}

async function chooseWithKeys(page, id) {
  const picker = page.locator('[data-explorer-entity-picker]');
  const index = await picker.locator('option').evaluateAll((options, value) => options.findIndex((option) => option.value === value), id);
  if (index < 0) throw new Error(`Missing native entity: ${id}`);
  await picker.focus();
  await picker.press('Home');
  for (let step = 0; step < index; step += 1) await picker.press('ArrowDown');
  await picker.press('Enter');
  await page.waitForFunction((value) => document.querySelector('[data-explorer-entity-picker]')?.value === value
    && new URLSearchParams(location.search).get('sel') === (value || null), id, { timeout: TIMEOUT });
}

async function selectionMatches(page, body, keyboard) {
  return page.evaluate(({ body, keyboard }) => {
    const id = `body:${body}`, picker = document.querySelector('[data-explorer-entity-picker]');
    const group = [...document.querySelectorAll('.wheel--interactive g[data-entity]')].find((node) => node.dataset.entity === id);
    const marker = group?.querySelector('[data-body-marker]'), ring = group?.querySelector('.wheel__sel-ring');
    return picker?.value === id && new URLSearchParams(location.search).get('sel') === id
      && group?.dataset.selected === 'true' && Boolean(ring)
      && ring.cx.baseVal.value === marker.cx.baseVal.value && ring.cy.baseVal.value === marker.cy.baseVal.value
      && document.querySelector('[data-inspector-heading]')?.textContent?.includes(body)
      && document.querySelector('.calc__wheel .sr-only[role="status"]')?.textContent?.includes(body)
      && (!keyboard || document.activeElement === picker);
  }, { body, keyboard });
}

async function checkPointersAndKeys(page, snapshot, label, check) {
  const pointerFailures = [], keyboardFailures = [];
  for (const body of snapshot.bodies) {
    const radial = { x: body.x - snapshot.center.x, y: body.y - snapshot.center.y };
    const radius = Math.hypot(radial.x, radial.y);
    for (const offset of [0, -0.72, 0.72]) {
      // Clear the toggle and mobile Inspector before each independent tap.
      await page.locator('.xplr__wheelbox').press('Escape');
      await page.locator('.wheel--interactive').scrollIntoViewIfNeeded();
      const screen = await page.locator('.wheel--interactive').evaluate((svg, point) => {
        const p = new DOMPoint(point.x, point.y).matrixTransform(svg.getScreenCTM());
        return { x: p.x, y: p.y };
      }, { x: body.x - radial.y / radius * body.r * offset, y: body.y + radial.x / radius * body.r * offset });
      await page.mouse.click(screen.x, screen.y);
      await page.waitForFunction((id) => new URLSearchParams(location.search).get('sel') === id, `body:${body.id}`, { timeout: TIMEOUT });
      if (!await selectionMatches(page, body.id, false)) pointerFailures.push(`${body.id}@${offset}`);
    }
    await chooseWithKeys(page, `body:${body.id}`);
    if (!await selectionMatches(page, body.id, true)) keyboardFailures.push(body.id);
  }
  check(`${label}: marker centers and both interior edges resolve to the same body, URL and selection ring`, pointerFailures.length === 0, JSON.stringify(pointerFailures));
  check(`${label}: native keyboard choices preserve body IDs, Inspector correspondence and focus`, keyboardFailures.length === 0, JSON.stringify(keyboardFailures));
}

export async function runExplorerCrowdedWheelChecks({ browser, baseURL, check, outDir }) {
  const output = outDir ? `${outDir}/crowded-wheel` : null;
  if (output) await mkdir(output, { recursive: true });
  const measurements = [];
  for (const width of [390, 1440]) for (const fixture of fixtures) {
    const label = `crowded ${fixture.slug} ${width}`;
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    try {
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      const response = await page.goto(`${baseURL}/birth-chart/${fixture.fragment}`, { waitUntil: 'domcontentloaded' });
      if (response?.status() !== 200) throw new Error(`${label}: HTTP ${response?.status()}`);
      await page.locator('[data-explorer-entity-picker]').waitFor({ state: 'visible', timeout: TIMEOUT });
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const snapshot = await renderedGeometry(page, fixture);
      const observed = inspectCrowdedGeometry(snapshot);
      check(`${label}: actual stroked marker and ink bounds remain separated`, observed.failures.length === 0, JSON.stringify(observed));
      check(`${label}: true ticks, retrograde flags and true aspect endpoints preserve the committed reference`,
        snapshot.bodies.length === 11 && new Set(snapshot.bodies.map((body) => body.id)).size === 11
        && snapshot.aspectCount > 0 && snapshot.aspectErrors.length === 0 && fixture.bodies.every((source) => {
          const actual = snapshot.bodies.find((body) => body.id === source.body);
          return actual && angleDistance(actual.trueLon, source.lon) <= fixture.tolerance && Boolean(actual.rx) === source.retrograde;
        }), JSON.stringify({ aspectErrors: snapshot.aspectErrors, svgWidth: snapshot.svgWidth, viewBox: snapshot.viewBox }));
      const values = await page.locator('[data-explorer-entity-picker] option').evaluateAll((options) => options.map((option) => option.value));
      check(`${label}: native chart IDs bijectively retain all visible bodies and only available angles/houses`,
        values.filter((id) => id.startsWith('body:')).length === snapshot.bodies.length
        && snapshot.bodies.every((body) => values.includes(`body:${body.id}`))
        && values.some((id) => id.startsWith('house:')) === fixture.known
        && values.some((id) => id.startsWith('angle:')) === fixture.known);
      await checkPointersAndKeys(page, snapshot, label, check);
      if (!fixture.known) {
        await chooseWithKeys(page, 'body:Moon');
        const text = await page.locator('.calc__wheel .sr-only[role="status"]').innerText();
        const uncertain = page.locator('.calc__three [data-moon-uncertain]');
        // The calculator names the Moon's signs only from the birth date's own
        // limits (src/lib/moon-day-bounds.ts) and otherwise leaves it
        // unresolved. `fixture.moon.signAtCivilDayStart/End` are the People
        // pilot's own analysis of the same date: whatever the page names must
        // be exactly those signs, and one sign only where the two agree.
        const daySigns = [...new Set([fixture.moon.signAtCivilDayStart, fixture.moon.signAtCivilDayEnd])]
          .map((slug) => slug[0].toUpperCase() + slug.slice(1));
        const sameSigns = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
        const uncertainCount = await uncertain.count();
        const uncertainText = uncertainCount ? await uncertain.innerText() : '';
        const degreeCount = uncertainCount ? await uncertain.locator('.three-card__deg').count() : -1;
        const heroMoon = await page.locator('.calc__three .three-card').nth(1).innerText();
        const shown = namesIn(uncertainCount ? uncertainText : heroMoon);
        check(`${label}: reference Moon never invents a known birth time or a sign beyond the date's own`,
          await page.locator('#birth-time').inputValue() === ''
          && (uncertainCount === 1
            // Unresolved: no sign, or both of a date the Moon changed sign on.
            ? text.includes('Needs a birth time') && uncertainText.includes('Needs a birth time') && degreeCount === 0
              && (shown.length === 0 || (daySigns.length === 2 && sameSigns(shown, daySigns)))
            // Settled: the one sign the Moon held through the whole date.
            : uncertainCount === 0 && daySigns.length === 1 && sameSigns(shown, daySigns))
          && sameSigns(namesIn(text), shown),
          JSON.stringify({ text, uncertainText, heroMoon, uncertainCount, degreeCount, daySigns, names: namesIn(text) }));
      }
      await chooseWithKeys(page, '');
      if (output) await page.locator('.calc__wheel').screenshot({ path: `${output}/${fixture.slug}-${width}.png`, animations: 'disabled' });
      measurements.push({ fixture: fixture.slug, width, lens: 'natal', referenceOnly: !fixture.known, ...snapshot, ...observed });
      if (fixture.known) {
        await page.locator('[data-lens-btn="sky"]').click();
        await page.waitForFunction(() => Number(document.querySelector('.wheel--interactive')?.viewBox.baseVal.x) < -30, null, { timeout: TIMEOUT });
        await page.waitForLoadState('networkidle');
        const overlay = await renderedGeometry(page, fixture);
        const overlayCheck = inspectCrowdedGeometry(overlay);
        // Preserve measured geometry and the actual view even if input checks throw.
        measurements.push({ fixture: fixture.slug, width, lens: 'sky', ...overlay, ...overlayCheck });
        if (output) await page.locator('.calc__wheel').screenshot({ path: `${output}/${fixture.slug}-sky-${width}.png`, animations: 'disabled' });
        check(`${label}: added sky-ring padding preserves crowded natal geometry`, overlayCheck.failures.length === 0, JSON.stringify(overlayCheck));
        await checkPointersAndKeys(page, overlay, `${label} sky lens`, check);
        await chooseWithKeys(page, '');
        if (output) await page.locator('.calc__wheel').screenshot({ path: `${output}/${fixture.slug}-sky-${width}.png`, animations: 'disabled' });
      }
      check(`${label}: no browser errors`, errors.length === 0, JSON.stringify(errors));
    } finally {
      await context.close();
      if (output) await writeFile(`${output}/measurements.json`, `${JSON.stringify(measurements, null, 2)}\n`);
    }
  }
}
