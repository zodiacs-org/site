/*
 * Computes every sign-occupancy window per planet — when Venus is in
 * Scorpio, when Pluto's Aquarius era runs — into committed JSON the
 * placement pages and connector tools read. The engine's default DE440
 * source supplies apparent geocentric longitude.
 *
 *   npm run data:ingresses   →  src/data/ingresses.json
 *
 * Only CLOSED windows are emitted: the scan runs wider than any page
 * displays, and the clamped first window and still-open last one are
 * dropped — a truncated "Pluto in Libra 1980–1983" would misstate an
 * era whose true ingress was 1971. Horizons (1-day scan throughout;
 * Mercury tops out near 2.2°/day against 30° signs, so nothing hides):
 *   Sun, Mercury, Venus, Mars     2026-01-01 → 2029-07-01
 *   Jupiter                       2014-01-01 → 2046-01-01
 *   Saturn                        1980-01-01 → 2080-01-01
 *   Uranus, Neptune, Pluto        1900-01-01 → 2100-01-01
 * The Moon is excluded — a 2.5-day rhythm reads better as copy than as
 * a table. Retrograde re-entries appear as separate honest windows.
 * The script validates its own output (per-planet contiguity, all 12
 * signs present, no sub-12h slivers) and refuses to write otherwise.
 * Refresh yearly alongside sky.json so the fast planets stay ahead of
 * the calendar.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defaultEphemeris } from '@zodiacs/engine';
import { bodyLongitude } from '@zodiacs/engine/internal';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'src/data/ingresses.json');
await mkdir(dirname(out), { recursive: true });

const SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const DAY = 86400_000;
const GROUPS = [
  { planets: ['Sun', 'Mercury', 'Venus', 'Mars'], from: Date.UTC(2026, 0, 1), to: Date.UTC(2029, 6, 1) },
  { planets: ['Jupiter'], from: Date.UTC(2014, 0, 1), to: Date.UTC(2046, 0, 1) },
  { planets: ['Saturn'], from: Date.UTC(1980, 0, 1), to: Date.UTC(2080, 0, 1) },
  { planets: ['Uranus', 'Neptune', 'Pluto'], from: Date.UTC(1900, 0, 1), to: Date.UTC(2100, 0, 1) },
];

const backend = defaultEphemeris();
if (backend.name !== 'de440' || !backend.de440.opened) {
  throw new Error('The engine must open its default DE440 pack to build the ingress table.');
}

const signIndexAt = (planet, date) => Math.floor(bodyLongitude(planet, date) / 30);

/** Bisect the boundary where signIndex flips from `prev`. */
function refine(planet, lo, hi, prev) {
  for (let i = 0; i < 22; i += 1) {
    const mid = new Date((lo.getTime() + hi.getTime()) / 2);
    if (signIndexAt(planet, mid) !== prev) hi = mid; else lo = mid;
  }
  return hi;
}

const windows = [];
for (const group of GROUPS) {
  for (const planet of group.planets) {
    const step = DAY;
    let prevIndex = signIndexAt(planet, new Date(group.from));
    let windowStart = null; // stays null until the first real ingress

    for (let t = group.from + step; t <= group.to; t += step) {
      const date = new Date(t);
      const index = signIndexAt(planet, date);
      if (index !== prevIndex) {
        const boundary = refine(planet, new Date(t - step), date, prevIndex);
        // Drop the clamped first window (no real start boundary).
        if (windowStart) {
          windows.push({
            planet,
            sign: SIGN_SLUGS[prevIndex],
            from: windowStart.toISOString(),
            to: boundary.toISOString(),
          });
        }
        windowStart = boundary;
        prevIndex = index;
      }
    }
    // The still-open last window is dropped for the same reason.
    console.log(`${planet}: scanned`);
  }
}

windows.sort((a, b) => a.from.localeCompare(b.from));

// ── Self-validation: refuse to write a corrupt table ─────────────────
const problems = [];
for (const group of GROUPS) {
  for (const planet of group.planets) {
    const own = windows
      .filter((w) => w.planet === planet)
      .sort((a, b) => a.from.localeCompare(b.from));
    if (own.length === 0) { problems.push(`${planet}: no windows`); continue; }
    const signs = new Set(own.map((w) => w.sign));
    if (signs.size !== 12) problems.push(`${planet}: covers ${signs.size}/12 signs`);
    for (let i = 0; i < own.length; i += 1) {
      const ms = new Date(own[i].to) - new Date(own[i].from);
      if (ms < 12 * 3600_000) problems.push(`${planet}: sub-12h sliver at ${own[i].from}`);
      if (i > 0 && own[i].from !== own[i - 1].to) {
        problems.push(`${planet}: gap between ${own[i - 1].to} and ${own[i].from}`);
      }
    }
  }
}
if (problems.length) {
  console.error('build-ingresses: validation failed —\n  ' + problems.join('\n  '));
  process.exit(1);
}

const payload = {
  generatedAt: new Date().toISOString(),
  horizons: GROUPS.map((g) => ({
    planets: g.planets,
    from: new Date(g.from).toISOString().slice(0, 10),
    to: new Date(g.to).toISOString().slice(0, 10),
  })),
  windows,
};
await writeFile(out, JSON.stringify(payload, null, 2) + '\n');
console.log(`Done — ${windows.length} windows → src/data/ingresses.json`);
