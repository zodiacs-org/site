import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildSavedRecord } from '../../ai-tools/accounts/save';
import { saveInput } from '../../ai-tools/accounts/contracts';
import { SAVED_RESULT_FORWARD, savedResultDigest, savedResultExploreHref, savedResultProfileHref } from './saved-result-link';

const DIGEST = '0123456789abcdef';
/** Every page a saved link can name, by the path the save tool writes. */
const PAGES = [
  [/^\/birth-chart\/#/u, 'src/pages/birth-chart/index.astro'],
  [/^\/occasions\/#/u, 'src/pages/occasions/index.astro'],
  [/^\/compatibility\/#/u, 'src/pages/compatibility/index.astro'],
  [/^\/compatibility\/[a-z]+-[a-z]+\/#/u, 'src/pages/compatibility/[pair]/index.astro'],
  [/^\/horoscopes\/#/u, 'src/pages/horoscopes/index.astro'],
] as const;
const FORWARD_LINE = '<script slot="head" is:inline set:html={SAVED_RESULT_FORWARD} />';
const pageSource = (page: string) => readFileSync(new URL(`../../../${page}`, import.meta.url), 'utf8');
/** Runs a page's inline forward against a stand-in location, as the browser would before painting. */
function forward(hash: string): string | null {
  let replaced: string | null = null;
  const location = { hash, replace: (to: string) => { replaced = to; } };
  new Function('location', SAVED_RESULT_FORWARD)(location);
  return replaced;
}

describe('a link to one saved result', () => {
  it('reads the digest a saved link carries, and nothing else', () => {
    expect(savedResultDigest(`#saved=${DIGEST}`)).toBe(DIGEST);
    expect(savedResultDigest(`/birth-chart/#saved=${DIGEST}`)).toBe(DIGEST);
    expect(savedResultDigest(`/horoscopes/#week=2026-11-02&saved=${DIGEST}`)).toBe(DIGEST);
    for (const other of ['#saved=0123', `#saved=${DIGEST.toUpperCase()}`, `#saved=${DIGEST}0`, '#c=1.abc', '#o=wedding&d=2027-06-12', '/occasions/', '']) {
      expect(savedResultDigest(other), other).toBeNull();
    }
  });

  it('opens on the profile, and "Explore more" opens the page itself, never a saved= link', () => {
    expect(savedResultProfileHref(DIGEST)).toBe(`/profile/#saved=${DIGEST}`);
    expect(savedResultExploreHref(`/birth-chart/#saved=${DIGEST}`)).toBe('/birth-chart/');
    expect(savedResultExploreHref(`/occasions/#saved=${DIGEST}`)).toBe('/occasions/');
    expect(savedResultExploreHref('/occasions/#o=wedding&d=2027-06-12')).toBe('/occasions/#o=wedding&d=2027-06-12');
    expect(savedResultExploreHref('/people/frida-kahlo/')).toBe('/people/frida-kahlo/');
  });

  it('declares nothing on the page it runs on', () => {
    // Run as a classic inline script would, on a stand-in window: the forward still happens, and no name is left behind.
    for (const hash of [`#saved=${DIGEST}`, '#c=1.abc']) {
      const page: Record<string, unknown> = { location: { hash, replace: (to: string) => { page.forwardedTo = to; } } };
      runInNewContext(SAVED_RESULT_FORWARD, page);
      expect(page.forwardedTo, hash).toBe(hash.startsWith('#saved=') ? `/profile/#saved=${DIGEST}` : undefined);
      expect(Object.keys(page).filter((name) => name !== 'location' && name !== 'forwardedTo'), hash).toEqual([]);
    }
    expect(SAVED_RESULT_FORWARD).toMatch(/^\(function \(\) \{[\s\S]*\}\)\(\);$/u);
  });

  it('is sent on to the profile by the pages it names, and every other link is left alone', () => {
    expect(forward(`#saved=${DIGEST}`)).toBe(`/profile/#saved=${DIGEST}`);
    for (const other of ['', '#c=1.abc', '#date=1990-05-03&time=unknown', '#o=birthday&d=2026-05-03', '#saved=nothex']) expect(forward(other), other).toBeNull();
    for (const [, page] of PAGES) expect(pageSource(page), page).toContain(FORWARD_LINE);
  });

  it('matches the links the save tool writes for each kind, which the page they name sends on and which carry no birth details', async () => {
    const now = () => new Date('2026-11-04T12:00:00Z');
    const saves = [
      { kind: 'chart', chart: { name: 'Ana', birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 } },
      { kind: 'occasion', occasion: { occasion: 'birthday', date: '2012-03-14', names: 'Mia' } },
      { kind: 'comparison', comparison: { a: { name: 'Ana', birthDate: '1990-05-03' }, b: { name: 'Luis', birthDate: '1988-11-20' } } },
      { kind: 'week', week: { birthDate: '1990-05-03', birthTime: '08:30', birthZone: 'Europe/Madrid' } },
    ];
    for (const save of saves) {
      const record = await buildSavedRecord(saveInput.parse(save), { now });
      if ('failure' in record) throw new Error(record.failure);
      const digest = savedResultDigest(record.href);
      expect(digest, record.href).toMatch(/^[0-9a-f]{16}$/u);
      expect(forward(record.href.slice(record.href.indexOf('#')))).toBe(`/profile/#saved=${digest}`);
      const page = PAGES.find(([path]) => path.test(record.href))?.[1];
      expect(page, record.href).toBeDefined();
      expect(pageSource(page!), record.href).toContain(FORWARD_LINE);
      expect(record.href).not.toMatch(/1990|1988|2012|08:30|Ana|Mia|Luis|Madrid|40\.4/u);
    }
  });
});
