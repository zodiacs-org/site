/**
 * The tarot draw on /tarot/: pick a spread, draw, read. The draw runs in the browser with its secure random number
 * generator (src/lib/tarot/draw.ts); nothing is sent anywhere, saved, or put in the address. Text and simple suit
 * icons only; no card art.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { drawTarot, type DrawnCard } from '../lib/tarot/draw';
import { SPREADS, SPREAD_IDS, type SpreadId } from '../lib/tarot/spreads';
import { TAROT_MEANINGS } from '../lib/tarot/meanings';
import { SuitIcon, SUIT_HUES } from '../lib/tarot/suit-icons';

const GENERIC_MESSAGE = 'The cards could not be drawn in this browser. Try reloading the page.';

export default function TarotDraw() {
  const [spread, setSpread] = useState<SpreadId>('three-card');
  const [reversals, setReversals] = useState(true);
  const [drawn, setDrawn] = useState<DrawnCard[] | null>(null);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [focusNext, setFocusNext] = useState(false);

  function draw(event: Event) {
    event.preventDefault();
    try {
      setError('');
      setDrawn(drawTarot(spread, reversals));
      setFocusNext(true);
    } catch {
      setDrawn(null);
      setError(GENERIC_MESSAGE);
    }
  }

  useEffect(() => {
    if (focusNext && drawn) { headingRef.current?.focus(); setFocusNext(false); }
  }, [focusNext, drawn]);

  return (
    <div class="calc tarot">
      <form class="calc__form shell" onSubmit={draw}>
        <div class="core calc__core">
          <fieldset class="field tarot__spreads">
            <legend class="field__label">Spread</legend>
            {SPREAD_IDS.map((id) => (
              <label key={id} class="tarot__choice">
                <input type="radio" name="tarot-spread" value={id} checked={spread === id} onChange={() => { setSpread(id); setDrawn(null); }} />
                <span>{SPREADS[id].name}</span>
              </label>
            ))}
            <p class="field__help">{SPREADS[spread].description}</p>
          </fieldset>
          <label class="tarot__choice tarot__reversals">
            <input type="checkbox" checked={reversals} onChange={(e) => { setReversals((e.target as HTMLInputElement).checked); setDrawn(null); }} />
            <span>Allow reversed cards</span>
          </label>
          <button class="btn btn--primary calc__submit" type="submit">
            <span>{drawn ? 'Draw again' : 'Draw the cards'}</span>
            <span class="orb">↗</span>
          </button>
          <p class="calc__privacy">The cards are shuffled in this browser. Nothing is sent or saved.</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
        </div>
      </form>

      {drawn && (
        <div class="calc__result">
          <h2 class="sr-only" tabIndex={-1} ref={headingRef}>Your cards</h2>
          <ol class={`tarot__cards tarot__cards--${spread}`}>
            {drawn.map(({ position, card, orientation }) => {
              const meaning = TAROT_MEANINGS[card.id];
              const suit = card.suit ?? 'major';
              return (
                <li key={card.id} class="tile tarot__card" style={`--sign:${SUIT_HUES[suit]}`}>
                  <span class="mono--label tarot__position">{position.name}</span>
                  <div class="tarot__title">
                    <SuitIcon suit={suit} reversed={orientation === 'reversed'} />
                    <h3 class="tarot__name">{card.name}</h3>
                  </div>
                  <span class="tarot__orientation">{orientation === 'reversed' ? 'Reversed' : 'Upright'} · {meaning.keywords.join(' · ')}</span>
                  <p class="tarot__prompt">{position.prompt}</p>
                  <p class="tarot__meaning">{orientation === 'reversed' ? meaning.reversed : meaning.upright}</p>
                  <p class="tarot__question"><em>{meaning.question}</em></p>
                </li>
              );
            })}
          </ol>
          <p class="tarot__note">Draw again whenever you like; each draw is a new shuffle.</p>
        </div>
      )}
    </div>
  );
}
