import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildSavedRecord } from '../../ai-tools/accounts/save';
import { saveInput } from '../../ai-tools/accounts/contracts';
import { SAVED_RESULT_FORWARD, savedResultExploreHref, savedResultId, savedResultProfileHref } from './saved-result-link';

/** A saved row's id, as the database stores it. */
const ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
/** A value links carried before November 2026: 16 hex digits of a digest of the saved result. Retired. */
const OLD_DIGEST = '0123456789abcdef';
/** Every page a saved link can name, by the path the save tool writes. */
const PAGES = [
  [/^\/birth-chart\/#/u, 'src/pages/birth-chart/index.astro'],
  [/^\/occasions\/#/u, 'src/pages/occasions/index.astro'],
  [/^\/compatibility\/#/u, 'src/pages/compatibility/index.astro'],
  [/^\/compatibility\/[a-z]+-[a-z]+\/#/u, 'src/pages/compatibility/[pair]/index.astro'],
  [/^\/horoscopes\/#/u, 'src/pages/horoscopes/index.astro'],
] as const;
/** A row id as the save tool makes it: a lowercase version 4 UUID. */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
/** What the saves below were given: no part of a saved link may carry any of it. */
const BIRTH_DETAILS = /1990|1988|2012|08:30|0830|Ana|Mia|Luis|Madrid|40\.4/u;
/**
 * A saved link with its row id taken off, or null when it is not exactly a path, a # and its parameters, ending in
 * saved= and one UUID. The id is random, so it can hold "1990" by chance; everything else in the link is kept for the
 * birth-detail check.
 */
function withoutSavedId(href: string): string | null {
  return new RegExp(`^(\\/[^#]*#(?:[^#&]+&)*saved=)${UUID}$`, 'u').exec(href)?.[1] ?? null;
}
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
  it('reads the row id a saved link carries, and nothing else', () => {
    expect(savedResultId(`#saved=${ID}`)).toBe(ID);
    expect(savedResultId(`/birth-chart/#saved=${ID}`)).toBe(ID);
    expect(savedResultId(`/horoscopes/#week=2026-11-02&saved=${ID}`)).toBe(ID);
    for (const other of ['#saved=0123', `#saved=${ID.toUpperCase()}`, `#saved=${ID}0`, `#saved=${OLD_DIGEST}`, `/birth-chart/#saved=${OLD_DIGEST}`,
      '#c=1.abc', '#o=wedding&d=2027-06-12', '/occasions/', '']) {
      expect(savedResultId(other), other).toBeNull();
    }
  });

  it('opens on the profile, and "Explore more" opens the page itself, never a saved= link', () => {
    expect(savedResultProfileHref(ID)).toBe(`/profile/#saved=${ID}`);
    expect(savedResultExploreHref(`/birth-chart/#saved=${ID}`)).toBe('/birth-chart/');
    expect(savedResultExploreHref(`/occasions/#saved=${ID}`)).toBe('/occasions/');
    expect(savedResultExploreHref(`/horoscopes/#week=2026-11-02&saved=${ID}`)).toBe('/horoscopes/');
    // A stored link not yet rewritten still opens its page, not the profile.
    expect(savedResultExploreHref(`/birth-chart/#saved=${OLD_DIGEST}`)).toBe('/birth-chart/');
    expect(savedResultExploreHref('/occasions/#o=wedding&d=2027-06-12')).toBe('/occasions/#o=wedding&d=2027-06-12');
    expect(savedResultExploreHref('/people/frida-kahlo/')).toBe('/people/frida-kahlo/');
  });

  it('declares nothing on the page it runs on', () => {
    // Run as a classic inline script would, on a stand-in window: the forward still happens, and no name is left behind.
    for (const hash of [`#saved=${ID}`, '#c=1.abc']) {
      const page: Record<string, unknown> = { location: { hash, replace: (to: string) => { page.forwardedTo = to; } } };
      runInNewContext(SAVED_RESULT_FORWARD, page);
      expect(page.forwardedTo, hash).toBe(hash.startsWith('#saved=') ? `/profile/#saved=${ID}` : undefined);
      expect(Object.keys(page).filter((name) => name !== 'location' && name !== 'forwardedTo'), hash).toEqual([]);
    }
    expect(SAVED_RESULT_FORWARD).toMatch(/^\(function \(\) \{[\s\S]*\}\)\(\);$/u);
  });

  it('sends a retired digest to the plain profile page, where it opens nothing', () => {
    expect(forward(`#saved=${OLD_DIGEST}`)).toBe('/profile/');
    expect(forward(`#week=2026-11-02&saved=${OLD_DIGEST}`)).toBe('/profile/');
    // Arriving on the profile itself with one (from browser history), it names no saved result.
    expect(savedResultId(`#saved=${OLD_DIGEST}`)).toBeNull();
  });

  it('is sent on to the profile by the pages it names, and every other link is left alone', () => {
    expect(forward(`#saved=${ID}`)).toBe(`/profile/#saved=${ID}`);
    expect(forward(`#week=2026-11-02&saved=${ID}`)).toBe(`/profile/#saved=${ID}`);
    for (const other of ['', '#c=1.abc', '#date=2000-01-01&time=unknown', '#o=birthday&d=2000-01-01', '#saved=nothex', `#saved=${ID.toUpperCase()}`]) {
      expect(forward(other), other).toBeNull();
    }
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
      const id = savedResultId(record.href);
      expect(id, record.href).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
      expect(forward(record.href.slice(record.href.indexOf('#')))).toBe(`/profile/#saved=${id}`);
      const page = PAGES.find(([path]) => path.test(record.href))?.[1];
      expect(page, record.href).toBeDefined();
      expect(pageSource(page!), record.href).toContain(FORWARD_LINE);
      const rest = withoutSavedId(record.href);
      expect(rest, record.href).not.toBeNull();
      expect(rest, record.href).not.toMatch(BIRTH_DETAILS);
    }
  });

  it('reads the link around the id for birth details, never the random id itself', async () => {
    const now = () => new Date('2026-11-04T12:00:00Z');
    // Ids holding the very years, dates and times the saves were given.
    const ids = ['19901988-2012-4830-8990-201219880830', '00000000-0000-4000-8000-000000001990', '08301990-1988-4012-a012-000008302012'];
    const saves = [
      { kind: 'chart', chart: { name: 'Ana', birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 } },
      { kind: 'week', week: { birthDate: '1990-05-03', birthTime: '08:30', birthZone: 'Europe/Madrid' } },
    ];
    for (const id of ids) {
      expect(id).toMatch(new RegExp(`^${UUID}$`, 'u'));
      expect(id).toMatch(BIRTH_DETAILS);
      for (const save of saves) {
        const record = await buildSavedRecord(saveInput.parse(save), { now, newId: () => id });
        if ('failure' in record) throw new Error(record.failure);
        expect(savedResultId(record.href)).toBe(id);
        const rest = withoutSavedId(record.href);
        expect(rest, record.href).toBe(record.href.slice(0, -id.length));
        expect(rest, record.href).not.toMatch(BIRTH_DETAILS);
      }
    }
    // A birth detail anywhere outside the id is still caught, and a link that is not exactly path, #, saved= and a UUID is refused.
    const [id] = ids;
    for (const href of [`/birth-chart/#d=1990-05-03&saved=${id}`, `/birth-chart/#t=08:30&saved=${id}`, `/compatibility/Ana-luis/#saved=${id}`,
      `/birth-chart/?d=1990#saved=${id}`, `/birth-chart/Madrid/#saved=${id}`]) {
      expect(withoutSavedId(href), href).toMatch(BIRTH_DETAILS);
    }
    for (const href of [`/birth-chart/#saved=${id}&d=1990-05-03`, `/birth-chart/#saved=${id}1990`, `/birth-chart/#saved=${ids[2].toUpperCase()}`, `/birth-chart/#d=1990#saved=${id}`,
      `/birth-chart/#saved=${id}#1990`, `birth-chart/#saved=${id}`, `/birth-chart/#saved=${OLD_DIGEST}`]) {
      expect(withoutSavedId(href), href).toBeNull();
    }
  });
});
