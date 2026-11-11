import { describe, expect, it } from 'vitest';
import { bodyLongitude, computeChart } from '../engine/full';
import { ASPECT_ORB, MONTH_SCORE_SCALE, MONTH_SCORE_SCALE_TIMED, PLANET_WEIGHT, POINT_WEIGHT, SCORE_CENTER, SCORE_CENTER_TIMED, VALENCE, YEAR_SCORE_SCALE, YEAR_SCORE_SCALE_TIMED, contactsOn, curve, scoreYear, type NatalPoints, type SlowPlanet } from './core';
import { YEAR_PEOPLE, findYearPerson, personKey } from './people';
import { monthLine, scoreTier, yearReading } from './reading';

const fixed = (lons: Partial<Record<SlowPlanet, number>>) => (body: SlowPlanet) => lons[body] ?? 45;
const natalAt = (iso: string): NatalPoints => {
  const chart = computeChart({ utc: new Date(iso), houseSystem: 'whole', timeKnown: false });
  const lon = (body: string) => chart.bodies.find((row) => row.body === body)!.lon;
  return { Sun: lon('Sun'), Moon: null, Mercury: lon('Mercury'), Venus: lon('Venus'), Mars: lon('Mars') };
};

describe('year score weights', () => {
  it('pins every weight, so a change to the formula is a reviewed change', () => {
    expect({ ASPECT_ORB, POINT_WEIGHT, PLANET_WEIGHT, VALENCE, SCORE_CENTER, YEAR_SCORE_SCALE, MONTH_SCORE_SCALE, SCORE_CENTER_TIMED, YEAR_SCORE_SCALE_TIMED, MONTH_SCORE_SCALE_TIMED }).toMatchInlineSnapshot(`
      {
        "ASPECT_ORB": {
          "conjunction": 3,
          "opposition": 3,
          "sextile": 2,
          "square": 3,
          "trine": 3,
        },
        "MONTH_SCORE_SCALE": 0.73,
        "MONTH_SCORE_SCALE_TIMED": 0.85,
        "PLANET_WEIGHT": {
          "Jupiter": 1,
          "Neptune": 0.7,
          "Pluto": 0.9,
          "Saturn": 1,
          "Uranus": 0.9,
        },
        "POINT_WEIGHT": {
          "Mars": 0.7,
          "Mercury": 0.6,
          "Moon": 0.9,
          "Sun": 1,
          "Venus": 0.7,
        },
        "SCORE_CENTER": -0.05,
        "SCORE_CENTER_TIMED": -0.07,
        "VALENCE": {
          "Jupiter": {
            "conjunction": 1,
            "opposition": 0.2,
            "sextile": 0.6,
            "square": 0.2,
            "trine": 1,
          },
          "Neptune": {
            "conjunction": -0.4,
            "opposition": -0.5,
            "sextile": 0.2,
            "square": -0.6,
            "trine": 0.3,
          },
          "Pluto": {
            "conjunction": -0.7,
            "opposition": -0.8,
            "sextile": 0.3,
            "square": -0.9,
            "trine": 0.4,
          },
          "Saturn": {
            "conjunction": -1,
            "opposition": -0.9,
            "sextile": 0.3,
            "square": -1,
            "trine": 0.4,
          },
          "Uranus": {
            "conjunction": -0.5,
            "opposition": -0.6,
            "sextile": 0.3,
            "square": -0.7,
            "trine": 0.4,
          },
        },
        "YEAR_SCORE_SCALE": 0.47,
        "YEAR_SCORE_SCALE_TIMED": 0.55,
      }
    `);
  });

  it('maps an ordinary balance to 5 and stays inside 0 to 10', () => {
    expect(curve(SCORE_CENTER, YEAR_SCORE_SCALE)).toBe(5);
    expect(curve(100, YEAR_SCORE_SCALE)).toBe(10);
    expect(curve(-100, YEAR_SCORE_SCALE)).toBe(0);
    expect(curve(SCORE_CENTER + YEAR_SCORE_SCALE, YEAR_SCORE_SCALE)).toBeCloseTo(8.8, 1);
    expect(curve(SCORE_CENTER_TIMED, YEAR_SCORE_SCALE_TIMED, SCORE_CENTER_TIMED)).toBe(5);
    expect(curve(SCORE_CENTER_TIMED + YEAR_SCORE_SCALE_TIMED, YEAR_SCORE_SCALE_TIMED, SCORE_CENTER_TIMED)).toBeCloseTo(8.8, 1);
  });
});

describe('contacts on a day', () => {
  const natal: NatalPoints = { Sun: 100, Moon: null, Mercury: 200, Venus: 250, Mars: 300 };
  it('counts an exact Jupiter conjunction to the Sun at full weight, and leaves the Moon out without a birth time', () => {
    const samples = contactsOn(natal, fixed({ Jupiter: 100 }), new Date('2026-01-01T12:00:00Z'));
    expect(samples).toEqual([{ planet: 'Jupiter', aspect: 'conjunction', point: 'Sun', orb: 0, value: 1 }]);
  });
  it('fades a contact to nothing at the edge of its orb and presses with Saturn', () => {
    const [half] = contactsOn(natal, fixed({ Saturn: 191.5 }), new Date('2026-01-01T12:00:00Z'));
    expect(half).toMatchObject({ planet: 'Saturn', aspect: 'square', point: 'Sun', orb: 1.5 });
    expect(half.value).toBeCloseTo(-0.5, 10);
    expect(contactsOn(natal, fixed({ Saturn: 193.01 }), new Date())).toEqual([]);
  });
});

describe('scoreYear', () => {
  it('scores a quiet year at 5 and names no drivers', () => {
    const year = scoreYear({ Sun: 0, Moon: null, Mercury: 0, Venus: 0, Mars: 0 }, () => 45, new Date('2026-07-17T09:30:00Z'));
    expect(year).toMatchObject({ from: '2026-07-17', to: '2027-07-16', drivers: [], activeDays: 0 });
    expect(year.score).toBe(curve(0, YEAR_SCORE_SCALE));
    expect(year.months).toHaveLength(13);
    expect(year.months[0]).toMatchObject({ month: '2026-07', days: 15 });
    expect(year.months.reduce((sum, month) => sum + month.days, 0)).toBe(365);
  });

  it('reads a year with Jupiter on the Sun as supportive and one with Saturn on it as pressure', () => {
    const natal: NatalPoints = { Sun: 10, Moon: null, Mercury: 200, Venus: 240, Mars: 300 };
    const up = scoreYear(natal, fixed({ Jupiter: 10 }), new Date('2026-01-01T00:00:00Z'));
    const down = scoreYear(natal, fixed({ Saturn: 10 }), new Date('2026-01-01T00:00:00Z'));
    expect(up.score).toBeGreaterThan(8);
    expect(down.score).toBeLessThan(2);
    expect(up.drivers[0]).toMatchObject({ planet: 'Jupiter', aspect: 'conjunction', point: 'Sun', tone: 'support', share: 1 });
    expect(down.drivers[0]).toMatchObject({ planet: 'Saturn', tone: 'pressure' });
  });

  it('finds the best and hardest months from the real sky, and is deterministic', () => {
    const natal = natalAt('1985-03-10T12:00:00Z');
    const a = scoreYear(natal, bodyLongitude, new Date('2026-07-17T00:00:00Z'));
    const b = scoreYear(natal, bodyLongitude, new Date('2026-07-17T00:00:00Z'));
    expect(a).toEqual(b);
    expect(a.best!.score).toBeGreaterThanOrEqual(a.hardest!.score);
    expect(a.best!.days).toBeGreaterThanOrEqual(10);
    expect(a.drivers.length).toBeGreaterThan(0);
    expect(a.points).toEqual(['Sun', 'Mercury', 'Venus', 'Mars']);
  });

  it('scores a chart with a birth time on its own curve, and leaves a chart without one exactly as before', () => {
    // Identical points apart from the Moon, which nothing touches: Jupiter 2.5 degrees from the Sun, the rest of the sky at 45.
    const untimed: NatalPoints = { Sun: 10, Moon: null, Mercury: 200, Venus: 240, Mars: 300 };
    const timed: NatalPoints = { ...untimed, Moon: 150 };
    const sky = fixed({ Jupiter: 12.5 });
    const start = new Date('2026-01-01T00:00:00Z');
    const a = scoreYear(untimed, sky, start);
    const b = scoreYear(timed, sky, start);
    expect(b.drivers.every((driver) => driver.point !== 'Moon')).toBe(true);
    expect({ support: b.support, pressure: b.pressure }).toEqual({ support: a.support, pressure: a.pressure });
    // The same balance, two curves.
    expect(a.score).toBe(curve(a.support - a.pressure, YEAR_SCORE_SCALE, SCORE_CENTER));
    expect(b.score).toBe(curve(b.support - b.pressure, YEAR_SCORE_SCALE_TIMED, SCORE_CENTER_TIMED));
    expect(b.months[0].score).toBe(curve(b.months[0].support - b.months[0].pressure, MONTH_SCORE_SCALE_TIMED, SCORE_CENTER_TIMED));
    for (const score of [b.score, ...b.months.map((month) => month.score)]) {
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    }
    expect(b.score).not.toBe(a.score);
    // Before ZOD-15 this untimed chart scored 7.2 for the year and 6.4 for every month.
    expect(a.score).toBe(7.2);
    expect(a.months.map((month) => month.score)).toEqual(Array(12).fill(6.4));
    expect(b.score).toBe(7);
  });

  it('refuses an invalid start date', () => {
    expect(() => scoreYear({ Sun: 0, Moon: null, Mercury: 0, Venus: 0, Mars: 0 }, () => 0, new Date('nope'))).toThrow(RangeError);
  });
});

describe('the words', () => {
  // Dias, 9 November 2026: money, career, wellbeing and legal themes are allowed as the tradition reads them;
  // price or trading calls, buy or sell signals, diagnoses, death predictions, legal outcomes and doom are not.
  const banned = /\b(?:buy|sell|selling|price targets?|stocks?|crypto\w*|bitcoin|tokens?|diagnos\w*|prognos\w*|death|die|dies|dying|doom\w*|disaster|ruin\w*|catastroph\w*)\b|\byou will (?:win|lose)\b|[–—]/iu;
  it('frames every tier plainly, low scores as pressure rather than doom, with no trading call or diagnosis', () => {
    for (const score of [0, 1.5, 3.5, 5, 7, 9.5]) {
      const tier = scoreTier(score);
      expect(`${tier.label} ${tier.summary}`).not.toMatch(banned);
    }
    expect(scoreTier(1).label).toBe('A year of heavy pressure');
    expect(scoreTier(5).label).toBe('A balanced year');
    // The cut points sit symmetrically around 5: 2, 3.5, 6.5 and 8.
    expect(scoreTier(4.4).key).toBe('balanced');
    expect(scoreTier(3.5).key).toBe('balanced');
    expect(scoreTier(3.4).key).toBe('pressure');
    expect(scoreTier(2).key).toBe('pressure');
    expect(scoreTier(1.9).key).toBe('heavy-pressure');
    expect(scoreTier(6.4).key).toBe('balanced');
    expect(scoreTier(6.5).key).toBe('supportive');
    expect(scoreTier(7.9).key).toBe('supportive');
    expect(scoreTier(8).key).toBe('open');
    // Traditional themes are welcome: earnings in a strong year, rest in a hard one.
    expect(scoreTier(9).summary).toContain('earnings');
    expect(scoreTier(1).summary).toContain('look after your energy');
  });
  it('keeps month and driver lines free of trading calls, diagnoses, death, doom and dashes', () => {
    const natal = natalAt('1971-06-28T10:00:00Z');
    const reading = yearReading(scoreYear(natal, bodyLongitude, new Date('2026-07-17T00:00:00Z')));
    const text = [reading.best?.line, reading.hardest?.line, ...reading.drivers.map((driver) => driver.line)].join(' ');
    expect(text).not.toMatch(banned);
    expect(monthLine({ month: '2026-10', days: 31, score: 2, support: 0, pressure: 1, lead: null }, 'hardest')).toBe('October 2026 is the quietest month; no slow planet presses hard.');
  });
});

describe('the Year Ahead directory', () => {
  const REVIEW = '2026-11-09';
  it('lists only adults, each with a cited source and a unique slug', () => {
    const slugs = new Set<string>();
    for (const person of YEAR_PEOPLE) {
      const [y, m, d] = REVIEW.split('-').map(Number);
      const eighteen = new Date(Date.UTC(y - 18, m - 1, d)).toISOString().slice(0, 10);
      expect(person.birthDate <= eighteen, `${person.slug} must be 18 or older`).toBe(true);
      for (const alternate of person.alternateBirthDates) expect(alternate.date <= eighteen).toBe(true);
      expect(person.sources.length).toBeGreaterThan(0);
      expect(slugs.has(person.slug)).toBe(false);
      slugs.add(person.slug);
      expect(`${person.description} ${person.note ?? ''}`).not.toMatch(/[–—]|\b(?:crypto\w*|bitcoin|tokens?|coins?|markets?)\b/iu);
    }
  });
  it('keeps every name and alias pointing at one figure, and no alias is a bare first name shared by two', () => {
    const owner = new Map<string, string>();
    for (const person of YEAR_PEOPLE) {
      for (const key of [person.slug, person.name, ...person.aliases].map(personKey)) {
        expect(owner.get(key) ?? person.slug, key).toBe(person.slug);
        owner.set(key, person.slug);
      }
    }
  });
  it('holds back figures whose published birth dates disagree', () => {
    expect(YEAR_PEOPLE.every((person) => person.alternateBirthDates.length === 0)).toBe(true);
    expect(findYearPerson('Changpeng Zhao')).toBeUndefined();
  });
  it('finds a figure by name or slug', () => {
    expect(findYearPerson('Jensen Huang')?.slug).toBe('jensen-huang');
    expect(findYearPerson('  elon-musk ')?.name).toBe('Elon Musk');
    expect(findYearPerson('elonmusk')?.slug).toBe('elon-musk');
    expect(findYearPerson('Nobody Here')).toBeUndefined();
    expect(personKey('Changpéng  ZHAO')).toBe('changpeng zhao');
  });
});
