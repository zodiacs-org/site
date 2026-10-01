/**
 * Responsive layout drive for the primary consumer pages. It captures every
 * route at the two owner-specified widths, checks controls for viewport escape
 * and clipping, and exercises the birthplace autocomplete where it sits above
 * a calculator action.
 *
 *   npm run build
 *   OUT_DIR=/tmp/zodiacs-layout PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium \
 *     node tests/layout-qa-drive.mjs
 *
 * Point BASE_URL at an existing Astro server to skip spawning `astro preview`.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';

const OUT = process.env.OUT_DIR ?? null;
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium';
const EXTERNAL_BASE = process.env.BASE_URL?.replace(/\/$/, '') ?? null;
const BASE = EXTERNAL_BASE ?? 'http://127.0.0.1:4398';

const ROUTES = [
  ['home', '/'],
  ['birth-chart', '/birth-chart/'],
  ['compatibility', '/compatibility/'],
  ['transits', '/transits/'],
  ['moon-sign', '/moon-sign/'],
  ['rising-sign', '/rising-sign/'],
  ['moon-phase', '/moon-phase/'],
  ['saturn-return', '/saturn-return/'],
  ['birthday', '/birthday/'],
  ['profile', '/profile/'],
  ['learn', '/learn/'],
  ['about', '/about/'],
  ['methodology', '/methodology/'],
  ['learn-planets', '/learn/planets/'],
  ['es-home', '/es/'],
  ['es-birth-chart', '/es/birth-chart/'],
  ['es-compatibility', '/es/compatibility/'],
  ['es-transits', '/es/transits/'],
  ['es-moon-sign', '/es/moon-sign/'],
  ['es-rising-sign', '/es/rising-sign/'],
  ['es-moon-phase', '/es/moon-phase/'],
  ['es-saturn-return', '/es/saturn-return/'],
  ['es-profile', '/es/profile/'],
  ['es-learn', '/es/learn/'],
  ['es-methodology', '/es/methodology/'],
  ['es-learn-planets', '/es/learn/planets/'],
];

const OPEN_STATES = [
  ['compatibility', '/compatibility/', '#syn-b-place', '#syn-b-place-list', '.syn__slots'],
  ['transits', '/transits/', '#trans-place', '#trans-place-list', '.trans__grid'],
  ['es-compatibility', '/es/compatibility/', '#syn-b-place', '#syn-b-place-list', '.syn__slots'],
  ['es-transits', '/es/transits/', '#trans-place', '#trans-place-list', '.trans__grid'],
];

if (OUT) await mkdir(OUT, { recursive: true });

const preview = EXTERNAL_BASE
  ? null
  : spawn('npx', ['astro', 'preview', '--host', '127.0.0.1', '--port', '4398'], { stdio: 'ignore' });
if (preview) await wait(2500);

const results = [];
const findings = [];
const buttonAudit = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const recordFinding = (route, width, kind, detail) => findings.push({ route, width, kind, detail });

function safeName(value) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

async function capture(page, name, { fullPage = true } = {}) {
  if (!OUT) return;
  await page.screenshot({ path: `${OUT}/${safeName(name)}.png`, fullPage });
}

async function inspectPage(page, routeName, width) {
  const report = await page.evaluate(() => {
    const root = document.documentElement;
    const main = document.querySelector('main');
    const visible = (element) => {
      if (element.closest('details:not([open])') && !element.closest('summary')) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden'
        && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const selector = 'button, a.btn, input, select, textarea';
    const controls = main ? [...main.querySelectorAll(selector)].filter(visible) : [];
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    const labelOf = (element) => element.id
      ? `${element.tagName.toLowerCase()}#${element.id}`
      : `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}:${(element.textContent ?? '').trim().slice(0, 36)}`;
    const escaped = controls
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1;
      })
      .map((element) => ({ control: labelOf(element), ...rectOf(element) }));
    const clipped = controls
      .filter((element) => element.matches('button, a.btn')
        && element.scrollWidth > element.clientWidth + 1
        && !element.matches('[data-allow-clip], [data-demo-target]'))
      .map((element) => ({
        control: labelOf(element), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
      }));
    const overlaps = [];
    for (let i = 0; i < controls.length; i += 1) {
      const a = controls[i];
      const ar = a.getBoundingClientRect();
      for (let j = i + 1; j < controls.length; j += 1) {
        const b = controls[j];
        if (a.contains(b) || b.contains(a)) continue;
        // Plotted chart hit areas may intersect; their dedicated drive verifies
        // pointer centers and keyboard navigation rather than text-box geometry.
        if (a.matches('[data-demo-target]') && b.matches('[data-demo-target]')) continue;
        const br = b.getBoundingClientRect();
        const x = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
        const y = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
        if (x > 2 && y > 2) overlaps.push(`${labelOf(a)} × ${labelOf(b)}`);
      }
    }
    const variants = [...document.querySelectorAll('.btn--glass, .btn--ghost')]
      .filter(visible)
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          variant: element.classList.contains('btn--glass') ? 'glass' : 'ghost',
          text: (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60),
          color: style.color,
          backgroundColor: style.backgroundColor,
          opacity: style.opacity,
          textDecoration: style.textDecorationLine,
        };
      });
    return {
      documentWidth: root.scrollWidth,
      viewportWidth: innerWidth,
      escaped,
      clipped,
      overlaps,
      variants,
    };
  });

  const noOverflow = report.documentWidth <= report.viewportWidth + 1;
  check(`${routeName} ${width}px: no page-level horizontal overflow`, noOverflow,
    `${report.documentWidth}px document / ${report.viewportWidth}px viewport`);
  check(`${routeName} ${width}px: controls stay inside viewport`, report.escaped.length === 0,
    JSON.stringify(report.escaped.slice(0, 3)));
  check(`${routeName} ${width}px: button labels are not clipped`, report.clipped.length === 0,
    JSON.stringify(report.clipped.slice(0, 3)));
  check(`${routeName} ${width}px: interactive controls do not overlap`, report.overlaps.length === 0,
    report.overlaps.slice(0, 3).join(' | '));

  if (!noOverflow) recordFinding(routeName, width, 'horizontal-overflow', `${report.documentWidth}px / ${report.viewportWidth}px`);
  for (const detail of report.escaped) recordFinding(routeName, width, 'control-outside-viewport', detail);
  for (const detail of report.clipped) recordFinding(routeName, width, 'clipped-button', detail);
  for (const detail of report.overlaps) recordFinding(routeName, width, 'overlapping-controls', detail);
  buttonAudit.push(...report.variants.map((entry) => ({ route: routeName, width, ...entry })));
}

function channel(value) {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function contrast(rgbA, rgbB) {
  const parse = (rgb) => (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const luminance = (rgb) => {
    const [r, g, b] = parse(rgb).map(channel);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(rgbA);
  const b = luminance(rgbB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function inspectAboutCta(page, width) {
  await page.goto(`${BASE}/about/`, { waitUntil: 'networkidle' });
  const cta = await page.locator('.about-cta .btn--primary').evaluate((element) => {
    const style = getComputedStyle(element);
    const label = element.querySelector(':scope > :not(.orb)');
    const labelStyle = label ? getComputedStyle(label) : null;
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      labelColor: labelStyle?.color ?? null,
      textDecoration: style.textDecorationLine,
    };
  });
  const buttonRatio = contrast(cta.color, cta.backgroundColor);
  const labelRatio = cta.labelColor ? contrast(cta.labelColor, cta.backgroundColor) : 0;
  check(`about ${width}px: primary CTA text meets contrast`, buttonRatio >= 4.5,
    `${buttonRatio.toFixed(2)}:1 · ${cta.color} on ${cta.backgroundColor}`);
  check(`about ${width}px: primary CTA label meets contrast`, labelRatio >= 4.5,
    `${labelRatio.toFixed(2)}:1 · ${cta.labelColor ?? 'missing'} on ${cta.backgroundColor}`);
  check(`about ${width}px: CTA is not styled as a prose link`, cta.textDecoration === 'none', cta.textDecoration);
  if (buttonRatio < 4.5) recordFinding('about', width, 'cta-contrast', `${buttonRatio.toFixed(2)}:1 · ${cta.color} on ${cta.backgroundColor}`);
  if (labelRatio < 4.5) recordFinding('about', width, 'cta-label-contrast', `${labelRatio.toFixed(2)}:1 · ${cta.labelColor ?? 'missing'} on ${cta.backgroundColor}`);
}

async function inspectAutocomplete(page, routeName, path, inputSelector, listSelector, flowSelector, width) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  const closed = await page.evaluate(({ flowSelector }) => {
    const flow = document.querySelector(flowSelector)?.getBoundingClientRect();
    const submit = document.querySelector('.calc__submit')?.getBoundingClientRect();
    return flow && submit ? submit.top - flow.bottom : null;
  }, { flowSelector });
  check(`${routeName} ${width}px: calculator action has a flow gap`, closed !== null && closed >= 16,
    `${closed?.toFixed(1) ?? 'missing'}px`);
  if (closed !== null && closed < 16) recordFinding(routeName, width, 'missing-action-gap', `${closed.toFixed(1)}px`);

  await page.locator(inputSelector).fill('Bang');
  await page.locator(listSelector).waitFor({ state: 'visible', timeout: 5000 });
  const open = await page.evaluate(({ listSelector }) => {
    const list = document.querySelector(listSelector);
    const submit = document.querySelector('.calc__submit');
    const lr = list?.getBoundingClientRect();
    const sr = submit?.getBoundingClientRect();
    return {
      position: list ? getComputedStyle(list).position : null,
      intersectsSubmit: Boolean(lr && sr && lr.left < sr.right && lr.right > sr.left
        && lr.top < sr.bottom && lr.bottom > sr.top),
    };
  }, { listSelector });
  check(`${routeName} ${width}px: open autocomplete stays in document flow`, open.position !== 'absolute', open.position ?? 'missing');
  check(`${routeName} ${width}px: open autocomplete does not cover submit`, !open.intersectsSubmit);
  if (open.position === 'absolute') recordFinding(routeName, width, 'autocomplete-out-of-flow', open.position);
  if (open.intersectsSubmit) recordFinding(routeName, width, 'autocomplete-covers-submit', true);
  // Keep the open-state evidence focused on the form: list, following field
  // content, and submit control all remain legible in one image. Element
  // screenshots scroll their target to the viewport top, so temporarily hide
  // the fixed nav that would otherwise cover the form only in the evidence
  // capture (it occupies no document flow in production).
  if (OUT) {
    const form = page.locator('.calc__form');
    const originalViewport = page.viewportSize();
    const formHeight = await form.evaluate((element) => element.getBoundingClientRect().height);
    if (originalViewport && formHeight + 40 > originalViewport.height) {
      await page.setViewportSize({ width: originalViewport.width, height: Math.ceil(formHeight + 40) });
    }
    const evidenceStyle = await page.addStyleTag({ content: '.nav-wrap { display: none !important; }' });
    try {
      await page.waitForTimeout(50);
      await form.screenshot({
        path: `${OUT}/${safeName(`${routeName}-${width}-autocomplete-open`)}.png`,
      });
    } finally {
      await evidenceStyle.evaluate((element) => element.remove());
      if (originalViewport) await page.setViewportSize(originalViewport);
    }
  }
}

let browser;
try {
  browser = await chromium.launch({ executablePath: CHROMIUM });
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width === 375 ? 812 : 1100 }, deviceScaleFactor: 1 });
    // The production reduced-motion branch renders every reveal immediately;
    // use it so full-page evidence contains below-the-fold sections instead of
    // capturing elements before their IntersectionObserver entry.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('requestfailed', (request) => {
      if (request.url().startsWith(BASE)) pageErrors.push(`request failed: ${request.url()}`);
    });

    for (const [routeName, path] of ROUTES) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      await inspectPage(page, routeName, width);
      await capture(page, `${routeName}-${width}`);
    }

    await inspectAboutCta(page, width);
    for (const state of OPEN_STATES) await inspectAutocomplete(page, ...state, width);
    check(`${width}px sweep: no page errors or same-origin failures`, pageErrors.length === 0,
      pageErrors.slice(0, 3).join(' | '));
    await page.close();
  }
} finally {
  await browser?.close();
  preview?.kill();
}

const report = { generatedAt: new Date().toISOString(), routes: ROUTES, findings, buttonAudit, results };
if (OUT) await writeFile(`${OUT}/layout-report.json`, `${JSON.stringify(report, null, 2)}\n`);

let failed = 0;
for (const result of results) {
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` · ${result.detail}` : ''}`);
}
console.log(`\n${results.length - failed} passed · ${failed} failed · ${findings.length} finding(s)`);
process.exit(failed ? 1 : 0);
