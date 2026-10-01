import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { BirthFields, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import PlaceSearch from './PlaceSearch';
import { useProfile } from '../lib/hooks/useProfile';
import { useProfileAccessGeneration } from '../lib/hooks/useProfileAccessGeneration';
import { loadProfile } from '../lib/profile/read-store';
import type { Profile } from '../lib/profile/schema';
import { profileAccessAllowed } from '../lib/account-v2/profile-access-reader';
import type { City } from '../lib/geo/search';
import type { SolarReturnResultData } from './solar-return/compute';
import type { SolarReturnResultProps } from './solar-return/SolarReturnResult';
import type { WheelProps } from '../lib/wheel/Wheel';
import { loadModule } from '../lib/module-load';
import CalculationReload, { calculationError } from './CalculationReload';

type ResultComponent = ComponentType<SolarReturnResultProps>;

function profileInputKey(profile: Profile, source: 'saved' | 'manual', savedId: string): string {
  if (source === 'manual') return JSON.stringify(profile.settings.houseSystem);
  const selected = profile.charts.find((chart) => chart.id === savedId);
  if (!selected) return 'missing';
  const { date, time, timeKnown, place } = selected.birth;
  return JSON.stringify({
    date, time, timeKnown,
    place: place ? { lat: place.lat, lon: place.lon, tz: place.tz } : null,
    houseSystem: selected.summary.houseSystem,
    savedSun: !place ? selected.summary.bodies.find((body) => body.body === 'Sun')?.lon : null,
  });
}

export default function SolarReturnCalculator() {
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
  const [yearMode, setYearMode] = useState<'current' | 'custom'>('current');
  const [customYear, setCustomYear] = useState(String(new Date().getFullYear()));
  const [result, setResult] = useState<{ data: SolarReturnResultData; revision: number } | null>(null);
  const [ResultView, setResultView] = useState<ResultComponent | null>(null);
  const [WheelView, setWheelView] = useState<ComponentType<WheelProps> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const initialized = useRef(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const revision = useRef(0);
  const selection = useRef({ source, savedId, inputKey: profileInputKey(profile, source, savedId) });
  selection.current = { source, savedId, inputKey: profileInputKey(profile, source, savedId) };

  function cancelRequest() {
    revision.current += 1;
    inFlight.current = false;
    setBusy(false);
  }

  function invalidateResult() {
    cancelRequest();
    setResult(null);
    setError('');
  }

  const profileAccessGeneration = useProfileAccessGeneration(() => {
    cancelRequest();
    setResult(null);
    setResultView(null);
    setWheelView(null);
    setSource('manual');
    setSavedId('');
    setError('');
  });

  useEffect(() => {
    mounted.current = true;
    const onProfile = () => {
      if (!profileAccessAllowed()) return;
      const latest = loadProfile();
      const current = selection.current;
      const nextKey = profileInputKey(latest, current.source, current.savedId);
      if (nextKey === current.inputKey) return;
      current.inputKey = nextKey;
      invalidateResult();
      if (current.source === 'saved' && nextKey === 'missing') {
        setSource('manual');
        setSavedId('');
        setDifferentPlace(false);
        setCastCity(null);
      }
    };
    const onAccess = () => {
      cancelRequest();
      onProfile();
    };
    window.addEventListener('zodiacs:profile', onProfile);
    window.addEventListener('zodiacs:profile-access', onAccess);
    return () => {
      mounted.current = false;
      revision.current += 1;
      inFlight.current = false;
      window.removeEventListener('zodiacs:profile', onProfile);
      window.removeEventListener('zodiacs:profile-access', onAccess);
    };
  }, []);

  useEffect(() => {
    if (!profileReady || initialized.current) return;
    initialized.current = true;
    if (profile.charts[0]) {
      setSource('saved');
      setSavedId(profile.charts[0].id);
    }
  }, [profileReady, profile]);

  const saved = profile.charts.find((chart) => chart.id === savedId) ?? null;
  const manualReady = date !== '' && city !== null && (!timeKnown || time !== '');
  const ready = source === 'saved' ? saved !== null : manualReady;
  const effectiveTimeKnown = saved ? saved.birth.timeKnown && Boolean(saved.birth.time) : timeKnown;

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function calculate(event: Event) {
    event.preventDefault();
    if (!mounted.current || !ready || inFlight.current) return;
    const selected = source === 'saved' ? saved : null;
    const birthplace = selected ? selected.birth.place : city;
    const known = selected ? selected.birth.timeKnown && Boolean(selected.birth.time) : timeKnown;
    if (differentPlace && known && birthplace && !castCity) return;
    const input = {
      birthDate: selected?.birth.date ?? date,
      birthTime: selected?.birth.time ?? (time || null),
      timeKnown: known,
      birthplace: birthplace ? { ...birthplace } : null,
      savedSunLon: selected && !birthplace
        ? selected.summary.bodies.find((body) => body.body === 'Sun')?.lon ?? null
        : null,
      savedUtc: selected && !birthplace ? selected.summary.utcISO : null,
      houseSystem: selected?.summary.houseSystem ?? profile.settings.houseSystem,
      castLocation: selected && !birthplace ? null : (differentPlace ? castCity : birthplace),
      year: yearMode === 'current' ? 'current' as const : Number(customYear),
    };
    if (input.castLocation) input.castLocation = { ...input.castLocation };
    const request = ++revision.current;
    inFlight.current = true;
    setResult(null);
    setBusy(true);
    setError('');
    const accessGeneration = profileAccessGeneration.current;
    const isCurrent = () => mounted.current && request === revision.current
      && accessGeneration === profileAccessGeneration.current;
    try {
      const [{ computeSolarReturn, prepareLocalTime }, view, wheel] = await loadModule(() => Promise.all([
        import('./solar-return/compute'),
        import('./solar-return/SolarReturnResult'),
        import('./transit/TransitRing'),
      ]));
      if (!selected && calendarInPlay(input.birthDate, calendar)) {
        // A date before 1924 is read in its calendar; the return uses the Gregorian date.
        const entry = await birthDateForChart('en', input.birthDate, calendar);
        if (!isCurrent()) return;
        if ('error' in entry) {
          setError(entry.error);
          return;
        }
        input.birthDate = entry.date;
      }
      await prepareLocalTime(input.birthDate, input.birthplace?.tz ?? 'UTC');
      if (!isCurrent()) return;
      const resultData = computeSolarReturn(input);
      if (!isCurrent()) return;
      setResultView(() => view.SolarReturnResult);
      setWheelView(() => wheel.StaticWheel);
      setResult({ data: resultData, revision: request });
    } catch (cause) {
      if (!isCurrent()) return;
      console.error(cause);
      setError(calculationError(cause, 'en', 'The solar return could not be computed. Check the details and try again.'));
    } finally {
      if (isCurrent()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <div class="calc" data-solar-return-calculator>
      <form class="calc__form shell" onSubmit={calculate} aria-busy={busy}>
        <div class="core calc__core">
          {profile.charts.length > 0 && (
            <div class="field sr-form__source">
              <label class="field__label" for="sr-source">Chart</label>
              <select id="sr-source" class="field__input" value={source === 'saved' ? savedId : ''} onChange={(event) => {
                invalidateResult();
                const value = (event.target as HTMLSelectElement).value;
                setSource(value ? 'saved' : 'manual');
                setSavedId(value);
                setDifferentPlace(false);
                setCastCity(null);
              }}>
                <option value="">Enter birth details</option>
                {profile.charts.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
              </select>
            </div>
          )}

          {source === 'manual' && (
            <div class="calc__fields sr-form__birth">
              <BirthFields
                locale="en" dateId="sr-date" timeId="sr-time" placeId="sr-place"
                date={date} time={time} timeKnown={timeKnown} city={city}
                onDateChange={(value) => { invalidateResult(); setDate(value); }}
                calendar={calendar}
                onCalendarChange={(value) => { invalidateResult(); setCalendar(value); }}
                onTimeChange={(value) => { invalidateResult(); setTime(value); }}
                onTimeKnownChange={(known) => { invalidateResult(); setTimeKnown(known); if (!known) { setDifferentPlace(false); setCastCity(null); } }}
                onCityChange={(value) => { invalidateResult(); setCity(value); }}
                requireKnownTime
                timeHelp="Unknown time uses the sky at 12:00 UTC on the birth date and leaves out houses."
                placeHelp="A birthplace is required so the birth date can be resolved in its timezone."
              />
            </div>
          )}

          {saved && !saved.birth.place && <p class="notice">This saved chart has no stored birthplace. Its saved Sun position will be used, and the result will be planets-only.</p>}

          <div class="calc__fields sr-form__options">
            <div class="field">
              <label class="field__label" for="sr-year-mode">Return year</label>
              <select id="sr-year-mode" class="field__input" value={yearMode} onChange={(event) => { invalidateResult(); setYearMode((event.target as HTMLSelectElement).value as 'current' | 'custom'); }}>
                <option value="current">Current return</option>
                <option value="custom">Choose a year</option>
              </select>
              {yearMode === 'custom' && <input aria-label="Custom return year" class="field__input" type="number" min="1800" max="2199" required value={customYear} onInput={(event) => { invalidateResult(); setCustomYear((event.target as HTMLInputElement).value); }} />}
            </div>

            {effectiveTimeKnown && !(saved && !saved.birth.place) && (
              <div class="field">
                <label class="field__toggle sr-form__toggle"><input type="checkbox" checked={differentPlace} onChange={(event) => {
                  invalidateResult();
                  const checked = (event.target as HTMLInputElement).checked;
                  setDifferentPlace(checked);
                  setCastCity(null);
                }} />Cast for a different place</label>
                {differentPlace && <><label class="field__label" for="sr-cast-place">Return location</label><PlaceSearch id="sr-cast-place" selected={castCity} onSelect={(value) => { invalidateResult(); setCastCity(value); }} locale="en" /></>}
                <p class="field__help">Defaults to the birthplace. Relocation changes angles and houses, not planets.</p>
              </div>
            )}
          </div>

          <button class="btn btn--primary calc__submit" type="submit" disabled={!ready || busy || (differentPlace && effectiveTimeKnown && !(saved && !saved.birth.place) && !castCity)}><span>{busy ? 'Computing…' : 'Find my solar return'}</span><span class="orb" aria-hidden="true">↗</span></button>
          <p class="calc__privacy"><strong>Private by default.</strong> The chart is calculated on this device; nothing is uploaded.</p>
          {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <CalculationReload error={error} locale="en" />
        </div>
      </form>
      {result && ResultView && WheelView && <ResultView key={result.revision} result={result.data} Wheel={WheelView} />}
    </div>
  );
}
