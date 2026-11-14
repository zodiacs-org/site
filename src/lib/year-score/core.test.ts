import { describe, expect, it } from 'vitest';
import { bodyLongitude, computeChart } from '../engine/full';
import { ASPECT_ORB, MONTH_SCORE_SCALE, MONTH_SCORE_SCALE_TIMED, PLANET_WEIGHT, POINT_WEIGHT, SCORE_CENTER, SCORE_CENTER_TIMED, VALENCE, YEAR_SCORE_SCALE, YEAR_SCORE_SCALE_TIMED, contactsOn, curve, scoreYear, type MonthScore, type NatalPoints, type SlowPlanet, type YearScore } from './core';
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
  // Dias, 9 November 2026: career, wellbeing and legal themes are allowed as the tradition reads them;
  // no money, earnings or promotion forecasts (ZOD-30, 13 November 2026);
  // price or trading calls, buy or sell signals, diagnoses, death predictions, legal outcomes and doom are not.
  const banned = /\b(?:buy|sell|selling|price targets?|stocks?|crypto\w*|bitcoin|tokens?|diagnos\w*|prognos\w*|death|die|dies|dying|doom\w*|disaster|ruin\w*|catastroph\w*)\b|\byou will (?:win|lose)\b|[–—]/iu;
  it('frames every tier plainly, low scores as pressure rather than doom, with no trading call or diagnosis', () => {
    for (const score of [0, 1.5, 2.5, 3.5, 5, 7, 9.5]) {
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
    // Traditional themes are welcome: career in a strong year, rest in a hard one. No money forecasts (ZOD-30).
    expect(scoreTier(9).summary).toContain('career growth');
    const money = /\b(?:money|earn|earns|earned|earner|earners|earning|earnings|promot\w*|income|salary|salaries|savings?|wealth\w*|profit\w*|budgets?|financ\w*|riches|prosper\w*|spend\w*|cash|bonus\w*)\b/iu;
    for (const score of [0, 1.5, 2.5, 3.5, 5, 7, 9.5]) expect(scoreTier(score).summary).not.toMatch(money);
    expect(scoreTier(1).summary).toContain('look after your energy');
  });
  it('keeps month and driver lines free of trading calls, diagnoses, death, doom and dashes', () => {
    const natal = natalAt('1971-06-28T10:00:00Z');
    const reading = yearReading(scoreYear(natal, bodyLongitude, new Date('2026-07-17T00:00:00Z')));
    const text = [reading.best?.line, reading.hardest?.line, ...reading.drivers.map((driver) => driver.line)].join(' ');
    expect(text).not.toMatch(banned);
    expect(monthLine({ month: '2026-10', days: 31, score: 2, support: 0, pressure: 1, lead: null }, 'hardest')).toBe('October 2026 is the quietest month; no slow planet presses hard.');
    expect(monthLine({ month: '2026-10', days: 31, score: 2, support: 0, pressure: 1, lead: null }, 'hardest', { tied: true })).toBe('October 2026 is one of the quietest months; no slow planet presses hard.');
  });
});

describe('lines that agree with their headings', () => {
  const natal: NatalPoints = { Sun: 10, Moon: null, Mercury: 200, Venus: 240, Mars: 300 };
  // A sky that changes by calendar month (UTC): month index to the slow planets' longitudes; the rest sit at 45, touching nothing.
  const byMonth = (months: Record<number, Partial<Record<SlowPlanet, number>>>, rest: Partial<Record<SlowPlanet, number>>) =>
    (body: SlowPlanet, date: Date) => (months[date.getUTCMonth()] ?? rest)[body] ?? 45;
  const start = new Date('2026-01-01T00:00:00Z');

  it('calls a hardest month with a supportive lead the one with the least support, never the softest', () => {
    // Jupiter exactly on the Sun all year except March, when it stands 2 degrees off.
    const year = scoreYear(natal, byMonth({ 2: { Jupiter: 12 } }, { Jupiter: 10 }), start);
    expect(year.hardest?.month).toBe('2026-03');
    expect(year.ties.hardest).toBe(false);
    // The line names the least support only because March's support is the lowest of every listed month.
    expect(year.months.every((other) => year.hardest!.support <= other.support)).toBe(true);
    const line = yearReading(year).hardest!.line;
    expect(line).toBe('March 2026 has the least support of the year; Jupiter conjunct your Sun still helps.');
    expect(line).not.toContain('softest');
  });

  // A year built by hand, so each month's support and pressure can be set exactly; the picks are on balance, as core.ts makes them.
  const handYear = (rows: { month: string; support: number; pressure: number; lead?: MonthScore['lead'] }[]): YearScore => {
    const months: MonthScore[] = rows.map((row) => ({ month: row.month, days: 30, score: 5, support: row.support, pressure: row.pressure, lead: row.lead ?? null }));
    const bal = (entry: MonthScore) => entry.support - entry.pressure;
    const best = months.reduce((pick, entry) => (bal(entry) > bal(pick) ? entry : pick));
    const hardest = months.reduce((pick, entry) => (bal(entry) < bal(pick) ? entry : pick));
    return { version: 'year-score.v1', from: '2026-01-01', to: '2026-12-31', score: 5, support: 0, pressure: 0, activeDays: 1, months, best, hardest, ties: { best: false, hardest: false }, drivers: [], points: ['Sun', 'Mercury', 'Venus', 'Mars'] };
  };
  const saturnSquare = { planet: 'Saturn', aspect: 'square', point: 'Sun', tone: 'pressure' } as const;
  const jupiterOn = { planet: 'Jupiter', aspect: 'conjunction', point: 'Sun', tone: 'support' } as const;

  it('claims the most support for the best month only when no listed month has more', () => {
    // May is uniquely best on balance, but July has more support (and more pressure), and March less pressure.
    const year = handYear([
      { month: '2026-03', support: 0, pressure: 0.2 },
      { month: '2026-05', support: 1.0267, pressure: 0.5, lead: saturnSquare },
      { month: '2026-07', support: 1.36, pressure: 1.2 },
    ]);
    expect(year.best?.month).toBe('2026-05');
    const line = yearReading(year).best!.line;
    expect(line).not.toContain('most support');
    expect(line).not.toContain('least pressure');
    expect(line).toBe('May 2026 is the strongest month; Saturn square your Sun still asks something of your sense of self.');
  });

  it('claims the least support or the most pressure for the hardest month only when it is true', () => {
    // May is uniquely hardest with support 1 while every other month has none: it does not have the least support.
    const most = handYear([
      { month: '2026-04', support: 0, pressure: 0 },
      { month: '2026-05', support: 1, pressure: 3, lead: jupiterOn },
      { month: '2026-06', support: 0, pressure: 0.5 },
    ]);
    expect(most.hardest?.month).toBe('2026-05');
    const mostLine = yearReading(most).hardest!.line;
    expect(mostLine).not.toContain('least support');
    expect(mostLine).not.toContain('softest');
    expect(mostLine).toBe('May 2026 carries the most pressure of the year; Jupiter conjunct your Sun still helps.');
    // Neither holds: June has less support and July more pressure, but May still balances lowest.
    const neither = handYear([
      { month: '2026-05', support: 1, pressure: 3.5, lead: jupiterOn },
      { month: '2026-06', support: 0, pressure: 0.5 },
      { month: '2026-07', support: 3, pressure: 4 },
    ]);
    expect(neither.hardest?.month).toBe('2026-05');
    const neitherLine = yearReading(neither).hardest!.line;
    expect(neitherLine).toBe('May 2026 is the hardest month; Jupiter conjunct your Sun still helps.');
    expect(neitherLine).not.toMatch(/least support|most pressure|softest/u);
  });

  it('reads Jupiter square or opposite a point as mixed, with its own sentence', () => {
    for (const [lon, aspect] of [[100, 'square'], [190, 'opposite']] as const) {
      const reading = yearReading(scoreYear(natal, byMonth({}, { Jupiter: lon }), start));
      expect(reading.drivers[0]).toMatchObject({ planet: 'Jupiter', point: 'Sun', tone: 'mixed', line: `Jupiter ${aspect} your Sun: growth that asks for restraint.` });
      expect(reading.drivers[0].line).not.toMatch(/backs|pushes against|stands opposite/u);
      expect(reading.best!.line).not.toContain('backs');
    }
    // The number is the same as before: only the word changes.
    expect(scoreYear(natal, byMonth({}, { Jupiter: 100 }), start).drivers[0].tone).toBe('support');
  });

  it('claims the least pressure of the year only for the month with the least pressure', () => {
    // Saturn exactly square the Sun all year; in May 1 degree off (less pressure).
    const least = yearReading(scoreYear(natal, byMonth({ 4: { Saturn: 101 } }, { Saturn: 100 }), start));
    expect(least.best!.line).toBe('May 2026 is the strongest month, with the least pressure of the year; Saturn square your Sun still asks something of your sense of self.');
    // In May Saturn stays exact but Jupiter comes within a degree of the Sun; in June Saturn alone is a degree off, so June has less pressure.
    const most = scoreYear(natal, byMonth({ 4: { Saturn: 100, Jupiter: 11 }, 5: { Saturn: 101 } }, { Saturn: 100 }), start);
    expect(most.best?.month).toBe('2026-05');
    expect(most.best?.lead?.planet).toBe('Saturn');
    expect(most.months.every((other) => most.best!.support >= other.support)).toBe(true);
    expect(yearReading(most).best!.line).toBe('May 2026 is the strongest month, with the most support of the year; Saturn square your Sun still asks something of your sense of self.');
  });

  it('picks months on the unrounded balance and calls a tie one of several', () => {
    // A year with no contact at all has no best or hardest month, in the score and in the words.
    const quietYear = scoreYear(natal, () => 45, new Date('2026-07-17T00:00:00Z'));
    expect(quietYear.activeDays).toBe(0);
    expect(quietYear).toMatchObject({ best: null, hardest: null, ties: { best: false, hardest: false } });
    const quiet = yearReading(quietYear);
    expect(quiet.best).toBeNull();
    expect(quiet.hardest).toBeNull();
    // A listed month with no contact still ties the lightest months when the picks also balance at 0.
    expect(monthLine({ month: '2026-08', days: 31, score: 5.3, support: 0, pressure: 0, lead: null }, 'best', { tied: true })).toBe('August 2026 is one of the lightest months, with no slow planet close to the chart.');
    // Saturn exactly square the Sun in every month but April: the hardest months tie, the best does not.
    const year = scoreYear(natal, byMonth({ 3: { Saturn: 101 } }, { Saturn: 100 }), start);
    expect(year.ties).toEqual({ best: false, hardest: true });
    const reading = yearReading(year);
    expect(reading.best!.line).toContain('April 2026 is the strongest month');
    expect(reading.hardest!.line).toBe('January 2026 is one of the hardest months: Saturn square your Sun leans on your sense of self. A month to pace yourself, not to fear.');
    // February and March print the same one-decimal score, but March's balance is higher by more than the margin:
    // March is the best month (the rounded score would have picked February), and it is not a tie.
    const apart = scoreYear(natal, byMonth({ 1: { Jupiter: 12.949 }, 2: { Jupiter: 12.925 } }, {}), start);
    expect(apart.months[1].score).toBe(apart.months[2].score);
    expect(apart.best?.month).toBe('2026-03');
    expect(apart.ties.best).toBe(false);
    expect(yearReading(apart).best!.line).toContain('March 2026 is the strongest month');
    // Balances less than the margin apart are a tie, and the line says so.
    const close = scoreYear(natal, byMonth({ 1: { Jupiter: 12.97 }, 2: { Jupiter: 12.98 } }, {}), start);
    expect(close.best?.month).toBe('2026-02');
    expect(close.ties.best).toBe(true);
    expect(yearReading(close).best!.line).toBe('February 2026 is one of the lightest months: Jupiter conjunct your Sun backs your sense of self.');
  });

  it('ties a month only with months that balance within the margin of it, on either side', () => {
    // From 25 January: the seven January days are too few to pick, and the twelfth month (January 2027) has 24.
    // The sky is keyed on the date, so only those seven days differ from the rest.
    const from = new Date('2026-01-25T00:00:00Z');
    const sky = (partial: Partial<Record<SlowPlanet, number>>, june: Partial<Record<SlowPlanet, number>>, rest: Partial<Record<SlowPlanet, number>>) =>
      (body: SlowPlanet, date: Date) => (date < new Date('2026-02-01T00:00:00Z') ? partial : date.toISOString().startsWith('2026-06') ? june : rest)[body] ?? 45;
    // Jupiter exactly on the Sun in the partial January, a degree off in June and two degrees off otherwise:
    // June is the best month and January, far better but too short to pick, is not a tie for it.
    const best = scoreYear(natal, sky({ Jupiter: 10 }, { Jupiter: 11 }, { Jupiter: 12 }), from);
    expect(best.months[0]).toMatchObject({ month: '2026-01', days: 7 });
    expect(best.best?.month).toBe('2026-06');
    expect(best.months[0].support).toBeGreaterThan(best.best!.support + 0.1);
    expect(best.ties.best).toBe(false);
    expect(yearReading(best).best!.line).toContain('June 2026 is the strongest month');
    // The same for the hardest month: Saturn exact in the partial January, a degree off in June and two degrees off otherwise.
    const hardest = scoreYear(natal, sky({ Saturn: 100 }, { Saturn: 101 }, { Saturn: 102 }), from);
    expect(hardest.hardest?.month).toBe('2026-06');
    expect(hardest.months[0].pressure).toBeGreaterThan(hardest.hardest!.pressure + 0.1);
    expect(hardest.ties.hardest).toBe(false);
    // The partial January carries more pressure than June, so June's line does not claim the most.
    expect(yearReading(hardest).hardest!.line).toBe('June 2026 is the hardest month: Saturn square your Sun leans on your sense of self. A month to pace yourself, not to fear.');
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
