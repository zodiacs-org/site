import { useEffect, useRef, useState } from 'preact/hooks';
import { BirthDateField, birthDateForChart, calendarInPlay, loadBirthCalendar, type CalendarChoice } from './BirthFields';
import PlaceSearch from './PlaceSearch';
import type { City } from '../lib/geo/search';
import { placeDistinctions, placeId } from '../lib/geo/place-label';
import type { AcgResult } from './astrocartography/compute';
import { ACG_ANGLES, ACG_BODIES, NOTICEABLE_KM, STRONG_KM, strengthOf, type AcgAngle, type AcgBody, type GeoPoint, type LineDistance } from '../lib/astrocartography/lines';
import { ACG_CONFIDENCE_TEXT, ANGLE_LABEL, angleArea, ANGLE_NAME, MAP_PICTURE_HELP, MINOR_NOTE, clockChangeLimit, lineTable, placeLines, under18At } from '../lib/astrocartography/meanings';
import { loadModule } from '../lib/module-load';
import { astrocartographyShareUrl } from '../lib/astrocartography/share';
import CalculationReload, { calculationError } from './CalculationReload';
import { birthDateRefusal, birthDateRefusalLang, birthDateRefusalText } from '../lib/birth-date-policy';
import { parseCivilDate } from '../lib/time/civil-date';
import { t } from '../lib/i18n';

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

/**
 * A birth date under 18 on the earliest calendar date anywhere (UTC-12), the
 * day the shared under-13 policy reads: the readings leave out love,
 * attraction and romance, and nobody leaves that care early in any time zone.
 */
export function under18(birthDate: string, now = new Date()): boolean {
  return under18At(birthDate, now);
}

/** The converted birth date, the message for the date field, or null while there is no date to check. */
export type DateCheck = { date: string } | { error: string } | null;

/**
 * The age check for a date the input already holds as a Gregorian date, at once; undefined when the date is
 * written another way and has to be converted first (mapBirthDate).
 */
export function quickDateCheck(date: string, calendar: CalendarChoice, now = new Date()): DateCheck | undefined {
  if (!date) return null;
  // A day the calendar does not have (1990-02-30) is read by the calendar module, which names the problem.
  return calendarInPlay(date, calendar) || !parseCivilDate(date) ? undefined : ageCheck(date, now);
}

/** Zodiacs is not directed at children under 13: a Gregorian birth date under 13, or still to come, draws nothing. */
function ageCheck(birthDate: string, now: Date): { date: string } | { error: string } {
  const refusal = birthDateRefusal(birthDate, now);
  return refusal ? { error: birthDateRefusalText(refusal) } : { date: birthDate };
}

/**
 * The Gregorian date the map would be drawn for, from the date as entered, or
 * the message for the form. The age is read on that date, after a typed or
 * Old Style date is converted, so a date written another way cannot pass the
 * under-13 check and then become a child's date. The check is the shared
 * policy (src/lib/birth-date-policy.ts): a date less than 13 years before the
 * calendar date at UTC-12, or after the calendar date at UTC+14, draws nothing,
 * whatever this device's clock and time zone say.
 */
export async function mapBirthDate(date: string, calendar: CalendarChoice, now = new Date()): Promise<{ date: string } | { error: string }> {
  let birthDate = date;
  if (calendarInPlay(date, calendar) || !parseCivilDate(date)) {
    // A date that is not a real Gregorian day is read as written in the Gregorian calendar, so it is refused there.
    const entry = calendarInPlay(date, calendar) ? await birthDateForChart('en', date, calendar) : (await loadBirthCalendar()).readChartBirthDate('en', date, 'gregorian');
    if ('error' in entry) return { error: entry.error };
    birthDate = entry.date;
  }
  return ageCheck(birthDate, now);
}

const TIME_HELP = 'A birth time is needed: the lines move about 110 km for every 4 minutes.';
const LOCKED_HELP = 'Enter the birth date first.';

interface AcgBirthFieldsProps {
  date: string;
  calendar: CalendarChoice;
  check: DateCheck;
  time: string;
  city: City | null;
  onDateChange: (date: string) => void;
  onCalendarChange: (calendar: CalendarChoice) => void;
  onTimeChange: (time: string) => void;
  onCityChange: (city: City | null) => void;
}

/**
 * The birth date, time and birthplace. The time and the birthplace open only once the date, converted to the
 * Gregorian date the map is drawn for, has passed the age check: a date under 13 or still to come is refused at
 * the date field, and the form never asks for, searches or holds a child's birth time or birthplace.
 */
export function AcgBirthFields({ date, calendar, check, time, city, onDateChange, onCalendarChange, onTimeChange, onCityChange }: AcgBirthFieldsProps) {
  const open = check !== null && 'date' in check;
  const refusal = check !== null && 'error' in check ? check.error : undefined;
  return [
    <BirthDateField
      locale="en" id="acg-date" date={date} city={open ? city : null}
      onDateChange={onDateChange} calendar={calendar} onCalendarChange={onCalendarChange} error={refusal}
    />,
    <div class="field">
      <label class="field__label" for="acg-time">{t('en', 'birthTime')}</label>
      <input
        id="acg-time" class="field__input" type="time" required disabled={!open} value={open ? time : ''}
        aria-describedby="acg-time-help"
        onInput={(e) => onTimeChange((e.target as HTMLInputElement).value)}
      />
      <p id="acg-time-help" class="field__help">{open ? TIME_HELP : `${LOCKED_HELP} ${TIME_HELP}`}</p>
    </div>,
    <div class="field">
      <label class="field__label" for="acg-place">{t('en', 'birthplace')}</label>
      {open
        ? <PlaceSearch id="acg-place" selected={city} onSelect={onCityChange} locale="en" selectionHint={t('en', 'placePickHint')} required wholeIndex distinctLabels />
        : <input id="acg-place" class="field__input" type="text" disabled placeholder={t('en', 'placePlaceholder')} aria-describedby="acg-place-help" />}
      <p id="acg-place-help" class="field__help">The birthplace sets the time zone of the birth time.</p>
    </div>,
  ];
}

export default function AstrocartographyMap() {
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [result, setResult] = useState<AcgResult | null>(null);
  const [minor, setMinor] = useState(false);
  const [shown, setShown] = useState<ReadonlySet<AcgBody>>(new Set(ACG_BODIES));
  const [places, setPlaces] = useState<{ city: City; lines: LineDistance[] }[]>([]);
  const [adding, setAdding] = useState<City | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  // The calendar control and its conversion load with the page, whatever date is entered, so no request tells a date
  // before 1924 from a later one. BirthDateField and birthDateForChart then reuse the module already loaded.
  useEffect(() => { loadBirthCalendar().catch(() => {}); }, []);
  // An edit to the birth details withdraws the map drawn for the old ones and any draw still running, so neither the
  // map nor its place readings stay on screen for details the form now holds differently (or refuses).
  function invalidate() {
    ++revision.current;
    setResult(null); setPlaces([]); setAdding(null); setMinor(false); setBusy(false); setError('');
  }
  const edit = <T,>(set: (value: T) => void) => (value: T) => { invalidate(); set(value); };
  // The date is checked as it is entered: at once for a Gregorian date, after conversion for one written another way.
  const dateKey = `${calendar}|${date}`;
  const quick = quickDateCheck(date, calendar);
  const [converted, setConverted] = useState<{ key: string; check: DateCheck } | null>(null);
  useEffect(() => {
    if (quick !== undefined) return;
    let live = true;
    mapBirthDate(date, calendar).then((entry) => { if (live) setConverted({ key: dateKey, check: entry }); }, () => { if (live) setConverted({ key: dateKey, check: null }); });
    return () => { live = false; };
  }, [dateKey]);
  const check: DateCheck = quick !== undefined ? quick : converted?.key === dateKey ? converted.check : null;
  const dateOpen = check !== null && 'date' in check;
  const refused = check !== null && 'error' in check;
  // A refused date clears a time and birthplace entered for an earlier date, so the form never holds them for it.
  useEffect(() => {
    if (!refused) return;
    if (time) setTime('');
    if (city) setCity(null);
  }, [refused, time, city]);
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
    if (!dateOpen || !time || !city) return;
    const request = ++revision.current;
    setBusy(true); setError(''); setResult(null); setPlaces([]);
    try {
      // The date is converted and its age checked before anything is calculated.
      const entry = await mapBirthDate(date, calendar);
      if (request !== revision.current) return;
      if ('error' in entry) { setError(entry.error); return; }
      const birthDate = entry.date;
      const compute = await loadModule(() => import('./astrocartography/compute'));
      if (request !== revision.current) return;
      const drawn = await compute.computeAstrocartography({ birthDate, birthTime: time, place: city });
      if (request !== revision.current) return;
      nearest.current = compute.nearestLines;
      setMinor(under18(birthDate));
      setResult(drawn);
    } catch (cause) {
      if (request === revision.current) setError(calculationError(cause, 'en', 'The map could not be drawn. Check the details and try again.'));
    } finally { if (request === revision.current) setBusy(false); }
  }

  function addPlace(next: City | null) {
    setAdding(next);
    if (!next || !result || !nearest.current) return;
    if (places.length >= MAX_PLACES || places.some((entry) => placeId(entry.city) === placeId(next))) { setAdding(null); return; }
    setPlaces([...places, { city: next, lines: nearest.current({ lat: next.lat, lon: next.lon }, result) }]);
    setAdding(null);
  }

  const clockNote = result ? clockChangeLimit(result.flags, result.jumpMinutes) : null;
  const toggle = (body: AcgBody) => { const next = new Set(shown); if (next.has(body)) next.delete(body); else next.add(body); setShown(next); };

  return (
    <div class="calc acg" data-astrocartography>
      <form class="calc__form shell" onSubmit={draw} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <AcgBirthFields
              date={date} calendar={calendar} check={check} time={time} city={city}
              onDateChange={edit(setDate)} onCalendarChange={edit(setCalendar)} onTimeChange={edit(setTime)} onCityChange={edit(setCity)}
            />
          </div>
          <button class="btn btn--primary calc__submit" type="submit" disabled={!dateOpen || !time || !city || busy}><span>{busy ? 'Drawing…' : 'Draw my map'}</span><span class="orb" aria-hidden="true">↗</span></button>
          <p class="calc__privacy"><strong>Private by default.</strong> The map is calculated on this device; nothing is uploaded.</p>
          {error && <p class="calc__error" role="alert" lang={birthDateRefusalLang(error)}>{error}</p>}
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
                  <line x1={x(line.mc)} x2={x(line.mc)} y1={y(85)} y2={y(-85)}><title>{line.body} {ANGLE_LABEL.MC}</title></line>
                  <line x1={x(line.ic)} x2={x(line.ic)} y1={y(85)} y2={y(-85)} stroke-dasharray={DASH.IC}><title>{line.body} {ANGLE_LABEL.IC}</title></line>
                  {paths(line.asc).map((d) => <path key={`a${d.slice(0, 12)}`} d={d}><title>{line.body} {ANGLE_LABEL.ASC}</title></path>)}
                  {paths(line.dsc).map((d) => <path key={`d${d.slice(0, 12)}`} d={d} stroke-dasharray={DASH.DSC}><title>{line.body} {ANGLE_LABEL.DSC}</title></path>)}
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
          <p class="field__help">{MAP_PICTURE_HELP}</p>
          {clockNote && <p class="acg__note" role="note">{clockNote}</p>}
          {minor && <p class="acg__note" role="note">{MINOR_NOTE}</p>}

          <table class="acg__table">
            <caption>Where each line runs</caption>
            <thead><tr><th scope="col">Planet</th><th scope="col">Midheaven (overhead)</th><th scope="col">Lower heaven (underfoot)</th></tr></thead>
            <tbody>
              {lineTable(result.lines).map((row) => <tr key={row.planet}><th scope="row">{row.planet}</th><td>{row.mc}</td><td>{row.ic}</td></tr>)}
            </tbody>
          </table>

          <div class="acg__places">
            <div class="field">
              <label class="field__label" for="acg-check">Check a town or city</label>
              <PlaceSearch key={`check-${places.length}`} id="acg-check" selected={adding} onSelect={addPlace} locale="en" wholeIndex distinctLabels />
              <p class="field__help">Up to {MAX_PLACES} places. Lines within about {STRONG_KM} km are read as strong; by about {NOTICEABLE_KM} km they fade.</p>
            </div>
            {places.map(({ city: place, lines }, index) => {
              const reading = placeLines(lines, minor);
              // Two places checked with the same name, region and country show their coordinates too.
              const extra = placeDistinctions(places.map((entry) => entry.city))[index];
              return (
              <article class="tile acg__place-card" key={placeId(place)}>
                <h3>{place.name}<span>{place.admin1 ? `${place.admin1}, ` : ''}{place.country}{extra ? ` (${extra})` : ''}</span></h3>
                {reading.far && <p>{reading.far}</p>}
                {reading.rows.length > 0 && <ul>
                  {reading.rows.map((row) => (
                    <li key={`${row.body}${row.angle}`}>
                      <p class="acg__line-head"><span class="acg__swatch" style={{ '--hue': HUE[row.body] }} aria-hidden="true" />{row.title} <span class="acg__dist">{row.distance}, {strengthOf(row.km)}</span></p>
                      {row.meaning && <p>{row.meaning}</p>}
                      {/* The share link names the line alone: never the birth details or this place. */}
                      <a class="acg__share" href={astrocartographyShareUrl('', { planet: row.body, angle: row.angle })} target="_blank" rel="noopener">Share this line<span aria-hidden="true"> ↗</span></a>
                    </li>
                  ))}
                </ul>}
                <p class="acg__confidence">{ACG_CONFIDENCE_TEXT}</p>
                <button type="button" class="btn btn--ghost" onClick={() => setPlaces(places.filter((entry) => entry.city !== place))}>Remove</button>
              </article>
              );
            })}
          </div>

          <div class="acg__angles">
            {ACG_ANGLES.map((angle) => { const area = angleArea(angle, minor); return <p key={angle}><strong>{ANGLE_LABEL[angle]}</strong> (planet {ANGLE_NAME[angle]}){area ? `: ${area}` : ''}.</p>; })}
          </div>
        </section>
      )}
    </div>
  );
}
