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
    const wiring = await readFile(new URL('./level-switch.ts', import.meta.url), 'utf8');
    // On load only the pressed button is marked: nothing is saved, announced
    // or animated, and the status line is written only by a reader's change.
    const loader = component.slice(component.lastIndexOf('<script>'));
    expect(loader).not.toContain('data-level-status');
    expect(loader).not.toContain('localStorage');
    expect(loader).not.toContain('dispatchEvent');
    // The pressed button is marked inline, right after the switch, before paint.
    const pressedInline = component.slice(component.indexOf('</div>\n</div>\n<script is:inline>'));
    expect(pressedInline).toContain("setAttribute('aria-pressed'");
    expect(wiring.slice(wiring.indexOf('function apply('))).toContain('STATUS[level]');
    expect(wiring).toContain('[data-level-set="${pageLevel() ?? DEFAULT_LEVEL}"]`)?.focus()');
  });

  it('lets the chart island follow the level without loading the shared level code', async () => {
    const { readFile } = await import('node:fs/promises');
    const island = await readFile(new URL('../islands/ChartCalculator.tsx', import.meta.url), 'utf8');
    expect(island).not.toMatch(/from '\.\.\/lib\/level'/);
    expect(island).toContain(`'${LEVEL_EVENT}'`);
    expect(island).toContain("getAttribute('data-level')");
  });

  it('loads the Big Three reading text with the calculation, not with the page', async () => {
    const { readFile } = await import('node:fs/promises');
    const island = await readFile(new URL('../islands/ChartCalculator.tsx', import.meta.url), 'utf8');
    // Static, it would count against the /birth-chart/ first-load budget.
    expect(island).not.toMatch(/from '\.\.\/lib\/interpretations'/);
    expect(island).toContain("import('../lib/interpretations')");
    // The cards wait for the text, so a result never grows a line after it shows.
    expect(island.indexOf('await readingsReady')).toBeLessThan(island.indexOf('setChart(result)'));
  });

  it('keeps the switch wiring out of the first-load scripts and replays an early press', async () => {
    const { readFile } = await import('node:fs/promises');
    const component = await readFile(new URL('../components/LevelSwitch.astro', import.meta.url), 'utf8');
    const loader = component.slice(component.lastIndexOf('<script>'));
    // Dynamic, so scripts/report-bundles.mjs leaves it outside the route budget.
    expect(loader).toContain("import('../lib/level-switch')");
    expect(loader).not.toMatch(/from '\.\.\/lib\/level-switch'/);
    expect(loader).toContain('requestIdleCallback');
    expect(loader).toMatch(/addEventListener\('click', early, true\)/);
    expect(loader).toContain('button?.click()');
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
    const firstPaint = css.split('}').filter((rule) => /\.level-(switch|ask)/.test(rule.split('{')[0]));
    expect(firstPaint.length).toBeGreaterThan(0);
    for (const rule of firstPaint) expect(rule).not.toContain('--font-mono');
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
