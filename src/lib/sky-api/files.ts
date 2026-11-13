/**
 * Composes every file the sky data API publishes from one set of sources.
 * Returns relative paths under /api/v1/ mapped to their exact bytes, so the
 * build script, the tests, and the byte-stability checks all see the same
 * output.
 */
import { API_VERSION, PLANET_SLUGS } from './meta';
import {
  buildAspectYear, buildEclipseYear, buildIndex, buildIngressYear, buildMoonPhaseYear, buildPlanet,
  buildRetrogradeYear, buildSigns, buildStationYear, buildToday, buildUpcoming,
  completeTransitYears, dataVintage, yearLinks, yearsWithin,
} from './build';
import type { YearFamily } from './build';
import { SCHEMAS, SCHEMA_NAMES, buildOpenApi } from './schemas';
import { renderAgentGuide, renderTodayMarkdown, renderUpcomingMarkdown } from './text';
import type { SkyApiSources } from './types';

export interface SkyApiBuild {
  files: Map<string, string>;
  payloads: Map<string, Record<string, unknown>>;
  transitYears: number[];
  skyYears: number[];
  eclipseYears: number[];
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildSkyApi(sources: SkyApiSources, { generatedAt }: { generatedAt: string }): SkyApiBuild {
  const { daily, sky, eclipses, months } = sources;
  const transitYears = completeTransitYears(months.map((month) => month.month));
  const skyYears = yearsWithin(transitYears, sky.from, sky.to);
  const eclipseYears = yearsWithin(transitYears, eclipses.from, eclipses.to);
  const vintage = dataVintage(sky, eclipses);

  const payloads = new Map<string, Record<string, unknown>>();
  payloads.set('sky/today.json', buildToday({ daily, sky, months, generatedAt }));
  payloads.set('sky/upcoming.json', buildUpcoming({ daily, sky, eclipses, months, generatedAt }));
  payloads.set('signs.json', buildSigns({ daily, months, generatedAt }));
  for (const slug of PLANET_SLUGS) {
    payloads.set(`planets/${slug}.json`, buildPlanet({ slug, daily, sky, months, generatedAt }));
  }
  const yearCoverage: Record<YearFamily, number[]> = {
    retrogrades: skyYears,
    stations: transitYears,
    ingresses: transitYears,
    'moon-phases': skyYears,
    eclipses: eclipseYears,
    aspects: transitYears,
  };
  const setYear = (family: YearFamily, year: number, payload: Record<string, unknown>) => {
    payloads.set(`${family}/${year}.json`, { ...payload, links: yearLinks(family, year, yearCoverage) });
  };
  for (const year of skyYears) {
    setYear('retrogrades', year, buildRetrogradeYear(sky, months, year, vintage));
    setYear('moon-phases', year, buildMoonPhaseYear(sky, months, year, vintage));
  }
  for (const year of transitYears) {
    setYear('stations', year, buildStationYear(months, year, vintage));
    setYear('ingresses', year, buildIngressYear(months, year, vintage));
    setYear('aspects', year, buildAspectYear(months, year, vintage));
  }
  for (const year of eclipseYears) {
    setYear('eclipses', year, buildEclipseYear(eclipses, year, vintage));
  }
  payloads.set('index.json', buildIndex({
    transitYears, skyYears, eclipseYears, dailyDate: daily.date, vintage, generatedAt, schemaNames: SCHEMA_NAMES,
  }));

  const files = new Map<string, string>();
  for (const [path, payload] of payloads) files.set(path, json(payload));
  for (const name of SCHEMA_NAMES) files.set(`schema/${name}.v1.json`, json(SCHEMAS[name]));
  files.set('openapi.json', json(buildOpenApi({ transitYears, skyYears, eclipseYears, dailyDate: daily.date, version: `${API_VERSION}.${vintage.slice(0, 10)}` })));
  files.set('llms.txt', renderAgentGuide({ transitYears, skyYears, eclipseYears, dailyDate: daily.date, vintage, schemaNames: SCHEMA_NAMES }));
  files.set('sky/today.md', renderTodayMarkdown(payloads.get('sky/today.json') as Record<string, unknown>));
  files.set('sky/upcoming.md', renderUpcomingMarkdown(payloads.get('sky/upcoming.json') as Record<string, unknown>));

  return { files, payloads, transitYears, skyYears, eclipseYears };
}
