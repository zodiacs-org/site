import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, REFERENCE_SPAN, natalChart } from '@zodiacs/engine';
import { parseNatalEnvelope } from '@zodiacs/engine/receipt';
import { EPOCH_MAX_UTC, EPOCH_MIN_UTC, HOUSE_SYSTEMS } from './bounds';
import {
  COMPARE_INPUT, NATAL_INPUT, PRIVACY, UNSUPPORTED,
  calculateNatalChart, compareCalculationRecords, describeCapabilities,
} from './tools';

/** Synthetic: round coordinates for well-known cities, nobody's birth. */
const LONDON = { utc: '1990-06-15T13:30:00Z', latitude: 51.5074, longitude: -0.1278 };
const POLAR = { utc: '1990-12-15T09:00:00Z', latitude: 78.2232, longitude: 15.6267 };

const natal = (args: Record<string, unknown>) => calculateNatalChart(NATAL_INPUT.parse(args));
const recordFor = (args: Record<string, unknown>) => {
  const outcome = natal({ ...args, output: 'record' });
  if (!outcome.ok) throw new Error(outcome.refusal);
  return outcome.value.record as string;
};
const compare = (left: string, right: string) => compareCalculationRecords(COMPARE_INPUT.parse({ left, right }));

describe('the schemas a host reads before calling anything', () => {
  it('refuses an argument it does not know rather than ignoring it', () => {
    expect(NATAL_INPUT.safeParse({ ...LONDON, houseSystemm: 'whole' }).success).toBe(false);
    expect(COMPARE_INPUT.safeParse({ left: '{}', right: '{}', follow: 'http://x' }).success).toBe(false);
  });

  it('refuses the three hostile key names as it refuses any other unknown key', () => {
    // The schema itself is closed against all three. What an AI review found is
    // a layer up: the SDK's own parse of `params.arguments` drops `__proto__`
    // before this schema is reached, so end to end that one key is silently
    // ignored rather than reported. The drive records that; the schema's own
    // behaviour is here, and it is not the weak link.
    const smuggled = JSON.parse('{"utc":"1990-06-15T13:30:00Z","__proto__":{"timeKnown":false}}');
    expect(NATAL_INPUT.safeParse(smuggled).success).toBe(false);
    for (const key of ['totallyUnknown', 'constructor', 'prototype']) {
      expect(NATAL_INPUT.safeParse({ utc: '1990-06-15T13:30:00Z', [key]: 1 }).success,
        `${key} was accepted`).toBe(false);
    }
  });

  it('applies its bounds in the schema, not only in the handler', () => {
    expect(NATAL_INPUT.safeParse({ ...LONDON, latitude: 95 }).success).toBe(false);
    expect(NATAL_INPUT.safeParse({ ...LONDON, houseSystem: 'gauquelin' }).success).toBe(false);
    expect(NATAL_INPUT.safeParse({ ...LONDON, utc: 'x'.repeat(65) }).success).toBe(false);
    expect(COMPARE_INPUT.safeParse({ left: '', right: '{}' }).success).toBe(false);
  });

  it('defaults the options a caller may omit, and infers nothing it must not', () => {
    const parsed = NATAL_INPUT.parse(LONDON);
    expect(parsed.houseSystem).toBe('placidus');
    expect(parsed.timeKnown).toBe(true);
    expect(parsed.output).toBe('summary');
    // Omitting `reference` must stay omitted: the codec treats an absent
    // reference as "nothing stated", never as noon.
    expect(parsed.reference).toBeUndefined();
  });
});

describe('get_capabilities', () => {
  const value = (() => {
    const outcome = describeCapabilities();
    if (!outcome.ok) throw new Error(outcome.refusal);
    return outcome.value as Record<string, any>;
  })();

  it('names the engine actually bundled, and labels both releases honestly', () => {
    expect(value.engine.version).toBe(ENGINE_VERSION);
    expect(value.engine.releaseStatus).toBe('unpublished-candidate');
    expect(value.adapter.releaseStatus).toBe('unpublished-candidate');
    expect(value.adapter.transport).toBe('stdio');
  });

  it('states the privacy distinction in the machine-readable output too', () => {
    expect(value.privacy.assistant).toMatch(/not a local AI experience/);
    expect(value.privacy.output).toMatch(/not anonymous/);
    expect(value.privacy.claims).toMatch(/authenticates none|authenticates it/);
  });

  it('says there is no timeout rather than implying one', () => {
    expect(UNSUPPORTED.some((line) => /no timeout/.test(line))).toBe(true);
    expect(value.unsupported).toEqual([...UNSUPPORTED]);
  });
});

describe('calculate_natal_chart', () => {
  it('returns the computed chart and the four fields needed to read it', () => {
    const outcome = natal(LONDON);
    expect(outcome.ok).toBe(true);
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.bodies).toHaveLength(12);
    expect(Object.keys(value.angles)).toHaveLength(4);
    expect(value.cusps).toHaveLength(12);
    expect(value.houses).toEqual({ requested: 'placidus', actual: 'placidus', absenceReason: null });
    expect(value.timeKnown).toBe(true);
    expect(value.resultFlags).toEqual([]);
  });

  it('does not repeat the birth details back in the summary', () => {
    const outcome = natal(LONDON);
    const text = JSON.stringify(outcome.ok ? outcome.value : {});
    for (const echo of [LONDON.utc, '51.5074', '-0.1278']) expect(text).not.toContain(echo);
  });

  it('reports the house system it could use, not the one requested, and flags the fallback', () => {
    const outcome = natal({ ...POLAR, houseSystem: 'placidus' });
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.houses.requested).toBe('placidus');
    expect(value.houses.actual).toBe('whole');
    expect(value.resultFlags).toContain('polar-fallback');
  });

  it.each(HOUSE_SYSTEMS)('computes %s as the engine does, in a record the engine accepts', (system) => {
    const outcome = natal({ ...LONDON, houseSystem: system });
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.houses).toEqual({ requested: system, actual: system, absenceReason: null });
    expect(value.cusps).toEqual(natalChart({ ...LONDON, houseSystem: system }).houses?.cusps);
    expect(parseNatalEnvelope(recordFor({ ...LONDON, houseSystem: system })).ok).toBe(true);
  });

  it('falls back from Koch as it does from Placidus, and says so', () => {
    const outcome = natal({ ...POLAR, houseSystem: 'koch' });
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.houses).toEqual({ requested: 'koch', actual: 'whole', absenceReason: null });
    expect(value.resultFlags).toContain('polar-fallback');
  });

  it('suppresses angles and houses for an unknown time and says why', () => {
    const outcome = natal({ ...LONDON, timeKnown: false });
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.angles).toBeNull();
    expect(value.cusps).toBeNull();
    expect(value.houses.absenceReason).toBe('unknown-time');
    expect(value.resultFlags).toContain('no-time');
    // The bodies are still the same instant's positions.
    expect(value.bodies).toHaveLength(12);
  });

  it('reports a missing place rather than standing in a default one', () => {
    const outcome = natal({ utc: LONDON.utc });
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.houses.absenceReason).toBe('missing-location');
    expect(value.angles).toBeNull();
  });

  it('returns the full record only when asked, and then only the record', () => {
    const outcome = natal({ ...LONDON, output: 'record' });
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(Object.keys(value).sort()).toEqual(['engine', 'record', 'schema']);
    const parsed = parseNatalEnvelope(value.record);
    expect(parsed.ok).toBe(true);
  });

  it('refuses one coordinate without the other, and a date outside the epoch', () => {
    expect(natal({ utc: LONDON.utc, latitude: 51.5 }).ok).toBe(false);
    expect(natal({ ...LONDON, utc: '1799-01-01T00:00:00Z' }).ok).toBe(false);
  });

  it('computes no chart outside the engine’s reference span, so none carries that flag', () => {
    // From engine 0.1.1-rc.8 a chart before 1800-01-01T00:00Z or from
    // 2200-01-01T00:00Z carries `outside-reference-span`. The epoch here is the
    // same span, so the flag can reach this adapter only in a record passed in.
    expect(EPOCH_MIN_UTC).toBe(REFERENCE_SPAN.from);
    expect(Date.parse(EPOCH_MAX_UTC)).toBeLessThan(Date.parse(REFERENCE_SPAN.to));
    for (const utc of [EPOCH_MIN_UTC, EPOCH_MAX_UTC]) {
      const outcome = natal({ ...LONDON, utc });
      expect(outcome.ok ? (outcome.value as Record<string, any>).resultFlags : outcome.refusal, utc).toEqual([]);
    }
  });
});

describe('compare_calculation_records', () => {
  it('compares one record against itself as identical', () => {
    const record = recordFor(LONDON);
    const outcome = compare(record, record);
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.identical).toBe(true);
    expect(value.counts.differences).toBe(0);
  });

  it('finds a house-system difference and reproduces its cause', () => {
    const outcome = compare(recordFor(LONDON), recordFor({ ...LONDON, houseSystem: 'whole' }));
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.identical).toBe(false);
    expect(value.differences.filter((row: { id: string }) => /^cusp-\d+$/.test(row.id))).toHaveLength(12);
    expect(value.explanations.some((row: { evidence: string }) => row.evidence === 'reproduced')).toBe(true);
  });

  it('leaves birth details and positions out of the default response', () => {
    // The caller supplied both records to this call. Repeating their contents
    // back adds a second copy to whatever the result travels through and tells
    // the caller nothing they did not already have.
    const outcome = compare(recordFor(LONDON), recordFor({ ...POLAR, houseSystem: 'whole' }));
    const text = JSON.stringify(outcome.ok ? outcome.value : {});
    for (const leak of [LONDON.utc, POLAR.utc, '51.5074', '78.2232', '15.6267', '84.189085']) {
      expect(text, `${leak} was echoed back`).not.toContain(leak);
    }
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.output).toBe('summary');
    expect(value.withheld).toBe(PRIVACY.withheld);
    // What makes the answer useful survives: which field, what kind, how far.
    const instant = value.differences.find((row: { id: string }) => row.id === 'instant');
    expect(instant).toMatchObject({ id: 'instant', label: 'Resolved instant (UTC)', valuesWithheld: true });
    expect(instant).not.toHaveProperty('left');
    const latitude = value.differences.find((row: { id: string }) => row.id === 'latitude');
    expect(typeof latitude.delta).toBe('number');
  });

  it('keeps the values of rows whose values are the finding', () => {
    // "The two charts asked for different house systems" is only useful if the
    // answer says which two, and a house system is nobody's birth detail.
    const outcome = compare(recordFor(LONDON), recordFor({ ...LONDON, houseSystem: 'whole' }));
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    const requested = value.differences.find((row: { id: string }) => row.id === 'houses-requested');
    expect(requested).toMatchObject({ left: 'placidus', right: 'whole' });
    expect(requested).not.toHaveProperty('valuesWithheld');
  });

  it('returns every value when asked, as an explicit choice', () => {
    const outcome = compareCalculationRecords(COMPARE_INPUT.parse({
      left: recordFor(LONDON), right: recordFor({ ...LONDON, houseSystem: 'whole' }), output: 'full',
    }));
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.output).toBe('full');
    expect(value).not.toHaveProperty('withheld');
    expect(value.differences.every((row: Record<string, unknown>) => !('valuesWithheld' in row))).toBe(true);
    expect(value.differences.find((row: { id: string }) => row.id === 'cusp-1')).toHaveProperty('left');
  });

  it('labels its own output as not anonymous', () => {
    const record = recordFor(LONDON);
    const outcome = compare(record, recordFor({ ...LONDON, houseSystem: 'whole' }));
    expect(outcome.ok && outcome.value.disclosure).toBe(PRIVACY.output);
  });

  it('does not echo either record back', () => {
    const outcome = compare(recordFor(LONDON), recordFor({ ...LONDON, houseSystem: 'whole' }));
    const text = JSON.stringify(outcome.ok ? outcome.value : {});
    expect(text).not.toContain(LONDON.utc);
    expect(text).not.toContain('natal-envelope.draft-v1');
  });

  it.each([
    ['not JSON', '{oops', /is not valid JSON/],
    ['JSON that is not a record', '{"a":1}', /does not declare a schema version/],
  ])('refuses a record that is %s, and says which', (_label, left, pattern) => {
    const outcome = compare(left, recordFor(LONDON));
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.refusal).toMatch(pattern);
  });

  it('distinguishes an unsupported version from a malformed record', () => {
    const record = JSON.parse(recordFor(LONDON));
    record.schema = 'zodiacs.natal-envelope.draft-v9';
    const outcome = compare(JSON.stringify(record), recordFor(LONDON));
    expect(outcome.ok === false && outcome.refusal).toMatch(/does not declare a schema version this adapter supports/);
  });

  it('refuses a record requiring a feature it does not implement', () => {
    const record = JSON.parse(recordFor(LONDON));
    record.requiredFeatures = ['replay-v2'];
    const outcome = compare(JSON.stringify(record), recordFor(LONDON));
    expect(outcome.ok === false && outcome.refusal).toMatch(/requires a feature this adapter does not implement/);
  });

  it('refuses an oversized record by its byte count, naming the size', () => {
    const outcome = compare(`{"x":"${'€'.repeat(40_000)}"}`, recordFor(LONDON));
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.refusal).toMatch(/120008 bytes, over the 65536-byte limit/);
  });

  it('will not re-run a record claiming another engine and call it reproduced', () => {
    const record = JSON.parse(recordFor(LONDON));
    record.receipt.engine.version = '99.0.0';
    const outcome = compare(JSON.stringify(record), recordFor({ ...LONDON, houseSystem: 'whole' }));
    const value = outcome.ok ? (outcome.value as Record<string, any>) : {};
    expect(value.explanations.every((row: { evidence: string }) => row.evidence !== 'reproduced')).toBe(true);
    expect(value.limits.join(' ')).toContain('99.0.0');
  });

  it('a refusal never quotes the record it refused', () => {
    const record = recordFor(LONDON);
    const outcome = compare(`${record.slice(0, 40)}`, record);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal).not.toContain('1990-06-15');
    expect(outcome.refusal).not.toContain('51.5074');
  });
});
