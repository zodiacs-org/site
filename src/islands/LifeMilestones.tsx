/**
 * Life milestones: Jupiter returns, Saturn returns and the Uranus opposition
 * from a birth date, with every pass, the next one coming, and the sky
 * numbers lived through. Worked out on the device; nothing is stored.
 */
import { useEffect, useState } from 'preact/hooks';
import type { City } from '../lib/geo/search';
import type { MilestoneCard } from '../lib/occasions/milestone-card';
import type { Milestone } from '../lib/occasions/milestones';
import { BRAND_ICON_PATHS } from '../lib/brand-icons.mjs';
import PlaceSearch from './PlaceSearch';

const loadCard = () => Promise.all([import('../lib/occasions/milestone-card'), import('../lib/occasions/site-clock')]);
const MILESTONE_NAMES: Record<Milestone['kind'], string> = {
  'jupiter-return': 'Jupiter return',
  'saturn-return': 'Saturn return',
  'uranus-opposition': 'Uranus opposition',
};

function day(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
}

function ordinal(n: number): string {
  return ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n - 1] ?? `${n}th`;
}

/** "first Saturn return", or "Uranus opposition"; the caller capitalizes a line start. */
function name(milestone: Milestone): string {
  return milestone.kind === 'uranus-opposition' ? 'Uranus opposition' : `${ordinal(milestone.index)} ${MILESTONE_NAMES[milestone.kind]}`;
}

function title(milestone: Milestone): string {
  return name(milestone).replace(/^./u, (c) => c.toUpperCase());
}

export default function LifeMilestones() {
  const [birth, setBirth] = useState('');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [card, setCard] = useState<MilestoneCard | null>(null);
  const [about, setAbout] = useState<Record<string, { name: string; about: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function compute(next: { birth: string; time: string; city: City | null }) {
    setBusy(true);
    setError('');
    try {
      const [module, { SITE_CLOCK }] = await loadCard();
      setAbout(module.MILESTONE_WORDS);
      setCard(await module.milestoneCard({
        birthDate: next.birth,
        time: next.time || null,
        timeZone: next.city?.tz ?? null,
        birthplace: next.city ? { lon: next.city.lon } : null,
      }, new Date(), SITE_CLOCK));
    } catch (cause) {
      setCard(null);
      setError(cause instanceof RangeError ? cause.message : 'The milestones could not be worked out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const linked = params.get('b');
    if (!linked) return;
    setBirth(linked);
    void compute({ birth: linked, time: '', city: null });
  }, []);

  function submit(event: Event) {
    event.preventDefault();
    if (time && !city) {
      setError('Add the birthplace too: a time only makes sense with its time zone.');
      return;
    }
    void compute({ birth, time, city });
  }

  const next = card?.next ?? null;
  const now = Date.now();

  return (
    <div class="calc occasion">
      <form class="calc__form shell" onSubmit={submit} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <div class="field">
              <label class="field__label" for="lm-birth">Birth date</label>
              <input id="lm-birth" class="field__input" type="date" required min="1800-01-01" max="2199-12-31" value={birth}
                onInput={(event) => setBirth((event.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field__label" for="lm-time">Birth time <span class="field__optional">optional</span></label>
              <input id="lm-time" class="field__input" type="time" value={time}
                onInput={(event) => setTime((event.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field__label" for="lm-place">Birthplace <span class="field__optional">optional</span></label>
              <PlaceSearch id="lm-place" selected={city} onSelect={setCity} locale="en" />
            </div>
          </div>
          <button class="btn btn--primary calc__submit" type="submit" disabled={!birth || busy}>
            {busy ? 'Working out the dates…' : 'Show my milestones'}
          </button>
          <p class="calc__privacy">Worked out on your device. Nothing you enter is stored.</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
        </div>
      </form>

      {card && about && (
        <div class="calc__result">
          <div class="occasion-card" tabIndex={-1}>
            <p class="kicker occasion-card__kicker">Born {day(card.birth)}</p>
            <h2 class="occasion-card__title">Your sky milestones</h2>
            {next && (
              <>
                <p class="occasion-card__sub">
                  {Date.parse(next.first) <= now ? 'Now' : 'Next'}: your {name(next)}, at {next.age}
                </p>
                <dl class="occasion-card__rows occasion-card__rows--lead">
                  {next.passes.map((pass, index) => (
                    <div key={pass.at}>
                      <dt>{index === 0 ? (next.kind === 'uranus-opposition' ? 'Uranus reaches the point opposite its place at your birth' : `${next.kind === 'jupiter-return' ? 'Jupiter' : 'Saturn'} reaches its place at your birth`) : pass.retrograde ? 'Passes back over it, retrograde' : index === next.passes.length - 1 ? 'Crosses it for the last time' : 'Crosses it again'}</dt>
                      <dd>{day(pass.at)}</dd>
                    </div>
                  ))}
                </dl>
                <p class="occasion-card__note">{about[next.kind].about}</p>
              </>
            )}
            <div class="occasion-card__numbers">
              <div><strong>{card.numbers.fullMoons.toLocaleString('en-GB')}</strong><span>full moons lived through</span></div>
              <div><strong>{card.numbers.mercuryRetrogrades}</strong><span>Mercury retrogrades</span></div>
              <div><strong>{card.numbers.jupiterReturns}</strong><span>Jupiter returns</span></div>
            </div>
            <dl class="occasion-card__rows">
              {card.milestones.map((milestone) => (
                <div key={`${milestone.kind}-${milestone.index}`}>
                  <dt>{title(milestone)} · age {milestone.age}</dt>
                  <dd>{day(milestone.first)}{milestone.passes.length > 1 ? ` to ${day(milestone.last)}` : ''}</dd>
                </div>
              ))}
            </dl>
            {!card.timeKnown && <p class="field__help">Without a birth time, a date can be a day off.</p>}
            <p class="occasion-card__foot"><span>zodiacs.org/occasions/milestones</span><span class="occasion-card__brand"><img src={BRAND_ICON_PATHS.favicon} width={24} height={24} alt="" />Zodiacs.org</span></p>
          </div>
          <div class="calc__actions occasion__actions">
            <button type="button" class="btn" onClick={() => window.print()}>Print the card</button>
            <a class="btn" href="/saturn-return/">Read about the Saturn return</a>
          </div>
        </div>
      )}
    </div>
  );
}
