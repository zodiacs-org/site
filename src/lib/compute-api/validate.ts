/**
 * Strict request validation. Each endpoint's body is a JSON object whose
 * fields are all named here; an unknown field, a wrong type, an impossible
 * date or a value out of range is refused with `invalid-request`, a pointer
 * to the field and a fixed sentence. Budgets are checked after the shape, so
 * a refused budget always concerns a request that is otherwise valid.
 *
 * The JSON Schemas in schemas.ts describe the same rules for readers and
 * tools; tests/api/compute-api-openapi.test.ts holds the two together. A few
 * rules no JSON Schema can state (a real calendar date, a time zone the
 * server's Intl data knows) are enforced here only.
 */
import { HOUSE_SYSTEMS, type HouseSystem } from '@zodiacs/engine';
import { parseCivilDate, parseCivilTime } from '../time/civil-date.js';
import {
  BUDGETS,
  EPOCH,
  EVENT_BODIES,
  EVENT_KINDS,
  PHASE_NAMES,
  POSITION_BODIES,
  SIGN_SLUGS,
  SKY_FACT_KINDS,
  type EventBody,
  type EventKind,
  type PhaseName,
  type PositionBody,
  type SignSlug,
} from './constants.js';
import { budgetExhausted, invalidRequest } from './errors.js';

export interface LocalInput {
  date: string;
  time: string;
  zone: string;
}

export interface PlaceInstantRequest {
  /** Set for a `utc` request; null for a `local` one until it is resolved. */
  utc: Date | null;
  /** The instant exactly as the request wrote it, for the receipt. */
  sourceInstant: string | null;
  local: LocalInput | null;
  latitude: number;
  longitude: number;
  houseSystem: HouseSystem;
}

export interface PositionsRequest {
  instants: Date[];
  bodies: PositionBody[] | null;
}

export interface EventsRequest {
  from: Date;
  to: Date;
  bodies: EventBody[];
  kinds: EventKind[];
}

export interface TimeRequest {
  local: LocalInput;
  longitude: number | null;
}

export interface FactDay {
  date: string;
  zone: string | null;
}

export type FactWhen = { instant: Date } | FactDay;

export type SkyFactRequest =
  | { kind: 'sign'; body: EventBody; sign: SignSlug; when: FactWhen }
  | { kind: 'retrograde'; body: EventBody; when: FactWhen }
  | { kind: 'ingress'; body: EventBody; sign: SignSlug; day: FactDay }
  | { kind: 'phase'; phase: PhaseName; day: FactDay };

type JsonObject = Record<string, unknown>;

const TEXT = Object.freeze({
  body: 'The body must be a JSON object.',
  object: 'Must be a JSON object.',
  unknownField: 'This object has a field this endpoint does not accept.',
  required: 'This field is required.',
  string: 'Must be a string.',
  array: 'Must be a non-empty array.',
  distinct: 'Must not repeat a value.',
  utcOrLocal: 'Give exactly one of utc and local.',
  instantFormat: 'Must be an ISO 8601 instant with Z or a numeric offset, such as 2001-02-03T04:05:06Z.',
  instantCalendar: 'Must name a real calendar date and a time from 00:00:00 to 23:59:59; leap seconds are not accepted.',
  instantOffset: 'The offset must be from -14:00 to +14:00.',
  instantRange: `Must fall from ${EPOCH.from} to ${EPOCH.to}.`,
  date: `Must be a real date written YYYY-MM-DD, from ${EPOCH.firstYear}-01-01 to ${EPOCH.lastYear}-12-31.`,
  time: 'Must be a time written HH:MM, from 00:00 to 23:59.',
  zoneFormat: 'Must be an IANA time zone name, such as Europe/Paris.',
  zoneUnknown: 'Must be a time zone name the server\'s time zone data includes.',
  latitude: 'Must be a number greater than -90 and less than 90; the engine does not compute angles at the poles.',
  longitude: 'Must be a number from -180 to 180.',
  houseSystem: `Must be one of the engine's house systems: ${HOUSE_SYSTEMS.join(', ')}.`,
  positionBody: `Each must be one of: ${POSITION_BODIES.join(', ')}.`,
  eventBody: `Must be one of: ${EVENT_BODIES.join(', ')}.`,
  eventBodies: `Each must be one of: ${EVENT_BODIES.join(', ')}.`,
  eventKinds: `Each must be one of: ${EVENT_KINDS.join(', ')}.`,
  window: 'Must be later than from.',
  factKind: `Must be one of: ${SKY_FACT_KINDS.join(', ')}.`,
  sign: `Must be a sign in lowercase: ${SIGN_SLUGS.join(', ')}.`,
  phase: `Must be one of: ${PHASE_NAMES.join(', ')}.`,
  instantOrDate: 'Give exactly one of instant and date.',
  zoneNeedsDate: 'A zone goes with a date, not with an instant.',
});

const ZONE_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/u;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/u;
const EPOCH_FROM = Date.parse(EPOCH.from);
const EPOCH_TO = Date.parse(EPOCH.to);
const FIRST_DATE = `${EPOCH.firstYear}-01-01`;
const LAST_DATE = `${EPOCH.lastYear}-12-31`;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function child(pointer: string, key: string | number): string {
  return `${pointer}/${key}`;
}

function has(object: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/** Refuses a field the endpoint does not name, pointing at the object that holds it. */
function onlyFields(object: JsonObject, allowed: readonly string[], pointer: string): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) throw invalidRequest(pointer, TEXT.unknownField);
  }
}

function objectAt(value: unknown, pointer: string, message: string = TEXT.object): JsonObject {
  if (!isObject(value)) throw invalidRequest(pointer, message);
  return value;
}

function required(object: JsonObject, key: string, pointer: string): unknown {
  if (!has(object, key)) throw invalidRequest(child(pointer, key), TEXT.required);
  return object[key];
}

function stringAt(value: unknown, pointer: string): string {
  if (typeof value !== 'string') throw invalidRequest(pointer, TEXT.string);
  return value;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** An ISO 8601 instant with an explicit zone designator, inside the API's epoch. */
export function instantAt(value: unknown, pointer: string): { date: Date; source: string } {
  const text = stringAt(value, pointer);
  const match = text.length <= 29 ? INSTANT.exec(text) : null;
  if (!match) throw invalidRequest(pointer, TEXT.instantFormat);
  const [, y, mo, d, h, mi, s, , zone] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)
    || Number(h) > 23 || Number(mi) > 59 || (s !== undefined && Number(s) > 59)) {
    throw invalidRequest(pointer, TEXT.instantCalendar);
  }
  if (zone !== 'Z') {
    const hours = Number(zone.slice(1, 3));
    const minutes = Number(zone.slice(4, 6));
    if (minutes > 59 || hours * 60 + minutes > 14 * 60) throw invalidRequest(pointer, TEXT.instantOffset);
  }
  const ms = Date.parse(text);
  if (!Number.isFinite(ms) || ms < EPOCH_FROM || ms > EPOCH_TO) throw invalidRequest(pointer, TEXT.instantRange);
  return { date: new Date(ms), source: text };
}

/** A proleptic Gregorian date inside the API's years, as the site's resolver parses it. */
export function dateAt(value: unknown, pointer: string): string {
  const text = stringAt(value, pointer);
  if (!parseCivilDate(text) || text < FIRST_DATE || text > LAST_DATE) throw invalidRequest(pointer, TEXT.date);
  return text;
}

function timeAt(value: unknown, pointer: string): string {
  const text = stringAt(value, pointer);
  if (!parseCivilTime(text)) throw invalidRequest(pointer, TEXT.time);
  return text;
}

/**
 * Whether the runtime's Intl data knows the zone. Asked afresh each time: this
 * module keeps nothing from one request for the next.
 */
function zoneKnown(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function zoneAt(value: unknown, pointer: string): string {
  const text = stringAt(value, pointer);
  if (text.length > 64 || !ZONE_NAME.test(text)) throw invalidRequest(pointer, TEXT.zoneFormat);
  if (!zoneKnown(text)) throw invalidRequest(pointer, TEXT.zoneUnknown);
  return text;
}

function localAt(value: unknown, pointer: string): LocalInput {
  const object = objectAt(value, pointer);
  onlyFields(object, ['date', 'time', 'zone'], pointer);
  return {
    date: dateAt(required(object, 'date', pointer), child(pointer, 'date')),
    time: timeAt(required(object, 'time', pointer), child(pointer, 'time')),
    zone: zoneAt(required(object, 'zone', pointer), child(pointer, 'zone')),
  };
}

function latitudeAt(value: unknown, pointer: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= -90 || value >= 90) {
    throw invalidRequest(pointer, TEXT.latitude);
  }
  return value;
}

function longitudeAt(value: unknown, pointer: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -180 || value > 180) {
    throw invalidRequest(pointer, TEXT.longitude);
  }
  return value;
}

function oneOf<T extends string>(value: unknown, pointer: string, allowed: readonly T[], message: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw invalidRequest(pointer, message);
  return value as T;
}

function distinctList<T extends string>(value: unknown, pointer: string, allowed: readonly T[], message: string): T[] {
  if (!Array.isArray(value) || value.length === 0) throw invalidRequest(pointer, TEXT.array);
  const seen = new Set<T>();
  value.forEach((item, index) => {
    const name = oneOf(item, child(pointer, index), allowed, message);
    if (seen.has(name)) throw invalidRequest(child(pointer, index), TEXT.distinct);
    seen.add(name);
  });
  return [...seen];
}

function bodyObject(value: unknown): JsonObject {
  return objectAt(value, '', TEXT.body);
}

/** chart and houses: an instant given as utc or as local time, a place and a house system. */
export function parsePlaceInstantRequest(value: unknown): PlaceInstantRequest {
  const object = bodyObject(value);
  onlyFields(object, ['utc', 'local', 'latitude', 'longitude', 'houseSystem'], '');
  if (has(object, 'utc') === has(object, 'local')) throw invalidRequest('', TEXT.utcOrLocal);
  const instant = has(object, 'utc') ? instantAt(object.utc, '/utc') : null;
  const local = has(object, 'local') ? localAt(object.local, '/local') : null;
  const latitude = latitudeAt(required(object, 'latitude', ''), '/latitude');
  const longitude = longitudeAt(required(object, 'longitude', ''), '/longitude');
  const houseSystem = has(object, 'houseSystem')
    ? oneOf(object.houseSystem, '/houseSystem', HOUSE_SYSTEMS as readonly HouseSystem[], TEXT.houseSystem)
    : 'placidus';
  return {
    utc: instant?.date ?? null,
    sourceInstant: instant?.source ?? null,
    local,
    latitude,
    longitude,
    houseSystem,
  };
}

export function parsePositionsRequest(value: unknown): PositionsRequest {
  const object = bodyObject(value);
  onlyFields(object, ['instants', 'bodies'], '');
  const list = required(object, 'instants', '');
  if (!Array.isArray(list) || list.length === 0) throw invalidRequest('/instants', TEXT.array);
  const instants = list.map((item, index) => instantAt(item, child('/instants', index)).date);
  const bodies = has(object, 'bodies')
    ? distinctList(object.bodies, '/bodies', POSITION_BODIES, TEXT.positionBody)
    : null;
  if (instants.length > BUDGETS['positions.instants']) throw budgetExhausted('positions.instants');
  return { instants, bodies };
}

const DAY_MS = 86_400_000;

export function parseEventsRequest(value: unknown): EventsRequest {
  const object = bodyObject(value);
  onlyFields(object, ['from', 'to', 'bodies', 'kinds'], '');
  const from = instantAt(required(object, 'from', ''), '/from').date;
  const to = instantAt(required(object, 'to', ''), '/to').date;
  if (to.getTime() <= from.getTime()) throw invalidRequest('/to', TEXT.window);
  const bodies = has(object, 'bodies')
    ? distinctList(object.bodies, '/bodies', EVENT_BODIES, TEXT.eventBodies)
    : [...EVENT_BODIES];
  const kinds = has(object, 'kinds')
    ? distinctList(object.kinds, '/kinds', EVENT_KINDS, TEXT.eventKinds)
    : [...EVENT_KINDS];
  if (to.getTime() - from.getTime() > BUDGETS['events.windowDays'] * DAY_MS) throw budgetExhausted('events.windowDays');
  return {
    from,
    to,
    bodies: EVENT_BODIES.filter((body) => bodies.includes(body)),
    kinds: EVENT_KINDS.filter((kind) => kinds.includes(kind)),
  };
}

export function parseTimeRequest(value: unknown): TimeRequest {
  const object = bodyObject(value);
  onlyFields(object, ['local', 'longitude'], '');
  const local = localAt(required(object, 'local', ''), '/local');
  const longitude = has(object, 'longitude') ? longitudeAt(object.longitude, '/longitude') : null;
  return { local, longitude };
}

function factDay(object: JsonObject): FactDay {
  const date = dateAt(required(object, 'date', ''), '/date');
  const zone = has(object, 'zone') ? zoneAt(object.zone, '/zone') : null;
  return { date, zone };
}

function factWhen(object: JsonObject): FactWhen {
  if (has(object, 'instant') === has(object, 'date')) throw invalidRequest('', TEXT.instantOrDate);
  if (has(object, 'instant')) {
    if (has(object, 'zone')) throw invalidRequest('/zone', TEXT.zoneNeedsDate);
    return { instant: instantAt(object.instant, '/instant').date };
  }
  return factDay(object);
}

export function parseSkyFactRequest(value: unknown): SkyFactRequest {
  const object = bodyObject(value);
  const kind = oneOf(required(object, 'kind', ''), '/kind', SKY_FACT_KINDS, TEXT.factKind);
  switch (kind) {
    case 'sign': {
      onlyFields(object, ['kind', 'body', 'sign', 'instant', 'date', 'zone'], '');
      const body = oneOf(required(object, 'body', ''), '/body', EVENT_BODIES, TEXT.eventBody);
      const sign = oneOf(required(object, 'sign', ''), '/sign', SIGN_SLUGS, TEXT.sign);
      return { kind, body, sign, when: factWhen(object) };
    }
    case 'retrograde': {
      onlyFields(object, ['kind', 'body', 'instant', 'date', 'zone'], '');
      const body = oneOf(required(object, 'body', ''), '/body', EVENT_BODIES, TEXT.eventBody);
      return { kind, body, when: factWhen(object) };
    }
    case 'ingress': {
      onlyFields(object, ['kind', 'body', 'sign', 'date', 'zone'], '');
      const body = oneOf(required(object, 'body', ''), '/body', EVENT_BODIES, TEXT.eventBody);
      const sign = oneOf(required(object, 'sign', ''), '/sign', SIGN_SLUGS, TEXT.sign);
      return { kind, body, sign, day: factDay(object) };
    }
    case 'phase': {
      onlyFields(object, ['kind', 'phase', 'date', 'zone'], '');
      const phase = oneOf(required(object, 'phase', ''), '/phase', PHASE_NAMES, TEXT.phase);
      return { kind, phase, day: factDay(object) };
    }
  }
}

/** The fixed sentences above, for the documentation and the tests. */
export const VALIDATION_MESSAGES = TEXT;
