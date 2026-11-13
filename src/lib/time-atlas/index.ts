/**
 * The engine repository's time atlas (atlas/, version 0.1.0, CC BY 4.0): what
 * the clocks said in 21 places of France and the United States from
 * 1 January 1870 to the end of 1919, each rule cited from primary sources and
 * flagged documented, inferred or uncertain. The compute API's time endpoint
 * and resolve_birth_time read a wall time on it for a place the request names,
 * beside tzdb's reading. The data is copied from the engine repository at the
 * commit below; the tests hold each file to its digest and the resolver to
 * readings the engine repository's own resolver produced.
 */
import manifest from '../../data/time-atlas/atlas.json';
import places from '../../data/time-atlas/places.json';
import leads from '../../data/time-atlas/leads.json';
import citationsFr from '../../data/time-atlas/citations-fr.json';
import rulesFr from '../../data/time-atlas/rules-fr.json';
import citationsAls from '../../data/time-atlas/citations-als.json';
import rulesAls from '../../data/time-atlas/rules-als.json';
import citationsUs from '../../data/time-atlas/citations-us.json';
import rulesUs from '../../data/time-atlas/rules-us.json';
import explanations from '../../data/time-atlas/tzdb-explanations.json';
import { loadAtlas, resolve, type LoadedAtlas } from './lib.mjs';

export const ATLAS_COMMIT = '7307665bdbc432269fdac006104f661be16000bc';

/** Where the atlas comes from, as a reply names it. */
export const ATLAS_SOURCE = Object.freeze({
  name: manifest.name,
  version: manifest.version,
  licence: 'CC BY 4.0',
  url: `https://github.com/zodiacs-org/engine/tree/${ATLAS_COMMIT}/atlas`,
} as const);

/** The places the atlas lists, by id: the only places it is read for. */
export const ATLAS_PLACES = Object.freeze(places.places.map(({ id }) => id)) as readonly string[];
export const ATLAS_COVERAGE = Object.freeze({ start: manifest.coverage.start, end: manifest.coverage.end });

const FILES: Record<string, unknown> = {
  'places.json': places,
  'leads.json': leads,
  'citations-fr.json': citationsFr,
  'rules-fr.json': rulesFr,
  'citations-als.json': citationsAls,
  'rules-als.json': rulesAls,
  'citations-us.json': citationsUs,
  'rules-us.json': rulesUs,
  'tzdb-explanations.json': explanations,
};

let atlas: LoadedAtlas | null = null;
function loaded(): LoadedAtlas {
  atlas ??= loadAtlas(manifest, FILES);
  return atlas;
}

export interface AtlasCitation {
  id: string;
  title: string;
  date: string | null;
  url: string;
  locator: string | null;
  gloss: string | null;
}

export interface AtlasInstant {
  /** UTC, ISO 8601 with milliseconds, as the compute API writes instants. */
  utc: string;
  /** The place's clock, seconds east of UTC; a mean time is to the millisecond. */
  offsetSeconds: number;
  rule: string;
  ruleVersion: number;
  isDst: boolean;
  abbreviation: string | null;
  uncertainty: { flag: 'documented' | 'inferred' | 'uncertain'; reasons: string[] };
  citations: AtlasCitation[];
}

export interface AtlasReading {
  place: string;
  name: string;
  jurisdiction: string;
  clock: 'civil';
  status: 'ok' | 'ambiguous' | 'nonexistent' | 'out-of-coverage';
  instants: AtlasInstant[];
  skipped: { from: string; to: string } | null;
}

function citation(id: string): AtlasCitation {
  const found = loaded().citations.get(id) as Record<string, string | undefined> | undefined;
  if (!found) throw new Error(`the atlas cites ${id}, which it does not list`);
  return {
    id,
    title: found.title ?? id,
    date: found.date ?? null,
    url: found.url ?? '',
    locator: found.locator ?? null,
    gloss: found.gloss ?? null,
  };
}

/**
 * What a place's civil clock meant by a wall time (a proleptic Gregorian date
 * and HH:MM), as the atlas reads it: one instant, every instant of a repeated
 * reading, the instant a skipped reading denotes on the clock before the
 * change, or none outside the atlas's window. Each instant names its rule,
 * the rule's uncertainty with its reasons, and the rule's citations.
 */
export function atlasReading(place: string, date: string, time: string): AtlasReading {
  const result = resolve(loaded(), place, `${date}T${time}:00`, 'civil');
  if (result.status === 'no-such-clock') throw new Error('every jurisdiction of the atlas keeps a civil clock');
  return {
    place,
    name: String(loaded().places.get(place)?.name ?? place),
    jurisdiction: result.jurisdiction,
    clock: 'civil',
    status: result.status,
    instants: result.instants.map((reading) => ({
      utc: new Date(reading.utcMs).toISOString(),
      offsetSeconds: reading.offsetSeconds,
      rule: reading.rule,
      ruleVersion: reading.ruleVersion,
      isDst: reading.isDst,
      abbreviation: reading.abbreviation,
      uncertainty: { flag: reading.uncertainty.flag, reasons: [...reading.uncertainty.reasons] },
      citations: reading.citations.map(citation),
    })),
    skipped: result.skipped ?? null,
  };
}
