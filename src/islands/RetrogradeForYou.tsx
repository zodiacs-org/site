import { useEffect, useRef, useState } from 'preact/hooks';
import { BirthFields, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import type { City } from '../lib/geo/search';
import type { RetrogradePlanet, RetrogradeStatus } from '../lib/retrograde-for-you/reading';
import type { RetrogradeForYouOutcome } from './retrograde-for-you/compute';
import { loadModule } from '../lib/module-load';
import CalculationReload, { calculationError } from './CalculationReload';

type Result = Exclude<RetrogradeForYouOutcome, { refused: 'under-13' }>;
type Period = Result['periods'][number];

const PLANETS: readonly RetrogradePlanet[] = ['Mercury', 'Venus', 'Mars'];
/** Each planet in the hue of the sign it rules, the only colour the site uses. */
const HUE: Record<RetrogradePlanet, string> = { Mercury: 'var(--sign-gemini)', Venus: 'var(--sign-taurus)', Mars: 'var(--sign-aries)' };
const STATUS: Record<RetrogradeStatus, string> = {
  retrograde: 'Retrograde now',
  'pre-shadow': 'In the pre-shadow now',
  'post-shadow': 'In the post-shadow now',
  direct: 'Direct now',
};
const SIGN_NAME: Record<string, string> = {
  aries: 'Aries', taurus: 'Taurus', gemini: 'Gemini', cancer: 'Cancer', leo: 'Leo', virgo: 'Virgo',
  libra: 'Libra', scorpio: 'Scorpio', sagittarius: 'Sagittarius', capricorn: 'Capricorn', aquarius: 'Aquarius', pisces: 'Pisces',
};
const UNDER_13 = 'Zodiacs is not made for children under 13, so it gives no reading for a birth date less than 13 years ago. Nothing was calculated. If you are 13 or older, enter your own birth date.';
const SHARE_ORIGIN = 'https://zodiacs.org';
const W = 600;

function browserZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

/** The loop as a band: the pre-shadow, the retrograde and the post-shadow, with today marked when it falls inside. */
function Timeline({ period, now }: { period: Period; now: number }) {
  const retro = Date.parse(period.stationRetrograde.utc);
  const direct = Date.parse(period.stationDirect.utc);
  const start = period.preShadowStart ? Date.parse(period.preShadowStart.utc) : retro;
  const end = period.postShadowEnd ? Date.parse(period.postShadowEnd.utc) : direct;
  const x = (at: number) => ((at - start) / (end - start)) * W;
  const marker = now >= start && now <= end ? x(now) : null;
  return (
    <svg class="rfy__timeline" viewBox={`0 0 ${W} 28`} preserveAspectRatio="none" role="img"
      aria-label={`${period.planet}'s loop: pre-shadow, retrograde from ${period.stationRetrograde.label} to ${period.stationDirect.label}, then post-shadow.`}>
      <rect x="0" y="10" width={W} height="8" rx="4" class="rfy__shadow" />
      <rect x={x(retro)} y="6" width={Math.max(2, x(direct) - x(retro))} height="16" rx="3" class="rfy__retro" />
      {marker !== null && <line x1={marker} x2={marker} y1="0" y2="28" class="rfy__now" vector-effect="non-scaling-stroke" />}
    </svg>
  );
}

function ShareButton({ query, planet }: { query: string; planet: RetrogradePlanet }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const url = `${SHARE_ORIGIN}/share/retrograde-for-you/?${query}`;
  async function share() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `${planet} retrograde in my chart`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setState('failed');
    }
  }
  return (
    <div class="rfy__share">
      <button class="btn btn--ghost" type="button" onClick={() => void share()} data-retrograde-share={planet.toLowerCase()}>
        <span>{state === 'copied' ? 'Link copied' : 'Share this retrograde'}</span><span class="orb" aria-hidden="true">↗</span>
      </button>
      <a class="rfy__share-link" href={`/share/retrograde-for-you/?${query}`}>See the card</a>
      {state === 'failed' && <span class="rfy__share-note">The link could not be copied. Open the card and copy its address instead.</span>}
    </div>
  );
}

function PeriodCard({ period, now }: { period: Period; now: number }) {
  const next = !period.retrogradeNow;
  return (
    <article class="rfy__card tile" style={{ '--hue': HUE[period.planet] }} data-planet={period.planet.toLowerCase()}>
      <header class="rfy__head">
        <h3>{period.planet}</h3>
        <span class="rfy__status" data-status={period.status}>{STATUS[period.status]}</span>
      </header>
      <p class="rfy__when">{next ? 'Next retrograde' : 'This retrograde'}: {period.stationRetrograde.label} to {period.stationDirect.label}</p>
      <Timeline period={period} now={now} />
      <div class="rfy__ticks" aria-hidden="true">
        <span>{period.preShadowStart ? `Shadow from ${period.preShadowStart.label}` : ''}</span>
        <span>{period.postShadowEnd ? `Clear on ${period.postShadowEnd.label}` : ''}</span>
      </div>
      <dl class="rfy__facts">
        <div><dt>Turns retrograde</dt><dd>{period.stationRetrograde.label}<span class="rfy__deg">{period.stationRetrograde.position}</span></dd></div>
        <div><dt>Turns direct</dt><dd>{period.stationDirect.label}<span class="rfy__deg">{period.stationDirect.position}</span></dd></div>
        {period.preShadowStart && <div><dt>Pre-shadow begins</dt><dd>{period.preShadowStart.label}</dd></div>}
        {period.postShadowEnd && <div><dt>Post-shadow ends</dt><dd>{period.postShadowEnd.label}</dd></div>}
      </dl>
      {period.houses.length > 0 && (
        <div class="rfy__block">
          <h4>{period.houses.length > 1 ? 'Your houses' : 'Your house'}{period.housesCountedFrom === 'Sun sign' ? ', counted from your Sun sign' : ''}</h4>
          <ul class="rfy__houses">
            {period.houses.map((entry) => (
              <li key={entry.sign}><span class="rfy__house-n" aria-label={`House ${entry.house}`}>{entry.house}</span><span><strong>{SIGN_NAME[entry.sign] ?? entry.sign}</strong>: {entry.theme}</span></li>
            ))}
          </ul>
        </div>
      )}
      {period.contacts.length > 0 && (
        <div class="rfy__block">
          <h4>Natal points the loop crosses</h4>
          <ul class="rfy__contacts">
            {period.contacts.map((entry) => <li key={entry.point}><strong>{entry.point}</strong> <span class="rfy__deg">{entry.position}</span></li>)}
          </ul>
        </div>
      )}
      <p class="rfy__reading">{period.reading}</p>
      <p class="rfy__confidence">{period.confidenceLabel}</p>
      {period.skyDate && (
        <p class="rfy__more">
          <a href={period.planet === 'Mercury' ? '/mercury-retrograde/' : `/retrogrades/#retrograde-${period.planet.toLowerCase()}-${period.skyDate}`}>
            {period.planet === 'Mercury' ? 'Every Mercury retrograde, dated' : `This ${period.planet} retrograde in the full table`}
          </a>
        </p>
      )}
      {period.shareQuery && <ShareButton query={period.shareQuery} planet={period.planet} />}
    </article>
  );
}

export default function RetrogradeForYou() {
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  const [time, setTime] = useState('');
  const [timeKnown, setTimeKnown] = useState(true);
  const [city, setCity] = useState<City | null>(null);
  const [planets, setPlanets] = useState<ReadonlySet<RetrogradePlanet>>(new Set(PLANETS));
  const [result, setResult] = useState<Result | null>(null);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const revision = useRef(0);

  const ready = date !== '' && city !== null && (!timeKnown || time !== '') && planets.size > 0;
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function clear() {
    revision.current += 1;
    setBusy(false); setResult(null); setRefused(false); setError('');
  }

  function toggle(planet: RetrogradePlanet) {
    const next = new Set(planets);
    if (next.has(planet)) next.delete(planet); else next.add(planet);
    clear();
    setPlanets(next);
  }

  async function calculate(event: Event) {
    event.preventDefault();
    if (!ready || busy || !city) return;
    const request = ++revision.current;
    setBusy(true); setError(''); setResult(null); setRefused(false);
    try {
      const { computeRetrogradeForYou, prepareLocalTime } = await loadModule(() => import('./retrograde-for-you/compute'));
      let birthDate = date;
      if (calendarInPlay(date, calendar)) {
        const entry = await birthDateForChart('en', date, calendar);
        if (request !== revision.current) return;
        if ('error' in entry) { setError(entry.error); return; }
        birthDate = entry.date;
      }
      const input = {
        birthDate, birthTime: timeKnown ? time : null, place: { lat: city.lat, lon: city.lon, tz: city.tz },
        planets: PLANETS.filter((planet) => planets.has(planet)), now: new Date(), zone: browserZone(),
      };
      await prepareLocalTime(input.birthDate, input.place.tz);
      if (request !== revision.current) return;
      const outcome = computeRetrogradeForYou(input);
      if (outcome.refused) setRefused(true);
      else setResult(outcome);
    } catch (cause) {
      if (request === revision.current) {
        console.error(cause);
        setError(calculationError(cause, 'en', 'The retrogrades could not be worked out. Check the details and try again.'));
      }
    } finally { if (request === revision.current) setBusy(false); }
  }

  const now = result ? Date.parse(result.now) : 0;
  return (
    <div class="calc rfy" data-retrograde-for-you>
      <form class="calc__form shell" onSubmit={calculate} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <BirthFields
              locale="en" dateId="rfy-date" timeId="rfy-time" placeId="rfy-place"
              date={date} time={time} timeKnown={timeKnown} city={city}
              onDateChange={(value) => { clear(); setDate(value); }}
              calendar={calendar}
              onCalendarChange={(value) => { clear(); setCalendar(value); }}
              onTimeChange={(value) => { clear(); setTime(value); }}
              onTimeKnownChange={(known) => { clear(); setTimeKnown(known); }}
              onCityChange={(value) => { clear(); setCity(value); }}
              requireKnownTime
              timeHelp="With a birth time the houses are counted from your rising sign. Without one they are counted from your Sun sign."
              placeHelp="The birthplace sets the clock your birth time was read on."
            />
          </div>
          <fieldset class="rfy__planets">
            <legend class="field__label">Planets</legend>
            <div class="rfy__chips">
              {PLANETS.map((planet) => (
                <button key={planet} type="button" class="rfy__chip" aria-pressed={planets.has(planet)} style={{ '--hue': HUE[planet] }} onClick={() => toggle(planet)}>
                  <span class="rfy__swatch" aria-hidden="true" />{planet}
                </button>
              ))}
            </div>
          </fieldset>
          <button class="btn btn--primary calc__submit" type="submit" disabled={!ready || busy}><span>{busy ? 'Working it out…' : 'Show my retrogrades'}</span><span class="orb" aria-hidden="true">↗</span></button>
          <p class="calc__privacy"><strong>Private by default.</strong> Everything is worked out on this device. Nothing you enter is uploaded, stored or put in a link.</p>
          {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <CalculationReload error={error} locale="en" />
        </div>
      </form>

      <div class="rfy__result" aria-live="polite">
        {refused && <p class="notice" role="status">{UNDER_13}</p>}
        {result && (
          <>
            <p class="rfy__clock">Read for today on this device’s clock ({result.zone}).</p>
            <div class="rfy__cards">
              {result.periods.map((period) => <PeriodCard key={period.planet} period={period} now={now} />)}
            </div>
            {result.unavailable.length > 0 && (
              <p class="notice">
                {result.unavailable.join(' and ')}: the sky data this page uses runs to {result.dataEnds}, and the next retrograde starts after that, so it is not shown here.
              </p>
            )}
            {result.limits.map((line) => <p class="notice" key={line}>{line}</p>)}
          </>
        )}
      </div>
    </div>
  );
}
