/**
 * The compatibility hub's card art (owner-chosen 2026-11-28): two of the
 * site's own chart wheels, a small one tucked against a large one that runs
 * off the right edge, on the void.
 *
 *   npx vite-node --script scripts/build-compatibility-wheels-art.ts
 *
 * Each wheel is the real <Wheel> (src/lib/wheel/Wheel.tsx) with the props the
 * People page gives it (src/pages/people/[slug].astro): Alan Turing's noon
 * reference chart large, Ada Lovelace's small. Chromium draws each one on a
 * transparent page; the wheel's sign band is translucent (stroke-opacity
 * 0.12), so every pixel's alpha is raised to the power 0.45 to let the band
 * read at card size; then the two are laid on a 2400 × 1600 void canvas
 * (Turing 2100 px at (1150, -250), Lovelace 1050 px at (560, 420)) and the
 * result is written at half size as public/assets/art/compatibility-wheels-1200.webp,
 * which src/lib/og-art-cards.mjs places on the card. Chromium and libwebp
 * output, so not in the drift job; rerun it when the wheel or either
 * person's published chart changes, then `npm run data:og -- --only-art-page-cards`.
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

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUTPUT = resolve(root, 'public/assets/art/compatibility-wheels-1200.webp');
const VOID = '#050608';
const CANVAS = { width: 2400, height: 1600 };
/** Alpha raised to this power, so the translucent sign band reads at card size. */
const ALPHA_POWER = 0.45;
/** Back to front: the large wheel runs off the right edge, the small one sits against it. */
const WHEELS = [
  { slug: 'alan-turing', size: 2100, left: 1150, top: -250 },
  { slug: 'ada-lovelace', size: 1050, left: 560, top: 420 },
] as const;

/** The wheel exactly as the person's page renders it, minus the entrance animation. */
function wheelMarkup(slug: string): string {
  const person = PEOPLE_BY_SLUG.get(slug);
  if (!person) throw new Error(`build-compatibility-wheels-art: no published person ${slug}`);
  const markup = render(h(Wheel as any, {
    bodies: person.placements.map((placement) => ({ body: placement.body, lon: placement.longitude, retrograde: placement.retrograde })),
    aspects: person.aspectsStableAcrossCivilDay.map((aspect) => ({ a: aspect.a, b: aspect.b, type: aspect.type })),
    ariaLabel: `Time-unknown chart wheel for ${person.displayName}`,
  }));
  // The sign discs are site paths; the page here has no origin, so inline them.
  return markup.replace(/href="(\/assets\/zodiac-icons\/[^"]+\.webp)"/gu, (_match, path: string) => (
    `href="data:image/webp;base64,${readFileSync(resolve(root, `public${path}`)).toString('base64')}"`
  ));
}

const MONO = readFileSync(resolve(root, 'public/fonts/jetbrains-mono-latin-wght-normal.woff2')).toString('base64');
const browser = await chromium.launch();
try {
  const layers = [];
  for (const wheel of WHEELS) {
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
  const composite = await sharp({ create: { ...CANVAS, channels: 3, background: VOID } }).composite(layers).png().toBuffer();
  const written = await sharp(composite).resize({ width: CANVAS.width / 2 }).webp({ quality: 86, effort: 6 }).toFile(OUTPUT);
  console.log(`build-compatibility-wheels-art: ${written.width} × ${written.height}, ${(written.size / 1024).toFixed(0)}KB`);
} finally {
  await browser.close();
}
