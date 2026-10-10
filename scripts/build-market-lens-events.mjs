/** Browser-safe read adapter over verified committed sky catalogs. No solver runs here. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public/data/market-lens/events');
const sha = (text) => createHash('sha256').update(text).digest('hex');
const titleCase = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const convention = 'Geocentric tropical ecliptic of date; UTC exact catalog instant. Stations use longitude speed over ±0.25 day. Eclipse times are global peaks, not local visibility.';
const interpretations = {
  lunation: { new: 'Traditionally associated with beginnings and setting intentions.', full: 'Traditionally associated with culmination, visibility, and reflection.' },
  eclipse: { solar: 'Traditionally treated as a heightened new-moon period for reflection on change.', lunar: 'Traditionally treated as a heightened full-moon period for reflection on change.' },
  station: { retrograde: 'Traditionally associated with pausing and reviewing matters linked to this planet.', direct: 'Traditionally associated with revisiting plans as apparent forward motion resumes.' },
  retrograde: { cycle: 'Traditionally associated with review and reconsideration over this period.' },
  ingress: { ingress: 'Traditionally marks a change in the themes associated with this planet.', 'retrograde-re-entry': 'Traditionally associated with revisiting the themes of the previous sign.' },
  aspect: {
    conjunction: 'Traditionally interpreted as the concentration of the two planetary themes.',
    sextile: 'Traditionally interpreted as opportunities for cooperation between the two planetary themes.',
    square: 'Traditionally interpreted as tension between the two planetary themes.',
    trine: 'Traditionally interpreted as ease between the two planetary themes.',
    opposition: 'Traditionally interpreted as a contrast requiring balance between the two planetary themes.',
  },
};

export async function buildLensEvents(repo = root) {
  const dataDir = resolve(repo, 'src/data');
  const files = (await readdir(dataDir)).filter((name) => /^transits-\d{4}-\d{2}\.json$/.test(name)).sort();
  const sources = new Map();
  for (const name of ['sky.json', 'eclipses.json', ...files]) {
    const text = await readFile(resolve(dataDir, name), 'utf8');
    sources.set(name, { value: JSON.parse(text), sha256: sha(text) });
  }
  const moonText = await readFile(resolve(dataDir, 'aura-moon-ingresses.json'), 'utf8').catch(() => null);
  if (moonText) sources.set('aura-moon-ingresses.json', { value: JSON.parse(moonText), sha256: sha(moonText) });
  const packageData = JSON.parse(await readFile(resolve(repo, 'package.json'), 'utf8'));
  const pinned = packageData.dependencies['@zodiacs/engine'];
  const engineVersion = pinned.match(/zodiacs-engine-(.+)\.tgz$/)?.[1];
  if (!engineVersion) throw new Error('Market Lens requires an explicitly pinned engine artifact version.');
  const sky = sources.get('sky.json').value;
  const horizon = { start: sky.from, end: sky.to };
  const expectedMonths = [];
  for (let cursor = Date.parse(horizon.start); cursor < Date.parse(horizon.end);) {
    const date = new Date(cursor);
    expectedMonths.push(date.toISOString().slice(0, 7));
    cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  }
  if (files.map((name) => name.slice(9, 16)).join() !== expectedMonths.join()) {
    throw new Error('Monthly event coverage must exactly match the verified sky horizon.');
  }
  const events = [];
  const add = (source, family, subtype, at, bodies, title, extra = {}) => {
    if (!Number.isFinite(Date.parse(at))) throw new Error(`Invalid event instant in ${source}`);
    if (at < horizon.start || at >= horizon.end) return;
    const id = [family, subtype, ...bodies.map((body) => body.toLowerCase()), at.replace(/[^0-9TZ]/g, '')].join('-');
    events.push({ id, family, subtype, title, at, bodies, ...extra, interpretation: interpretations[family][subtype], provenance: { catalog: `src/data/${source}`, sha256: sources.get(source).sha256, engineVersion, convention } });
  };
  for (const source of files) {
    const month = sources.get(source).value;
    if (month.month !== source.slice(9, 16)) throw new Error(`Mismatched month in ${source}`);
    for (const entry of month.lunations) add(source, 'lunation', entry.type, entry.at, ['Moon', 'Sun'], `${titleCase(entry.type)} moon`, { sign: entry.sign });
    for (const entry of month.ingresses) {
      const subtype = entry.retrograde ? 'retrograde-re-entry' : 'ingress';
      add(source, 'ingress', subtype, entry.at, [entry.planet], `${entry.planet} enters ${titleCase(entry.sign)}`, { sign: entry.sign });
    }
    for (const entry of month.stations) {
      const subtype = entry.type ?? entry.direction;
      if (!['retrograde', 'direct'].includes(subtype)) throw new Error(`Unknown station direction in ${source}`);
      add(source, 'station', subtype, entry.at, [entry.planet], `${entry.planet} stations ${subtype}`, { sign: entry.sign });
    }
    for (const entry of month.aspects) {
      if (entry.orb !== 0) continue;
      if (!interpretations.aspect[entry.type]) throw new Error(`Unsupported aspect in ${source}`);
      add(source, 'aspect', entry.type, entry.at, [entry.a, entry.b], `${entry.a} ${entry.type} ${entry.b}`, { aspectType: entry.type });
    }
  }
  for (const entry of sources.get('eclipses.json').value.eclipses) {
    add('eclipses.json', 'eclipse', entry.type, entry.peak, ['Moon', 'Sun'], `${titleCase(entry.kind)} ${entry.type} eclipse`, { sign: entry.sign });
  }
  const moon = sources.get('aura-moon-ingresses.json')?.value;
  if (moon) {
    if (!Array.isArray(moon.ingresses) || !Number.isFinite(Date.parse(moon.from)) || !Number.isFinite(Date.parse(moon.to))) throw new Error('Moon ingress coverage is invalid.');
    for (const entry of moon.ingresses) add('aura-moon-ingresses.json', 'ingress', 'ingress', entry.at, ['Moon'], `Moon enters ${titleCase(entry.sign)}`, { sign: entry.sign });
  }
  for (const entry of sky.retrogrades) {
    // An opening occupancy boundary is not a station or an exact cycle start.
    if (entry.from === sky.from) continue;
    add('sky.json', 'retrograde', 'cycle', entry.from, [entry.planet], `${entry.planet} retrograde period`, { end: entry.to ?? null });
  }
  events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const ids = new Set();
  for (const event of events) {
    if (ids.has(event.id)) throw new Error(`Duplicate sky event: ${event.id}`);
    ids.add(event.id);
    if (!event.interpretation) throw new Error(`Missing interpretation for ${event.id}`);
    if (event.family === 'eclipse') {
      const wanted = event.subtype === 'solar' ? 'new' : 'full';
      const match = events.find((other) => other.family === 'lunation' && other.subtype === wanted && Math.abs(Date.parse(other.at) - Date.parse(event.at)) < 6 * 3_600_000);
      if (!match) throw new Error(`Eclipse without corresponding lunation: ${event.id}`);
      event.linkedIds = [match.id];
      match.linkedIds = [...(match.linkedIds ?? []), event.id];
    }
  }
  const generatedAt = [sky.generatedAt, sources.get('eclipses.json').value.generatedAt].sort().at(-1);
  const manifest = {
    schema: 1, generatedAt, engineVersion, coverage: horizon, months: expectedMonths,
    supportedFamilies: ['lunation', 'eclipse', 'station', 'retrograde', 'ingress', 'aspect'],
    limitations: [
      'Committed catalog covers January 2026 through December 2030; it is not a long-term historical research dataset.',
      'Major exact aspects are limited to fast–slow and slow–slow planet pairs in the monthly catalogs; fast–fast and Moon aspects are absent.',
      moon ? `Sign ingresses cover Sun through Pluto across the catalog; Moon ingresses are supported only from ${moon.from.slice(0, 10)} to ${moon.to.slice(0, 10)} exclusive, using the committed exact Moon ingress catalog.` : 'Sign ingresses cover Sun through Pluto; Moon ingress source is unavailable.',
      'Opening retrograde periods clipped at the January 2026 boundary are omitted because their true start is outside coverage.',
      'Eclipses and their lunations are linked observations of the same event, not independent occurrences.',
      'Traditional interpretations do not establish price direction, probability, or a trading edge.',
    ],
  };
  const artifacts = new Map([['manifest.json', `${JSON.stringify(manifest, null, 2)}\n`]]);
  for (const month of expectedMonths) artifacts.set(`${month}.json`, `${JSON.stringify(events.filter((event) => event.at.startsWith(month)))}\n`);
  return { manifest, events, artifacts };
}

export async function writeLensEvents({ check = false, repo = root, outDir = output } = {}) {
  const result = await buildLensEvents(repo);
  if (!check) await mkdir(outDir, { recursive: true });
  for (const [name, content] of result.artifacts) {
    const path = resolve(outDir, name);
    if (check) {
      const existing = await readFile(path, 'utf8').catch(() => null);
      if (existing !== content) throw new Error(`Market Lens event artifact drift: ${name}. Run node scripts/build-market-lens-events.mjs.`);
    } else await writeFile(path, content);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await writeLensEvents({ check: process.argv.includes('--check') });
  console.log(`Market Lens sky catalogs: ${result.events.length} events across ${result.manifest.months.length} months${process.argv.includes('--check') ? ' verified' : ' written'}.`);
}
