/**
 * The link a compatibility reading is saved to the profile as: both sides'
 * birth input by value in the fragment (`#a=…&b=…`, the compatibility
 * page's own link grammar), so it reopens on any device. A side known only
 * by positions (a received invitation) has no birth input to carry, so that
 * reading has no saved-page link.
 */
import { encodeChartLink, type ShareChartInput } from '../share';
import type { SavedPairSide } from './pairs';
import type { SavedChart } from './schema';
import type { SavedPageDraft } from './saved-pages-config';

export function comparisonSideInput(side: SavedPairSide, charts: readonly SavedChart[]): ShareChartInput | null {
  if (side.kind === 'input') return { ...side.input, name: side.label || side.input.name };
  if (side.kind !== 'chart') return null;
  const chart = charts.find((candidate) => candidate.id === side.chartId);
  const place = chart?.birth.place;
  if (!chart || !place) return null;
  const timeKnown = chart.birth.timeKnown && chart.birth.time !== null;
  return {
    date: chart.birth.date,
    time: timeKnown ? chart.birth.time : null,
    timeKnown,
    lat: place.lat,
    lon: place.lon,
    tz: place.tz,
    name: side.label || undefined,
    place: place.name,
    houseSystem: chart.summary.houseSystem,
  };
}

export function comparisonSavedPage(
  a: SavedPairSide,
  b: SavedPairSide,
  charts: readonly SavedChart[],
): SavedPageDraft | null {
  const inputA = comparisonSideInput(a, charts);
  const inputB = comparisonSideInput(b, charts);
  if (!inputA || !inputB) return null;
  const fragment = new URLSearchParams({ a: encodeChartLink(inputA), b: encodeChartLink(inputB) });
  const names = [a.label.trim() || 'Person A', b.label.trim() || 'Person B'];
  return {
    kind: 'compatibility',
    title: `${names[0]} and ${names[1]} · compatibility`,
    href: `/compatibility/#${fragment.toString()}`,
  };
}
