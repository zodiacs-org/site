import { useEffect, useRef, useState } from 'preact/hooks';
import { findStudioCities, localStudioInput, type LocalDraft, type StudioCity } from './local-time';
import type { StudioInput } from './model';

declare const STUDIO_CITIES: StudioCity[];
export function LocalTimeEntry({ input, onApply }: { input: StudioInput; onApply: (input: StudioInput) => void }) {
  const [draft, setDraft] = useState<LocalDraft>({ date: '', time: '', zone: '', latitude: '', longitude: '' });
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof localStudioInput>> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const revision = useRef(0);
  useEffect(() => () => { revision.current++; }, []);
  const cities = place ? [] : findStudioCities(STUDIO_CITIES, query);
  function invalidate() { revision.current++; setResult(null); setError(''); setBusy(false); setNotice(''); }
  function update(key: keyof LocalDraft, value: string) { invalidate(); setDraft(previous => ({ ...previous, [key]: value })); }
  async function review() {
    const id = ++revision.current; setBusy(true); setError(''); setResult(null); setNotice('');
    try { const next = await localStudioInput(draft, input.houseSystem); if (id === revision.current) setResult(next); }
    catch (error) { if (id === revision.current) setError(error instanceof Error ? error.message : 'The local time could not be resolved.'); }
    finally { if (id === revision.current) setBusy(false); }
  }
  return <section class="local-entry" aria-label="Local date and place">
    <h2>Start with local time</h2><p>Choose the place and the clock time recorded there. Review the conversion before updating your chart.</p>
    <form onSubmit={event => { event.preventDefault(); void review(); }} onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); void review(); } }}>
      <label>Local date<input type="date" required min="1800-01-01" max="2199-12-31" value={draft.date} onInput={event => update('date', event.currentTarget.value)} /></label>
      <label>Local time<input type="time" required value={draft.time} onInput={event => update('time', event.currentTarget.value)} /></label>
      <label>Find a city<input type="search" autoComplete="off" placeholder="City or region" value={query} onInput={event => { invalidate(); setPlace(''); setQuery(event.currentTarget.value); setDraft(previous => ({ ...previous, zone: '', latitude: '', longitude: '' })); }} /></label>
      {cities.length > 0 && <ul class="city-results" aria-label="Matching cities">{cities.map(city => <li key={city.label}><button class="quiet" type="button" onClick={() => { invalidate(); setPlace(city.label); setQuery(city.label); setDraft(previous => ({ ...previous, zone: city.zone, latitude: city.latitude, longitude: city.longitude })); }}>{city.label}</button></li>)}</ul>}
      {!place && query.length >= 2 && cities.length === 0 && <p class="form-help" role="status">No match in the bundled city list. Enter the place details below.</p>}
      {place && <p class="form-help" role="status">Selected: {place}. Review or refine its coordinates below.</p>}
      <details class="place-details"><summary>Time zone and coordinates</summary><div class="place-fields">
        <label>Place time zone<input placeholder="Europe/London" value={draft.zone} onInput={event => { setPlace(''); update('zone', event.currentTarget.value); }} /></label>
        <label>Place latitude<input type="number" step="any" min="-89.999999" max="89.999999" value={draft.latitude} onInput={event => { setPlace(''); update('latitude', event.currentTarget.value); }} /></label>
        <label>Place longitude<input type="number" step="any" min="-180" max="180" value={draft.longitude} onInput={event => { setPlace(''); update('longitude', event.currentTarget.value); }} /></label>
      </div></details>
      <p class="form-help">Search covers 1,000 large cities and stays in this panel. Coordinates are city centres rounded to 0.01°. Dates use the Gregorian calendar. If the time is unknown, use the unknown-time option below.</p>
      <button type="button" disabled={busy} onClick={() => void review()}>{busy ? 'Resolving time…' : 'Review local time'}</button>
      {error && <p role="alert" class="error">{error}</p>}
    </form>
    {result && <div class="local-review" aria-live="polite"><h3>Review this instant</h3><p>{result.input.local!.resolution.date} at {result.input.local!.resolution.time} · {result.input.local!.resolution.timeZone}</p><p class="feature-meta">{result.utc}</p>
      {result.input.local!.flags.includes('dst-fold') && <p class="callout">This clock time occurred twice. This conversion uses the earlier occurrence. Confirm it matches your record; use the UTC fields below if you need the later occurrence.</p>}
      {result.input.local!.flags.includes('dst-gap') && <p class="callout">This clock time did not occur because the clocks moved forward. The resolver shifts it forward by {result.input.local!.resolution.gapShiftMinutes} minutes. Check your record before using this instant.</p>}
      {result.input.local!.resolution.clock === 'local-mean-time' && <p class="callout">Before standard time, the place’s longitude determines its local mean time. The calculation record preserves this assumption.</p>}
      {result.zoneUncertain && <p class="callout">Pinned historical data is unavailable for this zone. This conversion uses this browser’s time-zone history; verify the historical clock before relying on it.</p>}
      <p>The converted instant and time-zone assumptions are included in your downloaded record. This step does not share them with the assistant.</p>
      <button type="button" onClick={() => { onApply({ ...result.input, houseSystem: input.houseSystem }); setResult(null); setNotice('Chart updated from the reviewed local time.'); }}>Use this instant</button>
    </div>}
    <p role="status">{notice}</p><p class="city-credit">City data: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Population-ranked subset of the site’s city index.</p>
  </section>;
}
