/**
 * "The sky on…": a keepsake card for a wedding, a birthday, a new home or
 * another day, from a date, an optional time and an optional place. Computed
 * on the device behind the lazy engine import; the card's link carries its
 * inputs, so nothing is stored anywhere.
 */
import { signIcon } from '../lib/sign-icon';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { City } from '../lib/geo/search';
import { OCCASION_KINDS, OCCASION_LABELS, type OccasionKind } from '../lib/occasions/kinds';
import type { OccasionCard } from '../lib/occasions/card';
import PlaceSearch from './PlaceSearch';
import { BRAND_ICON_PATHS } from '../lib/brand-icons.mjs';

const loadCard = () => Promise.all([import('../lib/occasions/card'), import('../lib/occasions/site-clock')]);
const NAMES_MAX = 60;

function signName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function clock(iso: string | null | undefined, timeZone: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timeZone ?? 'UTC' }).format(new Date(iso));
}

function longDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function placeLabel(city: City): string {
  return [city.name, city.country].filter(Boolean).join(', ');
}

function readLink(): { occasion: OccasionKind; names: string; date: string; time: string; city: City | null } | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const date = params.get('d');
  if (!date) return null;
  const occasion = (OCCASION_KINDS as readonly string[]).includes(params.get('o') ?? '') ? params.get('o') as OccasionKind : 'wedding';
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  const tz = params.get('tz');
  const city = tz && params.get('lat') !== null && params.get('lon') !== null && Number.isFinite(lat) && Number.isFinite(lon)
    ? { name: params.get('place') ?? '', admin1: '', country: '', lat, lon, tz, pop: 0 }
    : null;
  return { occasion, names: (params.get('n') ?? '').slice(0, NAMES_MAX), date, time: params.get('t') ?? '', city };
}

function cardLink(occasion: OccasionKind, names: string, date: string, time: string, city: City | null): string {
  const params = new URLSearchParams({ o: occasion, d: date });
  if (names.trim()) params.set('n', names.trim());
  if (time) params.set('t', time);
  if (city) {
    params.set('tz', city.tz);
    params.set('lat', city.lat.toFixed(4));
    params.set('lon', city.lon.toFixed(4));
    params.set('place', placeLabel(city));
  }
  // After the #, so the names, date and place never reach the server.
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export default function OccasionSky() {
  const [occasion, setOccasion] = useState<OccasionKind>('wedding');
  const [names, setNames] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [card, setCard] = useState<OccasionCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  // What the card on screen was made from, so a copied link always opens that card.
  const [shown, setShown] = useState<{ occasion: OccasionKind; names: string; date: string; time: string; city: City | null } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  async function compute(next: { occasion: OccasionKind; names: string; date: string; time: string; city: City | null }) {
    setBusy(true);
    setError('');
    try {
      const [{ occasionCard }, { SITE_CLOCK }] = await loadCard();
      const result = await occasionCard({
        occasion: next.occasion,
        date: next.date,
        time: next.time || null,
        timeZone: next.city?.tz ?? null,
        place: next.city ? { name: placeLabel(next.city), lat: next.city.lat, lon: next.city.lon } : null,
      }, SITE_CLOCK);
      setCard(result);
      setShown(next);
      requestAnimationFrame(() => cardRef.current?.focus());
    } catch (cause) {
      setCard(null);
      setShown(null);
      setError(cause instanceof RangeError ? cause.message : 'The sky could not be worked out for that date. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const linked = readLink();
    if (!linked) return;
    setOccasion(linked.occasion);
    setNames(linked.names);
    setDate(linked.date);
    setTime(linked.time);
    setCity(linked.city);
    void compute(linked);
  }, []);

  function submit(event: Event) {
    event.preventDefault();
    if (time && !city) {
      setError('Add the place too: a time only makes sense with its time zone.');
      return;
    }
    void compute({ occasion, names, date, time, city });
  }

  async function copyLink() {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(cardLink(shown.occasion, shown.names, shown.date, shown.time, shown.city));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('The link could not be copied. Copy it from the address bar instead.');
    }
  }

  const tz = card?.input.timeZone ?? null;
  const sun = card?.sky.bodies.find((row) => row.body === 'Sun');
  const moon = card?.sky.bodies.find((row) => row.body === 'Moon');
  const evening = card?.evening;
  const retro = card?.sky.retrograde ?? [];
  const sub = card ? [
    longDate(card.input.date),
    card.input.place?.name,
    card.input.time ? card.input.time : null,
  ].filter(Boolean).join(' · ') : '';

  return (
    <div class="calc occasion">
      <form class="calc__form shell" onSubmit={submit} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <div class="field">
              <label class="field__label" for="oc-kind">Occasion</label>
              <select id="oc-kind" class="field__input" value={occasion} onChange={(event) => setOccasion((event.target as HTMLSelectElement).value as OccasionKind)}>
                {OCCASION_KINDS.map((kind) => <option value={kind} key={kind}>{OCCASION_LABELS[kind]}</option>)}
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="oc-names">Names on the card <span class="field__optional">optional</span></label>
              <input id="oc-names" class="field__input" type="text" maxLength={NAMES_MAX} value={names} placeholder="Ana & Luca"
                onInput={(event) => setNames((event.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field__label" for="oc-date">Date</label>
              <input id="oc-date" class="field__input" type="date" required min="1800-01-01" max="2199-12-31" value={date}
                onInput={(event) => setDate((event.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field__label" for="oc-time">Time <span class="field__optional">optional</span></label>
              <input id="oc-time" class="field__input" type="time" value={time}
                onInput={(event) => setTime((event.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field__label" for="oc-place">Place <span class="field__optional">optional</span></label>
              <PlaceSearch id="oc-place" selected={city} onSelect={setCity} locale="en" />
              <p class="field__help">With a place, the card adds sunset, golden hour, the Moon and the planets you can see that evening.</p>
            </div>
          </div>
          <button class="btn btn--primary calc__submit" type="submit" disabled={!date || busy}>
            {busy ? 'Working out the sky…' : 'Make the card'}
          </button>
          <p class="calc__privacy">Worked out on your device. Nothing you enter is stored.</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
        </div>
      </form>

      {card && sun && moon && (
        <div class="calc__result">
          <div class="occasion-card" ref={cardRef} tabIndex={-1} aria-label={card.words.title}>
            {shown?.names.trim() ? <p class="kicker occasion-card__kicker">{shown.names.trim()}</p> : null}
            <h2 class="occasion-card__title">{card.words.title}</h2>
            <p class="occasion-card__sub">{sub}</p>
            <div class="occasion-card__discs">
              <div class="occasion-card__disc">
                <img src={signIcon(128, sun.sign)} width={64} height={64} alt="" />
                <div><strong>{signName(sun.sign)} Sun</strong><span>{sun.degree.toFixed(1)}°</span></div>
              </div>
              <div class="occasion-card__disc">
                <img src={signIcon(128, moon.sign)} width={64} height={64} alt="" />
                <div>
                  <strong>{card.moonSignChange ? `${signName(card.moonSignChange.from)} → ${signName(card.moonSignChange.to)} Moon` : `${signName(moon.sign)} Moon`}</strong>
                  <span>{card.sky.moon.phase.toLowerCase()} · {card.sky.moon.illuminationPercent}% lit</span>
                </div>
              </div>
            </div>
            <dl class="occasion-card__rows">
              {evening?.goldenHour && <div><dt>Golden hour</dt><dd>{clock(evening.goldenHour.start, tz)} – {clock(evening.goldenHour.end, tz)}</dd></div>}
              {evening?.sunset && <div><dt>Sunset</dt><dd>{clock(evening.sunset, tz)}</dd></div>}
              {evening?.civilDusk && <div><dt>Dusk</dt><dd>{clock(evening.civilDusk, tz)}</dd></div>}
              {evening?.moon.highest && evening.moon.highest.altitude > 0 && (
                <div><dt>Moon at its highest</dt><dd>{clock(evening.moon.highest.at, tz)} · {evening.moon.highest.altitude}° up</dd></div>
              )}
              {evening && evening.planetsAfterDusk.length > 0 && <div><dt>Bright after dark</dt><dd>{list(evening.planetsAfterDusk)}</dd></div>}
              {evening?.flags.includes('sun-never-sets') && <div><dt>The Sun</dt><dd>does not set that day</dd></div>}
              {retro.length > 0 && <div><dt>Also that day</dt><dd>{list(retro)} retrograde</dd></div>}
            </dl>
            <p class="occasion-card__note">{card.words.interpretation} {card.words.closing}</p>
            <p class="occasion-card__foot"><span>zodiacs.org/occasions</span><span class="occasion-card__brand"><img src={BRAND_ICON_PATHS.favicon} width={24} height={24} alt="" />Zodiacs.org</span></p>
          </div>
          <div class="calc__actions occasion__actions">
            <button type="button" class="btn" onClick={() => window.print()}>Print the card</button>
            <button type="button" class="btn" onClick={copyLink}>{copied ? 'Link copied' : 'Copy the card’s link'}</button>
          </div>
          {card.moonSignChange && (
            <p class="field__help">The Moon changes sign that day. Add the time to pin it down.</p>
          )}
        </div>
      )}
    </div>
  );
}
