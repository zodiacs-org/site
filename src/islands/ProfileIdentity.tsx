/**
 * The head of /profile/: who this page belongs to. Before hydration, or
 * with no chart marked as yours, it is the page's plain introduction. Once
 * a chart is marked as yours it becomes your page — your initial on your
 * Sun sign's colour, your name, your Sun, Moon and rising, one line from
 * today's reading (so the page is new each day), and the site's usual trio
 * of actions: one white primary, one ghost, one quiet link.
 * Editing your name and sending your card open in place of that row, so
 * the header never shows two primaries at once; and while a received card
 * waits at the top of the page, the card holds the white action and the
 * header's steps down to a ghost.
 *
 * Only the explicit self chart can become "you"; a friend's chart never
 * does, however recently it was saved. Everything here reads and writes
 * this browser's storage through the guarded profile stores.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Initial from '../components/Initial';
import PlacementList, { chartPlacements, type Placement } from '../components/PlacementList';
import { useProfile } from '../lib/hooks/useProfile';
import { useMe } from '../lib/hooks/useMe';
import { explicitSelfChart } from '../lib/profile/read-store';
import { markPrimarySelfChart } from '../lib/profile/store';
import { DEFAULT_ME, DISPLAY_NAME_MAX, cleanDisplayName, resolvedDisplayName, saveMe } from '../lib/profile/me';
import { OPEN_CARD_EVENT, cardUrl, encodeCardLink, loadCardPositionsForChart } from '../lib/profile/card-link';
import { chartHandle, personalChartName, savedChartSunHue } from '../lib/profile/your-people';
import { initialIcon, initialOf } from '../lib/profile/initial';
import { prepareProfilePhoto } from '../lib/profile/photo';
import { todayLead } from '../lib/profile/today-reading';
import { t } from '../lib/i18n';
import { moonPhaseLabel } from '../lib/i18n/astrology';
import type { SavedChart } from '../lib/profile/schema';
import { useInboxHoldsPrimary, useProfileSurface } from '../lib/profile/surface-gate';

type Panel = 'edit' | 'share' | null;

function PhotoMark() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 5.5 9.5 3.5h5L16 5.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h3Z"/><circle cx="12" cy="12.5" r="4"/></svg>;
}

const STORAGE_ERROR = 'This browser wouldn’t keep it. Private browsing or a full disk can do that.';
/** --ink-1: the disc's colour when the chart cannot settle a Sun sign. */
const NEUTRAL_HUE = '#C6CCDA';

function Intro() {
  return (
    <div class="pf-hero">
      <svg class="pf-hero__mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="27"/><circle cx="32" cy="32" r="17"/>
        <path d="M32 5v10m0 34v10M5 32h10m34 0h10M12.9 12.9l7 7m24.2 24.2 7 7M12.9 51.1l7-7m24.2-24.2 7-7"/>
        <circle cx="32" cy="32" r="4"/>
      </svg>
      <em class="kicker">Your astrology</em>
      <h1 class="display">Your charts, today and ahead.</h1>
      <p>Keep your birth chart and the people you’ve added here. Today uses the chart you mark as yours; your timeline keeps the readings and observations you choose to save.</p>
      <a class="pf-hero__start" href="/birth-chart/">Make a birth chart <span aria-hidden="true">↗</span></a>
    </div>
  );
}

/** Pick which saved chart is yours, by name only — never birth details beside it. */
function SelfChooser({ charts }: { charts: SavedChart[] }) {
  const [error, setError] = useState(false);
  const recent = [...charts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  return (
    <section class="pf-choose" aria-labelledby="pf-choose-title">
      <div class="pf-choose__core">
        <div class="pf-card-head">
          <h2 id="pf-choose-title">Which of these charts is yours?</h2>
          <p>Choose one to make this page yours. The others stay with your people.</p>
        </div>
        <ul class="pf-rows">
          {recent.map((chart) => (
            <li class="pf-row" key={chart.id}>
              <Initial name={personalChartName(chart.name)} hue={savedChartSunHue(chart)} size={36} />
              <span class="pf-row__text"><strong>{chartHandle(chart.name)}</strong></span>
              <span class="pf-row__actions">
                <button class="pf-chart__action" type="button" onClick={() => setError(!markPrimarySelfChart(chart.id))}>
                  Use as my chart
                </button>
              </span>
            </li>
          ))}
        </ul>
        {charts.length > recent.length && (
          <a class="next-action__quiet pf-choose__more" href="#saved-charts">See every saved chart</a>
        )}
        {error && <p class="field__error" role="alert">This browser wouldn’t save that choice. Try again.</p>}
      </div>
    </section>
  );
}

/** Your name in the tab title and your initial as the tab icon, while this page is open. */
function useDocumentIdentity(chart: SavedChart | null, name: string | null, hue: string | null) {
  const [icon, setIcon] = useState<string | null>(null);
  const letter = initialOf(name);

  useEffect(() => {
    setIcon(null);
    if (!chart || !letter) return;
    let alive = true;
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-serif').trim() || 'serif';
    const draw = () => {
      if (alive) setIcon(initialIcon(letter, hue ?? NEUTRAL_HUE, family));
    };
    // Draw once the serif face is ready, so the tab shows the page's letter.
    (document.fonts?.load(`500 36px ${family}`) ?? Promise.resolve()).then(draw, draw);
    return () => {
      alive = false;
    };
  }, [chart?.id, letter, hue]);

  useEffect(() => {
    if (!chart) return;
    const title = document.title;
    document.title = `${name ?? 'Your page'} | Zodiacs.org`;
    const links = icon ? Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')) : [];
    const previous = links.map((link) => [link.getAttribute('href'), link.getAttribute('type')] as const);
    for (const link of links) {
      link.setAttribute('href', icon!);
      link.setAttribute('type', 'image/png');
    }
    return () => {
      document.title = title;
      links.forEach((link, index) => {
        const [href, previousType] = previous[index];
        if (href !== null) link.setAttribute('href', href);
        if (previousType !== null) link.setAttribute('type', previousType);
        else link.removeAttribute('type');
      });
    };
  }, [chart?.id, name, icon]);
}

export default function ProfileIdentity({ accountBound = false }: { accountBound?: boolean }) {
  const { profile, ready: profileReady } = useProfile();
  const surface = useProfileSurface(accountBound);
  const ready = profileReady && surface;
  const me = useMe();
  const self = useMemo(() => (ready ? explicitSelfChart(profile.charts) : null), [ready, profile.charts]);
  const savedName = resolvedDisplayName(me, self?.name ?? null);
  const hue = self ? savedChartSunHue(self) : null;
  const [panel, setPanel] = useState<Panel>(null);
  // While you type a new name, the header shows it (and its initial) live.
  const [draft, setDraft] = useState<string | null>(null);
  const headRef = useRef<HTMLElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const photoButton = useRef<HTMLButtonElement>(null);
  const editFromPhoto = useRef(false);
  const openPhoto = () => { editFromPhoto.current = true; setPanel('edit'); };
  const shareButton = useRef<HTMLButtonElement>(null);
  const closedPanel = useRef<Panel>(null);
  // A card waiting at the top of the page holds the one white action.
  const inboxHoldsPrimary = useInboxHoldsPrimary();

  useDocumentIdentity(self, savedName, hue);

  useEffect(() => {
    const open = () => {
      setPanel('share');
      requestAnimationFrame(() => headRef.current?.scrollIntoView({ block: 'start' }));
    };
    window.addEventListener(OPEN_CARD_EVENT, open);
    return () => window.removeEventListener(OPEN_CARD_EVENT, open);
  }, []);

  // Closing a panel hands focus back to the action that opened it.
  useEffect(() => {
    if (panel !== 'edit') setDraft(null);
    if (panel !== null || closedPanel.current === null) return;
    (closedPanel.current === 'edit' ? (editFromPhoto.current ? photoButton : editButton) : shareButton).current?.focus();
    closedPanel.current = null;
  }, [panel]);

  if (!ready || !self) {
    return (
      <div class="pf-introduction">
        <Intro />
        {ready && !self && profile.charts.length > 0 && <SelfChooser charts={profile.charts} />}
      </div>
    );
  }

  const name = draft === null
    ? savedName
    : cleanDisplayName(draft) ?? resolvedDisplayName(DEFAULT_ME, self.name);
  const placements = chartPlacements(self);
  const lead = todayLead(self);
  const close = () => {
    closedPanel.current = panel;
    setPanel(null);
  };

  return (
    <header class="pf-me" style={hue ? `--sign:${hue}` : undefined} ref={headRef} data-profile-identity>
      <div class="pf-me__id">
        <div class="pf-me__initial">
          {me.photo ? (
            <button class="pf-photo-button" type="button" ref={photoButton} onClick={openPhoto} aria-label="Change profile photo">
              <img class="pf-photo" src={me.photo} alt="Your profile photo" width="72" height="72" /><span class="pf-photo-button__edit"><PhotoMark /></span>
            </button>
          ) : name === null ? (
            <button class="initial initial--unnamed pf-me__add-name" type="button" ref={photoButton} onClick={openPhoto} aria-label="Add your name">
              <PhotoMark />
            </button>
          ) : (
            <button class="pf-photo-button" type="button" ref={photoButton} onClick={openPhoto} aria-label="Add profile photo">
              <Initial name={name} hue={hue} /><span class="pf-photo-button__edit"><PhotoMark /></span>
            </button>
          )}
        </div>
        <div class="pf-me__text">
          <em class="kicker">Your page</em>
          <h1 class="display">{name ?? 'Your chart'}</h1>
          <PlacementList placements={placements} />
        </div>
      </div>

      {lead && (
        <p class="pf-me__today" data-today-lead>
          <span class="mono mono--label">
            <time dateTime={lead.date}>{lead.date}</time>
            {' · '}{moonPhaseLabel('en', lead.phase)}
          </span>
          <span class="pf-me__today-line">{lead.text}</span>
        </p>
      )}

      {panel === null && (
        <div class="pf-me__actions">
          <a class={`btn ${inboxHoldsPrimary ? 'btn--ghost' : 'btn--primary'}`} href="/today/">
            <span>{t('en', 'openDailyBrief')}</span><span aria-hidden="true">↗</span>
          </a>
          <button class="pf-quiet pf-me__share-action" type="button" ref={shareButton} onClick={() => setPanel('share')} data-card-share-toggle>
            <span>Send your card</span><span aria-hidden="true">↗</span>
          </button>
          <button class="pf-quiet" type="button" ref={editButton} onClick={() => { editFromPhoto.current = false; setPanel('edit'); }}>
            Edit profile
          </button>
        </div>
      )}
      {panel === 'edit' && (
        <EditPanel initialName={me.displayName ?? savedName ?? ''} initialPhoto={me.photo} onDraft={setDraft} onClose={close} />
      )}
      {panel === 'share' && (
        <SharePanel
          chart={self}
          name={savedName}
          hue={hue}
          placements={placements}
          onAddName={() => setPanel('edit')}
          onClose={close}
        />
      )}
    </header>
  );
}

function EditPanel({ initialName, initialPhoto, onDraft, onClose }: {
  initialName: string;
  initialPhoto?: string;
  onDraft: (name: string) => void;
  onClose: () => void;
}) {
  const [draftName, setDraftName] = useState(initialName);
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState(initialPhoto);
  const [preparing, setPreparing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The action row this replaces is gone, so focus moves in: to the name
  // with a mouse or keyboard, to the panel on touch (no keyboard pop-up).
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) nameRef.current?.focus();
    else formRef.current?.focus({ preventScroll: true });
  }, []);

  function onInput(event: Event) {
    const value = (event.currentTarget as HTMLInputElement).value;
    setDraftName(value);
    onDraft(value);
  }

  function onSubmit(event: Event) {
    event.preventDefault();
    if (preparing) return;
    if (!saveMe({ displayName: cleanDisplayName(draftName), photo })) {
      setMessage(STORAGE_ERROR);
      return;
    }
    onClose();
  }

  return (
    <form class="pf-me__panel" id="pf-me-edit" ref={formRef} tabIndex={-1} onSubmit={onSubmit} aria-label="Edit profile">
      <div class="pf-photo-editor" aria-busy={preparing}>
        <button class="pf-photo-editor__preview" type="button" disabled={preparing} onClick={() => photoInput.current?.click()} aria-label={photo ? 'Change profile photo' : 'Add profile photo'}>
          {photo ? <img class="pf-photo" src={photo} alt="Photo preview" width="96" height="96" /> : <Initial name={draftName || null} hue={null} size={96} />}
          <span class="pf-photo-button__edit"><PhotoMark /></span>
        </button>
        <div class="pf-photo-editor__body">
          <label class="field__label" for="pf-me-photo">Profile photo <span class="muted">(optional)</span></label>
          <input ref={photoInput} class="pf-photo-input" id="pf-me-photo" type="file" tabIndex={-1} aria-describedby="pf-photo-help" accept="image/jpeg,image/png,image/webp" disabled={preparing} onChange={async (event) => {
            const input = event.currentTarget as HTMLInputElement;
            const file = input.files?.[0];
            if (!file) return;
            setPreparing(true); setMessage('');
            try { setPhoto(await prepareProfilePhoto(file)); }
            catch (error) { setMessage(error instanceof Error ? error.message : 'Try another photo.'); }
            finally { setPreparing(false); input.value = ''; }
          }} />
          <div class="pf-photo-editor__actions">
            <button class="pf-photo-choose" type="button" disabled={preparing} onClick={() => photoInput.current?.click()}>{photo ? 'Change profile photo' : 'Add profile photo'}</button>
            {photo && <button class="pf-quiet" type="button" disabled={preparing} onClick={() => setPhoto(undefined)}>Remove photo</button>}
          </div>
          <p class="field__help" id="pf-photo-help">Center-cropped. Saved in this browser and included in your backup. Your photo is not sent with shared cards or chart sync.</p>
          {preparing && <p role="status">Preparing photo…</p>}
        </div>
      </div>
      <div class="field pf-me__name">
        <label class="field__label" for="pf-me-name">Your name</label>
        <input
          ref={nameRef}
          id="pf-me-name"
          class="field__input"
          type="text"
          value={draftName}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="given-name"
          placeholder="A first name or nickname"
          onInput={onInput}
        />
        <p class="field__help">Shown on this page and on any card you send. Its first letter is your initial.</p>
      </div>
      {message && <p class="field__error" role="alert">{message}</p>}
      <div class="pf-me__panel-actions">
        <button class="btn btn--primary" type="submit" disabled={preparing}>
          <span>Save</span>
        </button>
        <button class="pf-quiet" type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

type CopyState = 'idle' | 'copied' | 'manual' | 'shared';

function SharePanel({ chart, name, hue, placements, onAddName, onClose }: {
  chart: SavedChart;
  name: string | null;
  hue: string | null;
  placements: Placement[];
  onAddName: () => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const [canShare, setCanShare] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setToken(null);
    void loadCardPositionsForChart(chart).then((positions) => {
      if (current) setToken(positions ? encodeCardLink({ chart: positions, label: name }) : null);
    }, (error) => console.error(error));
    return () => { current = false; };
  }, [chart, name]);
  const url = token ? cardUrl(window.location.origin, token) : null;

  useEffect(() => {
    setCanShare(typeof navigator.share === 'function');
    panelRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => setState('idle'), [url]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('manual');
    }
  }

  async function share() {
    if (!url) return;
    try {
      await navigator.share({
        title: name ? `${name}’s chart card` : 'A chart card',
        text: 'Keep my chart card on your Zodiacs.org page, and send me yours.',
        url,
      });
      setState('shared');
    } catch {
      // A dismissed share sheet is not an error; the copy button remains.
    }
  }

  return (
    <div
      class="pf-me__panel pf-share"
      id="pf-me-share"
      ref={panelRef}
      tabIndex={-1}
      role="group"
      aria-labelledby="pf-share-title"
    >
      <div class="pf-share__layout">
        <div class="pf-share__copy">
          <h2 class="pf-share__title" id="pf-share-title">Send your card</h2>
          <p>
            {name
              ? <>It carries the name <strong>{name}</strong> and your chart’s positions.</>
              : 'It carries your chart’s positions and no name.'}
            {' '}It has no birth date, time, or place fields, but the planet positions still give your
            birth date and time.
          </p>
          <p>
            It opens on their own Zodiacs.org page, where they can keep you with their people and send
            theirs back. Nothing is stored on our side.
          </p>
          {chart.birth.timeKnown !== true && (
            <p class="pf-share__note">Without a birth time, your card has no rising sign and shows your Moon as unsettled.</p>
          )}
          {!name && (
            <p class="pf-share__note">
              Add a name so they know who it’s from.{' '}
              <button class="pf-quiet pf-quiet--inline" type="button" onClick={onAddName}>Add your name</button>
            </p>
          )}
        </div>
        {/* A picture of what the copy beside it says travels. */}
        <figure class="pf-share__preview" aria-hidden="true">
          <div class="pf-share__card">
            <Initial name={name} hue={hue} size={56} />
            <div class="pf-share__card-text">
              <strong>{name ?? 'A chart card'}</strong>
              <PlacementList placements={placements} linked={false} />
            </div>
          </div>
          <figcaption class="mono--label">What they’ll see</figcaption>
        </figure>
      </div>
      {url ? (
        <>
          {state === 'manual' && (
            <input
              class="field__input pf-share__url"
              type="text"
              readOnly
              value={url}
              aria-label="Your card link"
              onFocus={(event) => (event.currentTarget as HTMLInputElement).select()}
            />
          )}
          <div class="pf-me__panel-actions">
            <button class="btn btn--primary" type="button" onClick={copy} data-card-link>
              <span>{state === 'copied' ? 'Link copied' : 'Copy card link'}</span>
              <span class="orb" aria-hidden="true">{state === 'copied' ? '✓' : '⧉'}</span>
            </button>
            {canShare && (
              <button class="btn btn--ghost" type="button" onClick={share}>
                <span>Share</span><span class="orb" aria-hidden="true">↗</span>
              </button>
            )}
            <button class="pf-quiet" type="button" onClick={onClose}>Done</button>
          </div>
          <p class="sr-only" role="status">{state === 'copied' ? 'Link copied' : state === 'shared' ? 'Card shared' : ''}</p>
        </>
      ) : (
        <>
          <p class="field__error" role="alert">
            This chart can’t make a card yet. Open it once in the birth chart calculator and save it again.
          </p>
          <div class="pf-me__panel-actions">
            <button class="pf-quiet" type="button" onClick={onClose}>Done</button>
          </div>
        </>
      )}
    </div>
  );
}
