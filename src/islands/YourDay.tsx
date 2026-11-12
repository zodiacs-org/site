import { useEffect, useRef, useState } from 'preact/hooks';
import { BirthFields, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import CalculationReload, { calculationError } from './CalculationReload';
import { CopyLinkButton, type CopyLinkState } from './CopyLinkButton';
import type { City } from '../lib/geo/search';
import { loadModule } from '../lib/module-load';
import { dateOn, dayLabel, daysBetween, shiftDate } from '../lib/personal-day/clock';
import { BODY_SIGN, pointName } from '../lib/personal-day/score';
import { yourDayShareUrl } from '../lib/personal-day/share';
import type { PersonalDayReading } from '../lib/personal-day/day';
import type { TransitBody } from '../lib/engine/transit-scan-shared';
import { SIGNS } from '../lib/signs';

/** How far from today a day may be read, either side, as the get_personal_day tool allows. */
const MAX_DAYS = 366;
const UNDER_13 = 'Zodiacs is not directed at children under 13, so it gives no reading for a birth date less than 13 years ago. Nothing was worked out.';

/** A birth date less than 13 years before today (both YYYY-MM-DD), or one still to come. */
const under13 = (birthDate: string, today: string) => birthDate > `${String(Number(today.slice(0, 4)) - 13).padStart(4, '0')}${today.slice(4)}`;
const signName = (slug: string) => SIGNS.find((sign) => sign.slug === slug)?.name ?? slug;
const hue = (planet: TransitBody) => `var(--sign-${BODY_SIGN[planet]})`;

/** The browser's own clock: its zone and today's date there. */
function deviceClock(): { zone: string; today: string } {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return { zone, today: dateOn(new Date(), zone) };
  } catch {
    return { zone: 'UTC', today: new Date().toISOString().slice(0, 10) };
  }
}

interface Shown { reading: PersonalDayReading; shareUrl: string | null }

export default function YourDay() {
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  const [time, setTime] = useState('');
  const [timeKnown, setTimeKnown] = useState(true);
  const [city, setCity] = useState<City | null>(null);
  const [clock, setClock] = useState<{ zone: string; today: string } | null>(null);
  const [day, setDay] = useState('');
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copy, setCopy] = useState<CopyLinkState>('idle');
  const revision = useRef(0);
  const resultRef = useRef<HTMLElement>(null);

  // The day defaults to today on this device's clock, read after the page loads so the server's clock never shows.
  useEffect(() => {
    const now = deviceClock();
    setClock(now);
    setDay((current) => current || now.today);
  }, []);

  const ready = date !== '' && city !== null && (!timeKnown || time !== '') && day !== '' && clock !== null;
  const minDay = clock ? shiftDate(clock.today, -MAX_DAYS) : undefined;
  const maxDay = clock ? shiftDate(clock.today, MAX_DAYS) : undefined;

  function clear() {
    revision.current += 1;
    setShown(null);
    setError('');
    setBusy(false);
  }

  async function read(target: string, scroll: boolean) {
    if (!ready || !clock || !city) return;
    const request = ++revision.current;
    setBusy(true);
    setError('');
    setCopy('idle');
    try {
      let birthDate = date;
      if (calendarInPlay(date, calendar)) {
        const entry = await birthDateForChart('en', date, calendar);
        if (request !== revision.current) return;
        if ('error' in entry) { setError(entry.error); setShown(null); return; }
        birthDate = entry.date;
      }
      if (under13(birthDate, clock.today)) { setError(UNDER_13); setShown(null); return; }
      if (Math.abs(daysBetween(clock.today, target)) > MAX_DAYS) { setError(`Choose a day within ${MAX_DAYS} days of today.`); setShown(null); return; }
      if (target < birthDate) { setError('Choose a day on or after the birth date.'); setShown(null); return; }
      const { computeYourDay } = await loadModule(() => import('./your-day/compute'));
      const reading = await computeYourDay({
        birthDate, time: timeKnown ? time : undefined, birthZone: city.tz, latitude: city.lat, longitude: city.lon,
        date: target, zone: clock.zone, today: clock.today,
      });
      if (request !== revision.current) return;
      setDay(target);
      setShown({ reading, shareUrl: yourDayShareUrl(window.location.origin, { date: reading.date, contact: reading.contacts[0] }) });
      if (scroll) requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    } catch (cause) {
      if (request !== revision.current) return;
      console.error(cause);
      setShown(null);
      setError(calculationError(cause, 'en', 'The day could not be read. Check the details and try again.'));
    } finally {
      if (request === revision.current) setBusy(false);
    }
  }

  const reading = shown?.reading ?? null;
  const top = reading?.contacts[0] ?? null;

  return (
    <div class="calc yd" data-your-day>
      <form class="calc__form shell" onSubmit={(event) => { event.preventDefault(); void read(day, true); }} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <BirthFields
              locale="en" dateId="yd-date" timeId="yd-time" placeId="yd-place"
              date={date} time={time} timeKnown={timeKnown} city={city}
              onDateChange={(value) => { clear(); setDate(value); }}
              calendar={calendar} onCalendarChange={(value) => { clear(); setCalendar(value); }}
              onTimeChange={(value) => { clear(); setTime(value); }}
              onTimeKnownChange={(known) => { clear(); setTimeKnown(known); }}
              onCityChange={(value) => { clear(); setCity(value); }}
              timeHelp="Without a birth time the natal Moon, rising degree and Midheaven are left out."
              placeHelp="The birthplace sets the clock the birth time was read on."
            />
            <div class="field">
              <label class="field__label" for="yd-day">Day to read</label>
              <input id="yd-day" class="field__input" type="date" required value={day} min={minDay} max={maxDay}
                onInput={(event) => { clear(); setDay((event.target as HTMLInputElement).value); }} />
              <p class="field__help yd__clock">Times are on this device’s clock{clock ? ` (${clock.zone.replaceAll('_', ' ')})` : ''}.</p>
            </div>
          </div>
          <button class="btn btn--primary calc__submit" type="submit" disabled={!ready || busy}><span>{busy ? 'Reading…' : 'Read my day'}</span><span class="orb" aria-hidden="true">↗</span></button>
          <p class="calc__privacy"><strong>Private by default.</strong> Your day is worked out on this device; nothing is uploaded or kept.</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
          <CalculationReload error={error} locale="en" />
        </div>
      </form>

      {(reading || (busy && !shown)) && (
        <section class="yd__result" ref={resultRef} aria-live="polite" aria-busy={busy} aria-label="Your day">
          {reading && (
            <>
              <div class="yd__head">
                <button type="button" class="btn btn--ghost yd__step" disabled={busy || reading.date <= (minDay ?? '') || reading.date <= date} onClick={() => void read(shiftDate(reading.date, -1), false)} aria-label="Read the day before">
                  <span aria-hidden="true">←</span><span class="yd__step-word">Previous day</span>
                </button>
                <p class="yd__date">{reading.dayLabel}</p>
                <button type="button" class="btn btn--ghost yd__step" disabled={busy || reading.date >= (maxDay ?? '')} onClick={() => void read(shiftDate(reading.date, 1), false)} aria-label="Read the day after">
                  <span class="yd__step-word">Next day</span><span aria-hidden="true">→</span>
                </button>
              </div>
              <p class="yd__theme display">{reading.theme}</p>

              <div class="tile yd__moon" style={{ '--hue': 'var(--sign-cancer)' }}>
                <p class="kicker">The Moon {reading.date === clock?.today ? 'today' : 'that day'}</p>
                <p class="yd__moon-sign">Moon in {signName(reading.moon.sign)}{reading.moon.house ? <span class="yd__mono"> · your {reading.moon.house.number}{['', 'st', 'nd', 'rd'][reading.moon.house.number] ?? 'th'} house</span> : null}</p>
                <p>{reading.moon.line}</p>
              </div>

              {reading.contacts.length > 0 ? (
                <ol class="yd__contacts">
                  {reading.contacts.map((contact) => (
                    <li class="tile yd__contact" key={`${contact.planet}${contact.aspect}${contact.point}`} style={{ '--hue': hue(contact.planet) }}>
                      <div class="yd__contact-head">
                        <span class="yd__swatch" aria-hidden="true" />
                        <h3>{contact.title}</h3>
                      </div>
                      <p class="yd__when">
                        {contact.exactLocal ? `Exact at ${contact.exactLocal}` : contact.applying ? 'Applying' : 'Separating'}
                        <span>{contact.orb.toFixed(2)}° orb at midday</span>
                      </p>
                      <p class="yd__line">{contact.line.slice(0, contact.line.length - contact.confidenceLabel.length - 1).trim()}</p>
                      <p class="yd__confidence">{contact.confidenceLabel}</p>
                    </li>
                  ))}
                </ol>
              ) : <p class="yd__none">No moving planet is within orb of your chart on this day.</p>}

              {reading.limits.length > 0 && (
                <ul class="yd__limits">{reading.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
              )}

              {shown?.shareUrl && top && (
                <div class="yd__share">
                  <p class="kicker">Share the day</p>
                  <p class="field__help">The card shows the day and its strongest contact, {top.planet} {top.aspect} your {pointName(top.point)}. It never shows your birth date, time or place.</p>
                  <div class="yd__share-actions">
                    <a class="btn btn--glass" href={shown.shareUrl} target="_blank" rel="noopener" data-your-day-share><span>Share my day</span><span class="orb" aria-hidden="true">↗</span></a>
                    <CopyLinkButton url={shown.shareUrl} state={copy} onStateChange={setCopy} idleLabel="Copy the link" copiedLabel="Link copied" ariaLabel="Copy the share link" buttonClass="btn btn--ghost" dataHook="share" />
                  </div>
                </div>
              )}
            </>
          )}
          {busy && !reading && <p class="yd__pending">Reading {day ? dayLabel(`${day}T12:00:00Z`, 'UTC') : 'the day'}…</p>}
        </section>
      )}
    </div>
  );
}
