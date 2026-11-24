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
// Pages opened daily: no entrance motion at all. Any page whose path under
// src/pages starts with one of these folders, at the top level or directly
// under a locale folder (es/today/, [someLocale]/today/, [lang]/today/,
// [locale]/today/, [...locale]/today/), plus the components those pages are
// built from. Horoscope pages left this list on 2026-11-24, when the site
// owner chose calm motion there (docs/MOTION.md).
const DAILY_FOLDERS = new Set(['today']);
const LOCALE_FOLDER = /^(?:[a-z]{2}(?:-[a-z]{4})?|\[(?:\.\.\.)?\w*(?:[Ll]ocale|[Ll]ang)\])$/u;
const DAILY_COMPONENTS = [
  'islands/today/',
  'components/localized/LocalizedToday.astro',
];
// A result the person asked for keeps the settled 200 ms arrival in base.css.
const RESULT_CLASS = /\bclass(?:Name)?=\{?\s*["'`][^"'`]*(calc__result|sr-result|three-card)/u;
// Exact marks that break the rule on main and are waiting for their own fix.
// None now: the Big Three marks were removed in #1190. Anything that breaks
// the rule fails unless listed here exactly; another mark in a listed file
// fails too, and a listed mark that is gone from the source fails until its
// entry is deleted.
type Known = { file: string; tag: string; className: string; kind: string };
const KNOWN_ON_MAIN: Known[] = [];
const RULE = 'Marks always arrive; cards, tiles and rows may rise on occasional pages; never paragraphs, headings, forms, buttons, details, sections, heroes or results. See docs/MOTION.md.';
const DAILY_RULE = 'Daily pages (Today) have no entrance motion. See docs/MOTION.md.';
const RESULT_RULE = 'A result the person asked for keeps its own 200 ms arrival in base.css; never mark it. See docs/MOTION.md.';
const ISLAND_RULE = 'Islands render after the person acts; nothing in them is marked. See docs/MOTION.md.';

// Every spelling that could set the attribute: data-enter="..." and
// data-enter={...}, an object key ('data-enter': ...), setAttribute or
// toggleAttribute('data-enter', ...), and dataset.enter / dataset['enter'].
const MARK = /data-enter\s*=|['"`]data-enter['"`]\s*[:,)]|\bdataset\.enter\b|\bdataset\[\s*['"`]enter['"`]\s*\]/gu;

type Owner = { tag: string; text: string; classes: string[] };
type Mark = { file: string; line: number; kind: string; owner: Owner | null };

// Skips a quoted string (text[i] is the quote); returns the index after it.
function skipString(text: string, i: number): number {
  const quote = text[i];
  let j = i + 1;
  while (j < text.length) {
    const c = text[j];
    if (c === '\\') { j += 2; continue; }
    if (c === quote) return j + 1;
    if (quote === '`' && c === '$' && text[j + 1] === '{') { j = skipBraces(text, j + 1); continue; }
    j += 1;
  }
  return j;
}

// Skips a balanced {...} expression (text[i] is '{'), stepping over strings
// and comments; returns the index after the closing brace.
function skipBraces(text: string, i: number): number {
  let depth = 0;
  let j = i;
  while (j < text.length) {
    const c = text[j];
    if (c === '"' || c === "'" || c === '`') { j = skipString(text, j); continue; }
    if (c === '/' && text[j + 1] === '/') { const end = text.indexOf('\n', j); j = end < 0 ? text.length : end; continue; }
    if (c === '/' && text[j + 1] === '*') { const end = text.indexOf('*/', j + 2); j = end < 0 ? text.length : end + 2; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return j + 1;
    }
    j += 1;
  }
  return j;
}

// The index of the '>' that closes the opening tag starting at text[start]
// ('<'), stepping over {...} expressions and quoted values; -1 if none.
function tagEnd(text: string, start: number): number {
  let j = start + 1;
  while (j < text.length) {
    const c = text[j];
    if (c === '{') { j = skipBraces(text, j); continue; }
    if (c === '"' || c === "'") { j = skipString(text, j); continue; }
    if (c === '<') return -1;
    if (c === '>') return j;
    j += 1;
  }
  return -1;
}

// Walks back from a mark to the opening <tag whose attributes contain it.
function ownerOf(text: string, index: number): Owner | null {
  for (let i = index; i >= 0; i -= 1) {
    if (text[i] !== '<' || !/[A-Za-z]/u.test(text[i + 1] ?? '')) continue;
    const end = tagEnd(text, i);
    if (end < index) continue;
    const ownText = text.slice(i, end + 1);
    const tag = ownText.match(/^<([A-Za-z][\w.:-]*)/u)?.[1] ?? '';
    const classValue = ownText.match(/\bclass(?:Name)?=\{?\s*["'`]([^"'`]*)/u)?.[1] ?? '';
    return { tag, text: ownText, classes: classValue.split(/\s+/u).filter(Boolean) };
  }
  return null;
}

function marksIn(file: string, text: string): Mark[] {
  return [...text.matchAll(MARK)].map((match) => {
    const index = match.index ?? 0;
    return {
      file,
      line: text.slice(0, index).split('\n').length,
      kind: text.slice(index).match(/^data-enter\s*=\s*\{?\s*["'`]([\w-]+)/u)?.[1] ?? '?',
      owner: ownerOf(text, index),
    };
  });
}

const describeMark = (mark: Mark): string => (mark.owner
  ? `${mark.file}:${mark.line}: <${mark.owner.tag}${mark.owner.classes.length ? `.${mark.owner.classes[0]}` : ''}> ${mark.kind}`
  : `${mark.file}:${mark.line}: a mark outside any tag (mark the tag itself)`);
const matchesKnown = (mark: Mark, known: Known): boolean => mark.file === known.file
  && mark.owner !== null
  && mark.owner.tag === known.tag
  && mark.owner.classes.includes(known.className)
  && mark.kind === known.kind;
const isKnownOnMain = (mark: Mark): boolean => KNOWN_ON_MAIN.some((known) => matchesKnown(mark, known));

async function sourceFiles(pattern: RegExp): Promise<string[]> {
  const entries = await readdir(srcDir, { recursive: true });
  return entries
    .map((entry) => String(entry).split('\\').join('/'))
    .filter((entry) => pattern.test(entry) && !/\.test\./u.test(entry))
    .sort();
}
const markupFiles = (): Promise<string[]> => sourceFiles(/\.(astro|tsx)$/u);

async function marksOf(files: string[]): Promise<Mark[]> {
  const all: Mark[] = [];
  for (const file of files) all.push(...marksIn(file, await readFile(`${srcDir}${file}`, 'utf8')));
  return all;
}

function isDailyPage(file: string): boolean {
  if (!file.startsWith('pages/')) return false;
  const segments = file.slice('pages/'.length).split('/');
  if (segments.length > 1 && DAILY_FOLDERS.has(segments[0])) return true;
  return segments.length > 2 && LOCALE_FOLDER.test(segments[0]) && DAILY_FOLDERS.has(segments[1]);
}

async function dailyFiles(): Promise<string[]> {
  const files = (await sourceFiles(/\.(astro|tsx|ts|jsx|js|mjs|md|mdx)$/u)).filter(isDailyPage);
  for (const daily of DAILY_COMPONENTS) {
    const full = `${srcDir}${daily}`;
    const info = await stat(full).catch(() => null);
    if (!info) continue;
    if (!info.isDirectory()) { files.push(daily); continue; }
    for (const entry of await readdir(full, { recursive: true })) {
      const file = `${daily}${String(entry)}`;
      if ((await stat(`${srcDir}${file}`)).isFile()) files.push(file);
    }
  }
  return files;
}

// The body of the {...} block that starts at or after index.
function blockBody(text: string, index: number): { body: string; after: string } {
  const open = text.indexOf('{', index);
  const close = skipBraces(text, open);
  return { body: text.slice(open + 1, close - 1), after: text.slice(close) };
}

const OFF = "setAttribute('data-entrance', 'off')";

// The source without // and /* */ comments (strings kept), so a statement
// that is commented out no longer counts as code.
function stripComments(text: string): string {
  let out = '';
  let j = 0;
  while (j < text.length) {
    const c = text[j];
    if (c === '"' || c === "'" || c === '`') { const end = skipString(text, j); out += text.slice(j, end); j = end; continue; }
    if (c === '/' && text[j + 1] === '/') { const end = text.indexOf('\n', j); j = end < 0 ? text.length : end; continue; }
    if (c === '/' && text[j + 1] === '*') { const end = text.indexOf('*/', j + 2); j = end < 0 ? text.length : end + 2; continue; }
    out += c;
    j += 1;
  }
  return out;
}
const squash = (text: string): string => text.replace(/\s+/gu, ' ').trim();

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
    for (const needle of ['boundingClientRect.bottom <= 0', 'threshold: 0', 'setInterval', '}, 50);', 'transitionend', 'MAX_STEP = 4', "removeEventListener('scroll'"]) {
      expect(runtime, needle).toContain(needle);
    }
    const scripts = [...runtime.matchAll(/<script is:inline>([\s\S]*?)<\/script>/gu)].map((match) => match[1]);
    expect(scripts, 'two inline scripts: the switch, then the runtime').toHaveLength(2);
    const [gate, runner] = scripts.map(stripComments);

    // The switch's timer works on its own: it reads only the flag the runtime
    // sets, inside its own try, and turns motion off on any doubt.
    expect(gate, 'the switch never reads window.zodiacsMotion').not.toContain('zodiacsMotion');
    const timerAt = gate.search(/setTimeout\(\s*function\s*\(\)\s*\{/u);
    expect(timerAt, 'the switch has a timer').toBeGreaterThan(-1);
    expect(gate.match(/setTimeout\(/gu), 'the switch has exactly one timer').toHaveLength(1);
    expect(squash(gate), 'the timer is set whenever motion is on').toContain('if (on) window.setTimeout(function () {');
    const timer = blockBody(gate, timerAt);
    expect(timer.after, 'the timer fires after 3 s').toMatch(/^\s*,\s*3000\s*\)/u);
    const timerTryAt = timer.body.search(/\btry\s*\{/u);
    expect(timerTryAt, 'the timer has its own try').toBeGreaterThan(-1);
    expect(
      squash(blockBody(timer.body, timerTryAt).body),
      'the timer turns motion off unless the runtime flagged the root',
    ).toBe("if (!root.hasAttribute('data-entrance-ready')) root.setAttribute('data-entrance', 'off');");

    // Every catch, in either script, turns motion off.
    for (const [name, script] of [['switch', gate], ['runtime', runner]] as const) {
      const catches = [...script.matchAll(/\bcatch\s*(?:\(\s*\w*\s*\))?\s*\{/gu)];
      expect(catches.length, `${name} has a catch`).toBeGreaterThan(0);
      for (const found of catches) expect(blockBody(script, found.index ?? 0).body, `${name} catch turns motion off`).toContain(OFF);
    }

    // The runtime reads window.zodiacsMotion only inside its try, and flags
    // the root once it has started.
    const tryAt = runner.search(/\btry\s*\{/u);
    expect(tryAt, 'the runtime has a try').toBeGreaterThan(-1);
    expect(runner.slice(0, tryAt), 'nothing before the try reads window.zodiacsMotion').not.toContain('zodiacsMotion');
    const body = blockBody(runner, tryAt).body;
    expect(body).toContain('if (window.zodiacsMotion) return;');
    expect(squash(body), 'the runtime flags the root as the last step of its try').toMatch(/(?:^|[;{}] )root\.setAttribute\('data-entrance-ready', ''\);$/u);
  });

  it('finds the tag that owns a mark past attributes holding => and braces', () => {
    const marks = marksIn('x.astro', '<div><input onInput={(e) => { if (a > b) e; }} title="a > b" data-enter="rise" /></div>');
    expect(marks).toHaveLength(1);
    expect(marks[0].owner?.tag).toBe('input');
    expect(marks[0].kind).toBe('rise');
  });

  it('never marks words, controls, sections, heroes or components', async () => {
    const offenders = (await marksOf(await markupFiles())).filter((mark) => {
      if (!mark.owner) return true;
      const { tag } = mark.owner;
      return /^[A-Z]/u.test(tag) || tag.includes('.') || NEVER_TAGS.has(tag.toLowerCase());
    });
    expect(offenders.filter((mark) => !isKnownOnMain(mark)).map(describeMark), RULE).toEqual([]);
  });

  it('never marks anything inside an island', async () => {
    const offenders = await marksOf(await sourceFiles(/^islands\/.*\.(astro|tsx|ts|jsx|js|mjs)$/u));
    expect(offenders.filter((mark) => !isKnownOnMain(mark)).map(describeMark), ISLAND_RULE).toEqual([]);
  });

  it('lists each known offence on main exactly, and nothing else in those files', async () => {
    for (const file of new Set(KNOWN_ON_MAIN.map((known) => known.file))) {
      const marks = marksIn(file, await readFile(`${srcDir}${file}`, 'utf8'));
      const listed = KNOWN_ON_MAIN.filter((known) => known.file === file).length;
      expect(marks.map(describeMark), `${file} must hold exactly the ${listed} marks listed in KNOWN_ON_MAIN. ${ISLAND_RULE}`).toHaveLength(listed);
    }
  });

  it('deletes a KNOWN_ON_MAIN entry once its mark is gone', async () => {
    for (const known of KNOWN_ON_MAIN) {
      const marks = marksIn(known.file, await readFile(`${srcDir}${known.file}`, 'utf8'));
      expect(
        marks.some((mark) => matchesKnown(mark, known)),
        `KNOWN_ON_MAIN lists <${known.tag}.${known.className}> ${known.kind} in ${known.file}, but the source no longer has it. Delete that entry from KNOWN_ON_MAIN in src/lib/motion-contract.test.ts (and any note about it in docs/MOTION.md).`,
      ).toBe(true);
    }
  });

  it('treats a dynamic locale folder as a locale folder for the daily rule', () => {
    for (const page of ['pages/[lang]/today/index.astro', 'pages/[locale]/today/index.astro', 'pages/[...locale]/today/index.astro', 'pages/[releasedLocale]/today/index.astro']) {
      expect(isDailyPage(page), page).toBe(true);
    }
    for (const page of ['pages/[sign]/today/index.astro', 'pages/[lang]/tools/index.astro', 'pages/[...locale]/horoscopes/[sign].astro', 'pages/feeds/today.xml.ts']) {
      expect(isDailyPage(page), page).toBe(false);
    }
  });

  it('never marks anything on the daily pages', async () => {
    const files = await dailyFiles();
    for (const page of ['pages/today/index.astro', 'pages/es/today/index.astro']) {
      expect(files, `the daily rule covers ${page}`).toContain(page);
    }
    expect(files.some((file) => file.includes('horoscopes/') || file.includes('Horoscope')), 'horoscope pages may move calmly').toBe(false);
    expect(files.some((file) => file.startsWith('pages/feeds/')), 'feeds are not daily pages').toBe(false);
    const offenders = (await marksOf(files)).map(describeMark);
    expect(offenders, DAILY_RULE).toEqual([]);
  });

  it('never marks a result block', async () => {
    const offenders = (await marksOf(await markupFiles()))
      .filter((mark) => mark.owner && RESULT_CLASS.test(mark.owner.text));
    expect(offenders.filter((mark) => !isKnownOnMain(mark)).map(describeMark), RESULT_RULE).toEqual([]);
  });

  it('never spreads motion() into JSX', async () => {
    for (const file of await markupFiles()) {
      const text = await readFile(`${srcDir}${file}`, 'utf8');
      expect(/\{\s*\.\.\.motion\(/u.test(text), `${file}: ${RULE}`).toBe(false);
    }
  });
});
