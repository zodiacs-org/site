import { describe, expect, it } from 'vitest';
import { isAstrologyToolPath } from '../trust-boundary';
import { readFileSync } from 'node:fs';
import sky from '../../data/sky.json';
import eclipses from '../../data/eclipses.json';
import { CATALOG_LOCALES } from '../i18n/core';
import { RETURN_COPY, RETURN_EN } from './copy';
import { skyCalendar, skyCalendarEvents } from './sky-calendar';
import { saturnCountdown } from './countdown';
import { wrappedTargets, wrappedWindow } from './wrapped';
import { assembleChartPdf } from './pdf';
import { dailyManifestSchema, dailyEditions } from './chart-of-day';
import { computeChart, bodyLongitude } from '../engine/full';
import { scanTransitContacts } from '../engine/transit-scan';
import { findLongitudeCrossings } from '../engine/returns';

describe('Phase 3 owner programme', () => {
  it.each(CATALOG_LOCALES)('%s has all strings and interpolation fields', (locale) => {
    expect(Object.keys(RETURN_COPY[locale]).sort()).toEqual(Object.keys(RETURN_EN).sort());
    for (const key of Object.keys(RETURN_EN) as (keyof typeof RETURN_EN)[]) {
      const text = RETURN_COPY[locale][key]; expect(text.trim().length).toBeGreaterThan(0);
      expect([...text.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort()).toEqual([...RETURN_EN[key].matchAll(/\{\w+\}/g)].map((m) => m[0]).sort());
    }
  });
  it.each(CATALOG_LOCALES)('%s public calendar has all four requested event types and sound UTC serialization', (locale) => {
    const events = skyCalendarEvents(locale), calendar = skyCalendar(locale);
    expect(events.length).toBe(sky.moons.filter((m) => m.type === 'new' || m.type === 'full').length + eclipses.eclipses.length + sky.retrogrades.length);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    for (const kind of ['new-moon', 'full-moon', 'solar-eclipse', 'lunar-eclipse', '-retrograde-']) expect(events.some((event) => event.id.includes(kind))).toBe(true);
    expect(calendar.match(/BEGIN:VEVENT/g)?.length).toBe(events.length);
    expect(calendar).toContain('REFRESH-INTERVAL;VALUE=DURATION:P1D\r\n');
    expect(calendar).not.toMatch(/birth|natal|token|wallet|astrofolio/i);
    expect(calendar).not.toMatch(/(?<!\r)\n/);
    for (const line of calendar.split('\r\n')) expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(75);
    for (const event of events) { expect(Date.parse(String(event.start))).toBeGreaterThanOrEqual(Date.parse('2026-01-01')); if (event.end) expect(Date.parse(String(event.end))).toBeGreaterThan(Date.parse(String(event.start))); }
  });
  it('calendar UIDs stay the same across languages and refreshes', () => {
    const uids = (locale: 'en' | 'ru') => skyCalendar(locale).replace(/\r\n /g, '').match(/^UID:.+$/gm);
    expect(uids('ru')).toEqual(uids('en')); expect(skyCalendar('en')).toBe(skyCalendar('en'));
  });
  it('countdown uses next pass and UTC day boundaries, including active repeat seasons', () => {
    const at = (date: string) => ({ at: new Date(date), retrograde: false });
    const result = { seasons: [{ index: 1, first: new Date('2026-01-01'), last: new Date('2026-10-04'), crossings: [at('2026-01-01T00:00Z'), at('2026-10-04T00:01Z')] }] };
    expect(saturnCountdown(result, new Date('2026-10-03T23:59Z'))?.days).toBe(1);
    expect(saturnCountdown(result, new Date('2026-10-04T00:00Z'))?.days).toBe(0);
    expect(saturnCountdown(result, new Date('2026-10-04T00:02Z'))).toBeNull();
    expect(() => saturnCountdown(result, new Date('invalid'))).toThrow();
  });
  it('wrapped scans exact selected contacts over the year and agrees with the crossing solver', () => {
    const chart = computeChart({ utc: new Date('1990-01-01T12:00Z'), houseSystem: 'whole', timeKnown: true, latitude: 51.5, longitude: 0 });
    const { from, to } = wrappedWindow(2026);
    expect(to.toISOString()).toBe('2026-12-31T23:59:59.999Z');
    expect(wrappedTargets(chart)).toEqual(['Sun', 'Moon', 'ASC']);
    expect(wrappedTargets({ ...chart, input: { ...chart.input, timeKnown: false } })).toEqual(['Sun']);
    const contacts = scanTransitContacts(chart, from, to, { transitBodies: ['Jupiter', 'Saturn'], natalPoints: ['Sun'], aspects: ['conjunction', 'square', 'opposition'] });
    expect(contacts.length).toBeGreaterThan(0);
    const sun = chart.bodies.find((body) => body.body === 'Sun')!.lon;
    const expected = ['Jupiter', 'Saturn'].flatMap((body) => [0, 90, 180, 270].flatMap((offset) => findLongitudeCrossings(body as 'Jupiter' | 'Saturn', (sun + offset) % 360, from, to))).map((crossing) => crossing.at.getTime()).sort((a,b) => a-b);
    expect(contacts).toHaveLength(expected.length);
    contacts.forEach((contact, i) => { expect(Math.abs(Date.parse(contact.exactUtc) - expected[i])).toBeLessThan(1000); const separation = Math.abs(((bodyLongitude(contact.transitBody, new Date(contact.exactUtc)) - sun + 540) % 360) - 180); expect(Math.min(...[0,90,180].map((angle) => Math.abs(angle-separation)))).toBeLessThan(.00001); });
    expect(() => wrappedWindow(2200)).toThrow();
  });
  it('PDF offsets are byte-accurate and methodology links are same-origin public links', async () => {
    const blob = assembleChartPdf([{ jpeg: new Uint8Array([255,216,255,217]), width: 1800, height: 2546 }]);
    expect(blob.type).toBe('application/pdf'); const bytes = new Uint8Array(await blob.arrayBuffer()); const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true); expect(text).toContain('/MediaBox [0 0 595.28 841.89]'); expect(text).toContain('/URI (https://zodiacs.org/methodology/)');
    const xref = text.slice(text.indexOf('xref\n')).split('\n'); for (let i=1;i<=6;i++) { const offset = Number(xref[i+2].slice(0,10)); expect(new TextDecoder().decode(bytes.slice(offset, offset+10))).toContain(`${i} 0 obj`); }
    expect(() => assembleChartPdf([], 'https://example.com')).toThrow();
  });
  it('unapproved, unsourced, malformed, or stale daily editions are rejected', () => {
    const translated = Object.fromEntries(CATALOG_LOCALES.map((locale) => [locale, 'Reviewed birth date; birth time unknown.']));
    const edition = { day: '2026-10-04', name: 'Synthetic public figure', birthDate: '1990-01-01', birthTime: null, timeQuality: 'unknown', birthSource: 'https://example.com/record', birthSourceTitle: 'Synthetic source', newsSource: 'https://example.com/news', newsSourceTitle: 'Synthetic news', newsDate: '2026-10-03', reliability: translated, reason: translated, ownerApproval: { approved: true, approvedAt: '2026-10-04T00:00:00Z', evidence: 'Synthetic owner approval fixture only.' } };
    const manifest = { version: 1, editions: [edition] }; expect(dailyManifestSchema.safeParse(manifest).success).toBe(true);
    for (const change of [{ ownerApproval: null }, { ownerApproval: { ...edition.ownerApproval, approved: false } }, { birthSource: '' }, { birthTime: '12:00' }, { birthDate: '2001-02-30' }, { birthDate: '2027-01-01' }, { newsDate: '2026-09-01' }, { reliability: { en: 'only' } }]) expect(dailyManifestSchema.safeParse({ ...manifest, editions: [{ ...edition, ...change }] }).success).toBe(false);
    expect(dailyEditions).toEqual([]);
  });
  it('all new tools use consumer navigation in six languages', () => { for (const locale of CATALOG_LOCALES) for (const path of ['/sky-calendar/', '/astrologer-kit/', '/your-sky-wrapped/', '/chart-of-the-day/']) expect(isAstrologyToolPath(`${locale === 'en' ? '' : '/' + locale}${path}`)).toBe(true); });
  it('personal surfaces omit analytics and export counts never accept birth inputs', () => {
    const page = readFileSync('src/components/return-visits/ReturnToolPage.astro','utf8'); expect(page).toContain('privateSurface={kind');
    const renderer = readFileSync('src/lib/return-visits/wrapped-card.ts','utf8'); expect(renderer).not.toMatch(/ChartEntry|SavedChart|birthDate|exactUtc|fetch\(/);
    for (const locale of ['', 'es/','pt/','fr/','it/','ru/']) expect(readFileSync(`src/pages/${locale}saturn-return/index.astro`,'utf8')).toContain('privateSurface');
  });
});
