/**
 * Lists every sky event the 2027 event pages in scope name, with the instant
 * the committed data files give it, so each can be solved on NASA JPL
 * Horizons (horizons_event_times.py).
 *
 * In scope: each 2027 full moon, eclipse, retrograde cycle with a page of its
 * own (Mercury, Venus, Mars) and slow-planet ingress. Named on those pages:
 * the event itself, its shadow edges, the events before and after it in its
 * own stream, the nearby events, and the eclipse or lunation it pairs with.
 *
 * Usage: npx vite-node --script docs/platform/evidence/event-pages-2027-20261113/tools/dump-referenced-events.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sky from '../../../../../src/data/sky.json';
import eclipsesData from '../../../../../src/data/eclipses.json';
import ingressesData from '../../../../../src/data/ingresses.json';
import { eventsCatalog } from '../../../../../src/lib/events/catalog';
import type { CatalogEvent } from '../../../../../src/lib/events/types';

const YEAR = '2027';
const catalog = eventsCatalog();
const committedAnchor = (event: CatalogEvent): string =>
  event.facts.committed?.anchor ?? event.facts.at ?? event.facts.start ?? '';

const inScope = catalog.pages.filter((event) => {
  if (!committedAnchor(event).startsWith(YEAR)) return false;
  const { family, subtype } = event.facts;
  return (family === 'lunation' && subtype === 'full')
    || family === 'eclipse' || family === 'retrograde' || family === 'ingress';
});

interface Solve {
  key: string;
  kind: 'lunation' | 'eclipse' | 'station' | 'shadow' | 'ingress' | 'aspect';
  /** What the committed data files (the site's engine) give. */
  engine: string;
  detail: Record<string, unknown>;
  /** The in-scope pages that name it. */
  pages: string[];
}

const solves = new Map<string, Solve>();
const add = (solve: Omit<Solve, 'pages'>, page: string) => {
  const existing = solves.get(solve.key);
  if (existing) {
    if (!existing.pages.includes(page)) existing.pages.push(page);
    return;
  }
  solves.set(solve.key, { ...solve, pages: [page] });
};

const retroWindows = sky.retrogrades as {
  planet: string; from: string; to: string | null; preShadowStart?: string | null; postShadowEnd?: string | null;
}[];
const moons = sky.moons as { type: 'full' | 'new'; at: string }[];
const eclipses = eclipsesData.eclipses as { type: 'solar' | 'lunar'; kind: string; peak: string }[];
const ingressWindows = ingressesData.windows as { planet: string; sign: string; from: string; to: string }[];

function addEvent(event: CatalogEvent, page: string, withShadows: boolean) {
  const { facts } = event;
  const anchor = committedAnchor(event);
  switch (facts.family) {
    case 'lunation': {
      const moon = moons.find((m) => m.type === facts.subtype && m.at.slice(0, 10) === anchor.slice(0, 10));
      if (!moon) throw new Error(`No sky.json moon for ${facts.id}`);
      add({ key: `lunation:${facts.subtype}:${moon.at}`, kind: 'lunation', engine: moon.at, detail: { type: facts.subtype, catalogAt: anchor } }, page);
      break;
    }
    case 'eclipse': {
      const eclipse = eclipses.find((e) => e.peak === anchor);
      if (!eclipse) throw new Error(`No eclipses.json row for ${facts.id}`);
      add({ key: `eclipse:${eclipse.type}:${eclipse.peak}`, kind: 'eclipse', engine: eclipse.peak, detail: { type: eclipse.type, eclipseKind: eclipse.kind } }, page);
      break;
    }
    case 'retrograde': {
      const planet = facts.bodies[0];
      const window = retroWindows.find((w) => w.planet === planet && w.from === anchor);
      if (!window) throw new Error(`No sky.json window for ${facts.id}`);
      if (window.from !== sky.from) {
        add({ key: `station:${planet}:retrograde:${window.from}`, kind: 'station', engine: window.from, detail: { body: planet, direction: 'retrograde' } }, page);
      }
      if (window.to) {
        add({ key: `station:${planet}:direct:${window.to}`, kind: 'station', engine: window.to, detail: { body: planet, direction: 'direct' } }, page);
      }
      if (withShadows && window.to) {
        if (window.preShadowStart) {
          add({ key: `shadow:${planet}:pre:${window.preShadowStart}`, kind: 'shadow', engine: window.preShadowStart, detail: { body: planet, edge: 'pre', stationRetrograde: window.from, stationDirect: window.to } }, page);
        }
        if (window.postShadowEnd) {
          add({ key: `shadow:${planet}:post:${window.postShadowEnd}`, kind: 'shadow', engine: window.postShadowEnd, detail: { body: planet, edge: 'post', stationRetrograde: window.from, stationDirect: window.to } }, page);
        }
      }
      break;
    }
    case 'station': {
      const planet = facts.bodies[0];
      add({ key: `station:${planet}:${facts.direction}:${anchor}`, kind: 'station', engine: anchor, detail: { body: planet, direction: facts.direction } }, page);
      break;
    }
    case 'ingress': {
      const planet = facts.bodies[0];
      add({ key: `ingress:${planet}:${facts.signs[0]}:${anchor}`, kind: 'ingress', engine: anchor, detail: { body: planet, sign: facts.signs[0] } }, page);
      break;
    }
    case 'aspect': {
      const [a, b] = facts.bodies;
      add({ key: `aspect:${a}:${facts.aspectType}:${b}:${anchor}`, kind: 'aspect', engine: anchor, detail: { a, b, type: facts.aspectType } }, page);
      break;
    }
  }
}

const pages = inScope.map((event) => {
  const { facts, relations } = event;
  addEvent(event, facts.id, true);
  const related = [
    relations.previous, relations.next, relations.lunation, relations.eclipse, relations.cycle, ...relations.nearby,
  ].filter((link): link is NonNullable<typeof link> => Boolean(link));
  for (const link of related) {
    const target = catalog.byId.get(link.id);
    if (!target) throw new Error(`Unresolved relation ${link.id} on ${facts.id}`);
    addEvent(target, facts.id, false);
  }
  // The sign a slow planet enters is left at its next ingress; the page says when.
  if (facts.family === 'ingress') {
    const planet = facts.bodies[0];
    const anchor = committedAnchor(event);
    const window = ingressWindows.find((w) => w.planet === planet && w.from === anchor);
    const leaves = window && ingressWindows.find((w) => w.planet === planet && w.from === window.to);
    if (leaves) {
      add({ key: `ingress:${planet}:${leaves.sign}:${leaves.from}`, kind: 'ingress', engine: leaves.from, detail: { body: planet, sign: leaves.sign } }, facts.id);
    }
  }
  return {
    id: facts.id,
    path: facts.path,
    family: facts.family,
    subtype: facts.subtype,
    title: facts.committed?.title ?? facts.title,
    // The sign and position the page prints, from the site's engine and data files.
    signs: facts.signs,
    ...(facts.longitude === undefined ? {} : { longitude: facts.longitude }),
    related: related.map((link) => link.id),
  };
});

// Every other 2027 new and full moon, so the year's lunations are solved as one set.
for (const moon of moons) {
  if (!moon.at.startsWith(YEAR)) continue;
  const key = `lunation:${moon.type}:${moon.at}`;
  if (!solves.has(key)) {
    solves.set(key, { key, kind: 'lunation', engine: moon.at, detail: { type: moon.type, catalogAt: moon.at }, pages: [] });
  }
}

const out = {
  what: 'Every sky event the in-scope 2027 event pages name, with the instant the committed data files give it',
  scope: 'each 2027 full moon, eclipse, Mercury, Venus or Mars retrograde cycle and slow-planet ingress with a page of its own',
  pages,
  solves: [...solves.values()].sort((a, b) => a.engine.localeCompare(b.engine) || a.key.localeCompare(b.key)),
};
const target = fileURLToPath(new URL('../referenced-events.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(out, null, 1)}\n`);
console.log(`${pages.length} pages, ${out.solves.length} events to solve -> ${target}`);
