import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ageCheckToday, canonicalZone, goodDaysLink, localToday, readGoodDaysLink, thirteenYearsAgo, zoneChoices } from '../../islands/GoodDayFinder';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { UNDER_13_SENTENCE, findGoodDays } from './find';

const clock = createLocalTimeModule();
afterAll(() => clock.dispose());

/**
 * The good day finder takes an optional birth date. On the site it is used on the device for one search and kept
 * only in the island's memory: never written to storage, the address bar or analytics, and never sent anywhere.
 * These checks read the sources that handle it, so a later change that starts keeping or sending it fails here.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const SOURCES = {
  island: read('../../islands/GoodDayFinder.tsx'),
  find: read('./find.ts'),
  personal: read('./personal.ts'),
  goals: read('./goals.ts'),
  feature: read('../../ai-tools/features/good-days.ts'),
};
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

describe('the good day finder keeps birth details to the one request', () => {
  it('never stores, logs, sends or links what it is given', () => {
    for (const [name, text] of Object.entries(SOURCES)) {
      const source = code(text);
      for (const pattern of [/localStorage/u, /sessionStorage/u, /indexedDB/u, /document\.cookie/u, /history\.(?:push|replace)State/u, /location\.(?:hash|search|href)\s*=/u,
        /\bfetch\(/u, /sendBeacon/u, /XMLHttpRequest/u, /console\./u, /\btrack\w*\(/u, /plausible|gtag|posthog|analytics/iu, /URLSearchParams/u]) {
        expect(source, `${name}: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('asks the site page for a birth date only, never a name, time or place', () => {
    const island = code(SOURCES.island);
    expect(island).toContain('type="date"');
    expect(island).not.toMatch(/type="(?:text|time)"/u);
    expect(island).not.toMatch(/PlaceSearch|latitude|longitude/u);
    // The field will not take a date less than 13 years ago, and the finder refuses one anyway.
    expect(island).toContain('max={thirteenYearsAgo(ageCheckToday(zone, deviceZone))}');
  });

  it('keeps consumer copy free of en and em dashes', () => {
    for (const [name, text] of Object.entries(SOURCES)) expect(text, name).not.toMatch(/[–—]/u);
    expect(read('../../pages/good-days/index.astro')).not.toMatch(/[–—]/u);
  });
});

describe('the share link', () => {
  it('carries the goal and the two dates after the #, and nothing else', () => {
    const link = goodDaysLink('https://zodiacs.org', 'wedding', '2027-05-01', '2027-09-30');
    expect(link).toBe('https://zodiacs.org/good-days/#g=wedding&f=2027-05-01&t=2027-09-30');
    expect(readGoodDaysLink(new URL(link).hash)).toEqual({ goal: 'wedding', from: '2027-05-01', to: '2027-09-30' });
  });

  it('takes only those three keys from a link, and nothing from a malformed one', () => {
    expect(readGoodDaysLink('#g=move&f=2027-01-01&t=2027-02-01&b=1990-05-03&n=Ana')).toEqual({ goal: 'move', from: '2027-01-01', to: '2027-02-01' });
    expect(readGoodDaysLink('#g=lottery&f=2027-01-01&t=2027-02-01')).toBeNull();
    expect(readGoodDaysLink('#g=move&f=1990-05-03&t=2027-02-01')).toBeNull();
    expect(readGoodDaysLink('')).toBeNull();
  });

  it('builds the share card from the result alone: no birth date, time or name field reaches it', () => {
    const island = code(SOURCES.island);
    const card = island.slice(island.indexOf('<figure class="good-days-card"'), island.indexOf('</figure>'));
    expect(card).not.toMatch(/birth|personal/iu);
    expect(island).toContain('void run({ ...shared, zone: deviceZone, birth: null }, false);');
  });
});

describe('the outcome follow-up', () => {
  const outcome = code(read('../../islands/GoodDayOutcome.tsx'));
  const memory = code(read('./outcome-memory.ts'));

  it('sends one request, to the outcome endpoint, with exactly the answer\'s fields', () => {
    expect(outcome.match(/\bfetch\(/gu)).toHaveLength(1);
    expect(outcome).toContain('fetch(OUTCOMES_API_PATH,');
    expect(outcome).toContain("credentials: 'omit'");
    expect(outcome).toContain('JSON.stringify({ goal: pick.goal, day: pick.day, score: pick.score, personal: pick.personal, rating, ...(kept.note ? { note: kept.note } : {}) })');
    // Only the scrubbed note is sent.
    expect(outcome).toContain('const kept = scrubNote(note);');
    for (const pattern of [/localStorage/u, /sessionStorage/u, /document\.cookie/u, /history\.(?:push|replace)State/u, /sendBeacon/u, /console\./u, /plausible|gtag|posthog|analytics/iu, /birthDate|birth_date|birthTime/u]) {
      expect(outcome, String(pattern)).not.toMatch(pattern);
    }
  });

  it('keeps the device reminder in one module, which writes only the pick\'s four fields', () => {
    expect(memory).toContain('const kept: Stored = { goal: pick.goal, day: pick.day, score: pick.score, personal: pick.personal };');
    expect(memory).not.toMatch(/\bfetch\(|sendBeacon|console\.|birth/iu);
    // The finder island reaches storage only through it.
    expect(code(SOURCES.island)).not.toMatch(/localStorage|sessionStorage/u);
  });
});

describe('the time zone picker', () => {
  it('offers every zone the browser knows, sorted, with the device zone always among them', () => {
    expect(zoneChoices('Asia/Bangkok', () => ['Europe/Madrid', 'America/New_York', 'Asia/Makassar'])).toEqual(['America/New_York', 'Asia/Bangkok', 'Asia/Makassar', 'Europe/Madrid']);
    expect(zoneChoices('Asia/Makassar', () => ['Asia/Makassar', 'UTC'])).toEqual(['Asia/Makassar', 'UTC']);
  });

  it('offers the device zone alone where Intl.supportedValuesOf is missing or throws', () => {
    expect(zoneChoices('Asia/Bangkok', () => undefined)).toEqual(['Asia/Bangkok']);
    expect(zoneChoices('Asia/Bangkok', () => { throw new RangeError('unsupported'); })).toEqual(['Asia/Bangkok']);
  });

  it('lists each zone once, by its canonical name, so Kolkata does not appear twice', () => {
    const alias = (zone: string) => (zone === 'Asia/Calcutta' ? 'Asia/Kolkata' : zone);
    expect(zoneChoices('Asia/Calcutta', () => ['Asia/Kolkata', 'Asia/Bangkok'], alias)).toEqual(['Asia/Bangkok', 'Asia/Kolkata']);
    // With this runtime's own Intl, the two spellings come out as one entry.
    const both = zoneChoices('Asia/Bangkok', () => ['Asia/Calcutta', 'Asia/Kolkata']);
    expect(both).toHaveLength(2);
    expect(canonicalZone('Asia/Calcutta')).toBe(canonicalZone('Asia/Kolkata'));
    // A name the runtime does not know is dropped rather than offered.
    expect(zoneChoices('Asia/Bangkok', () => ['Not/AZone'])).toEqual(['Asia/Bangkok']);
  });

  it('counts today and the default window in the picked zone', () => {
    // 20:00 UTC on 16 November 2026 is still the 16th in New York and already the 17th in Bali.
    const instant = new Date('2026-11-16T20:00:00Z');
    expect(localToday('America/New_York', instant)).toBe('2026-11-16');
    expect(localToday('Asia/Makassar', instant)).toBe('2026-11-17');
    const island = code(SOURCES.island);
    expect(island).toContain('const today = localToday(zone);');
    // The default window moves with the zone until the person sets a date.
    expect(island).toContain('if (datesSet) return;');
  });

  it('checks age against the earliest of the picked zone\'s, the device\'s and UTC\'s today, never a day early', () => {
    // 11:00 UTC on 16 November 2026 is already the 17th in Kiritimati (UTC+14).
    const instant = new Date('2026-11-16T11:00:00Z');
    expect(localToday('Pacific/Kiritimati', instant)).toBe('2026-11-17');
    expect(ageCheckToday('Pacific/Kiritimati', 'Asia/Bangkok', instant)).toBe('2026-11-16');
    // Even a device in Kiritimati as well: UTC's today still rules, as the hosted tool's check does.
    expect(ageCheckToday('Pacific/Kiritimati', 'Pacific/Kiritimati', instant)).toBe('2026-11-16');
    // A zone behind UTC gives its own, earlier today.
    expect(ageCheckToday('Pacific/Pago_Pago', 'Asia/Bangkok', new Date('2026-11-16T05:00:00Z'))).toBe('2026-11-15');
    const island = code(SOURCES.island);
    expect(island).toContain('today: ageCheckToday(input.zone, deviceZone),');
    expect(island).toContain('max={thirteenYearsAgo(ageCheckToday(zone, deviceZone))}');
  });

  it('refuses a birth date that turns 13 tomorrow in UTC, with Kiritimati picked', async () => {
    const instant = new Date('2026-11-16T11:00:00Z');
    // Born 17 November 2013: 13 in Kiritimati on its 17 November, not yet in UTC or Bangkok.
    const today = ageCheckToday('Pacific/Kiritimati', 'Asia/Bangkok', instant);
    await expect(findGoodDays({ goal: 'launch', from: '2027-01-01', to: '2027-01-07', zone: 'Pacific/Kiritimati', today, birth: { date: '2013-11-17' } }, clock))
      .rejects.toThrow(UNDER_13_SENTENCE);
    // The birth field's latest date is 16 November 2013, so the date cannot be entered either.
    expect(thirteenYearsAgo(today)).toBe('2013-11-16');
    // The picked zone's own today alone would have let it through.
    expect(localToday('Pacific/Kiritimati', instant)).toBe('2026-11-17');
  });

  it('runs every search, shared or typed, in a named zone and prints it under the results', () => {
    const island = code(SOURCES.island);
    expect(island).toContain('<label class="field__label" for="gd-zone">Time zone for the day</label>');
    expect(island).toContain('zone: input.zone, today: ageCheckToday(input.zone, deviceZone),');
    expect(island).toContain('Days are counted in {result.zone}.');
  });

  it('says truthfully when the device reminder asks and when it is removed', () => {
    expect(code(SOURCES.island)).toContain('This browser will ask when you come back from a week to 30 days after the day.');
    expect(read('../../pages/privacy/index.astro')).toContain('or the next time you open the good day finder more than 30 days after the day.');
  });
});
