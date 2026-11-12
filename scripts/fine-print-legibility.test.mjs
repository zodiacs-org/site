// Fine print stays readable (accessibility audit M3 and M4).
//
// M3: the hero and sign-art credit lines sit over imagery, so they must be an
// opaque colour that reaches 4.5:1 against the darkest void, before any art.
// M4: privacy notes, receipts, credits and the nav menu's descriptions and
// dates never drop below a 12px floor on consumer surfaces.
//
// Wing lanes (registry, terminal, aura, wallet, fomo) and the AI tool panels
// style themselves and are out of scope here.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FLOOR_PX = 12;
const MIN_CONTRAST = 4.5;

const OUT_OF_SCOPE = [
  /^src\/(?:ai-tools|exchange|registry|shelf|terminal|trade)\//u,
  /^src\/islands\/aura\//u,
  /^src\/pages\/(?:astrofolio\/how-to-buy|fomo|registry|terminal)\//u,
  /^src\/styles\/(?:registry-aura|wallet-chart)\.css$/u,
];

const FINE_PRINT = /(?:privacy|__fine\b|\bev-fine\b|receipt|credit|disclaimer)/iu;

// Small text the audit named outside the fine-print naming pattern.
const NAMED_SMALL_TEXT = [
  ['src/components/SiteNav.astro', '.tools-menu__desc'],
  ['src/components/SiteNav.astro', '.signs-menu__dates'],
  ['src/components/events/UpcomingEventLinks.astro', '.upcoming-events time'],
  ['src/styles/base.css', '.zsearch__foot'],
];

const CREDIT_LINES = [
  ['src/pages/index.astro', '.hero__credit'],
  ['src/home/home-first-paint.css', '.hero__credit'],
  ['src/components/localized/localized-home.css', '.lhero__credit'],
  ['src/components/SignGuideHero.astro', '.sg-hero__credit'],
  ['src/components/HoroscopeProgramPage.astro', '.hz-hero__credit'],
  ['src/components/localized/LocalizedHoroscope.astro', '.hzl-hero__credit'],
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const cssCache = new Map();
function css(file) {
  if (cssCache.has(file)) return cssCache.get(file);
  let source = readFileSync(join(ROOT, file), 'utf8');
  if (file.endsWith('.astro')) {
    source = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gu)].map((match) => match[1]).join('\n');
  }
  source = source.replace(/\/\*[\s\S]*?\*\//gu, '');
  cssCache.set(file, source);
  return source;
}

/** Innermost rules as [selector, body]; the at-rule prelude is dropped. */
function rules(source) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map((match) => [
    match[1].trim().split('\n').pop().trim(),
    match[2],
  ]);
}

function fontSizePx(body) {
  const match = body.match(/(?:^|;|\s)font-size:\s*([0-9.]+)(px|rem)\b/u);
  if (!match) return null;
  return match[2] === 'rem' ? Number(match[1]) * 16 : Number(match[1]);
}

const consumerStyleFiles = ['src']
  .flatMap((dir) => walk(join(ROOT, dir)))
  .map((path) => relative(ROOT, path).split('\\').join('/'))
  .filter((file) => /\.(?:css|astro)$/u.test(file))
  .filter((file) => !OUT_OF_SCOPE.some((pattern) => pattern.test(file)))
  .sort();

const tokens = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');

function resolveColor(value) {
  let current = value.trim();
  for (let depth = 0; depth < 6; depth += 1) {
    const ref = current.match(/^var\((--[\w-]+)\)$/u);
    if (!ref) break;
    const declared = tokens.match(new RegExp(`${ref[1]}:\\s*([^;]+);`, 'u'));
    if (!declared) throw new Error(`unknown token ${ref[1]}`);
    current = declared[1].trim();
  }
  const hex = current.match(/^#([0-9a-f]{6})$/iu);
  if (!hex) return null;
  return [0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16));
}

function luminance([r, g, b]) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('fine print legibility', () => {
  it('scans a real set of consumer style sources', () => {
    expect(consumerStyleFiles.length).toBeGreaterThan(50);
    expect(consumerStyleFiles).toContain('src/styles/calculator.css');
    expect(consumerStyleFiles).not.toContain('src/styles/registry-aura.css');
  });

  it(`keeps privacy notes, receipts and credits at ${FLOOR_PX}px or larger`, () => {
    const small = [];
    for (const file of consumerStyleFiles) {
      for (const [selector, body] of rules(css(file))) {
        if (!FINE_PRINT.test(selector)) continue;
        const size = fontSizePx(body);
        if (size !== null && size < FLOOR_PX) small.push(`${file}: ${selector} is ${size}px`);
      }
    }
    expect(small).toEqual([]);
  });

  it.each(NAMED_SMALL_TEXT)(`%s %s is at least ${FLOOR_PX}px`, (file, selector) => {
    const sizes = rules(css(file))
      .filter(([sel]) => sel.split(',').map((part) => part.trim()).includes(selector))
      .map(([, body]) => fontSizePx(body))
      .filter((size) => size !== null);
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(FLOOR_PX);
  });

  it.each(CREDIT_LINES)(`%s %s is opaque and at least ${MIN_CONTRAST}:1 on the darkest void`, (file, selector) => {
    const voidColor = resolveColor('var(--void-0)');
    const colors = rules(css(file))
      .filter(([sel]) => sel === selector)
      .map(([, body]) => body.match(/(?:^|;|\s)color:\s*([^;]+)/u)?.[1])
      .filter(Boolean);
    expect(colors.length).toBeGreaterThan(0);
    for (const value of colors) {
      const rgb = resolveColor(value);
      expect(rgb, `${selector} color ${value} must be an opaque token or hex`).not.toBeNull();
      expect(contrast(rgb, voidColor)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
});
