import constitutionDocument from './editorial-policy/constitution.v1.json';
import {
  HOUSE_THEME,
  dailyBodyFactId,
  dailyEventFactId,
  dailyHeadline,
  dailyHouseFactId,
  dailyReading,
  solarHouse,
  type Daily,
  type DailyEvent,
  type DailyLine,
} from './daily';
import { SIGN_SLUGS, SIGNS } from './signs';

type SignSlug = (typeof SIGNS)[number]['slug'];

export const DAILY_PUBLICATION_SCHEMA = 'zodiacs.daily-publication.v1' as const;
export const DAILY_RENDERER_VERSION = 'zodiacs.daily-renderer.v1.2' as const;

interface PatternRule {
  id: string;
  pattern: string;
  flags: string;
}

interface SurfaceRule {
  minWords: number;
  maxWords: number;
  maxChars: number;
  maxExclamations: number;
  requireSolarHouseScope?: boolean;
}

interface EditorialConstitution {
  schema: string;
  id: string;
  version: string;
  identity: {
    publicName: string;
    authorType: string;
    disclosureUrl: string;
    humanBylineAllowed: boolean;
    aiDisclosureRequired: boolean;
  };
  roles: Array<{
    id: string;
    kind: string;
    mayPublish: boolean;
    veto?: boolean;
    failClosed?: boolean;
  }>;
  generation: {
    allowedModes: string[];
    freeformModelOutputMayPublish: boolean;
    generatorMayApproveOwnOutput: boolean;
  };
  facts: {
    requiredBodies: string[];
    allowedEventKinds: string[];
    requireEvidenceRefs: boolean;
    requireExactDayEvents: boolean;
  };
  surfaces: Record<'daily-hub-headline' | 'daily-reading-line' | 'today-sun-sign-line', SurfaceRule>;
  reading: {
    minLines: number;
    maxLines: number;
    maxLeadingEvents: number;
    dedupeSolarHouses: boolean;
  };
  distinctness: {
    shingleWords: number;
    maxPairwiseJaccard: number;
    maxTodayPairwiseJaccard: number;
    maxReadingPairwiseJaccard: number;
    maxExactDuplicates: number;
  };
  allowedTemplateIds: string[];
  lexicon: { banned: PatternRule[]; unsafe: PatternRule[] };
  provenance: Record<string, unknown>;
  fallback: Record<string, unknown>;
}

const policyRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

/** Runtime schema gate for the machine-readable publication constitution. */
export function validateEditorialConstitution(value: unknown): string[] {
  const errors: string[] = [];
  if (!policyRecord(value)) return ['constitution must be an object'];
  const document = value;
  if (document.schema !== 'zodiacs.editorial-constitution.v1') errors.push('schema must be zodiacs.editorial-constitution.v1');
  for (const key of ['id', 'version', 'purpose']) {
    if (typeof document[key] !== 'string' || !document[key]) errors.push(`${key} must be a non-empty string`);
  }

  const identity = policyRecord(document.identity) ? document.identity : null;
  if (!identity) errors.push('identity must be an object');
  else {
    if (identity.authorType !== 'Organization') errors.push('identity.authorType must be Organization');
    if (identity.humanBylineAllowed !== false) errors.push('identity.humanBylineAllowed must be false');
    if (identity.aiDisclosureRequired !== true) errors.push('identity.aiDisclosureRequired must be true');
    if (typeof identity.disclosureUrl !== 'string' || !identity.disclosureUrl.startsWith('https://zodiacs.org/')) {
      errors.push('identity.disclosureUrl must be a zodiacs.org HTTPS URL');
    }
  }

  const roles = Array.isArray(document.roles) ? document.roles : [];
  if (!Array.isArray(document.roles)) errors.push('roles must be an array');
  const roleIds = roles.filter(policyRecord).map((role) => role.id);
  for (const required of ['facts', 'generator', 'fact-auditor', 'copy-verifier', 'gate']) {
    if (roleIds.filter((id) => id === required).length !== 1) errors.push(`roles must contain ${required} exactly once`);
  }
  const gate = roles.find((role) => policyRecord(role) && role.id === 'gate');
  if (!policyRecord(gate) || gate.mayPublish !== true || gate.failClosed !== true) {
    errors.push('gate must be the fail-closed publishing role');
  }

  const generation = policyRecord(document.generation) ? document.generation : null;
  if (!generation) errors.push('generation must be an object');
  else {
    if (JSON.stringify(generation.allowedModes) !== JSON.stringify(['deterministic-template'])) {
      errors.push('generation.allowedModes must contain only deterministic-template until AI receipts exist');
    }
    if (generation.freeformModelOutputMayPublish !== false) errors.push('free-form model output must not publish');
    if (generation.generatorMayApproveOwnOutput !== false) errors.push('the generator must not approve its own output');
  }

  const facts = policyRecord(document.facts) ? document.facts : null;
  const requiredBodies = ['Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const eventKinds = ['ingress', 'lunation', 'station', 'aspect'];
  if (!facts) errors.push('facts must be an object');
  else {
    if (JSON.stringify(facts.requiredBodies) !== JSON.stringify(requiredBodies)) errors.push('facts.requiredBodies is not canonical');
    if (JSON.stringify(facts.allowedEventKinds) !== JSON.stringify(eventKinds)) errors.push('facts.allowedEventKinds is not canonical');
    if (facts.requireEvidenceRefs !== true || facts.requireExactDayEvents !== true) errors.push('fact evidence and exact-day rules must be enabled');
  }

  const surfaces = policyRecord(document.surfaces) ? document.surfaces : null;
  const surfaceNames = ['daily-hub-headline', 'daily-reading-line', 'today-sun-sign-line'];
  if (!surfaces) errors.push('surfaces must be an object');
  else for (const name of surfaceNames) {
    const rule = policyRecord(surfaces[name]) ? surfaces[name] : null;
    if (!rule) { errors.push(`surfaces.${name} must be an object`); continue; }
    const minWords = rule.minWords;
    const maxWords = rule.maxWords;
    if (!Number.isInteger(minWords) || !Number.isInteger(maxWords)
      || Number(minWords) < 1 || Number(maxWords) < Number(minWords)) errors.push(`surfaces.${name} word bounds are invalid`);
    if (!Number.isInteger(rule.maxChars) || Number(rule.maxChars) < 20) errors.push(`surfaces.${name}.maxChars is invalid`);
    if (!Number.isInteger(rule.maxExclamations) || Number(rule.maxExclamations) < 0) errors.push(`surfaces.${name}.maxExclamations is invalid`);
  }

  const reading = policyRecord(document.reading) ? document.reading : null;
  if (!reading || !Number.isInteger(reading.minLines) || !Number.isInteger(reading.maxLines)
    || Number(reading.minLines) < 1 || Number(reading.maxLines) < Number(reading.minLines)
    || !Number.isInteger(reading.maxLeadingEvents) || reading.dedupeSolarHouses !== true) {
    errors.push('reading bounds/deduplication are invalid');
  }
  const distinctness = policyRecord(document.distinctness) ? document.distinctness : null;
  if (!distinctness || !Number.isInteger(distinctness.shingleWords)
    || Number(distinctness.shingleWords) < 1 || Number(distinctness.shingleWords) > 5
    || typeof distinctness.maxPairwiseJaccard !== 'number'
    || distinctness.maxPairwiseJaccard < 0 || distinctness.maxPairwiseJaccard > 1
    || typeof distinctness.maxTodayPairwiseJaccard !== 'number'
    || distinctness.maxTodayPairwiseJaccard < 0 || distinctness.maxTodayPairwiseJaccard > 1
    || typeof distinctness.maxReadingPairwiseJaccard !== 'number'
    || distinctness.maxReadingPairwiseJaccard < 0 || distinctness.maxReadingPairwiseJaccard > 1
    || distinctness.maxExactDuplicates !== 0) {
    errors.push('distinctness thresholds are invalid');
  }

  const templateIds = Array.isArray(document.allowedTemplateIds) ? document.allowedTemplateIds : [];
  if (!templateIds.length || templateIds.some((id) => typeof id !== 'string' || !id)
    || new Set(templateIds).size !== templateIds.length) errors.push('allowedTemplateIds must be unique non-empty strings');
  const lexicon = policyRecord(document.lexicon) ? document.lexicon : null;
  if (!lexicon) errors.push('lexicon must be an object');
  else for (const family of ['banned', 'unsafe']) {
    const rules = Array.isArray(lexicon[family]) ? lexicon[family] : [];
    if (!Array.isArray(lexicon[family]) || !rules.length) errors.push(`lexicon.${family} must be a non-empty array`);
    for (const [index, candidate] of rules.entries()) {
      if (!policyRecord(candidate) || typeof candidate.id !== 'string'
        || typeof candidate.pattern !== 'string' || typeof candidate.flags !== 'string') {
        errors.push(`lexicon.${family}[${index}] is malformed`);
        continue;
      }
      try { new RegExp(candidate.pattern, candidate.flags); } catch { errors.push(`lexicon.${family}[${index}] has an invalid regular expression`); }
    }
  }
  if (!policyRecord(document.provenance)) errors.push('provenance must be an object');
  if (!policyRecord(document.fallback) || document.fallback.mayBypassGate !== false) errors.push('fallback must exist and may not bypass the gate');
  return errors;
}

const constitutionErrors = validateEditorialConstitution(constitutionDocument);
if (constitutionErrors.length) {
  throw new Error(`Invalid daily editorial constitution:\n- ${constitutionErrors.join('\n- ')}`);
}
export const DAILY_EDITORIAL_CONSTITUTION = constitutionDocument as EditorialConstitution;

const MOON_PHASES = new Set([
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
]);
const CANONICAL_SIGNS = new Set<string>(SIGN_SLUGS);
const CANONICAL_BODIES = new Set<string>(DAILY_EDITORIAL_CONSTITUTION.facts.requiredBodies);
const TRANSIT_BODIES = new Set(
  DAILY_EDITORIAL_CONSTITUTION.facts.requiredBodies.filter((body) => body !== 'Moon'),
);
const STATION_BODIES = new Set(
  DAILY_EDITORIAL_CONSTITUTION.facts.requiredBodies.filter((body) => body !== 'Moon' && body !== 'Sun'),
);
const LUNATION_TYPES = new Set(['new', 'full']);
const STATION_TYPES = new Set(['retrograde', 'direct']);
const ASPECT_TYPES = new Set(['conjunction', 'sextile', 'square', 'trine', 'opposition']);

export interface DailyFactRecord {
  id: string;
  kind: 'body-position' | 'sky-event' | 'solar-house';
  sourceFactId?: string;
  body?: string;
  eventKind?: DailyEvent['kind'];
  sign?: string;
  sunSign?: string;
  house?: number;
  at?: string;
  longitude?: number;
  degree?: number;
  retrograde?: boolean;
  eventType?: string;
  a?: string;
  b?: string;
  aSign?: string;
  aDegree?: number;
  bSign?: string;
  bDegree?: number;
  /** Explicit zero-degree orb for an exact aspect fact. */
  orb?: 0;
}

export interface DailyPublishedSign {
  sign: SignSlug;
  headline: string;
  lines: DailyLine[];
  todayLine: DailyLine;
}

export interface DailyPublication {
  schema: typeof DAILY_PUBLICATION_SCHEMA;
  date: string;
  locale: 'en';
  policy: { id: string; version: string };
  rendererVersion: typeof DAILY_RENDERER_VERSION;
  generation: {
    mode: 'deterministic-template' | 'ai-template-selection';
    generatorId: string;
    model: null | { provider: string; id: string };
  };
  facts: DailyFactRecord[];
  signs: DailyPublishedSign[];
}

export interface EditorialViolation {
  ruleId: string;
  path: string;
  message: string;
}

const violation = (ruleId: string, path: string, message: string): EditorialViolation => ({
  ruleId,
  path,
  message,
});

function todayLineForSign(sunSign: string, daily: Daily): DailyLine {
  const moon = daily.bodies.find((body) => body.body === 'Moon');
  if (!moon) {
    const fallback = dailyReading(sunSign, daily).lines[0];
    return fallback ?? {
      text: 'The sky data for this date is unavailable.',
      receipt: `No Moon position · ${daily.date}`,
      templateId: 'body-house.v1',
      scope: 'solar-house',
      evidenceRefs: [],
    };
  }
  const house = solarHouse(moon.sign, sunSign);
  const sourceFactId = dailyBodyFactId(daily.date, moon);
  return {
    text: `Today may draw more attention to ${HOUSE_THEME[house]}.`,
    receipt: `${moon.body} ${moon.degree.toFixed(1)}° ${moon.sign} · solar house ${house}`,
    house,
    body: 'Moon',
    templateId: 'today-moon-theme.v1',
    scope: 'solar-house',
    evidenceRefs: [sourceFactId, dailyHouseFactId(daily.date, sunSign, sourceFactId, house)],
  };
}

export function sunSignTodayLine(sunSign: string, daily: Daily): string {
  return todayLineForSign(sunSign, daily).text;
}

function factCatalog(daily: Daily, signs: DailyPublishedSign[]): DailyFactRecord[] {
  const facts: DailyFactRecord[] = [];
  const referenced = new Set(
    signs.flatMap((entry) => [...entry.lines, entry.todayLine])
      .flatMap((line) => line.evidenceRefs ?? []),
  );
  for (const body of daily.bodies) {
    const sourceFactId = dailyBodyFactId(daily.date, body);
    facts.push({
      id: sourceFactId,
      kind: 'body-position',
      body: body.body,
      sign: body.sign,
      at: daily.snapshotAt ?? `${daily.date}T12:00:00.000Z`,
      longitude: body.lon,
      degree: body.degree,
      retrograde: body.retrograde,
    });
    for (const sunSign of SIGN_SLUGS) {
      const house = solarHouse(body.sign, sunSign);
      const id = dailyHouseFactId(daily.date, sunSign, sourceFactId, house);
      if (!referenced.has(id)) continue;
      facts.push({
        id,
        kind: 'solar-house',
        sourceFactId,
        body: body.body,
        sign: body.sign,
        sunSign,
        house,
      });
    }
  }
  for (const event of daily.events) {
    const sourceFactId = dailyEventFactId(daily.date, event);
    facts.push({
      id: sourceFactId,
      kind: 'sky-event',
      eventKind: event.kind,
      body: event.planet ?? event.a,
      sign: event.sign,
      at: event.at,
      degree: event.degree,
      retrograde: event.retrograde,
      eventType: event.type,
      a: event.a,
      b: event.b,
      aSign: event.aSign,
      aDegree: event.aDegree,
      bSign: event.bSign,
      bDegree: event.bDegree,
      orb: event.orb,
    });
    if (event.sign) {
      for (const sunSign of SIGN_SLUGS) {
        const house = solarHouse(event.sign, sunSign);
        const id = dailyHouseFactId(daily.date, sunSign, sourceFactId, house);
        if (!referenced.has(id)) continue;
        facts.push({
          id,
          kind: 'solar-house',
          sourceFactId,
          body: event.planet ?? 'Moon',
          sign: event.sign,
          sunSign,
          house,
        });
      }
    }
  }
  return facts.sort((a, b) => a.id.localeCompare(b.id));
}

export function buildDailyPublication(daily: Daily): DailyPublication {
  const signs: DailyPublishedSign[] = SIGN_SLUGS.map((sign) => {
    const reading = dailyReading(sign, daily);
    return {
      sign,
      headline: dailyHeadline(sign, daily),
      lines: reading.lines,
      todayLine: todayLineForSign(sign, daily),
    };
  });
  return {
    schema: DAILY_PUBLICATION_SCHEMA,
    date: daily.date,
    locale: 'en',
    policy: {
      id: DAILY_EDITORIAL_CONSTITUTION.id,
      version: DAILY_EDITORIAL_CONSTITUTION.version,
    },
    rendererVersion: DAILY_RENDERER_VERSION,
    generation: {
      mode: 'deterministic-template',
      generatorId: DAILY_RENDERER_VERSION,
      model: null,
    },
    facts: factCatalog(daily, signs),
    signs,
  };
}

export function publicationForSign(
  publication: DailyPublication,
  sign: string,
): DailyPublishedSign | null {
  return publication.signs.find((entry) => entry.sign === sign) ?? null;
}

function words(text: string): string[] {
  return text.normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu) ?? [];
}

function shingles(text: string, width: number): Set<string> {
  const tokens = words(text);
  if (tokens.length < width) return new Set(tokens.length ? [tokens.join(' ')] : []);
  return new Set(tokens.slice(0, tokens.length - width + 1).map((_, index) => (
    tokens.slice(index, index + width).join(' ')
  )));
}

export function wordShingleJaccard(a: string, b: string, width = 3): number {
  const left = shingles(a, width);
  const right = shingles(b, width);
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function surfaceViolations(
  text: string,
  path: string,
  surface: keyof EditorialConstitution['surfaces'],
): EditorialViolation[] {
  const failures: EditorialViolation[] = [];
  const rule = DAILY_EDITORIAL_CONSTITUTION.surfaces[surface];
  const count = words(text).length;
  if (count < rule.minWords || count > rule.maxWords) {
    failures.push(violation('VOICE-WORDS', path, `${surface} has ${count} words; expected ${rule.minWords}-${rule.maxWords}`));
  }
  if (text.length > rule.maxChars) {
    failures.push(violation('VOICE-CHARS', path, `${surface} has ${text.length} characters; maximum ${rule.maxChars}`));
  }
  const exclamations = (text.match(/!/g) ?? []).length;
  if (exclamations > rule.maxExclamations) {
    failures.push(violation('VOICE-EXCLAMATION', path, `${surface} has ${exclamations} exclamation marks`));
  }
  if (/<[^>]+>/.test(text)) {
    failures.push(violation('VOICE-PLAIN-TEXT', path, `${surface} contains markup`));
  }
  for (const family of ['banned', 'unsafe'] as const) {
    for (const pattern of DAILY_EDITORIAL_CONSTITUTION.lexicon[family]) {
      if (new RegExp(pattern.pattern, pattern.flags).test(text)) {
        failures.push(violation(
          family === 'unsafe' ? `SAFE-${pattern.id}` : `VOICE-${pattern.id}`,
          path,
          `${surface} matches ${pattern.id}`,
        ));
      }
    }
  }
  return failures;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRealUtcDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const canonicalMidnight = `${value}T00:00:00.000Z`;
  const parsed = new Date(canonicalMidnight);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === canonicalMidnight;
}

function isCanonicalIsoInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isDegree(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 30;
}

function requireEventBody(
  value: unknown,
  path: string,
  allowed: Set<string>,
  failures: EditorialViolation[],
): value is string {
  if (typeof value === 'string' && allowed.has(value)) return true;
  failures.push(violation('FACT-EVENT-BODY', path, `unsupported or missing body ${String(value)}`));
  return false;
}

function requireEventSign(
  value: unknown,
  path: string,
  failures: EditorialViolation[],
): value is string {
  if (typeof value === 'string' && CANONICAL_SIGNS.has(value)) return true;
  failures.push(violation('FACT-EVENT-SIGN', path, `unsupported or missing sign ${String(value)}`));
  return false;
}

function requireEventDegree(
  value: unknown,
  path: string,
  failures: EditorialViolation[],
): value is number {
  if (isDegree(value)) return true;
  failures.push(violation('FACT-EVENT-DEGREE', path, `degree must be finite and in [0, 30); found ${String(value)}`));
  return false;
}

export function validateDailyFacts(daily: Daily): EditorialViolation[] {
  const failures: EditorialViolation[] = [];
  if (daily.schema !== 'zodiacs.daily-facts.v1') {
    failures.push(violation('FACT-SCHEMA', 'daily.schema', 'daily facts schema must be zodiacs.daily-facts.v1'));
  }
  const dateIsValid = isRealUtcDate(daily.date);
  if (!dateIsValid) {
    failures.push(violation('FACT-DATE', 'daily.date', `invalid date ${daily.date}`));
  }
  if (daily.snapshotAt !== `${daily.date}T12:00:00.000Z`) {
    failures.push(violation('FACT-SNAPSHOT', 'daily.snapshotAt', 'snapshot must be noon UTC on the edition date'));
  }

  const required = DAILY_EDITORIAL_CONSTITUTION.facts.requiredBodies;
  const bodies = Array.isArray(daily.bodies) ? daily.bodies : [];
  if (!Array.isArray(daily.bodies)) {
    failures.push(violation('FACT-BODIES', 'daily.bodies', 'bodies must be an array'));
  }
  const names = bodies.map((body) => (isRecord(body) ? body.body : undefined));
  if (names.length !== required.length || required.some((name) => names.filter((item) => item === name).length !== 1)) {
    failures.push(violation('FACT-BODIES', 'daily.bodies', `expected each required body exactly once; found ${names.map(String).join(', ')}`));
  }
  if (names.length === required.length && names.some((name, index) => name !== required[index])) {
    failures.push(violation('FACT-BODY-ORDER', 'daily.bodies', 'bodies must use the canonical Moon-to-Pluto order'));
  }
  bodies.forEach((bodyValue, index) => {
    const path = `daily.bodies[${index}]`;
    if (!isRecord(bodyValue)) {
      failures.push(violation('FACT-BODY', path, 'body position must be an object'));
      return;
    }
    const body = bodyValue as unknown as Daily['bodies'][number];
    if (typeof body.body !== 'string' || !CANONICAL_BODIES.has(body.body)) {
      failures.push(violation('FACT-BODY', `${path}.body`, `unsupported body ${String(body.body)}`));
    }
    if (!Number.isFinite(body.lon) || body.lon < 0 || body.lon >= 360) {
      failures.push(violation('FACT-LONGITUDE', `${path}.lon`, `invalid longitude ${body.lon}`));
    }
    if (typeof body.sign !== 'string' || !CANONICAL_SIGNS.has(body.sign)) {
      failures.push(violation('FACT-SIGN', `${path}.sign`, `unsupported sign ${String(body.sign)}`));
    } else if (Number.isFinite(body.lon) && body.lon >= 0 && body.lon < 360) {
      const signIndex = Math.floor(body.lon / 30);
      if (SIGN_SLUGS[signIndex] !== body.sign) {
        failures.push(violation('FACT-SIGN', `${path}.sign`, `${body.sign} disagrees with longitude ${body.lon}`));
      }
    }
    const expectedDegree = Number.isFinite(body.lon) ? body.lon % 30 : Number.NaN;
    if (!isDegree(body.degree) || !Number.isFinite(expectedDegree)
      || Math.abs(expectedDegree - body.degree) > 0.000000001) {
      failures.push(violation('FACT-DEGREE', `${path}.degree`, `${body.degree} disagrees with longitude ${body.lon}`));
    }
    if (typeof body.retrograde !== 'boolean') {
      failures.push(violation('FACT-RETROGRADE', `${path}.retrograde`, 'retrograde flag must be boolean'));
    }
  });

  const moon = isRecord(daily.moon) ? daily.moon : null;
  if (!moon || typeof moon.phase !== 'string' || !MOON_PHASES.has(moon.phase)) {
    failures.push(violation('FACT-MOON-PHASE', 'daily.moon.phase', `unsupported Moon phase ${String(moon?.phase)}`));
  }
  if (!moon || typeof moon.illumination !== 'number' || !Number.isFinite(moon.illumination)
    || moon.illumination < 0 || moon.illumination > 1) {
    failures.push(violation('FACT-MOON-ILLUMINATION', 'daily.moon.illumination', 'Moon illumination must be finite and in [0, 1]'));
  }

  if (!['complete', 'unavailable'].includes(daily.eventsCoverage ?? '')) {
    failures.push(violation('FACT-EVENT-COVERAGE', 'daily.eventsCoverage', 'events coverage must be complete or unavailable'));
  }
  const editionMonth = typeof daily.date === 'string' ? daily.date.slice(0, 7) : '';
  const expectedSource = `src/data/transits-${editionMonth}.json`;
  if (daily.eventsCoverage === 'complete' && daily.eventsSource !== expectedSource) {
    failures.push(violation('FACT-EVENT-SOURCE', 'daily.eventsSource', `complete coverage must name ${expectedSource}`));
  }
  const events = Array.isArray(daily.events) ? daily.events : [];
  if (!Array.isArray(daily.events)) {
    failures.push(violation('FACT-EVENTS', 'daily.events', 'events must be an array'));
  }
  if (daily.eventsCoverage === 'unavailable' && (daily.eventsSource !== null || events.length !== 0)) {
    failures.push(violation('FACT-EVENT-UNAVAILABLE', 'daily.events', 'unavailable coverage must have a null source and no events'));
  }
  let previousAt = '';
  const eventIds = new Set<string>();
  events.forEach((eventValue, index) => {
    const path = `daily.events[${index}]`;
    if (!isRecord(eventValue)) {
      failures.push(violation('FACT-EVENT-SHAPE', path, 'event must be an object'));
      return;
    }
    const event = eventValue as unknown as DailyEvent;
    if (!DAILY_EDITORIAL_CONSTITUTION.facts.allowedEventKinds.includes(event.kind)) {
      failures.push(violation('FACT-EVENT-KIND', `${path}.kind`, `unsupported event kind ${event.kind}`));
    }
    const canonicalInstant = isCanonicalIsoInstant(event.at);
    if (!canonicalInstant) {
      failures.push(violation('FACT-EVENT-INSTANT', `${path}.at`, 'event timestamp must be a canonical ISO UTC instant'));
    } else if (!dateIsValid || event.at.slice(0, 10) !== daily.date) {
      failures.push(violation('FACT-EVENT-DATE', `${path}.at`, `event is not on ${daily.date}`));
    }
    if (canonicalInstant) {
      if (event.at < previousAt) {
        failures.push(violation('FACT-EVENT-ORDER', path, 'events must be sorted by instant'));
      }
      previousAt = event.at;
    }

    if (canonicalInstant && DAILY_EDITORIAL_CONSTITUTION.facts.allowedEventKinds.includes(event.kind)) {
      const eventId = dailyEventFactId(daily.date, event);
      if (eventIds.has(eventId)) {
        failures.push(violation('FACT-EVENT-DUPLICATE-ID', path, `duplicate event fact ID ${eventId}`));
      }
      eventIds.add(eventId);
    }

    if (event.kind === 'ingress') {
      requireEventBody(event.planet, `${path}.planet`, TRANSIT_BODIES, failures);
      requireEventSign(event.sign, `${path}.sign`, failures);
      if (typeof event.retrograde !== 'boolean') {
        failures.push(violation('FACT-EVENT-RETROGRADE', `${path}.retrograde`, 'ingress retrograde flag must be boolean'));
      }
    } else if (event.kind === 'lunation') {
      if (typeof event.type !== 'string' || !LUNATION_TYPES.has(event.type)) {
        failures.push(violation('FACT-EVENT-TYPE', `${path}.type`, `lunation type must be new or full; found ${String(event.type)}`));
      }
      requireEventSign(event.sign, `${path}.sign`, failures);
      requireEventDegree(event.degree, `${path}.degree`, failures);
    } else if (event.kind === 'station') {
      requireEventBody(event.planet, `${path}.planet`, STATION_BODIES, failures);
      if (typeof event.type !== 'string' || !STATION_TYPES.has(event.type)) {
        failures.push(violation('FACT-EVENT-TYPE', `${path}.type`, `station type must be retrograde or direct; found ${String(event.type)}`));
      }
      requireEventSign(event.sign, `${path}.sign`, failures);
      requireEventDegree(event.degree, `${path}.degree`, failures);
    } else if (event.kind === 'aspect') {
      const aIsValid = requireEventBody(event.a, `${path}.a`, TRANSIT_BODIES, failures);
      const bIsValid = requireEventBody(event.b, `${path}.b`, TRANSIT_BODIES, failures);
      if (aIsValid && bIsValid && event.a === event.b) {
        failures.push(violation('FACT-EVENT-SHAPE', path, 'aspect bodies must be different'));
      }
      if (typeof event.type !== 'string' || !ASPECT_TYPES.has(event.type)) {
        failures.push(violation('FACT-EVENT-TYPE', `${path}.type`, `unsupported aspect type ${String(event.type)}`));
      }
      requireEventSign(event.aSign, `${path}.aSign`, failures);
      requireEventDegree(event.aDegree, `${path}.aDegree`, failures);
      requireEventSign(event.bSign, `${path}.bSign`, failures);
      requireEventDegree(event.bDegree, `${path}.bDegree`, failures);
      if (event.orb !== 0) {
        failures.push(violation(
          'FACT-EVENT-ORB',
          `${path}.orb`,
          'exact aspect must explicitly use a zero-degree orb',
        ));
      }
    }
  });
  return failures;
}

export function validateDailyPublication(
  daily: Daily,
  publication: DailyPublication,
): EditorialViolation[] {
  const factFailures = validateDailyFacts(daily);
  const failures = [...factFailures];
  const constitution = DAILY_EDITORIAL_CONSTITUTION;
  if (constitution.schema !== 'zodiacs.editorial-constitution.v1'
    || constitution.identity.humanBylineAllowed
    || !constitution.identity.aiDisclosureRequired
    || constitution.generation.freeformModelOutputMayPublish
    || constitution.generation.generatorMayApproveOwnOutput) {
    failures.push(violation('POLICY-IDENTITY', 'constitution', 'editorial identity or approval boundaries are unsafe'));
  }
  if (publication.schema !== DAILY_PUBLICATION_SCHEMA || publication.date !== daily.date) {
    failures.push(violation('PROV-EDITION', 'publication', 'publication schema/date does not match the facts'));
  }
  if (publication.policy.id !== constitution.id || publication.policy.version !== constitution.version) {
    failures.push(violation('PROV-POLICY', 'publication.policy', 'publication policy is stale'));
  }
  if (publication.rendererVersion !== DAILY_RENDERER_VERSION) {
    failures.push(violation('PROV-RENDERER', 'publication.rendererVersion', 'renderer version is stale'));
  }
  if (!constitution.generation.allowedModes.includes(publication.generation.mode)) {
    failures.push(violation('PROV-GENERATION', 'publication.generation.mode', 'generation mode is not allowed'));
  }
  if (publication.generation.mode === 'deterministic-template' && publication.generation.model !== null) {
    failures.push(violation('PROV-MODEL', 'publication.generation.model', 'deterministic output must not claim a model call'));
  }

  // Do not derive houses from rejected signs. solarHouse intentionally assumes
  // canonical slugs, so exact-render comparison is only meaningful after the
  // runtime fact boundary has accepted every source coordinate.
  if (factFailures.length === 0) {
    const expected = buildDailyPublication(daily);
    if (JSON.stringify(publication) !== JSON.stringify(expected)) {
      failures.push(violation('CLAIM-RENDER', 'publication', 'published bytes do not exactly match the approved local renderers'));
    }
  }

  const expectedSigns = [...SIGN_SLUGS];
  if (publication.signs.length !== expectedSigns.length
    || publication.signs.some((entry, index) => entry.sign !== expectedSigns[index])) {
    failures.push(violation('STRUCT-SIGNS', 'publication.signs', 'publication must contain all twelve signs in canonical order'));
  }
  const factIds = new Set(publication.facts.map((fact) => fact.id));
  if (factIds.size !== publication.facts.length) {
    failures.push(violation('FACT-DUPLICATE-ID', 'publication.facts', 'fact IDs must be unique'));
  }
  publication.facts.forEach((fact, index) => {
    if (fact.kind === 'sky-event' && fact.eventKind === 'aspect' && fact.orb !== 0) {
      failures.push(violation(
        'FACT-ASPECT-ORB',
        `publication.facts[${index}].orb`,
        'exact aspect fact must explicitly expose a zero-degree orb',
      ));
    }
  });

  publication.signs.forEach((entry, signIndex) => {
    const path = `publication.signs[${signIndex}]`;
    if (entry.lines.length < constitution.reading.minLines || entry.lines.length > constitution.reading.maxLines) {
      failures.push(violation('STRUCT-LINES', `${path}.lines`, `reading has ${entry.lines.length} lines`));
    }
    const firstSolar = entry.lines.find((line) => line.scope === 'solar-house');
    if (!firstSolar || entry.headline !== firstSolar.text) {
      failures.push(violation('STRUCT-HEADLINE', `${path}.headline`, 'headline must be the first sign-specific line'));
    }
    failures.push(...surfaceViolations(entry.headline, `${path}.headline`, 'daily-hub-headline'));
    failures.push(...surfaceViolations(entry.todayLine.text, `${path}.todayLine.text`, 'today-sun-sign-line'));

    const houses = entry.lines
      .filter((line) => line.scope === 'solar-house' && line.house !== undefined)
      .map((line) => line.house);
    if (new Set(houses).size !== houses.length) {
      failures.push(violation('STRUCT-HOUSES', `${path}.lines`, 'solar houses must not repeat within a reading'));
    }
    const leadingEvents = entry.lines.findIndex((line) => line.templateId === 'body-house.v1');
    const leadingEventCount = leadingEvents === -1 ? entry.lines.length : leadingEvents;
    if (leadingEventCount > constitution.reading.maxLeadingEvents) {
      failures.push(violation('STRUCT-LEADING-EVENTS', `${path}.lines`, `reading begins with ${leadingEventCount} event lines`));
    }
    entry.lines.forEach((line, lineIndex) => {
      const linePath = `${path}.lines[${lineIndex}]`;
      failures.push(...surfaceViolations(line.text, `${linePath}.text`, 'daily-reading-line'));
      if (!line.templateId || !constitution.allowedTemplateIds.includes(line.templateId)) {
        failures.push(violation('CLAIM-TEMPLATE', `${linePath}.templateId`, 'line uses an unknown renderer'));
      }
      if (!line.evidenceRefs?.length || line.evidenceRefs.some((id) => !factIds.has(id))) {
        failures.push(violation('CLAIM-EVIDENCE', `${linePath}.evidenceRefs`, 'line has missing or unknown evidence'));
      }
    });
    if (!entry.todayLine.evidenceRefs?.length
      || entry.todayLine.evidenceRefs.some((id) => !factIds.has(id))) {
      failures.push(violation('CLAIM-EVIDENCE', `${path}.todayLine.evidenceRefs`, 'today line has missing or unknown evidence'));
    }
    if (entry.todayLine.templateId !== 'today-moon-theme.v1' || entry.todayLine.scope !== 'solar-house') {
      failures.push(violation('CLAIM-TODAY-TEMPLATE', `${path}.todayLine`, 'today line must use the Moon theme renderer'));
    }
  });

  const headlineSeen = new Set<string>();
  const todaySeen = new Set<string>();
  const normalizedHeadlines = publication.signs.map((entry) => words(entry.headline).join(' '));
  normalizedHeadlines.forEach((headline, index) => {
    if (headlineSeen.has(headline)) {
      failures.push(violation('DIST-EXACT', `publication.signs[${index}].headline`, 'headline duplicates another sign'));
    }
    headlineSeen.add(headline);
  });
  publication.signs.forEach((entry, index) => {
    const normalized = words(entry.todayLine.text).join(' ');
    if (todaySeen.has(normalized)) {
      failures.push(violation('DIST-TODAY-EXACT', `publication.signs[${index}].todayLine`, 'today line duplicates another sign'));
    }
    todaySeen.add(normalized);
  });
  const headlineHouses = publication.signs
    .map((entry) => entry.lines.find((line) => line.scope === 'solar-house')?.house)
    .sort((left, right) => Number(left) - Number(right));
  const todayHouses = publication.signs.map((entry) => entry.todayLine.house).sort((left, right) => Number(left) - Number(right));
  const wheel = Array.from({ length: 12 }, (_, index) => index + 1);
  if (JSON.stringify(headlineHouses) !== JSON.stringify(wheel)) {
    failures.push(violation('DIST-HEADLINE-HOUSES', 'publication.signs', 'hub headlines must cover all twelve solar houses'));
  }
  if (JSON.stringify(todayHouses) !== JSON.stringify(wheel)) {
    failures.push(violation('DIST-TODAY-HOUSES', 'publication.signs', 'today lines must cover all twelve solar houses'));
  }
  for (let left = 0; left < publication.signs.length; left += 1) {
    for (let right = left + 1; right < publication.signs.length; right += 1) {
      const surfaces = [
        {
          ruleId: 'DIST-SIMILARITY',
          path: `publication.signs[${left}].headline`,
          leftText: publication.signs[left].headline,
          rightText: publication.signs[right].headline,
          limit: constitution.distinctness.maxPairwiseJaccard,
        },
        {
          ruleId: 'DIST-TODAY-SIMILARITY',
          path: `publication.signs[${left}].todayLine`,
          leftText: publication.signs[left].todayLine.text,
          rightText: publication.signs[right].todayLine.text,
          limit: constitution.distinctness.maxTodayPairwiseJaccard,
        },
        {
          ruleId: 'DIST-READING-SIMILARITY',
          path: `publication.signs[${left}].lines`,
          // Collective aspects are intentionally identical for every sign;
          // distinctness applies to the sign-specific portion of a reading.
          leftText: publication.signs[left].lines
            .filter((line) => line.scope === 'solar-house').map((line) => line.text).join(' '),
          rightText: publication.signs[right].lines
            .filter((line) => line.scope === 'solar-house').map((line) => line.text).join(' '),
          limit: constitution.distinctness.maxReadingPairwiseJaccard,
        },
      ];
      for (const surface of surfaces) {
        const score = wordShingleJaccard(surface.leftText, surface.rightText, constitution.distinctness.shingleWords);
        if (score <= surface.limit) continue;
        failures.push(violation(
          surface.ruleId,
          surface.path,
          `${publication.signs[left].sign}/${publication.signs[right].sign} similarity ${score.toFixed(3)} exceeds ${surface.limit}`,
        ));
      }
    }
  }

  return failures.sort((a, b) => (
    a.ruleId.localeCompare(b.ruleId) || a.path.localeCompare(b.path) || a.message.localeCompare(b.message)
  ));
}
