import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEVEL_EVENT, atLeast, isLevel, onLevel, pageLevel } from './level';

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
  });

  it('leaves the status line empty on load and keeps focus when the question closes', async () => {
    const { readFile } = await import('node:fs/promises');
    const component = await readFile(new URL('../components/LevelSwitch.astro', import.meta.url), 'utf8');
    const apply = component.slice(component.indexOf('function apply('), component.indexOf('function init('));
    // The status is written only after the initial apply has returned.
    expect(apply.indexOf('if (opts.initial) return;')).toBeGreaterThan(-1);
    expect(apply.indexOf('if (opts.initial) return;')).toBeLessThan(apply.indexOf('STATUS[level]'));
    expect(component).toContain('[data-level-set="${pageLevel() ?? DEFAULT_LEVEL}"]`)?.focus()');
  });

  it('keeps the way back to the natal chart at every level', async () => {
    const { readFile } = await import('node:fs/promises');
    const island = await readFile(new URL('../islands/ChartCalculator.tsx', import.meta.url), 'utf8');
    expect(island).toContain("class=\"calc__lens-rail\" role=\"group\" aria-label={lensLabels.rail} data-depth={lens === 'natal' ? 'intermediate' : undefined}");
  });
});
