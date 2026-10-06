import { describe, expect, it } from 'vitest';
import { natalChart } from '@zodiacs/engine';
import { createNatalEnvelope, serializeNatalEnvelope } from '@zodiacs/engine/receipt';
import { calculateStudio, EXAMPLE, recordText } from './model';
import { inspectRecords, readStudioRecord, reproduceRecord } from './inspect';

describe('Chart Inspector', () => {
  it('reproduces a downloaded record and a chart with unknown time', () => {
    for (const timeKnown of [true, false]) {
      const record = recordText(calculateStudio({ ...EXAMPLE, timeKnown }));
      const replay = reproduceRecord(record);
      expect(replay.matches).toBe(true); expect(replay.differences).toEqual([]);
      expect(readStudioRecord(replay.record).result).toEqual(readStudioRecord(record).result);
    }
  });
  it('preserves a pinned delta-T, non-UTC time scale and requested polar house system', () => {
    const chart = natalChart({ utc: '1990-06-15T12:00:00Z', latitude: 78.2232, longitude: 15.6267, houseSystem: 'placidus', deltaT: 70, timeScale: 'tt' });
    const record = serializeNatalEnvelope(createNatalEnvelope(chart));
    const result = reproduceRecord(record);
    expect(result.matches).toBe(true);
    expect(readStudioRecord(result.record).receipt.houses).toMatchObject({ requested: 'placidus', actual: 'whole' });
  });
  it('compares house systems and labels reproduced explanations separately', () => {
    const left = recordText(calculateStudio(EXAMPLE)), right = recordText(calculateStudio({ ...EXAMPLE, houseSystem: 'whole' }));
    const comparison = inspectRecords(left, right);
    expect(comparison.identical).toBe(false);
    expect(comparison.differences.some(row => row.id === 'houses-requested')).toBe(true);
    expect(comparison.explanations.some(row => row.evidence === 'reproduced')).toBe(true);
    expect(inspectRecords(left, left).identical).toBe(true);
  });
  it('detects altered result fields rather than treating parse success as reproduction', () => {
    const original = JSON.parse(recordText(calculateStudio(EXAMPLE)));
    original.result.bodies[0].lat += 0.01;
    const result = reproduceRecord(JSON.stringify(original));
    expect(result.matches).toBe(false); expect(result.differences.some(row => row.label.includes('latitude'))).toBe(true);
  });
  it('refuses an unavailable engine and unsupported required features', () => {
    const original = JSON.parse(recordText(calculateStudio(EXAMPLE)));
    original.receipt.engine.version = '0.1.1-rc.99';
    expect(() => reproduceRecord(JSON.stringify(original))).toThrow('different engine');
    original.requiredFeatures = ['execute-url'];
    expect(() => readStudioRecord(JSON.stringify(original))).toThrow('feature');
  });
  it('bounds UTF-8 bytes and rejects malformed or inconsistent records without quoting their contents', () => {
    expect(() => readStudioRecord('private secret')).toThrow('not valid JSON');
    expect(() => readStudioRecord('雪'.repeat(22_000))).toThrow('64 KiB');
    const original = JSON.parse(recordText(calculateStudio(EXAMPLE)));
    original.receipt.timeKnown = false;
    expect(() => readStudioRecord(JSON.stringify(original))).toThrow();
  });
  it('does not carry extensions or claimed origin into a recalculated record', () => {
    const original = JSON.parse(recordText(calculateStudio(EXAMPLE)));
    original.extensions = { instructions: '<script>do not execute</script>', url: 'https://invalid.example/' };
    const result = reproduceRecord(JSON.stringify(original));
    expect(result.matches).toBe(true); expect(result.record).not.toContain('invalid.example');
    expect(result.record).not.toContain('do not execute');
  });
});
