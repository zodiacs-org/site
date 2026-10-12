/**
 * Writes back saved-chart summaries that an older reading of the birthplace
 * clock left behind. Until 2026-09 a birth up to 1970 took its offset from the
 * browser's zone history (Stockholm in July 1947 read Berlin's summer time, an
 * hour early) and, before standard time, from the mean time of the zone's
 * reference city. Each chart keeps its exact birth input, so
 * resolveSavedChart recomputes the summary from it; storing the result lets
 * every reader of the stored summary show it, including the emails through
 * sync. Callers import this lazily, never from the homepage.
 */
import { profileAccessAllowed } from '../account-v2/profile-access-reader';
import { loadEngine as loadSiteEngine } from '../hooks/useEngine';
import { birthplaceTimeCanApply } from '../time/localToUtc';
import type { SavedChart } from './schema';
import { resolveSavedChart, type SavedChartEngineLoader } from './resolve';
import { loadProfile, updateChartSummaries } from './store';

/**
 * Chart states already checked against the birthplace clock, as opaque
 * fingerprints: the key holds no chart id or birth data of its own. It is
 * named for the tzdb release the resolver reads before 1970 (the engine's
 * TZDB.version), so a new release checks every chart again.
 */
const CHECKED_KEY = 'zodiacs.profile.birthplace-checks-2025c.v1';

let running: Promise<number> | null = null;

/** FNV-1a over id, birth input and summary. */
function fingerprint(chart: SavedChart): string {
  const text = JSON.stringify([chart.id, chart.birth, chart.summary]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function loadChecked(): Set<string> {
  if (!profileAccessAllowed()) return new Set();
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CHECKED_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((key) => typeof key === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveChecked(checked: Set<string>): void {
  if (!profileAccessAllowed()) return;
  try {
    localStorage.setItem(CHECKED_KEY, JSON.stringify([...checked]));
  } catch {
    // A lost record costs one more check on a later run.
  }
}

/**
 * Rewrites the stored summary of each saved chart with a place and a birth
 * date up to 1970 whose recomputation differs, through updateChartSummaries,
 * so id, name, createdAt and updatedAt stay as they were. Later dates and
 * charts without a place are never considered and load nothing. A checked
 * chart state is remembered, so a second run loads neither the engine nor the
 * time tables; a recomputation that failed, such as a download while offline,
 * is tried again on the next run. Concurrent calls share one run. Resolves to
 * the number of summaries rewritten. The engine loader defaults to the one
 * every island shares.
 */
export function refreshSavedChartSummaries(
  loadEngine: SavedChartEngineLoader = loadSiteEngine,
): Promise<number> {
  if (!running) running = refresh(loadEngine).finally(() => { running = null; });
  return running;
}

async function refresh(loadEngine: SavedChartEngineLoader): Promise<number> {
  const candidates = loadProfile().charts.filter((chart) => (
    chart?.birth?.place && birthplaceTimeCanApply(chart.birth.date)
  ));
  const checked = loadChecked();
  const unchecked = candidates.filter((chart) => !checked.has(fingerprint(chart)));
  if (unchecked.length === 0) return 0;

  const next = new Set(candidates.map(fingerprint).filter((key) => checked.has(key)));
  const changed: { chart: SavedChart; summary: SavedChart['summary'] }[] = [];
  for (const chart of unchecked) {
    let summary: SavedChart['summary'];
    try {
      ({ summary } = await resolveSavedChart(chart, loadEngine, { strict: true }));
    } catch {
      continue; // not remembered, so the next run tries again
    }
    if (JSON.stringify(summary) === JSON.stringify(chart.summary)) next.add(fingerprint(chart));
    else changed.push({ chart, summary });
  }
  const replaced = changed.length === 0 ? [] : updateChartSummaries(changed.map(({ chart, summary }) => ({
    id: chart.id,
    utcISO: chart.summary.utcISO,
    summary,
  })));
  for (const { chart, summary } of changed) {
    if (replaced.includes(chart.id)) next.add(fingerprint({ ...chart, summary }));
  }
  saveChecked(next);
  return replaced.length;
}
