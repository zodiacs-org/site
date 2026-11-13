/**
 * The account export's checks for saved pages and Living Chart moments, in
 * TypeScript, mirroring the tables' own constraints:
 *
 * - public.saved_pages: saved_pages_title, saved_pages_href,
 *   saved_pages_kind_path, saved_pages_source and saved_pages_assistant_detail
 *   (20261015090000, 20261015150000).
 * - public.living_chart_moments: living_chart_moments_payload_check, that is
 *   living_chart_private.living_chart_payload_valid and its date, instant and
 *   text helpers (20260818112526).
 *
 * A row outside these shapes makes the export fail closed. The checks are
 * never stricter than the database: where PostgreSQL's character classes
 * depend on the server's locale (saved_pages' [[:cntrl:]] and [[:space:]]),
 * only the ASCII members are checked here, so a row the database accepted
 * always exports. Lengths count code points, as char_length() does.
 */

type JsonRecord = Record<string, unknown>;

function isRecord(input: unknown): input is JsonRecord {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function codePoints(input: string): number {
  return Array.from(input).length;
}

function utf8Bytes(input: string): number {
  return new TextEncoder().encode(input).byteLength;
}

/**
 * octet_length(value::text) for a jsonb value: jsonb prints ": " between a
 * key and its value and ", " between members, so it is one byte longer per
 * separator than compact JSON.
 */
export function jsonbTextBytes(value: unknown): number {
  if (typeof value === 'string') return utf8Bytes(JSON.stringify(value));
  if (Array.isArray(value)) {
    if (value.length === 0) return 2;
    return 2 + value.reduce<number>((sum, item) => sum + jsonbTextBytes(item), 0) + 2 * (value.length - 1);
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return 2;
    return 2
      + entries.reduce((sum, [key, item]) => sum + utf8Bytes(JSON.stringify(key)) + 2 + jsonbTextBytes(item), 0)
      + 2 * (entries.length - 1);
  }
  return utf8Bytes(JSON.stringify(value) ?? 'null');
}

// ---------------------------------------------------------------------------
// public.saved_pages

const ASCII_CONTROL = /[\u0000-\u001f\u007f]/u;
const ASCII_SPACE_CONTROL_BACKSLASH = /[\u0000- \u007f\\]/u;
const SAVED_PAGE_KIND_PATH: Record<string, RegExp> = {
  compatibility: /^\/([a-z]{2}\/)?compatibility\//u,
  occasion: /^\/occasions\//u,
  chart: /^\/(birth-chart|people)\//u,
  week: /^\/horoscopes\//u,
};

export function savedPageTitleValid(input: unknown): input is string {
  return typeof input === 'string'
    && codePoints(input) >= 1
    && codePoints(input) <= 160
    && !ASCII_CONTROL.test(input);
}

export function savedPageHrefValid(input: unknown, kind: unknown): input is string {
  return typeof input === 'string'
    && typeof kind === 'string'
    && codePoints(input) >= 2
    && codePoints(input) <= 2048
    && /^\/[^/\\]/u.test(input)
    && !ASCII_SPACE_CONTROL_BACKSLASH.test(input)
    && Object.hasOwn(SAVED_PAGE_KIND_PATH, kind)
    && SAVED_PAGE_KIND_PATH[kind].test(input);
}

export function savedPageSummaryValid(input: unknown): input is string {
  return typeof input === 'string'
    && codePoints(input) >= 1
    && codePoints(input) <= 600
    && !ASCII_CONTROL.test(input)
    && !/[<>]/u.test(input);
}

export function savedPageDetailValid(input: unknown): input is JsonRecord {
  return isRecord(input)
    && input.schema === 'zodiacs.assistant-save.v1'
    && jsonbTextBytes(input) <= 16384;
}

/** saved_pages_source: which kinds each source may hold. */
export function savedPageSourceKindValid(source: unknown, kind: unknown): boolean {
  if (source === 'site') return kind === 'compatibility' || kind === 'occasion';
  if (source === 'assistant') return typeof kind === 'string' && Object.hasOwn(SAVED_PAGE_KIND_PATH, kind);
  return false;
}

// ---------------------------------------------------------------------------
// public.living_chart_moments payload

const UUID_LOWER = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const TOKEN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const GENERATOR_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u;
const DATE = /^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])$/u;
const INSTANT = /^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$/u;
const PAYLOAD_KEYS = [
  'schema', 'primaryChartId', 'occurredAt', 'timePrecision',
  'category', 'note', 'forecast', 'reflectionQuestionId',
];
const PAYLOAD_REQUIRED = [
  'schema', 'primaryChartId', 'occurredAt', 'timePrecision', 'forecast', 'reflectionQuestionId',
];
const FORECAST_KEYS = [
  'schema', 'editionDate', 'chartId', 'source', 'generatorVersion', 'capturedAt', 'lines',
];
const LINE_KEYS = ['id', 'text', 'receipt'];
const CATEGORIES = new Set(['work', 'relationships', 'home', 'creativity', 'change', 'wellbeing', 'other']);

function hasKeys(input: JsonRecord, required: readonly string[], allowed: readonly string[]): boolean {
  return required.every((key) => Object.hasOwn(input, key))
    && Object.keys(input).every((key) => allowed.includes(key));
}

/** living_chart_private.living_chart_valid_date */
function validDate(input: unknown): boolean {
  if (typeof input !== 'string' || !DATE.test(input)) return false;
  const year = Number(input.slice(0, 4));
  const month = Number(input.slice(5, 7));
  const day = Number(input.slice(8, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    && year >= 1800
    && year <= 2199;
}

/** living_chart_private.living_chart_valid_instant */
function validInstant(input: unknown): boolean {
  return typeof input === 'string' && INSTANT.test(input) && validDate(input.slice(0, 10));
}

function edgeWhitespace(point: number): boolean {
  return (point >= 9 && point <= 13)
    || [32, 160, 5760, 8232, 8233, 8239, 8287, 12288, 65279].includes(point)
    || (point >= 8192 && point <= 8202);
}

function formatOrControl(point: number, allowNoteWhitespace: boolean): boolean {
  return (point <= 31 && !(allowNoteWhitespace && (point === 9 || point === 10)))
    || (point >= 127 && point <= 159)
    || point === 173
    || (point >= 1536 && point <= 1541)
    || [1564, 1757, 1807, 2274, 6158, 65279, 69821, 69837, 917505].includes(point)
    || (point >= 2192 && point <= 2193)
    || (point >= 8203 && point <= 8207)
    || (point >= 8234 && point <= 8238)
    || (point >= 8288 && point <= 8292)
    || (point >= 8294 && point <= 8303)
    || (point >= 65529 && point <= 65531)
    || (point >= 78896 && point <= 78911)
    || (point >= 113824 && point <= 113827)
    || (point >= 119155 && point <= 119162)
    || (point >= 917536 && point <= 917631);
}

/** living_chart_private.living_chart_text_safe */
function textSafe(input: string, allowNoteWhitespace: boolean): boolean {
  const points = Array.from(input, (character) => character.codePointAt(0) as number);
  return points.every((point, index) => !(
    ((index === 0 || index === points.length - 1) && edgeWhitespace(point))
    || formatOrControl(point, allowNoteWhitespace)
  ));
}

/** btrim() with no characters given trims spaces only. */
function spaceTrimmed(input: string): boolean {
  return !input.startsWith(' ') && !input.endsWith(' ');
}

function boundedLine(input: unknown, maxPoints: number, maxBytes: number): boolean {
  return typeof input === 'string'
    && spaceTrimmed(input)
    && codePoints(input) >= 1
    && codePoints(input) <= maxPoints
    && utf8Bytes(input) <= maxBytes
    && textSafe(input, false);
}

/** living_chart_private.living_chart_payload_valid */
export function livingChartPayloadValid(payload: unknown): payload is JsonRecord {
  if (!isRecord(payload)
    || jsonbTextBytes(payload) > 32768
    || payload.schema !== 'zodiacs.living-chart.cloud-moment.v1'
    || !hasKeys(payload, PAYLOAD_REQUIRED, PAYLOAD_KEYS)
    || typeof payload.primaryChartId !== 'string'
    || !UUID_LOWER.test(payload.primaryChartId)
    || typeof payload.occurredAt !== 'string'
    || typeof payload.reflectionQuestionId !== 'string'
    || !TOKEN_ID.test(payload.reflectionQuestionId)) return false;

  const precision = payload.timePrecision;
  if (precision !== 'exact' && precision !== 'approximate' && precision !== 'date_only') return false;
  if (precision === 'date_only' ? !validDate(payload.occurredAt) : !validInstant(payload.occurredAt)) return false;

  const hasCategory = Object.hasOwn(payload, 'category');
  const hasNote = Object.hasOwn(payload, 'note');
  if (!hasCategory && !hasNote) return false;
  if (hasCategory && (typeof payload.category !== 'string' || !CATEGORIES.has(payload.category))) return false;
  if (hasNote) {
    const note = payload.note;
    if (typeof note !== 'string'
      || !spaceTrimmed(note)
      || codePoints(note) < 1
      || codePoints(note) > 500
      || utf8Bytes(note) > 2000
      || !textSafe(note, true)) return false;
  }

  const forecast = payload.forecast;
  if (!isRecord(forecast)
    || !hasKeys(forecast, FORECAST_KEYS, FORECAST_KEYS)
    || forecast.schema !== 'zodiacs.living-chart.today-forecast.v1'
    || forecast.chartId !== payload.primaryChartId
    || !validDate(forecast.editionDate)
    || (forecast.source !== 'personalized' && forecast.source !== 'sun_sign' && forecast.source !== 'quiet')
    || typeof forecast.generatorVersion !== 'string'
    || !GENERATOR_VERSION.test(forecast.generatorVersion)
    || !validInstant(forecast.capturedAt)
    || !Array.isArray(forecast.lines)
    || forecast.lines.length < 1
    || forecast.lines.length > 3) return false;

  const ids = new Set<string>();
  for (const line of forecast.lines) {
    if (!isRecord(line)
      || !hasKeys(line, LINE_KEYS, LINE_KEYS)
      || typeof line.id !== 'string'
      || !TOKEN_ID.test(line.id)
      || !boundedLine(line.text, 1200, 4800)
      || !boundedLine(line.receipt, 800, 3200)) return false;
    ids.add(line.id);
  }
  return ids.size === forecast.lines.length;
}
