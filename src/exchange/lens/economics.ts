import type { SkyEvent } from './types';
export interface EconomicEvent {
  id: string; kind: 'cpi' | 'employment' | 'fomc-decision' | 'fomc-press-conference'; title: string; date: string; time: string; at: string; timeZone: string; sourceUrl: string; sourceSha256: string; verifiedAt: string; status: 'scheduled' | 'rescheduled'; revisions: { at: string; verifiedAt: string }[];
}
export interface EconomicCatalog { schema: 1; verifiedAt: string; coverage: { start: string; endExclusive: string }; staleAfterDays: number; timeZone: string; events: EconomicEvent[]; unavailable: { provider: string; period: string; sourceUrl: string; reason: string }[]; limitations: string[] }
export function economicState(catalog: EconomicCatalog, date: string, now = Date.now()): 'covered' | 'stale' | 'unavailable' {
  if (date < catalog.coverage.start || date >= catalog.coverage.endExclusive || catalog.unavailable.some(row => date.startsWith(row.period))) return 'unavailable';
  return now - Date.parse(catalog.verifiedAt) > catalog.staleAfterDays * 86400000 ? 'stale' : 'covered';
}
export function economicAsEvent(event: EconomicEvent): SkyEvent {
  return { id: event.id, family: 'economic', subtype: event.kind, title: event.title, at: event.at, bodies: [event.kind.startsWith('fomc') ? 'Federal Reserve' : 'Bureau of Labor Statistics'], interpretation: '', provenance: { catalog: event.sourceUrl, sha256: event.sourceSha256, engineVersion: 'Official schedule; no astronomy calculation', convention: `${event.date} ${event.time} ${event.timeZone}; last verified ${event.verifiedAt}` }, economic: event };
}
export async function loadEconomics(signal?: AbortSignal): Promise<EconomicCatalog> {
  const response = await fetch('/data/market-lens/economics.json', { signal });
  if (!response.ok) throw new Error('Official economic schedule snapshot is unavailable.');
  const value: unknown = await response.json();
  const catalog = value as EconomicCatalog;
  const official = (url: unknown) => typeof url === 'string' && /^https:\/\/(?:www\.)?(?:federalreserve\.gov|bls\.gov)\//.test(url);
  const instant = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value));
  const civil = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
  if (catalog?.schema !== 1 || !Number.isFinite(Date.parse(catalog.verifiedAt)) || !catalog.coverage || !Array.isArray(catalog.events) || catalog.events.length > 100 || !Array.isArray(catalog.unavailable) || !Array.isArray(catalog.limitations) || catalog.staleAfterDays !== 7 || catalog.timeZone !== 'America/New_York' || catalog.events.some(row => !Number.isFinite(Date.parse(row.at)) || !official(row.sourceUrl) || !/^economic:/.test(row.id) || !Array.isArray(row.revisions))) throw new Error('Economic schedule snapshot failed validation.');
  if (new Set(catalog.events.map(row => row.id)).size !== catalog.events.length) throw new Error('Economic schedule contains duplicate events.');
  if (!civil(catalog.coverage.start) || !civil(catalog.coverage.endExclusive) || catalog.coverage.start >= catalog.coverage.endExclusive || catalog.events.some(row => !['cpi', 'employment', 'fomc-decision', 'fomc-press-conference'].includes(row.kind) || typeof row.title !== 'string' || !civil(row.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time) || !instant(row.at) || !instant(row.verifiedAt) || !/^[a-f0-9]{64}$/.test(row.sourceSha256) || !['scheduled', 'rescheduled'].includes(row.status) || row.timeZone !== 'America/New_York' || row.date < catalog.coverage.start || row.date >= catalog.coverage.endExclusive || row.revisions.some(revision => !instant(revision.at) || !instant(revision.verifiedAt)))) throw new Error('Economic dates, provenance or revisions failed validation.');
  return catalog;
}
