/**
 * Independent, read-side verification for serialized horoscope copy.
 *
 * This module deliberately owns its structural checks, word counter, evidence
 * traversal, voice rules, and similarity calculation. It must not import a
 * publication renderer or reconstruct copy from source facts. Deterministic
 * regeneration remains a separate, supplemental provenance check.
 */
import dailyConstitutionDocument from '../src/lib/editorial-policy/constitution.v1.json';

export interface IndependentCopyViolation {
  ruleId: string;
  path: string;
  message: string;
}

type JsonRecord = Record<string, unknown>;

const SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;
const SIGN_SET = new Set<string>(SIGN_SLUGS);
const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;
const SIGN_BY_NAME = new Map(SIGN_NAMES.map((name, index) => [name.toLocaleLowerCase('en'), SIGN_SLUGS[index]]));
const BODY_NAMES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
  'Saturn', 'Uranus', 'Neptune', 'Pluto',
] as const;
const BODY_PATTERN = BODY_NAMES.join('|');
const SIGN_PATTERN = SIGN_NAMES.join('|');
const ASPECT_TYPES = ['conjunction', 'sextile', 'square', 'trine', 'opposition'] as const;
const MOON_PHASES = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
] as const;
const MOON_PHASE_SET = new Set<string>(MOON_PHASES);
// Independent copy of the public whole-sign interpretation vocabulary. This
// is intentionally not imported from the renderer: drift between the two is
// supposed to stop publication until both roles agree.
const HOUSE_THEMES: Record<number, string> = {
  1: 'your identity and how you present yourself',
  2: 'your money, possessions, and priorities',
  3: 'messages, errands, siblings, and your local community',
  4: 'home, family, and your private life',
  5: 'creativity, romance, children, and enjoyment',
  6: 'daily work, health routines, and responsibilities',
  7: 'partners and one-to-one relationships',
  8: 'shared finances, debts, intimacy, and trust',
  9: 'travel, learning, beliefs, and long-term plans',
  10: 'career, reputation, and public responsibilities',
  11: 'friends, groups, and plans for the future',
  12: 'rest, privacy, and unfinished matters',
};
const HOUSE_ACTIONS: Record<number, string> = {
  1: 'make your own position visible before reacting to the room',
  2: 'check the budget of time, attention, and material resources',
  3: 'clarify the message, route, or conversation closest to hand',
  4: 'protect the conditions that make home and private life workable',
  5: 'give play, romance, or creative work a defined place',
  6: 'adjust the routine where the daily load repeatedly catches',
  7: 'put the agreement or disagreement directly on the table',
  8: 'name what is shared, owed, private, or difficult to divide',
  9: 'test the larger belief against study, distance, or direct experience',
  10: 'choose what should be visible in your work and public role',
  11: 'ask which friendship, group, or future plan still has momentum',
  12: 'leave room for rest, closure, and work that happens offstage',
};
const PROGRAM_SURFACES = [
  'today', 'tomorrow', 'weekly', 'love', 'career', 'yearly-2027',
] as const;
type ProgramSurface = (typeof PROGRAM_SURFACES)[number];

const PROGRAM_WORD_BOUNDS: Record<ProgramSurface, { min: number; max: number }> = {
  today: { min: 90, max: 140 },
  tomorrow: { min: 90, max: 140 },
  weekly: { min: 200, max: 300 },
  love: { min: 60, max: 100 },
  career: { min: 60, max: 100 },
  'yearly-2027': { min: 1_200, max: 1_800 },
};

const PROGRAM_DISTINCTNESS_LIMITS: Record<ProgramSurface, number> = {
  today: 0.4,
  tomorrow: 0.4,
  weekly: 0.55,
  love: 0.55,
  career: 0.55,
  'yearly-2027': 0.72,
};

// A useful house-level instruction may recur where the same topic returns,
// but no exact editorial sentence may become a near-universal sign template.
// Three lets a canonical house instruction recur in a small number of useful
// contexts without allowing it to become a cross-surface sign template.
const PROGRAM_MAX_EXACT_SENTENCE_SIGN_REUSE = 3;
const PROGRAM_MIN_REUSE_SENTENCE_WORDS = 6;
const PROGRAM_INTRA_ACTION_JACCARD_LIMIT = 0.5;
// Same-sign adjacent editions share receipts and a solar-house vocabulary,
// but their rendered advice must be at least as distinct as two daily signs.
const PROGRAM_TODAY_TOMORROW_JACCARD_LIMIT = 0.4;
const PROGRAM_ACTION_CLAUSE_OPENING = /^(?:ask|build|check|choose|clarify|close|compare|confirm|consider|decide|define|draft|finish|give|keep|leave|let|list|look|make|mark|measure|name|notice|offer|pause|pick|protect|put|record|remove|repair|reserve|review|say|separate|set|stabilize|start|state|test|treat|turn|use|watch|write)\b/iu;

const PROGRAM_BANNED = [
  /\bdelve\b/iu,
  /\bunlock\b/iu,
  /\bembark\b/iu,
  /\btapestr(?:y|ies)\b/iu,
  /\bvibrant\b/iu,
  /\belevat(?:e|es|ed|ing|ion)\b/iu,
  /\bempower(?:s|ed|ing|ment)?\b/iu,
  /\bharness(?:es|ed|ing)?\b/iu,
  /\bin today[’']s world\b/iu,
] as const;

const PROGRAM_UNSAFE = [
  /\b(?:guaranteed|destined|inevitable|will definitely|certain to)\b/iu,
  /\b(?:diagnos(?:e|is)|cure|medication|pregnan(?:t|cy)|fertility)\b/iu,
  /\b(?:buy|sell|trade|invest(?:ment|ing)?)\b/iu,
  /\b(?:lawsuit|legal outcome|guilty|innocent)\b/iu,
] as const;

const BACKSTAGE_COPY = /\b(?:deterministic|noon[- ]UTC snapshot|verified position|source receipts?|proportionate to the evidence|supplied (?:day|week|position|snapshot)|event catalog|solar-house method)\b/iu;
const KITCHEN_FIRST_OPENING = /^(?:the\s+)?(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|new moon|full moon|solar eclipse|lunar eclipse)\b|(?:\bUTC\b|\d+(?:\.\d+)?°|\bsolar house\b)/iu;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}

function isInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const instant = new Date(value);
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value;
}

function isHouse(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 12;
}

function isDegree(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 30;
}

function failure(ruleId: string, path: string, message: string): IndependentCopyViolation {
  return { ruleId, path, message };
}

function sortedUnique(failures: IndependentCopyViolation[]): IndependentCopyViolation[] {
  return [...new Map(failures.map((item) => [
    `${item.ruleId}|${item.path}|${item.message}`,
    item,
  ])).values()].sort((left, right) => (
    left.ruleId.localeCompare(right.ruleId)
    || left.path.localeCompare(right.path)
    || left.message.localeCompare(right.message)
  ));
}

export function independentWordCount(text: string): number {
  return text.normalize('NFKC').match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function normalizedWords(text: string): string[] {
  return text.normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu) ?? [];
}

function normalizedText(text: string): string {
  return normalizedWords(text).join(' ');
}

function independentSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => independentWordCount(sentence) >= PROGRAM_MIN_REUSE_SENTENCE_WORDS);
}

function independentActionClauses(text: string): string[] {
  return text
    .split(/[.!?;—:]+(?:\s+|$)/u)
    .map((clause) => clause.trim())
    .filter((clause) => (
      independentWordCount(clause) >= 5
      && PROGRAM_ACTION_CLAUSE_OPENING.test(clause)
    ));
}

function intraReadingActionViolations(
  text: string,
  path: string,
): IndependentCopyViolation[] {
  const actions = independentActionClauses(text);
  const failures: IndependentCopyViolation[] = [];
  for (let left = 0; left < actions.length; left += 1) {
    for (let right = left + 1; right < actions.length; right += 1) {
      const score = independentShingleJaccard(actions[left], actions[right], 1);
      if (score <= PROGRAM_INTRA_ACTION_JACCARD_LIMIT) continue;
      failures.push(failure(
        'COPY-DIST-INTRA-ACTION',
        path,
        `action clauses repeat within one reading (unigram Jaccard ${score.toFixed(3)} > ${PROGRAM_INTRA_ACTION_JACCARD_LIMIT}): ${actions[left]} / ${actions[right]}`,
      ));
    }
  }
  return failures;
}

export function independentShingleJaccard(leftText: string, rightText: string, width = 3): number {
  const shingles = (text: string): Set<string> => {
    const values = normalizedWords(text);
    if (values.length < width) return new Set(values.length ? [values.join(' ')] : []);
    return new Set(values.slice(0, values.length - width + 1).map((_, index) => (
      values.slice(index, index + width).join(' ')
    )));
  };
  const left = shingles(leftText);
  const right = shingles(rightText);
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

interface PatternRule {
  id: string;
  pattern: string;
  flags: string;
}

interface DailySurfaceRule {
  minWords: number;
  maxWords: number;
  maxChars: number;
  maxExclamations: number;
}

interface DailyCopyPolicy {
  id: string;
  version: string;
  generation: { allowedModes: string[] };
  facts: { allowedEventKinds: string[] };
  surfaces: Record<'daily-hub-headline' | 'daily-reading-line' | 'today-sun-sign-line', DailySurfaceRule>;
  reading: { minLines: number; maxLines: number; maxLeadingEvents: number; dedupeSolarHouses: boolean };
  distinctness: {
    shingleWords: number;
    maxPairwiseJaccard: number;
    maxTodayPairwiseJaccard: number;
    maxReadingPairwiseJaccard: number;
    maxExactDuplicates: number;
  };
  allowedTemplateIds: string[];
  lexicon: { banned: PatternRule[]; unsafe: PatternRule[] };
}

const DAILY_POLICY = dailyConstitutionDocument as DailyCopyPolicy;

function regexRuleViolations(
  rules: readonly PatternRule[],
  text: string,
  path: string,
  family: 'VOICE' | 'SAFE',
): IndependentCopyViolation[] {
  const failures: IndependentCopyViolation[] = [];
  for (const rule of rules) {
    try {
      if (new RegExp(rule.pattern, rule.flags).test(text)) {
        failures.push(failure(`COPY-${family}-${rule.id}`, path, `copy matches ${rule.id}`));
      }
    } catch {
      failures.push(failure('COPY-POLICY-REGEX', 'policy.lexicon', `invalid ${rule.id} expression`));
    }
  }
  return failures;
}

function dailySurfaceViolations(
  text: unknown,
  path: string,
  surface: keyof DailyCopyPolicy['surfaces'],
): IndependentCopyViolation[] {
  if (typeof text !== 'string') {
    return [failure('COPY-STRUCT-TEXT', path, `${surface} must be a string`)];
  }
  const failures: IndependentCopyViolation[] = [];
  const rule = DAILY_POLICY.surfaces[surface];
  const count = independentWordCount(text);
  if (count < rule.minWords || count > rule.maxWords) {
    failures.push(failure('COPY-LENGTH-WORDS', path, `${surface} has ${count} words; expected ${rule.minWords}-${rule.maxWords}`));
  }
  if (text.length > rule.maxChars) {
    failures.push(failure('COPY-LENGTH-CHARS', path, `${surface} has ${text.length} characters; maximum ${rule.maxChars}`));
  }
  const exclamations = text.match(/!/g)?.length ?? 0;
  if (exclamations > rule.maxExclamations) {
    failures.push(failure('COPY-VOICE-EXCLAMATION', path, `${surface} has ${exclamations} exclamation marks`));
  }
  if (/<[^>]+>/.test(text)) {
    failures.push(failure('COPY-VOICE-MARKUP', path, `${surface} must be plain text`));
  }
  failures.push(...regexRuleViolations(DAILY_POLICY.lexicon.banned, text, path, 'VOICE'));
  failures.push(...regexRuleViolations(DAILY_POLICY.lexicon.unsafe, text, path, 'SAFE'));
  return failures;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => !isNonEmptyString(item))) return null;
  return value as string[];
}

function evidenceRefViolations(
  value: unknown,
  path: string,
  factById: ReadonlyMap<string, JsonRecord>,
): { refs: string[]; failures: IndependentCopyViolation[] } {
  const refs = stringArray(value);
  if (!refs?.length) {
    return {
      refs: refs ?? [],
      failures: [failure('COPY-EVIDENCE-MISSING', path, 'copy must cite at least one evidence ID')],
    };
  }
  const failures: IndependentCopyViolation[] = [];
  if (new Set(refs).size !== refs.length) {
    failures.push(failure('COPY-EVIDENCE-DUPLICATE', path, 'evidence references must be unique'));
  }
  for (const ref of refs) {
    if (!factById.has(ref)) failures.push(failure('COPY-EVIDENCE-UNKNOWN', path, `unknown evidence ID ${ref}`));
  }
  return { refs, failures };
}

function dailyFactViolations(
  factsValue: unknown,
): { facts: JsonRecord[]; factById: Map<string, JsonRecord>; failures: IndependentCopyViolation[] } {
  const failures: IndependentCopyViolation[] = [];
  if (!Array.isArray(factsValue)) {
    return {
      facts: [],
      factById: new Map(),
      failures: [failure('COPY-STRUCT-FACTS', 'publication.facts', 'facts must be an array')],
    };
  }
  const facts = factsValue.filter(isRecord);
  if (facts.length !== factsValue.length) {
    failures.push(failure('COPY-STRUCT-FACTS', 'publication.facts', 'every fact must be an object'));
  }
  const factById = new Map<string, JsonRecord>();
  facts.forEach((fact, index) => {
    const path = `publication.facts[${index}]`;
    if (!isNonEmptyString(fact.id)) {
      failures.push(failure('COPY-EVIDENCE-ID', `${path}.id`, 'fact ID must be a non-empty string'));
    } else if (factById.has(fact.id)) {
      failures.push(failure('COPY-EVIDENCE-DUPLICATE', `${path}.id`, `duplicate fact ID ${fact.id}`));
    } else {
      factById.set(fact.id, fact);
    }
    if (!['body-position', 'sky-event', 'solar-house'].includes(String(fact.kind))) {
      failures.push(failure('COPY-EVIDENCE-KIND', `${path}.kind`, `unsupported fact kind ${String(fact.kind)}`));
      return;
    }
    if (fact.kind === 'body-position') {
      if (!isNonEmptyString(fact.body) || !SIGN_SET.has(String(fact.sign)) || !isInstant(fact.at)
        || typeof fact.longitude !== 'number' || !Number.isFinite(fact.longitude)
        || fact.longitude < 0 || fact.longitude >= 360 || !isDegree(fact.degree)
        || typeof fact.retrograde !== 'boolean') {
        failures.push(failure('COPY-EVIDENCE-SHAPE', path, 'body position has invalid body, sign, instant, coordinates, or motion'));
      }
    } else if (fact.kind === 'sky-event') {
      if (!DAILY_POLICY.facts.allowedEventKinds.includes(String(fact.eventKind)) || !isInstant(fact.at)) {
        failures.push(failure('COPY-EVIDENCE-SHAPE', path, 'sky event has an invalid kind or instant'));
      }
    } else if (!isNonEmptyString(fact.sourceFactId) || !SIGN_SET.has(String(fact.sign))
      || !SIGN_SET.has(String(fact.sunSign)) || !isHouse(fact.house)) {
      failures.push(failure('COPY-EVIDENCE-DERIVATION', path, 'solar-house fact requires a source, signs, and house 1-12'));
    }
  });

  facts.forEach((fact, index) => {
    if (fact.kind !== 'solar-house' || !isNonEmptyString(fact.sourceFactId)) return;
    const path = `publication.facts[${index}]`;
    const source = factById.get(fact.sourceFactId);
    if (!source || source.kind === 'solar-house') {
      failures.push(failure('COPY-EVIDENCE-DERIVATION', `${path}.sourceFactId`, 'solar-house source must be a known base fact'));
      return;
    }
    if (source.kind === 'body-position'
      && (source.body !== fact.body || source.sign !== fact.sign || source.at !== fact.at && fact.at !== undefined)) {
      failures.push(failure('COPY-EVIDENCE-DERIVATION', path, 'solar-house fact conflicts with its body-position source'));
    }
  });
  return { facts, factById, failures };
}

function verifyDailyLine(
  lineValue: unknown,
  path: string,
  sign: string,
  factById: ReadonlyMap<string, JsonRecord>,
  surface: 'daily-reading-line' | 'today-sun-sign-line',
): { line: JsonRecord | null; refs: string[]; failures: IndependentCopyViolation[] } {
  if (!isRecord(lineValue)) {
    return { line: null, refs: [], failures: [failure('COPY-STRUCT-LINE', path, 'line must be an object')] };
  }
  const line = lineValue;
  const failures = dailySurfaceViolations(line.text, `${path}.text`, surface);
  if (!isNonEmptyString(line.receipt)) {
    failures.push(failure('COPY-STRUCT-RECEIPT', `${path}.receipt`, 'line must have a reader-visible receipt'));
  }
  if (!isNonEmptyString(line.templateId) || !DAILY_POLICY.allowedTemplateIds.includes(line.templateId)) {
    failures.push(failure('COPY-STRUCT-TEMPLATE', `${path}.templateId`, 'line uses an unknown template ID'));
  }
  if (line.scope !== 'solar-house' && line.scope !== 'collective') {
    failures.push(failure('COPY-STRUCT-SCOPE', `${path}.scope`, 'line scope must be solar-house or collective'));
  }
  const evidence = evidenceRefViolations(line.evidenceRefs, `${path}.evidenceRefs`, factById);
  failures.push(...evidence.failures);
  const referenced = evidence.refs.map((ref) => factById.get(ref)).filter(isRecord);
  if (line.scope === 'solar-house') {
    if (!isHouse(line.house)) {
      failures.push(failure('COPY-EVIDENCE-HOUSE', `${path}.house`, 'solar-house line requires house 1-12'));
    }
    const derivations = referenced.filter((fact) => fact.kind === 'solar-house');
    const matching = derivations.filter((fact) => fact.sunSign === sign && fact.house === line.house);
    if (!matching.length) {
      failures.push(failure('COPY-EVIDENCE-SIGN', `${path}.evidenceRefs`, `line must cite a solar-house fact for ${sign} and its stated house`));
    }
    for (const derived of matching) {
      if (isNonEmptyString(derived.sourceFactId) && !evidence.refs.includes(derived.sourceFactId)) {
        failures.push(failure('COPY-EVIDENCE-PAIR', `${path}.evidenceRefs`, 'derived solar-house evidence must be paired with its source fact'));
      }
      if (isNonEmptyString(line.body) && isNonEmptyString(derived.body) && line.body !== derived.body) {
        failures.push(failure('COPY-EVIDENCE-BODY', `${path}.body`, 'line body conflicts with its solar-house evidence'));
      }
    }
  } else if (!referenced.some((fact) => fact.kind === 'sky-event')) {
    failures.push(failure('COPY-EVIDENCE-COLLECTIVE', `${path}.evidenceRefs`, 'collective line must cite a sky event'));
  }
  return { line, refs: evidence.refs, failures };
}

/** Verify daily serialized copy without reconstructing it through the renderer. */
export function verifyDailyPublicationCopy(publicationValue: unknown): IndependentCopyViolation[] {
  if (!isRecord(publicationValue)) {
    return [failure('COPY-STRUCT-ROOT', 'publication', 'publication must be an object')];
  }
  const publication = publicationValue;
  const failures: IndependentCopyViolation[] = [];
  if (publication.schema !== 'zodiacs.daily-publication.v1') {
    failures.push(failure('COPY-STRUCT-SCHEMA', 'publication.schema', 'unexpected daily publication schema'));
  }
  if (!isDate(publication.date)) failures.push(failure('COPY-STRUCT-DATE', 'publication.date', 'edition date must be a real YYYY-MM-DD date'));
  if (publication.locale !== 'en') failures.push(failure('COPY-STRUCT-LOCALE', 'publication.locale', 'daily publication locale must be en'));
  const policy = isRecord(publication.policy) ? publication.policy : null;
  if (!policy || policy.id !== DAILY_POLICY.id || policy.version !== DAILY_POLICY.version) {
    failures.push(failure('COPY-POLICY-VERSION', 'publication.policy', 'publication does not identify the active copy policy'));
  }
  const generation = isRecord(publication.generation) ? publication.generation : null;
  if (!generation || !DAILY_POLICY.generation.allowedModes.includes(String(generation.mode))
    || generation.model !== null || !isNonEmptyString(generation.generatorId)
    || generation.generatorId !== publication.rendererVersion) {
    failures.push(failure('COPY-PROVENANCE-GENERATION', 'publication.generation', 'publication must identify an allowed no-model generator'));
  }

  const factResult = dailyFactViolations(publication.facts);
  failures.push(...factResult.failures);
  if (!Array.isArray(publication.signs)) {
    failures.push(failure('COPY-STRUCT-SIGNS', 'publication.signs', 'signs must be an array'));
    return sortedUnique(failures);
  }
  const signs = publication.signs.filter(isRecord);
  if (signs.length !== 12 || signs.length !== publication.signs.length
    || signs.some((entry, index) => entry.sign !== SIGN_SLUGS[index])) {
    failures.push(failure('COPY-STRUCT-SIGNS', 'publication.signs', 'all twelve signs must appear in canonical order'));
  }

  const validEntries: Array<{ sign: string; headline: string; today: string; reading: string; headlineHouse?: number; todayHouse?: number }> = [];
  signs.forEach((entry, signIndex) => {
    const path = `publication.signs[${signIndex}]`;
    const sign = isNonEmptyString(entry.sign) ? entry.sign : '';
    failures.push(...dailySurfaceViolations(entry.headline, `${path}.headline`, 'daily-hub-headline'));
    if (!Array.isArray(entry.lines)) {
      failures.push(failure('COPY-STRUCT-LINES', `${path}.lines`, 'reading lines must be an array'));
      return;
    }
    if (entry.lines.length < DAILY_POLICY.reading.minLines || entry.lines.length > DAILY_POLICY.reading.maxLines) {
      failures.push(failure('COPY-STRUCT-LINES', `${path}.lines`, `reading has ${entry.lines.length} lines; expected ${DAILY_POLICY.reading.minLines}-${DAILY_POLICY.reading.maxLines}`));
    }
    const checkedLines = entry.lines.map((line, lineIndex) => {
      const result = verifyDailyLine(line, `${path}.lines[${lineIndex}]`, sign, factResult.factById, 'daily-reading-line');
      failures.push(...result.failures);
      return result.line;
    }).filter(isRecord);
    const firstSolar = checkedLines.find((line) => line.scope === 'solar-house');
    if (!firstSolar || entry.headline !== firstSolar.text) {
      failures.push(failure('COPY-STRUCT-HEADLINE', `${path}.headline`, 'headline must equal the first sign-specific reading line'));
    }
    const houses = checkedLines.filter((line) => line.scope === 'solar-house').map((line) => line.house);
    if (houses.some((house) => !isHouse(house)) || new Set(houses).size !== houses.length) {
      failures.push(failure('COPY-STRUCT-HOUSES', `${path}.lines`, 'sign-specific reading houses must be valid and unique'));
    }
    const firstBodyLine = checkedLines.findIndex((line) => line.templateId === 'body-house.v1');
    const leadingEvents = firstBodyLine < 0 ? checkedLines.length : firstBodyLine;
    if (leadingEvents > DAILY_POLICY.reading.maxLeadingEvents) {
      failures.push(failure('COPY-STRUCT-LEADING-EVENTS', `${path}.lines`, `reading begins with ${leadingEvents} event lines`));
    }

    const todayResult = verifyDailyLine(entry.todayLine, `${path}.todayLine`, sign, factResult.factById, 'today-sun-sign-line');
    failures.push(...todayResult.failures);
    if (todayResult.line
      && (todayResult.line.templateId !== 'today-moon-theme.v1'
        || todayResult.line.scope !== 'solar-house'
        || todayResult.line.body !== 'Moon')) {
      failures.push(failure('COPY-STRUCT-TODAY', `${path}.todayLine`, 'today line must be the sign-specific Moon theme'));
    }
    if (typeof entry.headline === 'string' && todayResult.line && typeof todayResult.line.text === 'string') {
      validEntries.push({
        sign,
        headline: entry.headline,
        today: todayResult.line.text,
        reading: checkedLines.filter((line) => line.scope === 'solar-house' && typeof line.text === 'string')
          .map((line) => line.text as string).join(' '),
        headlineHouse: isHouse(firstSolar?.house) ? firstSolar.house : undefined,
        todayHouse: isHouse(todayResult.line.house) ? todayResult.line.house : undefined,
      });
    }
  });

  if (validEntries.length === 12) {
    const wheel = Array.from({ length: 12 }, (_, index) => index + 1).join(',');
    const headlineHouses = validEntries.map((entry) => entry.headlineHouse).sort((a, b) => Number(a) - Number(b)).join(',');
    const todayHouses = validEntries.map((entry) => entry.todayHouse).sort((a, b) => Number(a) - Number(b)).join(',');
    if (headlineHouses !== wheel) failures.push(failure('COPY-DIST-HEADLINE-HOUSES', 'publication.signs', 'headlines must cover all twelve solar houses'));
    if (todayHouses !== wheel) failures.push(failure('COPY-DIST-TODAY-HOUSES', 'publication.signs', 'today lines must cover all twelve solar houses'));
  }
  for (let left = 0; left < validEntries.length; left += 1) {
    for (let right = left + 1; right < validEntries.length; right += 1) {
      const pair = `${validEntries[left].sign}/${validEntries[right].sign}`;
      const surfaces = [
        ['headline', validEntries[left].headline, validEntries[right].headline, DAILY_POLICY.distinctness.maxPairwiseJaccard],
        ['today', validEntries[left].today, validEntries[right].today, DAILY_POLICY.distinctness.maxTodayPairwiseJaccard],
        ['reading', validEntries[left].reading, validEntries[right].reading, DAILY_POLICY.distinctness.maxReadingPairwiseJaccard],
      ] as const;
      for (const [surface, leftText, rightText, limit] of surfaces) {
        if (normalizedText(leftText) === normalizedText(rightText)) {
          failures.push(failure('COPY-DIST-EXACT', `publication.signs.${pair}.${surface}`, `${surface} copy is duplicated across signs`));
        }
        const score = independentShingleJaccard(leftText, rightText, DAILY_POLICY.distinctness.shingleWords);
        if (score > limit) {
          failures.push(failure('COPY-DIST-SIMILARITY', `publication.signs.${pair}.${surface}`, `trigram Jaccard ${score.toFixed(3)} exceeds ${limit}`));
        }
      }
    }
  }
  return sortedUnique(failures);
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function isoWeek(anchorDate: string): { from: string; through: string } {
  const value = new Date(`${anchorDate}T00:00:00.000Z`);
  const isoDay = value.getUTCDay() || 7;
  return { from: addDays(anchorDate, 1 - isoDay), through: addDays(anchorDate, 7 - isoDay) };
}

function expectedProgramPeriod(anchorDate: string, surface: ProgramSurface): { from: string; through: string } {
  if (surface === 'tomorrow') {
    const tomorrow = addDays(anchorDate, 1);
    return { from: tomorrow, through: tomorrow };
  }
  if (surface === 'weekly') return isoWeek(anchorDate);
  if (surface === 'yearly-2027') return { from: '2027-01-01', through: '2027-12-31' };
  return { from: anchorDate, through: anchorDate };
}

function programVoiceViolations(text: string, path: string): IndependentCopyViolation[] {
  const failures: IndependentCopyViolation[] = [];
  if (text.includes('!')) failures.push(failure('COPY-VOICE-EXCLAMATION', path, 'exclamation marks are not allowed'));
  if (/<[^>]+>/.test(text)) failures.push(failure('COPY-VOICE-MARKUP', path, 'reading copy must be plain text'));
  for (const pattern of PROGRAM_BANNED) {
    if (pattern.test(text)) failures.push(failure('COPY-VOICE-BANNED', path, `copy matches ${pattern.source}`));
  }
  for (const pattern of PROGRAM_UNSAFE) {
    if (pattern.test(text)) failures.push(failure('COPY-SAFE-UNSAFE', path, `copy matches ${pattern.source}`));
  }
  return failures;
}

function expectedPublishable(coverage: JsonRecord, surface: ProgramSurface): boolean {
  if (surface === 'today' || surface === 'love' || surface === 'career') return coverage.today === 'complete';
  if (surface === 'tomorrow') return coverage.tomorrow === 'complete';
  if (surface === 'weekly') return coverage.isoWeek === 'complete';
  return coverage.yearly2027 === 'complete';
}

function independentSolarHouse(sign: string, sunSign: string): number | null {
  const bodyIndex = SIGN_SLUGS.indexOf(sign as (typeof SIGN_SLUGS)[number]);
  const sunIndex = SIGN_SLUGS.indexOf(sunSign as (typeof SIGN_SLUGS)[number]);
  return bodyIndex < 0 || sunIndex < 0 ? null : ((bodyIndex - sunIndex + 12) % 12) + 1;
}

function canonicalMoonPhase(value: string): string | null {
  const normalized = value.toLocaleLowerCase('en').replace(/\s+moon$/u, '').trim();
  return MOON_PHASES.find((phase) => phase.toLocaleLowerCase('en').replace(/\s+moon$/u, '') === normalized) ?? null;
}

function citedBodyMatches(
  receipts: JsonRecord[],
  body: string,
  sign?: string,
  retrograde?: boolean,
): boolean {
  return receipts.some((receipt) => {
    if (receipt.kind === 'sky-event' && receipt.eventKind === 'aspect') return false;
    if (receipt.body !== body) return false;
    if (sign && receipt.sign !== sign) return false;
    if (retrograde !== undefined && receipt.retrograde !== retrograde) return false;
    return receipt.kind === 'body-position' || receipt.kind === 'sky-event' || receipt.kind === 'solar-house';
  });
}

function citedEventMatches(
  receipts: JsonRecord[],
  expected: Partial<Record<'eventKind' | 'eventType' | 'body' | 'a' | 'b' | 'sign', string>>,
): boolean {
  return receipts.some((receipt) => receipt.kind === 'sky-event'
    && Object.entries(expected).every(([key, value]) => receipt[key] === value));
}

function eventDateLabel(at: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(at));
}

function passageNamesEvent(text: string, receipt: JsonRecord): boolean {
  const body = typeof receipt.body === 'string' ? receipt.body : '';
  const eventType = typeof receipt.eventType === 'string' ? receipt.eventType : '';
  const signIndex = typeof receipt.sign === 'string'
    ? SIGN_SLUGS.indexOf(receipt.sign as (typeof SIGN_SLUGS)[number])
    : -1;
  const sign = signIndex >= 0 ? SIGN_NAMES[signIndex] : '';
  if (receipt.eventKind === 'aspect') {
    return typeof receipt.a === 'string' && typeof receipt.b === 'string'
      && text.toLocaleLowerCase('en').includes(`${receipt.a} ${eventType} ${receipt.b}`.toLocaleLowerCase('en'));
  }
  if (receipt.eventKind === 'station') {
    return Boolean(body && eventType && sign)
      && new RegExp(`\\b${body} station(?:s|ing) ${eventType} in ${sign}\\b`, 'iu').test(text);
  }
  if (receipt.eventKind === 'ingress') {
    return Boolean(body && sign) && new RegExp(`\\b${body} enter(?:s|ing) ${sign}\\b`, 'iu').test(text);
  }
  if (receipt.eventKind === 'eclipse') {
    return Boolean(eventType && sign) && new RegExp(`\\b(?:the )?${eventType} eclipse in ${sign}\\b`, 'iu').test(text);
  }
  if (receipt.eventKind === 'lunation') {
    const phase = eventType === 'new' ? 'new moon' : eventType === 'full' ? 'full moon' : '';
    return Boolean(phase && sign) && new RegExp(`\\b(?:the )?${phase} in ${sign}\\b`, 'iu').test(text);
  }
  return false;
}

function programSemanticViolations(
  text: string,
  receipts: JsonRecord[],
  path: string,
  surface: ProgramSurface,
  passageIndex: number,
  passageCount: number,
): IndependentCopyViolation[] {
  const failures: IndependentCopyViolation[] = [];
  let recognizedClaims = 0;
  const claimFailure = (message: string) => failures.push(failure('COPY-EVIDENCE-CLAIM', path, message));

  const bodyInSign = new RegExp(`\\b(${BODY_PATTERN})(?: (retrograde))? in (${SIGN_PATTERN})\\b`, 'giu');
  for (const match of text.matchAll(bodyInSign)) {
    const body = match[1];
    const sign = SIGN_BY_NAME.get(match[3].toLocaleLowerCase('en'));
    const retrograde = match[2] ? true : undefined;
    recognizedClaims += 1;
    if (!sign || !citedBodyMatches(receipts, body, sign, retrograde)) {
      claimFailure(`${match[0]} is not supported by the cited position or derivation receipts`);
    }
  }

  const aspect = new RegExp(`\\b(${BODY_PATTERN}) (${ASPECT_TYPES.join('|')}) (${BODY_PATTERN})\\b`, 'giu');
  for (const match of text.matchAll(aspect)) {
    recognizedClaims += 1;
    if (!citedEventMatches(receipts, {
      eventKind: 'aspect', eventType: match[2].toLocaleLowerCase('en'), a: match[1], b: match[3],
    })) {
      claimFailure(`${match[0]} is not supported by the cited exact-aspect receipt`);
    }
  }

  const station = new RegExp(`\\b(${BODY_PATTERN}) station(?:s|ing) (retrograde|direct) in (${SIGN_PATTERN})\\b`, 'giu');
  for (const match of text.matchAll(station)) {
    const sign = SIGN_BY_NAME.get(match[3].toLocaleLowerCase('en'));
    recognizedClaims += 1;
    if (!sign || !citedEventMatches(receipts, {
      eventKind: 'station', eventType: match[2].toLocaleLowerCase('en'), body: match[1], sign,
    })) {
      claimFailure(`${match[0]} is not supported by the cited station receipt`);
    }
  }

  const ingress = new RegExp(`\\b(${BODY_PATTERN}) enter(?:s|ing) (${SIGN_PATTERN})\\b`, 'giu');
  for (const match of text.matchAll(ingress)) {
    const sign = SIGN_BY_NAME.get(match[2].toLocaleLowerCase('en'));
    recognizedClaims += 1;
    if (!sign || !citedEventMatches(receipts, { eventKind: 'ingress', body: match[1], sign })) {
      claimFailure(`${match[0]} is not supported by the cited ingress receipt`);
    }
  }

  const eclipse = new RegExp(`\\b(?:the )?(solar|lunar) eclipse in (${SIGN_PATTERN})\\b`, 'giu');
  for (const match of text.matchAll(eclipse)) {
    const sign = SIGN_BY_NAME.get(match[2].toLocaleLowerCase('en'));
    recognizedClaims += 1;
    if (!sign || !citedEventMatches(receipts, {
      eventKind: 'eclipse', eventType: match[1].toLocaleLowerCase('en'), sign,
    })) {
      claimFailure(`${match[0]} is not supported by the cited eclipse receipt`);
    }
  }

  const phase = /\b(new moon|waxing crescent moon|first quarter moon|waxing gibbous moon|full moon|waning gibbous moon|last quarter moon|waning crescent moon)\b/giu;
  for (const match of text.matchAll(phase)) {
    const expected = canonicalMoonPhase(match[1]);
    const supported = receipts.some((receipt) => receipt.kind === 'body-position'
      && receipt.body === 'Moon' && receipt.moonPhase === expected)
      || receipts.some((receipt) => receipt.kind === 'sky-event'
        && receipt.eventKind === 'lunation'
        && receipt.eventType === (expected === 'New Moon' ? 'new' : expected === 'Full Moon' ? 'full' : null));
    recognizedClaims += 1;
    if (!expected || !supported) claimFailure(`${match[0]} does not match the cited Moon-phase or lunation receipt`);
  }

  for (const receipt of receipts) {
    if (receipt.kind === 'body-position' && typeof receipt.body === 'string') {
      const namedBody = new RegExp(`\\b${receipt.body}\\b`, 'iu').test(text);
      if (namedBody) recognizedClaims += 1;
    }
    if (receipt.kind === 'solar-house' && isHouse(receipt.house)) {
      // The yearly overview identifies its bookend events without interpreting
      // their houses; every other derived claim must name its canonical theme.
      if (surface === 'yearly-2027' && (passageIndex === 0 || passageIndex === passageCount - 1)) continue;
      const theme = HOUSE_THEMES[Number(receipt.house)];
      const action = HOUSE_ACTIONS[Number(receipt.house)];
      const normalized = text.toLocaleLowerCase('en');
      if (!normalized.includes(theme) && !normalized.includes(action)) {
        failures.push(failure('COPY-EVIDENCE-THEME', path, `solar house ${receipt.house} must be expressed through its canonical theme or action`));
      } else {
        recognizedClaims += 1;
      }
    }
    if (receipt.kind === 'sky-event') {
      if (!passageNamesEvent(text, receipt)) {
        claimFailure(`cited ${String(receipt.eventKind)} event is not accurately named in the passage`);
      } else {
        recognizedClaims += 1;
      }
      if (surface === 'yearly-2027' && passageIndex > 0 && passageIndex < passageCount - 1 && isInstant(receipt.at)) {
        const date = eventDateLabel(receipt.at);
        if (!text.includes(date)) failures.push(failure('COPY-EVIDENCE-DATE', path, `cited event date ${date} is not stated in the passage`));
        else recognizedClaims += 1;
      }
    }
  }

  if (recognizedClaims === 0) {
    failures.push(failure('COPY-EVIDENCE-SEMANTIC', path, 'publishable passage has no independently recognized claim tied to its receipts'));
  }
  return failures;
}

function programEvidence(
  value: unknown,
): { receipts: JsonRecord[]; byId: Map<string, JsonRecord>; failures: IndependentCopyViolation[] } {
  const failures: IndependentCopyViolation[] = [];
  if (!Array.isArray(value)) {
    return { receipts: [], byId: new Map(), failures: [failure('COPY-STRUCT-EVIDENCE', 'program.evidence', 'evidence must be an array')] };
  }
  const receipts = value.filter(isRecord);
  if (receipts.length !== value.length) failures.push(failure('COPY-STRUCT-EVIDENCE', 'program.evidence', 'every evidence receipt must be an object'));
  const byId = new Map<string, JsonRecord>();
  receipts.forEach((receipt, index) => {
    const path = `program.evidence[${index}]`;
    if (!isNonEmptyString(receipt.id)) {
      failures.push(failure('COPY-EVIDENCE-ID', `${path}.id`, 'receipt ID must be a non-empty string'));
    } else if (byId.has(receipt.id)) {
      failures.push(failure('COPY-EVIDENCE-DUPLICATE', `${path}.id`, `duplicate evidence ID ${receipt.id}`));
    } else {
      byId.set(receipt.id, receipt);
    }
    if (!['body-position', 'sky-event', 'solar-house'].includes(String(receipt.kind))
      || !isNonEmptyString(receipt.sourceId) || !isNonEmptyString(receipt.label) || !isInstant(receipt.at)) {
      failures.push(failure('COPY-EVIDENCE-SHAPE', path, 'receipt requires a supported kind, source, label, and canonical instant'));
    }
    if (receipt.sign !== undefined && !SIGN_SET.has(String(receipt.sign))) {
      failures.push(failure('COPY-EVIDENCE-SHAPE', `${path}.sign`, 'receipt sign is not canonical'));
    }
    if (receipt.degree !== undefined && !isDegree(receipt.degree)) {
      failures.push(failure('COPY-EVIDENCE-SHAPE', `${path}.degree`, 'receipt degree must be in [0, 30)'));
    }
    if (receipt.kind === 'body-position') {
      if (!BODY_NAMES.includes(receipt.body as (typeof BODY_NAMES)[number])
        || !SIGN_SET.has(String(receipt.sign)) || !isDegree(receipt.degree)
        || typeof receipt.retrograde !== 'boolean') {
        failures.push(failure('COPY-EVIDENCE-POSITION', path, 'body-position receipt requires a canonical body, sign, degree, and motion state'));
      }
      if (receipt.body === 'Moon' && !MOON_PHASE_SET.has(String(receipt.moonPhase))) {
        failures.push(failure('COPY-EVIDENCE-PHASE', `${path}.moonPhase`, 'Moon position receipt requires a canonical phase'));
      }
    }
    if (receipt.kind === 'sky-event') {
      const kind = String(receipt.eventKind);
      if (!['ingress', 'lunation', 'station', 'aspect', 'eclipse'].includes(kind)) {
        failures.push(failure('COPY-EVIDENCE-EVENT', `${path}.eventKind`, 'sky-event receipt requires a canonical event kind'));
      }
      if (kind === 'aspect' && (!BODY_NAMES.includes(receipt.a as (typeof BODY_NAMES)[number])
        || !BODY_NAMES.includes(receipt.b as (typeof BODY_NAMES)[number])
        || !ASPECT_TYPES.includes(receipt.eventType as (typeof ASPECT_TYPES)[number]) || receipt.orb !== 0)) {
        failures.push(failure('COPY-EVIDENCE-EVENT', path, 'aspect receipt requires both bodies, a major aspect type, and zero orb'));
      }
      if (kind === 'station' && (!BODY_NAMES.includes(receipt.body as (typeof BODY_NAMES)[number])
        || !['retrograde', 'direct'].includes(String(receipt.eventType)) || !SIGN_SET.has(String(receipt.sign)))) {
        failures.push(failure('COPY-EVIDENCE-EVENT', path, 'station receipt requires a body, direction, and sign'));
      }
      if (kind === 'ingress' && (!BODY_NAMES.includes(receipt.body as (typeof BODY_NAMES)[number])
        || !SIGN_SET.has(String(receipt.sign)))) {
        failures.push(failure('COPY-EVIDENCE-EVENT', path, 'ingress receipt requires a body and sign'));
      }
      if (kind === 'eclipse' && (!['solar', 'lunar'].includes(String(receipt.eventType))
        || !SIGN_SET.has(String(receipt.sign)))) {
        failures.push(failure('COPY-EVIDENCE-EVENT', path, 'eclipse receipt requires solar/lunar type and sign'));
      }
      if (kind === 'lunation' && (!['new', 'full'].includes(String(receipt.eventType))
        || !SIGN_SET.has(String(receipt.sign)))) {
        failures.push(failure('COPY-EVIDENCE-EVENT', path, 'lunation receipt requires new/full type and sign'));
      }
    }
    if (receipt.kind === 'solar-house'
      && (!isNonEmptyString(receipt.sourceFactId) || !SIGN_SET.has(String(receipt.sunSign)) || !isHouse(receipt.house))) {
      failures.push(failure('COPY-EVIDENCE-DERIVATION', path, 'solar-house receipt requires a source fact, sun sign, and house 1-12'));
    }
  });
  receipts.forEach((receipt, index) => {
    if (receipt.kind !== 'solar-house' || !isNonEmptyString(receipt.sourceFactId)) return;
    const source = byId.get(receipt.sourceFactId);
    const path = `program.evidence[${index}]`;
    if (!source || source.kind === 'solar-house') {
      failures.push(failure('COPY-EVIDENCE-DERIVATION', `${path}.sourceFactId`, 'solar-house source must be a known base receipt'));
      return;
    }
    if (source.at !== receipt.at) failures.push(failure('COPY-EVIDENCE-DERIVATION', path, 'solar-house instant must match its source fact'));
    if (source.kind === 'body-position' && (source.body !== receipt.body || source.sign !== receipt.sign)) {
      failures.push(failure('COPY-EVIDENCE-DERIVATION', path, 'solar-house body/sign must match its position source'));
    }
    const expectedHouse = typeof receipt.sign === 'string' && typeof receipt.sunSign === 'string'
      ? independentSolarHouse(receipt.sign, receipt.sunSign)
      : null;
    if (expectedHouse !== receipt.house) {
      failures.push(failure('COPY-EVIDENCE-DERIVATION', `${path}.house`, `solar-house mapping must be ${expectedHouse ?? 'derivable'}`));
    }
  });
  return { receipts, byId, failures };
}

/** Verify every program surface from serialized structure and evidence only. */
export function verifyHoroscopeProgramCopy(programValue: unknown): IndependentCopyViolation[] {
  if (!isRecord(programValue)) return [failure('COPY-STRUCT-ROOT', 'program', 'program must be an object')];
  const program = programValue;
  const failures: IndependentCopyViolation[] = [];
  if (program.schema !== 'zodiacs.horoscope-program.v1') failures.push(failure('COPY-STRUCT-SCHEMA', 'program.schema', 'unexpected horoscope program schema'));
  const anchorDate = isDate(program.anchorDate) ? program.anchorDate : null;
  if (!anchorDate) failures.push(failure('COPY-STRUCT-DATE', 'program.anchorDate', 'anchor date must be a real YYYY-MM-DD date'));
  if (program.locale !== 'en') failures.push(failure('COPY-STRUCT-LOCALE', 'program.locale', 'horoscope program locale must be en'));
  const policy = isRecord(program.policy) ? program.policy : null;
  if (!policy || policy.id !== 'org.zodiacs.horoscope-program.en' || policy.version !== '1.0.0'
    || policy.mode !== 'deterministic-template' || policy.model !== null || !isNonEmptyString(policy.rendererVersion)) {
    failures.push(failure('COPY-PROVENANCE-GENERATION', 'program.policy', 'program must identify the approved deterministic no-model policy'));
  }
  const coverage = isRecord(program.coverage) ? program.coverage : null;
  if (!coverage
    || !['complete', 'unavailable'].includes(String(coverage.today))
    || !['complete', 'unavailable'].includes(String(coverage.tomorrow))
    || !['complete', 'partial', 'unavailable'].includes(String(coverage.isoWeek))
    || !['complete', 'insufficient'].includes(String(coverage.yearly2027))) {
    failures.push(failure('COPY-STRUCT-COVERAGE', 'program.coverage', 'program coverage values are invalid'));
  }
  const evidence = programEvidence(program.evidence);
  failures.push(...evidence.failures);
  if (!Array.isArray(program.signs)) {
    failures.push(failure('COPY-STRUCT-SIGNS', 'program.signs', 'signs must be an array'));
    return sortedUnique(failures);
  }
  const signs = program.signs.filter(isRecord);
  if (signs.length !== 12 || signs.length !== program.signs.length
    || signs.some((entry, index) => entry.sign !== SIGN_SLUGS[index])) {
    failures.push(failure('COPY-STRUCT-SIGNS', 'program.signs', 'all twelve signs must appear in canonical order'));
  }
  const surfaceTexts = new Map<ProgramSurface, Array<{ sign: string; text: string }>>(
    PROGRAM_SURFACES.map((surface) => [surface, []]),
  );

  signs.forEach((signProgram, signIndex) => {
    const sign = isNonEmptyString(signProgram.sign) ? signProgram.sign : '';
    const readings = isRecord(signProgram.readings) ? signProgram.readings : null;
    const path = `program.signs[${signIndex}].readings`;
    if (!readings) {
      failures.push(failure('COPY-STRUCT-READINGS', path, 'readings must be an object'));
      return;
    }
    const actualKeys = Object.keys(readings).sort().join(',');
    const expectedKeys = [...PROGRAM_SURFACES].sort().join(',');
    if (actualKeys !== expectedKeys) failures.push(failure('COPY-STRUCT-READINGS', path, 'readings must contain exactly the six Phase 1 surfaces'));

    for (const surface of PROGRAM_SURFACES) {
      const readingPath = `${path}.${surface}`;
      const reading = isRecord(readings[surface]) ? readings[surface] : null;
      if (!reading) {
        failures.push(failure('COPY-STRUCT-READING', readingPath, 'reading is missing or malformed'));
        continue;
      }
      if (reading.surface !== surface || reading.sign !== sign) {
        failures.push(failure('COPY-STRUCT-READING', readingPath, 'reading surface/sign is inconsistent'));
      }
      if (!isNonEmptyString(reading.title) || /<[^>]+>/.test(String(reading.title))) {
        failures.push(failure('COPY-STRUCT-TITLE', `${readingPath}.title`, 'reading title must be non-empty plain text'));
      }
      const period = isRecord(reading.period) ? reading.period : null;
      const expectedPeriod = anchorDate ? expectedProgramPeriod(anchorDate, surface) : null;
      if (!period || period.utcBasis !== true || !isDate(period.from) || !isDate(period.through)
        || (expectedPeriod && (period.from !== expectedPeriod.from || period.through !== expectedPeriod.through))) {
        failures.push(failure('COPY-STRUCT-PERIOD', `${readingPath}.period`, 'reading period is not the canonical UTC period for its surface'));
      }
      const publishable = reading.status === 'publishable';
      if (!publishable && reading.status !== 'insufficient-evidence') {
        failures.push(failure('COPY-STRUCT-STATUS', `${readingPath}.status`, 'reading status is invalid'));
      }
      if (coverage && publishable !== expectedPublishable(coverage, surface)) {
        failures.push(failure('COPY-STRUCT-STATUS', `${readingPath}.status`, 'reading status conflicts with declared coverage'));
      }
      if (!Array.isArray(reading.passages) || reading.passages.some((passage) => !isRecord(passage))) {
        failures.push(failure('COPY-STRUCT-PASSAGES', `${readingPath}.passages`, 'passages must be an array of objects'));
        continue;
      }
      const passages = reading.passages as JsonRecord[];
      if (!passages.length) failures.push(failure('COPY-STRUCT-PASSAGES', `${readingPath}.passages`, 'reading must contain at least one passage'));
      const joined = passages.map((passage) => typeof passage.text === 'string' ? passage.text : '').join('\n\n');
      if (typeof reading.text !== 'string' || reading.text !== joined
        || !Number.isInteger(reading.wordCount) || reading.wordCount !== independentWordCount(joined)) {
        failures.push(failure('COPY-LENGTH-DECLARATION', readingPath, 'text and wordCount must exactly match the passage text'));
      }
      if (typeof reading.text === 'string') {
        failures.push(...programVoiceViolations(reading.text, `${readingPath}.text`));
      }
      passages.forEach((passage, passageIndex) => {
        const passagePath = `${readingPath}.passages[${passageIndex}]`;
        if (!isNonEmptyString(passage.text) || passage.text !== passage.text.trim()) {
          failures.push(failure('COPY-STRUCT-TEXT', `${passagePath}.text`, 'passage text must be non-empty and trimmed'));
          return;
        }
        failures.push(...programVoiceViolations(passage.text, `${passagePath}.text`));
        const refs = stringArray(passage.evidenceRefs);
        if (publishable && !refs?.length) {
          failures.push(failure('COPY-EVIDENCE-MISSING', `${passagePath}.evidenceRefs`, 'publishable passage must cite evidence'));
          return;
        }
        if (!refs) {
          failures.push(failure('COPY-EVIDENCE-SHAPE', `${passagePath}.evidenceRefs`, 'evidence refs must be non-empty strings'));
          return;
        }
        if (new Set(refs).size !== refs.length) failures.push(failure('COPY-EVIDENCE-DUPLICATE', `${passagePath}.evidenceRefs`, 'evidence refs must be unique'));
        const receipts = refs.map((ref) => evidence.byId.get(ref));
        for (let index = 0; index < refs.length; index += 1) {
          const receipt = receipts[index];
          if (!receipt) {
            failures.push(failure('COPY-EVIDENCE-UNKNOWN', `${passagePath}.evidenceRefs`, `unknown evidence ID ${refs[index]}`));
            continue;
          }
          if (period && isInstant(receipt.at) && (receipt.at.slice(0, 10) < String(period.from) || receipt.at.slice(0, 10) > String(period.through))) {
            failures.push(failure('COPY-EVIDENCE-PERIOD', `${passagePath}.evidenceRefs`, `${refs[index]} falls outside the reading period`));
          }
        }
        if (publishable) {
          const derived = receipts.filter((receipt): receipt is JsonRecord => isRecord(receipt) && receipt.kind === 'solar-house');
          if (!derived.length) failures.push(failure('COPY-EVIDENCE-DERIVATION', `${passagePath}.evidenceRefs`, 'publishable passage must cite sign-specific solar-house evidence'));
          for (const receipt of derived) {
            if (receipt.sunSign !== sign) failures.push(failure('COPY-EVIDENCE-SIGN', `${passagePath}.evidenceRefs`, `solar-house evidence belongs to ${String(receipt.sunSign)}, not ${sign}`));
            if (isNonEmptyString(receipt.sourceFactId) && !refs.includes(receipt.sourceFactId)) {
              failures.push(failure('COPY-EVIDENCE-PAIR', `${passagePath}.evidenceRefs`, 'solar-house evidence must be paired with its source fact'));
            }
          }
          failures.push(...programSemanticViolations(
            passage.text,
            receipts.filter(isRecord),
            `${passagePath}.text`,
            surface,
            passageIndex,
            passages.length,
          ));
          const firstSentence = passage.text.split(/(?<=[.!?])\s/u, 1)[0] ?? passage.text;
          if (BACKSTAGE_COPY.test(passage.text)) failures.push(failure('COPY-VOICE-BACKSTAGE', `${passagePath}.text`, 'reader copy exposes publishing or verification plumbing'));
          if (KITCHEN_FIRST_OPENING.test(firstSentence)) failures.push(failure('COPY-VOICE-KITCHEN-FIRST', `${passagePath}.text`, 'passage must open with meaning or action before astrological mechanics'));
        } else if (refs.length) {
          failures.push(failure('COPY-FALLBACK-EVIDENCE', `${passagePath}.evidenceRefs`, 'fallback copy may not imply supporting evidence'));
        }
      });

      if (publishable) {
        if (isNonEmptyString(reading.fallbackReason)) failures.push(failure('COPY-STRUCT-FALLBACK', `${readingPath}.fallbackReason`, 'publishable reading may not have a fallback reason'));
        const bounds = PROGRAM_WORD_BOUNDS[surface];
        const count = independentWordCount(joined);
        if (count < bounds.min || count > bounds.max) {
          failures.push(failure('COPY-LENGTH-WORDS', `${readingPath}.text`, `${count} words is outside ${bounds.min}-${bounds.max}`));
        }
        // Long-form yearly chapters deliberately revisit dated evidence in
        // chronological and thematic sections. Short-form editions should
        // never repeat or closely paraphrase an action inside one reading.
        if (surface !== 'yearly-2027') {
          failures.push(...intraReadingActionViolations(joined, `${readingPath}.text`));
        }
        surfaceTexts.get(surface)?.push({ sign, text: joined });
      } else if (!isNonEmptyString(reading.fallbackReason)) {
        failures.push(failure('COPY-STRUCT-FALLBACK', `${readingPath}.fallbackReason`, 'insufficient reading requires an explicit reason'));
      }
    }
  });

  for (const surface of PROGRAM_SURFACES) {
    const candidates = surfaceTexts.get(surface) ?? [];
    for (let left = 0; left < candidates.length; left += 1) {
      for (let right = left + 1; right < candidates.length; right += 1) {
        const path = `program.signs.${candidates[left].sign}/${candidates[right].sign}.readings.${surface}`;
        if (normalizedText(candidates[left].text) === normalizedText(candidates[right].text)) {
          failures.push(failure('COPY-DIST-EXACT', path, 'reading copy is duplicated across signs'));
        }
        const score = independentShingleJaccard(candidates[left].text, candidates[right].text, 3);
        if (score > PROGRAM_DISTINCTNESS_LIMITS[surface]) {
          failures.push(failure('COPY-DIST-SIMILARITY', path, `trigram Jaccard ${score.toFixed(3)} exceeds ${PROGRAM_DISTINCTNESS_LIMITS[surface]}`));
        }
      }
    }
  }

  const todayReadings = surfaceTexts.get('today') ?? [];
  const tomorrowReadings = surfaceTexts.get('tomorrow') ?? [];
  for (const sign of SIGN_SLUGS) {
    const today = todayReadings.find((candidate) => candidate.sign === sign);
    const tomorrow = tomorrowReadings.find((candidate) => candidate.sign === sign);
    if (!today || !tomorrow) continue;
    const score = independentShingleJaccard(today.text, tomorrow.text, 3);
    if (score <= PROGRAM_TODAY_TOMORROW_JACCARD_LIMIT) continue;
    failures.push(failure(
      'COPY-DIST-TODAY-TOMORROW',
      `program.signs.${sign}.readings.today/tomorrow`,
      `same-sign trigram Jaccard ${score.toFixed(3)} exceeds ${PROGRAM_TODAY_TOMORROW_JACCARD_LIMIT}`,
    ));
  }

  const sentenceUses = new Map<string, {
    sentence: string;
    signs: Set<string>;
    readings: Set<string>;
  }>();
  for (const surface of PROGRAM_SURFACES) {
    for (const candidate of surfaceTexts.get(surface) ?? []) {
      for (const sentence of independentSentences(candidate.text)) {
        const normalized = normalizedText(sentence);
        const use = sentenceUses.get(normalized) ?? {
          sentence,
          signs: new Set<string>(),
          readings: new Set<string>(),
        };
        use.signs.add(candidate.sign);
        use.readings.add(`${candidate.sign}/${surface}`);
        sentenceUses.set(normalized, use);
      }
    }
  }
  for (const use of sentenceUses.values()) {
    if (use.signs.size <= PROGRAM_MAX_EXACT_SENTENCE_SIGN_REUSE) continue;
    failures.push(failure(
      'COPY-DIST-SENTENCE-REUSE',
      'program.signs.*.readings.*.text',
      `exact sentence appears for ${use.signs.size} signs across ${use.readings.size} readings; maximum is ${PROGRAM_MAX_EXACT_SENTENCE_SIGN_REUSE}: ${use.sentence}`,
    ));
  }
  return sortedUnique(failures);
}
