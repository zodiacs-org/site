import { useEffect, useRef, useState } from 'preact/hooks';
import { useProfile } from '../../lib/hooks/useProfile';
import { explicitSelfChart, loadProfile } from '../../lib/profile/read-store';
import { profileAccessAllowed } from '../../lib/account-v2/profile-access-reader';
import { dateHandoffFromHash, dateHandoffFragment, profileChartHandoffFragment, subjectModeFromHash, type DateHandoff } from '../../lib/chart-handoff';
import { decodeChartLink, encodeChartLink, type ShareChartInput } from '../../lib/share';
import { resolveSavedChart } from '../../lib/profile/resolve';
import { prepareLocalTime, resolveLocalToUtc } from '../../lib/time/localToUtc';
import LivingSelfChartChooser from '../../islands/living-chart/LivingSelfChartChooser';
import { HOUSE_THEMES, PERSONAL_BODIES, sourceRevision, type PersonalResult } from './personal';
import type { WindowTransitBody } from '../../lib/engine/transit-window-core';
import type { PersonalRequest } from './PersonalTransits.worker';
import OutlookPanel from './OutlookPanel';

interface Props { date: string; timeZone: string; onResult: (result: PersonalResult | null) => void; onSourceChange: (validId: string | null, updatedAt?: string) => void }
export default function PersonalContext({ date, timeZone, onResult, onSourceChange }: Props) {
  const { profile, ready } = useProfile();
  const own = explicitSelfChart(profile.charts);
  const [choosing, setChoosing] = useState(false);
  const sessionRevision = useRef('');
  const [session, setSession] = useState<ShareChartInput | null>(null);
  const [partialInput, setPartialInput] = useState<DateHandoff | null>(null);
  const [orb, setOrb] = useState(3);
  const [outlookEnabled, setOutlookEnabled] = useState(false);
  const [bodies, setBodies] = useState<WindowTransitBody[]>(['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PersonalResult | null>(null);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const callback = useRef(onResult); callback.current = onResult;
  const sourceCallback = useRef(onSourceChange); sourceCallback.current = onSourceChange;
  const source = useRef('');
  const clear = () => { generation.current++; worker.current?.terminate(); worker.current = null; setResult(null); callback.current(null); setProgress(''); };
  useEffect(() => {
    const consume = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const partial = dateHandoffFromHash(window.location.hash);
      if (partial) { setPartialInput(partial); setSession(null); }
      if (params.getAll('c').length === 1 && subjectModeFromHash(window.location.hash) === 'self') {
        const decoded = decodeChartLink(params.get('c')!);
        if (decoded) { clear(); sourceCallback.current(null); sessionRevision.current = new Date().toISOString(); setPartialInput(null); setSession(decoded); }
      }
      if (params.has('c') || partial) history.replaceState(null, '', window.location.pathname + window.location.search);
    };
    consume();
    const revoke = () => { clear(); setSession(null); setPartialInput(null); sourceCallback.current(null); };
    const invalidate = () => { const next = explicitSelfChart(loadProfile().charts); if ((next ? sourceRevision(next) : '') !== source.current) { clear(); sourceCallback.current(null); } };
    const crossTab = (event: StorageEvent) => { if (event.key === 'zodiacs.profile.v1' || event.key === null) { invalidate(); window.dispatchEvent(new Event('zodiacs:profile')); } };
    window.addEventListener('zodiacs:profile-access', revoke);
    window.addEventListener('zodiacs:profile', invalidate);
    window.addEventListener('zodiacs:chart-context-cleared', revoke);
    window.addEventListener('storage', crossTab);
    window.addEventListener('hashchange', consume);
    return () => { clear(); window.removeEventListener('zodiacs:profile-access', revoke); window.removeEventListener('zodiacs:profile', invalidate); window.removeEventListener('zodiacs:chart-context-cleared', revoke); window.removeEventListener('storage', crossTab); window.removeEventListener('hashchange', consume); };
  }, []);
  const revision = own ? sourceRevision(own) : '';
  useEffect(() => { source.current = revision; if (ready) sourceCallback.current(session ? 'session' : own?.id ?? null, session ? sessionRevision.current : own?.updatedAt); }, [revision, ready, session]);
  useEffect(() => {
    clear(); setError('');
    if ((!own && !session) || !profileAccessAllowed()) return;
    setChoosing(false);
    const token = generation.current;
    const current = () => token === generation.current && profileAccessAllowed();
    void (async () => {
      try {
        let input: PersonalRequest['input'];
        if (own && !session) {
          if (!own.birth.place) throw new Error('Your chart needs its birthplace. Add the missing detail in the shared chart editor.');
          const resolved = await resolveSavedChart(own, () => import('../../lib/engine/full'), { strict: true });
          input = { utc: resolved.summary.utcISO, latitude: own.birth.place.lat, longitude: own.birth.place.lon, houseSystem: resolved.summary.houseSystem, timeKnown: own.birth.timeKnown && Boolean(own.birth.time), flags: resolved.summary.flags };
        } else {
          await prepareLocalTime(session!.date, session!.tz);
          const resolved = resolveLocalToUtc(session!.date, session!.timeKnown && session!.time ? session!.time : '12:00', session!.tz, { longitude: session!.lon });
          input = { utc: resolved.utc.toISOString(), latitude: session!.lat, longitude: session!.lon, houseSystem: session!.houseSystem, timeKnown: session!.timeKnown, flags: resolved.flags };
        }
        if (!current()) return;
        const month = Date.parse(`${date.slice(0, 7)}-01T00:00:00Z`);
        const reference = new Date(`${date}T12:00:00Z`).toISOString();
        const request: PersonalRequest = { sourceId: session ? 'session' : own!.id, sourceUpdatedAt: session ? sessionRevision.current : own!.updatedAt, input, from: new Date(month - 60 * 86400000).toISOString(), to: new Date(month + 100 * 86400000).toISOString(), reference, bodies, orb, ...(outlookEnabled ? { outlookMonth: date.slice(0, 7) } : {}) };
        const job = new Worker(new URL('./PersonalTransits.worker.ts', import.meta.url), { type: 'module' }); worker.current = job;
        setProgress('Preparing your calendar…');
        job.onmessage = ({ data }: MessageEvent<{ progress?: string; result?: PersonalResult; error?: string }>) => {
          if (!current()) return;
          if (data.progress) setProgress(`Calculating ${data.progress}…`);
          if (data.error) { setError(data.error); setProgress(''); job.terminate(); }
          if (data.result) { setResult(data.result); callback.current(data.result); setProgress(''); job.terminate(); }
        };
        job.onerror = () => { if (current()) { setError('Personal calculations could not load. Retry by changing the date.'); setProgress(''); } job.terminate(); };
        job.postMessage(request);
      } catch (reason) { if (current()) { setError(reason instanceof Error ? reason.message : 'Your chart could not be loaded.'); setProgress(''); } }
    })();
    return clear;
  }, [revision, session, date, timeZone, orb, bodies.join(','), outlookEnabled]);
  const edit = session ? `/birth-chart/#c=${encodeChartLink(session)}` : own ? `/birth-chart/#${profileChartHandoffFragment(own.id)}` : partialInput ? `/birth-chart/#${dateHandoffFragment(partialInput.date, partialInput.time)}` : '/birth-chart/';
  return <section class="lens-panel lens-personal" data-testid="lens-personal-context">
    <div class="lens-section-head"><div><h2>My Astro Calendar</h2><p class="lens-muted">{session ? 'Using your unsaved chart · this session only' : own ? `Using your chart · ${own.name}` : ready ? 'Choose your own full chart for personal timing.' : 'Personal chart access is unavailable or locked. Open your profile to unlock it.'}</p></div><div class="lens-inline">{profile.charts.length > 0 && <button class="lens-button" onClick={() => { setSession(null); setChoosing(!choosing); }}>Change chart</button>}<a class="lens-button" href={edit}>{own || session ? 'Edit details' : 'Open chart calculator'}</a><a href="/profile/">Your profile</a></div></div>
    {((!own && !session) || choosing) && profile.charts.length > 0 && <LivingSelfChartChooser charts={profile.charts} purpose="My Astro Calendar" />}
    {partialInput && !own && !session && <p class="lens-muted">Your date and time choice are available for this session. Add the missing birthplace in the shared chart calculator to enable personal timing.</p>}
    {(own || session) && <label class="lens-inline"><input type="checkbox" checked={outlookEnabled} onChange={() => setOutlookEnabled(!outlookEnabled)} />Show optional interpretive astrology outlook</label>}
    {(own || session) && <details class="lens-method"><summary>Personal timing settings &amp; uncertainty</summary><label class="lens-field">Contact orb<select aria-label="Personal contact orb" value={orb} onChange={e => setOrb(Number(e.currentTarget.value))}>{[0.5, 1, 2, 3].map(n => <option value={n}>{n}°</option>)}</select></label><fieldset class="lens-event-filters"><legend>Transiting bodies</legend>{PERSONAL_BODIES.map(body => <label><input type="checkbox" checked={bodies.includes(body)} onChange={() => setBodies(current => current.includes(body) ? current.filter(b => b !== body) : [...current, body])} />{body}</label>)}</fieldset><p class="lens-muted">All five major aspects; tropical geocentric longitudes, fixed natal targets. Boundaries beyond the scan are clipped. Numerical root precision does not establish astronomical or birth-time accuracy. Moon uses hourly probes, other fast bodies six-hour probes, outer planets twelve-hour probes. Calculations stay on this device.</p><p class="lens-muted">Saved charts currently record known/unknown time and clock-resolution flags, without a separate approximate-time field. If your time is approximate, set it unknown in the shared editor; reliable angles, houses and natal Moon contacts will be excluded.</p></details>}
    {progress && <p role="status">{progress}</p>}{error && <p class="lens-error" role="alert">{error}</p>}
    {result && <><p class="lens-muted">{result.timeReliable ? `Actual houses: ${result.houseSystem ?? 'unavailable'}.` : 'Time is unknown or uncertain: natal Moon, angles and houses are excluded. Other planets use the existing noon birth reference; their contact dates are model estimates that can shift with birth-time uncertainty.'} {result.flags.length ? `Calculation flags: ${result.flags.join(', ')}.` : ''} Placement details use 12:00 UTC on {date}; event times and calendar grouping use {timeZone}.</p><details><summary>Resources, risk and shared obligations</summary>{result.houses.map(row => <p><strong>{row.house === 2 ? '2nd' : `${row.house}th`} house · {HOUSE_THEMES[row.house]}</strong><br />{result.houseSystem ? `Natal: ${row.natal.join(', ') || 'no supported planets'}. Transiting at 12:00 UTC: ${row.transit.join(', ') || 'no supported planets'}.` : 'Unavailable without reliable birth time and houses.'}</p>)}<p class="lens-muted">These are reflective traditional themes, with no demonstrated asset prediction.</p></details></>}
    {result?.outlook && <OutlookPanel days={result.outlook} selectedDate={date} reliable={result.timeReliable} />}
  </section>;
}
