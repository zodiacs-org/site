import { runInNewContext } from 'node:vm';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { assessLocalDateReference } from './local-date-reference';
import type { CompleteTransitionProvider } from './local-date-intervals';
import { localDateContainsUtc, prepareLocalTime, resolveLocalToUtc } from './localToUtc';

// The resolver is the engine's, which the site loads on first use.
beforeAll(() => prepareLocalTime('2000-01-01', 'UTC'));

const DAY = 86_400_000;
const HOUR = 3_600_000;
const epoch = (value: string) => Date.parse(value);
type Change = readonly [number, number];

/** Finite, explicitly complete schedules are test fixtures, not sampled tzdata. */
function schedule(initial: number, changes: readonly Change[] = []): CompleteTransitionProvider {
  return {
    completeness: 'complete-transitions-v1',
    offsetMilliseconds(_zone, instant) {
      let offset = initial;
      for (const [at, after] of changes) if (at <= instant) offset = after;
      return offset;
    },
    nextTransitionMilliseconds(_zone, after) {
      return changes.find(([at]) => at > after)?.[0] ?? null;
    },
  };
}

/** Give the independent membership witness the declared synthetic wall clock. */
function syntheticIntl(zone: string, source: CompleteTransitionProvider) {
  const Original = Intl.DateTimeFormat;
  const wall = new Original('en-US', {
    timeZone: 'UTC', calendar: 'gregory', numberingSystem: 'latn', era: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23',
  });
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(((locales, options) => {
    if (options?.timeZone !== zone) return new Original(locales, options);
    return {
      formatToParts(value: number) {
        const offset = source.offsetMilliseconds(zone, Number(value));
        if (options.timeZoneName === 'longOffset') {
          const absolute = Math.abs(offset) / 1_000;
          const hours = String(Math.floor(absolute / 3_600)).padStart(2, '0');
          const minutes = String(Math.floor(absolute / 60) % 60).padStart(2, '0');
          const seconds = String(absolute % 60).padStart(2, '0');
          return [{ type: 'timeZoneName', value: offset === 0 ? 'GMT'
            : `GMT${offset < 0 ? '-' : '+'}${hours}:${minutes}:${seconds}` }];
        }
        return wall.formatToParts(Number(value) + offset);
      },
    } as Intl.DateTimeFormat;
  }) as typeof Intl.DateTimeFormat);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('complete local-date coverage adjudicates the unchanged reference', () => {
  it.each([
    ['ordinary', '2000-01-01', 'Asia/Tokyo', 9 * HOUR, [],
      '1999-12-31T15:00:00Z', '2000-01-01T15:00:00Z'],
    ['shortened', '2024-03-10', 'America/New_York', -5 * HOUR,
      [[epoch('2024-03-10T07:00:00Z'), -4 * HOUR]], '2024-03-10T05:00:00Z', '2024-03-11T04:00:00Z'],
    ['extended', '2024-11-03', 'America/New_York', -4 * HOUR,
      [[epoch('2024-11-03T06:00:00Z'), -5 * HOUR]], '2024-11-03T04:00:00Z', '2024-11-04T05:00:00Z'],
    ['Toronto omitted member', '1919-03-31', 'America/Toronto', -5 * HOUR,
      [[epoch('1919-03-31T04:30:00Z'), -4 * HOUR]], '1919-03-31T04:30:00Z', '1919-04-01T04:00:00Z'],
    ['historical seconds', '1914-01-01', 'America/Manaus', -14_404_000,
      [[epoch('1914-01-01T04:00:04Z'), -4 * HOUR]], '1914-01-01T04:00:04Z', '1914-01-02T04:00:00Z'],
  ] as const)('retains %s date members and exact half-open boundaries', (_label, date, zone, offset, changes, first, end) => {
    const source = schedule(offset, changes);
    const start = epoch(first), endExclusive = epoch(end);
    for (const [instant, expected] of [
      [start - 1, 'outside-date'], [start, 'member'],
      [endExclusive - 1, 'member'], [endExclusive, 'outside-date'],
    ] as const) {
      const reference = new Date(instant);
      const actual = assessLocalDateReference(date, reference, zone, source);
      expect(actual.referenceStatus).toBe(expected);
      expect(actual.coverage).toEqual({ status: 'existing', intervals: [{ start, endExclusive }] });
      expect(reference.getTime()).toBe(instant);
      expect(actual.evidence).toMatchObject({ provider: 'explicit-complete-provider', contract: 'complete-transitions-v1' });
    }
  });

  it('admits both disconnected St Johns segments and excludes the intervening hull gap', () => {
    const date = '2009-11-01', zone = 'America/St_Johns';
    const source = schedule(-150 * 60_000, [[epoch('2009-11-01T02:31:00Z'), -210 * 60_000]]);
    const intervals = [
      { start: epoch('2009-11-01T02:30:00Z'), endExclusive: epoch('2009-11-01T02:31:00Z') },
      { start: epoch('2009-11-01T03:30:00Z'), endExclusive: epoch('2009-11-02T03:30:00Z') },
    ];
    for (const [instant, status] of [
      ['2009-11-01T02:30:00Z', 'member'], ['2009-11-01T02:30:59.999Z', 'member'],
      ['2009-11-01T02:31:00Z', 'outside-date'], ['2009-11-01T03:00:00Z', 'outside-date'],
      ['2009-11-01T03:29:59.999Z', 'outside-date'], ['2009-11-01T03:30:00Z', 'member'],
      ['2009-11-02T03:29:59.999Z', 'member'], ['2009-11-02T03:30:00Z', 'outside-date'],
    ] as const) {
      const actual = assessLocalDateReference(date, new Date(instant), zone, source);
      expect(actual.referenceStatus).toBe(status);
      expect(actual.coverage).toEqual({ status: 'existing', intervals });
    }
  });

  it('retains all 48 continuous hours of the repeated Apia date', () => {
    const source = schedule(45_184_000, [[epoch('1892-07-04T11:26:56Z'), -41_216_000]]);
    const start = epoch('1892-07-03T11:26:56Z'), endExclusive = epoch('1892-07-05T11:26:56Z');
    expect(endExclusive - start).toBe(2 * DAY);
    for (const instant of [start, start + DAY - 1, start + DAY, endExclusive - 1]) {
      const actual = assessLocalDateReference('1892-07-04', new Date(instant), 'Pacific/Apia', source);
      expect(actual.referenceStatus).toBe('member');
      expect(actual.coverage).toEqual({ status: 'existing', intervals: [{ start, endExclusive }] });
    }
  });

  it('records a skipped date as empty without substituting an adjacent date', () => {
    const source = schedule(-10 * HOUR, [[epoch('2011-12-30T10:00:00Z'), 14 * HOUR]]);
    const reference = resolveLocalToUtc('2011-12-30', '12:00', 'Pacific/Apia');
    const original = reference.utc.toISOString();
    const actual = assessLocalDateReference('2011-12-30', reference.utc, 'Pacific/Apia', source);
    expect(actual.referenceStatus).toBe('outside-date');
    expect(actual.coverage).toEqual({ status: 'empty', intervals: [] });
    expect(actual.evidence?.observations).toContainEqual({ kind: 'next-transition',
      after: epoch('2011-12-29T00:00:00Z'), next: epoch('2011-12-30T10:00:00Z') });
    expect(reference.utc.toISOString()).toBe(original);
    expect(reference.flags).toContain('dst-gap');
  });

  it('refuses the forward-15 legacy reference despite proving a nonempty nine-hour date', () => {
    const date = '2000-01-01', zone = 'Synthetic/L2bForward15', transition = epoch('2000-01-01T00:00Z');
    const source = schedule(0, [[transition, 15 * HOUR]]);
    syntheticIntl(zone, source);
    const reference = resolveLocalToUtc(date, '12:00', zone);
    const original = reference.utc.getTime();
    expect(localDateContainsUtc(date, reference.utc, zone)).toBe(false);
    const actual = assessLocalDateReference(date, reference.utc, zone, source);
    expect(actual.referenceStatus).toBe('outside-date');
    expect(actual.coverage).toEqual({ status: 'existing', intervals: [{ start: transition, endExclusive: transition + 9 * HOUR }] });
    expect(reference.utc.getTime()).toBe(original);
    expect(assessLocalDateReference(date, new Date(transition), zone, source).referenceStatus).toBe('member');
  });
});

describe('unresolved coverage preserves only the independently witnessed point', () => {
  it.each([undefined, null])('keeps missing native or explicitly absent provider %j uncertain', provider => {
    vi.stubGlobal('Temporal', undefined);
    for (const [instant, referenceStatus] of [
      ['2000-01-01T12:00Z', 'member'], ['2000-01-02T00:00Z', 'outside-date'],
    ] as const) {
      expect(assessLocalDateReference('2000-01-01', new Date(instant), 'UTC', provider)).toEqual({
        referenceStatus, coverage: { status: 'unresolved', reason: 'provider-unavailable' }, evidence: null,
      });
    }
  });

  it.each(['offsetMilliseconds', 'nextTransitionMilliseconds'] as const)('contains %s failures without claiming empty or leaking details', method => {
    const source = { ...schedule(0), [method]: () => { throw new Error('Private provider configuration'); } };
    const actual = assessLocalDateReference('2000-01-01', new Date('2000-01-01T12:00Z'), 'UTC', source);
    expect(actual).toEqual({ referenceStatus: 'member', coverage: { status: 'unresolved', reason: 'provider-failed' }, evidence: null });
    expect(JSON.stringify(actual)).not.toContain('Private');
  });

  it('contains a throwing provider contract accessor', () => {
    const source = Object.defineProperty({}, 'completeness', { get() { throw new Error('Private getter'); } });
    expect(assessLocalDateReference('2000-01-01', new Date('2000-01-01T12:00Z'), 'UTC', source as CompleteTransitionProvider))
      .toEqual({ referenceStatus: 'member', coverage: { status: 'unresolved', reason: 'provider-failed' }, evidence: null });
  });

  it('never retains a partial interval or trace after a later provider failure', () => {
    const midnight = epoch('2000-01-01T00:00Z'), transition = midnight + HOUR;
    const source = schedule(0, [[transition, 1_000]]);
    const original = source.nextTransitionMilliseconds;
    source.nextTransitionMilliseconds = (zone, after) => {
      if (after >= transition) throw Error('Private later failure');
      return original(zone, after);
    };
    const actual = assessLocalDateReference('2000-01-01', new Date(midnight + 12 * HOUR), 'UTC', source);
    expect(actual).toEqual({ referenceStatus: 'member', coverage: { status: 'unresolved', reason: 'provider-failed' }, evidence: null });
    expect(actual.coverage).not.toHaveProperty('intervals');
  });

  it('discards partial coverage and observations when the complete enumeration limit is exceeded', () => {
    const midnight = epoch('2000-01-01T00:00Z');
    const changes: Change[] = Array.from({ length: 33 }, (_, i) => [midnight + i * 1_000, i % 2 === 0 ? 1_000 : 0]);
    expect(assessLocalDateReference('2000-01-01', new Date(midnight + 12 * HOUR), 'UTC', schedule(0, changes)))
      .toEqual({ referenceStatus: 'member', coverage: { status: 'unresolved', reason: 'transition-limit' }, evidence: null });
  });

  it('keeps a failed Intl point witness unresolved even with complete interval evidence', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(() => { throw Error('Private witness failure'); });
    const actual = assessLocalDateReference('2000-01-01', new Date('2000-01-01T12:00Z'), 'UTC', schedule(0));
    expect(actual.referenceStatus).toBe('unresolved');
    expect(actual.coverage.status).toBe('unresolved');
    expect(actual.evidence).toBeNull();
    expect(JSON.stringify(actual)).not.toContain('Private');
  });
});

describe('provider contradictions and trust limits', () => {
  it('refuses a native Temporal UTC offset contradiction despite a valid real-Intl point', () => {
    class Zoned {
      offsetNanoseconds = HOUR * 1_000_000;
      epochNanoseconds = 0n;
      getTimeZoneTransition() { return null; }
    }
    class Instant {
      static fromEpochMilliseconds() { return { toZonedDateTimeISO: () => new Zoned() }; }
    }
    vi.stubGlobal('Temporal', { Instant, ZonedDateTime: Zoned });
    const reference = new Date('2000-01-01T12:00:00Z');
    // This real Intl witness would admit the reference if the interval
    // adapter's UTC/+01:00 contradiction were mistaken for missing evidence.
    expect(localDateContainsUtc('2000-01-01', reference, 'UTC')).toBe(true);
    expect(assessLocalDateReference('2000-01-01', reference, 'UTC')).toEqual({
      referenceStatus: 'unresolved', coverage: { status: 'unresolved', reason: 'provider-violation' }, evidence: null,
    });
  });

  it.each([
    ['invalid offset', { ...schedule(0), offsetMilliseconds: () => NaN }],
    ['nonadvancing transition', { ...schedule(0), nextTransitionMilliseconds: () => epoch('1999-12-31T00:00Z') }],
    ['omitted changed offset', { ...schedule(0, [[epoch('2000-01-01T00:00Z'), HOUR]]), nextTransitionMilliseconds: () => null }],
  ] as const)('does not use the point fallback after detecting %s', (_label, source) => {
    const reference = new Date('2000-01-01T12:00Z');
    expect(localDateContainsUtc('2000-01-01', reference, 'UTC')).toBe(true);
    expect(assessLocalDateReference('2000-01-01', reference, 'UTC', source)).toEqual({
      referenceStatus: 'unresolved', coverage: { status: 'unresolved', reason: 'provider-violation' }, evidence: null,
    });
  });

  it.each([
    ['provider excludes an Intl member', '2000-01-01T23:30Z'],
    ['provider includes an Intl nonmember', '1999-12-31T23:30Z'],
  ])('refuses when %s', (_label, instant) => {
    expect(assessLocalDateReference('2000-01-01', new Date(instant), 'UTC', schedule(HOUR))).toEqual({
      referenceStatus: 'unresolved', coverage: { status: 'unresolved', reason: 'provider-violation' }, evidence: null,
    });
  });

  it('does not accept a provider claiming an empty date against a positive Intl witness', () => {
    const source = schedule(-10 * HOUR, [[epoch('2000-01-01T10:00Z'), 14 * HOUR]]);
    expect(assessLocalDateReference('2000-01-01', new Date('2000-01-01T12:00Z'), 'UTC', source)).toEqual({
      referenceStatus: 'unresolved', coverage: { status: 'unresolved', reason: 'provider-violation' }, evidence: null,
    });
  });

  it('does not promote sampled evidence to the complete-provider contract', () => {
    const source = { ...schedule(0), completeness: 'sampled' };
    const offsets = vi.spyOn(source, 'offsetMilliseconds');
    const transitions = vi.spyOn(source, 'nextTransitionMilliseconds');
    expect(assessLocalDateReference('2000-01-01', new Date('2000-01-01T12:00Z'), 'UTC', source as unknown as CompleteTransitionProvider))
      .toEqual({ referenceStatus: 'member', coverage: { status: 'unresolved', reason: 'invalid-provider' }, evidence: null });
    expect(offsets).not.toHaveBeenCalled();
    expect(transitions).not.toHaveBeenCalled();
  });

  it('retains the counterexample that a forged completeness marker can hide cancelling transitions', () => {
    const zone = 'Synthetic/L2bHiddenMinute', date = '1970-01-01';
    const honest = schedule(0, [[-59 * 60_000, HOUR], [-58 * 60_000, 0]]);
    syntheticIntl(zone, honest);
    const reference = new Date(12 * HOUR);
    const actual = assessLocalDateReference(date, reference, zone, honest);
    expect(actual.coverage).toEqual({ status: 'existing', intervals: [
      { start: -59 * 60_000, endExclusive: -58 * 60_000 }, { start: 0, endExclusive: DAY },
    ] });

    // A caller that supplies this liar violates the trusted integration
    // contract. Matching end observations and one point cannot expose the
    // omitted pair; this fixture must never be described as a proof of trust.
    const liar = { ...honest, nextTransitionMilliseconds: () => null };
    const withheld = assessLocalDateReference(date, reference, zone, liar);
    expect(withheld.referenceStatus).toBe('member');
    expect(withheld.coverage).toEqual({ status: 'existing', intervals: [{ start: 0, endExclusive: DAY }] });
    expect(withheld.evidence).toMatchObject({ provider: 'explicit-complete-provider', contract: 'complete-transitions-v1' });
    expect(withheld.evidence?.observations).toEqual([
      { kind: 'offset', instant: -DAY, offset: 0 },
      { kind: 'next-transition', after: -DAY, next: null },
      { kind: 'offset', instant: 2 * DAY - 1, offset: 0 },
    ]);
    expect(localDateContainsUtc(date, new Date(-59 * 60_000), zone)).toBe(true);
  });
});

describe('input validation and immutable ephemeral evidence', () => {
  it.each([new Date(NaN), '2000-01-01T12:00Z', null, 0, {}, { getTime: (): number => 0 }])('does not admit malformed Date %j or expose successful evidence', reference => {
    const actual = assessLocalDateReference('2000-01-01', reference as Date, 'UTC', schedule(0));
    expect(actual.referenceStatus).toBe('unresolved');
    expect(actual.coverage.status).toBe('unresolved');
    expect(actual.evidence).toBeNull();
  });

  it.each(['2000-1-01', '2000-02-30', '1900-02-29', '2000-01-01\n', '', null, {}])('does not infer a date from invalid civil input %j', date => {
    const source = schedule(0), offsets = vi.spyOn(source, 'offsetMilliseconds');
    const actual = assessLocalDateReference(date as string, new Date('2000-01-01T12:00Z'), 'UTC', source);
    expect(actual.referenceStatus).toBe('unresolved');
    expect(actual.coverage.status).toBe('unresolved');
    expect(actual.evidence).toBeNull();
    expect(offsets).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', ' ', {}, 'Private/Unsupported', '+01:00:30'])('never substitutes the machine zone for %j', zone => {
    const actual = assessLocalDateReference('2000-01-01', new Date('2000-01-01T12:00Z'), zone as string, schedule(0));
    expect(actual.referenceStatus).toBe('unresolved');
    expect(actual.coverage.status).toBe('unresolved');
    expect(actual.evidence).toBeNull();
    expect(JSON.stringify(actual)).not.toContain('Private');
  });

  it('preserves cross-realm Dates without reading their overridden methods', () => {
    const reference = runInNewContext("new Date('2000-01-01T12:00:00Z')") as Date;
    for (const key of ['getTime', 'toISOString', 'valueOf']) {
      Object.defineProperty(reference, key, { get() { throw Error('Private overridden method'); } });
    }
    const original = Date.prototype.getTime.call(reference);
    const actual = assessLocalDateReference('2000-01-01', reference, 'UTC', schedule(0));
    expect(actual.referenceStatus).toBe('member');
    expect(actual.coverage.status).toBe('existing');
    expect(Date.prototype.getTime.call(reference)).toBe(original);
  });

  it('freezes the complete result, intervals and ordered transition observations', () => {
    const midnight = epoch('2000-01-01T00:00Z');
    const actual = assessLocalDateReference('2000-01-01', new Date(midnight + 12 * HOUR), 'UTC', schedule(0));
    if (actual.coverage.status !== 'existing' || !actual.evidence) throw Error('Expected complete evidence');
    expect(actual.evidence.observations).toEqual([
      { kind: 'offset', instant: midnight - DAY, offset: 0 },
      { kind: 'next-transition', after: midnight - DAY, next: null },
      { kind: 'offset', instant: midnight + 2 * DAY - 1, offset: 0 },
    ]);
    for (const value of [actual, actual.coverage, actual.coverage.intervals, ...actual.coverage.intervals,
      actual.evidence, actual.evidence.observations, ...actual.evidence.observations]) expect(Object.isFrozen(value)).toBe(true);
    expect(Reflect.set(actual.evidence.observations[0], 'offset', HOUR)).toBe(false);
    expect(Reflect.set(actual.coverage.intervals[0], 'start', 0)).toBe(false);
    expect(Reflect.set(actual, 'referenceStatus', 'outside-date')).toBe(false);
    expect(actual.referenceStatus).toBe('member');
  });
});
