import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Guards the shared entrance motion (docs/MOTION.md): marks always arrive;
// cards, tiles and rows may rise once on pages people visit occasionally;
// words, controls, heroes and results never wait; daily pages never move.

const root = new URL('../', import.meta.url);
const srcDir = fileURLToPath(root);
const source = async (relativePath: string): Promise<string> => readFile(
  fileURLToPath(new URL(relativePath, root)),
  'utf8',
);

const ALLOWED_PROPERTIES = new Set(['opacity', 'transform', 'stroke-dashoffset', 'none']);
// Tags that are never marked: reading text, headings, forms and controls,
// disclosures, whole sections, and hero pictures (LCP).
const NEVER_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'button', 'input', 'select', 'textarea', 'label', 'form',
  'summary', 'details',
  'section', 'article', 'main', 'header',
  'img', 'picture', 'video',
]);
// Pages opened daily: no entrance motion at all.
const DAILY_PATHS = [
  'pages/today/',
  'pages/horoscopes/',
  'components/HoroscopeProgramPage.astro',
  'islands/today/',
  'components/localized/LocalizedToday.astro',
  'components/localized/LocalizedHoroscope.astro',
];
// A result the person asked for keeps the settled 200 ms arrival in base.css.
const RESULT_CLASS = /\bclass(?:Name)?=\{?\s*["'`][^"'`]*(calc__result|sr-result|three-card)/u;
// Files that broke the rule on main before this guard existed. Their offences
// are listed, not allowed: any other file that breaks the rule still fails.
// Merged before the guard existed; to be fixed in their own PRs.
const KNOWN_ON_MAIN = [
  // Big Three's result: div.three-card (rise) and picture.three-card__icon (disc).
  'islands/BigThreeQuick.tsx',
];
const isKnownOnMain = (offender: string): boolean => KNOWN_ON_MAIN.some((file) => offender.startsWith(`${file}: `));
const RULE = 'Marks always arrive; cards, tiles and rows may rise on occasional pages; never paragraphs, headings, forms, buttons, details, sections, heroes or results. See docs/MOTION.md.';
const DAILY_RULE = 'Daily pages (Today, the horoscope hub, sign horoscopes) have no entrance motion. See docs/MOTION.md.';
const RESULT_RULE = 'A result the person asked for keeps its own 200 ms arrival in base.css; never mark it. See docs/MOTION.md.';

async function markupFiles(): Promise<string[]> {
  const entries = await readdir(srcDir, { recursive: true });
  return entries
    .map((entry) => String(entry))
    .filter((entry) => /\.(astro|tsx)$/u.test(entry) && !/\.test\./u.test(entry))
    .sort();
}

describe('entrance motion contract', () => {
  it('moves only opacity, transform and stroke-dashoffset, once, and stills for reduced motion and print', async () => {
    const css = await source('styles/motion.css');
    const values = [...css.matchAll(/\btransition(?:-property)?\s*:\s*([^;{}]+);/gu)];
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      const properties = value[1]
        .split(',')
        .map((part) => part.trim().match(/^([a-z-]+)/iu)?.[1])
        .filter((property): property is string => Boolean(property));
      expect(properties, value[0]).not.toHaveLength(0);
      expect(properties.every((property) => ALLOWED_PROPERTIES.has(property)), value[0]).toBe(true);
    }
    expect(css).not.toContain('infinite');
    expect(css).not.toContain('@keyframes');
    expect(css).not.toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('print');
  });

  it('keeps the runtime safeguards in Motion.astro', async () => {
    const runtime = await source('components/Motion.astro');
    for (const needle of ['boundingClientRect.bottom <= 0', 'threshold: 0', '3000', 'setInterval', '}, 50);', 'transitionend', 'catch', 'MAX_STEP = 4']) {
      expect(runtime, needle).toContain(needle);
    }
  });

  it('never marks words, controls, sections, heroes or components', async () => {
    const offenders: string[] = [];
    for (const file of await markupFiles()) {
      const text = await readFile(`${srcDir}${file}`, 'utf8');
      for (const match of text.matchAll(/<([A-Za-z][\w.]*)\b[^<>]*?\bdata-enter=/gs)) {
        const tag = match[1];
        if (/^[A-Z]/u.test(tag) || tag.includes('.')) offenders.push(`${file}: <${tag}> (component)`);
        else if (NEVER_TAGS.has(tag.toLowerCase())) offenders.push(`${file}: <${tag}>`);
      }
    }
    expect(offenders.filter((offender) => !isKnownOnMain(offender)), RULE).toEqual([]);
  });

  it('never marks anything on the daily pages', async () => {
    const offenders: string[] = [];
    for (const daily of DAILY_PATHS) {
      const full = `${srcDir}${daily}`;
      const info = await stat(full).catch(() => null);
      if (!info) continue;
      const files = info.isDirectory()
        ? (await readdir(full, { recursive: true })).map((entry) => `${daily}${String(entry)}`)
        : [daily];
      for (const file of files) {
        const fileInfo = await stat(`${srcDir}${file}`);
        if (!fileInfo.isFile()) continue;
        const text = await readFile(`${srcDir}${file}`, 'utf8');
        if (text.includes('data-enter=')) offenders.push(file);
      }
    }
    expect(offenders, DAILY_RULE).toEqual([]);
  });

  it('never marks a result block', async () => {
    const offenders: string[] = [];
    for (const file of await markupFiles()) {
      const text = await readFile(`${srcDir}${file}`, 'utf8');
      for (const match of text.matchAll(/<([A-Za-z][\w.]*)\b[^<>]*?>/gs)) {
        if (!match[0].includes('data-enter=')) continue;
        const result = match[0].match(RESULT_CLASS);
        if (result) offenders.push(`${file}: <${match[1]}> .${result[1]}`);
      }
    }
    expect(offenders.filter((offender) => !isKnownOnMain(offender)), RESULT_RULE).toEqual([]);
  });

  it('never spreads motion() into JSX', async () => {
    for (const file of await markupFiles()) {
      const text = await readFile(`${srcDir}${file}`, 'utf8');
      expect(/\{\s*\.\.\.motion\(/u.test(text), `${file}: ${RULE}`).toBe(false);
    }
  });
});
