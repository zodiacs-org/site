import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * While account sync v2 is on, no remote analytics script may run on a page
 * that reads the browser's saved charts or account and can render them. This
 * test finds those pages itself: it follows every relative import (static,
 * dynamic and re-export, in pages, components, islands and libraries) from
 * each page in src/pages, and any page that reaches one of the readers below
 * must hand Base `accountSurface` or an unconditional `privateSurface`.
 *
 * The walk stops at the shared layout, so site chrome that every page carries
 * (the account access bootstrap and the navigation avatar, which shows one
 * initial or a photo and never a chart) is not counted.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LAYOUT = resolve(ROOT, 'src/layouts/Base.astro');

/** Modules that read the local profile store, the living chart or the v2 account. */
const READERS = [
  'src/lib/profile/store.ts',
  'src/lib/profile/read-store.ts',
  'src/lib/profile/me.ts',
  'src/lib/profile/circle.ts',
  'src/lib/profile/pairs.ts',
  'src/lib/profile/saved-record-access.ts',
  'src/lib/profile/saved-record-store.ts',
  'src/lib/profile/backup.ts',
  'src/lib/profile/deletions.ts',
  'src/lib/profile/refresh.ts',
  'src/lib/profile/daily-email-client.ts',
  'src/lib/hooks/useProfile.ts',
  'src/lib/hooks/useMe.ts',
  'src/lib/hooks/useLivingChart.ts',
  'src/lib/living-chart/owner.ts',
  'src/lib/living-chart/store.ts',
  'src/lib/living-chart/sync.ts',
  'src/lib/account-v2/client.ts',
  'src/lib/account-v2/remote-chart.ts',
].map((path) => resolve(ROOT, path));

const EXTENSIONS = ['', '.ts', '.tsx', '.mjs', '.js', '.astro', '.jsx',
  '/index.ts', '/index.tsx', '/index.mjs', '/index.js', '/index.astro'];

const IMPORT = /(?:^|[^\w$.])(?:import|export)\s+(?!type\s)[^'";]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[^\w$.])import\s+['"]([^'"]+)['"]/gmu;

const dependencyCache = new Map<string, string[]>();

function resolveImport(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier.replace(/\?.*$/u, ''));
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  if (base.endsWith('.js')) {
    for (const extension of ['.ts', '.tsx']) {
      const candidate = base.replace(/\.js$/u, extension);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function dependencies(file: string): string[] {
  const cached = dependencyCache.get(file);
  if (cached) return cached;
  const source = readFileSync(file, 'utf8');
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier?.startsWith('.')) continue;
    const target = resolveImport(file, specifier);
    if (target) found.push(target);
  }
  dependencyCache.set(file, found);
  return found;
}

function readerTrail(page: string): string[] | null {
  const seen = new Set<string>();
  const stack: Array<[string, string[]]> = [[page, []]];
  while (stack.length) {
    const [file, trail] = stack.pop()!;
    if (seen.has(file) || file === LAYOUT) continue;
    seen.add(file);
    const next = [...trail, file];
    if (READERS.includes(file)) return next;
    for (const dependency of dependencies(file)) stack.push([dependency, next]);
  }
  return null;
}

function pageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pageFiles(path);
    return entry.name.endsWith('.astro') ? [path] : [];
  });
}

function baseTag(source: string): string | null {
  const start = source.search(/<Base[\s>]/u);
  if (start < 0) return null;
  // The opening tag ends at the first `>` outside braces and quotes.
  let depth = 0;
  let quote: string | null = null;
  for (let index = start + 5; index < source.length; index += 1) {
    const char = source[index]!;
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === '\'' || char === '`') quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (char === '>' && depth === 0) return source.slice(start, index + 1);
  }
  return null;
}

/** `accountSurface`, or a `privateSurface` that is on whenever v2 is on. */
function closesAnalytics(tag: string): boolean {
  return /\saccountSurface(?:\s|>|=\{true\})/u.test(tag)
    || /\sprivateSurface(?:\s|>|=\{true\})/u.test(tag)
    || /\sprivateSurface=\{accountSyncV2Enabled[^}]*\}/u.test(tag);
}

function astroImports(file: string): string[] {
  return dependencies(file).filter((dependency) => dependency.endsWith('.astro') && dependency !== LAYOUT);
}

/** The page's own Base tag, or the Base tag of the page component it renders. */
function analyticsClosedFor(page: string): { ok: boolean; owner: string } {
  const source = readFileSync(page, 'utf8');
  const own = baseTag(source);
  if (own) return { ok: closesAnalytics(own), owner: page };
  for (const component of astroImports(page)) {
    const tag = baseTag(readFileSync(component, 'utf8'));
    if (!tag) continue;
    if (closesAnalytics(tag)) return { ok: true, owner: component };
    // A component that forwards the flag: the page must set it on the component.
    if (/\saccountSurface=\{accountSurface\}/u.test(tag)) {
      return { ok: /\saccountSurface(?:\s|>|\/>|=\{true\})/u.test(source), owner: component };
    }
    return { ok: false, owner: component };
  }
  return { ok: false, owner: page };
}

const pages = pageFiles(resolve(ROOT, 'src/pages'));
const accountPages = pages
  .map((page) => ({ page, trail: readerTrail(page) }))
  .filter((entry): entry is { page: string; trail: string[] } => entry.trail !== null);
const routes = accountPages.map(({ page }) => relative(ROOT, page));

describe('remote analytics on pages that read saved charts or the account', () => {
  it('finds the chart and account pages named in the launch review, in every locale', () => {
    for (const expected of [
      'src/pages/today/index.astro',
      'src/pages/transits/index.astro',
      'src/pages/birth-chart/index.astro',
      'src/pages/birth-chart/someone-else/index.astro',
      'src/pages/index.astro',
      'src/pages/horoscopes/[sign]/index.astro',
      'src/pages/profile/index.astro',
      'src/pages/compatibility/index.astro',
      'src/pages/solar-return/index.astro',
      'src/pages/lunar-return/index.astro',
    ]) expect(routes).toContain(expected);
    for (const locale of ['es', 'fr', 'it', 'pt', 'ru']) {
      for (const route of ['index.astro', 'birth-chart/index.astro', 'transits/index.astro', 'profile/index.astro']) {
        expect(routes).toContain(`src/pages/${locale}/${route}`);
      }
    }
  });

  it('turns analytics off on every one of them while account sync v2 is on', () => {
    const open = accountPages.flatMap(({ page, trail }) => {
      const { ok, owner } = analyticsClosedFor(page);
      return ok ? [] : [`${relative(ROOT, page)} (Base in ${relative(ROOT, owner)}) reads ${relative(ROOT, trail.at(-1)!)} via ${relative(ROOT, trail[1] ?? page)}`];
    });
    expect(open).toEqual([]);
  });

  it('keeps analytics on ordinary content pages', () => {
    for (const route of [
      'src/pages/about/index.astro',
      'src/pages/horoscopes/[sign]/weekly/index.astro',
      'src/pages/learn/how-to-read-a-birth-chart.astro',
      'src/pages/[sign]/index.astro',
      'src/pages/es/today/index.astro',
    ]) {
      if (!existsSync(resolve(ROOT, route))) continue;
      expect(routes).not.toContain(route);
    }
    const weekly = readFileSync(resolve(ROOT, 'src/pages/horoscopes/[sign]/weekly/index.astro'), 'utf8');
    expect(weekly).not.toMatch(/accountSurface/u);
  });

  it('closes both analytics loaders in the layout for accountSurface only while v2 is on', () => {
    const layout = readFileSync(LAYOUT, 'utf8');
    expect(layout).toContain('props.privateSurface || (props.accountSurface && accountSyncV2Enabled)');
    expect(layout).toContain('plausibleScriptUrl && (!props.noindex || props.analyticsOnNoindex) && !analyticsExcluded,');
    expect(layout).toContain('vercelWebAnalyticsFlag(import.meta.env) && (!props.noindex || props.analyticsOnNoindex) && !analyticsExcluded,');
  });
});
