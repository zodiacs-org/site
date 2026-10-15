/**
 * Birthplace settlement evidence — allowed source only (Wikidata).
 *
 * For every reviewed People record, starts from the recorded birthplace (the
 * P19 entity cached in evidence/{slug}.json) and fetches that place and every
 * administrative entity that contains it (P131), up to the country, with each
 * entity's English label, classes (P31), revision id and English Wikipedia
 * title. It then searches Wikidata for other items whose English label is the
 * same as that of the birthplace or of its two nearest containing entities,
 * so a review can see where a bare name reads as a better-known place.
 *
 * Writes ../birthplace-settlements.json. birthplace-labels.mjs and
 * build-manifest.mjs read that file and never the network. Coordinates, time
 * zones and charts never read it.
 *
 *   node docs/phase5/people-pilot/tools/fetch-birthplace-settlements.mjs
 *
 * Behind an HTTPS proxy, run it with NODE_USE_ENV_PROXY=1. This is research
 * tooling run by a person, never part of a build.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PILOT = join(HERE, '..');
const UA = 'Zodiacs.org Phase 5 research (admin@zodiacs.org)';
const API = 'https://www.wikidata.org/w/api.php';
const MAX_DEPTH = 12;
const SEARCH_DEPTH = 2;
const SAME_LABEL_KEPT = 6;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function api(params, attempt = 0) {
  const url = `${API}?${new URLSearchParams({ format: 'json', maxlag: '5', ...params })}`;
  const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 5) throw new Error(`${response.status} after retries — ${url.slice(0, 160)}`);
    await sleep(Number(response.headers.get('retry-after')) * 1000 || 1500 * (attempt + 1));
    return api(params, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url.slice(0, 160)}`);
  const body = await response.json();
  if (body.error?.code === 'maxlag') {
    if (attempt >= 5) throw new Error(`maxlag after retries — ${url.slice(0, 160)}`);
    await sleep(5000);
    return api(params, attempt + 1);
  }
  if (body.error) throw new Error(`${body.error.code}: ${body.error.info} — ${url.slice(0, 160)}`);
  return body;
}

function bestClaims(claims, property) {
  const list = claims?.[property] ?? [];
  const preferred = list.filter((claim) => claim.rank === 'preferred');
  return preferred.length > 0 ? preferred : list.filter((claim) => claim.rank === 'normal');
}

const valueId = (claim) => claim.mainsnak?.datavalue?.value?.id ?? null;

/** Best-ranked P131 claims that have not ended; if every one has an end time (P582), all of them. */
function containingIds(entity) {
  const best = bestClaims(entity.claims, 'P131').filter(valueId);
  const current = best.filter((claim) => !claim.qualifiers?.P582);
  return [...new Set((current.length > 0 ? current : best).map(valueId))];
}

async function entities(ids, props) {
  const out = {};
  for (let index = 0; index < ids.length; index += 50) {
    const data = await api({
      action: 'wbgetentities',
      ids: ids.slice(index, index + 50).join('|'),
      props,
      languages: 'en',
      sitefilter: 'enwiki',
    });
    for (const [key, entity] of Object.entries(data.entities ?? {})) {
      if (entity.missing !== undefined) throw new Error(`${key} is missing on Wikidata`);
      // Keep a redirected item under the id that was asked for.
      out[entity.redirects?.from ?? key] = entity;
    }
    await sleep(150);
  }
  return out;
}

const byQid = (a, b) => Number(a.slice(1)) - Number(b.slice(1));

const manifest = JSON.parse(await readFile(join(PILOT, 'manifest.json'), 'utf8'));
const birthplaces = {};
for (const person of manifest.people) {
  const evidence = JSON.parse(await readFile(join(PILOT, 'evidence', `${person.slug}.json`), 'utf8'));
  if (evidence.birthPlace?.entity !== person.birthPlace.entity) {
    throw new Error(`${person.slug}: the manifest and the cached evidence record different birthplaces`);
  }
  birthplaces[person.slug] = evidence.birthPlace.entity;
}

const retrievedAt = new Date().toISOString();
console.log(`Walking P131 from ${new Set(Object.values(birthplaces)).size} recorded birthplaces…`);

/* 1 — the recorded birthplaces and every entity that contains them */
const places = {};
const depthOf = {};
let frontier = [...new Set(Object.values(birthplaces))].sort(byQid);
for (const id of frontier) depthOf[id] = 0;
const countries = new Set();
for (let depth = 0; frontier.length > 0; depth += 1) {
  if (depth > MAX_DEPTH) throw new Error(`P131 chain deeper than ${MAX_DEPTH} steps: ${frontier.join(', ')}`);
  const fetched = await entities(frontier.filter((id) => !countries.has(id)), 'labels|claims|info|sitelinks');
  const labelsOnly = await entities(frontier.filter((id) => countries.has(id)), 'labels|info|sitelinks');
  const next = new Set();
  for (const id of frontier) {
    if (labelsOnly[id]) {
      const entity = labelsOnly[id];
      places[id] = {
        label: entity.labels?.en?.value ?? null,
        lastrevid: entity.lastrevid,
        enwiki: entity.sitelinks?.enwiki?.title ?? null,
        country: true,
        instanceOf: [],
        locatedIn: [],
      };
      continue;
    }
    const entity = fetched[id];
    const locatedIn = containingIds(entity);
    // A country named by the place's own P17 claim ends the chain: it is
    // recorded by label, without walking its claims.
    for (const country of bestClaims(entity.claims, 'P17').map(valueId).filter(Boolean)) {
      if (locatedIn.includes(country)) countries.add(country);
    }
    places[id] = {
      label: entity.labels?.en?.value ?? null,
      lastrevid: entity.lastrevid,
      enwiki: entity.sitelinks?.enwiki?.title ?? null,
      instanceOf: [...new Set(bestClaims(entity.claims, 'P31').map(valueId).filter(Boolean))],
      locatedIn,
    };
    for (const parent of locatedIn) {
      if (!places[parent] && !(parent in depthOf)) {
        depthOf[parent] = depth + 1;
        next.add(parent);
      }
    }
  }
  console.log(`  depth ${depth}: ${frontier.length} entities`);
  frontier = [...next].sort(byQid);
}

/* 2 — labels of every class the places are instances of */
const classIds = [...new Set(Object.values(places).flatMap((place) => place.instanceOf))].sort(byQid);
const classEntities = await entities(classIds, 'labels');
const classes = Object.fromEntries(classIds.map((id) => [id, classEntities[id]?.labels?.en?.value ?? null]));

/* 3 — other items with the same English label as a birthplace or its two nearest containers */
const searchLabels = [...new Set(Object.entries(places)
  .filter(([id, place]) => depthOf[id] <= SEARCH_DEPTH && !place.country && place.label)
  .map(([, place]) => place.label))].sort();
console.log(`Searching ${searchLabels.length} labels for items with the same name…`);
const sameLabel = {};
for (const label of searchLabels) {
  const data = await api({
    action: 'wbsearchentities',
    search: label,
    language: 'en',
    uselang: 'en',
    strictlanguage: '1',
    type: 'item',
    limit: '50',
  });
  sameLabel[label] = (data.search ?? [])
    .filter((item) => item.label === label)
    .slice(0, SAME_LABEL_KEPT)
    .map((item) => [item.id, item.description ?? null]);
  await sleep(120);
}

const sortedPlaces = Object.fromEntries(Object.keys(places).sort(byQid).map((id) => [id, places[id]]));
const record = {
  schema: 'zodiacs.phase5.birthplace-settlements.v1',
  generatedBy: 'docs/phase5/people-pilot/tools/fetch-birthplace-settlements.mjs',
  retrievedAtUtc: retrievedAt,
  source: {
    name: 'Wikidata',
    api: API,
    modules: ['wbgetentities', 'wbsearchentities'],
    properties: {
      P31: 'instance of',
      P131: 'located in the administrative territorial entity',
      P17: 'country',
    },
    chain: 'From each recorded birthplace (the P19 entity cached in evidence/{slug}.json), the best-ranked P131 claims without an end time, or all best-ranked P131 claims when every one has ended, followed to the country. A country named by the place\'s own P17 claim is recorded by label only.',
    sameLabel: `Up to ${SAME_LABEL_KEPT} items, in Wikidata search order, whose English label equals the label of a recorded birthplace or of one of its ${SEARCH_DEPTH} nearest containing entities.`,
  },
  birthplaces,
  classes,
  places: sortedPlaces,
  sameLabel,
};
await writeFile(join(PILOT, 'birthplace-settlements.json'), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
console.log(`Wrote ${Object.keys(sortedPlaces).length} places, ${classIds.length} classes and ${searchLabels.length} label searches at ${retrievedAt}`);
