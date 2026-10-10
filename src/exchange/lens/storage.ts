import { INSTRUMENTS, CATALOG_VERSION } from './catalog';
import type { EventFamily, JournalEntry, JournalRevision, PlanReview, SetupPlan, TimingRole, WatchRule } from './types';
import { estimateRisk } from './risk';

export const LENS_DATABASE_NAME = 'zodiacs-market-lens-v1';
export const LENS_DATABASE_VERSION = 1;
const STORE_NAME = 'private-workspace';
const SNAPSHOT_KEY = 'market-lens:snapshot:v1';
export const MAX_IMPORT_BYTES = 2_000_000;
const TEXT_LIMIT = 5_000;
const FAMILIES: EventFamily[] = ['lunation', 'eclipse', 'station', 'retrograde', 'ingress', 'aspect'];
const CONDITIONS = ['sma-cross-up', 'sma-cross-down', 'price-cross-up', 'price-cross-down', 'rsi-cross-up', 'rsi-cross-down'];
/** Reviews of these statuses describe a trade that was taken. */
export const TAKEN_REVIEW_STATUSES = ['target', 'stop', 'time-exit', 'manual-exit'];
const TIMING_ROLES: TimingRole[] = ['none', 'larger', 'smaller', 'initiated', 'veto'];

export interface LensStore {
  schema: 1 | 2 | 3;
  catalogVersion?: string;
  rules: WatchRule[];
  entries: JournalEntry[];
  seenMatches: string[];
}

export interface LensStorageBackend {
  read(): Promise<unknown | undefined>;
  write(snapshot: LensStore): Promise<void>;
  /** Must compare and write in one atomic transaction, never separate operations. */
  compareAndWrite?(expected: LensStore, snapshot: LensStore): Promise<void>;
}

export class LensStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LensStorageError';
  }
}

export class LensConflictError extends LensStorageError {
  constructor() {
    super('Zodiacs Desk was changed in another tab. These changes were not saved. Reload the latest saved data and retry; keep your unsaved draft.');
    this.name = 'LensConflictError';
  }
}

export function emptyStore(): LensStore {
  return { schema: 3, catalogVersion: CATALOG_VERSION, rules: [], entries: [], seenMatches: [] };
}

/** Opens only the separate Zodiacs Desk (formerly Market Lens) database. Never reads natal/account stores. */
export function createIndexedDBBackend(factory?: IDBFactory): LensStorageBackend {
  async function open(): Promise<IDBDatabase> {
    let indexedDBFactory: IDBFactory | undefined;
    try { indexedDBFactory = factory ?? globalThis.indexedDB; }
    catch (cause) { throw new LensStorageError('Private storage is blocked by this browser. Export unsaved notes.', { cause }); }
    if (!indexedDBFactory) throw new LensStorageError('Private storage is unavailable in this browser. Export your notes before leaving.');
    return new Promise((resolve, reject) => {
      let settled = false;
      let request: IDBOpenDBRequest;
      const fail = (cause?: unknown) => {
        if (settled) return;
        settled = true;
        reject(new LensStorageError('Zodiacs Desk could not open private storage. Check browser storage permissions.', { cause }));
      };
      try { request = indexedDBFactory.open(LENS_DATABASE_NAME, LENS_DATABASE_VERSION); }
      catch (cause) { fail(cause); return; }
      request.onupgradeneeded = () => {
        try {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
        } catch (cause) { request.transaction?.abort(); fail(cause); }
      };
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error('Another tab is blocking the private database version.'));
      request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        settled = true;
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
    });
  }

  async function transact(mode: IDBTransactionMode, value?: LensStore, expected?: LensStore): Promise<unknown | undefined> {
    const database = await open();
    try {
      return await new Promise((resolve, reject) => {
        let result: unknown;
        let transaction: IDBTransaction;
        let failure: Error | undefined;
        try {
          transaction = database.transaction(STORE_NAME, mode);
          const store = transaction.objectStore(STORE_NAME);
          // Resolve on committed transaction, not request success. Quota failures
          // can abort after a put request has already succeeded.
          transaction.oncomplete = () => resolve(mode === 'readonly' ? result : undefined);
          transaction.onabort = () => reject(failure ?? new LensStorageError(mode === 'readonly'
            ? 'Zodiacs Desk could not read private storage. Saved data has been left unchanged.'
            : 'Private storage did not save. Your previous saved data remains available; export unsaved notes.', { cause: transaction.error }));
          transaction.onerror = () => { /* onabort reports the final transaction failure */ };
          const abort = (error: Error) => {
            failure = error;
            try { transaction.abort(); }
            catch { reject(error); }
          };
          if (expected !== undefined) {
            // IndexedDB serializes overlapping readwrite transactions. Reading
            // and comparing here, before put in the same transaction, prevents
            // another tab from committing between comparison and replacement.
            const request = store.get(SNAPSHOT_KEY);
            request.onsuccess = () => {
              let current: LensStore;
              try { current = request.result === undefined ? emptyStore() : validateStore(request.result); }
              catch (cause) {
                abort(new LensStorageError('Saved Zodiacs Desk data could not be validated. It was left unchanged.', { cause }));
                return;
              }
              if (JSON.stringify(current) !== JSON.stringify(expected)) { abort(new LensConflictError()); return; }
              try { store.put(value, SNAPSHOT_KEY); }
              catch (cause) { abort(new LensStorageError('Private storage did not save. Export unsaved notes.', { cause })); }
            };
          } else {
            const request = mode === 'readonly' ? store.get(SNAPSHOT_KEY) : store.put(value, SNAPSHOT_KEY);
            request.onsuccess = () => { result = request.result; };
          }
        } catch (cause) {
          reject(new LensStorageError('Zodiacs Desk could not access private storage. Export unsaved notes.', { cause }));
        }
      });
    } finally { database.close(); }
  }
  return {
    read: () => transact('readonly'),
    write: async snapshot => { await transact('readwrite', snapshot); },
    compareAndWrite: async (expected, snapshot) => { await transact('readwrite', snapshot, expected); },
  };
}

export async function readStore(backend: LensStorageBackend = createIndexedDBBackend()): Promise<LensStore> {
  const snapshot = await backend.read();
  if (snapshot === undefined) return emptyStore();
  try {
    const validated = validateStore(snapshot);
    enforceSize(JSON.stringify(validated));
    return validated;
  }
  catch (cause) { throw new LensStorageError('Saved Zodiacs Desk data could not be validated. The saved data has been left unchanged.', { cause }); }
}

export async function saveStore(store: LensStore, backend: LensStorageBackend = createIndexedDBBackend()): Promise<void> {
  const validated = validateStore(store);
  // Ensure every accepted save can also be exported within the backup limit.
  exportStore(validated);
  await backend.write(validated);
}

/** Replace a snapshot only if it is still the exact state the caller loaded. */
export async function compareAndSaveStore(
  expected: LensStore,
  next: LensStore,
  backend: LensStorageBackend = createIndexedDBBackend(),
): Promise<void> {
  const before = validateStore(expected);
  const after = validateStore(next);
  exportStore(after);
  if (!backend.compareAndWrite) throw new LensStorageError('This private-storage backend cannot save atomically. No changes were saved.');
  await backend.compareAndWrite(before, after);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('zodiacs:lens-workspace'));
    try { const channel = new BroadcastChannel('zodiacs:lens-workspace'); channel.postMessage('changed'); channel.close(); } catch { /* CAS still protects writes. */ }
  }
}

export function exportStore(store: LensStore, exportedAt = new Date().toISOString()): string {
  const result = JSON.stringify({ ...validateStore(store), exportedAt: timestamp(exportedAt, 'Export time') }, null, 2);
  enforceSize(result);
  return result;
}

export interface ImportConflict {
  kind: 'rule' | 'entry';
  originalId: string;
  importedId: string;
  message: string;
}

export interface ImportResult {
  store: LensStore;
  importedRules: number;
  importedEntries: number;
  conflicts: ImportConflict[];
}

/** A pure merge: the caller saves only after presenting any import conflicts. */
export function importStore(payload: string, current: LensStore = emptyStore()): ImportResult {
  enforceSize(payload);
  let parsed: unknown;
  try { parsed = JSON.parse(payload); }
  catch { throw new Error('Import must contain valid Zodiacs Desk (or Market Lens) JSON.'); }
  const incoming = validateStore(parsed);
  const store = validateStore(current);
  const conflicts: ImportConflict[] = [];
  const merge = <T extends { id: string }>(target: T[], additions: T[], kind: 'rule' | 'entry'): number => {
    let count = 0;
    for (const item of additions) {
      const existing = target.find(candidate => candidate.id === item.id);
      if (!existing) { target.push(item); count += 1; continue; }
      if (JSON.stringify(existing) === JSON.stringify(item)) continue;
      const base = `${item.id.slice(0, 88)}:import`;
      let suffix = 1;
      let importedId = `${base}:${suffix}`;
      while (target.some(candidate => candidate.id === importedId)) {
        const alreadyImported = target.find(candidate => candidate.id === importedId)!;
        if (JSON.stringify({ ...alreadyImported, id: item.id }) === JSON.stringify(item)) { importedId = ''; break; }
        suffix += 1;
        importedId = `${base}:${suffix}`;
      }
      if (!importedId) continue;
      target.push({ ...item, id: importedId });
      count += 1;
      conflicts.push({ kind, originalId: item.id, importedId, message: 'The same ID has different contents. Both records were preserved; the imported copy received a new ID.' });
    }
    return count;
  };
  const importedRules = merge(store.rules, incoming.rules, 'rule');
  const importedEntries = merge(store.entries, incoming.entries, 'entry');
  // Preserve reminder history for faithful backup restoration. Renamed rules
  // have new keys, so an imported conflicting rule cannot reuse an old match.
  store.seenMatches = [...new Set([...store.seenMatches, ...incoming.seenMatches])];
  const validated = validateStore(store);
  exportStore(validated);
  return { store: validated, importedRules, importedEntries, conflicts };
}

type JournalInput = Pick<JournalEntry, 'instrument' | 'eventIds' | 'horizonHours' | 'method' | 'hypothesis' | 'plan' | 'outcome' | 'setup' | 'chartRef' | 'timingRole'>;
type JournalPatch = Partial<Pick<JournalEntry, 'hypothesis' | 'plan' | 'outcome' | 'setup' | 'review'>>;

export function createJournalEntry(input: JournalInput, options: { at?: string; id?: string } = {}): JournalEntry {
  const at = timestamp(options.at ?? new Date().toISOString(), 'Journal time');
  const id = options.id ?? globalThis.crypto.randomUUID();
  return validateEntry({ ...input, id, createdAt: at, updatedAt: at, revisions: [revision(at, input)] });
}

export function updateJournalEntry(entry: JournalEntry, patch: JournalPatch, options: { at?: string } = {}): JournalEntry {
  const original = validateEntry(entry);
  if (!isRecord(patch) || Object.keys(patch).some(key => !['hypothesis', 'plan', 'outcome', 'setup', 'review'].includes(key))) throw new Error('Only journal text, setup and review can be revised; the original instrument, methodology and timing answer remain fixed.');
  const edited = { ...original, ...patch };
  const latest = original.revisions.at(-1)!;
  if (edited.hypothesis === latest.hypothesis && edited.plan === latest.plan && edited.outcome === latest.outcome && JSON.stringify(edited.setup) === JSON.stringify(latest.setup) && JSON.stringify(edited.review) === JSON.stringify(latest.review)) return original;
  const at = timestamp(options.at ?? new Date(Math.max(Date.now(), Date.parse(original.updatedAt) + 1)).toISOString(), 'Revision time');
  if (Date.parse(at) <= Date.parse(original.updatedAt)) throw new Error('Revision time must follow the previous saved revision.');
  return validateEntry({ ...edited, updatedAt: at, revisions: [...original.revisions, revision(at, edited)] });
}

function revision(at: string, contents: Pick<JournalEntry, 'hypothesis' | 'plan' | 'outcome' | 'setup' | 'review'>): JournalRevision {
  return { at, hypothesis: contents.hypothesis, plan: contents.plan, outcome: contents.outcome, ...(contents.setup ? { setup: contents.setup } : {}), ...(contents.review ? { review: contents.review } : {}) };
}

export function validateStore(value: unknown): LensStore {
  const obj = record(value, 'Workspace');
  keys(obj, ['schema', 'catalogVersion', 'rules', 'entries', 'seenMatches', 'exportedAt'], 'Workspace');
  // Schema 3 adds plan reviews, the fixed timing answer and planned entry times.
  // Schemas 1 and 2 still import unchanged and are rewritten only by an atomic save.
  if (obj.schema !== 1 && obj.schema !== 2 && obj.schema !== 3) throw new Error('This Zodiacs Desk schema version is not supported.');
  if (obj.exportedAt !== undefined) timestamp(obj.exportedAt, 'Export time');
  const rules = array(obj.rules, 200, 'Rules').map(validateRule);
  const entries = array(obj.entries, 500, 'Journal entries').map(validateEntry);
  for (const entry of entries) for (const setup of [entry.setup, ...entry.revisions.map(r => r.setup)]) {
    if (setup?.risk.instrumentId && setup.risk.instrumentId !== entry.instrument) throw new Error('Risk instrument does not match its journal entry.');
    if (setup && !['BTC-USD', 'ETH-USD'].includes(entry.instrument) && !setup.risk.instrumentId) throw new Error('Cross-asset risk requires explicit instrument and currency.');
  }
  const seenMatches = array(obj.seenMatches, 10_000, 'Reminder history').map(value => text(value, 512, 'Reminder key'));
  unique(rules.map(rule => rule.id), 'Rule IDs');
  unique(entries.map(entry => entry.id), 'Journal IDs');
  unique(seenMatches, 'Reminder keys');
  // Legacy v1 BTC/ETH IDs and every authored revision are retained exactly.
  // The same IndexedDB key is upgraded on the next atomic save, never by a blind write.
  if (obj.schema === 1 && [...rules, ...entries].some(row => !['BTC-USD', 'ETH-USD'].includes(row.instrument))) throw new Error('Legacy v1 only supports BTC/ETH records.');
  if (obj.schema !== 1 && obj.catalogVersion !== CATALOG_VERSION) throw new Error('Unsupported instrument catalog version; preserve this export.');
  if (obj.schema !== 3 && entries.some(entry => entry.timingRole || entry.revisions.some(rev => rev.review || rev.setup?.entryAt))) throw new Error('Timing answers, reviews and planned entries need workspace schema 3.');
  return { schema: 3, catalogVersion: CATALOG_VERSION, rules, entries, seenMatches };
}

function validateRule(value: unknown): WatchRule {
  const obj = record(value, 'Rule');
  keys(obj, ['id', 'version', 'instrument', 'interval', 'condition', 'threshold', 'family', 'windowHours', 'enabled', 'createdAt'], 'Rule');
  const condition = oneOf(obj.condition, CONDITIONS, 'Rule condition') as WatchRule['condition'];
  const rule: WatchRule = {
    id: identifier(obj.id, 'Rule ID'), version: integer(obj.version, 1, 1_000_000, 'Rule version'),
    instrument: oneOf(obj.instrument, Object.keys(INSTRUMENTS), 'Instrument') as WatchRule['instrument'],
    interval: oneOf(obj.interval, ['1h', '1d'], 'Interval') as WatchRule['interval'],
    condition, family: oneOf(obj.family, [...FAMILIES, 'any'], 'Event family') as WatchRule['family'],
    windowHours: finite(obj.windowHours, 0, 720, 'Research window'),
    enabled: boolean(obj.enabled, 'Rule enabled'), createdAt: timestamp(obj.createdAt, 'Rule creation time'),
  };
  if (condition.startsWith('price-')) rule.threshold = finite(obj.threshold, Number.MIN_VALUE, 1_000_000_000, 'Price threshold');
  else if (condition.startsWith('rsi-')) rule.threshold = finite(obj.threshold, 0, 100, 'RSI threshold');
  else if (obj.threshold !== undefined) throw new Error('SMA crossover rules do not take a threshold.');
  return rule;
}

function validateEntry(value: unknown): JournalEntry {
  const obj = record(value, 'Journal entry');
  keys(obj, ['id', 'instrument', 'createdAt', 'updatedAt', 'eventIds', 'horizonHours', 'method', 'hypothesis', 'plan', 'outcome', 'revisions', 'setup', 'chartRef', 'timingRole', 'review'], 'Journal entry');
  const createdAt = timestamp(obj.createdAt, 'Journal creation time');
  const updatedAt = timestamp(obj.updatedAt, 'Journal update time');
  const revisions = array(obj.revisions, 100, 'Journal revisions').map(value => {
    const rev = record(value, 'Revision');
    keys(rev, ['at', 'hypothesis', 'plan', 'outcome', 'setup', 'review'], 'Revision');
    return { at: timestamp(rev.at, 'Revision time'), hypothesis: text(rev.hypothesis, TEXT_LIMIT, 'Hypothesis'), plan: text(rev.plan, TEXT_LIMIT, 'Plan'), outcome: text(rev.outcome, TEXT_LIMIT, 'Outcome'), ...(rev.setup === undefined ? {} : { setup: validateSetup(rev.setup) }), ...(rev.review === undefined ? {} : { review: validateReview(rev.review) }) };
  });
  if (revisions.length === 0 || revisions[0].at !== createdAt || revisions.at(-1)!.at !== updatedAt) throw new Error('Journal revisions must preserve the original creation and latest update timestamps.');
  if (revisions.some((rev, i) => i > 0 && Date.parse(rev.at) <= Date.parse(revisions[i - 1].at))) throw new Error('Journal revisions must be ordered with strictly increasing timestamps.');
  const hypothesis = text(obj.hypothesis, TEXT_LIMIT, 'Hypothesis');
  const plan = text(obj.plan, TEXT_LIMIT, 'Plan');
  const outcome = text(obj.outcome, TEXT_LIMIT, 'Outcome');
  const latest = revisions.at(-1)!;
  const setup = obj.setup === undefined ? undefined : validateSetup(obj.setup);
  if (JSON.stringify(setup) !== JSON.stringify(latest.setup)) throw new Error('The latest setup must match its latest revision.');
  const review = obj.review === undefined ? undefined : validateReview(obj.review);
  if (JSON.stringify(review) !== JSON.stringify(latest.review)) throw new Error('The latest review must match its latest revision.');
  if (latest.hypothesis !== hypothesis || latest.plan !== plan || latest.outcome !== outcome) throw new Error('The latest journal text must match its latest revision.');
  const eventIds = array(obj.eventIds, 50, 'Linked event IDs').map(value => identifier(value, 'Event ID'));
  unique(eventIds, 'Linked event IDs');
  const method = oneOf(obj.method, ['TA only', 'TA + astrology'], 'Journal method') as JournalEntry['method'];
  if (obj.timingRole !== undefined && method !== 'TA + astrology') throw new Error('Only TA + astrology plans record what the timing changed.');
  return {
    id: identifier(obj.id, 'Journal ID'),
    instrument: oneOf(obj.instrument, Object.keys(INSTRUMENTS), 'Instrument') as JournalEntry['instrument'],
    createdAt, updatedAt, eventIds, horizonHours: finite(obj.horizonHours, 0, 8_760, 'Journal horizon'),
    method, hypothesis, plan, outcome, revisions, ...(obj.chartRef === undefined ? {} : { chartRef: validateChartRef(obj.chartRef) }), ...(setup ? { setup } : {}),
    ...(obj.timingRole === undefined ? {} : { timingRole: oneOf(obj.timingRole, TIMING_ROLES, 'Timing answer') as TimingRole }), ...(review ? { review } : {}),
  };
}

/** Keys are emitted in one fixed order so an unchanged review never adds a revision. */
function validateReview(value: unknown): PlanReview {
  const obj = record(value, 'Review');
  keys(obj, ['status', 'exit', 'r', 'followedPlan'], 'Review');
  const status = oneOf(obj.status, ['not-triggered', 'skipped', ...TAKEN_REVIEW_STATUSES], 'Review status') as PlanReview['status'];
  const taken = TAKEN_REVIEW_STATUSES.includes(status);
  if (status === 'not-triggered' && (obj.exit !== undefined || obj.r !== undefined)) throw new Error('A plan whose confirmation never came has no exit or R result.');
  if (!taken && obj.followedPlan !== undefined) throw new Error('Only a taken trade records plan adherence.');
  if (obj.exit !== undefined && obj.r === undefined) throw new Error('A review with an exit price also records its R result.');
  return { status, ...(obj.exit === undefined ? {} : { exit: finite(obj.exit, Number.MIN_VALUE, 1e12, 'Exit price') }), ...(obj.r === undefined ? {} : { r: finite(obj.r, -100, 100, 'R multiple') }), ...(obj.followedPlan === undefined ? {} : { followedPlan: boolean(obj.followedPlan, 'Plan adherence') }) };
}

function validateSetup(value: unknown): SetupPlan {
  const obj = record(value, 'Setup');
  keys(obj, ['interval', 'technicalSetup', 'confirmation', 'invalidation', 'risk', 'entryAt', 'window'], 'Setup');
  const raw = record(obj.risk, 'Risk');
  keys(raw, ['equity', 'riskMode', 'riskValue', 'entry', 'stop', 'target', 'feeBps', 'slippageBps', 'instrumentId', 'currency', 'funding', 'marginPerContract'], 'Risk');
  const risk: SetupPlan['risk'] = { equity: finite(raw.equity, Number.MIN_VALUE, 1e12, 'Equity'), riskMode: oneOf(raw.riskMode, ['percent', 'usd', 'quote'], 'Risk mode') as SetupPlan['risk']['riskMode'], riskValue: finite(raw.riskValue, Number.MIN_VALUE, 1e12, 'Risk value'), entry: finite(raw.entry, Number.MIN_VALUE, 1e12, 'Entry'), stop: finite(raw.stop, Number.MIN_VALUE, 1e12, 'Stop'), feeBps: finite(raw.feeBps, 0, 1000, 'Fees'), slippageBps: finite(raw.slippageBps, 0, 1000, 'Slippage'), ...(raw.target === undefined ? {} : { target: finite(raw.target, Number.MIN_VALUE, 1e12, 'Target') }) };
  if (raw.instrumentId !== undefined) {
    risk.instrumentId = oneOf(raw.instrumentId, Object.keys(INSTRUMENTS), 'Risk instrument');
    risk.currency = oneOf(raw.currency, [INSTRUMENTS[risk.instrumentId].quote], 'Risk currency');
    risk.funding = oneOf(raw.funding, ['cash'], 'Funding') as 'cash';
  } else if (raw.currency !== undefined || raw.funding !== undefined || raw.marginPerContract !== undefined) throw new Error('Risk metadata needs an instrument.');
  if (raw.marginPerContract !== undefined) throw new Error('Derivative journal plans require verified contract metadata; unsupported in this catalog version.');
  estimateRisk(risk);
  const setup: SetupPlan = { interval: oneOf(obj.interval, ['1h', '1d'], 'Timeframe') as SetupPlan['interval'], technicalSetup: text(obj.technicalSetup, TEXT_LIMIT, 'Technical setup'), confirmation: text(obj.confirmation, TEXT_LIMIT, 'Confirmation'), invalidation: text(obj.invalidation, TEXT_LIMIT, 'Invalidation'), risk, ...(obj.entryAt === undefined ? {} : { entryAt: timestamp(obj.entryAt, 'Planned entry') }) };
  if (obj.window !== undefined) {
    const window = record(obj.window, 'Setup window'); keys(window, ['kind', 'id', 'sourceId', 'sourceUpdatedAt', 'from', 'to'], 'Setup window');
    const kind = oneOf(window.kind, ['shared', 'personal', 'economic'], 'Window kind') as NonNullable<SetupPlan['window']>['kind'];
    const from = timestamp(window.from, 'Window start'), to = timestamp(window.to, 'Window end');
    if (from > to) throw new Error('Window end must follow start.');
    if (kind === 'personal' && window.sourceId === undefined) throw new Error('Personal context requires its canonical source reference.');
    if (kind !== 'personal' && window.sourceId !== undefined) throw new Error('Public context cannot contain a chart reference.');
    setup.window = { kind, id: identifier(window.id, 'Window ID'), from, to, ...(window.sourceId === undefined ? {} : { sourceId: identifier(window.sourceId, 'Chart reference'), ...(window.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: timestamp(window.sourceUpdatedAt, 'Chart revision') }) }) };
  }
  return setup;
}

/** Remove derived personal context on edit/deletion/access changes; authored text stays. */
function validateChartRef(value: unknown): { id: string; updatedAt: string } {
  const obj = record(value, 'Chart reference'); keys(obj, ['id', 'updatedAt'], 'Chart reference');
  return { id: identifier(obj.id, 'Chart ID'), updatedAt: timestamp(obj.updatedAt, 'Chart revision') };
}
export function clearPersonalContext(store: LensStore, validSourceId: string | null, updatedAt?: string): LensStore {
  const valid = (id?: string, revision?: string) => Boolean(validSourceId && id === validSourceId && (updatedAt === undefined || revision === updatedAt));
  const scrub = (setup?: SetupPlan) => setup?.window?.kind === 'personal' && !valid(setup.window.sourceId, setup.window.sourceUpdatedAt) ? { ...setup, window: undefined } : setup;
  return { ...store, entries: store.entries.map(entry => {
    const admitted = valid(entry.chartRef?.id, entry.chartRef?.updatedAt) || valid(entry.setup?.window?.sourceId, entry.setup?.window?.sourceUpdatedAt);
    return { ...entry, ...(entry.chartRef && !admitted ? { chartRef: undefined } : {}), eventIds: entry.eventIds.filter(id => !id.startsWith('personal:') || admitted), ...(entry.setup ? { setup: scrub(entry.setup) } : {}), revisions: entry.revisions.map(rev => ({ ...rev, ...(rev.setup ? { setup: scrub(rev.setup) } : {}) })) };
  }) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}
function keys(value: Record<string, unknown>, allowed: string[], label: string): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`${label} contains unsupported fields.`);
}
function array(value: unknown, limit: number, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error(`${label} must be an array of at most ${limit} items.`);
  return value;
}
function text(value: unknown, limit: number, label: string): string {
  if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`${label} must be text of at most ${limit} characters without control characters.`);
  return value;
}
function identifier(value: unknown, label: string): string {
  const id = text(value, 128, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) throw new Error(`${label} contains unsupported characters.`);
  return id;
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) throw new Error(`${label} must be a UTC ISO timestamp.`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`${label} is invalid.`);
  const canonical = new Date(milliseconds).toISOString();
  if (canonical.slice(0, 19) !== value.slice(0, 19)) throw new Error(`${label} is not a real calendar instant.`);
  return canonical;
}
function integer(value: unknown, min: number, max: number, label: string): number {
  const result = finite(value, min, max, label);
  if (!Number.isSafeInteger(result)) throw new Error(`${label} must be an integer.`);
  return result;
}
function finite(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be a finite number between ${min} and ${max}.`);
  return value;
}
function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`);
  return value;
}
function oneOf(value: unknown, allowed: string[], label: string): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(`${label} is not supported.`);
  return value;
}
function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique.`);
}
function enforceSize(payload: string): void {
  if (typeof payload !== 'string' || new TextEncoder().encode(payload).byteLength > MAX_IMPORT_BYTES) throw new Error(`Zodiacs Desk data must be at most ${MAX_IMPORT_BYTES.toLocaleString('en-US')} bytes.`);
}
