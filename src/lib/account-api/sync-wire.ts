import { Buffer } from 'node:buffer';
import {
  serializePrivateChartPayloadV1,
  type PrivateChartPayloadV1Input,
} from '../account-v2/mutation-fingerprint.js';
import {
  accountConsentPolicyVersion,
  type AccountConsentPurpose,
} from '../account-v2/policy.js';
import { accountRequestHeader, isAccountUuid, type AccountApiAction } from './request.js';

const MAX_BODY_BYTES = 32 * 1024;
const MAX_LABEL_BYTES = 480;
const MAX_TIMEZONE_BYTES = 128;
const MAX_ENGINE_VERSION_BYTES = 32;
const MAX_POSITIONS_BYTES = 1_024;
const MAX_POLICY_VERSION_BYTES = 64;
const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;
const CONTROL = /[\p{Cc}\p{Cf}]/u;
const ENGINE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,31}$/u;
const TIMEZONE = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+){1,3}$/u;
const SUN_SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;

export type SunSign = typeof SUN_SIGNS[number];
export type AccountSyncAction = Exclude<
  AccountApiAction,
  'export' | 'delete-prepare' | 'delete-status' | 'delete-finish'
>;
export const ACCOUNT_SYNC_V2_MINIMUM_AGE = 18 as const;

export interface AccountBirthPlaceV1 {
  name: string;
  admin1: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
}

export interface AccountBirthInputV1 {
  date: string;
  time: string | null;
  timeKnown: boolean;
  place: AccountBirthPlaceV1 | null;
}

export interface AccountPositionsV1 {
  b: number[];
  a?: [number, number];
  h: 'w' | 'p';
  v: string;
}

export interface AccountDerivedChartV1 {
  positions: AccountPositionsV1;
  timeKnown: boolean;
  sunSign: SunSign;
  engineVersion: string;
  houseSystem: 'whole' | 'placidus';
}

export interface AccountPrivateChartPayloadV1 extends PrivateChartPayloadV1Input {
  label: string;
  birth: AccountBirthInputV1;
  derived: AccountDerivedChartV1;
}

export interface AccountBootstrapInput {
  action: 'bootstrap';
  deviceId: string;
  platform: 'web';
}

export interface AccountConsentGrantInput {
  action: 'consent';
  purpose: AccountConsentPurpose;
  mutationId: string;
  decision: 'grant';
  policyVersion: string;
}

export interface AccountConsentWithdrawInput {
  action: 'consent';
  purpose: AccountConsentPurpose;
  mutationId: string;
  decision: 'withdraw';
}

export type AccountConsentInput = AccountConsentGrantInput | AccountConsentWithdrawInput;

export interface AccountChartPutInput {
  action: 'chart-put';
  deviceId: string;
  chartId: string;
  baseRevision: number;
  mutationId: string;
  label: string;
  subjectKind: 'self';
  selfAttestation: true;
  birth: AccountBirthInputV1;
  derived: AccountDerivedChartV1;
}

export interface AccountChartDeleteInput {
  action: 'chart-delete';
  deviceId: string;
  chartId: string;
  baseRevision: number;
  mutationId: string;
}

export interface AccountPullInput {
  action: 'pull';
  deviceId: string;
  afterCursor: number;
  limit: number;
}

export interface AccountChartGetInput {
  action: 'chart-get';
  deviceId: string;
  chartId: string;
}

export type AccountSyncInput =
  | AccountBootstrapInput
  | AccountConsentInput
  | AccountChartPutInput
  | AccountChartDeleteInput
  | AccountPullInput
  | AccountChartGetInput;

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function hasExactKeys(input: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(input).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function wellFormed(input: string): boolean {
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function boundedText(input: unknown, maxCharacters: number, maxBytes: number, allowEmpty = false): string | null {
  if (typeof input !== 'string'
    || input !== input.trim()
    || (!allowEmpty && input.length === 0)
    || [...input].length > maxCharacters
    || Buffer.byteLength(input, 'utf8') > maxBytes
    || CONTROL.test(input)
    || !wellFormed(input)) return null;
  return input;
}

function validDate(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(input);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1800 || year > 2199 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? input
    : null;
}

function validTime(input: unknown): string | null {
  return typeof input === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(input) ? input : null;
}

function boundedCoordinate(input: unknown, minimum: number, maximum: number): number | null {
  if (typeof input !== 'number'
    || !Number.isFinite(input)
    || input < minimum
    || input > maximum
    || Math.abs(input * 10_000_000 - Math.round(input * 10_000_000)) > 1e-6) return null;
  return Object.is(input, -0) ? 0 : input;
}

function validTimezone(input: unknown): string | null {
  const timezone = boundedText(input, 128, MAX_TIMEZONE_BYTES);
  if (!timezone || !TIMEZONE.test(timezone)) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
    return timezone;
  } catch {
    return null;
  }
}

function parsePlace(input: unknown): AccountBirthPlaceV1 | null | undefined {
  if (input === null) return null;
  if (!isRecord(input) || !hasExactKeys(input, ['name', 'admin1', 'country', 'lat', 'lon', 'tz'])) {
    return undefined;
  }
  const name = boundedText(input.name, 160, 320);
  const admin1 = boundedText(input.admin1, 120, 240, true);
  const country = boundedText(input.country, 120, 240, true);
  const lat = boundedCoordinate(input.lat, -90, 90);
  const lon = boundedCoordinate(input.lon, -180, 180);
  const tz = validTimezone(input.tz);
  return name !== null && admin1 !== null && country !== null && lat !== null && lon !== null && tz
    ? { name, admin1, country, lat, lon, tz }
    : undefined;
}

export function parseAccountBirthInput(input: unknown): AccountBirthInputV1 | null {
  if (!isRecord(input) || !hasExactKeys(input, ['date', 'time', 'timeKnown', 'place'])) return null;
  const date = validDate(input.date);
  const timeKnown = input.timeKnown;
  const time = input.time === null ? null : validTime(input.time);
  const place = parsePlace(input.place);
  if (!date
    || typeof timeKnown !== 'boolean'
    || place === undefined
    || (timeKnown && time === null)
    || (!timeKnown && input.time !== null)) return null;
  return { date, time, timeKnown, place };
}

function longitude(input: unknown): number | null {
  if (typeof input !== 'number'
    || !Number.isFinite(input)
    || input < 0
    || input >= 360
    || Math.abs(input * 1_000 - Math.round(input * 1_000)) > 1e-8) return null;
  return Object.is(input, -0) ? 0 : input;
}

function parsePositions(input: unknown, timeKnown: boolean): AccountPositionsV1 | null {
  if (!isRecord(input)) return null;
  const expected = timeKnown ? ['a', 'b', 'h', 'v'] : ['b', 'h', 'v'];
  if (!hasExactKeys(input, expected)
    || !Array.isArray(input.b)
    || input.b.length !== 12
    || (input.h !== 'w' && input.h !== 'p')
    || typeof input.v !== 'string'
    || Buffer.byteLength(input.v, 'utf8') > MAX_ENGINE_VERSION_BYTES
    || !ENGINE_VERSION.test(input.v)
    || Buffer.byteLength(JSON.stringify(input), 'utf8') > MAX_POSITIONS_BYTES) return null;
  const bodies = input.b.map(longitude);
  if (bodies.some((value) => value === null)) return null;
  if (!timeKnown) return { b: bodies as number[], h: input.h, v: input.v };
  if (!Array.isArray(input.a) || input.a.length !== 2) return null;
  const angles = input.a.map(longitude);
  return angles.some((value) => value === null)
    ? null
    : { b: bodies as number[], a: angles as [number, number], h: input.h, v: input.v };
}

function parseDerived(input: unknown, birth: AccountBirthInputV1): AccountDerivedChartV1 | null {
  if (!isRecord(input)
    || !hasExactKeys(input, ['positions', 'timeKnown', 'sunSign', 'engineVersion', 'houseSystem'])
    || input.timeKnown !== birth.timeKnown
    || (input.houseSystem !== 'whole' && input.houseSystem !== 'placidus')
    || typeof input.sunSign !== 'string'
    || !SUN_SIGNS.includes(input.sunSign as SunSign)
    || typeof input.engineVersion !== 'string'
    || Buffer.byteLength(input.engineVersion, 'utf8') > MAX_ENGINE_VERSION_BYTES
    || !ENGINE_VERSION.test(input.engineVersion)) return null;
  const positions = parsePositions(input.positions, birth.timeKnown);
  if (!positions
    || positions.v !== input.engineVersion
    || positions.h !== (input.houseSystem === 'whole' ? 'w' : 'p')
    || SUN_SIGNS[Math.floor(positions.b[0]! / 30)] !== input.sunSign) return null;
  return {
    positions,
    timeKnown: birth.timeKnown,
    sunSign: input.sunSign as SunSign,
    engineVersion: input.engineVersion,
    houseSystem: input.houseSystem,
  };
}

export function parseAccountDerivedChart(
  input: unknown,
  birth: AccountBirthInputV1,
): AccountDerivedChartV1 | null {
  return parseDerived(input, birth);
}

export function parseAccountChartLabel(input: unknown): string | null {
  return boundedText(input, 120, MAX_LABEL_BYTES);
}

function safeCounter(input: unknown, maximum = MAX_REVISION): number | null {
  return Number.isSafeInteger(input) && (input as number) >= 0 && (input as number) <= maximum
    ? input as number
    : null;
}

function parseJsonBody(req: any): Record<string, unknown> | null {
  const mediaType = accountRequestHeader(req, 'content-type').split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') return null;
  const rawLength = accountRequestHeader(req, 'content-length').trim();
  if (rawLength) {
    if (!/^\d{1,6}$/u.test(rawLength)) return null;
    const length = Number(rawLength);
    if (length < 1 || length > MAX_BODY_BYTES) return null;
  }
  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return null;
    try {
      body = JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  } else {
    try {
      if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) return null;
    } catch {
      return null;
    }
  }
  return isRecord(body) ? body : null;
}

export function parseAccountSyncInput(action: AccountSyncAction, req: any): AccountSyncInput | null {
  const body = parseJsonBody(req);
  if (!body) return null;

  if (action === 'bootstrap') {
    return hasExactKeys(body, ['deviceId', 'platform'])
      && isAccountUuid(body.deviceId)
      && body.platform === 'web'
      ? { action, deviceId: body.deviceId.toLowerCase(), platform: 'web' }
      : null;
  }
  if (action === 'consent') {
    if (!isAccountUuid(body.mutationId)) return null;
    // A body without a purpose is the original chart_sync shape. Only the
    // two launched purposes may be named; anything else is refused.
    const hasPurpose = Object.prototype.hasOwnProperty.call(body, 'purpose');
    if (hasPurpose && body.purpose !== 'chart_sync' && body.purpose !== 'chart_emails') return null;
    const purpose: AccountConsentPurpose = body.purpose === 'chart_emails' ? 'chart_emails' : 'chart_sync';
    const base = hasPurpose ? ['mutationId', 'decision', 'purpose'] : ['mutationId', 'decision'];
    if (body.decision === 'grant') {
      const policyVersion = accountConsentPolicyVersion(purpose);
      return hasExactKeys(body, [...base, 'policyVersion'])
        && body.policyVersion === policyVersion
        ? {
            action,
            purpose,
            mutationId: body.mutationId.toLowerCase(),
            decision: 'grant',
            policyVersion,
          }
        : null;
    }
    if (body.decision !== 'withdraw') return null;
    const exactCurrentShape = hasExactKeys(body, base);
    const staleCompatibleShape = hasExactKeys(body, [...base, 'policyVersion'])
      && boundedText(body.policyVersion, 64, MAX_POLICY_VERSION_BYTES) !== null;
    // Withdrawal accepts a legacy policy field but normalizes it away; consent
    // withdrawal authority never depends on a client policy version.
    return exactCurrentShape || staleCompatibleShape
      ? { action, purpose, mutationId: body.mutationId.toLowerCase(), decision: 'withdraw' }
      : null;
  }
  if (action === 'chart-put') {
    if (!hasExactKeys(body, [
      'deviceId', 'chartId', 'baseRevision', 'mutationId', 'label', 'subjectKind', 'selfAttestation',
      'birth', 'derived',
    ])
      || !isAccountUuid(body.deviceId)
      || !isAccountUuid(body.chartId)
      || !isAccountUuid(body.mutationId)
      || body.subjectKind !== 'self'
      || body.selfAttestation !== true) return null;
    const baseRevision = safeCounter(body.baseRevision);
    const label = boundedText(body.label, 120, MAX_LABEL_BYTES);
    const birth = parseAccountBirthInput(body.birth);
    const derived = birth ? parseDerived(body.derived, birth) : null;
    return baseRevision !== null && label && birth && derived
      ? {
          action,
          deviceId: body.deviceId.toLowerCase(),
          chartId: body.chartId.toLowerCase(),
          baseRevision,
          mutationId: body.mutationId.toLowerCase(),
          label,
          subjectKind: 'self',
          selfAttestation: true,
          birth,
          derived,
        }
      : null;
  }
  if (action === 'chart-delete') {
    const baseRevision = safeCounter(body.baseRevision);
    return hasExactKeys(body, ['deviceId', 'chartId', 'baseRevision', 'mutationId'])
      && isAccountUuid(body.deviceId)
      && isAccountUuid(body.chartId)
      && isAccountUuid(body.mutationId)
      && baseRevision !== null
      ? {
          action,
          deviceId: body.deviceId.toLowerCase(),
          chartId: body.chartId.toLowerCase(),
          baseRevision,
          mutationId: body.mutationId.toLowerCase(),
        }
      : null;
  }
  if (action === 'pull') {
    const keys = Object.keys(body).sort().join(',');
    if (keys !== 'afterCursor,deviceId' && keys !== 'afterCursor,deviceId,limit') return null;
    const afterCursor = safeCounter(body.afterCursor, Number.MAX_SAFE_INTEGER);
    const limit = body.limit === undefined ? 100 : safeCounter(body.limit, 200);
    return isAccountUuid(body.deviceId)
      && afterCursor !== null
      && limit !== null
      && limit >= 1
      ? { action, deviceId: body.deviceId.toLowerCase(), afterCursor, limit }
      : null;
  }
  if (action === 'chart-get') {
    return hasExactKeys(body, ['deviceId', 'chartId'])
      && isAccountUuid(body.deviceId)
      && isAccountUuid(body.chartId)
      ? { action, deviceId: body.deviceId.toLowerCase(), chartId: body.chartId.toLowerCase() }
      : null;
  }
  return null;
}

/** UTC calendar-age gate for remote chart storage; local charts are unaffected. */
export function isAdultAccountBirthDate(
  birthDate: string,
  nowMs: number,
  minimumAge = ACCOUNT_SYNC_V2_MINIMUM_AGE,
): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(birthDate);
  if (!match || !Number.isFinite(nowMs) || !Number.isSafeInteger(minimumAge) || minimumAge < 1) {
    return false;
  }
  const now = new Date(nowMs);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() + 1 < month
    || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)) age -= 1;
  return age >= minimumAge;
}

export function serializeAccountPrivateChartPayload(input: AccountPrivateChartPayloadV1): string {
  return serializePrivateChartPayloadV1(input);
}

export function parseSerializedAccountPrivateChartPayload(
  input: string,
): AccountPrivateChartPayloadV1 | null {
  if (Buffer.byteLength(input, 'utf8') > 16 * 1024) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)
    || !hasExactKeys(parsed, ['schema', 'label', 'birth', 'derived'])
    || parsed.schema !== 'zodiacs.account.private-chart.v1') return null;
  const label = parseAccountChartLabel(parsed.label);
  const birth = parseAccountBirthInput(parsed.birth);
  const derived = birth ? parseAccountDerivedChart(parsed.derived, birth) : null;
  return label && birth && derived ? { label, birth, derived } : null;
}
