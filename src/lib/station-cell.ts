/**
 * What a retrograde table prints in a station cell that the data cannot fill.
 * The cell says why in words, never a dash glyph (AGENTS.md: no em or en
 * dashes in copy).
 *
 * - The retrograde station is missing only when the window was already open
 *   as the data begins: the station happened before the table's first year.
 * - The direct station is missing only when the window runs past the data
 *   horizon: it is not yet available.
 */
export type StationCellLocale = 'en' | 'es' | 'pt' | 'fr' | 'it';

// The same words the pages' structured data already uses for a missing station.
const NOT_YET: Record<StationCellLocale, string> = {
  en: 'not yet available',
  es: 'aún no disponible',
  pt: 'ainda não disponível',
  fr: 'pas encore disponible',
  it: 'non ancora disponibile',
};

const BEFORE: Record<StationCellLocale, (year: number) => string> = {
  en: (year) => `before ${year}`,
  es: (year) => `antes de ${year}`,
  pt: (year) => `antes de ${year}`,
  fr: (year) => `avant ${year}`,
  it: (year) => `prima del ${year}`,
};

/** The retrograde station's position, or when it fell if the data starts after it. */
export function retrogradeStationCell(position: string | null, locale: StationCellLocale, firstYear: number): string {
  return position ?? BEFORE[locale](firstYear);
}

/** The direct station's position, or that it is past the data horizon. */
export function directStationCell(position: string | null, locale: StationCellLocale): string {
  return position ?? NOT_YET[locale];
}
