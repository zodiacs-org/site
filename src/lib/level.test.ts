import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEVEL_ASKED_KEY, LEVEL_EVENT, LEVEL_STORAGE_KEY, atLeast, isLevel, onLevel, pageLevel } from './level';

// A small stand-in for the page: just the root element's attributes and window events.
beforeEach(() => {
  const attrs = new Map<string, string>();
  vi.stubGlobal('document', {
    documentElement: {
      getAttribute: (name: string) => attrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => { attrs.set(name, value); },
    },
  });
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe('reader levels', () => {
  it('knows the three levels and nothing else', () => {
    expect(isLevel('beginner')).toBe(true);
    expect(isLevel('intermediate')).toBe(true);
    expect(isLevel('advanced')).toBe(true);
    expect(isLevel('expert')).toBe(false);
    expect(isLevel(null)).toBe(false);
  });

  it('orders the levels so advanced includes intermediate', () => {
    expect(atLeast('advanced', 'intermediate')).toBe(true);
    expect(atLeast('intermediate', 'intermediate')).toBe(true);
    expect(atLeast('beginner', 'intermediate')).toBe(false);
  });

  it('reads no level on a page without the switch', () => {
    expect(pageLevel()).toBeNull();
    document.documentElement.setAttribute('data-level', 'nonsense');
    expect(pageLevel()).toBeNull();
  });

  it('calls back now and on every switch, until unsubscribed', () => {
    document.documentElement.setAttribute('data-level', 'beginner');
    const seen: Array<string | null> = [];
    const stop = onLevel((level) => seen.push(level));
    window.dispatchEvent(new CustomEvent(LEVEL_EVENT, { detail: { level: 'advanced' } }));
    stop();
    window.dispatchEvent(new CustomEvent(LEVEL_EVENT, { detail: { level: 'intermediate' } }));
    expect(seen).toEqual(['beginner', 'advanced']);
  });
});

describe('level rules in the page', () => {
  it('hides nothing until a level is set, and keeps one address', async () => {
    const { readFile } = await import('node:fs/promises');
    const css = (await readFile(new URL('../styles/level.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    // Every hide rule is scoped to html[data-level], so no-JS readers and
    // search engines get every depth.
    const hides = css.split('}').filter((rule) => rule.includes('display: none !important'));
    expect(hides.length).toBeGreaterThan(0);
    for (const rule of hides) {
      for (const selector of rule.split('{')[0].split(',')) {
        if (selector.trim()) expect(selector.trim()).toMatch(/^html\[data-level='/);
      }
    }
    const page = await readFile(new URL('../pages/birth-chart/index.astro', import.meta.url), 'utf8');
    expect(page).toContain('<LevelSwitch');
    expect(page).not.toMatch(/[?&]level=/);
  });

  it('opens the first-visit question before paint, never after', async () => {
    const { readFile } = await import('node:fs/promises');
    const component = await readFile(new URL('../components/LevelSwitch.astro', import.meta.url), 'utf8');
    const inline = component.slice(component.indexOf('<script is:inline>'), component.indexOf('</script>'));
    expect(inline).toContain("setAttribute('data-level-ask', 'open')");
    expect(component).not.toMatch(/ask\.hidden\s*=\s*false/);
    // The rules ship inline with the switch, so a deferred page stylesheet
    // can never leave the question unstyled at first paint.
    expect(component).toContain("import levelCss from '../styles/level.css?raw';");
    expect(component).toContain('<style is:inline set:html={levelCss}></style>');
    expect(component).not.toMatch(/^import '\.\.\/styles\/level\.css';/m);
  });

  it('leaves the status line empty on load and keeps focus when the question closes', async () => {
    const { readFile } = await import('node:fs/promises');
    const component = await readFile(new URL('../components/LevelSwitch.astro', import.meta.url), 'utf8');
    const apply = component.slice(component.indexOf('function apply('), component.indexOf('function init('));
    // The status is written only after the initial apply has returned.
    expect(apply.indexOf('if (opts.initial) return;')).toBeGreaterThan(-1);
    expect(apply.indexOf('if (opts.initial) return;')).toBeLessThan(apply.indexOf('data-status-${level}'));
    expect(component).toContain('[data-level-set="${pageLevel() ?? DEFAULT_LEVEL}"]`)?.focus()');
  });

  it('keeps the browser drives\' Advanced seed on the real storage keys', async () => {
    const fixture = await import('../../tests/level-fixture.mjs');
    expect(fixture.LEVEL_STORAGE_KEY).toBe(LEVEL_STORAGE_KEY);
    expect(fixture.LEVEL_ASKED_KEY).toBe(LEVEL_ASKED_KEY);
    const store = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { setItem: (k: string, v: string) => store.set(k, v) } });
    fixture.seedFullLevel();
    expect(store.get(LEVEL_STORAGE_KEY)).toBe('advanced');
    expect(store.get(LEVEL_ASKED_KEY)).toBe('1');
    vi.unstubAllGlobals();
  });

  it('adds no mono font to first paint', async () => {
    const { readFile } = await import('node:fs/promises');
    const css = (await readFile(new URL('../styles/level.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    const firstPaint = css.split('}').filter((rule) => /\.level-(switch|ask|data)/.test(rule.split('{')[0]));
    expect(firstPaint.length).toBeGreaterThan(0);
    for (const rule of firstPaint) expect(rule).not.toContain('--font-mono');
  });

  it('takes each page\'s own wording for the question and the status line', async () => {
    const { readFile } = await import('node:fs/promises');
    const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');
    const component = await read('../components/LevelSwitch.astro');
    // The status line reads the words its own switch carries, not a fixed list.
    expect(component).toContain('data-status-${level}');
    expect(component).not.toMatch(/const STATUS\b/);
    // Pages that open less than the birth chart never promise its 3D view.
    for (const page of ['../pages/rising-sign/index.astro', '../pages/moon-sign/index.astro']) {
      const source = await read(page);
      expect(source).toMatch(/<LevelSwitch[^>]*words=\{\{[\s\S]*intermediate:[\s\S]*advanced:/);
      const tag = source.slice(source.indexOf('<LevelSwitch'), source.indexOf('/>', source.indexOf('<LevelSwitch')));
      expect(tag).not.toContain('3D');
    }
  });

  it('keeps the way back to the natal chart at every level', async () => {
    const { readFile } = await import('node:fs/promises');
    const island = await readFile(new URL('../islands/ChartCalculator.tsx', import.meta.url), 'utf8');
    expect(island).toContain("class=\"calc__lens-rail\" role=\"group\" aria-label={lensLabels.rail} data-depth={lens === 'natal' ? 'intermediate' : undefined}");
    // A hidden button keeps focus until restyle, so the hand-back to the wheel
    // decides from where focus was before the rail hid, not from <body>.
    const natal = island.slice(island.indexOf("if (next === 'natal') {"), island.indexOf('const mod = lensMod'));
    expect(natal.indexOf("closest('.calc__lens-rail')")).toBeGreaterThan(-1);
    expect(natal.indexOf("closest('.calc__lens-rail')")).toBeLessThan(natal.indexOf('resetLens()'));
    expect(natal).toContain('rail.getClientRects().length === 0');
    expect(natal).not.toContain('document.activeElement === document.body');
  });
});
