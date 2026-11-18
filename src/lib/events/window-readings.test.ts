import { describe, expect, it } from 'vitest';
import { eventsCatalog } from './catalog';
import { signNameFor } from './format';
import { pageEvent } from './page-event';
import { formatDate } from '../i18n/dates';
import { bodyLongitude } from '../engine/full';
import type { BodyName } from '../engine/types';
import { signForLongitude } from '../signs';
import { moonDistanceLunation, moonDistanceLunations, supermoon } from '../supermoon';
import sky from '../../data/sky.json';
import eclipsesData from '../../data/eclipses.json';
import ingressesData from '../../data/ingresses.json';
import { worldTimes } from '../../world-times/world-times';
import {
  WINDOW_READINGS, WINDOW_READINGS_UPDATED, WINDOW_READING_IDS, windowInterpretation, windowTimesLine,
} from './window-readings';

const catalog = eventsCatalog();
const committedAnchor = (id: string): string => {
  const { facts } = catalog.byId.get(id)!;
  return facts.committed?.anchor ?? facts.at ?? facts.start ?? '';
};

/**
 * Decision J's window, 14 November 2026 to 13 November 2027, less what the
 * 2027 style-guide readings cover (ZOD-211: each 2027 full moon, eclipse,
 * retrograde and sign change).
 */
const inScope = catalog.pages.filter((event) => {
  const { family, subtype, id } = event.facts;
  const anchor = committedAnchor(id);
  if (anchor < '2026-11-14' || anchor >= '2027-11-14') return false;
  if (family === 'aspect') return true;
  if (family === 'lunation' && subtype === 'new') return true;
  return family === 'lunation' && subtype === 'full' && anchor.startsWith('2026');
});

const monthDay = (iso: string) => formatDate('en', new Date(iso), { month: 'long', day: 'numeric', timeZone: 'UTC' });
const words = (text: string) => text.split(/\s+/u).filter(Boolean).length;
const sentenceList = (text: string) => text.split(/(?<=[.?!][”"’']?)\s+/u).filter(Boolean);
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const datesIn = (text: string) => [...text.matchAll(new RegExp(`\\b(?:${MONTHS}) \\d{1,2}\\b`, 'gu'))].map((m) => m[0]);

/** Every UTC day on which the catalog has something happen: an instant, a station, a shadow edge. */
const skyDays = new Set(catalog.events.flatMap((event) => {
  const { at, start, end, preShadowStart, postShadowEnd } = event.facts;
  return [at, start, end, preShadowStart, postShadowEnd].filter((iso): iso is string => Boolean(iso)).map(monthDay);
}));

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const BODY = `(?:${BODIES.join('|')})`;
const SIGN = `(?:${SIGNS.join('|')})`;
const SKY_WORDS = new RegExp(`\\b(?:${BODIES.join('|')}|eclipse|sign|planet|sky|star|${SIGNS.join('|')})\\b`, 'u');
const JARGON = /\b(?:retrograde|station(?:s|ed)?|ingress|aspect|conjunction|opposition|trine|sextile|square|orb|degree|node|lunation|house|transit|shadow period)\b|°/iu;

const signAt = (body: string, at: Date) => signForLongitude(bodyLongitude(body as BodyName, at)).name;
const movesBackward = (body: string, at: Date) => (sky.retrogrades as { planet: string; from: string; to: string | null }[])
  .some((cycle) => cycle.planet === body && Date.parse(cycle.from) <= at.getTime()
    && (cycle.to === null || at.getTime() <= Date.parse(cycle.to)));

const text = (id: string) => {
  const r = WINDOW_READINGS[id];
  return {
    ...r,
    guide: [r.hook, r.why, r.tryIt, r.comeBack].join(' '),
    all: [r.hook, r.why, r.tryIt, r.sky, r.who, ...r.questions, r.comeBack].join(' '),
  };
};

describe('readings for the coming twelve months (ZOD-221, decision J)', () => {
  it('covers each new moon and slow alignment of the window and the two full moons left in 2026, and nothing else', () => {
    expect([...WINDOW_READING_IDS].sort()).toEqual(inScope.map((event) => event.facts.id).sort());
    const count = (test: (event: typeof inScope[number]) => boolean) => inScope.filter(test).length;
    expect({
      fullMoons: count((event) => event.facts.subtype === 'full'),
      newMoons: count((event) => event.facts.subtype === 'new'),
      alignments: count((event) => event.facts.family === 'aspect'),
    }).toEqual({ fullMoons: 2, newMoons: 12, alignments: 9 });
    for (const event of inScope) expect(event.indexEligible, event.facts.id).toBe(true);
    expect(WINDOW_READINGS_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });

  it('reaches the page in the guide’s order, and leaves the catalog’s reading alone', () => {
    for (const event of inScope) {
      const reading = WINDOW_READINGS[event.facts.id];
      const page = pageEvent(event);
      expect(page.indexEligible).toBe(true);
      expect(page.facts).toBe(event.facts);
      expect(page.interpretation).toEqual({
        lead: reading.hook,
        body: [reading.why, `Try it: ${reading.tryIt}`, reading.sky, reading.who, windowTimesLine(event.facts), reading.comeBack],
        reflections: [...reading.questions],
      });
      expect(event.interpretation?.lead).not.toBe(reading.hook);
    }
    const outside = catalog.pages.find((event) => event.facts.id === 'full-moon-2026-07-29')!;
    expect(pageEvent(outside)).toBe(outside);
    expect(windowInterpretation(outside.facts)).toBeUndefined();
  });

  it('opens with one sentence of advice and no sky detail', () => {
    for (const [id, reading] of Object.entries(WINDOW_READINGS)) {
      expect(sentenceList(reading.hook), `${id} hook`).toHaveLength(1);
      expect(words(reading.hook), `${id} hook`).toBeLessThanOrEqual(16);
      expect(SKY_WORDS.test(reading.hook), `${id}: ${reading.hook}`).toBe(false);
      expect(/\d/u.test(reading.hook), `${id}: ${reading.hook}`).toBe(false);
    }
  });

  it('repeats no sentence between pages', () => {
    const seen = new Map<string, string>();
    for (const id of WINDOW_READING_IDS) {
      const r = WINDOW_READINGS[id];
      for (const sentence of sentenceList([r.hook, r.why, r.tryIt, r.sky, r.who, ...r.questions].join(' '))) {
        expect(seen.get(sentence), `${id} repeats ${seen.get(sentence)}: ${sentence}`).toBeUndefined();
        seen.set(sentence, id);
      }
    }
  });

  it('keeps the guide’s shape and length', () => {
    for (const id of WINDOW_READING_IDS) {
      const reading = WINDOW_READINGS[id];
      expect(sentenceList(reading.why).length, `${id} why`).toBeGreaterThanOrEqual(2);
      expect(sentenceList(reading.why).length, `${id} why`).toBeLessThanOrEqual(4);
      expect(sentenceList(reading.tryIt).length, `${id} try it`).toBeLessThanOrEqual(2);
      expect(words(reading.tryIt), `${id} try it`).toBeLessThanOrEqual(20);
      expect(sentenceList(reading.sky).length, `${id} sky`).toBeGreaterThanOrEqual(3);
      expect(sentenceList(reading.who).length, `${id} who`).toBeGreaterThanOrEqual(2);
      expect(sentenceList(reading.who).length, `${id} who`).toBeLessThanOrEqual(3);
      expect(reading.questions, `${id} questions`).toHaveLength(2);
      for (const question of reading.questions) {
        expect(sentenceList(question), question).toHaveLength(1);
        expect(question.endsWith('?'), question).toBe(true);
        expect(SKY_WORDS.test(question), question).toBe(false);
      }
      expect(sentenceList(reading.sky).length, `${id} sky`).toBeLessThanOrEqual(5);
      expect(sentenceList(reading.comeBack).length, `${id} come back`).toBeLessThanOrEqual(3);
      expect(reading.comeBack, `${id} come back`).toMatch(/Come back[^.]*\.$/u);
      expect(words(text(id).all), `${id} words`).toBeGreaterThanOrEqual(180);
      expect(words(text(id).all), `${id} words`).toBeLessThanOrEqual(300);
      for (const sentence of sentenceList(text(id).all)) expect(words(sentence), `${id}: ${sentence}`).toBeLessThanOrEqual(36);
    }
  });

  it('says what astrologers read, in plain words', () => {
    for (const id of WINDOW_READING_IDS) {
      const reading = WINDOW_READINGS[id];
      const { facts } = catalog.byId.get(id)!;
      expect(/\b[Aa]strologers\b/u.test(reading.why), `${id}: astrologers`).toBe(true);
      expect(/\b[Aa]strologers (?:would say|read|treat)\b/u.test(reading.who), `${id}: who is astrologers’ reading`).toBe(true);
      expect(/\bread\b|\blink\b/u.test(reading.why), `${id}: read or link`).toBe(true);
      // An alignment page explains its own word once; no other sky term goes unexplained.
      const own = facts.aspectType ? new RegExp(`\\b${facts.aspectType}\\b`, 'giu') : undefined;
      const plain = own ? text(id).all.replace(own, '') : text(id).all;
      expect(JARGON.test(plain), `${id}: ${plain.match(JARGON)?.[0]}`).toBe(false);
      if (facts.aspectType) expect(reading.why, id).toMatch(/(?:third|sixth|quarter) of the circle apart/u);
      expect(/[–—]/u.test(text(id).all), `${id}: dash`).toBe(false);
      expect(/!|\b(?:you will|you[’']ll|guaranteed|destined|certain to|beware|disaster|doom)\b/iu.test(text(id).all), id).toBe(false);
      expect(/\b(?:money|invest\w*|buy|sell|trade|bet|diagnos\w*|cure|illness|disease)\b/iu.test(text(id).all), id).toBe(false);
    }
  });

  it('names its own event: the day, the signs and the bodies', () => {
    for (const event of inScope) {
      const { facts } = event;
      const reading = WINDOW_READINGS[facts.id];
      expect(reading.why, `${facts.id} day`).toContain(`On ${monthDay(facts.at!)} `);
      for (const sign of facts.signs) expect(reading.why, `${facts.id} ${sign}`).toContain(signNameFor(sign));
      const bodies = facts.family === 'lunation' ? ['Moon', 'Sun'] : facts.bodies;
      for (const body of bodies) expect(reading.why, `${facts.id} ${body}`).toContain(body);
      if (facts.moonName) expect(reading.sky, facts.id).toContain(`the ${facts.moonName} Moon`);
    }
  });

  it('places every planet where the engine has it at the event’s instant', () => {
    let placements = 0;
    for (const event of inScope) {
      const at = new Date(event.facts.at!);
      const { why, sky: skyText, guide } = text(event.facts.id);
      for (const match of `${why} ${skyText}`.matchAll(new RegExp(`\\b(${BODY}) (?:is |sits |stands )?in (${SIGN})\\b`, 'gu'))) {
        expect(signAt(match[1], at), `${event.facts.id}: ${match[0]}`).toBe(match[2]);
        placements += 1;
      }
      // "The Sun is across the sky in Sagittarius", "The Sun is opposite in Capricorn".
      for (const match of why.matchAll(new RegExp(`The Sun is (?:across the sky|opposite) in (${SIGN})`, 'gu'))) {
        expect(signAt('Sun', at), `${event.facts.id}: ${match[0]}`).toBe(match[1]);
        placements += 1;
      }
      for (const match of skyText.matchAll(new RegExp(`in (${SIGN}), the same sign as (${BODY})`, 'gu'))) {
        expect(signAt(match[2], at), `${event.facts.id}: ${match[0]}`).toBe(match[1]);
      }
      // Whoever is said to be moving backward is, and whoever is said to be moving forward is not.
      const named = (phrase: string) => [...phrase.matchAll(new RegExp(BODY, 'gu'))].map((m) => m[0]);
      for (const match of skyText.matchAll(new RegExp(`((?:${BODY}(?: in ${SIGN})?(?:, | and )?)+) (?:(?:both|also|all|still|now) )*seems? to be moving backward`, 'gu'))) {
        for (const body of named(match[1])) expect(movesBackward(body, at), `${event.facts.id}: ${body} backward`).toBe(true);
        placements += 1;
      }
      for (const match of skyText.matchAll(new RegExp(`(${BODY}) is (?:still )?moving forward`, 'gu'))) {
        expect(movesBackward(match[1], at), `${event.facts.id}: ${match[1]} forward`).toBe(false);
      }
      if (/\b[Bb]oth (?:planets )?are moving forward\b/u.test(skyText)) {
        for (const body of event.facts.bodies) expect(movesBackward(body, at), `${event.facts.id}: ${body} forward`).toBe(false);
      }
      if (/\bno planet seems to be moving backward\b/u.test(skyText)) {
        for (const body of BODIES.slice(2)) expect(movesBackward(body, at), `${event.facts.id}: ${body}`).toBe(false);
      }
      expect(/backward/u.test(guide.replace(/starts to look as if it is moving backward/gu, '')), event.facts.id).toBe(false);
    }
    expect(placements).toBeGreaterThanOrEqual(30);
  });

  it('gives the Moon’s distance as the site’s data has it, and calls a supermoon by the site’s rule', () => {
    const fulls2026 = moonDistanceLunations().filter((l) => l.type === 'full' && l.at.startsWith('2026'));
    for (const event of inScope) {
      const { facts } = event;
      const skyText = WINDOW_READINGS[facts.id].sky;
      const distances = [...text(facts.id).all.matchAll(/\b(\d{3}),(\d{3}) km\b/gu)].map((m) => Number(m[1] + m[2]));
      if (facts.family !== 'lunation') {
        expect(distances, facts.id).toEqual([]);
        expect(/supermoon/iu.test(text(facts.id).all), facts.id).toBe(false);
        continue;
      }
      const lunation = moonDistanceLunation(facts.subtype, committedAnchor(facts.id))!;
      expect(lunation, facts.id).toBeDefined();
      const hours = (iso: string) => (Date.parse(iso) - Date.parse(lunation.at)) / 3_600_000;
      const known = [lunation.distanceKm, lunation.perigee.before.distanceKm, lunation.perigee.after.distanceKm,
        lunation.apogee.before.distanceKm, lunation.apogee.after.distanceKm];
      for (const km of distances) expect(known, `${facts.id}: ${km}`).toContain(km);
      if (distances.length > 0) expect(distances[0], facts.id).toBe(lunation.distanceKm);
      expect(/supermoon/iu.test(skyText), `${facts.id} supermoon`).toBe(facts.subtype === 'full' && supermoon(lunation) !== null);

      // The spans written out, against the perigee and apogee beside this lunation.
      const span = (pattern: RegExp, actual: number, tolerance: number) => {
        if (pattern.test(skyText)) expect(Math.abs(actual), `${facts.id}: ${pattern}`).toBeLessThanOrEqual(tolerance);
      };
      if (facts.id === 'full-moon-2026-11-24') span(/about a day before it reaches its nearest point/u, hours(lunation.perigee.after.at) - 30, 8);
      if (facts.id === 'new-moon-2026-12-09') span(/about two days before its farthest point/u, hours(lunation.apogee.after.at) - 48, 12);
      if (facts.id === 'full-moon-2026-12-24') span(/about seven hours later/u, hours(lunation.perigee.after.at) - 7, 1);
      if (facts.id === 'new-moon-2027-01-07') span(/about twelve hours after its farthest point/u, hours(lunation.apogee.before.at) + 12, 1);
      if (facts.id === 'new-moon-2027-02-06') span(/about three days past its farthest point/u, hours(lunation.apogee.before.at) + 72, 12);
      if (facts.id === 'new-moon-2027-07-04') span(/about eighteen hours before its nearest point/u, hours(lunation.perigee.after.at) - 18, 1);
      if (facts.id === 'new-moon-2027-08-02') {
        expect(-hours(lunation.perigee.before.at), facts.id).toBeGreaterThan(0);
        expect(-hours(lunation.perigee.before.at), facts.id).toBeLessThan(4);
      }
      for (const phrase of ['nearest point', 'farthest point']) {
        if (skyText.includes(phrase)) {
          expect(['full-moon-2026-11-24', 'new-moon-2026-12-09', 'full-moon-2026-12-24', 'new-moon-2027-01-07',
            'new-moon-2027-02-06', 'new-moon-2027-07-04', 'new-moon-2027-08-02'], `${facts.id}: unchecked span`).toContain(facts.id);
        }
      }
    }
    // "the first of four in a row", "the second of four in a row and the closest of them", "the closest full moon of 2026".
    const run = moonDistanceLunations().filter((l) => l.type === 'full' && l.at >= '2026-10' && l.at < '2027-04');
    expect(run.map((l) => (supermoon(l) ? l.at.slice(0, 10) : '')))
      .toEqual(['', '2026-11-24', '2026-12-24', '2027-01-22', '2027-02-20', '']);
    const closest = run.filter((l) => supermoon(l)).reduce((a, b) => (a.distanceKm < b.distanceKm ? a : b));
    expect(closest.at.slice(0, 10)).toBe('2026-12-24');
    expect(fulls2026.reduce((a, b) => (a.distanceKm < b.distanceKm ? a : b)).at.slice(0, 10)).toBe('2026-12-24');
    const news = (year: string) => moonDistanceLunations().filter((l) => l.type === 'new' && l.at.startsWith(year)).map((l) => l.at.slice(0, 10));
    expect(news('2026').at(-1)).toBe('2026-12-09');
    expect(news('2027')[0]).toBe('2027-01-07');
  });

  it('calls an eclipse what the eclipse data calls it', () => {
    const eclipses = eclipsesData.eclipses as { type: string; kind: string; peak: string }[];
    for (const event of inScope) {
      const all = text(event.facts.id).all;
      const eclipse = event.relations.eclipse ? catalog.byId.get(event.relations.eclipse.id) : undefined;
      expect(/\beclipse\b/u.test(all), `${event.facts.id} eclipse`).toBe(Boolean(eclipse));
      if (!eclipse) continue;
      const row = eclipses.find((e) => e.peak.slice(0, 10) === eclipse.facts.at!.slice(0, 10))!;
      expect(row.type).toBe('solar');
      expect(all, event.facts.id).toContain(row.kind);
      for (const kind of ['annular', 'total', 'partial', 'penumbral']) {
        if (kind !== row.kind) expect(new RegExp(`\\b${kind}\\b`, 'u').test(all), `${event.facts.id}: ${kind}`).toBe(false);
      }
    }
  });

  it('counts the other dates of an alignment as the catalog has them', () => {
    const series = (id: string) => {
      const { facts } = catalog.byId.get(id)!;
      return catalog.events.filter((e) => e.facts.family === 'aspect' && e.facts.aspectType === facts.aspectType
        && e.facts.bodies.join() === facts.bodies.join()).map((e) => e.facts.at!).sort();
    };
    const days = (id: string, year?: string) => series(id).filter((at) => !year || at.startsWith(year)).map(monthDay);
    for (const event of inScope.filter((e) => e.facts.family === 'aspect')) {
      const { id } = event.facts;
      const others = new Set(series(id).map(monthDay));
      const skyText = WINDOW_READINGS[id].sky;
      // Each date in the sentence that lists the alignment's other meetings is one of them.
      for (const sentence of sentenceList(skyText).filter((s) => /\bexact\b/u.test(s))) {
        for (const day of datesIn(sentence)) expect(others.has(day), `${id}: ${day}`).toBe(true);
      }
    }
    expect(days('uranus-trine-pluto-2026-11-29', '2026')).toEqual(['July 18', 'November 29']);
    expect(days('uranus-trine-pluto-2026-11-29', '2027')).toEqual(['June 15']);
    expect(days('uranus-trine-pluto-2026-11-29', '2028')).toHaveLength(2);
    expect(series('uranus-sextile-neptune-2027-01-15').filter((at) => at > '2027-06-07')).toEqual([]);
    expect(days('uranus-sextile-neptune-2027-01-15').slice(-3)).toEqual(['July 15', 'January 15', 'June 6']);
    expect(days('jupiter-trine-saturn-2027-04-03').slice(-3)).toEqual(['August 31', 'April 3', 'July 11']);
    expect(series('jupiter-trine-saturn-2027-04-03').filter((at) => at > '2027-07-12')).toEqual([]);
    expect(days('neptune-sextile-pluto-2027-06-28', '2026')).toHaveLength(2);
    expect(days('neptune-sextile-pluto-2027-06-28', '2027')).toEqual(['June 28', 'October 16']);
    for (const year of ['2028', '2029', '2030']) {
      expect(days('neptune-sextile-pluto-2027-06-28', year).length, year).toBeGreaterThanOrEqual(1);
    }
    expect(days('neptune-sextile-pluto-2027-10-16', '2028')).toHaveLength(2);
    expect(series('jupiter-square-uranus-2027-09-10')).toHaveLength(1);
    // "Unlike the other slow alignments of 2027": each of the others is exact more than once.
    for (const event of inScope.filter((e) => e.facts.family === 'aspect' && e.facts.id !== 'jupiter-square-uranus-2027-09-10')) {
      expect(series(event.facts.id).length, event.facts.id).toBeGreaterThan(1);
    }
    // "they meet a little earlier in their signs than they did on June 28".
    expect(catalog.byId.get('neptune-sextile-pluto-2027-10-16')!.facts.degree!)
      .toBeLessThan(catalog.byId.get('neptune-sextile-pluto-2027-06-28')!.facts.degree!);
  });

  it('names the Sun signs of the event’s own elements, and how long a planet stays as the ingress data has it', () => {
    const ELEMENTS = [['Aries', 'Leo', 'Sagittarius'], ['Taurus', 'Virgo', 'Capricorn'], ['Gemini', 'Libra', 'Aquarius'], ['Cancer', 'Scorpio', 'Pisces']];
    const ELEMENT_NAMES = ['fire', 'earth', 'air', 'water'];
    const windows = ingressesData.windows as { planet: string; sign: string; from: string; to: string }[];
    let stays = 0;
    for (const event of inScope) {
      const { facts } = event;
      const at = new Date(facts.at!);
      const { who } = WINDOW_READINGS[facts.id];
      const own = [...facts.signs.map(signNameFor), ...(facts.subtype === 'full' ? [signAt('Sun', at)] : [])];
      for (const sign of own) expect(who, `${facts.id} ${sign}`).toContain(sign);
      const allowed = new Set(ELEMENTS.filter((group) => group.some((sign) => own.includes(sign))).flat());
      for (const sign of SIGNS) if (new RegExp(`\\b${sign}\\b`, 'u').test(who)) expect(allowed.has(sign), `${facts.id}: ${sign}`).toBe(true);
      // An element is named only for signs of that element, and "the other" signs complete it.
      ELEMENT_NAMES.forEach((name, index) => {
        if (!new RegExp(`\\b${name}\\b`, 'u').test(who)) return;
        expect(ELEMENTS[index].some((sign) => own.includes(sign)), `${facts.id}: ${name}`).toBe(true);
        if (/\bthe (?:other|three)\b/u.test(who)) for (const sign of ELEMENTS[index]) expect(who, `${facts.id}: ${sign}`).toContain(sign);
      });
      const windowOf = (body: string, sign: string) => windows.find((w) => w.planet === body && signNameFor(w.sign) === sign
        && Date.parse(w.from) <= at.getTime() && at.getTime() < Date.parse(w.to))!;
      for (const match of who.matchAll(new RegExp(`(${BODY}) stays in (${SIGN}) until (\\d{4})`, 'gu'))) {
        expect(windowOf(match[1], match[2])?.to.slice(0, 4), `${facts.id}: ${match[0]}`).toBe(match[3]);
        stays += 1;
      }
      for (const match of who.matchAll(new RegExp(`(${BODY}) has been in (${SIGN}) since (\\d{4})`, 'gu'))) {
        expect(windowOf(match[1], match[2])?.from.slice(0, 4), `${facts.id}: ${match[0]}`).toBe(match[3]);
        stays += 1;
      }
      expect(/\d{4}/u.test(who.replace(/(?:stays in \w+ until|has been in \w+ since) \d{4}/gu, '')), `${facts.id}: unchecked year`).toBe(false);
    }
    expect(stays).toBe(17);
    // "five bodies in their sign": the Sun, the Moon, Mercury, Venus and Jupiter.
    const virgo = new Date(catalog.byId.get('new-moon-2027-08-31')!.facts.at!);
    expect(BODIES.filter((body) => signAt(body, virgo) === 'Virgo')).toEqual(['Sun', 'Moon', 'Mercury', 'Venus', 'Jupiter']);
    // "Jupiter has only two weeks left in Leo".
    const leo = windows.find((w) => w.planet === 'Jupiter' && w.sign === 'leo' && w.from.startsWith('2026'))!;
    const left = (Date.parse(leo.to) - Date.parse(catalog.byId.get('jupiter-trine-saturn-2027-07-11')!.facts.at!)) / 86_400_000;
    expect(left).toBeGreaterThan(13);
    expect(left).toBeLessThan(16);
    // "neither leaves for more than ten years" (16 October 2027).
    for (const [body, sign] of [['Neptune', 'aries'], ['Pluto', 'aquarius']]) {
      const stay = windows.find((w) => w.planet === body && w.sign === sign && w.to > '2027-10-16')!;
      expect(Number(stay.to.slice(0, 4)) - 2027, body).toBeGreaterThan(10);
    }
    // "the exact meetings between them fall within a single year".
    const meetings = catalog.events.filter((e) => e.facts.id.startsWith('uranus-sextile-neptune-')).map((e) => Date.parse(e.facts.at!));
    expect((Math.max(...meetings) - Math.min(...meetings)) / 86_400_000).toBeLessThan(366);
  });

  it('holds the remaining particulars to the engine', () => {
    const at = (id: string) => new Date(catalog.byId.get(id)!.facts.at!);
    const lon = (body: string, id: string) => bodyLongitude(body as BodyName, at(id));
    const apart = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
    // "beside the Moon", "almost exactly where the Sun and Moon meet", "close to the Sun and Moon".
    expect(apart(lon('Uranus', 'full-moon-2026-11-24'), lon('Moon', 'full-moon-2026-11-24'))).toBeLessThan(2);
    expect(apart(lon('Saturn', 'new-moon-2027-04-06'), lon('Moon', 'new-moon-2027-04-06'))).toBeLessThan(1);
    expect(apart(lon('Jupiter', 'new-moon-2027-08-31'), lon('Moon', 'new-moon-2027-08-31'))).toBeLessThan(1);
    expect(apart(lon('Venus', 'new-moon-2027-08-02'), lon('Moon', 'new-moon-2027-08-02'))).toBeLessThan(5);
    expect(apart(lon('Mercury', 'new-moon-2027-01-07'), lon('Moon', 'new-moon-2027-01-07'))).toBeLessThan(5);
    // "Pluto in Aquarius sits at almost the same point of its own sign".
    const june = 'uranus-sextile-neptune-2027-06-06';
    expect(Math.abs((lon('Pluto', june) % 30) - (lon('Uranus', june) % 30))).toBeLessThan(1);
    // Two full moons in a row in Scorpio.
    expect(catalog.byId.get('full-moon-2027-04-20')!.facts.signs).toEqual(['scorpio']);
    expect(catalog.byId.get('full-moon-2027-05-20')!.facts.signs).toEqual(['scorpio']);
    // "Mercury is still moving forward, for six more days."
    const june4 = at('new-moon-2027-06-04').getTime();
    const mercury = (sky.retrogrades as { planet: string; from: string }[])
      .find((cycle) => cycle.planet === 'Mercury' && Date.parse(cycle.from) > june4)!;
    expect(Math.round((Date.parse(mercury.from) - june4) / 86_400_000)).toBe(6);
    // "three weeks": Mercury's two 2027 cycles named that way.
    for (const id of ['mercury-retrograde-2027-02-09', 'mercury-retrograde-2027-10-07']) {
      const { start, end } = catalog.byId.get(id)!.facts;
      expect(Math.round((Date.parse(end!) - Date.parse(start!)) / 86_400_000)).toBeGreaterThanOrEqual(20);
      expect(Math.round((Date.parse(end!) - Date.parse(start!)) / 86_400_000)).toBeLessThanOrEqual(23);
    }
  });

  it('ends on a real event that comes after it, and every day it names is a day in the sky data', () => {
    for (const [id, reading] of Object.entries(WINDOW_READINGS)) {
      const own = catalog.byId.get(id)!;
      const next = catalog.byId.get(reading.next);
      expect(next, `${id} next`).toBeDefined();
      expect(catalog.pages.includes(next!), `${id}: ${reading.next} has a page`).toBe(true);
      expect(next!.indexEligible, `${id}: ${reading.next} is published`).toBe(true);
      const nextDays = [next!.facts.at, next!.facts.start, next!.facts.end].filter((iso): iso is string => Boolean(iso));
      const ownStart = own.facts.at!;
      expect(nextDays.some((iso) => iso > ownStart), `${id}: ${reading.next} is ahead`).toBe(true);
      const named = datesIn(reading.comeBack);
      expect(named.some((day) => nextDays.filter((iso) => iso > ownStart).map(monthDay).includes(day)), `${id}: ${reading.comeBack}`).toBe(true);
      for (const day of datesIn(text(id).all)) expect(skyDays.has(day), `${id}: ${day}`).toBe(true);
      for (const sign of SIGNS) {
        if (reading.comeBack.includes(sign)) {
          const mentioned = [next!, ...catalog.pages.filter((e) => named.includes(monthDay(e.facts.at ?? e.facts.start!))
            && (e.facts.at ?? e.facts.start!) > ownStart && (e.facts.at ?? e.facts.start!) < '2028')];
          expect(mentioned.some((e) => e.facts.signs.map(signNameFor).includes(sign)), `${id}: ${sign}`).toBe(true);
        }
      }
    }
  });

  it('reads the printed instant on five clocks', () => {
    for (const event of inScope) {
      const line = windowTimesLine(event.facts);
      const at = new Date(event.facts.at!);
      const [utc, ...rest] = worldTimes(at);
      expect(line.startsWith(`The exact moment is ${utc.time} UTC on ${monthDay(event.facts.at!)}, which is `), line).toBe(true);
      expect(utc.time).toBe(event.facts.at!.slice(11, 16));
      for (const clock of rest) {
        expect(line, `${event.facts.id} ${clock.city}`).toContain(`${clock.time}${clock.ymd === utc.ymd ? '' : ` on ${clock.monthDay}`} in ${clock.city}`);
      }
      expect(line.endsWith('in Sydney.')).toBe(true);
    }
    expect(windowTimesLine(catalog.byId.get('full-moon-2026-11-24')!.facts))
      .toBe('The exact moment is 14:53 UTC on November 24, which is 09:53 in New York, 14:53 in London, 20:23 in Kolkata and 01:53 on November 25 in Sydney.');
  });
});
