import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { BirthFields, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import PlaceSearch from './PlaceSearch';
import { birthDateRefusal, birthDateRefusalLang, birthDateRefusalText } from '../lib/birth-date-policy';
import { useProfile } from '../lib/hooks/useProfile';
import { useProfileAccessGeneration } from '../lib/hooks/useProfileAccessGeneration';
import { loadProfile } from '../lib/profile/read-store';
import type { Profile } from '../lib/profile/schema';
import { profileAccessAllowed } from '../lib/account-v2/profile-access-reader';
import type { City } from '../lib/geo/search';
import type { LunarReturnResultData } from './lunar-return/compute';
import type { LunarReturnResultProps } from './lunar-return/LunarReturnResult';
import type { WheelProps } from '../lib/wheel/Wheel';
import { loadModule } from '../lib/module-load';
import CalculationReload, { calculationError } from './CalculationReload';

type ResultComponent = ComponentType<LunarReturnResultProps>;
function profileInputKey(profile: Profile, source: 'saved' | 'manual', savedId: string): string {
  if (source === 'manual') return JSON.stringify(profile.settings.houseSystem);
  const selected = profile.charts.find((chart) => chart.id === savedId);
  if (!selected) return 'missing';
  const { date, time, timeKnown, place } = selected.birth;
  return JSON.stringify({ date, time, timeKnown,
    place: place ? { lat: place.lat, lon: place.lon, tz: place.tz } : null,
    houseSystem: selected.summary.houseSystem });
}

export default function LunarReturnCalculator() {
  const { profile, ready: profileReady } = useProfile();
  const [source, setSource] = useState<'saved' | 'manual'>('manual');
  const [savedId, setSavedId] = useState('');
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  const [time, setTime] = useState('');
  const [timeKnown, setTimeKnown] = useState(true);
  const [city, setCity] = useState<City | null>(null);
  const [differentPlace, setDifferentPlace] = useState(false);
  const [castCity, setCastCity] = useState<City | null>(null);
  const [result, setResult] = useState<{ data: LunarReturnResultData; revision: number } | null>(null);
  const [ResultView, setResultView] = useState<ResultComponent | null>(null);
  const [WheelView, setWheelView] = useState<ComponentType<WheelProps> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryReference, setRetryReference] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const initialized = useRef(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const revision = useRef(0);
  const reference = useRef<Date | null>(null);
  const selection = useRef({ source, savedId, inputKey: profileInputKey(profile, source, savedId) });
  selection.current = { source, savedId, inputKey: profileInputKey(profile, source, savedId) };

  function invalidateResult() {
    revision.current += 1;
    inFlight.current = false;
    reference.current = null;
    setRetryReference('');
    setBusy(false);
    setResult(null);
    setError('');
  }
  const accessGeneration = useProfileAccessGeneration(() => {
    invalidateResult();
    setResultView(null); setWheelView(null); setSource('manual'); setSavedId('');
  });
  useEffect(() => {
    mounted.current = true;
    const onProfile = () => {
      if (!profileAccessAllowed()) return;
      const current = selection.current;
      const nextKey = profileInputKey(loadProfile(), current.source, current.savedId);
      if (nextKey === current.inputKey) return;
      current.inputKey = nextKey;
      invalidateResult();
      if (current.source === 'saved' && nextKey === 'missing') {
        setSource('manual'); setSavedId(''); setDifferentPlace(false); setCastCity(null);
      }
    };
    // Both grant and revoke terminate old requests and prepared export ownership.
    const onAccess = () => { invalidateResult(); onProfile(); };
    window.addEventListener('zodiacs:profile', onProfile);
    window.addEventListener('zodiacs:profile-access', onAccess);
    return () => {
      mounted.current = false; revision.current += 1; inFlight.current = false; reference.current = null;
      window.removeEventListener('zodiacs:profile', onProfile);
      window.removeEventListener('zodiacs:profile-access', onAccess);
    };
  }, []);
  useEffect(() => {
    if (!profileReady || initialized.current) return;
    initialized.current = true;
    if (profile.charts[0]) { setSource('saved'); setSavedId(profile.charts[0].id); }
  }, [profileReady, profile]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const saved = source === 'saved' ? profile.charts.find((chart) => chart.id === savedId) ?? null : null;
  const known = saved ? saved.birth.timeKnown && Boolean(saved.birth.time) : timeKnown && Boolean(time);
  const birthplace = saved ? saved.birth.place : city;
  const completeSaved = saved && saved.birth.date && known && birthplace && Boolean(birthplace.tz);
  const ready = source === 'saved' ? Boolean(completeSaved) : Boolean(date && known && birthplace?.tz);

  async function calculate(event: Event) {
    event.preventDefault();
    if (!mounted.current || !ready || inFlight.current || (differentPlace && !castCity)) return;
    const input = {
      birthDate: saved?.birth.date ?? date, birthTime: saved?.birth.time ?? (time || null), timeKnown: known,
      birthplace: birthplace ? { ...birthplace } : null,
      houseSystem: saved?.summary.houseSystem ?? profile.settings.houseSystem,
      castLocation: differentPlace && castCity ? { ...castCity } : null,
    };
    // A failed load/calculation retries the original reference. Editing the
    // input or starting a calculation after success records a new reference.
    // A birth date under 13 or still to come (a saved chart's too) is refused before anything loads.
    // A date read in the Julian calendar is checked again once it is Gregorian.
    const earlyRefusal = saved || !calendarInPlay(input.birthDate, calendar)
      ? birthDateRefusal(input.birthDate)
      : null;
    if (earlyRefusal) {
      revision.current += 1;
      setResult(null);
      setError(birthDateRefusalText(earlyRefusal));
      return;
    }
    const after = new Date((reference.current ?? new Date()).getTime());
    reference.current = after;
    const request = ++revision.current;
    const generation = accessGeneration.current;
    const isCurrent = () => mounted.current && request === revision.current && generation === accessGeneration.current;
    inFlight.current = true; setResult(null); setBusy(true); setError(''); setRetryReference(after.toISOString());
    try {
      const [{ computeLunarReturn, prepareLocalTime }, view, wheel] = await loadModule(() => Promise.all([
        import('./lunar-return/compute'), import('./lunar-return/LunarReturnResult'), import('./transit/TransitRing'),
      ]));
      if (!saved && calendarInPlay(input.birthDate, calendar)) {
        // A date before 1924 is read in its calendar; the return uses the Gregorian date.
        const entry = await birthDateForChart('en', input.birthDate, calendar);
        if (!isCurrent()) return;
        if ('error' in entry) { setError(entry.error); return; }
        input.birthDate = entry.date;
        const refusal = birthDateRefusal(input.birthDate);
        if (refusal) { setError(birthDateRefusalText(refusal)); return; }
      }
      await prepareLocalTime(input.birthDate, input.birthplace?.tz ?? 'UTC');
      if (!isCurrent()) return;
      const data = computeLunarReturn(input, after);
      if (!isCurrent()) return;
      setResultView(() => view.LunarReturnResult); setWheelView(() => wheel.StaticWheel);
      setResult({ data, revision: request }); reference.current = null; setRetryReference('');
    } catch (cause) {
      if (!isCurrent()) return;
      setError(cause instanceof RangeError ? cause.message
        : calculationError(cause, 'en', 'The lunar return could not be calculated. Check the details and try again.'));
    } finally {
      if (isCurrent()) { inFlight.current = false; setBusy(false); }
    }
  }

  return (
    <div class="calc" data-lunar-return-calculator>
      <form class="calc__form shell" onSubmit={calculate} aria-busy={busy}>
        <div class="core calc__core">
          {profile.charts.length > 0 && <div class="field sr-form__source">
            <label class="field__label" for="lr-source">Chart</label>
            <select id="lr-source" class="field__input" value={source === 'saved' ? savedId : ''} onChange={(event) => {
              invalidateResult(); const value = event.currentTarget.value;
              setSource(value ? 'saved' : 'manual'); setSavedId(value); setDifferentPlace(false); setCastCity(null);
            }}>
              <option value="">Enter birth details</option>
              {profile.charts.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
            </select>
          </div>}
          {source === 'manual' && <div class="calc__fields sr-form__birth">
            <BirthFields locale="en" dateId="lr-date" timeId="lr-time" placeId="lr-place"
              date={date} time={time} timeKnown={timeKnown} city={city}
              onDateChange={(value) => { invalidateResult(); setDate(value); }}
              calendar={calendar} onCalendarChange={(value) => { invalidateResult(); setCalendar(value); }}
              onTimeChange={(value) => { invalidateResult(); setTime(value); }}
              onTimeKnownChange={(value) => { invalidateResult(); setTimeKnown(value); setDifferentPlace(false); setCastCity(null); }}
              onCityChange={(value) => { invalidateResult(); setCity(value); }} requireKnownTime
              timeHelp="Use the time from your birth record. A lunar return needs a known birth time."
              placeHelp="Choose a city so its timezone can be used for your birth time." />
          </div>}
          {((source === 'saved' && !completeSaved) || (source === 'manual' && !timeKnown)) && <div class="lr-input-notice" data-lr-incomplete>
            <p class="notice">A lunar return needs a known birth time and a birthplace with a timezone. A Moon sign or an incomplete saved chart cannot supply the return time.</p>
            {source === 'saved' && <button class="btn btn--ghost" type="button" onClick={() => {
              invalidateResult(); setSource('manual'); setSavedId(''); setDifferentPlace(false); setCastCity(null);
            }}>Enter complete birth details</button>}
          </div>}
          {ready && <div class="field sr-form__options">
            <label class="field__toggle sr-form__toggle"><input type="checkbox" checked={differentPlace} onChange={(event) => {
              invalidateResult(); setDifferentPlace(event.currentTarget.checked); setCastCity(null);
            }} />Cast for a different place</label>
            {differentPlace && <><label class="field__label" for="lr-cast-place">Return location</label><PlaceSearch id="lr-cast-place" selected={castCity} onSelect={(value) => { invalidateResult(); setCastCity(value); }} locale="en" /></>}
            <p class="field__help">Defaults to the birthplace. A different place changes the rising sign and houses; the return instant and planets stay the same.</p>
          </div>}
          <button class="btn btn--primary calc__submit" type="submit" disabled={!ready || busy || (differentPlace && !castCity)}>
            <span>{busy ? 'Calculating…' : error ? 'Try calculation again' : 'Find next lunar return'}</span><span class="orb" aria-hidden="true">↗</span>
          </button>
          <p class="field__help">Finds the next return after the moment you calculate. Each result keeps that reference time.</p>
          <p class="calc__privacy"><strong>Private by default.</strong> The chart is calculated on this device; nothing is uploaded.</p>
          {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef} lang={birthDateRefusalLang(error)}>{error}</p>}
          {error && retryReference && <p class="field__help" data-lr-retry-reference>Retry uses the same reference: {retryReference.replace('T', ' ').replace('Z', ' UTC')}.</p>}
          <CalculationReload error={error} locale="en" />
        </div>
      </form>
      {result && ResultView && WheelView && <ResultView key={result.revision} result={result.data} Wheel={WheelView} />}
    </div>
  );
}
