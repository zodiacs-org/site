/**
 * A share card for a result: make a 1080 x 1920 story image on the visitor's device, preview it, share or save it,
 * and copy a link back to the page. The card and the link carry only what the caller puts in them; callers never
 * give either a name or a birth detail the person typed (the numerology and tarot cards carry a number or the
 * cards drawn, and a link to the public page).
 *
 * The renderer is loaded only when the person asks for a card, so the page's first load stays light. The preview
 * box, the action row and the status line keep their size in every state, so making a card shifts nothing.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PreparedChartCard } from '../lib/share-card-save';
import '../styles/story-share.css';

export interface StoryCardShareProps {
  /** Draws the card. Called when the person asks for it, and again whenever `cardKey` changes. */
  prepare: () => Promise<PreparedChartCard>;
  /** Changes when the result does, so an old card is never shared for a new result. */
  cardKey: string;
  /** The public page the card points to, such as https://zodiacs.org/numerology/life-path/7/. No personal details. */
  pageUrl: string;
  /** The words shared with the link, such as "My Life Path number is 7 (The analyst)". No personal details. */
  shareText: string;
  heading?: string;
  lede?: string;
  /** Shown in the preview box before a card is made. */
  placeholder?: preact.ComponentChildren;
}

type State = 'idle' | 'preparing' | 'ready' | 'error';

export default function StoryCardShare({ prepare, cardKey, pageUrl, shareText, heading = 'Share card', lede, placeholder }: StoryCardShareProps) {
  const [state, setState] = useState<State>('idle');
  const [status, setStatus] = useState('Made on this device. It shows no name or birth date.');
  const card = useRef<PreparedChartCard | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const generation = useRef(0);

  // A new result clears the old card.
  useEffect(() => {
    generation.current += 1;
    card.current = null;
    setState('idle');
    setStatus('Made on this device. It shows no name or birth date.');
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return null; });
  }, [cardKey]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function make() {
    const mine = ++generation.current;
    setState('preparing');
    setStatus('Making the card…');
    try {
      const prepared = await prepare();
      if (mine !== generation.current) return;
      card.current = prepared;
      setPreview(URL.createObjectURL(prepared.blob));
      setState('ready');
      setStatus('Ready. Share it, or save it to your device.');
    } catch {
      if (mine !== generation.current) return;
      setState('error');
      setStatus('The card could not be made in this browser. The link below still works.');
    }
  }

  async function share() {
    if (!card.current) return;
    const { savePngBlob } = await import('../lib/share-card-save');
    const outcome = await savePngBlob(card.current.blob, card.current.filename);
    setStatus(outcome === 'shared' ? 'Shared.' : outcome === 'downloaded' ? 'Saved to your device.' : 'Not shared.');
  }

  async function download() {
    if (!card.current) return;
    const { downloadPreparedChartCard } = await import('../lib/share-card-save');
    downloadPreparedChartCard(card.current);
    setStatus('Saved to your device.');
  }

  async function copyLink() {
    try {
      if (navigator.share && window.matchMedia?.('(pointer: coarse)').matches) {
        await navigator.share({ title: shareText, text: shareText, url: pageUrl });
        setStatus('Link shared.');
        return;
      }
      await navigator.clipboard.writeText(pageUrl);
      setStatus('Link copied.');
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
      setStatus(`The link is ${pageUrl}`);
    }
  }

  return (
    <section class="story-share tile" aria-label={heading}>
      <div class="story-share__preview" aria-hidden="true">
        {preview
          ? <img src={preview} alt="" width={180} height={320} />
          : <span class="story-share__placeholder">{placeholder}</span>}
      </div>
      <div class="story-share__body">
        <h3 class="story-share__title">{heading}</h3>
        {lede && <p class="story-share__lede">{lede}</p>}
        <div class="story-share__actions">
          {/* The same three buttons in every state, on a fixed grid, so making a card moves nothing. */}
          <button class="btn btn--primary" type="button" onClick={state === 'ready' ? share : make} disabled={state === 'preparing'}>
            {/* Every label is laid out in one cell and only the current one shows, so the button never changes width. */}
            <span class="story-share__swap">
              {(['Make card', 'Making…', 'Share card'] as const).map((label) => {
                const current = label === (state === 'ready' ? 'Share card' : state === 'preparing' ? 'Making…' : 'Make card');
                return <span key={label} aria-hidden={current ? undefined : 'true'} class={current ? undefined : 'story-share__ghost'}>{label}</span>;
              })}
            </span>
            <span class="orb story-share__orb" aria-hidden="true">{state === 'ready' ? '↗' : '+'}</span>
          </button>
          <button class="btn btn--ghost" type="button" onClick={download} disabled={state !== 'ready'}><span>Save</span><span class="orb" aria-hidden="true">↓</span></button>
          <button class="btn btn--ghost" type="button" onClick={copyLink}><span>Copy link</span><span class="orb" aria-hidden="true">⧉</span></button>
        </div>
        <p class="story-share__status" aria-live="polite">{status}</p>
      </div>
    </section>
  );
}
