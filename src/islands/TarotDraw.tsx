/**
 * The tarot draw on /tarot/: pick a spread, draw, read. The draw runs in the browser with its secure random number
 * generator (src/lib/tarot/draw.ts); nothing is sent anywhere, saved, or put in the address. Text and simple suit
 * icons only; no card art.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { SPREADS, SPREAD_IDS, type SpreadId } from '../lib/tarot/spreads';
import { drawTarotReading, type TarotCardReading } from '../lib/tarot/reading';
import TarotCard from '../components/TarotCard';
import StoryCardShare from '../components/StoryCardShare';
import { SuitIcon } from '../lib/tarot/suit-icons';
import { prepareTarotStoryCard, tarotStoryContent } from '../lib/tarot/story-card';

const GENERIC_MESSAGE = 'The cards could not be drawn in this browser. Try reloading the page.';
const SPREAD_NAME = 'tarot-spread';
const REVERSALS_NAME = 'tarot-reversals';

/** What a form's own controls say: the checked spread and the reversals box, or null when there is no form to read. */
export interface FormChoice { spread: SpreadId; reversals: boolean }
type ControlReader = { querySelector(selector: string): { value?: string; checked?: boolean } | null };

/**
 * The spread and reversals the form's controls hold. A choice made before the island hydrated stays in the native
 * controls (Preact keeps their checked state, and the hydration directive replays no change event for it), so the
 * draw reads the controls themselves, never the state alone.
 */
export function formChoice(form: ControlReader | null | undefined): FormChoice | null {
  if (!form) return null;
  const value = form.querySelector(`input[name="${SPREAD_NAME}"]:checked`)?.value;
  const box = form.querySelector(`input[name="${REVERSALS_NAME}"]`);
  if (!value || !(SPREAD_IDS as readonly string[]).includes(value) || !box) return null;
  return { spread: value as SpreadId, reversals: box.checked === true };
}

export default function TarotDraw() {
  const [spread, setSpread] = useState<SpreadId>('three-card');
  const [reversals, setReversals] = useState(true);
  const [drawn, setDrawn] = useState<TarotCardReading[] | null>(null);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [focusNext, setFocusNext] = useState(false);
  // The draw cannot run until the island has: the button stays disabled until then, so a browser without JavaScript
  // never sends the form (and its spread) as a query.
  const [ready, setReady] = useState(false);

  // A spread or reversals choice made before hydration is in the controls, not in the state: take it over once.
  useEffect(() => {
    const chosen = formChoice(formRef.current);
    if (chosen) { setSpread(chosen.spread); setReversals(chosen.reversals); }
    setReady(true);
  }, []);

  function draw(event: Event) {
    event.preventDefault();
    try {
      setError('');
      const chosen = formChoice(event.currentTarget as HTMLFormElement) ?? { spread, reversals };
      if (chosen.spread !== spread) setSpread(chosen.spread);
      if (chosen.reversals !== reversals) setReversals(chosen.reversals);
      setDrawn(drawTarotReading(chosen.spread, chosen.reversals));
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
      <form class="calc__form shell" onSubmit={draw} ref={formRef}>
        <div class="core calc__core">
          <fieldset class="field tarot__spreads">
            <legend class="field__label">Spread</legend>
            {SPREAD_IDS.map((id) => (
              <label key={id} class="tarot__choice">
                <input type="radio" name={SPREAD_NAME} value={id} checked={spread === id} onChange={() => { setSpread(id); setDrawn(null); }} />
                <span>{SPREADS[id].name}</span>
              </label>
            ))}
            {/* Every spread's description, stacked in one cell with only the chosen one shown, so the cell is always as
                tall as the longest at any width: a choice taken over when the island hydrates moves nothing below it. */}
            <div class="tarot__spread-help">
              {SPREAD_IDS.map((id) => (
                <p key={id} class="field__help" aria-hidden={id === spread ? undefined : 'true'} data-shown={id === spread ? '' : undefined}>{SPREADS[id].description}</p>
              ))}
            </div>
          </fieldset>
          <label class="tarot__choice tarot__reversals">
            <input type="checkbox" name={REVERSALS_NAME} checked={reversals} onChange={(e) => { setReversals((e.target as HTMLInputElement).checked); setDrawn(null); }} />
            <span>Allow reversed cards</span>
          </label>
          <button class="btn btn--primary calc__submit" type="submit" disabled={!ready}>
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
            {drawn.map((reading) => <TarotCard key={reading.card.id} reading={reading} />)}
          </ol>
          <p class="tarot__note">Draw again whenever you like; each draw is a new shuffle.</p>
          {(() => {
            const story = tarotStoryContent(spread, drawn);
            // The card and its link carry the cards drawn and the tarot page: the draw takes nothing personal.
            return (
              <StoryCardShare
                cardKey={drawn.map((reading) => `${reading.card.id}:${reading.orientation}`).join()}
                prepare={() => prepareTarotStoryCard(spread, drawn)}
                pageUrl={story.pageUrl}
                shareText={story.shareText}
                heading="Share this draw"
                lede={drawn.length === 1 ? 'A card of the card you drew and its reading, with a link to it on Zodiacs.' : 'A card of the cards you drew, in their places, with a link to the tarot page.'}
                placeholder={<SuitIcon suit={drawn[0].card.suit ?? 'major'} size={64} />}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}
