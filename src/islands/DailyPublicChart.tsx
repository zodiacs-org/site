import { useEffect, useRef, useState } from 'preact/hooks';
import { loadEngine } from '../lib/hooks/useEngine';
import { formatLongitude } from '../lib/signs';
import { planetLabel } from '../lib/i18n/astrology';
import type { CatalogLocale } from '../lib/i18n/core';
import type { Chart } from '../lib/engine/types';
import { returnText as s } from '../lib/return-visits/copy';
import { CheckOurMath } from './ChartTrust';
import { t } from '../lib/i18n';
import CalculationReload, { calculationError } from './CalculationReload';
export default function DailyPublicChart({ date, locale }: { date: string; locale: CatalogLocale }) {
  const [chart, setChart] = useState<Chart | null>(null), [error, setError] = useState('');
  const generation = useRef(0);
  async function compute() { const run = ++generation.current; setError('');
    try { const engine = await loadEngine(); const chart = engine.computeChart({ utc: new Date(`${date}T12:00:00Z`), houseSystem: 'whole', timeKnown: false }); if (run === generation.current) setChart(chart); }
    catch (cause) { if (run === generation.current) setError(calculationError(cause, locale, s(locale, 'dayError'))); }
  }
  useEffect(() => { void compute(); return () => { generation.current++; }; }, [date]);
  return <section class="return-result">
    {error ? <><p role="alert">{error}</p><button type="button" class="btn btn--ghost" onClick={compute}>{t(locale, 'calculationRetry')} ↻</button><CalculationReload error={error} locale={locale} /></> : chart ? <>
      <CheckOurMath locale={locale} utc={chart.input.utc} basis="reference" />
      <p>{s(locale, 'unknownNote')}</p><h2>{s(locale, 'positions')}</h2>
      <ul class="return-contact-list">{chart.bodies.map((body) => <li key={body.body}><span>{planetLabel(locale, body.body)} · {formatLongitude(body.lon, locale)}{body.retrograde ? ' · Rx' : ''}</span></li>)}</ul>
    </> : <p role="status">{s(locale, 'generating')}</p>}
  </section>;
}
