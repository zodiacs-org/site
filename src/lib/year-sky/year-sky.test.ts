import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bodyLongitude, computeChart } from '../engine/full';
import type { EclipseRecord } from '../upcoming';
import eclipsesData from '../../data/eclipses.json';
import skyData from '../../data/sky.json';
import ingressesData from '../../data/ingresses.json';
import { yearSkyWords } from './copy';
import { EDITION_PATH, EDITION_YEAR, inYear, quarterOf, yearWindow } from './edition';
import { generalSky, signAt, type IngressWindowRecord } from './general';
import { scanYearSky, type YearSkyNatal } from './scan';
import { loopsOf, personalYear } from './moments';
import { calendarMoments, yearCalendar, yearCalendarEvents, YEAR_SKY_CALENDAR_FILENAME } from './calendar';
import { yearCardFilename } from './card';
import type { YearMoment } from './types';

const ECLIPSES = (eclipsesData as { eclipses: EclipseRecord[] }).eclipses;
const INGRESSES = (ingressesData as { windows: IngressWindowRecord[] }).windows;
const TABLES = { eclipses: ECLIPSES, ingresses: INGRESSES };
const DASHES = /[‒–—―]/;
const separation = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const general = generalSky({ eclipses: ECLIPSES, retrogrades: skyData.retrogrades, ingresses: INGRESSES });

/** A fixed test chart: 20 March 1998, 06:00 UTC, London (Sun 29° Pisces). */
const BIRTH = { utc: '1998-03-20T06:00:00.000Z', latitude: 51.5, longitude: -0.12 };
/** A second: 7 February 1990, 12:00 UTC, New York, birth time unknown (Sun 18° Aquarius). */
const UNTIMED = { utc: '1990-02-07T12:00:00.000Z', latitude: 40.71, longitude: -74.01 };

function natalFor(input: typeof BIRTH, timeKnown: boolean): YearSkyNatal {
  const chart = computeChart({ utc: new Date(input.utc), latitude: input.latitude, longitude: input.longitude, houseSystem: 'whole', timeKnown });
  return {
    bodies: chart.bodies.filter((b) => !b.body.includes('Node')).map(({ body, lon }) => ({ body, lon })),
    asc: timeKnown ? chart.angles!.asc : null,
    mc: timeKnown ? chart.angles!.mc : null,
    utc: chart.input.utc.toISOString(),
    timeKnown,
  };
}

const timedNatal = natalFor(BIRTH, true);
const timedScan = scanYearSky(timedNatal, EDITION_YEAR, general.retrogrades);
const timed = personalYear(timedScan, timedNatal, TABLES);
const untimedNatal = natalFor(UNTIMED, false);
const untimedScan = scanYearSky(untimedNatal, EDITION_YEAR, general.retrogrades);
const untimed = personalYear(untimedScan, untimedNatal, TABLES);
const lon = (natal: YearSkyNatal, body: string) => natal.bodies.find((b) => b.body === body)!.lon;

function allText(moments: readonly YearMoment[]): string[] {
  return moments.flatMap((m) => [m.title, m.line, m.detail, m.card ?? '', ...m.dates.map((d) => d.label ?? '')]);
}

describe('the 2027 edition and its data', () => {
  it('reads the UTC calendar year 2027 at /your-2027-sky/', () => {
    expect(EDITION_YEAR).toBe(2027);
    expect(EDITION_PATH).toBe('/your-2027-sky/');
    const { from, to } = yearWindow();
    expect(from.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(to.toISOString()).toBe('2028-01-01T00:00:00.000Z');
    expect(inYear('2027-12-31T23:59:59Z')).toBe(true);
    expect(inYear('2028-01-01T00:00:00Z')).toBe(false);
    expect(quarterOf('2027-08-02T10:06:41Z')).toBe(2);
  });

  it('has committed eclipse, retrograde and ingress tables that cover the whole of 2027', () => {
    for (const span of [eclipsesData, skyData]) {
      expect(span.from <= '2027-01-01').toBe(true);
      expect(span.to >= '2028-01-01').toBe(true);
    }
    for (const horizon of ingressesData.horizons) {
      expect(horizon.from <= '2027-01-01' && horizon.to >= '2028-01-01').toBe(true);
    }
  });
});

describe('the 2027 sky everyone shares', () => {
  it('lists the five eclipses of 2027 with their signs', () => {
    const eclipses = general.moments.filter((m) => m.kind === 'eclipse');
    expect(eclipses.map((m) => m.at.slice(0, 10))).toEqual(['2027-02-06', '2027-02-20', '2027-07-18', '2027-08-02', '2027-08-17']);
    expect(eclipses.map((m) => m.title)).toEqual([
      'Annular solar eclipse', 'Penumbral lunar eclipse', 'Penumbral lunar eclipse', 'Total solar eclipse', 'Penumbral lunar eclipse',
    ]);
    expect(eclipses[3].line).toContain('9° Leo'); // 9°55′ Leo: whole degrees truncate
  });

  it('lists every retrograde that touches 2027, with the three Mercury retrogrades in their signs', () => {
    const retro = general.moments.filter((m) => m.kind === 'retrograde');
    expect(retro.map((m) => m.body)).toEqual(['Jupiter', 'Uranus', 'Mars', 'Mercury', 'Pluto', 'Mercury', 'Neptune', 'Saturn', 'Uranus', 'Mercury']);
    const mercury = retro.filter((m) => m.body === 'Mercury');
    expect(mercury.map((m) => m.detail.split(',')[0])).toEqual(['February 9 to March 3', 'June 10 to July 4', 'October 7 to October 28']);
    expect(mercury[0].detail).toContain('Pisces and Aquarius');
    // A retrograde carried over from 2026 sits at the start of the year and names its own year.
    const jupiter = retro.find((m) => m.body === 'Jupiter')!;
    expect(jupiter.at).toBe('2027-01-01T00:00:00.000Z');
    expect(jupiter.underWay).toBe(true);
    expect(jupiter.detail).toContain('December 13, 2026 to April 13');
    expect(jupiter.dates).toEqual([{ at: '2027-04-13T02:08:29.765Z', label: 'turns direct' }]);
  });

  it('has Jupiter entering Virgo on July 26 and the slow planets where they spend the year', () => {
    const ingress = general.moments.filter((m) => m.kind === 'ingress');
    expect(ingress.map((m) => `${m.title} ${m.at.slice(0, 10)}`)).toEqual(['Jupiter enters Virgo 2027-07-26']);
    expect(general.background.map((b) => b.line)).toEqual([
      'Jupiter: Leo until July 26, then Virgo.',
      'Saturn: Aries all year.',
      'Uranus: Gemini all year.',
      'Neptune: Aries all year.',
      'Pluto: Aquarius all year.',
    ]);
    expect(signAt(INGRESSES, 'Saturn', '2027-06-01T00:00:00Z')).toBe('aries');
  });

  it('carries no forecast confidence, since it reads no chart', () => {
    expect(general.moments.every((m) => m.confidence === null)).toBe(true);
  });
});

describe('the year for a fixed test chart (1998-03-20 06:00 UTC, London)', () => {
  it('finds the solar return on 20 March 2027, where the Sun is back on its natal degree', () => {
    expect(timedScan.solarReturns).toHaveLength(1);
    const at = timedScan.solarReturns[0];
    expect(at.slice(0, 10)).toBe('2027-03-20');
    expect(separation(bodyLongitude('Sun', new Date(at)), lon(timedNatal, 'Sun'))).toBeLessThan(1e-4);
    const moment = timed.moments.find((m) => m.kind === 'solar-return')!;
    expect(moment.detail).toBe('Exact on March 20 at 06:30 UTC.');
    expect(moment.dates).toEqual([{ at, timed: true }]);
  });

  it('finds the first Saturn return in April 2027', () => {
    const saturn = timed.moments.find((m) => m.kind === 'milestone')!;
    expect(saturn.title).toBe('Your first Saturn return');
    expect(saturn.at.slice(0, 7)).toBe('2027-04');
    expect(separation(bodyLongitude('Saturn', new Date(saturn.at)), lon(timedNatal, 'Saturn'))).toBeLessThan(1e-4);
    expect(saturn.card).toBe('My Saturn return');
  });

  it('dates each slow contact where the planet is exactly in aspect', () => {
    const slow = timed.moments.filter((m) => m.kind === 'slow');
    expect(slow.map((m) => `${m.at.slice(0, 10)} ${m.title}`)).toEqual([
      '2027-04-02 Saturn trines your Moon',
      '2027-07-14 Jupiter trines your midheaven',
      '2027-07-24 Saturn trines your midheaven',
      '2027-10-14 Jupiter squares your Moon',
      '2027-11-23 Jupiter opposes your rising degree',
    ]);
    const points: Record<string, number> = { Moon: lon(timedNatal, 'Moon'), ASC: timedNatal.asc!, MC: timedNatal.mc! };
    for (const contact of timedScan.slow.filter((c) => inYear(c.exactUtc))) {
      const gap = separation(bodyLongitude(contact.transitBody, new Date(contact.exactUtc)), points[contact.natalPoint] ?? lon(timedNatal, contact.natalPoint));
      expect(Math.min(...[0, 90, 120, 180].map((a) => Math.abs(gap - a)))).toBeLessThan(1e-3);
    }
    // A loop that runs on into 2028 says so, and lists its 2027 passes.
    expect(slow[2].detail).toContain('Exact on July 24 and August 25. The loop ends in 2028.');
  });

  it('puts Jupiter into the 7th house by whole sign houses and the slow planets in their houses all year', () => {
    const ingress = timed.moments.find((m) => m.kind === 'ingress-personal')!;
    expect(ingress.title).toBe('Jupiter moves into your 7th house');
    expect(ingress.replaces).toBe(general.moments.find((m) => m.kind === 'ingress')!.id);
    expect(timed.allYear.map((m) => m.line.split(',')[0])).toEqual([
      'Jupiter is in Leo until July 26',
      'Saturn spends the year in Aries',
      'Uranus spends the year in Gemini',
      'Neptune spends the year in Aries',
      'Pluto spends the year in Aquarius',
    ]);
  });

  it('settles the Sun, Moon and rising signs and labels every reading with its confidence', () => {
    expect(timed.signs).toEqual({ sun: 'pisces', moon: 'sagittarius', rising: 'pisces' });
    expect(timed.detail).toBe('timed-place');
    for (const m of timed.moments) expect([70, 75]).toContain(m.confidence);
    expect(timed.moments.find((m) => m.kind === 'slow')!.confidence).toBe(75);
    expect(timed.moments.find((m) => m.kind === 'ingress-personal')!.confidence).toBe(70);
    expect(yearSkyWords().confidence(75)).toBe('Reading confidence 75%');
  });

  it('picks at most four highlights, in date order, each with card words', () => {
    expect(timed.highlights.length).toBeLessThanOrEqual(4);
    expect(timed.highlights.map((m) => m.card)).toEqual([
      'My Saturn return', 'Jupiter in my 7th house', 'Jupiter squares my Moon', 'Jupiter opposes my rising degree',
    ]);
  });
});

describe('the year for a chart without a birth time (1990-02-07, New York)', () => {
  it('reads the Sun only, with no Moon, rising degree, midheaven or houses', () => {
    expect(untimed.timeKnown).toBe(false);
    expect(untimed.detail).toBe('date');
    expect(untimed.signs).toEqual({ sun: 'aquarius', moon: null, rising: null });
    expect(untimedScan.slow.every((c) => c.natalPoint === 'Sun')).toBe(true);
    expect(untimed.allYear).toEqual([]);
    expect(allText(untimed.moments).join(' ')).not.toMatch(/your (Moon|rising degree|midheaven)/);
    for (const m of untimed.moments) expect([55, 60]).toContain(m.confidence);
  });

  it('finds the February annular eclipse on the Sun and Venus over the Sun', () => {
    const eclipse = untimed.moments.find((m) => m.kind === 'eclipse-hit')!;
    expect(eclipse.title).toBe('A solar eclipse lands on your Sun');
    expect(eclipse.at.slice(0, 10)).toBe('2027-02-06');
    expect(eclipse.replaces).toBe('eclipse-2027-02-06T15:59:39.357Z');
    expect(separation(317.63, lon(untimedNatal, 'Sun'))).toBeLessThan(1);
    expect(eclipse.confidence).toBe(60);
    const venus = untimed.moments.find((m) => m.kind === 'pass' && m.body === 'Venus')!;
    expect(venus.at.slice(0, 10)).toBe('2027-03-16');
    expect(separation(bodyLongitude('Venus', new Date(venus.at)), lon(untimedNatal, 'Sun'))).toBeLessThan(1e-3);
  });
});

describe('retrogrades over placements', () => {
  it('finds the stations of the year and flags a placement inside the loop', () => {
    expect(timedScan.stations.map((s) => s.planet)).toEqual(['Mars', 'Mercury', 'Mercury', 'Mercury']);
    for (const station of timedScan.stations) {
      expect(separation(bodyLongitude(station.planet as 'Mars', new Date(station.from)), station.retroLon)).toBeLessThan(1e-9);
    }
    // Move the test chart's Venus to the middle of February's Mercury loop, which Mercury crosses three times.
    const mercury = timedScan.stations.find((s) => s.planet === 'Mercury')!;
    const norm = (value: number) => ((value % 360) + 360) % 360;
    const loopLon = norm(mercury.directLon + norm(mercury.retroLon - mercury.directLon) / 2);
    expect(Math.floor(loopLon / 30)).toBe(10); // Aquarius, between the direct and retrograde stations
    const natal = { ...timedNatal, bodies: timedNatal.bodies.map((b) => (b.body === 'Venus' ? { ...b, lon: loopLon } : b)) };
    const year = personalYear({ ...timedScan, stations: [mercury] }, natal, TABLES);
    const hit = year.moments.find((m) => m.kind === 'retrograde-hit')!;
    expect(hit.title).toContain('Mercury retrograde goes back over your');
    expect(hit.title).toContain('Venus');
    expect(hit.dates.map((d) => d.label)).toEqual(['turns retrograde', 'turns direct']);
    expect(hit.replaces).toBe(`retrograde-Mercury-${mercury.from}`);
    expect(hit.card).toContain('Mercury retrograde over my');
  });
});

describe('retrograde loops', () => {
  it('groups exact passes into loops by planet, point and aspect', () => {
    const pass = (at: string, transitBody: 'Saturn' | 'Venus' = 'Saturn') => ({ transitBody, natalPoint: 'Sun' as const, aspect: 'square' as const, exactUtc: at, pass: 1, passCount: 1 });
    const loops = loopsOf([pass('2027-01-01T00:00:00Z'), pass('2027-06-01T00:00:00Z'), pass('2027-10-01T00:00:00Z'), pass('2034-01-01T00:00:00Z')]);
    expect(loops.map((loop) => loop.length)).toEqual([3, 1]);
    // Venus meets the Sun again within the year without a loop: two separate passes.
    expect(loopsOf([pass('2027-01-01T00:00:00Z', 'Venus'), pass('2027-10-01T00:00:00Z', 'Venus')]).map((l) => l.length)).toEqual([1, 1]);
  });
});

describe('the calendar file', () => {
  const options = { locale: 'en' as const, timeZone: 'Europe/London', generatedAt: '2026-11-05T00:00:00Z', pageUrl: 'https://zodiacs.org/your-2027-sky/' };
  const moments = calendarMoments(timed.moments, general.moments);
  const ics = yearCalendar(moments, options)!;
  const unfolded = ics.replace(/\r\n /g, '');

  it('holds the personal moments and the shared sky, a personal moment standing in for the shared one it replaces', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(unfolded).toContain('X-WR-CALNAME:Zodiacs.org · My 2027 sky');
    expect(unfolded).toContain('SUMMARY:Your first Saturn return');
    expect(unfolded).toContain('SUMMARY:Your solar return');
    expect(unfolded).toContain('DTSTART:20270320T063');
    expect(unfolded).toContain('SUMMARY:Total solar eclipse');
    expect(unfolded).toContain('SUMMARY:Jupiter moves into your 7th house');
    expect(unfolded).not.toContain('SUMMARY:Jupiter enters Virgo');
    expect(unfolded).toContain('Reading confidence 75%');
    const events = yearCalendarEvents(moments, options);
    expect(new Set(events.map((e) => e.uid)).size).toBe(events.length);
    expect(unfolded.match(/BEGIN:VEVENT/g)!.length).toBe(events.length);
    expect(events.every((e) => String(e.start ?? `${e.date}T12:00:00Z`).startsWith('2027'))).toBe(true);
  });

  it('carries no birth date, time, place or coordinates, and a file name the same for everyone', () => {
    expect(YEAR_SKY_CALENDAR_FILENAME).toBe('zodiacs-2027-sky.ics');
    for (const forbidden of ['1998', '1990', '06:00', '51.5', '-0.12', '40.71', 'London', 'New York']) {
      expect(unfolded).not.toContain(forbidden);
    }
    const untimedIcs = yearCalendar(calendarMoments(untimed.moments, general.moments), options)!.replace(/\r\n /g, '');
    for (const forbidden of ['1990', '12:00', '40.71', '-74.01']) expect(untimedIcs).not.toContain(forbidden);
    for (const url of unfolded.matchAll(/https?:\/\/\S+/g)) expect(url[0]).toBe('https://zodiacs.org/your-2027-sky/');
  });

  it('names the share cards the same for everyone', () => {
    expect(yearCardFilename(2027, 'square')).toBe('zodiacs-2027-sky.png');
    expect(yearCardFilename(2027, 'story')).toBe('zodiacs-2027-sky-story.png');
  });
});

describe('copy rules', () => {
  const w = yearSkyWords('en');
  const words = [
    ...Object.values(w).filter((v): v is string => typeof v === 'string' && v !== w.calendarForecast),
    ...w.quarterNames, ...w.moreLinks.map((l) => l.label),
    w.cardCount(1), w.cardCount(9),
  ];

  it('uses no em or en dashes anywhere a reader sees', () => {
    for (const text of [...words, ...allText(general.moments), ...general.background.map((b) => b.line), ...allText(timed.moments), ...allText(timed.allYear), ...allText(untimed.moments)]) {
      expect(text, text).not.toMatch(DASHES);
    }
    const page = readFileSync(resolve('src/pages/your-2027-sky/index.astro'), 'utf8');
    const island = readFileSync(resolve('src/islands/YearSky.tsx'), 'utf8');
    for (const source of [page, island]) expect(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')).not.toMatch(DASHES);
  });

  it('keeps clear of health, money, betting, guarantees and market words, and of smug tells', () => {
    const all = [...words, ...allText(general.moments), ...allText(timed.moments), ...allText(timed.allYear), ...allText(untimed.moments)].join(' ');
    expect(all).not.toMatch(/\b(health|illness|medical|money|invest\w*|financ\w*|bet|betting|lottery|token|crypto|market|guaranteed?)\b/i);
    expect(all).not.toMatch(/properly|shows its work|no mush|not vibes|like a human/i);
    // The one guarantee sentence is the disclaimer that there is none.
    expect(w.calendarForecast).toBe('Dates are computed; what they mean is astrology’s forecast, not a guarantee.');
  });
});
