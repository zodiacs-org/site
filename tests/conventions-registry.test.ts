import { describe, expect, it } from 'vitest';
import registry from '../src/data/conventions/registry.json';
import summary from '../src/data/conformance/summary.json';
import examples from '../src/lib/compute-api/examples.json';
import { GET as registryJson } from '../src/pages/developers/conventions/registry.json';
import { HOUSE_SYSTEMS, natalChart, type ChartFlag, type DeltaT, type DeltaTSegment, type TimeScale, type TimeScaleName } from '@zodiacs/engine';
import { NATAL_RECEIPT_CONVENTION_SETS, createNatalEnvelope, type NatalReceipt, type NatalReference } from '@zodiacs/engine/receipt';
import { CALC_AYANAMSAS, CALC_BODIES, CALC_FRAMES, calc, chart, events, houses } from '@zodiacs/engine/calc';
import { AYANAMSAS } from '@zodiacs/engine/vedic';

type Source = { title: string; url?: string };
type Entry = { id: string; value: string; title: string; definition: string; sources: Source[]; status: string; writtenBy?: string };
type Namespace = { name: string; title: string; description: string; usedIn: string[]; entries: Entry[] };
const namespaces = registry.namespaces as Namespace[];
const entries = namespaces.flatMap((space) => space.entries.map((entry) => ({ ...entry, namespace: space.name })));
const ids = new Set(entries.map((entry) => entry.id));
const values = (namespace: string) => namespaces.find((space) => space.name === namespace)!.entries.map((entry) => entry.value);
const group = (title: string) => registry.groups.find((candidate) => candidate.title === title)!.namespaces;

// The engine versions that wrote each natal conventions set, newest first (src/receipt.ts).
const SET_RANGES = ['0.1.1-rc.16 to 1.0.0', '0.1.1-rc.15', '0.1.1-rc.8 to rc.14', '0.1.1-rc.7', '0.1.1-rc.3 to rc.6'];

/** The ids a natal receipt names: each field's namespace and value, as the registry's usedIn lists them. */
function natalReceiptIds(receipt: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries((receipt.conventions ?? {}) as Record<string, string>)) out.push(`${key}:${value}`);
  for (const [key, value] of Object.entries((receipt.coverage ?? {}) as Record<string, string>)) out.push(`${key}:${value}`);
  const housesField = receipt.houses as { requested?: string | null; actual?: string | null; absenceReason?: string | null } | undefined;
  for (const system of [housesField?.requested, housesField?.actual]) if (system) out.push(`house:${system}`);
  if (housesField?.absenceReason) out.push(`house-absence:${housesField.absenceReason}`);
  for (const flag of [...((receipt.inputFlags ?? []) as string[]), ...((receipt.resultFlags ?? []) as string[])]) out.push(`flag:${flag}`);
  if (receipt.reference) out.push(`reference:${receipt.reference as string}`);
  if (receipt.timeScale) out.push(`time-scale:${receipt.timeScale as string}`);
  const ephemeris = (receipt.engine as { ephemeris?: { name: string; version: string } } | undefined)?.ephemeris;
  if (ephemeris) out.push(`ephemeris:${ephemeris.name}@${ephemeris.version}`);
  return out;
}

/** The ids a calc receipt names: its conventions, and each instant's time records. */
function calcReceiptIds(receipt: { conventions: readonly string[]; instants: readonly unknown[]; engine: { ephemeris: { name: string; version: string } } }): string[] {
  const out = [...receipt.conventions, `ephemeris:${receipt.engine.ephemeris.name}@${receipt.engine.ephemeris.version}`];
  for (const instant of receipt.instants as Array<{ deltaT: { model: string; segment: string }; timeScale: { input: string; basis: string; ut1MinusUtc: { source: string } | null } }>) {
    out.push(`deltat-model:${instant.deltaT.model}`, `deltat-segment:${instant.deltaT.segment}`, `time-scale:${instant.timeScale.input}`, `time-basis:${instant.timeScale.basis}`);
    if (instant.timeScale.ut1MinusUtc) out.push(`ut1-source:${instant.timeScale.ut1MinusUtc.source}`);
  }
  return out;
}

/** The ids a compute API receipt names, from the fields the compute receipt adds to the engine's. */
function computeReceiptIds(receipt: Record<string, unknown>): string[] {
  if (receipt.schema !== 'zodiacs.compute-receipt.v1') return natalReceiptIds(receipt);
  const out = natalReceiptIds({ conventions: receipt.conventions, coverage: receipt.coverage, engine: receipt.engine });
  out.push(`endpoint:${receipt.endpoint as string}`);
  for (const source of (receipt.deltaT ?? []) as Array<{ model: string }>) out.push(`deltat-model:${source.model}`);
  const policy = (receipt.timeResolution as { policy?: { fold?: string; gap?: string } } | undefined)?.policy;
  if (policy?.fold) out.push(`fold-policy:${policy.fold}`);
  if (policy?.gap) out.push(`gap-policy:${policy.gap}`);
  for (const search of [receipt.search, receipt.electionSearch] as Array<Record<string, unknown> | undefined>) {
    if (!search) continue;
    out.push(`search-solver:${search.solver as string}`, `search-window:${search.window as string}`, `completeness:${search.completeness as string}`);
    const voidOfCourse = search.voidOfCourse as { convention: string; bodies: string } | undefined;
    if (voidOfCourse) out.push(`void-of-course:${voidOfCourse.convention}`, `void-of-course-bodies:${voidOfCourse.bodies}`);
  }
  return out;
}

/** Every calc call the tests make: each frame, center and correction, every body, each ayanamsa, a pinned ΔT, each house system. */
function calcReceipts() {
  const time = '2000-01-01T12:00:00Z';
  const results: Array<{ status: string; receipt?: Parameters<typeof calcReceiptIds>[0] }> = [];
  for (const frame of CALC_FRAMES) {
    for (const correction of ['apparent', 'astrometric', 'geometric'] as const) {
      for (const center of ['geocentric', 'heliocentric', 'barycentric'] as const) results.push(calc({ body: 'Mars', time, frame, center, flags: { correction, speeds: true } }) as never);
    }
  }
  results.push(calc({ body: 'Moon', time, center: { topocentric: { latitude: 51.5, longitude: -0.1, height: 10 } } }) as never);
  for (const body of CALC_BODIES) results.push(calc({ body, time, flags: { speeds: true } }) as never);
  for (const ayanamsa of CALC_AYANAMSAS) results.push(calc({ body: 'Sun', time, zodiac: { sidereal: ayanamsa } }) as never);
  results.push(calc({ body: 'Sun', time, zodiac: { sidereal: { epoch: time, value: 23.85 } } }) as never);
  results.push(calc({ body: 'Sun', time, zodiac: { sidereal: { epoch: time, value: 23.85, rate: 50.29 } } }) as never);
  results.push(calc({ body: 'Sun', time: { iso: time, deltaT: 64 } }) as never);
  for (const instant of ['1800-06-01T00:00:00Z', '2027-06-01T00:00:00Z', '2150-01-01T00:00:00Z']) results.push(calc({ body: 'Sun', time: instant }) as never);
  results.push(calc({ body: 'Sun', time: { jd: 2451545, scale: 'tt' } }) as never);
  results.push(calc({ body: 'Sun', time: { jd: 2451545, scale: 'ut1' } }) as never);
  for (const houseSystem of HOUSE_SYSTEMS) results.push(houses({ time, place: { latitude: 51.5, longitude: -0.1 }, houseSystem }) as never);
  results.push(houses({ time, place: { latitude: 75, longitude: 20 }, houseSystem: 'placidus' }) as never);
  results.push(chart({ time, place: { latitude: 51.5, longitude: -0.1 }, houseSystem: 'koch' }) as never);
  results.push(chart({ time, place: { latitude: 51.5, longitude: -0.1 }, zodiac: { sidereal: 'lahiri' } }) as never);
  results.push(events({ kind: 'longitude-crossing', body: 'Sun', longitude: 0, from: '2026-01-01T00:00:00Z', to: '2026-12-31T00:00:00Z' }) as never);
  return results.filter((result) => result.status === 'ok').map((result) => result.receipt!);
}

/** Natal receipts across the conditions their fields name: untimed, polar, outside the span, flagged, and each scale. */
function natalReceipts() {
  const charts = [
    natalChart({ utc: '1990-06-15T13:30:00Z', timeKnown: true, latitude: 51.5, longitude: -0.12, houseSystem: 'placidus' }),
    natalChart({ utc: '1990-06-15T12:00:00Z', timeKnown: false }),
    natalChart({ utc: '1990-06-15T13:30:00Z', timeKnown: true }),
    natalChart({ utc: '1990-12-21T12:00:00Z', timeKnown: true, latitude: 78.2, longitude: 15.6, houseSystem: 'koch' }),
    natalChart({ utc: '2250-01-01T00:00:00Z', timeKnown: true, latitude: 10, longitude: 10 }),
    natalChart({ utc: '1883-11-18T17:00:00Z', timeKnown: true, latitude: 40.7, longitude: -74, flags: ['dst-fold', 'lmt'] }),
    natalChart({ utc: '2011-12-30T10:00:00Z', timeKnown: true, latitude: -13.8, longitude: -171.8, flags: ['dst-gap'] }),
    natalChart({ utc: '1990-06-15T13:30:00Z', timeScale: 'tt', timeKnown: true, latitude: 0, longitude: 0 }),
    natalChart({ utc: '1990-06-15T13:30:00Z', timeScale: 'ut1', timeKnown: true, latitude: 0, longitude: 0 }),
  ];
  return [
    ...charts.map((built) => createNatalEnvelope(built).receipt),
    createNatalEnvelope(natalChart({ utc: '1990-06-15T12:00:00Z', timeKnown: false }), { reference: 'utc-noon' }).receipt,
  ] as unknown as Array<Record<string, unknown>>;
}

describe('the conventions registry', () => {
  it('gives every id its namespace, a definition and a source, once, in a listed group', () => {
    expect(entries.length).toBe(ids.size);
    for (const entry of entries) {
      expect(entry.id, entry.id).toBe(`${entry.namespace}:${entry.value}`);
      expect(entry.title.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.definition.trim().length, entry.id).toBeGreaterThan(15);
      expect(entry.sources.length, entry.id).toBeGreaterThan(0);
      for (const source of entry.sources) {
        expect(source.title.trim().length, entry.id).toBeGreaterThan(0);
        if (source.url !== undefined) expect(source.url, entry.id).toMatch(/^https:\/\/[^\s]+$/u);
      }
      expect(['current', 'superseded'], entry.id).toContain(entry.status);
      if (entry.status === 'superseded') expect(entry.writtenBy, entry.id).toBeTruthy();
    }
    expect(registry.groups.flatMap((candidate) => candidate.namespaces).sort()).toEqual(namespaces.map((space) => space.name).sort());
    expect(new Set(namespaces.map((space) => space.name)).size).toBe(namespaces.length);
  });

  it('holds every value of every natal conventions set, current where 1.0.0 writes it and superseded where only earlier versions did', () => {
    const seen = new Set<string>();
    NATAL_RECEIPT_CONVENTION_SETS.forEach((set, index) => {
      for (const [key, value] of Object.entries(set)) {
        const id = `${key}:${value}`;
        seen.add(id);
        const entry = entries.find((candidate) => candidate.id === id);
        expect(entry, id).toBeDefined();
        expect(entry!.writtenBy, id).toContain(SET_RANGES[index]);
      }
    });
    for (const id of seen) {
      const entry = entries.find((candidate) => candidate.id === id)!;
      const current = Object.entries(NATAL_RECEIPT_CONVENTION_SETS[0]).some(([key, value]) => `${key}:${value}` === id);
      expect(entry.status, id).toBe(current ? 'current' : 'superseded');
    }
    // The natal receipt's own namespaces hold nothing else.
    for (const namespace of group('Natal receipt conventions')) {
      for (const value of values(namespace)) expect(seen.has(`${namespace}:${value}`), `${namespace}:${value}`).toBe(true);
    }
  });

  it('holds exactly the convention ids calc receipts write, beside the natal sets\' values', () => {
    const written = new Set(calcReceipts().flatMap((receipt) => receipt.conventions));
    const natalIds = new Set(NATAL_RECEIPT_CONVENTION_SETS.flatMap((set) => Object.entries(set).map(([key, value]) => `${key}:${value}`)));
    for (const id of written) expect(ids.has(id), id).toBe(true);
    const calculation = new Set(group('Calculation conventions'));
    const registered = entries.filter((entry) => calculation.has(entry.namespace)).map((entry) => entry.id);
    expect(registered.filter((id) => !written.has(id) && !natalIds.has(id))).toEqual([]);
    expect(written.size).toBeGreaterThan(60);
  });

  it('takes each ayanamsa\'s name, label and citation from the engine', () => {
    expect(values('ayanamsa')).toEqual([...CALC_AYANAMSAS, 'user-epoch', 'user-linear']);
    for (const name of CALC_AYANAMSAS) {
      const entry = entries.find((candidate) => candidate.id === `ayanamsa:${name}`)!;
      const definition = (AYANAMSAS as Record<string, { label: string; source: string }>)[name];
      expect(entry.title).toBe(definition.label);
      expect(entry.sources.map((source) => source.title)).toContain(definition.source);
    }
    expect(values('house')).toEqual([...HOUSE_SYSTEMS]);
    expect(values('frame')).toEqual([...CALC_FRAMES]);
  });

  it('lists exactly the values of the engine\'s closed vocabularies', () => {
    type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
    const FLAGS = ['dst-gap', 'dst-fold', 'lmt', 'no-time', 'polar-fallback', 'outside-reference-span'] as const;
    const REFERENCES = ['supplied-instant', 'utc-noon', 'local-noon'] as const;
    const SCALES = ['utc', 'ut1', 'tt'] as const;
    const SEGMENTS = ['long-term', 'reconstructed', 'observed', 'predicted', 'extrapolated', 'pinned', 'fallback'] as const;
    const ABSENCES = ['unknown-time', 'missing-location'] as const;
    const exact: [
      Exactly<typeof FLAGS[number], ChartFlag>,
      Exactly<typeof REFERENCES[number], NatalReference>,
      Exactly<typeof SCALES[number], TimeScaleName>,
      Exactly<typeof SEGMENTS[number], DeltaTSegment>,
      Exactly<typeof ABSENCES[number], NonNullable<NatalReceipt['houses']['absenceReason']>>,
    ] = [true, true, true, true, true];
    expect(exact.every(Boolean)).toBe(true);
    expect(values('flag')).toEqual([...FLAGS]);
    expect(values('reference')).toEqual([...REFERENCES]);
    expect(values('time-scale')).toEqual([...SCALES]);
    expect(values('deltat-segment')).toEqual([...SEGMENTS]);
    expect(values('house-absence')).toEqual([...ABSENCES]);
    type Basis = TimeScale['basis'];
    type Model = DeltaT['model'];
    type Source = NonNullable<TimeScale['ut1MinusUtc']>['source'];
    const BASES = ['iers', 'delta-t', 'pinned'] as const;
    const MODELS = ['iers-utc/1', 'zodiacs-deltat/1', 'pinned'] as const;
    const SOURCES = ['observed', 'predicted', 'fallback'] as const;
    const records: [Exactly<typeof BASES[number], Basis>, Exactly<typeof MODELS[number], Model>, Exactly<typeof SOURCES[number], Source>] = [true, true, true];
    expect(records.every(Boolean)).toBe(true);
    expect(values('time-basis')).toEqual([...BASES]);
    expect(values('deltat-model')).toEqual([...MODELS]);
    expect(values('ut1-source')).toEqual([...SOURCES]);
  });

  it('holds every id that natal, calc and compute API receipts name', () => {
    const named = new Set<string>();
    for (const receipt of natalReceipts()) for (const id of natalReceiptIds(receipt)) named.add(id);
    for (const receipt of calcReceipts()) for (const id of calcReceiptIds(receipt)) named.add(id);
    for (const cases of Object.values(examples.success as Record<string, Record<string, { receipt: Record<string, unknown> }>>)) {
      for (const response of Object.values(cases)) for (const id of computeReceiptIds(response.receipt)) named.add(id);
    }
    expect([...named].filter((id) => !ids.has(id))).toEqual([]);
    // And the other way: no receipt writes a value of these namespaces that the samples miss, so each of their ids must be
    // one a receipt names. The chart and houses endpoints answer with the engine's natal receipt, which names no endpoint.
    expect(Object.keys(examples.success).sort()).toEqual(['chart', 'elections', 'events', 'houses', 'positions', 'sky-fact', 'time']);
    const fromReceipts = new Set([...group('Coverage statements'), ...group('Compute API receipts'), 'ephemeris']);
    expect(entries.filter((entry) => fromReceipts.has(entry.namespace) && !named.has(entry.id)).map((entry) => entry.id)).toEqual([]);
    // The conditions the samples reach, so the check has bite.
    for (const id of ['flag:no-time', 'flag:polar-fallback', 'flag:outside-reference-span', 'flag:dst-gap', 'flag:dst-fold', 'flag:lmt', 'house-absence:unknown-time',
      'reference:utc-noon', 'time-scale:tt', 'time-scale:ut1', 'time-basis:iers', 'time-basis:delta-t', 'time-basis:pinned', 'deltat-segment:extrapolated',
      'endpoint:elections', 'void-of-course-bodies:modern', 'search-window:start-exclusive-end-inclusive', 'ephemeris:astronomy-engine@2.1.19']) {
      expect(named.has(id), id).toBe(true);
    }
  });

  it('holds exactly the kinds and arbiters of the conformance vectors, tied to their vector files', () => {
    const levelKinds = summary.levels.flatMap((level) => level.kinds.map((kind) => [kind.kind, level] as const));
    const levelArbiters = summary.levels.flatMap((level) => level.arbiters.map((arbiter) => [arbiter, level] as const));
    expect(values('kind')).toEqual(levelKinds.map(([kind]) => kind));
    expect(values('arbiter')).toEqual(levelArbiters.map(([arbiter]) => arbiter.id));
    for (const [kind, level] of levelKinds) {
      expect(entries.find((entry) => entry.id === `kind:${kind}`)!.sources[0].title).toContain(level.sha256);
    }
    for (const [arbiter, level] of levelArbiters) {
      const entry = entries.find((candidate) => candidate.id === `arbiter:${arbiter.id}`)!;
      expect(entry.title).toBe(arbiter.name);
      expect(entry.sources[0].title).toContain(level.sha256);
    }
  });

  it('is served as JSON with the address of each id on the registry page', async () => {
    const response = await (registryJson as unknown as () => Response)();
    const served = await response.json() as { base: string; namespaces: Array<{ entries: Array<{ id: string; uri: string }> }> };
    const uris = served.namespaces.flatMap((space) => space.entries);
    expect(uris.length).toBe(entries.length);
    for (const { id, uri } of uris) {
      expect(uri.startsWith(`${registry.base}#`), id).toBe(true);
      expect(decodeURI(uri.slice(registry.base.length + 1)), id).toBe(id);
      expect(uri, id).not.toMatch(/[\s[\]]/u);
    }
  });
});
