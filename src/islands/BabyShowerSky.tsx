/**
 * Baby-shower card: the Sun's signs across the due-date window, the day it
 * changes sign, and the full and new moons in the window, with a guessing
 * game for guests. Facts only: no "most likely" sign and nothing about the
 * baby. Worked out on the device; nothing is stored.
 */
import { signIcon } from '../lib/sign-icon';
import { useEffect, useState } from 'preact/hooks';
import type { DueWindow } from '../lib/occasions/due-window';
import { BRAND_ICON_PATHS } from '../lib/brand-icons.mjs';

const loadWindow = () => import('../lib/occasions/due-window');
const NAMES_MAX = 60;

function signName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function dayMonth(isoDay: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${isoDay}T12:00:00Z`));
}

function shortDay(isoDay: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${isoDay}T12:00:00Z`));
}

function utcClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(iso));
}

const DAY = 86_400_000;
const spanDays = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;

export default function BabyShowerSky() {
  const [due, setDue] = useState('');
  const [names, setNames] = useState('');
  const [window_, setWindow] = useState<DueWindow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function compute(date: string) {
    setBusy(true);
    setError('');
    try {
      const { dueWindow } = await loadWindow();
      setWindow(dueWindow(date));
    } catch (cause) {
      setWindow(null);
      setError(cause instanceof RangeError ? cause.message : 'The sky could not be worked out for that date. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const linked = params.get('due');
    if (!linked) return;
    setDue(linked);
    setNames((params.get('n') ?? '').slice(0, NAMES_MAX));
    void compute(linked);
  }, []);

  const total = window_ ? spanDays(window_.from, window_.to) : 1;
  const dueOffset = window_ ? (spanDays(window_.from, window_.due) - 0.5) / total : 0;

  return (
    <div class="calc occasion">
      <form class="calc__form shell" onSubmit={(event) => { event.preventDefault(); void compute(due); }} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <div class="field">
              <label class="field__label" for="bs-due">Due date</label>
              <input id="bs-due" class="field__input" type="date" required min="1800-01-01" max="2199-12-31" value={due}
                onInput={(event) => setDue((event.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field__label" for="bs-names">Whose shower <span class="field__optional">optional</span></label>
              <input id="bs-names" class="field__input" type="text" maxLength={NAMES_MAX} value={names} placeholder="Sam & Alex"
                onInput={(event) => setNames((event.target as HTMLInputElement).value)} />
            </div>
          </div>
          <button class="btn btn--primary calc__submit" type="submit" disabled={!due || busy}>
            {busy ? 'Working out the sky…' : 'Make the shower card'}
          </button>
          <p class="calc__privacy">Worked out on your device. Nothing you enter is stored.</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
        </div>
      </form>

      {window_ && (
        <div class="calc__result">
          <div class="occasion-card" tabIndex={-1}>
            <p class="kicker occasion-card__kicker">{names.trim() ? `For ${names.trim()}’s baby shower` : 'For the baby shower'}</p>
            <h2 class="occasion-card__title">The sky around your due date</h2>
            <p class="occasion-card__sub">Due {dayMonth(window_.due)} · window {dayMonth(window_.from)} – {dayMonth(window_.to)}</p>
            <div class="due-bar" role="img" aria-label={window_.sunSpans.map((span) => `${signName(span.sign)} from ${dayMonth(span.from)} to ${dayMonth(span.to)}`).join('; ')}>
              {window_.sunSpans.map((span, index) => (
                <div class={index > 0 ? 'due-bar__span due-bar__span--end' : 'due-bar__span'} key={span.sign} style={`flex:${spanDays(span.from, span.to)};background:var(--sign-${span.sign})`}>
                  <img src={signIcon(128, span.sign)} width={40} height={40} alt="" />
                  <span>{signName(span.sign)}</span>
                </div>
              ))}
              <i class="due-bar__due" style={`left:${(dueOffset * 100).toFixed(2)}%`} />
            </div>
            <div class="due-bar__scale">
              <span>{shortDay(window_.from)}</span>
              <span style={`left:${(dueOffset * 100).toFixed(2)}%`} class="due-bar__marker">▲ due {shortDay(window_.due)}</span>
              <span class="due-bar__end">{shortDay(window_.to)}</span>
            </div>
            <dl class="occasion-card__rows">
              {window_.sunSpans.length === 1 && (
                <div><dt>Born any day in the window</dt><dd>{signName(window_.sunSpans[0]!.sign)} Sun</dd></div>
              )}
              {window_.sunSpans.length > 1 && window_.sunSpans.map((span, index) => (
                <div key={span.sign}>
                  <dt>{index === 0
                    ? `Born before ${dayMonth(window_.sunSpans[1]!.enters!.slice(0, 10))}, ${utcClock(window_.sunSpans[1]!.enters!)} UTC`
                    : `Born from ${dayMonth(span.enters!.slice(0, 10))}, ${utcClock(span.enters!)} UTC`}</dt>
                  <dd>{signName(span.sign)} Sun</dd>
                </div>
              ))}
              {window_.sunSpans.slice(1).map((span) => (
                <div key={`change-${span.sign}`}>
                  <dt>On {dayMonth(span.enters!.slice(0, 10))} the Sun changes sign</dt>
                  <dd>{utcClock(span.enters!)} UTC</dd>
                </div>
              ))}
              {window_.lunations.map((lunation) => (
                <div key={lunation.at}>
                  <dt>{lunation.kind === 'full' ? 'Full moon' : 'New moon'} in the window</dt>
                  <dd>{shortDay(lunation.at.slice(0, 10))}</dd>
                </div>
              ))}
            </dl>
            <p class="occasion-card__note">Guests: pick a day on the line. When the baby arrives, the sky fills in the answer.</p>
            <p class="occasion-card__foot"><span>zodiacs.org/occasions/baby-shower</span><span class="occasion-card__brand"><img src={BRAND_ICON_PATHS.favicon} width={24} height={24} alt="" />Zodiacs.org</span></p>
          </div>
          <div class="calc__actions occasion__actions">
            <button type="button" class="btn" onClick={() => window.print()}>Print the card</button>
            <a class="btn" href="/baby-zodiac/">The Moon’s signs across the due week</a>
          </div>
        </div>
      )}
    </div>
  );
}
