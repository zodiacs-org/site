/**
 * The queries of the election search's evaluation, drawn as PREREGISTRATION.md
 * says: a seeded generator (mulberry32), so the same seed gives the same
 * queries on every machine. Each query is a request body for
 * POST /api/v1/elections. Each condition is drawn so that, three times in
 * four, it holds at the window's middle, so most queries have windows to
 * compare rather than none.
 */
import { houseOf, moonPhase, natalChart, positions } from '@zodiacs/engine';
import { EVENT_BODIES, HOUSE_SYSTEM_NAMES, SIGN_SLUGS, STATION_BODIES } from '../../../../../src/lib/compute-api/constants';

export interface Condition {
  kind: 'phase' | 'void-of-course' | 'sign' | 'retrograde' | 'angular';
  phase?: 'waxing' | 'waning';
  body?: string;
  sign?: string;
  not: boolean;
}

export interface Query {
  from: string;
  to: string;
  conditions: Condition[];
  place?: { latitude: number; longitude: number; houseSystem: string };
}

const MINUTE = 60_000;
const KINDS = ['phase', 'void-of-course', 'sign', 'retrograde', 'angular'] as const;
/** How many conditions a query draws: one to five, fewer more often. */
const COUNT_WEIGHTS = [0.3, 0.3, 0.2, 0.1, 0.1];
/** The earliest and latest starts: a window of up to ten days ends inside the API's span. */
const FIRST_START = Date.UTC(1800, 0, 1);
const LAST_START = Date.UTC(2199, 10, 30);

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(value: number, list: readonly T[]): T => list[Math.floor(value * list.length)];
const round4 = (value: number) => Math.round(value * 1e4) / 1e4;
const signOf = (lon: number) => SIGN_SLUGS[Math.floor((((lon % 360) + 360) % 360) / 30)];

/** One query: one to five distinct conditions, a window, and a place when a condition is angular. */
export function drawQuery(random: () => number): Query {
  // Every draw is made in the same order whatever it decides, so one query never shifts the next.
  const countDraw = random();
  let count = 1;
  for (let cumulative = COUNT_WEIGHTS[0]; countDraw >= cumulative && count < 5; count += 1) cumulative += COUNT_WEIGHTS[count];
  const drafts = Array.from({ length: count }, () => ({
    kind: pick(random(), KINDS),
    aligned: random() < 0.75,
    body: random(),
    sign: random(),
    phase: random(),
    not: random(),
  }));
  const angular = drafts.some((draft) => draft.kind === 'angular');
  const start = FIRST_START + Math.floor(random() * ((LAST_START - FIRST_START) / MINUTE + 1)) * MINUTE;
  const lengthDraw = random();
  // With an angular condition, 6 to 48 hours; without, 1 to 10 days; to the minute.
  const minutes = angular ? 360 + Math.floor(lengthDraw * (2880 - 360 + 1)) : 1440 + Math.floor(lengthDraw * (14400 - 1440 + 1));
  const end = start + minutes * MINUTE;
  const placeDraws = [random(), random(), random()];
  const place = angular
    ? { latitude: round4(-60 + placeDraws[0] * 120), longitude: round4(-180 + placeDraws[1] * 360), houseSystem: pick(placeDraws[2], HOUSE_SYSTEM_NAMES) }
    : undefined;
  // The sky at the window's middle, which an aligned condition is made to hold at.
  const middle = new Date(Math.floor((start + end) / 2));
  const rows = positions(middle);
  const chart = place ? natalChart({ utc: middle, latitude: place.latitude, longitude: place.longitude, houseSystem: place.houseSystem as never }) : null;
  const rowOf = (body: string) => rows.find((row) => row.body === body)!;
  const conditions: Condition[] = [];
  const seen = new Set<string>();
  for (const draft of drafts) {
    let condition: Condition;
    switch (draft.kind) {
      case 'phase': {
        const waxing = moonPhase(middle).angle < 180;
        condition = draft.aligned
          ? { kind: 'phase', phase: waxing ? 'waxing' : 'waning', not: false }
          : { kind: 'phase', phase: draft.phase < 0.5 ? 'waxing' : 'waning', not: draft.not < 0.25 };
        break;
      }
      case 'void-of-course':
        condition = { kind: 'void-of-course', not: draft.not < 0.5 };
        break;
      case 'sign': {
        const body = pick(draft.body, EVENT_BODIES);
        condition = draft.aligned
          ? { kind: 'sign', body, sign: signOf(rowOf(body).lon), not: false }
          : { kind: 'sign', body, sign: pick(draft.sign, SIGN_SLUGS), not: draft.not < 0.25 };
        break;
      }
      case 'retrograde': {
        const body = pick(draft.body, STATION_BODIES);
        condition = { kind: 'retrograde', body, not: draft.aligned ? !(rowOf(body).speed < 0) : draft.not < 0.25 };
        break;
      }
      case 'angular': {
        const body = pick(draft.body, EVENT_BODIES);
        const house = houseOf(chart!.bodies.find((row) => row.body === body)!.lon, chart!.houses!.cusps);
        condition = { kind: 'angular', body, not: draft.aligned ? ![1, 4, 7, 10].includes(house) : draft.not < 0.25 };
        break;
      }
    }
    const key = JSON.stringify(condition);
    if (seen.has(key)) continue; // A repeat is left out, so a query may hold fewer conditions than drawn.
    seen.add(key);
    conditions.push(condition);
  }
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString(), conditions, ...(place ? { place } : {}) };
}
