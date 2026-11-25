import { useEffect, useRef, useState } from 'preact/hooks';
import type { CalendarChoice } from './BirthFields';
import { GatedBirthFields, birthDateOpen, checkedBirthDate, useBirthDateCheck } from './GatedBirthFields';
import type { City } from '../lib/geo/search';
import type { RetrogradePlanet, RetrogradeStatus } from '../lib/retrograde-for-you/reading';
import type { RetrogradeForYouOutcome } from './retrograde-for-you/compute';
import { retrogradeForYouShareUrl, retrogradeTablePath } from '../lib/retrograde-for-you/share';
import { loadModule } from '../lib/module-load';
import CalculationReload, { calculationError } from './CalculationReload';
import { birthDateRefusal, FUTURE_BIRTH_DATE_SENTENCE } from '../lib/birth-date-policy';
import { parseCivilDate } from '../lib/time/civil-date';
import { prepareEveryZoneHistory } from '../lib/time/every-zone-history';
import { SKIPPED_BIRTH_DATE, SKIPPED_BIRTH_TIME, SkippedBirthDateError, SkippedBirthTimeError } from '../lib/vedic-signs/clock';

type Result = Exclude<RetrogradeForYouOutcome, { refused: string }>;
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
/**
 * For planets this device's date comes before the sky data can place: never read as direct. A short factual sentence,
 * listed for the owner's wording review.
 */
export const notCoveredSentence = (planets: readonly RetrogradePlanet[], dataStarts: string) =>
  `${planets.join(' and ')}: the sky data this page uses starts on ${dataStarts} and cannot place ${planets.length > 1 ? 'them' : 'it'} on today's date on this device, so ${planets.length > 1 ? 'they are' : 'it is'} not shown here.`;
const UNDER_13 ='Zodiacs is not made for children under 13, so it gives no reading for a birth date less than 13 years ago. Nothing was calculated. If you are 13 or older, enter your own birth date.';
/** The calendar control's own sentence for such a day (BIRTH_CALENDAR_COPY.en.gregorianError), without loading its copy for every locale. */
export const NO_SUCH_DAY = 'There is no such date in the Gregorian calendar.';
const W = 600;

/**
 * The page's sentence for a converted Gregorian birth date it refuses, or null: the shared policy
 * (src/lib/birth-date-policy.ts), which reads today at UTC-12 whatever this device's clock and zone say.
 */
export function retrogradeFormRefusal(birthDate: string, now: Date = new Date()): string | null {
  // A day the calendar does not have (1990-02-30) is refused, whichever calendar was chosen before, so the birth time
  // and birthplace never open for it.
  if (!parseCivilDate(birthDate)) return NO_SUCH_DAY;
  const policy = birthDateRefusal(birthDate, now);
  return policy === null ? null : policy === 'under_13' ? UNDER_13 : FUTURE_BIRTH_DATE_SENTENCE;
}

/**
 * The fixed code logged when a calculation fails: never the exception itself, whose message can carry the
 * birth date, time or place it was given.
 */
export const RETROGRADE_ERROR_CODE = 'retrograde-for-you: calculation-failed';

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

export function ShareButton({ query, planet }: { query: string; planet: RetrogradePlanet }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function share() {
    // The card on the site this page was opened on: a preview shares its own card, which production may not have yet.
    const url = retrogradeForYouShareUrl(window.location.origin, query);
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

export function PeriodCard({ period, now }: { period: Period; now: number }) {
  const when = period.retrogradeNow ? 'This retrograde' : period.status === 'post-shadow' || period.next ? 'Most recent retrograde' : 'Next retrograde';
  return (
    <article class="rfy__card tile" style={{ '--hue': HUE[period.planet] }} data-planet={period.planet.toLowerCase()}>
      <header class="rfy__head">
        <h3>{period.planet}</h3>
        <span class="rfy__status" data-status={period.status}>{STATUS[period.status]}</span>
      </header>
      <p class="rfy__when">{when}: {period.stationRetrograde.label} to {period.stationDirect.label}</p>
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
      {period.reading.split('\n').map((line) => <p class="rfy__reading" key={line}>{line}</p>)}
      <p class="rfy__confidence">{period.confidenceLabel}</p>
      {period.nextLine && <p class="rfy__next">{period.nextLine}</p>}
      {period.skyDate && (
        <p class="rfy__more">
          <a href={retrogradeTablePath(period.planet, period.skyDate)}>
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
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // From the moment the form is sent until the next edit, the result area keeps a screen's height below the form, so
  // a result that arrives after the calculation loads moves nothing that is on screen (zero layout shift).
  const [reserved, setReserved] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const revision = useRef(0);

  // The date is checked as it is entered; the time and birthplace open only once the converted date is accepted.
  const check = useBirthDateCheck(date, calendar, retrogradeFormRefusal);
  const ready = birthDateOpen(check) && city !== null && (!timeKnown || time !== '') && planets.size > 0;
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function clear() {
    revision.current += 1;
    setBusy(false); setResult(null); setRefused(null); setError(''); setReserved(false);
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
    setBusy(true); setError(''); setResult(null); setRefused(null); setReserved(true);
    try {
      // The shared birth date policy (UTC-12) on the converted date, before the calculation loads or any local time
      // or chart is resolved.
      const entry = await checkedBirthDate(date, calendar, retrogradeFormRefusal);
      if (request !== revision.current) return;
      if ('error' in entry) { setRefused(entry.error); return; }
      const birthDate = entry.date;
      const { computeRetrogradeForYou, prepareLocalTime } = await loadModule(() => import('./retrograde-for-you/compute'));
      if (request !== revision.current) return;
      const input = {
        birthDate, birthTime: timeKnown ? time : null, place: { lat: city.lat, lon: city.lon, tz: city.tz },
        planets: PLANETS.filter((planet) => planets.has(planet)), now: new Date(), zone: browserZone(),
      };
      // All sixteen zone history files first, whatever the birth: which file a birth needs, and whether it needs one at
      // all, would tell the host the birthplace's zone group and that the birth is from 1970 or before.
      await prepareEveryZoneHistory();
      await prepareLocalTime(input.birthDate, input.place.tz);
      if (request !== revision.current) return;
      const outcome = computeRetrogradeForYou(input);
      if (outcome.refused) setRefused(outcome.refused === 'under-13' ? UNDER_13 : FUTURE_BIRTH_DATE_SENTENCE);
      else setResult(outcome);
    } catch (cause) {
      // A birth time or date the clock skipped gets its own sentence; anything else the general one, with a fixed error code.
      if (request === revision.current && cause instanceof SkippedBirthTimeError) setError(SKIPPED_BIRTH_TIME);
      else if (request === revision.current && cause instanceof SkippedBirthDateError) setError(SKIPPED_BIRTH_DATE);
      else if (request === revision.current) {
        console.error(RETROGRADE_ERROR_CODE);
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
            <GatedBirthFields
              locale="en" dateId="rfy-date" timeId="rfy-time" placeId="rfy-place"
              date={date} check={check} time={time} timeKnown={timeKnown} city={city}
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
          <button class="btn btn--primary calc__submit" type="submit" disabled={!ready || busy}>
            {/* Both labels share one cell, so the button keeps one width and nothing beside it moves when the label changes. */}
            <span class="rfy__submit-label">
              <span class={busy ? 'is-off' : undefined}>Show my retrogrades</span>
              <span class={busy ? undefined : 'is-off'}>Working it out…</span>
            </span>
            <span class="orb" aria-hidden="true">↗</span>
          </button>
          <p class="calc__privacy"><strong>Private by default.</strong> Everything is worked out on this device. Nothing you enter is uploaded, stored or put in a link.</p>
          {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <CalculationReload error={error} locale="en" />
        </div>
      </form>

      <div class="rfy__result" aria-live="polite" data-reserved={reserved ? '' : undefined}>
        {refused && <p class="notice" role="status">{refused}</p>}
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
            {result.notCovered.length > 0 && (
              <p class="notice" data-not-covered>
                {notCoveredSentence(result.notCovered, result.dataStarts)}
              </p>
            )}
            {result.limits.map((line) => <p class="notice" key={line}>{line}</p>)}
          </>
        )}
      </div>
    </div>
  );
}
