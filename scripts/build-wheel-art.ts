/**
 * The card art drawn from the site's own chart wheels, each on the void:
 *
 * - `public/assets/art/compatibility-wheels-1200.webp`, the compatibility
 *   hub's card (owner-chosen 2026-11-28): a small wheel tucked against a large
 *   one that runs off the right edge (Charles Eames 2100 px at (1150, -250),
 *   Ray Eames 1050 px at (560, 420)).
 * - `public/assets/art/chart-of-the-day-wheel-1200.webp`, the chart of the day
 *   card (owner-approved mockup, 2026-11-28): one large wheel running off the
 *   right edge (Frida Kahlo 1900 px at (950, -150)).
 * - `public/assets/art/group-charts-wheels-1200.webp`, the group charts card
 *   (owner-approved mockup, 2026-11-28): five overlapping wheels of 760 px
 *   (Marie Curie at (820, 60), John Lennon at (1380, 200), Virginia Woolf at
 *   (1080, 620), Albert Einstein at (1640, 780), Frida Kahlo at (560, 720)).
 * - `public/assets/art/birth-chart-wheel-1200.webp`, the birth chart card
 *   (owner-approved, 2026-11-28): the full wheel the birth chart result's sky
 *   lens draws (houses, ASC and MC, the natal bodies, and the transiting sky
 *   on the dashed outer ring with its chords to the natal bodies), 1670 px at
 *   (722, -15), over a faint glow in Libra's hue. Its chart is no one's: the
 *   developer demo's published preset (src/data/developer-demo.json,
 *   /developers/demo/), 15 June 1990, 14:30 in Paris, with Placidus houses,
 *   and the sky of the fixed instant BIRTH_CHART_SKY, so every run draws the
 *   same picture.
 *
 *   npx vite-node --script scripts/build-wheel-art.ts
 *
 * Each wheel is the real <Wheel> (src/lib/wheel/Wheel.tsx) with the props the
 * People page gives it (src/pages/people/[slug].astro), from the person's
 * published chart (the birth chart card's, as above). The cards and their alt text name no one. Chromium draws
 * each wheel on a transparent page; the wheel's sign band is translucent
 * (stroke-opacity 0.12), so every pixel's alpha is raised to the power 0.45
 * to let the band read at card size; then the wheels are laid, back to front,
 * on a 2400 × 1600 void canvas and the result is written at half size, which
 * src/lib/og-art-cards.mjs places on the card. Chromium and libwebp output,
 * so not in the drift job; rerun it when the wheel or any of these people's
 * published charts changes, then `npm run data:og -- --only-art-page-cards`.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import sharp from 'sharp';
import Wheel from '../src/lib/wheel/Wheel';
import { PEOPLE_BY_SLUG } from '../src/lib/people';
import { computeBodies, computeChart } from '../src/lib/engine/full';
import { findInterAspects } from '../src/lib/engine/synastry';
import { buildTransitOverlay } from '../src/lib/scene/overlay';
import { collisionNudge } from '../src/lib/scene/layout';
import { renderTransitOverlay } from '../src/islands/transit/renderTransitOverlay';
import { TRANSIT_ORB } from '../src/lib/transits';
import { SIGNS } from '../src/lib/signs';
import developerDemo from '../src/data/developer-demo.json';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const VOID = '#050608';
const CANVAS = { width: 2400, height: 1600 };
/** Alpha raised to this power, so the translucent sign band reads at card size. */
const ALPHA_POWER = 0.45;
/**
 * The birth chart card's wheel is not a person's: it is the developer demo's
 * preset chart (src/data/developer-demo.json, published on /developers/demo/),
 * a made-up birth on 15 June 1990 at 14:30 in Paris, with Placidus houses,
 * its ASC and MC, and the transiting sky of one fixed instant on the outer
 * ring, drawn as the birth chart result's sky lens draws it.
 */
const BIRTH_CHART = 'developer-demo-preset';
const BIRTH_CHART_SKY = new Date('2026-11-28T12:00:00Z');
const TRANSIT_BODIES = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);

interface PlacedWheel { slug: string; size: number; left: number; top: number }
/** A soft glow behind a wheel, in one sign's hue: its centre and radius on the canvas. */
interface Glow { hue: string; cx: number; cy: number; r: number; opacity: number }
/** Each picture's wheels, back to front, on the canvas. */
const PICTURES: readonly { output: string; glow?: Glow; wheels: readonly PlacedWheel[] }[] = [
  {
    output: 'public/assets/art/compatibility-wheels-1200.webp',
    wheels: [
      { slug: 'charles-eames', size: 2100, left: 1150, top: -250 },
      { slug: 'ray-eames', size: 1050, left: 560, top: 420 },
    ],
  },
  {
    output: 'public/assets/art/chart-of-the-day-wheel-1200.webp',
    wheels: [
      { slug: 'frida-kahlo', size: 1900, left: 950, top: -150 },
    ],
  },
  {
    output: 'public/assets/art/group-charts-wheels-1200.webp',
    wheels: [
      { slug: 'marie-curie', size: 760, left: 820, top: 60 },
      { slug: 'john-lennon', size: 760, left: 1380, top: 200 },
      { slug: 'virginia-woolf', size: 760, left: 1080, top: 620 },
      { slug: 'albert-einstein', size: 760, left: 1640, top: 780 },
      { slug: 'frida-kahlo', size: 760, left: 560, top: 720 },
    ],
  },
  // The birth chart card (owner-approved, 2026-11-28): the full wheel the
  // birth chart result draws, whole and large, with a faint glow in Libra's
  // hue (the brand ring's front sign) behind it.
  {
    output: 'public/assets/art/birth-chart-wheel-1200.webp',
    glow: { hue: SIGNS.find((sign) => sign.slug === 'libra')!.hue, cx: 1557, cy: 820, r: 900, opacity: 0.16 },
    wheels: [
      { slug: BIRTH_CHART, size: 1670, left: 722, top: -15 },
    ],
  },
];

/** The preset chart with its houses, angles and the fixed sky on the outer ring, as the transit ring draws it. */
function birthChartMarkup(): string {
  const { input } = developerDemo.chart;
  const utc = new Date(developerDemo.chart.answer.result.instant);
  const chart = computeChart({ utc, latitude: input.latitude, longitude: input.longitude, houseSystem: 'placidus', timeKnown: true });
  const bodies = chart.bodies.filter((b) => b.body !== 'South Node').map(({ body, lon, retrograde }) => ({ body, lon, retrograde }));
  const natal = chart.bodies.map(({ body, lon }) => ({ body, lon }));
  const sky = computeBodies(BIRTH_CHART_SKY).filter((b) => TRANSIT_BODIES.has(b.body)).map(({ body, lon, retrograde }) => ({ body, lon, retrograde }));
  const transiting = sky.filter((b) => b.body !== 'Moon').map(({ body, lon }) => ({ body, lon }));
  const hits = findInterAspects(transiting, natal).filter((hit) => hit.orb <= TRANSIT_ORB);
  const overlay = buildTransitOverlay('The sky', sky, hits, null);
  const natalDraw = collisionNudge(bodies);
  return render(h(Wheel as any, {
    bodies,
    asc: chart.angles?.asc ?? null,
    mc: chart.angles?.mc ?? null,
    cusps: chart.houses?.cusps ?? null,
    aspects: [],
    renderOverlay: (geo: any) => renderTransitOverlay(overlay, (name) => natalDraw.get(name) ?? null, () => {}, geo, {}),
    ariaLabel: 'A sample birth chart with the transiting sky',
  }));
}

/** The wheel exactly as the person's page renders it, minus the entrance animation. */
function wheelMarkup(slug: string): string {
  if (slug === BIRTH_CHART) return inlineDiscs(birthChartMarkup());
  const person = PEOPLE_BY_SLUG.get(slug);
  if (!person) throw new Error(`build-wheel-art: no published person ${slug}`);
  const markup = render(h(Wheel as any, {
    bodies: person.placements.map((placement) => ({ body: placement.body, lon: placement.longitude, retrograde: placement.retrograde })),
    aspects: person.aspectsStableAcrossCivilDay.map((aspect) => ({ a: aspect.a, b: aspect.b, type: aspect.type })),
    ariaLabel: `Time-unknown chart wheel for ${person.displayName}`,
  }));
  return inlineDiscs(markup);
}

/** The sign discs are site paths; the page here has no origin, so inline them. */
function inlineDiscs(markup: string): string {
  return markup.replace(/href="(\/assets\/zodiac-icons\/[^"]+\.webp)"/gu, (_match, path: string) => (
    `href="data:image/webp;base64,${readFileSync(resolve(root, `public${path}`)).toString('base64')}"`
  ));
}

const MONO = readFileSync(resolve(root, 'public/fonts/jetbrains-mono-latin-wght-normal.woff2')).toString('base64');
const browser = await chromium.launch();
try {
  for (const picture of PICTURES) {
    const layers = [];
    for (const wheel of picture.wheels) {
      const page = await browser.newPage({ viewport: { width: wheel.size, height: wheel.size }, deviceScaleFactor: 1 });
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
        @font-face { font-family: 'JetBrains Mono'; src: url(data:font/woff2;base64,${MONO}) format('woff2'); }
        :root { --font-mono: 'JetBrains Mono', monospace; }
        html, body { margin: 0; background: transparent; }
        svg { display: block; width: ${wheel.size}px; height: ${wheel.size}px; }
      </style></head><body>${wheelMarkup(wheel.slug)}</body></html>`, { waitUntil: 'load' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.querySelectorAll('image')].map((image) => new Promise((done) => {
          const probe = new Image();
          probe.onload = probe.onerror = done;
          probe.src = image.getAttribute('href') ?? '';
        })));
      });
      const shot = await page.locator('svg').screenshot({ omitBackground: true });
      await page.close();
      const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 3; i < data.length; i += 4) data[i] = Math.round(255 * (data[i] / 255) ** ALPHA_POWER);
      const raised = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
      // Crop what falls outside the canvas, so sharp can composite it.
      const left = Math.max(0, wheel.left);
      const top = Math.max(0, wheel.top);
      const width = Math.min(CANVAS.width, wheel.left + info.width) - left;
      const height = Math.min(CANVAS.height, wheel.top + info.height) - top;
      const input = await sharp(raised).extract({ left: left - wheel.left, top: top - wheel.top, width, height }).png().toBuffer();
      layers.push({ input, left, top });
    }
    if (picture.glow) {
      const { hue, cx, cy, r, opacity } = picture.glow;
      layers.unshift({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}"><defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${hue}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`), left: 0, top: 0 });
    }
    const composite = await sharp({ create: { ...CANVAS, channels: 3, background: VOID } }).composite(layers).png().toBuffer();
    const written = await sharp(composite).resize({ width: CANVAS.width / 2 }).webp({ quality: 86, effort: 6 }).toFile(resolve(root, picture.output));
    console.log(`build-wheel-art: ${picture.output}, ${written.width} × ${written.height}, ${(written.size / 1024).toFixed(0)}KB`);
  }
} finally {
  await browser.close();
}
