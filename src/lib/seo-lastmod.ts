import de440SitemapDates from '../data/de440-sitemap-dates.json';
import engine21SitemapDates from '../data/engine-2-1-sitemap-dates.json';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;

export const BIRTHDAY_CUSP_OG_MODIFIED_AT = '2026-08-23T00:00:00.000Z';
/** The birthday pages' hero began naming who shares the date ("You share a birthday with …"). */
export const BIRTHDAY_FAMOUS_LINE_MODIFIED_AT = '2026-10-19T00:00:00.000Z';
export const PEOPLE_TEMPLATE_MODIFIED_AT = '2026-10-16T00:00:00.000Z';
export const TERMINAL_RESEARCH_BASE_LASTMOD = '2026-08-13';

// The routes measured to have changed in the DE440 release builds, and those
// measured to have changed again when the site moved to engine 2.1.0 (its
// continuous UTC time rule moves far-future instants). A route takes the later
// of the two dates.
const engineUpdates = [de440SitemapDates, engine21SitemapDates].map(({ date, paths }) => ({ date, paths: new Set(paths) }));

export function de440UpdatedDate(path: string): string | undefined {
  const dates = engineUpdates.filter(({ paths }) => paths.has(path)).map(({ date }) => date).sort();
  return dates.at(-1);
}

type DateInput = string | Date;

function parseDate(value: DateInput): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid modification date: ${String(value)}`);
  return timestamp;
}

/** Return the latest real source timestamp without consulting build time. */
export function latestModifiedAt(...values: DateInput[]): string {
  if (values.length === 0) throw new Error('At least one modification date is required');
  return new Date(Math.max(...values.map(parseDate))).toISOString();
}

export function lastmodDate(value: DateInput): string {
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    // Date-only values are already UTC calendar dates; validate rather than
    // shifting them through a local timezone.
    const timestamp = parseDate(`${value}T00:00:00.000Z`);
    if (new Date(timestamp).toISOString().slice(0, 10) !== value) {
      throw new Error(`Invalid modification date: ${value}`);
    }
    return value;
  }
  return new Date(parseDate(value)).toISOString().slice(0, 10);
}

type ResearchPublication = {
  generatedAt: string;
  items: Array<{
    status: 'published' | 'scheduled';
    visibleAt: string;
    publishedAt: string;
  }>;
};

/**
 * A generator run is not a content edit. The research index changes only
 * when a reviewed item is both published and visible at the publication
 * cutoff, so sitemap/schema freshness follows those items plus a
 * source-controlled template baseline.
 */
export function terminalResearchLastmod(
  publication: ResearchPublication,
  baseline = TERMINAL_RESEARCH_BASE_LASTMOD,
): string {
  const cutoff = parseDate(publication.generatedAt);
  const candidates: DateInput[] = [`${lastmodDate(baseline)}T00:00:00.000Z`];

  for (const item of publication.items) {
    const visibleAt = parseDate(item.visibleAt);
    if (item.status !== 'published' || visibleAt > cutoff) continue;
    candidates.push(item.publishedAt, item.visibleAt);
  }

  return lastmodDate(latestModifiedAt(...candidates));
}
