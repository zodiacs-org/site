/**
 * The visibility map on /eclipses/ (src/components/sky/EclipseVisibilityMap.astro),
 * drawn at build time from src/data/eclipse-visibility.json
 * (scripts/build-eclipse-visibility.mjs) on the land dots of
 * src/data/astrocartography-land.json, in the same equirectangular frame as
 * the /astrocartography/ map (720 by 360, west on the left). Nothing here
 * reaches the browser except the SVG it draws.
 */
import land from '../data/astrocartography-land.json';
import visibility from '../data/eclipse-visibility.json';

export const MAP_W = 720;
export const MAP_H = 360;
/** Viewbox units per land cell (2 degrees). */
const CELL_PX = (land.cellDegrees / 360) * MAP_W;
export const SWEEP_STEPS = 8;

export type Continent = (typeof visibility.continents)[number];

export interface VisibilityEclipse {
  id: string;
  type: 'solar' | 'lunar';
  kind: string;
  peak: string;
  phase: 'partial' | 'umbral' | 'penumbral';
  visible: string;
  sweep: string;
  regions: [string, number, number][];
  first?: string;
  last?: string;
  from?: string;
  to?: string;
  greatest?: { lat: number; lon: number; at: string };
  overhead?: { lat: number; lon: number; at: string };
  path?: { from: string; to: string; segments: [number, number][][] };
}

export const eclipseVisibility = visibility.eclipses as VisibilityEclipse[];
export const continents = visibility.continents as Continent[];
const cells = land.cells as [number, number][];

export const xOf = (lon: number) => ((lon + 180) / 360) * MAP_W;
export const yOf = (lat: number) => ((90 - lat) / 180) * MAP_H;
const cellX = (col: number) => col * CELL_PX + CELL_PX / 2;
const cellY = (row: number) => MAP_H - (row * CELL_PX + CELL_PX / 2);
const n = (value: number) => String(Math.round(value * 10) / 10);

/** Every land cell as a dot: a zero-length stroke with round caps, drawn row by row from the south. */
export function landDotsPath(): string {
  let d = '';
  let prev: [number, number] | null = null;
  for (const [row, col] of cells) {
    const x = cellX(col);
    const y = cellY(row);
    d += prev ? `m${n(x - prev[0])} ${n(y - prev[1])}h0` : `M${n(x)} ${n(y)}h0`;
    prev = [x, y];
  }
  return d;
}

/** Which land cells see the eclipse, in the land file's order. */
export function visibleFlags(eclipse: VisibilityEclipse): boolean[] {
  const bytes = Uint8Array.from(atob(eclipse.visible), (c) => c.charCodeAt(0));
  return cells.map((_, i) => (bytes[i >> 3] & (0x80 >> (i & 7))) !== 0);
}

/** For each sweep step, which land cells light at that step (the visible cells, split by their digit). */
export function sweepFlags(eclipse: VisibilityEclipse): boolean[][] {
  const flags = visibleFlags(eclipse);
  const steps = Array.from({ length: SWEEP_STEPS }, () => cells.map(() => false));
  let k = 0;
  flags.forEach((on, i) => {
    if (!on) return;
    steps[Number(eclipse.sweep[k])][i] = true;
    k += 1;
  });
  return steps;
}

/**
 * A clip shape that holds exactly the flagged land dots: one band per run of
 * flagged cells along a row of latitude, running across the sea between them,
 * where there are no dots to catch.
 */
export function cellRunsPath(flags: boolean[]): string {
  let d = '';
  let row = -1;
  let start: number | null = null;
  let end = 0;
  const flush = () => {
    if (start === null) return;
    const w = (end - start + 1) * CELL_PX;
    d += `M${n(start * CELL_PX)} ${n(MAP_H - (row + 1) * CELL_PX)}h${n(w)}v${n(CELL_PX)}h-${n(w)}z`;
    start = null;
  };
  cells.forEach(([r, c], i) => {
    if (r !== row) { flush(); row = r; }
    if (flags[i]) {
      if (start === null) start = c;
      end = c;
    } else {
      flush();
    }
  });
  flush();
  return d;
}

/**
 * The central path as SVG path data, one subpath per piece between antimeridian
 * crossings, keeping a point once it lies 1.5 viewbox units (three quarters of
 * a degree) from the last one kept, and always the ends.
 */
export function centralPathData(eclipse: VisibilityEclipse): string[] {
  return (eclipse.path?.segments ?? [])
    .filter((seg) => seg.length > 1)
    .map((seg) => {
      const pts = seg.map(([lon, lat]) => [xOf(lon), yOf(lat)]);
      const kept = [pts[0]];
      for (let i = 1; i < pts.length - 1; i += 1) {
        const last = kept[kept.length - 1];
        if (Math.hypot(pts[i][0] - last[0], pts[i][1] - last[1]) >= 1.5) kept.push(pts[i]);
      }
      kept.push(pts[pts.length - 1]);
      return kept.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join('');
    });
}

export interface RegionWords {
  all: string;
  most: string;
  parts: string;
  and: string;
  continents: Record<Continent, string>;
}

/**
 * The continents whose towns see the eclipse, in words: "all of" when every
 * land cell there sees it, "most of" for half or more, "parts of" for fewer.
 */
export function regionPhrase(eclipse: VisibilityEclipse, words: RegionWords): string {
  const join = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${words.and} ${names[names.length - 1]}`);
  const groups: Record<'all' | 'most' | 'parts', string[]> = { all: [], most: [], parts: [] };
  const ranked = eclipse.regions
    .filter(([, visible]) => visible > 0)
    .sort((a, b) => b[1] / b[2] - a[1] / a[2] || continents.indexOf(a[0] as Continent) - continents.indexOf(b[0] as Continent));
  for (const [name, visible, total] of ranked) {
    const label = words.continents[name as Continent];
    if (visible === total) groups.all.push(label);
    else if (visible * 2 >= total) groups.most.push(label);
    else groups.parts.push(label);
  }
  return (['all', 'most', 'parts'] as const)
    .filter((key) => groups[key].length)
    .map((key) => `${words[key]} ${join(groups[key])}`)
    .join(', ');
}

export interface MapEclipse {
  /** The table row's anchor, `eclipse-YYYY-MM-DD-solar|lunar`. */
  id: string;
  /** "Total solar eclipse, Wed, August 12, 2026". */
  title: string;
  /** The chip: "Aug 12" and "Solar". */
  day: string;
  type: string;
  year: number;
  hue: string;
  past: boolean;
}

export interface MapLabels {
  heading: string;
  pick: string;
  visibleFrom: string;
  /** Legend for the lit dots, by `solar`, or the lunar kind (`total`, `partial`, `penumbral`). */
  region: Record<'solar' | 'total' | 'partial' | 'penumbral', string>;
  pathTotal: string;
  pathAnnular: string;
  greatest: string;
  overhead: string;
  source: string;
  words: RegionWords;
}

/** The single pass, in ms: when each sweep step lights, when the central path draws, and the closing mark. */
export interface StoryTimes {
  steps: number[];
  path: { t: number; d: number } | null;
  mark: number | null;
}

const LEAD_MS = 1500;
/**
 * Solar: the steps light in the order the eclipse reaches its maximum across
 * the map, on one clock with the central path, which draws from the moment
 * the shadow's axis first meets the Earth to the moment it leaves; the
 * greatest-eclipse ring closes the pass. Lunar: every place sees the same
 * Moon at the same instant, so the ring under the overhead Moon comes first
 * and the steps light outward from it, highest Moon first.
 */
export function storyTimes(eclipse: VisibilityEclipse): StoryTimes {
  if (eclipse.type === 'lunar') {
    return {
      steps: Array.from({ length: SWEEP_STEPS }, (_, k) => 200 + Math.round((k / SWEEP_STEPS) * 1200)),
      path: null,
      mark: eclipse.overhead ? 0 : null,
    };
  }
  const first = Date.parse(eclipse.first!);
  const span = Math.max(1, Date.parse(eclipse.last!) - first);
  const at = (iso: string) => Math.min(1, Math.max(0, (Date.parse(iso) - first) / span)) * LEAD_MS;
  const path = eclipse.path ? { t: Math.round(at(eclipse.path.from)), d: Math.max(200, Math.round(at(eclipse.path.to) - at(eclipse.path.from))) } : null;
  return {
    steps: Array.from({ length: SWEEP_STEPS }, (_, k) => Math.round((k / SWEEP_STEPS) * LEAD_MS)),
    path,
    mark: eclipse.greatest ? LEAD_MS + 300 : null,
  };
}
