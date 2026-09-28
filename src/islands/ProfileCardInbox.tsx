/**
 * A chart card arriving at /profile/#card=…. The fragment is read once,
 * removed from the address bar (so a reload, a bookmark or a screenshot of
 * the URL does not keep it), and shown in the site's "recommended next"
 * card so the reader can keep it with their people. Nothing is stored
 * unless they add it, and nothing is sent anywhere either way.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import Initial from '../components/Initial';
import PlacementList, { cardPlacements } from '../components/PlacementList';
import { useProfile } from '../lib/hooks/useProfile';
import { explicitSelfChart } from '../lib/profile/read-store';
import {
  OPEN_CARD_EVENT,
  cardMatchesChart,
  cardTokenFromHash,
  decodeCardLink,
  loadCardPositionsForChart,
  type ChartCard,
} from '../lib/profile/card-link';
import type { PositionsShareInput } from '../lib/share-positions';
import type { SavedChart } from '../lib/profile/schema';
import { MAX_CIRCLE, addCard, type AddCardResult } from '../lib/profile/circle';
import { settledSunHue } from '../lib/profile/settled-signs';
import { announceInboxPrimary, useProfileSurface } from '../lib/profile/surface-gate';

type Arrival =
  | { state: 'none' }
  | { state: 'invalid' }
  | { state: 'ready'; card: ChartCard; result: AddCardResult | null; dismissed: boolean };

/** Read a card from the current hash, then take it out of the address bar. */
export function takeCardFromLocation(location: Pick<Location, 'hash' | 'pathname' | 'search'>, history: Pick<History, 'replaceState'>): Arrival {
  if (!/^#card=/u.test(location.hash)) return { state: 'none' };
  const token = cardTokenFromHash(location.hash);
  const card = token ? decodeCardLink(token) : null;
  try {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  } catch {
    // The card still opens; only the address bar keeps the fragment.
  }
  return card ? { state: 'ready', card, result: null, dismissed: false } : { state: 'invalid' };
}

export default function ProfileCardInbox({ accountBound = false }: { accountBound?: boolean }) {
  const { profile, ready } = useProfile();
  const surface = useProfileSurface(accountBound);
  const [arrival, setArrival] = useState<Arrival>({ state: 'none' });
  const self = useMemo(() => explicitSelfChart(profile.charts), [profile.charts]);
  // The positions a card of one's own chart would carry, to recognise it,
  // with the chart they belong to. Until they are known the card waits,
  // rather than showing for a frame as someone else's.
  const [selfCard, setSelfCard] = useState<{ chart: SavedChart; positions: PositionsShareInput | null } | null>(null);
  useEffect(() => {
    if (!self || arrival.state !== 'ready') return undefined;
    let current = true;
    const settle = (positions: PositionsShareInput | null) => { if (current) setSelfCard({ chart: self, positions }); };
    void loadCardPositionsForChart(self).then(settle, () => settle(null));
    return () => { current = false; };
  }, [self, arrival.state]);
  const selfKnown = self !== null && selfCard !== null
    && selfCard.chart.id === self.id && selfCard.chart.updatedAt === self.updatedAt;
  const selfPositions = selfKnown ? selfCard!.positions : null;
  const recognising = arrival.state === 'ready' && self !== null && !selfKnown;

  useEffect(() => {
    setArrival(takeCardFromLocation(window.location, window.history));
    return () => announceInboxPrimary(false);
  }, []);

  // Whether this card shows a white action: the offer to keep it, or, once
  // kept by someone with a chart of their own, the offer to send theirs.
  const shown = surface && arrival.state === 'ready' && !arrival.dismissed && !recognising;
  const holdsPrimary = shown && arrival.state === 'ready'
    && !(ready && self !== null && cardMatchesChart(arrival.card, selfPositions))
    && (self !== null || (arrival.result !== 'added' && arrival.result !== 'updated'));
  useEffect(() => announceInboxPrimary(holdsPrimary), [holdsPrimary]);

  if (!surface || arrival.state === 'none' || (arrival.state === 'ready' && (arrival.dismissed || recognising))) return null;

  if (arrival.state === 'invalid') {
    return (
      <section class="pf-inbox next-action shell tinted" aria-labelledby="pf-inbox-title" data-card-inbox>
        <div class="next-action__core core tinted">
          <div class="next-action__copy">
            <p class="next-action__cue mono">Chart card</p>
            <h2 class="next-action__title" id="pf-inbox-title">This card link isn’t complete.</h2>
            <p class="next-action__body">It may have been cut off when it was copied. Ask them to send it again.</p>
          </div>
          <div class="next-action__actions">
            <div class="next-action__secondary">
              <button class="pf-quiet" type="button" onClick={() => setArrival({ state: 'none' })}>Close</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const { card, result } = arrival;
  const who = card.label || 'Someone';
  const own = ready && self !== null && cardMatchesChart(card, selfPositions);
  const hue = settledSunHue(card.chart.bodies, card.timeKnown);
  const added = result === 'added' || result === 'updated';
  const dismiss = () => setArrival({ ...arrival, dismissed: true });

  function keep() {
    if (arrival.state !== 'ready') return;
    setArrival({ ...arrival, result: addCard(arrival.card) });
  }

  function sendYours() {
    dismiss();
    window.dispatchEvent(new Event(OPEN_CARD_EVENT));
  }

  const copy = own
    ? {
        cue: 'Your card',
        title: 'This is your own card.',
        body: 'This is how it opens for the people you send it to — on their own page, not yours.',
      }
    : added
      ? {
          cue: 'Added to your people',
          title: result === 'updated' ? `${who} is already with your people` : `${who} is with your people`,
          body: self
            ? 'Send yours back so they can keep you too.'
            : 'Next, add your own birth chart below, and you can compare the two.',
        }
      : {
          cue: 'Chart card',
          title: `${who} sent you their chart card`,
          body: 'Keep it with your people to see when their Sun returns each year and to compare your charts. '
            + `It stays in this browser.${card.timeKnown ? '' : ' Their card has no birth time, so it shows no rising sign.'}`,
        };

  return (
    <section
      class="pf-inbox next-action shell tinted"
      style={hue ? `--sign:${hue}` : undefined}
      aria-labelledby="pf-inbox-title"
      data-card-inbox
    >
      <div class="next-action__core core tinted pf-inbox__core">
        <div class="pf-inbox__initial">
          <Initial name={card.label || null} hue={hue} />
        </div>
        <div class="next-action__copy">
          <p class="next-action__cue mono">{copy.cue}</p>
          <h2 class="next-action__title" id="pf-inbox-title">{copy.title}</h2>
          <p class="next-action__body" role={added ? 'status' : undefined}>{copy.body}</p>
          {result === 'full' && (
            <p class="field__error" role="alert">Your people list is full ({MAX_CIRCLE}). Remove someone to make room.</p>
          )}
          {result === 'error' && (
            <p class="field__error" role="alert">This browser wouldn’t keep it. Private browsing or a full disk can do that.</p>
          )}
          <div class="next-action__meta">
            <PlacementList placements={cardPlacements(card)} linked={false} />
          </div>
        </div>
        <div class="next-action__actions">
          {own ? (
            <div class="next-action__secondary">
              <button class="pf-quiet" type="button" onClick={dismiss}>Close</button>
            </div>
          ) : added ? (
            <>
              {/* Without a chart of their own, the page's one birth-chart
                  invitation follows directly below; no second primary here. */}
              {self && (
                <div class="next-action__primary">
                  <button class="btn btn--primary" type="button" onClick={sendYours}>
                    <span>Send your card</span><span class="orb" aria-hidden="true">↗</span>
                  </button>
                </div>
              )}
              <div class="next-action__secondary">
                <a class="next-action__quiet" href="#your-people">See your people <span aria-hidden="true">↓</span></a>
              </div>
            </>
          ) : (
            <>
              <div class="next-action__primary">
                <button class="btn btn--primary" type="button" onClick={keep} data-card-keep>
                  <span>Add to your people</span><span class="orb" aria-hidden="true">+</span>
                </button>
              </div>
              <div class="next-action__secondary">
                <button class="pf-quiet" type="button" onClick={dismiss}>Not now</button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
