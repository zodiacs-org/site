/** Bounded, injected-ephemeris transit intervals. No provider or browser import. */
export type WindowTransitBody = 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | SlowTransitBody;
export type SlowTransitBody = 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';
export type WindowNatalPoint = 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | SlowTransitBody | 'ASC' | 'MC';
export type WindowAspect = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
export interface WindowNatalChart {
  bodies: readonly { body: string; lon: number }[];
  angles?: { asc: number; mc: number } | null;
}
export interface TransitWindowPeak {
  kind: 'exact' | 'closest-approach' | 'non-unique' | 'uncertain' | 'plateau' | 'none';
  atUtc?: string;
  fromUtc?: string;
  toUtc?: string;
  orbDegrees?: number;
  candidatesUtc?: string[];
}
export interface TransitWindowRange { fromUtc: string; toUtc: string }
export interface TransitWindowCertainty {
  angularBudgetDegrees: number;
  queryFromUtc: string;
  queryToUtc: string;
  /** Open time ranges whose angular margin from the orb threshold exceeds B. */
  membershipCertainRanges: TransitWindowRange[];
  /** Closed outer brackets covering angular distance <=B from exact alignment. */
  exactPossibleRanges: TransitWindowRange[];
}
export interface TransitWindow {
  id: string;
  transitBody: WindowTransitBody;
  natalPoint: WindowNatalPoint;
  aspect: WindowAspect;
  startUtc: string;
  endUtc: string;
  startClipped: boolean;
  endClipped: boolean;
  /** Model dates only: consumers suppress exact-date/count claims when topology is uncertain. */
  exactPassesUtc: string[];
  peak: TransitWindowPeak;
  membershipStatus: 'resolved' | 'uncertain';
  exactTopologyStatus: 'resolved' | 'uncertain';
  boundaryTouch?: boolean;
  localMinima?: { atUtc: string; orbDegrees: number }[];
  /** Crops retain provenance; a cropped edge is never promoted to a peak. */
  fullQueryPeak?: TransitWindowPeak;
  /** Serializable angular evidence for qualifying arbitrary/repeated crops. */
  certainty?: TransitWindowCertainty;
}
export interface TransitWindowOptions {
  transitBodies?: readonly WindowTransitBody[];
  /** Lens can narrow the documented 3° window; existing itinerary defaults stay fixed. */
  orbDegrees?: number;
  natalPoints?: readonly WindowNatalPoint[];
  aspects?: readonly WindowAspect[];
  timeKnown: boolean;
  /** Independent fixture comparison only; consumers use the fixed default budgets. */
  angularBudgetDegrees?: number;
}

export const WINDOW_SLOW_BODIES: readonly SlowTransitBody[] = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const POINTS: readonly WindowNatalPoint[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', ...WINDOW_SLOW_BODIES, 'ASC', 'MC'];
const OFFSETS: Record<WindowAspect, readonly number[]> = { conjunction: [0], sextile: [60, 300], square: [90, 270], trine: [120, 240], opposition: [180] };
const DAY = 86_400_000;
const STEP = DAY / 2;
const FIRST = Date.parse('1800-01-01T00:00:00Z');
const LAST = Date.parse('2200-01-01T00:00:00Z');
const ROOT_MS = 100;
const NUMERICAL_DEGREES = 1e-9;
const normalize = (x: number) => ((x % 360) + 360) % 360;
const delta = (x: number, y: number) => ((x - y + 540) % 360 + 360) % 360 - 180;
const iso = (x: number) => new Date(Math.round(x)).toISOString();

function checkQuery(from: Date, to: Date): [number, number] {
  const a = from.getTime(), b = to.getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b || a < FIRST || b >= LAST || b - a > 730 * DAY) {
    throw new RangeError('Choose a positive transit period of at most two years, within 1800–2199.');
  }
  return [a, b];
}

type Sample = { t: number; value: number };
type Turn = Sample & { kind: 'minimum' | 'maximum' };
type Root = { key: string; lo: number; hi: number; at: number; level: number; branch: number };
type Region = { start: number; end: number; entry?: Root; exit?: Root; touch?: boolean };
interface Trajectory {
  from: number;
  to: number;
  at(t: number): number;
  turns: Turn[];
  constant: boolean;
  branches: [number, number][];
  min: number;
  max: number;
  roots(level: number): Root[];
  regions(target: number, orb: number): Region[];
}

function makeTrajectory<T extends WindowTransitBody>(body: T, from: number, to: number, longitude: (body: T, date: Date) => number, samplingStep = STEP): Trajectory {
  if (!Number.isFinite(samplingStep) || samplingStep <= 0 || samplingStep > STEP) throw new RangeError('Transit sampling must be positive and at most twelve hours.');
  const cache = new Map<number, number>();
  const raw = (input: number) => {
    const t = Math.round(input);
    if (t < from || t > to || t < FIRST || t >= LAST) throw new RangeError('A transit probe escaped its approved period.');
    const known = cache.get(t);
    if (known !== undefined) return known;
    if (cache.size >= 120_000) throw new RangeError('This transit period needs a narrower search.');
    const value = longitude(body, new Date(t));
    if (!Number.isFinite(value)) throw new RangeError('The transit calculation returned an invalid longitude.');
    cache.set(t, normalize(value));
    return normalize(value);
  };
  const step = Math.min(samplingStep, Math.max(1, Math.floor((to - from) / 4)));
  const grid: Sample[] = [{ t: from, value: raw(from) }];
  for (let t = from; t < to;) {
    t = Math.min(t + step, to);
    const last = grid[grid.length - 1];
    grid.push({ t, value: last.value + delta(raw(t), normalize(last.value)) });
  }
  const at = (input: number) => {
    const t = Math.round(input);
    const reference = grid[Math.min(grid.length - 1, Math.max(0, Math.floor((t - from) / step)))];
    return reference.value + delta(raw(t), normalize(reference.value));
  };
  const constant = grid.every((x) => x.value === grid[0].value);
  const candidates: { lo: number; hi: number; kind: Turn['kind'] }[] = [];
  if (!constant) {
    for (let i = 1; i < grid.length - 1; i += 1) {
      const left = grid[i].value - grid[i - 1].value, right = grid[i + 1].value - grid[i].value;
      if (left === 0 && right === 0) throw new RangeError('A partially flat transit trajectory needs a narrower search.');
      const kind = left >= 0 && right <= 0 ? 'maximum' : left <= 0 && right >= 0 ? 'minimum' : null;
      if (!kind) continue;
      const prior = candidates[candidates.length - 1];
      if (prior && prior.kind === kind && grid[i - 1].t <= prior.hi) prior.hi = grid[i + 1].t;
      else candidates.push({ lo: grid[i - 1].t, hi: grid[i + 1].t, kind });
    }
  }
  const turns: Turn[] = candidates.map(({ lo: initialLo, hi: initialHi, kind }) => {
    let lo = initialLo, hi = initialHi;
    let best = { t: Math.round((lo + hi) / 2), value: at((lo + hi) / 2) };
    const take = (t: number) => {
      t = Math.round(t);
      const value = at(t);
      if (kind === 'minimum' ? value < best.value : value > best.value) best = { t, value };
      return value;
    };
    take(lo); take(hi);
    const ratio = (Math.sqrt(5) - 1) / 2;
    for (let n = 0; n < 80 && hi - lo > 2; n += 1) {
      const a = Math.round(hi - ratio * (hi - lo)), b = Math.round(lo + ratio * (hi - lo));
      if (a <= lo || b >= hi || a >= b) break;
      const va = take(a), vb = take(b);
      if (kind === 'minimum' ? va <= vb : va >= vb) hi = b;
      else lo = a;
    }
    for (let t = lo; t <= hi && t - lo <= 8; t += 1) take(t);
    if (best.t <= initialLo || best.t >= initialHi) throw new RangeError('A transit turning point could not be isolated.');
    return { ...best, kind };
  }).sort((a, b) => a.t - b.t);
  for (let i = 1; i < turns.length; i += 1) if (turns[i - 1].t >= turns[i].t) throw new RangeError('Transit turning points have unresolved order.');
  const boundaries = [from, ...turns.map((x) => x.t), to];
  const branches = boundaries.slice(0, -1).map((x, i): [number, number] => [x, boundaries[i + 1]]);
  const extremaValues = [...grid.map((x) => x.value), ...turns.map((x) => x.value)];
  const rootCache = new Map<number, Root[]>();
  function refine(lo: number, hi: number, level: number, width: number): [number, number] {
    let left = at(lo) - level, right = at(hi) - level;
    if (left === 0) return [lo, lo];
    if (right === 0) return [hi, hi];
    if (left * right >= 0) throw new RangeError('A transit boundary is not bracketed.');
    for (let n = 0; n < 80 && hi - lo > width; n += 1) {
      const middle = Math.floor((lo + hi) / 2);
      if (middle <= lo || middle >= hi) break;
      const value = at(middle) - level;
      if (value === 0) return [middle, middle];
      if ((value < 0) === (left < 0)) { lo = middle; left = value; }
      else { hi = middle; right = value; }
    }
    if (hi - lo > width) throw new RangeError('A transit boundary exceeded its numerical resolution.');
    return [lo, hi];
  }
  function roots(level: number): Root[] {
    const cached = rootCache.get(level);
    if (cached) return cached;
    const found = new Map<string, Root>();
    branches.forEach(([start, end], branch) => {
      const a = at(start) - level, b = at(end) - level;
      if (a === 0 && b === 0) {
        if (constant) return;
        throw new RangeError('A transit level has an unresolved plateau.');
      }
      if (a !== 0 && b !== 0 && a * b > 0) return;
      const [lo, hi] = refine(start, end, level, ROOT_MS);
      const key = lo === hi && boundaries.includes(lo) ? `point:${lo}:${level}` : `branch:${branch}:${level}`;
      if (!found.has(key)) found.set(key, { key, lo, hi, at: Math.round((lo + hi) / 2), level, branch });
    });
    const rows = [...found.values()].sort((a, b) => a.at - b.at);
    rootCache.set(level, rows);
    return rows;
  }
  function regions(target: number, orb: number): Region[] {
    const all = [...roots(target - orb), ...roots(target + orb)].sort((a, b) => a.at - b.at);
    for (let i = 1; i < all.length; i += 1) {
      if (all[i - 1].hi >= all[i].lo) {
        for (const row of [all[i - 1], all[i]]) {
          [row.lo, row.hi] = refine(row.lo, row.hi, row.level, 1);
          row.at = Math.round((row.lo + row.hi) / 2);
        }
        if (all[i - 1].hi >= all[i].lo) throw new RangeError('Neighboring transit boundaries remain unresolved; no gap was merged.');
      }
    }
    const internal = all.filter((x) => x.at > from && x.at < to);
    const edges = [from, ...internal.map((x) => x.at), to];
    const cells: boolean[] = [];
    const result: Region[] = [];
    for (let i = 0; i < edges.length - 1; i += 1) {
      const left = edges[i], right = edges[i + 1], midpoint = Math.round((left + right) / 2);
      if (left >= right || midpoint <= left || midpoint >= right) throw new RangeError('A transit membership cell is below clock resolution.');
      const inside = Math.abs(at(midpoint) - target) <= orb;
      cells.push(inside);
      if (!inside) continue;
      const entry = i === 0 ? all.find((x) => x.at === from) : internal[i - 1];
      const exit = i === internal.length ? all.find((x) => x.at === to) : internal[i];
      const prior = result[result.length - 1];
      if (prior && prior.end === left && prior.exit?.key === entry?.key) { prior.end = right; prior.exit = exit; }
      else result.push({ start: left, end: right, entry, exit });
    }
    internal.forEach((root, i) => {
      if (!cells[i] && !cells[i + 1] && at(root.at) === root.level) result.push({ start: root.at, end: root.at, entry: root, exit: root, touch: true });
    });
    for (const edge of [from, to]) {
      const root = all.find((x) => x.at === edge);
      if (root && !result.some((x) => x.start <= edge && edge <= x.end)) result.push({ start: edge, end: edge, entry: root, exit: root, touch: true });
    }
    return result.sort((a, b) => a.start - b.start);
  }
  return { from, to, at, turns, constant, branches, min: Math.min(...extremaValues), max: Math.max(...extremaValues), roots, regions };
}

function natalPoints(chart: WindowNatalChart, options: TransitWindowOptions): { name: WindowNatalPoint; lon: number }[] {
  const selected = options.natalPoints ? new Set(options.natalPoints) : null;
  const result = new Map<WindowNatalPoint, number>();
  function add(name: WindowNatalPoint, value: number) {
    if ((!options.timeKnown && ['Moon', 'ASC', 'MC'].includes(name)) || (selected && !selected.has(name))) return;
    if (!Number.isFinite(value)) throw new RangeError('Natal longitudes must be finite.');
    const lon = normalize(value), previous = result.get(name);
    if (previous !== undefined && previous !== lon) throw new RangeError('A natal point has conflicting longitudes.');
    result.set(name, lon);
  }
  for (const position of chart.bodies) if (POINTS.includes(position.body as WindowNatalPoint)) add(position.body as WindowNatalPoint, position.lon);
  if (options.timeKnown && chart.angles) { add('ASC', chart.angles.asc); add('MC', chart.angles.mc); }
  return POINTS.flatMap((name) => result.has(name) ? [{ name, lon: result.get(name)! }] : []);
}

export function createTransitWindowScanner<T extends WindowTransitBody = SlowTransitBody>(ephemeris: { bodyLongitude(body: T, date: Date): number }, configuration: { bodies?: readonly T[]; stepMs?: (body: T) => number } = {}) {
  return {
    scanTransitWindows(chart: WindowNatalChart, from: Date, to: Date, options: TransitWindowOptions): TransitWindow[] {
      const [start, end] = checkQuery(from, to);
      if (typeof options?.timeKnown !== 'boolean') throw new RangeError('Confirm whether the birth time is known.');
      const supported = configuration.bodies ?? WINDOW_SLOW_BODIES;
      const bodies = [...new Set(options.transitBodies ?? supported)] as T[];
      const orb = options.orbDegrees ?? 3;
      if (!Number.isFinite(orb) || orb < 0.5 || orb > 3) throw new RangeError('Choose an orb between 0.5° and 3°.');
      const aspects = [...new Set(options.aspects ?? Object.keys(OFFSETS) as WindowAspect[])];
      if (bodies.some((x) => !(supported as readonly WindowTransitBody[]).includes(x)) || aspects.some((x) => !(x in OFFSETS)) || options.natalPoints?.some((x) => !POINTS.includes(x))) throw new RangeError('Unsupported transit selection.');
      if (options.angularBudgetDegrees !== undefined && (!Number.isFinite(options.angularBudgetDegrees) || options.angularBudgetDegrees <= 0 || options.angularBudgetDegrees > 0.2)) throw new RangeError('Invalid independent comparison budget.');
      const points = natalPoints(chart, options);
      const output: TransitWindow[] = [];
      if (!points.length || !bodies.length || !aspects.length) return output;
      for (const body of bodies) {
        const track = makeTrajectory(body, start, end, ephemeris.bodyLongitude, configuration.stepMs?.(body));
        for (const point of points) for (const aspect of aspects) for (const offset of OFFSETS[aspect]) {
          // Production targets are natal calculations: combine natal and moving budgets.
          const budget = options.angularBudgetDegrees ?? (point.name === 'Moon' ? 0.20 : point.name === 'ASC' || point.name === 'MC' ? 0.15 : 0.10);
          const normalizedTarget = normalize(point.lon + offset);
          for (let lap = Math.ceil((track.min - orb - normalizedTarget) / 360); lap <= Math.floor((track.max + orb - normalizedTarget) / 360); lap += 1) {
            const target = normalizedTarget + lap * 360;
            const prefix = `${body}:${point.name}:${aspect}:${offset}:${lap}`;
            if (track.constant) {
              const distance = Math.abs(track.at(start) - target);
              const fullRange = { fromUtc: iso(start), toUtc: iso(end) };
              const certainty: TransitWindowCertainty = { angularBudgetDegrees: budget, queryFromUtc: iso(start), queryToUtc: iso(end), membershipCertainRanges: distance < orb - budget - NUMERICAL_DEGREES ? [fullRange] : [], exactPossibleRanges: distance <= budget + NUMERICAL_DEGREES ? [fullRange] : [] };
              if (distance <= orb) output.push({ id: `${prefix}:${point.lon}:plateau:${start}`, transitBody: body, natalPoint: point.name, aspect, startUtc: iso(start), endUtc: iso(end), startClipped: true, endClipped: true, exactPassesUtc: [], peak: { kind: 'plateau', fromUtc: iso(start), toUtc: iso(end), orbDegrees: distance }, membershipStatus: Math.abs(distance - orb) <= budget + NUMERICAL_DEGREES ? 'uncertain' : 'resolved', exactTopologyStatus: distance <= budget + NUMERICAL_DEGREES ? 'uncertain' : 'resolved', certainty });
              continue;
            }
            const exact = track.roots(target);
            // A turn just outside an actual component can create or close a gap
            // within the angular allowance. Qualify the geometry without merging it.
            const geometryMembershipUncertain = track.turns.some((x) => Math.abs(Math.abs(x.value - target) - orb) <= 2 * budget + NUMERICAL_DEGREES);
            const certainty: TransitWindowCertainty = {
              angularBudgetDegrees: budget, queryFromUtc: iso(start), queryToUtc: iso(end),
              membershipCertainRanges: track.regions(target, orb - budget - NUMERICAL_DEGREES).filter((x) => !x.touch).map((x) => ({ fromUtc: iso(x.entry?.hi ?? x.start), toUtc: iso(x.exit?.lo ?? x.end) })),
              exactPossibleRanges: track.regions(target, budget + NUMERICAL_DEGREES).map((x) => ({ fromUtc: iso(x.entry?.lo ?? x.start), toUtc: iso(x.exit?.hi ?? x.end) })),
            };
            for (const region of track.regions(target, orb)) {
              const insideTurns = track.turns.filter((x) => region.start < x.t && x.t < region.end);
              const contacts = exact.filter((x) => region.start <= x.at && x.at <= region.end).map((x) => x.at);
              const localMinima = insideTurns.filter((x) => {
                const signed = x.value - target;
                return signed > 0 && x.kind === 'minimum' || signed < 0 && x.kind === 'maximum';
              }).map((x) => ({ atUtc: iso(x.t), orbDegrees: Math.abs(x.value - target) }));
              const clippedOrbs = [!region.entry ? Math.abs(track.at(region.start) - target) : null, !region.exit ? Math.abs(track.at(region.end) - target) : null].filter((x): x is number => x !== null);
              const uncertainExact = insideTurns.some((x) => Math.abs(x.value - target) <= 2 * budget + NUMERICAL_DEGREES)
                || clippedOrbs.some((distance) => distance <= budget + NUMERICAL_DEGREES);
              const uncertainMembership = geometryMembershipUncertain
                || clippedOrbs.some((distance) => Math.abs(distance - orb) <= budget + NUMERICAL_DEGREES);
              let peak: TransitWindowPeak = { kind: 'none' };
              if (!region.touch && contacts.length) peak = contacts.length === 1 ? { kind: 'exact', atUtc: iso(contacts[0]), orbDegrees: 0 } : { kind: 'exact', fromUtc: iso(contacts[0]), toUtc: iso(contacts[contacts.length - 1]), orbDegrees: 0 };
              else if (!region.touch && localMinima.length) {
                const sorted = [...localMinima].sort((a, b) => a.orbDegrees - b.orbDegrees);
                const best = sorted[0];
                const smallerClippedEdge = !region.entry && Math.abs(track.at(region.start) - target) <= best.orbDegrees + NUMERICAL_DEGREES || !region.exit && Math.abs(track.at(region.end) - target) <= best.orbDegrees + NUMERICAL_DEGREES;
                if (!smallerClippedEdge) {
                  const ties = sorted.filter((x) => Math.abs(x.orbDegrees - best.orbDegrees) <= NUMERICAL_DEGREES).map((x) => x.atUtc).sort();
                  peak = ties.length === 1 ? { kind: 'closest-approach', ...best } : { kind: 'non-unique', candidatesUtc: ties, fromUtc: ties[0], toUtc: ties[ties.length - 1], orbDegrees: best.orbDegrees };
                }
              }
              if (uncertainExact && !region.touch) {
                const candidate = contacts[0] ?? (localMinima.length ? Date.parse([...localMinima].sort((a, b) => a.orbDegrees - b.orbDegrees)[0].atUtc) : null);
                peak = { kind: 'uncertain' };
                if (candidate !== null) {
                  const minimum = contacts.length ? 0 : Math.abs(track.at(candidate) - target);
                  const close = track.regions(target, minimum + 2 * budget).find((x) => x.start <= candidate && candidate <= x.end);
                  if (close) peak = { kind: 'uncertain', fromUtc: iso(Math.max(close.start, region.start)), toUtc: iso(Math.min(close.end, region.end)), orbDegrees: minimum };
                }
              }
              // Keep physical cycles distinct; a branch index alone repeats in later years.
              const identity = region.entry ? `entry:${iso(region.entry.at)}` : region.exit ? `exit:${iso(region.exit.at)}` : `clipped:${start}:${end}`;
              output.push({ id: `${prefix}:${point.lon}:${identity}`, transitBody: body, natalPoint: point.name, aspect, startUtc: iso(region.start), endUtc: iso(region.end), startClipped: !region.entry, endClipped: !region.exit, exactPassesUtc: contacts.map(iso), peak, membershipStatus: uncertainMembership ? 'uncertain' : 'resolved', exactTopologyStatus: uncertainExact ? 'uncertain' : 'resolved', certainty, ...(region.touch ? { boundaryTouch: true } : {}), ...(localMinima.length ? { localMinima } : {}) });
            }
          }
        }
      }
      return output.sort((a, b) => a.startUtc.localeCompare(b.startUtc) || a.id.localeCompare(b.id));
    },
  };
}

/** Closed intersection with stable physical identity and original peak provenance. */
export function cropTransitWindows(windows: readonly TransitWindow[], from: Date, to: Date): TransitWindow[] {
  const [a, b] = checkQuery(from, to);
  return windows.flatMap((window) => {
    const originalStart = Date.parse(window.startUtc), originalEnd = Date.parse(window.endUtc);
    const start = Math.max(a, originalStart), end = Math.min(b, originalEnd);
    if (start > end) return [];
    const exactPassesUtc = window.exactPassesUtc.filter((x) => a <= Date.parse(x) && Date.parse(x) <= b);
    const fullQueryPeak = window.fullQueryPeak ?? window.peak;
    const evidence = window.certainty;
    const cutEdges = [a, b].filter((edge) => originalStart <= edge && edge <= originalEnd
      && (!evidence || edge !== Date.parse(evidence.queryFromUtc) && edge !== Date.parse(evidence.queryToUtc)));
    // A bracket's width is used as recorded numerical evidence, never as an invented
    // calendar/time tolerance. Without evidence, every new cut is conservative.
    const uncertainMembershipEdge = cutEdges.some((edge) => !evidence?.membershipCertainRanges.some((range) => Date.parse(range.fromUtc) < edge && edge < Date.parse(range.toUtc)));
    const uncertainExactEdge = cutEdges.some((edge) => !evidence || evidence.exactPossibleRanges.some((range) => Date.parse(range.fromUtc) <= edge && edge <= Date.parse(range.toUtc)));
    const membershipStatus = window.membershipStatus === 'uncertain' || uncertainMembershipEdge ? 'uncertain' : 'resolved';
    const exactTopologyStatus = window.exactTopologyStatus === 'uncertain' || uncertainExactEdge ? 'uncertain' : 'resolved';
    let peak: TransitWindowPeak = { kind: 'none' };
    if (window.peak.kind === 'plateau') peak = { ...window.peak, fromUtc: iso(start), toUtc: iso(end) };
    else if (window.peak.kind === 'non-unique') {
      const candidates = window.peak.candidatesUtc?.filter((x) => a <= Date.parse(x) && Date.parse(x) <= b) ?? [];
      if (candidates.length > 1) peak = { ...window.peak, candidatesUtc: candidates, fromUtc: candidates[0], toUtc: candidates[candidates.length - 1] };
      else if (candidates.length === 1) peak = { kind: 'closest-approach', atUtc: candidates[0], orbDegrees: window.peak.orbDegrees };
    }
    else if (window.peak.atUtc && a <= Date.parse(window.peak.atUtc) && Date.parse(window.peak.atUtc) <= b) peak = window.peak;
    else if (window.peak.fromUtc && window.peak.toUtc && a <= Date.parse(window.peak.fromUtc) && Date.parse(window.peak.toUtc) <= b) peak = window.peak;
    else if (window.peak.kind === 'exact' && exactPassesUtc.length) peak = exactPassesUtc.length === 1 ? { kind: 'exact', atUtc: exactPassesUtc[0], orbDegrees: 0 } : { kind: 'exact', fromUtc: exactPassesUtc[0], toUtc: exactPassesUtc[exactPassesUtc.length - 1], orbDegrees: 0 };
    if (exactTopologyStatus === 'uncertain' && peak.kind !== 'plateau') peak = peak.kind === 'uncertain' ? peak : { kind: 'uncertain' };
    return [{ ...window, startUtc: iso(start), endUtc: iso(end), startClipped: window.startClipped || start > originalStart, endClipped: window.endClipped || end < originalEnd, exactPassesUtc, peak, fullQueryPeak, membershipStatus, exactTopologyStatus, localMinima: window.localMinima?.filter((x) => a <= Date.parse(x.atUtc) && Date.parse(x.atUtc) <= b), ...(start === end ? { boundaryTouch: window.boundaryTouch ?? false } : {}) }];
  });
}
