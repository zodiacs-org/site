import { useEffect, useRef, useState } from 'preact/hooks';
import { t, type CatalogLocale } from '../lib/i18n';
import { englishOnlyCue } from '../lib/i18n/english-only';
import { useEngine } from '../lib/hooks/useEngine';
import { loadModule } from '../lib/module-load';
import { calculateEntry, emptyEntry } from '../lib/sharing/chart-entry';
import { sharingText as s } from '../lib/sharing/copy';
import { matchTwins, twinSigns, type TwinMatch, type TwinPerson } from '../lib/sharing/twins';
import { signBySlug, signName } from '../lib/signs';
import SharingBirthForm from './SharingBirthForm';
import CalculationReload, { calculationError } from './CalculationReload';
import type { Chart } from '../lib/engine/types';
import type * as Trust from './ChartTrust';

export default function ChartTwins({ locale = 'en', directory }: { locale?: CatalogLocale; directory: TwinPerson[] }) {
  const engine = useEngine();
  const englishCue = englishOnlyCue(locale);
  const [entry, setEntry] = useState(emptyEntry(1));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState<{ chart: Chart; signs: ReturnType<typeof twinSigns>; matches: TwinMatch[]; trust: typeof Trust } | null>(null);
  const generation = useRef(0), resultRef = useRef<HTMLElement>(null);
  useEffect(() => () => { generation.current++; }, []);
  async function compute(event: Event) {
    event.preventDefault(); const run = ++generation.current;
    setBusy(true); setError(''); setResult(null);
    try {
      const [mod, trust] = await Promise.all([engine(), loadModule(() => import('./ChartTrust'))]);
      const { chart } = await calculateEntry(entry, mod, locale);
      if (run !== generation.current) return;
      const signs = twinSigns(chart);
      setResult({ chart, signs, matches: matchTwins(signs, directory), trust });
      requestAnimationFrame(() => { if (run === generation.current) { resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } });
    } catch (cause) { if (run === generation.current) setError(calculationError(cause, locale, s(locale, 'computeError'))); }
    finally { if (run === generation.current) setBusy(false); }
  }
  const both = result?.matches.filter((match) => match.count === 2) ?? [];
  const partial = result?.matches.filter((match) => match.count === 1) ?? [];
  function cards(matches: TwinMatch[]) { return <ul class="twin-list">{matches.map((match) => <li class="tile twin-person" key={match.person.slug} data-twin-match={match.count}>
    <h3><a href={`/people/${match.person.slug}/`} hrefLang="en" title={englishCue?.aria}>{match.person.name}</a></h3>
    <p class="twin-match-label">{s(locale, match.count === 2 ? 'twinsBoth' : match.sun ? 'twinsSun' : 'twinsMoon')}</p>
    <p class="sharing-note">{t(locale, 'sun')}: {signName(signBySlug(match.person.sun), locale)}{match.person.moon && <> · {t(locale, 'moon')}: {signName(signBySlug(match.person.moon), locale)}</>}</p>
    <p class="sharing-note">{s(locale, 'unknownTime')}</p>
    <a class="twin-source" href={`/people/${match.person.slug}/#sources`} hrefLang="en">{s(locale, 'source')}{englishCue?.suffix} →</a>
  </li>)}</ul>; }
  return <div class="sharing-tool">
    <p class="notice">{s(locale, 'twinsLimit')}</p>
    <form class="sharing-form" onSubmit={compute}>
      <SharingBirthForm locale={locale} entry={entry} warm={engine} onChange={(next) => { generation.current++; setEntry((current) => ({ ...current, ...next })); setResult(null); setBusy(false); setError(''); }} />
      <button class="btn btn--primary" disabled={busy} data-twins-submit><span>{s(locale, busy ? 'computing' : 'twinsSubmit')}</span><span class="orb">↗</span></button>
      <p class="sharing-note">{s(locale, 'privacy')}</p>{error && <p class="field__error" role="alert">{error}</p>}<CalculationReload error={error} locale={locale} />
    </form>
    {result && <section class="sharing-result" tabIndex={-1} ref={resultRef} aria-label={s(locale, 'twinsTitle')} data-twins-result>
      <p data-result-opening>{s(locale, 'twinsOpening')}</p>
      <result.trust.CheckOurMath utc={result.chart.input.utc} basis={result.chart.input.timeKnown ? 'birth' : 'reference'} locale={locale} />
      {!result.signs.moon && <p class="notice">{s(locale, 'twinsNoMoon')}</p>}
      {!result.signs.sun && <p class="notice">{t(locale, 'needsBirthTime')}</p>}
      {result.signs.moon && (both.length > 0 ? <><h2>{s(locale, 'twinsBoth')}</h2><p>{s(locale, 'twinsCount', { n: both.length })}</p>{cards(both)}</> : <p>{s(locale, 'twinsEmpty')}</p>)}
      {partial.length > 0 && (result.signs.moon
        ? <details class="sharing-method"><summary>{s(locale, 'twinsPartial')} ({partial.length})</summary>{cards(partial)}</details>
        : <><h2>{s(locale, 'twinsSun')}</h2><p>{s(locale, 'twinsCount', { n: partial.length })}</p>{cards(partial)}</>)}
      <a href="/people/" hrefLang="en">{s(locale, 'directory')}{englishCue?.suffix} →</a>
    </section>}
  </div>;
}
