import { useEffect, useRef, useState } from 'preact/hooks';
import { BirthFields, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import PlaceSearch from './PlaceSearch';
import type { City } from '../lib/geo/search';
import type { AcgResult } from './astrocartography/compute';
import { ACG_ANGLES, ACG_BODIES, NOTICEABLE_KM, STRONG_KM, strengthOf, type AcgAngle, type AcgBody, type GeoPoint, type LineDistance } from '../lib/astrocartography/lines';
import { ANGLE_AREA, ANGLE_LABEL, ANGLE_NAME, LINE_MEANING } from '../lib/astrocartography/meanings';
import { loadModule } from '../lib/module-load';
import { astrocartographyShareUrl } from '../lib/astrocartography/share';
import CalculationReload, { calculationError } from './CalculationReload';

/** Each planet drawn in the hue of the sign it rules, the only colour the site uses. */
const HUE: Record<AcgBody, string> = {
  Sun: 'var(--sign-leo)', Moon: 'var(--sign-cancer)', Mercury: 'var(--sign-gemini)', Venus: 'var(--sign-taurus)', Mars: 'var(--sign-aries)',
  Jupiter: 'var(--sign-sagittarius)', Saturn: 'var(--sign-capricorn)', Uranus: 'var(--sign-aquarius)', Neptune: 'var(--sign-pisces)', Pluto: 'var(--sign-scorpio)',
};
const DASH: Record<AcgAngle, string | undefined> = { MC: undefined, IC: '6 4', ASC: undefined, DSC: '1.5 3' };
const MAX_PLACES = 5;
const W = 720;
const H = 360;
const x = (lon: number) => ((lon + 180) / 360) * W;
const y = (lat: number) => ((90 - lat) / 180) * H;

/** A polyline, split wherever it wraps across the date line. */
function paths(points: readonly GeoPoint[]): string[] {
  const out: string[] = [];
  let current = '';
  points.forEach((point, index) => {
    const previous = points[index - 1];
    const jump = previous && Math.abs(point.lon - previous.lon) > 180;
    if (!previous || jump) { if (current) out.push(current); current = `M${x(point.lon).toFixed(1)} ${y(point.lat).toFixed(1)}`; }
    else current += `L${x(point.lon).toFixed(1)} ${y(point.lat).toFixed(1)}`;
  });
  if (current) out.push(current);
  return out;
}

export const UNDER_13 = 'Zodiacs is not directed at children under 13, so it does not draw a map for a birth date less than 13 years ago.';
/** A birth date less than 13 years before today on this device's clock, or still to come. */
export function under13(birthDate: string, now = new Date()): boolean {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return birthDate > `${String(now.getFullYear() - 13).padStart(4, '0')}${today.slice(4)}`;
}

export default function AstrocartographyMap() {
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [result, setResult] = useState<AcgResult | null>(null);
  const [shown, setShown] = useState<ReadonlySet<AcgBody>>(new Set(ACG_BODIES));
  const [places, setPlaces] = useState<{ city: City; lines: LineDistance[] }[]>([]);
  const [adding, setAdding] = useState<City | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const nearest = useRef<((place: GeoPoint, result: AcgResult) => LineDistance[]) | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  // On a phone the map is wider than the screen and pans inside its frame; it opens on the birthplace's longitude.
  useEffect(() => {
    const el = frame.current;
    if (!el || !result || !city || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, ((city.lon + 180) / 360) * el.scrollWidth - el.clientWidth / 2);
  }, [result]);

  async function draw(event: Event) {
    event.preventDefault();
    if (!date || !time || !city) return;
    // Zodiacs is not directed at children under 13: such a birth date draws nothing.
    if (under13(date)) { setResult(null); setPlaces([]); setError(UNDER_13); return; }
    const request = ++revision.current;
    setBusy(true); setError(''); setResult(null); setPlaces([]);
    try {
      const compute = await loadModule(() => import('./astrocartography/compute'));
      let birthDate = date;
      if (calendarInPlay(date, calendar)) {
        const entry = await birthDateForChart('en', date, calendar);
        if ('error' in entry) { setError(entry.error); return; }
        birthDate = entry.date;
      }
      const drawn = await compute.computeAstrocartography({ birthDate, birthTime: time, place: city });
      if (request !== revision.current) return;
      nearest.current = compute.nearestLines;
      setResult(drawn);
    } catch (cause) {
      if (request === revision.current) setError(calculationError(cause, 'en', 'The map could not be drawn. Check the details and try again.'));
    } finally { if (request === revision.current) setBusy(false); }
  }

  function addPlace(next: City | null) {
    setAdding(next);
    if (!next || !result || !nearest.current) return;
    if (places.length >= MAX_PLACES || places.some((entry) => entry.city.name === next.name && entry.city.lat === next.lat)) { setAdding(null); return; }
    setPlaces([...places, { city: next, lines: nearest.current({ lat: next.lat, lon: next.lon }, result) }]);
    setAdding(null);
  }

  const toggle = (body: AcgBody) => { const next = new Set(shown); if (next.has(body)) next.delete(body); else next.add(body); setShown(next); };

  return (
    <div class="calc acg" data-astrocartography>
      <form class="calc__form shell" onSubmit={draw} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <BirthFields
              locale="en" dateId="acg-date" timeId="acg-time" placeId="acg-place"
              date={date} time={time} timeKnown city={city}
              onDateChange={setDate} calendar={calendar} onCalendarChange={setCalendar}
              onTimeChange={setTime} onTimeKnownChange={() => {}} onCityChange={setCity}
              showUnknownTime={false} requireKnownTime
              timeHelp="A birth time is needed: the lines move about 110 km for every 4 minutes."
              placeHelp="The birthplace sets the time zone of the birth time."
            />
          </div>
          <button class="btn btn--primary calc__submit" type="submit" disabled={!date || !time || !city || busy}><span>{busy ? 'Drawing…' : 'Draw my map'}</span><span class="orb" aria-hidden="true">↗</span></button>
          <p class="calc__privacy"><strong>Private by default.</strong> The map is calculated on this device; nothing is uploaded.</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
          <CalculationReload error={error} locale="en" />
        </div>
      </form>

      {result && (
        <section class="acg__result" aria-label="Your astrocartography map">
          <div class="acg__legend" role="group" aria-label="Planets shown">
            {ACG_BODIES.map((body) => (
              <button type="button" key={body} class="acg__chip" aria-pressed={shown.has(body)} onClick={() => toggle(body)} style={{ '--hue': HUE[body] }}>
                <span class="acg__swatch" aria-hidden="true" />{body}
              </button>
            ))}
          </div>
          <figure class="acg__figure">
            <div class="acg__frame" ref={frame} tabIndex={0} aria-label="World map, scrolls sideways on small screens">
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="World map with your planetary lines" class="acg__map">
              <rect width={W} height={H} class="acg__sea" />
              <g class="acg__land">
                {result.land.cells.map(([lat, lon]) => <circle key={`${lat}-${lon}`} cx={x(lon * result.land.cellDegrees - 180 + result.land.cellDegrees / 2)} cy={y(lat * result.land.cellDegrees - 90 + result.land.cellDegrees / 2)} r="1.3" />)}
              </g>
              <g class="acg__grid" aria-hidden="true">
                {[-60, -30, 0, 30, 60].map((lat) => <line key={`lat${lat}`} x1="0" x2={W} y1={y(lat)} y2={y(lat)} />)}
                {[-120, -60, 0, 60, 120].map((lon) => <line key={`lon${lon}`} y1="0" y2={H} x1={x(lon)} x2={x(lon)} />)}
              </g>
              {result.lines.filter((line) => shown.has(line.body)).map((line, index) => (
                <g key={line.body} stroke={HUE[line.body]} class="acg__lines">
                  <line x1={x(line.mc)} x2={x(line.mc)} y1={y(85)} y2={y(-85)} />
                  <line x1={x(line.ic)} x2={x(line.ic)} y1={y(85)} y2={y(-85)} stroke-dasharray={DASH.IC} />
                  {paths(line.asc).map((d) => <path key={`a${d.slice(0, 12)}`} d={d} />)}
                  {paths(line.dsc).map((d) => <path key={`d${d.slice(0, 12)}`} d={d} stroke-dasharray={DASH.DSC} />)}
                  <text x={x(line.mc) + 3} y={y(82 - (index % 3) * 5)} fill={HUE[line.body]} class="acg__label">{line.body}</text>
                </g>
              ))}
              {places.map(({ city: place }) => <circle key={`${place.name}${place.lat}`} cx={x(place.lon)} cy={y(place.lat)} r="3.5" class="acg__place" />)}
            </svg>
            </div>
            <figcaption class="acg__key">
              <span><svg width="24" height="6" aria-hidden="true"><line x1="0" x2="24" y1="3" y2="3" /></svg>Overhead (MC) and rising (ASC)</span>
              <span><svg width="24" height="6" aria-hidden="true"><line x1="0" x2="24" y1="3" y2="3" stroke-dasharray="6 4" /></svg>Underfoot (IC)</span>
              <span><svg width="24" height="6" aria-hidden="true"><line x1="0" x2="24" y1="3" y2="3" stroke-dasharray="1.5 3" /></svg>Setting (DSC)</span>
              <span>Land dots mark towns and cities of 15,000 people or more (GeoNames).</span>
            </figcaption>
          </figure>

          <div class="acg__places">
            <div class="field">
              <label class="field__label" for="acg-check">Check a town or city</label>
              <PlaceSearch key={`check-${places.length}`} id="acg-check" selected={adding} onSelect={addPlace} locale="en" />
              <p class="field__help">Up to {MAX_PLACES} places. Lines within about {STRONG_KM} km are read as strong; by about {NOTICEABLE_KM} km they fade.</p>
            </div>
            {places.map(({ city: place, lines }) => (
              <article class="tile acg__place-card" key={`${place.name}${place.lat}`}>
                <h3>{place.name}<span>{place.admin1 ? `${place.admin1}, ` : ''}{place.country}</span></h3>
                <ul>
                  {lines.filter((row, index) => index < 3 || row.km <= NOTICEABLE_KM).slice(0, 6).map((row) => (
                    <li key={`${row.body}${row.angle}`}>
                      <p class="acg__line-head"><span class="acg__swatch" style={{ '--hue': HUE[row.body] }} aria-hidden="true" />{row.body} {ANGLE_LABEL[row.angle]} <span class="acg__dist">{Math.round(row.km).toLocaleString('en-GB')} km{row.side ? ` ${row.side}` : ''}, {strengthOf(row.km)}</span></p>
                      <p>{LINE_MEANING[row.body][row.angle]}</p>
                      {/* The share link names the line alone: never the birth details or this place. */}
                      <a class="acg__share" href={astrocartographyShareUrl('', { planet: row.body, angle: row.angle })} target="_blank" rel="noopener">Share this line<span aria-hidden="true"> ↗</span></a>
                    </li>
                  ))}
                </ul>
                <button type="button" class="btn btn--ghost" onClick={() => setPlaces(places.filter((entry) => entry.city !== place))}>Remove</button>
              </article>
            ))}
          </div>

          <div class="acg__angles">
            {ACG_ANGLES.map((angle) => <p key={angle}><strong>{ANGLE_LABEL[angle]}</strong> (planet {ANGLE_NAME[angle]}): {ANGLE_AREA[angle]}.</p>)}
          </div>
        </section>
      )}
    </div>
  );
}
