import { useEffect, useState } from 'preact/hooks';
import { saturnCountdown } from '../lib/return-visits/countdown';
import { returnText as s } from '../lib/return-visits/copy';
import { formatShortDate } from '../lib/i18n/dates';
import type { CatalogLocale } from '../lib/i18n/core';
import type { SaturnReturnResult } from '../lib/engine/returns';
import '../styles/return-visits.css';
export default function SaturnCountdown({ result, approximate, locale }: { result: SaturnReturnResult; approximate: boolean; locale: CatalogLocale }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const next = saturnCountdown(result, now);
  return <aside class="return-countdown" data-saturn-countdown>
    <h2>{s(locale, 'nextCrossing')}</h2>
    <p class="return-countdown__count">{next ? next.days === 0 ? s(locale, 'countdownToday') : s(locale, 'countdownDays', { n: new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : locale).format(next.days) }) : s(locale, 'countdownOver')}</p>
    {next && <time dateTime={next.at.toISOString()}>{formatShortDate(locale, next.at)} · UTC</time>}
    {approximate && <p class="sharing-note">{s(locale, 'countdownApprox')}</p>}
  </aside>;
}
