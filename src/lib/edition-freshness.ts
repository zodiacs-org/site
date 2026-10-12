const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function parsedUtcDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
}

export function utcDate(now: Date = new Date()): string {
  if (Number.isNaN(now.getTime())) throw new Error('invalid current date');
  return now.toISOString().slice(0, 10);
}

export function isCurrentUtcEdition(editionDate: string, now: Date = new Date()): boolean {
  return parsedUtcDate(editionDate) !== null && editionDate === utcDate(now);
}

export function editionDateLabel(editionDate: string): string {
  const parsed = parsedUtcDate(editionDate);
  if (!parsed) return editionDate;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

/**
 * Convert relative current-day language into an explicit archival label.
 * The dated form is also the server/no-JavaScript fallback; the browser only
 * restores the relative wording after proving that the edition is current.
 * `EditionFreshnessGuard.astro` carries the browser's copy of these rules.
 */
export function datedEditionText(value: string, editionDate: string): string {
  const label = editionDateLabel(editionDate);
  return value
    .replace(/\bToday[’']s\b/gu, `The ${label} edition’s`)
    .replace(/\btoday[’']s\b/gu, `the ${label} edition’s`)
    .replace(/\bToday,/gu, `For the ${label} edition,`)
    .replace(/\bToday\b/gu, `The ${label} edition`)
    .replace(/\bas of today\b/gu, `as of ${label}`)
    .replace(/\b(for|from|on|until|through|since|before|after|by) today\b/gu, `$1 ${label}`)
    .replace(/\btoday\b/gu, `on ${label}`);
}

export function millisecondsUntilNextUtcDay(now: Date = new Date()): number {
  if (Number.isNaN(now.getTime())) throw new Error('invalid current date');
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, next - now.getTime() + 1_000);
}
