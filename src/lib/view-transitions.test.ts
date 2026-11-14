import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// ZOD-231: pages flow into each other with CSS only. A view-transition-name
// must be unique on a page, or the browser skips the whole transition.
const repo = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFile(`${repo}${path}`, 'utf8');
const sourceFiles = (): string[] => execFileSync('git', ['ls-files', 'src'], { cwd: repo, encoding: 'utf8' })
  .split('\n')
  .filter((file) => /\.(astro|css|tsx?|jsx?)$/u.test(file) && !/\.test\.[jt]sx?$/u.test(file));

describe('cross-document view transitions', () => {
  it('opts in only for visitors who have not asked for reduced motion', async () => {
    const css = await read('src/styles/base.css');
    const at = css.indexOf('@view-transition');
    expect(at).toBeGreaterThan(0);
    expect(css.indexOf('@view-transition', at + 1)).toBe(-1);
    const block = css.lastIndexOf('@media (prefers-reduced-motion: no-preference)', at);
    expect(block).toBeGreaterThan(0);
    expect(css.slice(block, at)).not.toContain('}');
    expect(css.slice(at)).toMatch(/::view-transition-old\(\*\)[\s\S]*?animation-duration:\s*var\(--dur-1\)/u);
    // The nav group sits above names that exist only on the new page.
    expect(css.slice(at)).toMatch(/::view-transition-group\(site-nav\)\s*\{[^}]*z-index:\s*1/u);
  });

  it('declares each transition name once, on the element the ticket names', async () => {
    const owners = new Map<string, string[]>();
    for (const file of sourceFiles()) {
      const text = await read(file);
      for (const match of text.matchAll(/view-transition-name\s*:\s*([a-z][\w-]*)/giu)) {
        if (match[1] === 'none') continue;
        owners.set(match[1], [...(owners.get(match[1]) ?? []), file]);
      }
    }
    expect(Object.fromEntries(owners)).toEqual({
      'site-nav': ['src/components/SiteNav.astro'],
      'horoscope-head': ['src/components/HoroscopeProgramPage.astro'],
      'horoscope-controls': ['src/components/HoroscopeProgramPage.astro'],
    });
    const nav = await read('src/components/SiteNav.astro');
    expect(nav.match(/data-nav>/gu)).toHaveLength(1);
    const program = await read('src/components/HoroscopeProgramPage.astro');
    expect(program.match(/class="program__hero hz-hero"/gu)).toHaveLength(1);
    expect(program.match(/class="kwrap hz-controls"/gu)).toHaveLength(1);
  });

  it('renders the nav and the horoscope page at most once per layout', async () => {
    for (const file of sourceFiles().filter((path) => path.startsWith('src/layouts/'))) {
      const text = await read(file);
      expect((text.match(/<SiteNav\b/gu) ?? []).length, file).toBeLessThanOrEqual(1);
    }
    for (const file of sourceFiles().filter((path) => path.startsWith('src/pages/'))) {
      const text = await read(file);
      expect((text.match(/<HoroscopeProgramPage\b/gu) ?? []).length, file).toBeLessThanOrEqual(1);
    }
  });

  it('uses no client router, prefetch rules or render-blocking hints', async () => {
    for (const file of sourceFiles()) {
      const text = await read(file);
      expect(text, file).not.toMatch(/<ClientRouter\b|<ViewTransitions\b|astro:transitions/u);
      expect(text, file).not.toMatch(/type=["']speculationrules["']|blocking=["']render["']/u);
    }
  });
});
