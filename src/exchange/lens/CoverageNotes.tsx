import type { EconomicCatalog } from './economics';
import { economicState } from './economics';
import type { EventManifest } from './types';

const RELEASES = [['cpi', 'US CPI'], ['employment', 'US employment'], ['fomc-decision', 'FOMC decisions'], ['fomc-press-conference', 'FOMC press conferences']];

type Props =
  | { part: 'economics'; economics: EconomicCatalog; selectedDate: string; kinds: string[]; onKinds: (update: (current: string[]) => string[]) => void }
  | { part: 'boundaries'; manifest: EventManifest; loadedMonths: string[] };

/** Coverage notes that load after the shell: the economic schedule and the research boundaries. */
export default function CoverageNotes(props: Props) {
  if (props.part === 'economics') {
    const { economics, selectedDate, kinds, onKinds } = props;
    return <details class="lens-coverage"><summary>Economic schedule · {economicState(economics, selectedDate)} · verified {economics.verifiedAt.slice(0, 10)}</summary><p>Official Fed and BLS snapshot · {economics.coverage.start} to {economics.coverage.endExclusive} exclusive · America/New_York. Refresh verification is due after 7 days. Dates outside coverage are unavailable.</p><fieldset class="lens-event-filters"><legend>Economic releases</legend>{RELEASES.map(([kind, label]) => <label><input type="checkbox" checked={kinds.includes(kind)} onChange={() => onKinds(current => current.includes(kind) ? current.filter(value => value !== kind) : [...current, kind])} />{label}</label>)}</fieldset>{economics.unavailable.map(row => <p>{row.period}: {row.reason} <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a></p>)}{economics.limitations.map(text => <p>{text}</p>)}</details>;
  }
  const { manifest, loadedMonths } = props;
  return <details class="lens-coverage"><summary>Coverage &amp; research boundaries</summary><p>Sky catalog: {manifest.coverage.start.slice(0, 10)} through {manifest.coverage.end.slice(0, 10)}. Loaded UTC months: {loadedMonths[0] ?? 'none'} through {loadedMonths.at(-1) ?? 'none'}. Filtered absence outside coverage is not an all-clear signal.</p><ul>{manifest.limitations.map((text) => <li>{text}</li>)}</ul><p>Astrology has no established predictive relationship with asset prices. Zodiacs Desk is a read-only research workspace. Notes stay in this browser; exports are your responsibility. Local timestamps are not independently verified publication records.</p><p>Chart software: <a href="/data/market-lens/chart-license/NOTICE.txt">TradingView notice</a> · <a href="/data/market-lens/chart-license/LICENSE.txt">Apache 2.0 license</a>.</p></details>;
}
