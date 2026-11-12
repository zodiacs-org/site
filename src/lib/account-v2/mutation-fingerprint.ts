export const ACCOUNT_SYNC_MUTATION_FINGERPRINT_DOMAIN = 'zodiacs.account-sync-v2.mutation.v1';

const SHA_256_HEX = /^[0-9a-f]{64}$/u;

export interface PrivateChartPayloadV1Input {
  label: string;
  birth: {
    date: string;
    time: string | null;
    timeKnown: boolean;
    place: null | {
      name: string;
      admin1: string;
      country: string;
      lat: number;
      lon: number;
      tz: string;
    };
  };
  derived: {
    positions: {
      b: number[];
      a?: [number, number];
      h: 'w' | 'p';
      v: string;
    };
    timeKnown: boolean;
    sunSign: string;
    engineVersion: string;
    houseSystem: 'whole' | 'placidus';
  };
}

/**
 * Canonical private-chart plaintext shared by the browser and account API.
 * Property order is part of the v1 protocol; do not replace this with a
 * generic object sorter or serialize the upload wire directly.
 */
export function serializePrivateChartPayloadV1(input: PrivateChartPayloadV1Input): string {
  const place = input.birth.place === null
    ? null
    : {
        name: input.birth.place.name,
        admin1: input.birth.place.admin1,
        country: input.birth.place.country,
        lat: input.birth.place.lat,
        lon: input.birth.place.lon,
        tz: input.birth.place.tz,
      };
  const positions = input.derived.positions.a === undefined
    ? {
        b: [...input.derived.positions.b],
        h: input.derived.positions.h,
        v: input.derived.positions.v,
      }
    : {
        b: [...input.derived.positions.b],
        a: [...input.derived.positions.a] as [number, number],
        h: input.derived.positions.h,
        v: input.derived.positions.v,
      };
  return JSON.stringify({
    schema: 'zodiacs.account.private-chart.v1',
    label: input.label,
    birth: {
      date: input.birth.date,
      time: input.birth.time,
      timeKnown: input.birth.timeKnown,
      place,
    },
    derived: {
      positions,
      timeKnown: input.derived.timeKnown,
      sunSign: input.derived.sunSign,
      engineVersion: input.derived.engineVersion,
      houseSystem: input.derived.houseSystem,
    },
  });
}

export function putChartMutationPreimageV1(input: {
  chartId: string;
  baseRevision: number;
  payloadSha256: string;
}): string {
  return [
    ACCOUNT_SYNC_MUTATION_FINGERPRINT_DOMAIN,
    'operation=put_chart',
    `chart_id=${input.chartId.toLowerCase()}`,
    `base_revision=${String(input.baseRevision)}`,
    `payload_sha256=${input.payloadSha256.toLowerCase()}`,
  ].join('\n');
}

export function deleteChartMutationPreimageV1(input: {
  chartId: string;
  baseRevision: number;
}): string {
  return [
    ACCOUNT_SYNC_MUTATION_FINGERPRINT_DOMAIN,
    'operation=delete_chart',
    `chart_id=${input.chartId.toLowerCase()}`,
    `base_revision=${String(input.baseRevision)}`,
  ].join('\n');
}

export function consentMutationPreimageV1(input: {
  decision: 'grant' | 'withdraw';
  policyVersion?: string;
  /** Defaults to chart_sync, whose preimage is unchanged since v1. */
  purpose?: 'chart_sync' | 'chart_emails';
}): string {
  const lines = [
    ACCOUNT_SYNC_MUTATION_FINGERPRINT_DOMAIN,
    'operation=consent',
    `purpose=${input.purpose === 'chart_emails' ? 'chart_emails' : 'chart_sync'}`,
    `decision=${input.decision}`,
  ];
  if (input.decision === 'grant') {
    lines.push(`policy_version=${input.policyVersion ?? ''}`);
  }
  return lines.join('\n');
}

export async function putChartMutationFingerprintV1(
  input: PrivateChartPayloadV1Input & { chartId: string; baseRevision: number },
): Promise<string> {
  const payloadSha256 = await sha256HexUtf8(serializePrivateChartPayloadV1(input));
  return sha256HexUtf8(putChartMutationPreimageV1({
    chartId: input.chartId,
    baseRevision: input.baseRevision,
    payloadSha256,
  }));
}

export async function deleteChartMutationFingerprintV1(input: {
  chartId: string;
  baseRevision: number;
}): Promise<string> {
  return sha256HexUtf8(deleteChartMutationPreimageV1(input));
}

export async function consentMutationFingerprintV1(input: {
  decision: 'grant' | 'withdraw';
  policyVersion?: string;
  purpose?: 'chart_sync' | 'chart_emails';
}): Promise<string> {
  return sha256HexUtf8(consentMutationPreimageV1(input));
}

export async function sha256HexUtf8(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('web-crypto-unavailable');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA_256_HEX.test(value);
}
