#!/usr/bin/env node
/**
 * Where each eclipse in src/data/eclipses.json can be seen, on the 2-degree
 * land cells the /astrocartography/ map draws (src/data/astrocartography-land.json),
 * for the visibility map on /eclipses/ (src/components/sky/EclipseVisibilityMap.astro).
 *
 *   node scripts/build-eclipse-visibility.mjs          →  src/data/eclipse-visibility.json
 *   node scripts/build-eclipse-visibility.mjs --check  (fails on drift)
 *   --output <file> writes elsewhere; --exhaustive skips the geometric pass below
 *   (slow), to compare; --verbose prints the counts
 *
 * For each land cell, at the centre of the cell, at sea level:
 *
 * - Solar eclipses: astronomy-engine's SearchLocalSolarEclipse from half a day
 *   before the global peak. A cell sees the eclipse when the local eclipse it
 *   returns is this one, which the library reports only when the Sun's centre
 *   is above the horizon (with refraction) at the start or the end of the
 *   partial phase there. The library walks on to later new Moons for a place
 *   the Moon's penumbra misses, so a cheap geometric pass first drops every
 *   cell where the Moon's and Sun's centres, seen from the cell, never come
 *   within 0.75 degrees of each other (their discs touch at no more than 0.56
 *   degrees) while the Sun is less than 3 degrees below the horizon, in the
 *   eight hours round the peak; --exhaustive shows the pass drops no cell the
 *   library would keep. The central path is the track of the
 *   shadow axis on the Earth's ellipsoid, by the same construction as the
 *   library's greatest-eclipse point (MoonShadow and GeoidIntersect in
 *   astronomy-engine), from the first to the last instant the axis meets the
 *   Earth.
 * - Lunar eclipses: the Moon's topocentric centre above the horizon, without
 *   refraction, at some instant of the umbral phase (partial and total
 *   eclipses) or of the penumbral phase (penumbral eclipses), sampled every
 *   five minutes and at both ends, from SearchLunarEclipse's semi-durations.
 *
 * Each eclipse keeps its cells as a bitmask over the land cells in the land
 * file's order (base64), and, for the map's single pass, one digit (0 to 7)
 * per visible cell: for a solar eclipse, the eighth of the eclipse in which
 * the cell's own maximum falls; for a lunar eclipse, how far the Moon stands
 * from overhead at maximum, highest first. The continent counts come from
 * the most populous town of each cell (public/data/cities/, GeoNames).
 * No timestamp, so --check catches drift.
 */
import './lib/deltat-install.mjs';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import {
  Body, Equator, EquatorFromVector, GeoMoon, GeoVector, Horizon, KM_PER_AU, MakeTime, Observer, RotateVector,
  Rotation_EQJ_EQD, SearchGlobalSolarEclipse, SearchLocalSolarEclipse, SearchLunarEclipse, SiderealTime,
} from 'astronomy-engine';
import { earthFixed, shadowAxisPoint } from './lib/eclipse-shadow.mjs';

const root = new URL('../', import.meta.url);
const outputIndex = process.argv.indexOf('--output');
const target = outputIndex >= 0 ? new URL(process.argv[outputIndex + 1], `file://${process.cwd()}/`) : new URL('src/data/eclipse-visibility.json', root);
// --exhaustive asks the library about every cell, skipping the geometric pass, to show the pass drops none.
const EXHAUSTIVE = process.argv.includes('--exhaustive');
const landText = await readFile(new URL('src/data/astrocartography-land.json', root), 'utf8');
const land = JSON.parse(landText);
const eclipseData = JSON.parse(await readFile(new URL('src/data/eclipses.json', root), 'utf8'));
const CELL = land.cellDegrees;
const cells = land.cells.map(([row, col]) => ({ lat: row * CELL - 90 + CELL / 2, lon: col * CELL - 180 + CELL / 2 }));

// ── Continents, by the most populous town in each cell ──────────────────
const CONTINENTS = {
  Europe: ['Andorra', 'Albania', 'Austria', 'Aland Islands', 'Bosnia and Herzegovina', 'Belgium', 'Bulgaria', 'Belarus',
    'Switzerland', 'Cyprus', 'Czechia', 'Germany', 'Denmark', 'Estonia', 'Spain', 'Finland', 'Faroe Islands', 'France',
    'United Kingdom', 'Guernsey', 'Gibraltar', 'Greece', 'Croatia', 'Hungary', 'Ireland', 'Isle of Man', 'Iceland', 'Italy',
    'Jersey', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Latvia', 'Monaco', 'Moldova', 'Montenegro', 'North Macedonia',
    'Malta', 'The Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Serbia', 'Sweden', 'Slovenia',
    'Svalbard and Jan Mayen', 'Slovakia', 'San Marino', 'Ukraine', 'Vatican', 'Kosovo'],
  Africa: ['Angola', 'Burkina Faso', 'Burundi', 'Benin', 'Botswana', 'Democratic Republic of the Congo',
    'Central African Republic', 'Republic of the Congo', 'Ivory Coast', 'Cameroon', 'Cabo Verde', 'Djibouti', 'Algeria',
    'Egypt', 'Western Sahara', 'Eritrea', 'Ethiopia', 'Gabon', 'Ghana', 'Gambia', 'Guinea', 'Equatorial Guinea',
    'Guinea-Bissau', 'Kenya', 'Comoros', 'Liberia', 'Lesotho', 'Libya', 'Morocco', 'Madagascar', 'Mali', 'Mauritania',
    'Mauritius', 'Malawi', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Reunion', 'Rwanda', 'Seychelles', 'Sudan',
    'Saint Helena', 'Sierra Leone', 'Senegal', 'Somalia', 'South Sudan', 'Sao Tome and Principe', 'Eswatini', 'Chad',
    'Togo', 'Tunisia', 'Tanzania', 'Uganda', 'Mayotte', 'South Africa', 'Zambia', 'Zimbabwe'],
  Asia: ['United Arab Emirates', 'Afghanistan', 'Armenia', 'Azerbaijan', 'Bangladesh', 'Bahrain', 'Brunei', 'Bhutan',
    'Cocos Islands', 'China', 'Christmas Island', 'Georgia', 'Hong Kong', 'Indonesia', 'Israel', 'India', 'Iraq', 'Iran',
    'Jordan', 'Japan', 'Kyrgyzstan', 'Cambodia', 'North Korea', 'South Korea', 'Kuwait', 'Kazakhstan', 'Laos', 'Lebanon',
    'Sri Lanka', 'Myanmar', 'Mongolia', 'Macao', 'Maldives', 'Malaysia', 'Nepal', 'Oman', 'Philippines', 'Pakistan',
    'Palestinian Territory', 'Qatar', 'Saudi Arabia', 'Singapore', 'Syria', 'Thailand', 'Tajikistan', 'Timor Leste',
    'Turkmenistan', 'Turkey', 'Taiwan', 'Uzbekistan', 'Vietnam', 'Yemen'],
  'North America': ['Antigua and Barbuda', 'Anguilla', 'Aruba', 'Barbados', 'Saint Barthelemy', 'Bermuda',
    'Bonaire, Saint Eustatius and Saba ', 'Bahamas', 'Belize', 'Canada', 'Costa Rica', 'Cuba', 'Curacao', 'Dominica',
    'Dominican Republic', 'Grenada', 'Greenland', 'Guadeloupe', 'Guatemala', 'Honduras', 'Haiti', 'Jamaica',
    'Saint Kitts and Nevis', 'Cayman Islands', 'Saint Lucia', 'Saint Martin', 'Martinique', 'Montserrat', 'Mexico',
    'Nicaragua', 'Panama', 'Saint Pierre and Miquelon', 'Puerto Rico', 'El Salvador', 'Sint Maarten',
    'Turks and Caicos Islands', 'Trinidad and Tobago', 'United States', 'Saint Vincent and the Grenadines',
    'British Virgin Islands', 'U.S. Virgin Islands'],
  'South America': ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Falkland Islands',
    'French Guiana', 'Guyana', 'South Georgia and the South Sandwich Islands', 'Peru', 'Paraguay', 'Suriname', 'Uruguay',
    'Venezuela'],
  Oceania: ['American Samoa', 'Australia', 'Cook Islands', 'Fiji', 'Micronesia', 'Guam', 'Kiribati', 'Marshall Islands',
    'Northern Mariana Islands', 'New Caledonia', 'Norfolk Island', 'Nauru', 'Niue', 'New Zealand', 'French Polynesia',
    'Papua New Guinea', 'Pitcairn', 'Palau', 'Solomon Islands', 'Tonga', 'Tuvalu', 'Vanuatu', 'Wallis and Futuna',
    'Samoa'],
};
const CONTINENT_NAMES = Object.keys(CONTINENTS);
const cityIndex = JSON.parse(await readFile(new URL('public/data/cities/index.json', root), 'utf8'));
const continentOfCountry = new Map();
for (const [name, countries] of Object.entries(CONTINENTS)) for (const c of countries) continentOfCountry.set(c, name);
// Russia is split at the Urals below; the French Southern Territories (Kerguelen) belong to no continent.
const NO_CONTINENT = new Set(['Russia', 'French Southern Territories']);
const unmapped = cityIndex.countries.filter((c) => !NO_CONTINENT.has(c) && !continentOfCountry.has(c));
if (unmapped.length) throw new Error(`build-eclipse-visibility: no continent for ${unmapped.join(', ')}`);

const biggest = new Map(); // cell key → [population, country, lon]
const citiesFolder = new URL('public/data/cities/', root);
for (const name of (await readdir(citiesFolder)).filter((f) => f.endsWith('.json') && f !== 'index.json').sort()) {
  for (const row of JSON.parse(await readFile(new URL(name, citiesFolder), 'utf8'))) {
    const key = Math.floor((row[4] / 100 + 90) / CELL) * 1000 + Math.floor((row[5] / 100 + 180) / CELL);
    const best = biggest.get(key);
    if (!best || row[7] > best[0]) biggest.set(key, [row[7], cityIndex.countries[row[3]], row[5] / 100, row[4] / 100]);
  }
}
const cellContinent = land.cells.map(([row, col]) => {
  const [, country, lon, lat] = biggest.get(row * 1000 + col);
  // Russia west of the Urals is Europe. Hawaii, filed under the United States, is Oceania; the Canary
  // Islands and Madeira, filed under Spain and Portugal, are Africa.
  if (country === 'Russia') return lon < 60 ? 'Europe' : 'Asia';
  if (country === 'United States' && lon < -140 && lat < 30) return 'Oceania';
  if ((country === 'Spain' || country === 'Portugal') && lat < 34) return 'Africa';
  return continentOfCountry.get(country) ?? null;
});

// ── Geometry helpers ─────────────────────────────────────────────────────
const DEG = Math.PI / 180;

/** Geocentric Sun and Moon in equator-of-date km, and the sidereal angle, at one instant. */
function sky(time) {
  const rot = Rotation_EQJ_EQD(time);
  const s = RotateVector(rot, GeoVector(Body.Sun, time, true));
  const m = RotateVector(rot, GeoMoon(time));
  return { sun: [s.x * KM_PER_AU, s.y * KM_PER_AU, s.z * KM_PER_AU], moon: [m.x * KM_PER_AU, m.y * KM_PER_AU, m.z * KM_PER_AU], gast: SiderealTime(time) * 15 * DEG };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.sqrt(dot(a, a));

const round = (value, places) => {
  const f = 10 ** places;
  const r = Math.round(value * f) / f;
  return Object.is(r, -0) ? 0 : r;
};
const iso = (time) => time.date.toISOString();
const MINUTE = 1 / 1440;

/** The central line, from the first to the last instant the axis meets the Earth. */
function centralPath(peak) {
  const edge = (from, step) => {
    let inside = from;
    let outside = from.AddDays(step);
    while (shadowAxisPoint(outside)) { inside = outside; outside = outside.AddDays(step); }
    for (let i = 0; i < 20; i += 1) {
      const mid = MakeTime(new Date((inside.date.getTime() + outside.date.getTime()) / 2));
      if (shadowAxisPoint(mid)) inside = mid; else outside = mid;
    }
    return inside;
  };
  const start = edge(peak, -MINUTE);
  const end = edge(peak, MINUTE);
  const points = [];
  const span = (end.date - start.date) / 86400000;
  const steps = Math.ceil(span / (MINUTE / 2));
  for (let i = 0; i <= steps; i += 1) {
    const p = shadowAxisPoint(start.AddDays((span * i) / steps)) ?? shadowAxisPoint(i === 0 ? start : end);
    points.push(p);
  }
  // Keep a point when it lies a quarter degree or more from the last kept one, and always the ends.
  const kept = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const last = kept[kept.length - 1];
    const dLon = Math.abs(points[i].lon - last.lon);
    if (Math.hypot(points[i].lat - last.lat, Math.min(dLon, 360 - dLon) * Math.cos(points[i].lat * DEG)) >= 0.25) kept.push(points[i]);
  }
  kept.push(points[points.length - 1]);
  // Split where the line crosses the antimeridian.
  const segments = [[]];
  for (const p of kept) {
    const seg = segments[segments.length - 1];
    if (seg.length && Math.abs(p.lon - seg[seg.length - 1][0]) > 180) segments.push([]);
    segments[segments.length - 1].push([round(p.lon, 2), round(p.lat, 2)]);
  }
  return { from: iso(start), to: iso(end), segments };
}

function bitmask(flags) {
  const bytes = new Uint8Array(Math.ceil(flags.length / 8));
  flags.forEach((on, i) => { if (on) bytes[i >> 3] |= 0x80 >> (i & 7); });
  return Buffer.from(bytes).toString('base64');
}

const bucket = (value, lo, hi) => (hi > lo ? Math.min(7, Math.floor(((value - lo) / (hi - lo)) * 8)) : 0);

function regionCounts(flags) {
  return CONTINENT_NAMES.map((name) => {
    let visible = 0, total = 0;
    cellContinent.forEach((c, i) => { if (c === name) { total += 1; if (flags[i]) visible += 1; } });
    return [name, visible, total];
  });
}

// ── Solar ────────────────────────────────────────────────────────────────
const fixed = cells.map((c) => earthFixed(c.lat, c.lon));
const SIN_LOW_SUN = Math.sin(-3 * DEG);

function solar(entry) {
  const global = SearchGlobalSolarEclipse(MakeTime(new Date(Date.parse(entry.peak) - 86400000)));
  if (Math.abs(global.peak.date - Date.parse(entry.peak)) > 60000) throw new Error(`solar peak mismatch at ${entry.peak}`);
  // Geometric pass: a cell is a candidate when, at some five-minute step, the two centres seen from it
  // are within 0.75 degrees and the Sun's centre is no more than 3 degrees below its horizon. The library
  // reports an eclipse only with the Sun up at a contact, when the discs touch (at most 0.56 degrees), and
  // in five minutes the Sun moves at most 1.25 degrees in altitude and the gap closes by far less.
  const candidate = new Array(cells.length).fill(false);
  for (let k = -48; k <= 48; k += 1) {
    const { sun, moon, gast } = sky(global.peak.AddDays((k * 5) * MINUTE));
    const cg = Math.cos(gast), sg = Math.sin(gast);
    fixed.forEach((f, i) => {
      if (candidate[i]) return;
      const o = [f[0] * cg - f[1] * sg, f[0] * sg + f[1] * cg, f[2]];
      const ts = sub(sun, o), tm = sub(moon, o);
      const cos = dot(ts, tm) / (norm(ts) * norm(tm));
      if (Math.acos(Math.min(1, cos)) >= 0.75 * DEG) return;
      // The Sun's altitude, near enough, from the cell's geocentric direction as its vertical.
      if (dot(ts, o) / (norm(ts) * norm(o)) > SIN_LOW_SUN) candidate[i] = true;
    });
  }
  const start = global.peak.AddDays(-0.5);
  const peaks = new Array(cells.length).fill(null);
  cells.forEach((c, i) => {
    if (!candidate[i] && !EXHAUSTIVE) return;
    const local = SearchLocalSolarEclipse(start, new Observer(c.lat, c.lon, 0));
    if (Math.abs(local.peak.time.date - global.peak.date) < 0.5 * 86400000) peaks[i] = local.peak.time.date.getTime();
  });
  const flags = peaks.map((p) => p !== null);
  const times = peaks.filter((p) => p !== null);
  const lo = Math.min(...times), hi = Math.max(...times);
  const out = {
    phase: 'partial',
    visible: bitmask(flags),
    sweep: peaks.filter((p) => p !== null).map((p) => bucket(p, lo, hi)).join(''),
    first: new Date(lo).toISOString(),
    last: new Date(hi).toISOString(),
    regions: regionCounts(flags),
  };
  if (process.argv.includes('--verbose')) console.log(`${entry.peak} solar: ${candidate.filter(Boolean).length} candidates, ${times.length} visible`);
  if (entry.kind !== 'partial') {
    out.greatest = { lat: round(global.latitude, 3), lon: round(global.longitude, 3), at: iso(global.peak) };
    out.path = centralPath(global.peak);
  }
  return out;
}

// ── Lunar ────────────────────────────────────────────────────────────────
function lunar(entry) {
  const ecl = SearchLunarEclipse(MakeTime(new Date(Date.parse(entry.peak) - 86400000)));
  if (Math.abs(ecl.peak.date - Date.parse(entry.peak)) > 60000) throw new Error(`lunar peak mismatch at ${entry.peak}`);
  const phase = ecl.kind === 'penumbral' ? 'penumbral' : 'umbral';
  const half = (phase === 'penumbral' ? ecl.sd_penum : ecl.sd_partial) * MINUTE;
  const from = ecl.peak.AddDays(-half);
  const to = ecl.peak.AddDays(half);
  const samples = [];
  for (let t = 0; t < 2 * half; t += 5 * MINUTE) samples.push(from.AddDays(t));
  samples.push(to);
  const altAtPeak = new Array(cells.length);
  const flags = cells.map((c, i) => {
    const obs = new Observer(c.lat, c.lon, 0);
    const alt = (time) => { const eq = Equator(Body.Moon, time, obs, true, true); return Horizon(time, obs, eq.ra, eq.dec).altitude; };
    altAtPeak[i] = alt(ecl.peak);
    return altAtPeak[i] > 0 || samples.some((time) => alt(time) > 0);
  });
  const eq = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(ecl.peak), GeoMoon(ecl.peak)));
  let lon = (eq.ra - SiderealTime(ecl.peak)) * 15;
  lon = ((lon + 540) % 360) - 180;
  const alts = altAtPeak.filter((_, i) => flags[i]);
  const lo = Math.min(...alts), hi = Math.max(...alts);
  return {
    phase,
    from: iso(from),
    to: iso(to),
    visible: bitmask(flags),
    // Highest Moon first.
    sweep: alts.map((a) => bucket(hi - a, 0, hi - lo)).join(''),
    regions: regionCounts(flags),
    overhead: { lat: round(eq.dec, 3), lon: round(lon, 3), at: iso(ecl.peak) },
  };
}

// ── Build, validate, write ───────────────────────────────────────────────
const eclipses = eclipseData.eclipses.map((entry) => ({
  id: `eclipse-${entry.peak.slice(0, 10)}-${entry.type}`,
  type: entry.type,
  kind: entry.kind,
  peak: entry.peak,
  ...(entry.type === 'solar' ? solar(entry) : lunar(entry)),
}));

const problems = [];
for (const e of eclipses) {
  const count = Buffer.from(e.visible, 'base64').reduce((n, b) => n + b.toString(2).split('1').length - 1, 0);
  if (count !== e.sweep.length) problems.push(`${e.id}: sweep length ${e.sweep.length} for ${count} cells`);
  if (count === 0) problems.push(`${e.id}: seen from no land cell`);
  if (e.type === 'solar' && e.kind !== 'partial' && !e.path?.segments?.[0]?.length) problems.push(`${e.id}: no central path`);
}
if (problems.length) {
  console.error(`build-eclipse-visibility: validation failed\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const payload = {
  source: 'astronomy-engine local circumstances on the land cells of src/data/astrocartography-land.json',
  land: { cells: cells.length, cellDegrees: CELL, sha256: createHash('sha256').update(landText).digest('hex') },
  continents: CONTINENT_NAMES,
  eclipses,
};
const output = `${JSON.stringify(payload)}\n`;
if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '');
  if (current !== output) {
    console.error('src/data/eclipse-visibility.json is stale; run node scripts/build-eclipse-visibility.mjs');
    process.exit(1);
  }
  console.log(`Verified src/data/eclipse-visibility.json (${eclipses.length} eclipses)`);
} else {
  await writeFile(target, output);
  console.log(`Built ${target.pathname} (${eclipses.length} eclipses, ${output.length} bytes)`);
}
