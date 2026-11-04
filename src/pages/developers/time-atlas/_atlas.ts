/**
 * The data behind /developers/time-atlas/ (B3.c): pure functions over the
 * published files of the time atlas 0.1.0, under
 * public/developers/time-atlas/0.1.0/, that make the rows, joins and counts
 * the page shows. It holds no prose; every sentence is in index.astro.
 *
 * The comparison is read from TZDB-DIFFERENCES.md, which lists every period
 * of every comparison, and joined row by row to tzdb/differences.json, which
 * holds the differing periods with their explanations. Every function throws
 * on a row it cannot read, so a changed file fails the build rather than
 * showing part of the comparison. The leading underscore keeps this file out
 * of Astro's routes.
 */
import filesIndex from '../../../../public/developers/time-atlas/0.1.0/files.json';
import manifestFile from '../../../../public/developers/time-atlas/0.1.0/data/atlas.json';
import placesFile from '../../../../public/developers/time-atlas/0.1.0/data/places.json';
import citationsFr from '../../../../public/developers/time-atlas/0.1.0/data/citations-fr.json';
import rulesFr from '../../../../public/developers/time-atlas/0.1.0/data/rules-fr.json';
import citationsAls from '../../../../public/developers/time-atlas/0.1.0/data/citations-als.json';
import rulesAls from '../../../../public/developers/time-atlas/0.1.0/data/rules-als.json';
import citationsUs from '../../../../public/developers/time-atlas/0.1.0/data/citations-us.json';
import rulesUs from '../../../../public/developers/time-atlas/0.1.0/data/rules-us.json';
import explanationsFile from '../../../../public/developers/time-atlas/0.1.0/data/tzdb-explanations.json';
import differencesFile from '../../../../public/developers/time-atlas/0.1.0/tzdb/differences.json';
import reportText from '../../../../public/developers/time-atlas/0.1.0/TZDB-DIFFERENCES.md?raw';
import indexText from '../../../../public/developers/time-atlas/0.1.0/files.json?raw';
import { createHash } from 'node:crypto';

export interface IndexedFile { path: string; source: string; bytes: number; sha256: string; gitBlob: string }
export interface FilesIndex {
  schema: string;
  name: string;
  version: string;
  license: string;
  licenseUrl: string;
  source: { repository: string; commit: string; tree: string; path: string };
  files: IndexedFile[];
}
export interface Manifest {
  name: string;
  version: string;
  license: string;
  coverage: { start: string; end: string; countries: string[] };
  files: string[];
  longitudeSource: {
    dataset: string; url: string; retrieved: string; sha256: string;
    license: string; licenseUrl: string; attribution: string; changes: string;
  };
}
export interface Place {
  id: string; name: string; country: string; admin1: string; jurisdiction: string;
  tzdbZone: string; compareZones?: string[];
}
export interface RuleChange { version: number; date: string; summary: string }
export interface Rule {
  id: string; version: number; title: string; clock: string;
  uncertainty: { flag: 'documented' | 'inferred' | 'uncertain'; reason: string };
  changes?: RuleChange[];
}
export interface Citation {
  id: string; title: string; date: string; issuer?: string; publication?: string;
  url: string; locator: string; language: string; gloss?: string; excerpt?: string;
}
export interface Explanation {
  id: string; category: string; explanation: string; tzdbReport?: string; citations: string[];
}
export interface Difference {
  place: string; zone: string; from: string; to: string; atlasRule: string;
  atlasOffset: string; atlasOffsetSeconds: number; tzdbOffset: string; tzdbOffsetSeconds: number;
  tzdbAbbreviation: string; differenceSeconds: number; explanation: string;
}

export const INDEX = filesIndex as unknown as FilesIndex;
export const MANIFEST = manifestFile as unknown as Manifest;
export const VERSION = INDEX.version;
export const FOLDER = `/developers/time-atlas/${VERSION}`;
export const SOURCE_URL = `${INDEX.source.repository}/tree/${INDEX.source.commit}/${INDEX.source.path}`;
/** files.json itself, as served: its size and SHA-256. It lists the other files, not itself. */
export const INDEX_FILE = Object.freeze({
  path: 'files.json',
  bytes: Buffer.byteLength(indexText, 'utf8'),
  sha256: createHash('sha256').update(indexText, 'utf8').digest('hex'),
});

const PLACES = (placesFile as unknown as { places: Place[] }).places;
const RULE_FILES = [['fr', rulesFr], ['als', rulesAls], ['us', rulesUs]] as const;
const CITATION_FILES = [citationsFr, citationsAls, citationsUs] as unknown as { citations: Citation[] }[];
const EXPLANATIONS = (explanationsFile as unknown as { explanations: Explanation[] }).explanations;
const DIFFERENCES = (differencesFile as unknown as { differences: Difference[] }).differences;

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/-+$/u, '');

/** The anchor of a place and zone's comparison, such as fr-strasbourg-europe-berlin. */
export const pairId = (place: string, zone: string) => `${place}-${slug(zone)}`;
/** The anchor of one period of a comparison; no two periods of one comparison start together. */
export const rowId = (place: string, zone: string, from: string) => `${pairId(place, zone)}-${slug(from)}`;
export const ruleAnchor = (id: string) => `rule-${id}`;
export const citationAnchor = (id: string) => `cite-${id}`;

/** The media type zodiacs.org serves a published file with. */
export function mediaType(path: string): string {
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.md')) return 'text/markdown';
  if (path.endsWith('.txt')) return 'text/plain';
  throw new Error(`time atlas: no media type for ${path}`);
}

/** The atlas's span as dates: its first day, and the day before its end when the end is a local midnight. */
export function temporalCoverage(manifest: Pick<Manifest, 'coverage'>): string {
  const { start, end } = manifest.coverage;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u.test(start) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u.test(end)) {
    throw new Error('time atlas: the coverage does not parse');
  }
  const last = end.endsWith('T00:00:00')
    ? new Date(Date.parse(`${end.slice(0, 10)}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    : end.slice(0, 10);
  return `${start.slice(0, 10)}/${last}`;
}

/** The lines of one "## " section of the report, without its heading. */
function section(markdown: string, heading: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.indexOf(`## ${heading}`);
  if (start < 0) throw new Error(`time atlas: the report has no section ${heading}`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/** The table rows of a section, header and rule lines left out. */
function tableRows(lines: string[]): string[] {
  return lines.filter((line) => line.startsWith('| ') && !line.startsWith('| ---') && !/^\| (?:place|from \(UTC\)) \|/u.test(line));
}

export interface ComparisonBase {
  tzdb: string; tarballSha256: string; treeFiles: number; treeSha256: string; window: [string, string];
}

export function comparisonBase(markdown: string): ComparisonBase {
  const text = section(markdown, 'What is compared').join('\n');
  const tzdb = /tzdb (\d{4}[a-z]) with backzone/u.exec(text)?.[1];
  const tarball = /tarball's SHA-256 is `([0-9a-f]{64})`/u.exec(text)?.[1];
  const tree = /\((\d+) files, `([0-9a-f]{64})`\)/u.exec(text);
  const window = /\((\S+) to (\S+), local time\)/u.exec(text);
  if (!tzdb || !tarball || !tree || !window) throw new Error('time atlas: the base does not parse');
  return { tzdb, tarballSha256: tarball, treeFiles: Number(tree[1]), treeSha256: tree[2], window: [window[1], window[2]] };
}

export interface SummaryRow {
  name: string; place: string; zone: string; informational: boolean;
  compared: number; agree: number; differ: number; rounding: number; daysDiffering: string;
}

const SUMMARY_ROW = /^\| (.+?) \(`([a-z0-9-]+)`\) \| (.+?)( \(for information\))? \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| ([\d.]+) \|$/u;

export function summaryRows(markdown: string): SummaryRow[] {
  return tableRows(section(markdown, 'Summary')).map((line) => {
    const match = SUMMARY_ROW.exec(line);
    if (!match) throw new Error('time atlas: a summary row does not parse');
    return {
      name: match[1], place: match[2], zone: match[3], informational: Boolean(match[4]),
      compared: Number(match[5]), agree: Number(match[6]), differ: Number(match[7]), rounding: Number(match[8]),
      daysDiffering: match[9],
    };
  });
}

export interface Span { from: string; to: string }
export interface AgreementRow { place: string; zone: string; informational: boolean; spans: Span[] }

const AGREEMENT_ROW = /^\| (.+?) \(`([a-z0-9-]+)`\) \| (.+?)( \(for information\))? \| (.+) \|$/u;
const SPAN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}) to (\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/u;

export function agreementSpans(markdown: string): AgreementRow[] {
  return tableRows(section(markdown, 'Where they agree')).map((line) => {
    const match = AGREEMENT_ROW.exec(line);
    if (!match) throw new Error('time atlas: an agreement row does not parse');
    const spans = match[5].split('; ').map((text) => {
      const span = SPAN.exec(text);
      if (!span) throw new Error('time atlas: an agreement span does not parse');
      return { from: span[1], to: span[2] };
    });
    return { place: match[2], zone: match[3], informational: Boolean(match[4]), spans };
  });
}

export type Result =
  | { kind: 'agrees' }
  | { kind: 'rounding'; ms: number }
  | { kind: 'differs'; seconds: string };

export interface PeriodRow {
  from: string; to: string; length: string; rule: string;
  atlasOffset: string; tzdbOffset: string; tzdbAbbreviation: string; result: Result;
}
export interface PlaceTable { name: string; place: string; zone: string; informational: boolean; rows: PeriodRow[] }

const TABLE_HEADING = /^### (.+?) \(`([a-z0-9-]+)`\) against (\S+)( \(for information\))?$/u;
const OFFSET = String.raw`[+-]\d+:\d{2}:\d{2}(?:\.\d+)?`;
const PERIOD_ROW = new RegExp(String.raw`^\| (\S+) \| (\S+) \| ([\d.]+ (?:d|h|min|s)) \| \x60([a-z0-9-]+)\x60 \| (${OFFSET}) \| (${OFFSET}) (\S+) \| (agrees|rounding \((\d+) ms\)|differs by (-?[\d.]+) s) \|$`, 'u');

export function placeTables(markdown: string): PlaceTable[] {
  const tables: PlaceTable[] = [];
  for (const line of section(markdown, 'Place by place')) {
    const heading = TABLE_HEADING.exec(line);
    if (heading) {
      tables.push({ name: heading[1], place: heading[2], zone: heading[3], informational: Boolean(heading[4]), rows: [] });
      continue;
    }
    if (line.startsWith('### ')) throw new Error('time atlas: a place heading does not parse');
    if (!tableRows([line]).length) continue;
    const row = PERIOD_ROW.exec(line);
    const table = tables.at(-1);
    if (!row || !table) throw new Error('time atlas: a period row does not parse');
    const result: Result = row[8] === 'agrees'
      ? { kind: 'agrees' }
      : row[9] !== undefined ? { kind: 'rounding', ms: Number(row[9]) } : { kind: 'differs', seconds: row[10] };
    table.rows.push({
      from: row[1], to: row[2], length: row[3], rule: row[4],
      atlasOffset: row[5], tzdbOffset: row[6], tzdbAbbreviation: row[7], result,
    });
  }
  return tables;
}

export interface JoinedRow extends PeriodRow { place: string; zone: string; explanation: string | null }

/**
 * The place tables' periods in order, each differing one joined to the next
 * entry of differences.json, which must name the same place, zone, from, to,
 * rule, both offsets, abbreviation and seconds.
 */
export function joinDifferences(tables: PlaceTable[], differences: Difference[]): JoinedRow[] {
  const joined: JoinedRow[] = [];
  let next = 0;
  for (const table of tables) {
    for (const row of table.rows) {
      if (row.result.kind !== 'differs') {
        joined.push({ ...row, place: table.place, zone: table.zone, explanation: null });
        continue;
      }
      const entry = differences[next];
      const same = entry !== undefined && entry.place === table.place && entry.zone === table.zone
        && entry.from === row.from && entry.to === row.to && entry.atlasRule === row.rule
        && entry.atlasOffset === row.atlasOffset && entry.tzdbOffset === row.tzdbOffset
        && entry.tzdbAbbreviation === row.tzdbAbbreviation && entry.differenceSeconds === Number(row.result.seconds);
      if (!same) throw new Error(`time atlas: difference ${next + 1} does not match the row of ${table.place} against ${table.zone} from ${row.from}`);
      joined.push({ ...row, place: table.place, zone: table.zone, explanation: entry.explanation });
      next += 1;
    }
  }
  if (next !== differences.length) {
    const entry = differences[next];
    throw new Error(`time atlas: difference ${next + 1} (${entry.place} against ${entry.zone} from ${entry.from}) has no row`);
  }
  return joined;
}

export interface ViewerRule {
  id: string; group: 'fr' | 'als' | 'us'; title: string; version: number; clock: string;
  flag: Rule['uncertainty']['flag']; reason: string; changes: RuleChange[];
}
export interface ViewerPeriod extends JoinedRow { id: string | null; ruleVersion: number; ruleFlag: string }
export interface ViewerPair {
  id: string; name: string; place: string; zone: string; informational: boolean; admin1: string; country: string;
  summary: SummaryRow; agree: Span[]; periods: ViewerPeriod[];
}
export interface ViewerExplanation extends Explanation { count: number; pairs: string[] }
export type ViewerCitation = Omit<Citation, 'excerpt'>;

/** The citations an explanation list names, each once, in order of first citation; throws on an id no file has. */
export function citedSources(explanations: Explanation[], files: { citations: Citation[] }[]): ViewerCitation[] {
  const all = new Map(files.flatMap((file) => file.citations).map((citation) => [citation.id, citation]));
  const cited: ViewerCitation[] = [];
  const seen = new Set<string>();
  for (const explanation of explanations) {
    for (const id of explanation.citations) {
      const citation = all.get(id);
      if (!citation) throw new Error(`time atlas: no citation ${id}`);
      if (seen.has(id)) continue;
      seen.add(id);
      cited.push({
        id: citation.id, title: citation.title, date: citation.date, issuer: citation.issuer, publication: citation.publication,
        url: citation.url, locator: citation.locator, language: citation.language, gloss: citation.gloss,
      });
    }
  }
  return cited;
}

export function atlasViewer(
  report: string = reportText,
  differences: Difference[] = DIFFERENCES,
  explanations: Explanation[] = EXPLANATIONS,
) {
  const summary = summaryRows(report);
  const agreement = agreementSpans(report);
  const tables = placeTables(report);
  const rows = joinDifferences(tables, differences);
  const rules: ViewerRule[] = RULE_FILES.flatMap(([group, file]) => (file as unknown as { rules: Rule[] }).rules.map((rule) => ({
    id: rule.id, group, title: rule.title, version: rule.version, clock: rule.clock,
    flag: rule.uncertainty.flag, reason: rule.uncertainty.reason, changes: rule.changes ?? [],
  })));
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const placeById = new Map(PLACES.map((place) => [place.id, place]));
  const key = (place: string, zone: string) => `${place}|${zone}`;
  if (summary.length !== tables.length || agreement.length !== tables.length) throw new Error('time atlas: the report tables differ in length');

  let cursor = 0;
  const pairs: ViewerPair[] = tables.map((table, index) => {
    const row = summary[index];
    const agree = agreement[index];
    const place = placeById.get(table.place);
    if (!place || key(row.place, row.zone) !== key(table.place, table.zone) || key(agree.place, agree.zone) !== key(table.place, table.zone)
        || row.informational !== table.informational || agree.informational !== table.informational) {
      throw new Error(`time atlas: the tables of ${table.place} against ${table.zone} disagree`);
    }
    const periods = rows.slice(cursor, cursor + table.rows.length).map((period) => {
      const rule = ruleById.get(period.rule);
      if (!rule) throw new Error(`time atlas: no rule ${period.rule}`);
      return {
        ...period,
        id: period.result.kind === 'differs' ? rowId(table.place, table.zone, period.from) : null,
        ruleVersion: rule.version,
        ruleFlag: rule.flag,
      };
    });
    cursor += table.rows.length;
    const count = (kind: Result['kind']) => periods.filter((period) => period.result.kind === kind).length;
    if (row.compared !== periods.length || row.agree !== count('agrees') || row.differ !== count('differs') || row.rounding !== count('rounding')) {
      throw new Error(`time atlas: the summary of ${table.place} against ${table.zone} does not count its table`);
    }
    return {
      id: pairId(table.place, table.zone), name: table.name, place: table.place, zone: table.zone,
      informational: table.informational, admin1: place.admin1, country: place.country,
      summary: row, agree: agree.spans, periods,
    };
  });

  const differing = pairs.flatMap((pair) => pair.periods.filter((period) => period.explanation));
  const known = new Set(explanations.map((explanation) => explanation.id));
  for (const period of differing) if (!known.has(period.explanation!)) throw new Error(`time atlas: no explanation ${period.explanation}`);
  const viewerExplanations: ViewerExplanation[] = explanations.map((explanation) => {
    const own = differing.filter((period) => period.explanation === explanation.id);
    return { ...explanation, count: own.length, pairs: [...new Set(own.map((period) => pairId(period.place, period.zone)))] };
  });

  const sum = (pick: (row: SummaryRow) => number) => summary.reduce((total, row) => total + pick(row), 0);
  const allRules = rules.length;
  const flags = (flag: string) => rules.filter((rule) => rule.flag === flag).length;
  return {
    version: VERSION,
    commit: INDEX.source.commit,
    tree: INDEX.source.tree,
    sourceUrl: SOURCE_URL,
    files: INDEX.files,
    manifest: MANIFEST,
    base: comparisonBase(report),
    counts: {
      places: PLACES.length,
      jurisdictions: RULE_FILES.reduce((total, [, file]) => total + (file as unknown as { jurisdictions: unknown[] }).jurisdictions.length, 0),
      rules: allRules,
      citations: CITATION_FILES.reduce((total, file) => total + file.citations.length, 0),
      documented: flags('documented'),
      inferred: flags('inferred'),
      uncertain: flags('uncertain'),
      changeEntries: rules.reduce((total, rule) => total + rule.changes.length, 0),
    },
    totals: {
      comparisons: summary.length,
      compared: sum((row) => row.compared),
      agree: sum((row) => row.agree),
      rounding: sum((row) => row.rounding),
      differ: sum((row) => row.differ),
      withDifference: summary.filter((row) => row.differ > 0).length,
      ownZone: differing.filter((period) => !pairs.find((pair) => pair.place === period.place && pair.zone === period.zone)!.informational).length,
      informational: differing.filter((period) => pairs.find((pair) => pair.place === period.place && pair.zone === period.zone)!.informational).length,
      spans: agreement.reduce((total, row) => total + row.spans.length, 0),
    },
    pairs,
    explanations: viewerExplanations,
    citations: citedSources(explanations, CITATION_FILES),
    rules,
  };
}

export type AtlasViewer = ReturnType<typeof atlasViewer>;
