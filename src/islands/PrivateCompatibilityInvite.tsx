import { useEffect, useRef, useState } from 'preact/hooks';
import { localizePath, type CatalogLocale } from '../lib/i18n';
import { useEngine } from '../lib/hooks/useEngine';
import { loadModule } from '../lib/module-load';
import { calculateEntry, emptyEntry } from '../lib/sharing/chart-entry';
import { sharingText as s } from '../lib/sharing/copy';
import SharingBirthForm from './SharingBirthForm';
import CalculationReload, { calculationError } from './CalculationReload';
import type { Chart } from '../lib/engine/types';
import type * as Trust from './ChartTrust';

export default function PrivateCompatibilityInvite({ locale = 'en' }: { locale?: CatalogLocale }) {
  const engine = useEngine();
  const [entry, setEntry] = useState(emptyEntry(1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ chart: Chart; token: string; trust: typeof Trust } | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const generation = useRef(0);
  const link = result ? `${typeof window === 'undefined' ? 'https://zodiacs.org' : window.location.origin}${localizePath(locale, '/compatibility/')}#p=${result.token}` : '';
  useEffect(() => () => { generation.current++; }, []);
  async function compute(event: Event) {
    event.preventDefault();
    const run = ++generation.current;
    setBusy(true); setError(''); setResult(null); setCopyStatus('');
    try {
      const [mod, invite, trust] = await Promise.all([engine(), loadModule(() => import('../lib/sharing/private-invite')), loadModule(() => import('./ChartTrust'))]);
      const computed = await calculateEntry(entry, mod, locale);
      const chart = computed.chart;
      const token = await invite.privateInviteToken({ bodies: chart.bodies, angles: chart.angles, houseSystem: chart.input.houseSystem, engineVersion: chart.engineVersion }, chart.input.timeKnown ? { utc: chart.input.utc } : { birthDate: computed.date });
      if (run === generation.current) setResult({ chart, token, trust });
    } catch (cause) {
      if (run === generation.current) setError(calculationError(cause, locale, s(locale, 'computeError')));
    } finally { if (run === generation.current) setBusy(false); }
  }
  async function copy() {
    const run = generation.current;
    try { await navigator.clipboard.writeText(link); if (run === generation.current) setCopyStatus(s(locale, 'inviteCopied')); }
    catch { if (run === generation.current) setCopyStatus(s(locale, 'copyFailed')); }
  }
  return <div class="sharing-tool">
    <form class="sharing-form" onSubmit={compute}>
      <SharingBirthForm locale={locale} entry={entry} warm={engine} onChange={(next) => { generation.current++; setEntry((current) => ({ ...current, ...next })); setResult(null); setBusy(false); setError(''); setCopyStatus(''); }} />
      <button class="btn btn--primary" disabled={busy} data-private-invite-create><span>{s(locale, busy ? 'computing' : 'inviteCreate')}</span><span class="orb">↗</span></button>
      <p class="sharing-note">{s(locale, 'privacy')}</p>
      {error && <p role="alert" class="field__error">{error}</p>}<CalculationReload error={error} locale={locale} />
    </form>
    {result && <section class="sharing-result" data-private-invite-result>
      <result.trust.ResultOpening locale={locale} /><result.trust.CheckOurMath utc={result.chart.input.utc} basis={result.chart.input.timeKnown ? 'birth' : 'reference'} locale={locale} />
      <h2>{s(locale, 'inviteReady')}</h2><p>{s(locale, 'inviteNote')}</p>
      <button class="btn btn--glass" type="button" onClick={copy} data-private-invite-copy><span>{s(locale, 'inviteShare')}</span><span class="orb">↑</span></button>
      <label class="field__label" for="private-invite-link">{s(locale, 'linkLabel')}</label>
      <input id="private-invite-link" class="field__input sharing-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
      <p role="status">{copyStatus}</p>
    </section>}
  </div>;
}
