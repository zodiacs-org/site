import { describe, expect, it } from 'vitest';
import {
  isAdultAccountBirthDate,
  parseAccountSyncInput,
  parseSerializedAccountPrivateChartPayload,
  serializeAccountPrivateChartPayload,
} from './sync-wire.js';

const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
const CHART_ID = '22222222-2222-4222-8222-222222222222';
const MUTATION_ID = '33333333-3333-4333-8333-333333333333';

const birth = {
  date: '1990-01-01',
  time: '08:45',
  timeKnown: true,
  place: {
    name: 'Bangkok',
    admin1: 'Bangkok',
    country: 'Thailand',
    lat: 13.7563,
    lon: 100.5018,
    tz: 'Asia/Bangkok',
  },
};

const positions = {
  b: [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345],
  a: [100, 190],
  h: 'w',
  v: '3.2.1',
};

const chartPut = {
  deviceId: DEVICE_ID,
  chartId: CHART_ID,
  baseRevision: 0,
  mutationId: MUTATION_ID,
  label: 'My chart',
  subjectKind: 'self',
  selfAttestation: true,
  birth,
  derived: {
    positions,
    timeKnown: true,
    sunSign: 'aries',
    engineVersion: '3.2.1',
    houseSystem: 'whole',
  },
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return {
    headers: { 'content-type': 'application/json', ...headers },
    body,
  };
}

describe('account sync request boundary', () => {
  it('accepts and normalizes the exact self-chart upload contract', () => {
    expect(parseAccountSyncInput('chart-put', request(chartPut))).toEqual({
      action: 'chart-put',
      ...chartPut,
    });
  });

  it.each([
    [{ ...chartPut, userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, 'a request owner'],
    [{ ...chartPut, subjectKind: 'other' }, 'another-person subject'],
    [{ ...chartPut, selfAttestation: false }, 'missing attestation'],
    [{ ...chartPut, subjectAttestation: 'self_declared_v1' }, 'client-selected attestation string'],
  ])('rejects an invalid self-chart authority shape', (candidate, _label) => {
    expect(parseAccountSyncInput('chart-put', request(candidate))).toBeNull();
  });

  it.each([
    [{ ...birth, date: '2023-02-29' }, 'impossible date'],
    [{ ...birth, date: '1799-12-31' }, 'unsupported date'],
    [{ ...birth, time: null }, 'known time without a value'],
    [{ ...birth, timeKnown: false }, 'unknown time with a value'],
    [{ ...birth, place: { ...birth.place, lat: 91 } }, 'latitude outside Earth'],
    [{ ...birth, place: { ...birth.place, tz: 'Private/Not_A_Zone' } }, 'unknown timezone'],
    [{ ...birth, place: { ...birth.place, name: ' Bangkok ' } }, 'untrimmed place'],
  ])('rejects invalid raw birth input', (candidateBirth, _label) => {
    expect(parseAccountSyncInput('chart-put', request({ ...chartPut, birth: candidateBirth }))).toBeNull();
  });

  it('accepts an unknown time only when the derived positions omit angles', () => {
    const unknownBirth = { ...birth, time: null, timeKnown: false };
    const unknownPositions = { b: positions.b, h: 'p', v: '3.2.1' };
    const result = parseAccountSyncInput('chart-put', request({
      ...chartPut,
      birth: unknownBirth,
      derived: {
        ...chartPut.derived,
        positions: unknownPositions,
        timeKnown: false,
        houseSystem: 'placidus',
      },
    }));
    expect(result).not.toBeNull();

    expect(parseAccountSyncInput('chart-put', request({
      ...chartPut,
      birth: unknownBirth,
      derived: { ...chartPut.derived, timeKnown: false },
    }))).toBeNull();
  });

  it.each([
    [{ ...chartPut.derived, positions: { ...positions, extra: 'birth-shaped' } }, 'unknown positions key'],
    [{ ...chartPut.derived, positions: { ...positions, b: positions.b.slice(0, 11) } }, 'wrong body count'],
    [{ ...chartPut.derived, positions: { ...positions, b: [-1, ...positions.b.slice(1)] } }, 'bad longitude'],
    [{ ...chartPut.derived, sunSign: 'taurus' }, 'sun-sign mismatch'],
    [{ ...chartPut.derived, engineVersion: '9.9.9' }, 'engine receipt mismatch'],
    [{ ...chartPut.derived, houseSystem: 'placidus' }, 'house-system marker mismatch'],
  ])('rejects an invalid derived payload', (derived, _label) => {
    expect(parseAccountSyncInput('chart-put', request({ ...chartPut, derived }))).toBeNull();
  });

  it('rejects non-JSON and bounded-body violations before authentication or encryption', () => {
    expect(parseAccountSyncInput('bootstrap', request({
      deviceId: DEVICE_ID,
      platform: 'web',
    }, { 'content-type': 'text/plain' }))).toBeNull();
    expect(parseAccountSyncInput('bootstrap', request({
      deviceId: DEVICE_ID,
      platform: 'web',
    }, { 'content-length': '32769' }))).toBeNull();
  });

  it('validates exact shapes for every non-chart action', () => {
    expect(parseAccountSyncInput('bootstrap', request({ deviceId: DEVICE_ID, platform: 'web' })))
      .toEqual({ action: 'bootstrap', deviceId: DEVICE_ID, platform: 'web' });
    expect(parseAccountSyncInput('consent', request({
      mutationId: MUTATION_ID,
      decision: 'grant',
      policyVersion: 'chart-sync-2026-08-12.v1',
    }))).toEqual({
      action: 'consent',
      purpose: 'chart_sync',
      mutationId: MUTATION_ID,
      decision: 'grant',
      policyVersion: 'chart-sync-2026-08-12.v1',
    });
    expect(parseAccountSyncInput('chart-delete', request({
      deviceId: DEVICE_ID,
      chartId: CHART_ID,
      baseRevision: 1,
      mutationId: MUTATION_ID,
    }))).toEqual({
      action: 'chart-delete',
      deviceId: DEVICE_ID,
      chartId: CHART_ID,
      baseRevision: 1,
      mutationId: MUTATION_ID,
    });
    expect(parseAccountSyncInput('pull', request({ deviceId: DEVICE_ID, afterCursor: 0 })))
      .toEqual({ action: 'pull', deviceId: DEVICE_ID, afterCursor: 0, limit: 100 });
    expect(parseAccountSyncInput('chart-get', request({ deviceId: DEVICE_ID, chartId: CHART_ID })))
      .toEqual({ action: 'chart-get', deviceId: DEVICE_ID, chartId: CHART_ID });
  });

  it('allows stale clients to withdraw but still pins grants to the current policy', () => {
    expect(parseAccountSyncInput('consent', request({
      mutationId: MUTATION_ID,
      decision: 'withdraw',
      policyVersion: 'chart-sync-older.v0',
    }))).toEqual({
      action: 'consent',
      purpose: 'chart_sync',
      mutationId: MUTATION_ID,
      decision: 'withdraw',
    });
    expect(parseAccountSyncInput('consent', request({
      mutationId: MUTATION_ID,
      decision: 'withdraw',
    }))).toEqual({ action: 'consent', purpose: 'chart_sync', mutationId: MUTATION_ID, decision: 'withdraw' });
    expect(parseAccountSyncInput('consent', request({
      mutationId: MUTATION_ID,
      decision: 'withdraw',
      purpose: 'chart_emails',
    }))).toEqual({ action: 'consent', purpose: 'chart_emails', mutationId: MUTATION_ID, decision: 'withdraw' });
    expect(parseAccountSyncInput('consent', request({
      mutationId: MUTATION_ID,
      decision: 'grant',
      purpose: 'chart_emails',
      policyVersion: 'chart-emails-2026-11-11.v1',
    }))).toEqual({
      action: 'consent',
      purpose: 'chart_emails',
      mutationId: MUTATION_ID,
      decision: 'grant',
      policyVersion: 'chart-emails-2026-11-11.v1',
    });
    expect(parseAccountSyncInput('consent', request({
      mutationId: MUTATION_ID,
      decision: 'grant',
      policyVersion: 'chart-sync-older.v0',
    }))).toBeNull();
  });

  it('uses a pinned UTC adult-only boundary for remote chart eligibility', () => {
    const now = Date.parse('2026-08-12T23:59:59.000Z');
    expect(isAdultAccountBirthDate('2008-08-12', now)).toBe(true);
    expect(isAdultAccountBirthDate('2008-08-13', now)).toBe(false);
    expect(isAdultAccountBirthDate('2027-01-01', now)).toBe(false);
  });

  it('serializes the entire private chart canonically and rejects decrypted schema widening', () => {
    const parsed = parseAccountSyncInput('chart-put', request(chartPut));
    if (!parsed || parsed.action !== 'chart-put') throw new Error('Expected a chart-put input.');
    const serialized = serializeAccountPrivateChartPayload(parsed);
    expect(serialized).toBe(JSON.stringify({
      schema: 'zodiacs.account.private-chart.v1',
      label: chartPut.label,
      birth,
      derived: chartPut.derived,
    }));
    expect(parseSerializedAccountPrivateChartPayload(serialized)).toEqual({
      label: chartPut.label,
      birth,
      derived: chartPut.derived,
    });
    expect(parseSerializedAccountPrivateChartPayload(JSON.stringify({
      ...JSON.parse(serialized),
      ownerId: 'must-not-survive',
    }))).toBeNull();
  });
});
