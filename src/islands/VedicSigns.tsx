import { useEffect, useRef, useState } from 'preact/hooks';
import { BirthFields, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import type { City } from '../lib/geo/search';
import type { VedicReading, VedicSign } from '../lib/vedic-signs/reading';
import { UNDER_13_MESSAGE, isUnder13 } from '../lib/vedic-signs/reading';
import { AYANAMSA_NAME, VEDIC_AYANAMSAS, type VedicAyanamsa } from '../lib/vedic-signs/wording';
import { VEDIC_SIGNS_SHARE_PATH, vedicSignsShareQuery } from '../lib/vedic-signs/share';
import { SIGNS } from '../lib/signs';
import { signIcon } from '../lib/sign-icon';
import { loadModule } from '../lib/module-load';
import CalculationReload, { calculationError } from './CalculationReload';

const signName = (slug: string) => SIGNS.find((sign) => sign.slug === slug)?.name ?? slug;
const AYANAMSA_HELP: Record<VedicAyanamsa, string> = {
  lahiri: 'The Indian government standard, and the one most Vedic astrologers use.',
  raman: 'B. V. Raman’s zodiac, about a degree and a half behind Lahiri.',
  krishnamurti: 'The zodiac of the Krishnamurti Paddhati (KP) system, a few minutes from Lahiri.',
  'fagan-bradley': 'The Western sidereal standard, about a degree ahead of Lahiri.',
  yukteswar: 'Sri Yukteswar’s zodiac, from The Holy Science.',
  'true-chitra': 'Lahiri’s idea held exactly: the star Spica at 0 degrees Libra on the day.',
};

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function degrees(value: number): string {
  const whole = Math.floor(value);
  const minutes = Math.floor((value - whole) * 60);
  return `${whole}°${String(minutes).padStart(2, '0')}′`;
}

function Placement({ title, sign, missing }: { title: string; sign: VedicSign | null; missing: string }) {
  if (!sign) {
    return (
      <article class="tile vedic__card vedic__card--open">
        <p class="vedic__body">{title}</p>
        <span class="vedic__disc vedic__disc--open" aria-hidden="true" />
        <h3 class="vedic__sign">Not settled</h3>
        <p class="vedic__line">{missing}</p>
      </article>
    );
  }
  return (
    <article class="tile vedic__card" style={{ '--sign': `var(--sign-${sign.sign})` }}>
      <p class="vedic__body">{title}</p>
      <img class="vedic__disc" src={signIcon(128, sign.sign)} width={56} height={56} alt="" decoding="async" />
      <h3 class="vedic__sign">{sign.rashi} <span>{signName(sign.sign)}</span></h3>
      <p class="vedic__facts"><span class="mono">{degrees(sign.degree)}</span> in {sign.rashi}. Western sign: {signName(sign.tropicalSign)}.</p>
      <p class="vedic__line">{sign.line.slice(sign.line.indexOf(':') + 2)}</p>
    </article>
  );
}

export default function VedicSigns() {
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  const [time, setTime] = useState('');
  const [timeKnown, setTimeKnown] = useState(true);
  const [city, setCity] = useState<City | null>(null);
  const [ayanamsa, setAyanamsa] = useState<VedicAyanamsa>('lahiri');
  const [result, setResult] = useState<VedicReading | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shared, setShared] = useState<'idle' | 'copied' | 'failed'>('idle');
  const revision = useRef(0);
  const resultRef = useRef<HTMLElement>(null);
  const ready = date !== '' && city !== null && (!timeKnown || time !== '');

  function reset() { revision.current += 1; setResult(null); setError(''); setShared('idle'); setBusy(false); }

  useEffect(() => { if (result) resultRef.current?.focus({ preventScroll: true }); }, [result]);

  async function calculate(event: Event) {
    event.preventDefault();
    if (!ready || !city || busy) return;
    const request = ++revision.current;
    setBusy(true); setError(''); setResult(null); setShared('idle');
    try {
      let birthDate = date;
      if (calendarInPlay(date, calendar)) {
        const entry = await birthDateForChart('en', date, calendar);
        if (request !== revision.current) return;
        if ('error' in entry) { setError(entry.error); return; }
        birthDate = entry.date;
      }
      // Under 13: say so, and work nothing out.
      if (isUnder13(birthDate, todayLocal())) { setError(UNDER_13_MESSAGE); return; }
      const { computeVedicFromForm, prepareLocalTime } = await loadModule(() => import('./vedic-signs/compute'));
      const input = { birthDate, birthTime: timeKnown ? time : null, place: { tz: city.tz, lat: city.lat, lon: city.lon }, ayanamsa };
      await prepareLocalTime(input.birthDate, input.place.tz);
      if (request !== revision.current) return;
      const reading = await computeVedicFromForm(input);
      if (request !== revision.current) return;
      setResult(reading);
    } catch (cause) {
      if (request === revision.current) setError(calculationError(cause, 'en', 'Your Vedic signs could not be worked out. Check the details and try again.'));
    } finally {
      if (request === revision.current) setBusy(false);
    }
  }

  const query = result ? vedicSignsShareQuery(result) : null;
  const shareUrl = query ? `${typeof location === 'undefined' ? 'https://zodiacs.org' : location.origin}${VEDIC_SIGNS_SHARE_PATH}?${query}` : null;

  async function share() {
    if (!shareUrl) return;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'My Vedic signs on Zodiacs', text: 'My Sun, Moon and rising signs in the sidereal zodiac.', url: shareUrl }); return; } catch (cause) {
        if ((cause as DOMException)?.name === 'AbortError') return;
      }
    }
    try { await navigator.clipboard.writeText(shareUrl); setShared('copied'); } catch { setShared('failed'); }
  }

  const unsettledMoon = result && !result.moon ? `The Moon changed sign that day: ${result.moonCandidates.join(' or ')}. A birth time settles it.` : '';

  return (
    <div class="calc vedic" data-vedic-signs>
      <form class="calc__form shell" onSubmit={calculate} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <BirthFields
              locale="en" dateId="vedic-date" timeId="vedic-time" placeId="vedic-place"
              date={date} time={time} timeKnown={timeKnown} city={city}
              onDateChange={(value) => { reset(); setDate(value); }}
              calendar={calendar} onCalendarChange={(value) => { reset(); setCalendar(value); }}
              onTimeChange={(value) => { reset(); setTime(value); }}
              onTimeKnownChange={(known) => { reset(); setTimeKnown(known); }}
              onCityChange={(value) => { reset(); setCity(value); }}
              requireKnownTime
              timeHelp="The rising sign (lagna) needs the birth time. Without it, the Moon is given only when the whole day keeps it in one sign."
              placeHelp="The birthplace sets the clock of the birth time and, with the time, the rising sign."
            />
            <div class="field">
              <label class="field__label" for="vedic-ayanamsa">Ayanamsa (sidereal zodiac)</label>
              <select id="vedic-ayanamsa" class="field__input" value={ayanamsa} onChange={(event) => { reset(); setAyanamsa((event.target as HTMLSelectElement).value as VedicAyanamsa); }}>
                {VEDIC_AYANAMSAS.map((name) => <option key={name} value={name}>{AYANAMSA_NAME[name]}</option>)}
              </select>
              <p class="field__help">{AYANAMSA_HELP[ayanamsa]}</p>
            </div>
          </div>
          <button class="btn btn--primary calc__submit" type="submit" disabled={!ready || busy}><span>{busy ? 'Working out…' : 'Find my Vedic signs'}</span><span class="orb" aria-hidden="true">↗</span></button>
          <p class="calc__privacy"><strong>Private by default.</strong> Your signs are worked out on this device; nothing is uploaded or stored.</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
          <CalculationReload error={error} locale="en" />
        </div>
      </form>

      {result && (
        <section class="vedic__result" aria-labelledby="vedic-result-title" tabIndex={-1} ref={resultRef}>
          <div class="vedic__head">
            <h2 id="vedic-result-title" class="display">Your Vedic signs</h2>
            <p>Read with the {result.ayanamsa.label} ayanamsa: <span class="mono">{result.ayanamsa.degrees.toFixed(4)}°</span> on your birth date. Vedic signs are counted from the stars, which have drifted about 24 degrees from the Western signs since they were last lined up, so each placement usually sits one sign behind its Western sign.</p>
          </div>

          <div class="vedic__grid">
            <Placement title="Sun (soul and self)" sign={result.sun} missing={`The Sun changed sign that day: ${result.sunCandidates.join(' or ')}. A birth time settles it.`} />
            <Placement title="Moon sign (rashi)" sign={result.moon} missing={unsettledMoon} />
            <Placement title="Rising sign (lagna)" sign={result.rising} missing={result.timeKnown ? 'The rising sign needs the birthplace.' : 'The rising sign needs the birth time: it changes sign about every two hours.'} />
          </div>

          <article class="tile vedic__card vedic__nakshatra">
            <p class="vedic__body">Moon nakshatra (lunar mansion)</p>
            {result.moonNakshatra ? (
              <>
                <h3 class="vedic__sign">{result.moonNakshatra.name} <span>nakshatra {result.moonNakshatra.number} of 27</span></h3>
                <dl class="vedic__facts-list">
                  <div><dt>Pada</dt><dd class="mono">{result.moonNakshatra.pada} of 4</dd></div>
                  <div><dt>Lord</dt><dd>{result.moonNakshatra.lord}</dd></div>
                  <div><dt>Deity</dt><dd>{result.moonNakshatra.deity}</dd></div>
                  <div><dt>Symbol</dt><dd>{result.moonNakshatra.symbol}</dd></div>
                </dl>
                <p class="vedic__line">{result.moonNakshatra.line.slice(result.moonNakshatra.line.indexOf('symbol. ') + 8)}</p>
              </>
            ) : (
              <>
                <h3 class="vedic__sign">Not settled</h3>
                <p class="vedic__line">The Moon changed nakshatra that day: {result.nakshatraCandidates.join(' or ')}. A birth time settles it.</p>
              </>
            )}
          </article>

          {result.limits.length > 0 && (
            <div class="vedic__limits">
              <h3>What these details cannot settle</h3>
              <ul>{result.limits.map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
          )}

          <p class="vedic__confidence mono">{result.confidenceLabel}</p>

          <div class="vedic__share">
            {shareUrl ? (
              <>
                <button type="button" class="btn btn--primary" onClick={share}><span>Share my Vedic signs</span><span class="orb" aria-hidden="true">↗</span></button>
                <a class="btn btn--ghost" href={`${VEDIC_SIGNS_SHARE_PATH}?${query}`}>Open the share card</a>
                <p class="vedic__share-note" role="status">
                  {shared === 'copied' ? 'Link copied.' : shared === 'failed' ? 'The link could not be copied. Open the share card and copy its address.' : 'The link carries only your signs, the nakshatra and the ayanamsa: never your birth date, time or place.'}
                </p>
              </>
            ) : (
              <p class="vedic__share-note">The Sun changed sign on that day, so there is no card to share until a birth time settles it.</p>
            )}
          </div>

          <p class="vedic__more">For the Western zodiac, see your <a href="/moon-sign/">Moon sign</a>, your <a href="/big-three/">big three</a> or your whole <a href="/birth-chart/">birth chart</a>.</p>
        </section>
      )}
    </div>
  );
}
