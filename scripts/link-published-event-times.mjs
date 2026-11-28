import '../src/lib/engine/server-de440.mjs';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { ENGINE_VERSION, defaultEphemeris } from '@zodiacs/engine';

const data = new URL('../src/data/', import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, data), 'utf8'));
const archive = read('nasa-event-instants.json');
const year = read('nasa-event-times-2027.json');
const ephemeris = defaultEphemeris();
if (ephemeris.name !== 'de440' || !ephemeris.de440.opened) {
  throw new Error('The event catalog must come from the installed DE440 release.');
}

const published = {
  ingress: archive.ingresses,
  station: archive.stations,
  aspect: archive.aspects,
  lunation: year.lunations,
};
const matchWindow = archive.matchWindowDays * 86_400_000;
const links = new Map();
const keyFor = (kind, event, at) => [kind, event.body ?? event.a, event.b, event.type, at]
  .filter((value) => value !== undefined).join('|');

function link(kind, identity, at) {
  if (['Sun', 'Moon'].includes(identity.body)) return;
  const matches = published[kind].filter((row) => (
    Object.entries(identity).every(([key, value]) => value === undefined || row[key] === value)
    && Math.abs(Date.parse(row.nasa) - Date.parse(at)) <= (kind === 'lunation' ? 120_000 : matchWindow)
  ));
  if (matches.length !== 1) {
    throw new Error(`${kind} ${at} ${JSON.stringify(identity)} has ${matches.length} published records`);
  }
  const [row] = matches;
  const anchor = Array.isArray(row.engine) ? row.engine[0] : row.engine;
  if (!anchor) throw new Error(`${kind} ${at} has no archived engine key`);
  const key = keyFor(kind, identity, at);
  if (links.has(key) && links.get(key) !== anchor) throw new Error(`Conflicting records for ${key}`);
  if (at !== anchor) links.set(key, anchor);
}

// Match an unchanged published event by its identity and the original match window.
// This writes only engine keys. Published clock values and provenance remain in their own tables.
for (const file of readdirSync(data).filter((name) => /^transits-\d{4}-\d{2}\.json$/u.test(name))) {
  const month = read(file);
  for (const { planet: body, sign, retrograde, at } of month.ingresses) link('ingress', { body, sign, retrograde }, at);
  for (const { planet: body, type, at } of month.stations) link('station', { body, type }, at);
  for (const { a, b, type, aSign, at } of month.aspects) link('aspect', { a, b, type, aSign }, at);
}
const ingressData = read('ingresses.json');
const horizonStart = new Map(ingressData.horizons.flatMap(({ planets, from }) => planets.map((body) => [body, `${from}T00:00:00.000Z`])));
for (const { planet: body, sign, from } of ingressData.windows) {
  if (from > horizonStart.get(body)) link('ingress', { body, sign }, from);
}
const sky = read('sky.json');
for (const window of sky.retrogrades) {
  const body = window.planet;
  if (window.from !== sky.from) link('station', { body, type: 'retrograde' }, window.from);
  if (window.to) link('station', { body, type: 'direct' }, window.to);
}
for (const { type, at } of sky.moons) {
  if (type === 'full' && at.startsWith('2027')) link('lunation', { type }, at);
}
for (const file of ['events-publication.json', 'events-publication-2028-2030.json']) {
  for (const page of read(file).pages) {
    const [a, b] = page.bodies;
    if (page.family === 'ingress') link('ingress', { body: a, sign: page.signs[0] }, page.anchor);
    if (page.family === 'retrograde' && page.anchor !== sky.from) link('station', { body: a, type: 'retrograde' }, page.anchor);
    if (page.family === 'aspect') link('aspect', { a, b, type: page.subtype, aSign: page.signs[0] }, page.anchor);
  }
}
for (const event of read('horoscope-program.json').evidence) {
  if (event.kind !== 'sky-event') continue;
  const { body, sign, a, b, eventType: type, at } = event;
  if (event.eventKind === 'ingress') link('ingress', { body, sign }, at);
  if (event.eventKind === 'station') link('station', { body, type }, at);
  if (event.eventKind === 'aspect') link('aspect', { a, b, type }, at);
}

// Match a shadow by the station that starts its cycle, then by the edge.
const detail = JSON.parse(readFileSync(new URL('../docs/platform/evidence/event-pages-2027-20261113/horizons-event-times.json', import.meta.url), 'utf8'));
for (const event of Object.values(detail.events)) {
  if (event.kind !== 'shadow') continue;
  const { body, edge, stationRetrograde } = event.detail;
  const original = archive.stations.find((row) => row.body === body && row.engine.includes(stationRetrograde));
  const windows = sky.retrogrades.filter((window) => window.planet === body && (
    original && (original.engine.includes(window.from)
      || original.engine.includes(links.get(keyFor('station', { body, type: 'retrograde' }, window.from))))
  ));
  if (windows.length !== 1) throw new Error(`No unique shadow cycle for ${body} ${stationRetrograde}`);
  const at = edge === 'pre' ? windows[0].preShadowStart : windows[0].postShadowEnd;
  if (!at) throw new Error(`Missing ${edge} shadow for ${body} ${stationRetrograde}`);
  links.set(keyFor('shadow', { body, type: edge }, at), event.engine);
}

// Astronomical identity is part of the key. The station direction is needed
// above to find a cycle, and removed here to match the lookup's existing signature.
const compact = new Map();
for (const [key, value] of links) {
  const [kind, body, , at] = key.split('|');
  const normalized = kind === 'station' ? `${kind}|${body}|${at}` : key;
  if (compact.has(normalized) && compact.get(normalized) !== value) {
    throw new Error(`Conflicting published records for ${normalized}`);
  }
  compact.set(normalized, value);
}
const output = new URL('published-event-time-links.json', data);
const payload = {
  engine: ENGINE_VERSION,
  ephemeris: { name: ephemeris.name, digest: ephemeris.de440.version },
  keys: Object.fromEntries([...compact].sort(([a], [b]) => a.localeCompare(b))),
};
const text = `${JSON.stringify(payload, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== text) throw new Error('Published event links are stale.');
} else {
  writeFileSync(output, text);
}
console.log(`${compact.size} published event links`);
