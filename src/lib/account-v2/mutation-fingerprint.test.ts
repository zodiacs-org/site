import { describe, expect, it } from 'vitest';
import {
  consentMutationFingerprintV1,
  consentMutationPreimageV1,
  deleteChartMutationFingerprintV1,
  putChartMutationFingerprintV1,
  putChartMutationPreimageV1,
  serializePrivateChartPayloadV1,
  sha256HexUtf8,
  type PrivateChartPayloadV1Input,
} from './mutation-fingerprint';

const CHART_ID = '22222222-2222-4222-8222-222222222222';
const POLICY_VERSION = 'chart-sync-2026-08-12.v1';

const chart: PrivateChartPayloadV1Input = {
  label: 'My chart',
  birth: {
    date: '1990-01-01',
    time: '12:34',
    timeKnown: true,
    place: {
      name: 'Bangkok',
      admin1: 'Bangkok',
      country: 'TH',
      lat: 13.7563,
      lon: 100.5018,
      tz: 'Asia/Bangkok',
    },
  },
  derived: {
    positions: { b: [1, 2], a: [3, 4], h: 'w', v: '1.2.3' },
    timeKnown: true,
    sunSign: 'capricorn',
    engineVersion: '1.2.3',
    houseSystem: 'whole',
  },
};

describe('account mutation fingerprint v1', () => {
  it('pins canonical private-chart bytes and the two-stage PUT hash', async () => {
    const serialized = serializePrivateChartPayloadV1(chart);
    expect(serialized).toBe('{"schema":"zodiacs.account.private-chart.v1","label":"My chart","birth":{"date":"1990-01-01","time":"12:34","timeKnown":true,"place":{"name":"Bangkok","admin1":"Bangkok","country":"TH","lat":13.7563,"lon":100.5018,"tz":"Asia/Bangkok"}},"derived":{"positions":{"b":[1,2],"a":[3,4],"h":"w","v":"1.2.3"},"timeKnown":true,"sunSign":"capricorn","engineVersion":"1.2.3","houseSystem":"whole"}}');
    const payloadHash = await sha256HexUtf8(serialized);
    expect(payloadHash).toBe('e96e8b0b20a9e959fadd8276dbbbde78f9b913a1ae63ed812a7ba4d6bcd9c989');
    expect(putChartMutationPreimageV1({
      chartId: CHART_ID.toUpperCase(),
      baseRevision: 4,
      payloadSha256: payloadHash,
    })).toBe([
      'zodiacs.account-sync-v2.mutation.v1',
      'operation=put_chart',
      `chart_id=${CHART_ID}`,
      'base_revision=4',
      `payload_sha256=${payloadHash}`,
    ].join('\n'));
    await expect(putChartMutationFingerprintV1({
      ...chart,
      chartId: CHART_ID,
      baseRevision: 4,
    })).resolves.toBe('d2cc8b932025bd66905e2e118d4097ebc029c848b096b2459f101c8fdce07f6b');
  });

  it('pins delete and consent hashes, omitting policy from withdrawal', async () => {
    await expect(deleteChartMutationFingerprintV1({
      chartId: CHART_ID,
      baseRevision: 4,
    })).resolves.toBe('0e2e7d130039870521366328da949008d8f9027efc46b7b653db35df573fe3d1');
    await expect(consentMutationFingerprintV1({
      decision: 'grant',
      policyVersion: POLICY_VERSION,
    })).resolves.toBe('e925db36da3f7629c219412941ae6429c7623d3dc4739ef2c54f226f1522151b');
    await expect(consentMutationFingerprintV1({ decision: 'withdraw' }))
      .resolves.toBe('2ae56abfc8794714cc7a9a4f289218e41d76227d8cc4775d50531aa6226dae06');
    expect(consentMutationPreimageV1({
      decision: 'withdraw',
      policyVersion: 'must-be-ignored',
    })).not.toContain('policy_version');
  });
  it('keeps the chart_sync consent preimage unchanged and separates chart_emails', () => {
    expect(consentMutationPreimageV1({ decision: 'grant', policyVersion: POLICY_VERSION }))
      .toBe(consentMutationPreimageV1({ decision: 'grant', policyVersion: POLICY_VERSION, purpose: 'chart_sync' }));
    expect(consentMutationPreimageV1({ decision: 'withdraw', purpose: 'chart_emails' })).toBe([
      'zodiacs.account-sync-v2.mutation.v1',
      'operation=consent',
      'purpose=chart_emails',
      'decision=withdraw',
    ].join('\n'));
    expect(consentMutationPreimageV1({ decision: 'withdraw', purpose: 'chart_emails' }))
      .not.toBe(consentMutationPreimageV1({ decision: 'withdraw' }));
  });
});
