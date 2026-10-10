import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Profile, SavedChart } from './schema';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const PROFILE_DIRECTORY = resolve(ROOT, 'src/lib/profile');
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?|astro)$/u;
const TEST_SOURCE = /(?:^|\/)(?:__tests__|fixtures)(?:\/|$)|\.(?:test|spec)\.[^/]+$|\.d\.ts$/u;

function savedRecordModule(path: string): boolean {
  return dirname(path) === PROFILE_DIRECTORY && /\/saved-record(?:[.-]|$)/u.test(path);
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE_EXTENSION.test(path) && !TEST_SOURCE.test(path) ? [path] : [];
  }));
  return nested.flat();
}

/** Parse executable Astro regions rather than treating template text as imports. */
function scriptRegions(path: string, source: string): string[] {
  if (extname(path) !== '.astro') return [source];
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1];
  return [frontmatter ?? '', ...Array.from(source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gu), (match) => match[1])];
}

function moduleSpecifiers(source: string): string[] {
  // The visitor follows children only; omit unused parent links for the full-tree scan.
  const file = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const imports: string[] = [];
  const visit = (node: ts.Node) => {
    let argument: ts.Node | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) argument = node.moduleSpecifier;
    if (ts.isCallExpression(node)
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) argument = node.arguments[0];
    if (argument && ts.isStringLiteralLike(argument)) imports.push(argument.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return imports;
}

async function runtimeImportGraph(): Promise<Map<string, string[]>> {
  const files = (await Promise.all(['src', 'api'].map((path) => sourceFiles(resolve(ROOT, path))))).flat();
  const known = new Set(files);
  return new Map(await Promise.all(files.map(async (path) => {
    const source = await readFile(path, 'utf8');
    const edges = scriptRegions(path, source).flatMap(moduleSpecifiers).flatMap((specifier) => {
      const base = specifier.startsWith('.') ? resolve(dirname(path), specifier)
        : specifier.startsWith('~/') ? resolve(ROOT, 'src', specifier.slice(2)) : null;
      if (!base) return [];
      const extensionless = base.replace(/\.[cm]?jsx?$/u, '');
      const candidate = [base, ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.astro'].flatMap((extension) => [
        `${extensionless}${extension}`, resolve(base, `index${extension}`),
      ])].find((candidate) => known.has(candidate));
      return candidate ? [candidate] : [];
    });
    return [path, edges] as const;
  })));
}

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function legacyChart(): SavedChart {
  return {
    id: '10000000-0000-4000-8000-000000000001', name: 'Existing local chart',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    birth: { date: '1990-01-01', time: '12:00', timeKnown: true,
      place: { name: 'Synthetic place', admin1: '', country: '', lat: 10, lon: 20, tz: 'UTC' } },
    summary: { engineVersion: 'legacy-fixture', utcISO: '1990-01-01T12:00:00.000Z',
      houseSystem: 'whole', bodies: [{ body: 'Sun', lon: 280, retrograde: false }],
      angles: { asc: 12, mc: 102 }, flags: [] },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

/**
 * The only production entry points into the record lifecycle. The coordinator
 * islands reach it through the flag module and a dynamic import; nothing else
 * (pages, hooks, legacy stores, other islands) may import any saved-record module.
 */
const ALLOWED_INBOUND = new Set([
  'src/islands/AccountProfileAccessBootstrap.tsx -> src/lib/profile/saved-record-access.ts',
  'src/islands/AccountProfileAccessBootstrap.tsx -> src/lib/profile/saved-record-flags.ts',
  'src/islands/AccountSyncV2Panel.tsx -> src/lib/profile/saved-record-access.ts',
  'src/islands/AccountSyncV2Panel.tsx -> src/lib/profile/saved-record-flags.ts',
  'src/islands/ChartCalculator.tsx -> src/lib/profile/saved-record-access.ts',
  'src/islands/ChartCalculator.tsx -> src/lib/profile/saved-record-flags.ts',
  'src/islands/SavedRecordsPanel.tsx -> src/lib/profile/saved-record-access.ts',
  'src/islands/SavedRecordsPanel.tsx -> src/lib/profile/saved-record-flags.ts',
  'src/islands/SavedRecordsPanel.tsx -> src/lib/profile/saved-record.ts',
  'src/pages/profile/index.astro -> src/lib/profile/saved-record-flags.ts',
  'src/pages/es/profile/index.astro -> src/lib/profile/saved-record-flags.ts',
  'src/pages/pt/profile/index.astro -> src/lib/profile/saved-record-flags.ts',
  'src/pages/fr/profile/index.astro -> src/lib/profile/saved-record-flags.ts',
  'src/pages/it/profile/index.astro -> src/lib/profile/saved-record-flags.ts',
  'src/pages/ru/profile/index.astro -> src/lib/profile/saved-record-flags.ts',
]);

describe('inactive saved receipt integration boundary', () => {
  it('has only the coordinator as runtime caller and no dependency path into legacy profile writers or another private database', async () => {
    const graph = await runtimeImportGraph();
    const savedModules = [...graph.keys()].filter(savedRecordModule);
    expect(savedModules.length).toBeGreaterThan(0);
    const inbound = [...graph].flatMap(([caller, dependencies]) => savedRecordModule(caller) ? []
      : dependencies.filter(savedRecordModule).map((dependency) => `${relative(ROOT, caller)} -> ${relative(ROOT, dependency)}`));
    expect(inbound.filter((edge) => !ALLOWED_INBOUND.has(edge))).toEqual([]);
    // No caller imports the store directly; the inventory reads only the record type.
    expect(inbound.filter((edge) => /saved-record-store\.ts$/u.test(edge))).toEqual([]);

    const visited = new Set<string>();
    const visit = (path: string) => {
      if (visited.has(path)) return;
      visited.add(path);
      for (const dependency of graph.get(path) ?? []) visit(dependency);
    };
    savedModules.forEach(visit);
    const legacy = new Set(['schema', 'store', 'read-store', 'merge', 'sync', 'deletions', 'pairs']
      .map((name) => resolve(PROFILE_DIRECTORY, `${name}.ts`)));
    expect([...visited].filter((path) => legacy.has(path)
      || path.startsWith(resolve(ROOT, 'src/lib/living-chart') + '/')
      || path.startsWith(resolve(ROOT, 'src/lib/supabase') + '/')).map((path) => relative(ROOT, path))).toEqual([]);
  });

  it('imports without storage discovery, writes, auth subscription or network activity', async () => {
    const forbidden = vi.fn(() => { throw new Error('Unexpected activation.'); });
    const unavailable = new Proxy({}, { get: forbidden });
    vi.stubGlobal('localStorage', unavailable);
    vi.stubGlobal('sessionStorage', unavailable);
    vi.stubGlobal('indexedDB', unavailable);
    vi.stubGlobal('window', unavailable);
    vi.stubGlobal('fetch', forbidden);
    vi.resetModules();
    await import('./saved-record-store');
    await import('./saved-record');
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('leaves legacy reads byte-identical and existing explicit saves in their original stores', async () => {
    const storage = new MemoryStorage();
    const open = vi.fn(() => { throw new Error('Receipt persistence was not requested.'); });
    const network = vi.fn(() => { throw new Error('Sync was not requested.'); });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('indexedDB', { open });
    vi.stubGlobal('fetch', network);
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('PUBLIC_ACCOUNT_SYNC_V2_ENABLED', '');
    vi.stubEnv('PUBLIC_ACCOUNT_SYNC_V2_PREVIEW_ACK', '');
    const { PROFILE_KEY } = await import('./schema');
    const { PROFILE_DELETIONS_KEY } = await import('./deletions');
    const chart = legacyChart();
    const profile: Profile = { version: 1, settings: { houseSystem: 'whole' }, charts: [chart] };
    const original = JSON.stringify(profile);
    storage.setItem(PROFILE_KEY, original);
    storage.setItem('unrelated', 'preserve');
    await import('./saved-record-store');
    const { loadProfile, saveChart } = await import('./store');
    expect(loadProfile()).toEqual(profile);
    expect(storage.getItem(PROFILE_KEY)).toBe(original);
    expect([...storage.values.keys()].sort()).toEqual([PROFILE_KEY, 'unrelated'].sort());

    expect(saveChart({ ...chart, id: '20000000-0000-4000-8000-000000000002', name: 'Recalculation' })).toBe('updated');
    expect(loadProfile().charts).toHaveLength(1);
    expect(loadProfile().charts[0]).toMatchObject({ id: chart.id, name: chart.name, createdAt: chart.createdAt });
    expect([...storage.values.keys()].sort()).toEqual([PROFILE_KEY, PROFILE_DELETIONS_KEY, 'unrelated'].sort());
    expect(storage.getItem('unrelated')).toBe('preserve');
    expect(open).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });

  it('does not migrate a legacy summary or admit an SDK receipt through legacy sync merge', async () => {
    const { createSavedNatalRecord, parseSavedNatalRecord } = await import('./saved-record');
    const { computePortableChart } = await import('../engine/portable');
    const { mergeSyncState } = await import('./merge');
    const chart = legacyChart();
    const owner = `guest:${chart.id}`;
    const calculation = computePortableChart({ utc: '2001-12-21T08:30:00-00:00', latitude: 78.2232,
      longitude: 15.6267, houseSystem: 'placidus', timeKnown: false },
    { sourceInstant: '2001-12-21T08:30:00-00:00' });
    const record = createSavedNatalRecord(owner, '30000000-0000-4000-8000-000000000003',
      '2026-09-14T00:00:00.000Z', calculation.envelope)!;
    expect(record).not.toBeNull();
    const frozenReceipt = record.envelopeJson;
    expect(parseSavedNatalRecord(chart, owner)).toEqual({ ok: false, code: 'corrupt-record' });
    const merged = mergeSyncState({
      localProfile: { version: 1, settings: { houseSystem: 'whole' }, charts: [chart] },
      remoteSettings: null, localDeletions: [], remoteDeletions: [],
      remoteCharts: [{ id: record.id, payload: record, updatedAt: record.createdAt }],
    });
    expect(merged.profile.charts).toEqual([chart]);
    expect(record.envelopeJson).toBe(frozenReceipt);
    expect(Object.isFrozen(record)).toBe(true);
  });
});
