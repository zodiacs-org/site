/**
 * Horizons QUANTITIES=31 responses (observer ecliptic longitude and latitude
 * of date, CSV, TT): the rows between $$SOE and $$EOE, in TLIST order, each
 * checked against the TT Julian date it was asked for.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/** A response's rows: { jdTt, lon, lat }, with the calendar time Horizons printed turned into a TT Julian date. */
export function parseResponse(path) {
  const text = readFileSync(path, 'utf8');
  const start = text.indexOf('$$SOE');
  const end = text.indexOf('$$EOE');
  if (start < 0 || end < start) throw new Error(`${path}: no ephemeris rows`);
  const rows = text.slice(start + 5, end).trim().split('\n').map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    const m = /^(-?\d+)-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/u.exec(cells[0]);
    if (!m) throw new Error(`${path}: unread time ${cells[0]}`);
    const [, y, mon, d, hh, mm, ss] = m;
    const ms = Date.UTC(Number(y), MONTHS[mon], Number(d), Number(hh), Number(mm), 0) + Number(ss) * 1000;
    const lon = Number(cells[3]);
    const lat = Number(cells[4]);
    if (![lon, lat].every(Number.isFinite)) throw new Error(`${path}: unread row ${line}`);
    return { jdTt: 2440587.5 + ms / 86_400_000, lon, lat };
  });
  return { rows, sha256: createHash('sha256').update(text).digest('hex'), banner: /EOP file\s*:\s*(\S+)/u.exec(text)?.[1] ?? null };
}

/** Check a response's rows against the TT Julian dates asked for, to the millisecond Horizons prints. */
export function matchCases(parsed, cases, label) {
  if (parsed.rows.length !== cases.length) throw new Error(`${label}: ${parsed.rows.length} rows for ${cases.length} instants`);
  return cases.map((kase, i) => {
    const row = parsed.rows[i];
    if (Math.abs(row.jdTt - kase.jdTt) * 86_400_000 > 1) throw new Error(`${label}: row ${i} is at JD ${row.jdTt}, asked ${kase.jdTt}`);
    return { ...row, id: kase.id };
  });
}
