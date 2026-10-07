import { describe, expect, it } from 'vitest';
import { verifyHoroscopeProgramCopy } from '../../scripts/independent-copy-verifier';
import dailyData from '../data/daily.json';
import type { Daily } from './daily';
import {
  HOROSCOPE_DISTINCTNESS_LIMITS,
  HOROSCOPE_WORD_BOUNDS,
  HoroscopeProgramInputError,
  buildHoroscopeProgram,
  horoscopeShingleJaccard,
  validateHoroscopeProgram,
  validateHoroscopeProgramAgainstInput,
  validateHoroscopeProgramInput,
  type BuildHoroscopeProgramInput,
  type HoroscopeProgram,
  type HoroscopeProgramEvent,
  type HoroscopeSurface,
} from './horoscope-program';
import { SIGN_SLUGS } from './signs';

const sourceDaily = dailyData as Daily;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function fixtureDay(date: string, dayIndex: number): Daily {
  const daily = clone(sourceDaily);
  daily.date = date;
  daily.snapshotAt = `${date}T12:00:00.000Z`;
  daily.eventsCoverage = 'complete';
  daily.eventsSource = `src/data/transits-${date.slice(0, 7)}.json`;
  daily.events = date === sourceDaily.date ? clone(sourceDaily.events) : [];
  // The unit fixture varies the Moon to exercise solar-house mapping. This
  // module consumes facts; upstream astronomy tests own physical correctness.
  const moon = daily.bodies.find((body) => body.body === 'Moon');
  if (moon) {
    const sign = SIGN_SLUGS[dayIndex % SIGN_SLUGS.length];
    moon.sign = sign;
    moon.degree = 3.25 + dayIndex / 10;
    moon.lon = SIGN_SLUGS.indexOf(sign) * 30 + moon.degree;
  }
  return daily;
}

/** Normalized catalog fixture; upstream event-catalog tests own astronomy. */
const yearlyEvents: HoroscopeProgramEvent[] = [
  { kind: 'eclipse', type: 'solar', sign: 'aquarius', degree: 17.6, at: '2027-02-06T15:59:00.000Z', sourceId: 'fixture:2027-events' },
  { kind: 'eclipse', type: 'lunar', sign: 'virgo', degree: 2.1, at: '2027-02-20T23:12:00.000Z', sourceId: 'fixture:2027-events' },
  { kind: 'station', planet: 'Mercury', type: 'retrograde', sign: 'pisces', degree: 11.2, at: '2027-03-10T09:00:00.000Z', sourceId: 'fixture:2027-events' },
  { kind: 'station', planet: 'Mercury', type: 'direct', retrograde: false, sign: 'aquarius', degree: 27.1, at: '2027-04-01T09:00:00.000Z', sourceId: 'fixture:2027-events' },
  { kind: 'ingress', planet: 'Jupiter', sign: 'virgo', at: '2027-07-26T03:00:00.000Z', sourceId: 'fixture:2027-events' },
  { kind: 'station', planet: 'Saturn', type: 'retrograde', sign: 'aries', degree: 27.4, at: '2027-08-09T12:00:00.000Z', sourceId: 'fixture:2027-events' },
  { kind: 'eclipse', type: 'solar', sign: 'leo', degree: 9.8, at: '2027-08-02T10:07:00.000Z', sourceId: 'fixture:2027-events' },
  { kind: 'eclipse', type: 'lunar', sign: 'aquarius', degree: 24.2, at: '2027-08-17T07:28:00.000Z', sourceId: 'fixture:2027-events' },
  {
    kind: 'aspect',
    a: 'Jupiter',
    b: 'Saturn',
    type: 'trine',
    orb: 0,
    aSign: 'virgo',
    aDegree: 18.1,
    bSign: 'taurus',
    bDegree: 18.1,
    at: '2027-11-13T16:00:00.000Z',
    sourceId: 'fixture:2027-events',
  },
];

const dates = [
  '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16',
  '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20',
];
const input: BuildHoroscopeProgramInput = {
  anchorDate: '2026-07-19',
  dailySnapshots: dates.map(fixtureDay),
  yearlyEvents,
};

describe('horoscope program domain', () => {
  it('builds one deterministic, serializable six-surface program for all signs', () => {
    const first = buildHoroscopeProgram(input);
    const second = buildHoroscopeProgram(input);
    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(first.signs.map((entry) => entry.sign)).toEqual(SIGN_SLUGS);
    expect(first.coverage).toEqual({
      today: 'complete',
      tomorrow: 'complete',
      isoWeek: 'complete',
      yearly2027: 'complete',
    });
    for (const entry of first.signs) {
      expect(Object.keys(entry.readings).sort()).toEqual([
        'career', 'love', 'today', 'tomorrow', 'weekly', 'yearly-2027',
      ]);
    }
    expect(validateHoroscopeProgramAgainstInput(input, first)).toEqual([]);
    expect(verifyHoroscopeProgramCopy(first).filter(({ path }) => (
      path.includes('.readings.today.') || path.includes('.readings.tomorrow.')
    ))).toEqual([]);
  });

  it('enforces the master-brief word bounds and voice rules on every surface', () => {
    const program = buildHoroscopeProgram(input);
    const banned = /\b(?:delve|unlock|embark|tapestry|vibrant|elevate|empower|harness)\b|in today[’']s world/iu;
    const backstage = /\b(?:deterministic|noon[- ]UTC snapshot|verified position|source receipts?|proportionate to the evidence|supplied (?:day|week|position|snapshot)|event catalog|solar-house method)\b/iu;
    for (const entry of program.signs) for (const [surface, item] of Object.entries(entry.readings)) {
      const bounds = HOROSCOPE_WORD_BOUNDS[surface as HoroscopeSurface];
      expect(item.status).toBe('publishable');
      expect(item.wordCount, `${entry.sign}/${surface}`).toBeGreaterThanOrEqual(bounds.min);
      expect(item.wordCount, `${entry.sign}/${surface}`).toBeLessThanOrEqual(bounds.max);
      expect(item.text).not.toMatch(banned);
      expect(item.text).not.toMatch(backstage);
      expect(item.text).not.toContain('!');
    }
  });

  it('keeps love actions distinct when Venus and the Moon share a sign', () => {
    const sameSignInput = clone(input);
    const anchor = sameSignInput.dailySnapshots.find(({ date }) => date === sameSignInput.anchorDate)!;
    const moon = anchor.bodies.find(({ body }) => body === 'Moon')!;
    const venus = anchor.bodies.find(({ body }) => body === 'Venus')!;
    // Plant the condition explicitly; the real daily Venus sign changes.
    venus.sign = moon.sign;
    venus.lon = SIGN_SLUGS.indexOf(venus.sign) * 30 + venus.degree;
    expect(moon.sign).toBe(venus.sign);

    const failures = verifyHoroscopeProgramCopy(buildHoroscopeProgram(sameSignInput))
      .filter(({ path }) => path.includes('.readings.love.'));
    expect(failures).toEqual([]);
  });

  it('re-frames only the later sign when two tomorrow readings would exceed the distinctness limit', () => {
    // The sky of 2026-10-09: Mars in Leo (Gemini) and retrograde Venus in
    // Scorpio (Virgo) both fall in the third solar house on a quiet New Moon
    // day. With the shared sentence frames the pair measured 0.402 against 0.4.
    const collision = clone(input);
    const tomorrow = collision.dailySnapshots.find(({ date }) => date === '2026-07-20')!;
    const place = (name: string, sign: string, retrograde: boolean) => {
      const placed = tomorrow.bodies.find(({ body }) => body === name)!;
      placed.sign = sign;
      placed.retrograde = retrograde;
      placed.lon = SIGN_SLUGS.indexOf(sign) * 30 + placed.degree;
    };
    place('Moon', 'libra', false);
    place('Mercury', 'scorpio', false);
    place('Venus', 'scorpio', true);
    place('Mars', 'leo', false);
    place('Saturn', 'aries', true);
    tomorrow.moon.phase = 'New Moon';
    tomorrow.events = [];

    const program = buildHoroscopeProgram(collision);
    const reading = (sign: string) => program.signs.find((entry) => entry.sign === sign)!.readings.tomorrow;
    const sharedFrame = 'using the lead time to prepare the conditions around the decision before tomorrow begins';
    expect(reading('gemini').text).toContain(sharedFrame);
    expect(reading('virgo').text).not.toContain(sharedFrame);
    // Only the frames change: the house advice and the cited facts stay.
    expect(reading('virgo').text).toContain('Name who needs the message, what they need to know, and when they need it.');
    expect(reading('virgo').text).toContain('Venus retrograde in Scorpio adds messages, errands, siblings, and your local community');
    expect(reading('virgo').text).toContain('the new moon brings your money, possessions, and priorities');
    const cited = new Set(reading('virgo').passages.flatMap((item) => item.evidenceRefs));
    expect(program.evidence
      .filter((receipt) => cited.has(receipt.id))
      .map((receipt) => [receipt.kind, receipt.body, receipt.sunSign ?? '-', receipt.house ?? '-'].join(':'))
      .sort()).toEqual([
      'body-position:Moon:-:-',
      'body-position:Venus:-:-',
      'solar-house:Moon:virgo:2',
      'solar-house:Venus:virgo:3',
    ]);
    expect(horoscopeShingleJaccard(reading('gemini').text, reading('virgo').text))
      .toBeLessThanOrEqual(HOROSCOPE_DISTINCTNESS_LIMITS.tomorrow);
    // Every sign that was already distinct keeps the original frames.
    expect(program.signs
      .filter((entry) => !entry.readings.tomorrow.text.includes(sharedFrame))
      .map((entry) => entry.sign)).toEqual(['virgo']);

    expect(validateHoroscopeProgramAgainstInput(collision, program)).toEqual([]);
    expect(verifyHoroscopeProgramCopy(program).filter(({ path }) => (
      /\.readings\.(?:today|tomorrow)(?:\.|$)/u.test(path)
    ))).toEqual([]);
  });

  it('links every publishable passage to serializable source or derived evidence', () => {
    const program = buildHoroscopeProgram(input);
    const evidence = new Map(program.evidence.map((receipt) => [receipt.id, receipt]));
    expect(evidence.size).toBeGreaterThan(100);
    for (const entry of program.signs) for (const item of Object.values(entry.readings)) {
      for (const itemPassage of item.passages) {
        expect(itemPassage.evidenceRefs.length, `${entry.sign}/${item.surface}`).toBeGreaterThan(0);
        expect(itemPassage.evidenceRefs.every((id) => evidence.has(id))).toBe(true);
      }
    }
    const derived = program.evidence.filter((receipt) => receipt.kind === 'solar-house');
    expect(derived.length).toBeGreaterThan(0);
    expect(derived.every((receipt) => receipt.sourceFactId && evidence.has(receipt.sourceFactId))).toBe(true);
  });

  it('builds each 2027 edition to long-form depth from the supplied event catalog', () => {
    const program = buildHoroscopeProgram(input);
    const catalogReceipts = program.evidence.filter((receipt) => (
      receipt.kind === 'sky-event' && receipt.sourceId === 'fixture:2027-events'
    ));
    expect(catalogReceipts).toHaveLength(yearlyEvents.length);
    expect(new Set(catalogReceipts.map((receipt) => receipt.at)))
      .toEqual(new Set(yearlyEvents.map((event) => event.at)));
    expect(catalogReceipts.find((receipt) => receipt.eventKind === 'aspect')?.orb).toBe(0);
    const catalogIds = new Set(catalogReceipts.map((receipt) => receipt.id));
    for (const entry of program.signs) {
      const yearly = entry.readings['yearly-2027'];
      expect(yearly.wordCount).toBeGreaterThanOrEqual(1_200);
      expect(yearly.wordCount).toBeLessThanOrEqual(1_800);
      expect(yearly.text).toContain('Jupiter entering Virgo');
      expect(yearly.text).toContain('solar eclipse in Aquarius');
      expect(yearly.text).toContain('Saturn stations retrograde');
      expect(yearly.text).not.toMatch(/brings .+ into focus around|A station marks a change of pace|Stations can concentrate attention/iu);
      expect(yearly.text).not.toMatch(/\bwhat .+? has taught you\b/iu);

      const headings = yearly.passages.map((item) => item.heading);
      expect(yearly.passages.length).toBeGreaterThanOrEqual(8);
      expect(headings.every(Boolean)).toBe(true);
      expect(new Set(headings).size).toBe(headings.length);
      expect(headings[0]).toBe(`The shape of ${entry.sign.charAt(0).toUpperCase()}${entry.sign.slice(1)}’s 2027`);
      expect(headings).toContain('Love, friendship, and clear terms');
      expect(headings).toContain('Work, money, and sustainable authority');
      expect(headings.at(-1)).toBe('A three-date plan for the year');

      for (const heading of [
        'Love, friendship, and clear terms',
        'Work, money, and sustainable authority',
        'Home, rest, and the private load',
        'Your own direction',
      ]) {
        const theme = yearly.passages.find((item) => item.heading === heading)?.text ?? '';
        const checkpoints = [...theme.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/gu)]
          .map((match) => Date.parse(`${match[0]}, 2027 UTC`));
        expect(checkpoints, `${entry.sign}/${heading}`).toHaveLength(2);
        expect(checkpoints, `${entry.sign}/${heading} runs backward`).toEqual([...checkpoints].sort((a, b) => a - b));
      }

      const citedCatalogIds = new Set(yearly.passages.flatMap((item) => item.evidenceRefs));
      expect([...catalogIds].every((id) => citedCatalogIds.has(id))).toBe(true);
    }
  });

  it('deduplicates repeated house areas in the yearly opening comparison', () => {
    const collision = buildHoroscopeProgram({
      ...input,
      yearlyEvents: [
        {
          kind: 'eclipse',
          type: 'solar',
          sign: 'virgo',
          degree: 9,
          at: '2027-01-06T12:00:00.000Z',
          sourceId: 'fixture:repeated-opening-house',
        },
        ...yearlyEvents,
      ],
    });
    const opening = collision.signs.find(({ sign }) => sign === 'aries')
      ?.readings['yearly-2027'].passages[0].text ?? '';

    expect(opening).toContain('compare routines and workload with what is actually happening');
    expect(opening).not.toContain('routines and workload, routines and workload');
  });

  it('does not treat 2027 daily events as missing yearly-catalog coverage', () => {
    const program = clone(buildHoroscopeProgram(input)) as HoroscopeProgram;
    program.evidence.push({
      id: 'fact:2027-01-02:event:ingress:2027-01-02T03:00:00.000Z:venus-aquarius',
      kind: 'sky-event',
      sourceId: 'src/data/transits-2027-01.json',
      label: 'Venus enters Aquarius',
      at: '2027-01-02T03:00:00.000Z',
      body: 'Venus',
      eventKind: 'ingress',
      eventType: 'aquarius',
      sign: 'aquarius',
    });

    expect(validateHoroscopeProgram(program).map((failure) => failure.ruleId))
      .not.toContain('EVIDENCE-YEAR-COVERAGE');
  });

  it('keeps all twelve readings pairwise distinct, including the long 2027 edition', () => {
    const program = buildHoroscopeProgram(input);
    const surfaces = Object.keys(program.signs[0].readings) as HoroscopeSurface[];
    for (const surface of surfaces) {
      for (let left = 0; left < program.signs.length; left += 1) {
        for (let right = left + 1; right < program.signs.length; right += 1) {
          const score = horoscopeShingleJaccard(
            program.signs[left].readings[surface].text,
            program.signs[right].readings[surface].text,
          );
          expect(score, `${surface}: ${program.signs[left].sign}/${program.signs[right].sign}`)
            .toBeLessThanOrEqual(HOROSCOPE_DISTINCTNESS_LIMITS[surface]);
        }
      }
    }
  });

  it('holds unsupported periods instead of manufacturing filler', () => {
    const partialInput: BuildHoroscopeProgramInput = {
      anchorDate: input.anchorDate,
      dailySnapshots: [fixtureDay(input.anchorDate, 6)],
      yearlyEvents: [],
    };
    const program = buildHoroscopeProgram(partialInput);
    expect(program.coverage).toEqual({
      today: 'complete',
      tomorrow: 'unavailable',
      isoWeek: 'partial',
      yearly2027: 'insufficient',
    });
    for (const entry of program.signs) {
      expect(entry.readings.today.status).toBe('publishable');
      expect(entry.readings.tomorrow.status).toBe('insufficient-evidence');
      expect(entry.readings.weekly.status).toBe('insufficient-evidence');
      expect(entry.readings['yearly-2027'].status).toBe('insufficient-evidence');
      expect(entry.readings['yearly-2027'].text).toContain('does not replace missing sky data');
      expect(entry.readings['yearly-2027'].passages[0].evidenceRefs).toEqual([]);
    }
    expect(validateHoroscopeProgram(program)).toEqual([]);
  });

  it('holds the yearly edition when station coverage has no direct boundary', () => {
    const missingDirect: BuildHoroscopeProgramInput = {
      ...input,
      yearlyEvents: yearlyEvents.filter((event) => !(event.kind === 'station' && event.type === 'direct')),
    };
    const program = buildHoroscopeProgram(missingDirect);
    expect(program.coverage.yearly2027).toBe('insufficient');
    expect(program.signs.every((entry) => (
      entry.readings['yearly-2027'].status === 'insufficient-evidence'
    ))).toBe(true);
  });

  it('changes the weekly edition at the Sunday-to-Monday UTC boundary', () => {
    const rolloverDates = Array.from({ length: 14 }, (_, index) => {
      const date = new Date('2026-07-13T00:00:00.000Z');
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
    const rolloverSnapshots = rolloverDates.map(fixtureDay);
    const sunday = buildHoroscopeProgram({
      anchorDate: '2026-07-19',
      dailySnapshots: rolloverSnapshots,
      yearlyEvents,
    });
    const monday = buildHoroscopeProgram({
      anchorDate: '2026-07-20',
      dailySnapshots: rolloverSnapshots,
      yearlyEvents,
    });

    expect(sunday.signs[0].readings.weekly.period).toMatchObject({
      from: '2026-07-13',
      through: '2026-07-19',
    });
    expect(monday.signs[0].readings.weekly.period).toMatchObject({
      from: '2026-07-20',
      through: '2026-07-26',
    });
  });

  it('fails closed on invalid facts, malformed yearly events, and output tampering', () => {
    const malformed = clone(input);
    malformed.dailySnapshots[0].bodies[0].sign = 'ophiuchus';
    malformed.yearlyEvents![0].at = '2028-02-06T15:59:00.000Z';
    const inputFailures = validateHoroscopeProgramInput(malformed).map((failure) => failure.ruleId);
    expect(inputFailures).toContain('INPUT-FACT-SIGN');
    expect(inputFailures).toContain('INPUT-EVENT-INSTANT');
    expect(() => buildHoroscopeProgram(malformed)).toThrow(HoroscopeProgramInputError);

    const missingExactOrb = clone(input) as any;
    delete missingExactOrb.yearlyEvents.find((event: HoroscopeProgramEvent) => event.kind === 'aspect').orb;
    expect(validateHoroscopeProgramInput(missingExactOrb).map((failure) => failure.ruleId))
      .toContain('INPUT-EVENT-ASPECT-ORB');

    const approximateAspect = clone(input) as any;
    approximateAspect.yearlyEvents.find((event: HoroscopeProgramEvent) => event.kind === 'aspect').orb = 0.5;
    expect(validateHoroscopeProgramInput(approximateAspect).map((failure) => failure.ruleId))
      .toContain('INPUT-EVENT-ASPECT-ORB');

    const program = clone(buildHoroscopeProgram(input)) as HoroscopeProgram;
    program.signs[1].readings.today.text = program.signs[0].readings.today.text;
    program.signs[1].readings.today.wordCount = program.signs[0].readings.today.wordCount;
    program.signs[1].readings.today.passages = clone(program.signs[0].readings.today.passages);
    const failures = validateHoroscopeProgram(program).map((failure) => failure.ruleId);
    expect(failures).toContain('DIST-SIMILARITY');
  });
});
