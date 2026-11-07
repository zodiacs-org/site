import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import eclipses from '../data/eclipses.json';
import {
  NASA_LUNAR_ECLIPSES, isInvisiblePenumbral, lunarTotalityMinutes, nasaLunarEclipse,
} from './nasa-lunar-eclipses';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RAW = new URL('../../docs/accuracy-audit-2026-11/raw/nasa-LE2001-2100.html', import.meta.url);
const MANIFEST = new URL('../../docs/accuracy-audit-2026-11/raw/MANIFEST.json', import.meta.url);

/** The canon's 2026 to 2030 rows: date → [type, pen. mag, um. mag, total minutes or '-']. */
function canonRows(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const line of readFileSync(RAW, 'latin1').split('\n')) {
    const text = line.replace(/<[^>]+>/gu, '');
    const m = text.match(/^\s*\d{5}\s+(\d{4})\s+(\w{3})\s+(\d{2})\s+\d{2}:\d{2}:\d{2}\s+-?\d+\s+-?\d+\s+-?\d+\s+(\S+)\s+(.*)$/u);
    if (!m || m[1] < '2026' || m[1] > '2030') continue;
    const nums = m[5].split(/\s+/u).filter((x) => /^(?:-?\d+(?:\.\d+)?|-)$/u.test(x));
    // columns after the type: QSE, Gamma, Pen.Mag, Um.Mag, Pen.Dur, Par.Dur, Total.Dur
    out.set(`${m[1]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[3]}`, [m[4], nums[1], nums[2], nums[5]]);
  }
  return out;
}

describe('NASA lunar eclipse canon', () => {
  it('reads the kept copy of the canon, unchanged', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const sha = createHash('sha256').update(readFileSync(RAW)).digest('hex');
    expect(sha).toBe(manifest.responses['nasa-LE2001-2100'].sha256);
  });

  it('holds every row to the canon', () => {
    const rows = canonRows();
    expect([...rows.keys()].sort()).toEqual(Object.keys(NASA_LUNAR_ECLIPSES).sort());
    for (const [date, row] of Object.entries(NASA_LUNAR_ECLIPSES)) {
      const [type, pen, um, total] = rows.get(date)!;
      expect(row.type, date).toBe(type);
      expect(row.penumbralMagnitude, date).toBe(Number(pen));
      expect(row.umbralMagnitude, date).toBe(Number(um));
      expect(row.totalMinutes, date).toBe(total === '-' ? undefined : Number(total));
    }
  });

  it('finds a canon row for every lunar eclipse in eclipses.json', () => {
    const lunar = eclipses.eclipses.filter((e) => e.type === 'lunar');
    expect(lunar.length).toBe(Object.keys(NASA_LUNAR_ECLIPSES).length);
    for (const e of lunar) expect(nasaLunarEclipse(e.peak), e.peak).not.toBeNull();
  });

  it('prints totality as NASA gives it, within a minute', () => {
    expect(lunarTotalityMinutes('2029-06-26T03:22:00Z', 103)).toBe(102);
    expect(lunarTotalityMinutes('2029-12-20T22:42:00Z', 55)).toBe(54);
    expect(lunarTotalityMinutes('2026-03-03T11:33:46Z', 59)).toBe(58);
  });

  it('marks only the 18 July 2027 graze as invisible', () => {
    const invisible = eclipses.eclipses.filter((e) => e.type === 'lunar' && isInvisiblePenumbral(e.peak, e.kind));
    expect(invisible.map((e) => e.peak.slice(0, 10))).toEqual(['2027-07-18']);
  });
});
