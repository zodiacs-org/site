import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bodyLongitude, computeChart } from '../engine/full';
import { CATALOG_LOCALES } from '../i18n/core';
import { alarmLines, serializePersonalEvents, stableIcalUid, type PersonalCalendarEvent } from '../ical';
import { personalSky, personalWindow, PERSONAL_WINDOW_DAYS } from './compute';
import { ALL_DAY_ALARM, localDate, personalCalendar, personalEvents, signPosition, TIMED_ALARM } from './events';
import { PERSONAL_WORDS } from './words';

const CRLF = '\r\n';
const DAY = 86_400_000;
const FROM = new Date('2027-01-01T00:00:00Z');
const TO = new Date(FROM.getTime() + PERSONAL_WINDOW_DAYS * DAY);
const LINKS = {
  solarReturn: 'https://zodiacs.org/solar-return/',
  milestones: 'https://zodiacs.org/occasions/milestones/',
  saturnReturn: 'https://zodiacs.org/saturn-return/',
  transits: 'https://zodiacs.org/transits/',
};
const chartFor = (utc: string, timeKnown: boolean) =>
  computeChart({ utc: new Date(utc), latitude: 51.5, longitude: -0.12, houseSystem: 'whole', timeKnown });
// 20 March 1998, 06:00 UTC in London: a Saturn return and a Saturn–Moon trine fall in 2027.
const known = chartFor('1998-03-20T06:00:00Z', true);
const unknown = chartFor('1998-03-20T12:00:00Z', false);
const knownSky = personalSky(known, FROM, TO);
const unknownSky = personalSky(unknown, FROM, TO);
const separation = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

function unfold(calendar: string): string[] {
  return calendar.slice(0, -CRLF.length).replace(/\r\n /g, '').split(CRLF);
}

describe('VALARM and personal events in ical.ts', () => {
  it('writes a display alarm and refuses a malformed trigger or empty description', () => {
    expect(alarmLines({ trigger: '-PT15H', description: 'Saturn return' })).toEqual([
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15H', 'DESCRIPTION:Saturn return', 'END:VALARM',
    ]);
    for (const trigger of ['-P1D', 'PT0S', '-P1W', '-P1DT2H', '+PT30M']) expect(() => alarmLines({ trigger, description: 'x' })).not.toThrow();
    for (const trigger of ['', 'P', '-PT', '-1D', '-P1H', 'PT1D', '-P1W2D']) expect(() => alarmLines({ trigger, description: 'x' }), trigger).toThrow(RangeError);
    expect(() => alarmLines({ trigger: '-P1D', description: ' ' })).toThrow(RangeError);
  });

  it('serializes timed and all-day events with CRLF, folding, DTSTAMP, URL and alarms, in a stable order', () => {
    const events: PersonalCalendarEvent[] = [
      { uid: stableIcalUid('transit', ['b']), date: '2027-12-31', summary: 'Saturn squares your Sun', description: 'Line one\nLine two; with, punctuation — and a long tail to force folding past seventy-five octets.', url: LINKS.transits, alarms: [{ trigger: ALL_DAY_ALARM, description: 'Saturn squares your Sun' }] },
      { uid: stableIcalUid('solar-return', ['a']), start: '2027-03-20T06:30:18.033Z', summary: 'Your solar return', description: 'Exact.', alarms: [{ trigger: TIMED_ALARM, description: 'Your solar return' }] },
    ];
    const calendar = serializePersonalEvents(events, { generatedAt: '2027-01-01T00:00:00Z' });
    expect(serializePersonalEvents([...events].reverse(), { generatedAt: '2027-01-01T00:00:00Z' })).toBe(calendar);
    expect(calendar.endsWith(CRLF)).toBe(true);
    expect(calendar).not.toMatch(/(?<!\r)\n/);
    for (const line of calendar.slice(0, -2).split(CRLF)) expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(75);
    const lines = unfold(calendar);
    expect(lines.slice(0, 6)).toEqual(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zodiacs.org//Personal Sky 1.0//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Zodiacs.org personal sky']);
    expect(lines.filter((line) => line === 'DTSTAMP:20270101T000000Z')).toHaveLength(2);
    const solar = lines.indexOf('DTSTART:20270320T063018Z');
    const allDay = lines.indexOf('DTSTART;VALUE=DATE:20271231');
    expect(solar).toBeGreaterThan(0);
    expect(allDay).toBeGreaterThan(solar);
    expect(lines[solar + 1]).toBe('DURATION:PT1M');
    expect(lines[allDay + 1]).toBe('DTEND;VALUE=DATE:20280101');
    expect(lines).toContain('DESCRIPTION:Line one\\nLine two\\; with\\, punctuation — and a long tail to force folding past seventy-five octets.');
    expect(lines).toContain(`URL:${LINKS.transits}`);
    expect(lines.filter((line) => line === 'BEGIN:VALARM')).toHaveLength(2);
    expect(lines).toContain('TRIGGER:-P1D');
    expect(lines).toContain('TRIGGER:-PT15H');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
    // Every component closes, and alarms sit inside their event.
    expect(lines.filter((l) => l === 'BEGIN:VEVENT').length).toBe(lines.filter((l) => l === 'END:VEVENT').length);
    expect(lines.indexOf('END:VALARM')).toBeLessThan(lines.indexOf('END:VEVENT'));
  });

  it('keeps one event per UID and refuses empty, misdated or foreign-UID input', () => {
    const event: PersonalCalendarEvent = { uid: stableIcalUid('x', ['1']), date: '2027-01-02', summary: 's', description: 'd' };
    expect(unfold(serializePersonalEvents([event, event], { generatedAt: FROM })).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(() => serializePersonalEvents([], { generatedAt: FROM })).toThrow(RangeError);
    expect(() => serializePersonalEvents([{ ...event, date: '2027-02-30' }], { generatedAt: FROM })).toThrow(RangeError);
    expect(() => serializePersonalEvents([{ ...event, uid: 'x@example.com' }], { generatedAt: FROM })).toThrow(RangeError);
    expect(() => serializePersonalEvents([{ uid: event.uid, start: 'nope', summary: 's', description: 'd' }], { generatedAt: FROM })).toThrow(RangeError);
    expect(stableIcalUid('Solar return', ['a', 'b'])).toBe(stableIcalUid('Solar return', ['a', 'b']));
    expect(stableIcalUid('solar-return', ['a', 'b'])).toMatch(/^solar-return-[0-9a-f]{16}@zodiacs\.org$/);
    expect(stableIcalUid('t', ['a', 'b'])).not.toBe(stableIcalUid('t', ['a', 'c']));
  });
});

describe('personal sky dates', () => {
  it('covers 24 months from the moment it is made', () => {
    const { from, to } = personalWindow(new Date('2026-10-15T09:00:00Z'));
    expect(to.getTime() - from.getTime()).toBe(730 * DAY);
    expect(() => personalWindow(new Date('nope'))).toThrow(RangeError);
  });

  it('finds each solar return where the Sun is back on its natal degree, within minutes of the known instant', () => {
    const sun = known.bodies.find((body) => body.body === 'Sun')!.lon;
    expect(knownSky.solarReturns).toHaveLength(2);
    for (const at of knownSky.solarReturns) expect(separation(bodyLongitude('Sun', new Date(at)), sun)).toBeLessThan(1e-4);
    // The 2027 return: pinned, and near the estimate of 29 mean tropical
    // years of 365.2422 days after the birth (2027-03-20 06:34 UTC).
    const first = Date.parse(knownSky.solarReturns[0]);
    expect(Math.abs(first - Date.parse('2027-03-20T06:30:18Z'))).toBeLessThan(2 * 60_000);
    const estimate = Date.parse('1998-03-20T06:00:00Z') + 29 * 365.2422 * DAY;
    expect(Math.abs(first - estimate)).toBeLessThan(30 * 60_000);
    expect(new Date(knownSky.solarReturns[1]).getUTCFullYear()).toBe(2028);
  });

  it('gives a Saturn return at about 29 on the date Saturn reaches its natal degree', () => {
    const saturn = known.bodies.find((body) => body.body === 'Saturn')!.lon;
    const returns = knownSky.milestones.filter((pass) => pass.kind === 'saturn-return');
    expect(returns.length).toBeGreaterThan(0);
    for (const pass of returns) {
      expect(pass.index).toBe(1);
      expect(pass.at >= FROM.toISOString() && pass.at < TO.toISOString()).toBe(true);
      expect(pass.at.slice(0, 7)).toBe('2027-04');
      expect(separation(bodyLongitude('Saturn', new Date(pass.at)), saturn)).toBeLessThan(1e-4);
    }
  });

  it('keeps only Saturn to Pluto, exact to the natal Sun or Moon, and no Moon at all without a birth time', () => {
    const positions = Object.fromEntries(known.bodies.map((body) => [body.body, body.lon]));
    expect(knownSky.contacts.some((contact) => contact.natalPoint === 'Moon')).toBe(true);
    for (const contact of knownSky.contacts) {
      expect(['Saturn', 'Uranus', 'Neptune', 'Pluto']).toContain(contact.transitBody);
      expect(['Sun', 'Moon']).toContain(contact.natalPoint);
      const gap = separation(bodyLongitude(contact.transitBody, new Date(contact.exactUtc)), positions[contact.natalPoint]);
      expect(Math.min(...[0, 90, 120, 180].map((angle) => Math.abs(gap - angle)))).toBeLessThan(1e-4);
    }
    expect(unknownSky.timeKnown).toBe(false);
    expect(unknownSky.contacts.every((contact) => contact.natalPoint === 'Sun')).toBe(true);
    const ics = personalCalendar(unknownSky, { locale: 'en', links: LINKS, timeZone: 'UTC', generatedAt: FROM })!;
    expect(ics).not.toMatch(/your Moon/);
  });

  it('numbers a retrograde loop by all its passes, even those outside the window', () => {
    const chart = chartFor('1985-11-02T12:00:00Z', false);
    const sky = personalSky(chart, FROM, TO);
    const loop = sky.contacts.filter((contact) => contact.transitBody === 'Saturn' && contact.aspect === 'opposition');
    expect(loop.map((contact) => `${contact.pass}/${contact.passCount}`)).toEqual(['1/3', '2/3']);
  });

  it('refuses a birth after the start of the calendar', () => {
    expect(() => personalSky(chartFor('2027-06-01T12:00:00Z', true), FROM, TO)).toThrow(RangeError);
  });
});

describe('personal calendar events', () => {
  const options = { locale: 'en' as const, links: LINKS, timeZone: 'Europe/London' };

  it('writes plain titles and descriptions with exact UTC times and a link back', () => {
    const events = personalEvents(knownSky, options);
    const solar = events.find((event) => event.summary === 'Your solar return')!;
    expect(solar.start).toBe(knownSky.solarReturns[0]);
    expect(solar.description).toContain(`The Sun comes back to ${signPosition(known.bodies[0].lon, 'en')}, where it was when you were born.`);
    expect(solar.description).toContain('Exact at 2027-03-20 06:30 UTC.');
    expect(solar.url).toBe(LINKS.solarReturn);
    expect(solar.alarms).toEqual([{ trigger: '-P1D', description: 'Your solar return' }]);
    const saturn = events.find((event) => event.summary.startsWith('Saturn return'))!;
    expect(saturn.url).toBe(LINKS.saturnReturn);
    expect(saturn.description).toContain('The oldest milestone in astrology');
    const trine = events.find((event) => event.summary.startsWith('Saturn trines your Moon'))!;
    expect(trine.description).toContain('Saturn flows through your emotional life: a long season of pressure and accounting, help that arrives without being asked.');
    expect(trine.url).toBe(LINKS.transits);
    expect(trine.date).toMatch(/^2027-\d{2}-\d{2}$/);
    expect(trine.alarms?.[0].trigger).toBe('-PT15H');
    for (const event of events) expect(event.description).toMatch(/More: https:\/\/zodiacs\.org\//);
  });

  it('marks dates from an unknown birth time as approximate', () => {
    for (const event of personalEvents(unknownSky, options)) expect(event.description).toContain('so this date is approximate');
    for (const event of personalEvents(knownSky, options)) expect(event.description).not.toContain('approximate');
  });

  it('gives each event the same UID in every language and on every rebuild', () => {
    const uids = (locale: typeof CATALOG_LOCALES[number]) => personalEvents(knownSky, { ...options, locale }).map((event) => event.uid);
    for (const locale of CATALOG_LOCALES) expect(uids(locale)).toEqual(uids('en'));
    expect(new Set(uids('en')).size).toBe(uids('en').length);
    const at = (generatedAt: string) => personalCalendar(knownSky, { ...options, generatedAt })!;
    expect(at('2027-01-01T00:00:00Z')).toBe(at('2027-01-01T00:00:00Z'));
    expect(at('2027-02-01T00:00:00Z').replace(/DTSTAMP:\S+/g, '')).toBe(at('2027-01-01T00:00:00Z').replace(/DTSTAMP:\S+/g, ''));
  });

  it.each(CATALOG_LOCALES)('%s: every word is written and no placeholder survives', (locale) => {
    const words = PERSONAL_WORDS[locale];
    const flat = JSON.stringify(locale === 'en' ? { ...words, movers: null, aspects: null, points: null } : words);
    expect(flat).not.toMatch(/""/);
    const calendar = personalCalendar(knownSky, { ...options, locale, generatedAt: FROM })!;
    expect(calendar).not.toMatch(/\{\w+\}|undefined|null/);
    expect(unfold(calendar).filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(personalEvents(knownSky, options).length);
    expect(calendar).not.toMatch(/token|wallet|astrofolio|crypto/i);
  });

  it('dates all-day events in the reader’s own time zone', () => {
    expect(localDate('2027-04-28T23:20:35Z', 'UTC')).toBe('2027-04-28');
    expect(localDate('2027-04-28T23:20:35Z', 'Asia/Tokyo')).toBe('2027-04-29');
    expect(localDate('2027-04-28T23:20:35Z', 'America/Los_Angeles')).toBe('2027-04-28');
  });
});

describe('personal calendar page', () => {
  it('builds the file in the browser and sends nothing anywhere', () => {
    const island = readFileSync('src/islands/PersonalCalendar.tsx', 'utf8');
    expect(island).toContain("downloadCalendarFile(result.calendar, 'zodiacs-my-sky.ics')");
    expect(island).not.toMatch(/fetch\(|sendBeacon|XMLHttpRequest|webcal:|api\/|localStorage|navigator\.share/);
    const worker = readFileSync('src/islands/PersonalCalendar.worker.ts', 'utf8');
    expect(worker).not.toMatch(/fetch\(|importScripts/);
    const page = readFileSync('src/components/return-visits/ReturnToolPage.astro', 'utf8');
    expect(page).toContain('<PersonalCalendar locale={locale} client:visible />');
  });
});
