/**
 * The Race — live standings, join, and weekly check-in for the Zodiac Games.
 * Copy comes verbatim from the approved R1.1 pack (ZODIAC-GAMES.md Part 2);
 * scoring itself lives server-side in the Games RPCs. The island stores only
 * the visitor's own team choice in localStorage; identity toward the server
 * is the signed session cookie minted by /api/games.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { trackAnalytics } from '../lib/analytics';
import {
  downloadRaceCardBlob,
  drawRaceShareCard,
  raceShareSnapshot,
  shareRaceCardBlob,
} from '../lib/games/share-card';
import '../styles/race.css';

const API_PATH = '/api/games';
const MEMBERSHIP_KEY = 'zodiacs:games:v1';
const SUN_SIGN_HINT_KEY = 'zodiacs:today-sun-sign:v1';
const SIGN_PATTERN = /^(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)$/;

export interface RaceSign {
  slug: string;
  name: string;
  glyph: string;
  hue: string;
}

export interface RaceBoardProps {
  seasonId: string;
  seasonName: string;
  /** Slug of the season's sign — picks the season's trophy sculpture. */
  seasonSlug: string;
  seasonEndsAt: number;
  isoYear: number;
  isoWeek: number;
  signs: RaceSign[];
}

/** The official SDK sign icon (circle set) at the board tier. */
function signIcon(slug: string, size: number) {
  return (
    <img
      class="race-board__disc"
      src={`/assets/zodiac-icons/48/${slug}.webp`}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}

interface StandingRow {
  sign: string;
  points: number;
}

interface Membership {
  sign: string;
  joinedAt: string;
  lastCheckin?: string;
}

function readMembership(): Membership | null {
  try {
    const raw = localStorage.getItem(MEMBERSHIP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Membership;
    if (!parsed || !SIGN_PATTERN.test(parsed.sign ?? '')) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeMembership(value: Membership | null): void {
  try {
    if (value) localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(value));
    else localStorage.removeItem(MEMBERSHIP_KEY);
  } catch {
    // Private-mode storage failures only lose the local mirror.
  }
}

function daysLeftFrom(endsAt: number, now: number): number {
  return Math.max(1, Math.ceil((endsAt - now) / 86_400_000));
}

function joinedLabel(joinedAt: string): string {
  const date = new Date(joinedAt);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function RaceBoard({
  seasonId, seasonName, seasonSlug, seasonEndsAt, isoYear, isoWeek, signs,
}: RaceBoardProps) {
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [week, setWeek] = useState({ isoYear, isoWeek });
  const [membership, setMembership] = useState<Membership | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [justJoined, setJustJoined] = useState(false);
  const [note, setNote] = useState<string>('');
  const trophyRef = useRef<HTMLDivElement>(null);
  const daysLeft = daysLeftFrom(seasonEndsAt, Date.now());
  const weekKey = `${week.isoYear}-${week.isoWeek}`;
  const checkedInThisWeek = membership?.lastCheckin === weekKey;

  useEffect(() => {
    setMembership(readMembership());
    try {
      const hint = localStorage.getItem(SUN_SIGN_HINT_KEY) ?? '';
      if (SIGN_PATTERN.test(hint)) setSelected(hint);
    } catch {
      // No hint available.
    }
    trackAnalytics('race_view', { season: seasonId });

    const controller = new AbortController();
    refreshStandings(controller.signal);
    return () => controller.abort();
  }, [seasonId]);

  const refreshStandings = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`${API_PATH}?action=standings`, {
        signal,
        credentials: 'same-origin',
        cache: 'no-cache',
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json() as {
        standings?: StandingRow[]; isoYear?: number; isoWeek?: number;
      };
      if (signal?.aborted) return;
      if (Array.isArray(body.standings)) setStandings(body.standings);
      if (typeof body.isoYear === 'number' && typeof body.isoWeek === 'number') {
        setWeek({ isoYear: body.isoYear, isoWeek: body.isoWeek });
      }
    } catch {
      if (!signal?.aborted) setStandings((current) => current ?? []);
    }
  };

  useEffect(() => {
    const target = trophyRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    let seen = false;
    const observer = new IntersectionObserver((entries) => {
      if (seen || !entries.some((entry) => entry.isIntersecting)) return;
      seen = true;
      trackAnalytics('trophy_view', { season: seasonId, days_left: daysLeftFrom(seasonEndsAt, Date.now()) });
      observer.disconnect();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [seasonId, seasonEndsAt]);

  const post = async (action: 'join' | 'checkin', body?: Record<string, string>) => {
    const response = await fetch(`${API_PATH}?action=${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) };
  };

  const join = async (sign: string) => {
    if (busy || !SIGN_PATTERN.test(sign)) return;
    setBusy(true);
    setNote('');
    try {
      const result = await post('join', { sign });
      const status = (result.body as { status?: string; sign?: string; joinedAt?: string }).status;
      if (status === 'joined' || status === 'already_joined') {
        const serverSign = (result.body as { sign?: string }).sign;
        const settled: Membership = {
          sign: SIGN_PATTERN.test(serverSign ?? '') ? serverSign! : sign,
          joinedAt: (result.body as { joinedAt?: string }).joinedAt ?? new Date().toISOString(),
        };
        writeMembership(settled);
        setMembership(settled);
        setJustJoined(true);
        if (status === 'joined') trackAnalytics('team_join', { sign: settled.sign, season: seasonId });
        void refreshStandings();
      } else if (result.status === 429) {
        setNote('Too many joins from this connection today. Tomorrow works.');
      } else {
        setNote('The Race did not answer. Try again in a moment.');
      }
    } catch {
      setNote('The Race did not answer. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const checkin = async () => {
    if (busy || !membership) return;
    setBusy(true);
    setNote('');
    try {
      const result = await post('checkin');
      const body = result.body as { status?: string; isoYear?: number; isoWeek?: number };
      if (body.status === 'checked_in' || body.status === 'already_counted') {
        const stampedWeek = typeof body.isoYear === 'number' && typeof body.isoWeek === 'number'
          ? { isoYear: body.isoYear, isoWeek: body.isoWeek }
          : week;
        const settled = { ...membership, lastCheckin: `${stampedWeek.isoYear}-${stampedWeek.isoWeek}` };
        writeMembership(settled);
        setMembership(settled);
        setWeek(stampedWeek);
        if (body.status === 'checked_in') {
          trackAnalytics('weekly_checkin', { sign: membership.sign, season: seasonId });
        }
        void refreshStandings();
      } else if (body.status === 'not_joined') {
        // The signed cookie is gone; the local mirror is stale.
        writeMembership(null);
        setMembership(null);
        setNote('This browser is not on a team yet. Join below — it takes ten seconds.');
      } else {
        setNote('The Race did not answer. Try again in a moment.');
      }
    } catch {
      setNote('The Race did not answer. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const [shareNote, setShareNote] = useState('');

  const shareCard = async () => {
    if (busy || !membership || !standings || standings.length === 0) return;
    setBusy(true);
    setShareNote('');
    try {
      const snapshot = raceShareSnapshot({
        sign: membership.sign,
        seasonName,
        daysLeft: daysLeftFrom(seasonEndsAt, Date.now()),
        isoWeek: week.isoWeek,
        standings,
      });
      const blob = await drawRaceShareCard(snapshot);
      let outcome = await shareRaceCardBlob(blob);
      if (outcome === 'unavailable') {
        outcome = downloadRaceCardBlob(blob);
        setShareNote('Card saved. Post it anywhere.');
      }
      if (outcome === 'shared' || outcome === 'downloaded') {
        trackAnalytics('share_card', {
          sign: membership.sign,
          platform: outcome === 'shared' ? 'web-share' : 'download',
          season: seasonId,
        });
      }
    } catch {
      setShareNote('The card did not render. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const signBySlug = (slug: string) => signs.find((sign) => sign.slug === slug);
  const board = standings ?? [];
  const leader = board.length > 0 && board[0]!.points > 0 ? board[0]! : null;
  const runnerUp = leader && board.length > 1 ? board[1]! : null;
  const memberSign = membership ? signBySlug(membership.sign) : undefined;
  const bridgeSign = memberSign ?? signBySlug(selected) ?? undefined;

  return (
    <div class="race-board">
      <p class="race-board__lead" data-race-lead>
        {leader && runnerUp
          ? leader.points === runnerUp.points
            ? 'Scores are level at the top. Every check-in counts.'
            : `${signBySlug(leader.sign)?.name ?? leader.sign} leads. ${signBySlug(runnerUp.sign)?.name ?? runnerUp.sign} is ${(leader.points - runnerUp.points).toLocaleString('en')} points behind.`
          : standings === null ? 'Reading the board…' : 'The season is open. All signs start level — the first points set the order.'}
      </p>

      <table class="race-board__table">
        <thead>
          <tr><th scope="col">#</th><th scope="col">Sign</th><th scope="col">Points</th></tr>
        </thead>
        <tbody>
          {(board.length > 0 ? board : signs.map((sign) => ({ sign: sign.slug, points: 0 }))).map((row, index) => {
            const sign = signBySlug(row.sign);
            const isMine = membership?.sign === row.sign;
            return (
              <tr key={row.sign} data-mine={isMine ? 'true' : undefined} style={`--sign:${sign?.hue ?? 'var(--ink-dim)'}`}>
                <td class="race-board__rank">{standings === null || row.points === 0 ? '—' : board.findIndex((entry) => entry.points === row.points) + 1}</td>
                <td class="race-board__sign">
                  {signIcon(row.sign, 24)}
                  {sign?.name ?? row.sign}
                  {isMine && <span class="race-board__yours">your team</span>}
                </td>
                <td class="race-board__points">{row.points.toLocaleString('en')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {standings === null && <p class="race-board__loading">Reading the board…</p>}

      <div class="race-board__module" data-race-join>
        {!membership && (
          <>
            <h3>Pick your team. You already know which one.</h3>
            {/* Plain toggle buttons, not a radio pattern: every chip stays in
                the tab order and no arrow-key model is implied — the working
                LayerChips convention. */}
            <div class="race-board__signs" role="group" aria-label="Your sign">
              {signs.map((sign) => (
                <button
                  key={sign.slug}
                  type="button"
                  aria-pressed={selected === sign.slug}
                  class="race-board__chip"
                  data-selected={selected === sign.slug ? 'true' : undefined}
                  style={`--sign:${sign.hue}`}
                  onClick={() => setSelected(sign.slug)}
                >
                  {signIcon(sign.slug, 20)} {sign.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              class="btn race-board__cta"
              disabled={!selected || busy}
              onClick={() => join(selected)}
            >
              {selected ? `Join ${signBySlug(selected)?.name}` : 'Join your sign'}
            </button>
            <p class="race-board__free">It’s free. It stays free.</p>
          </>
        )}
        {membership && (
          <>
            <h3>
              Team {memberSign?.name ?? membership.sign}
              {joinedLabel(membership.joinedAt) && ` · joined ${joinedLabel(membership.joinedAt)}`}
            </h3>
            {!checkedInThisWeek ? (
              <>
                <button type="button" class="btn race-board__cta" disabled={busy} onClick={checkin}>
                  Check in — Week {week.isoWeek}
                </button>
                {justJoined && (
                  <p class="race-board__free">
                    <strong>You’re in.</strong> {memberSign?.name ?? membership.sign} just
                    scored. Come back weekly — check-ins count.
                  </p>
                )}
              </>
            ) : (
              <p class="race-board__counted"><strong>Counted.</strong> See you next week.</p>
            )}
          </>
        )}
        {note && <p class="race-board__note" role="status">{note}</p>}
      </div>

      {membership && (
        <div class="race-board__module race-board__share">
          <h3>
            Post {memberSign?.name ?? membership.sign}’s standing. Rivalries
            don’t run themselves.
          </h3>
          <button
            type="button"
            class="btn race-board__cta"
            data-race-share
            disabled={busy || !standings || standings.length === 0}
            onClick={shareCard}
          >
            Share the card
          </button>
          {shareNote && <p class="race-board__note" role="status">{shareNote}</p>}
        </div>
      )}

      <div class="race-board__module race-board__trophy" ref={trophyRef}>
        <img
          class="race-board__trophy-figure"
          src={`/assets/sculptures/512/${seasonSlug}.webp`}
          width={200}
          height={200}
          alt={`The ${seasonName} Zodiac design — this season’s trophy`}
          loading="lazy"
          decoding="async"
        />
        <div>
          <h3>The {seasonName} trophy.</h3>
          <p>
            Completes in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}. Engraved with
            whoever’s on top when the season closes.
          </p>
        </div>
      </div>

      {bridgeSign && (
        <div class="race-board__module race-board__bridge">
          <h3>{bridgeSign.name} is one of the Twelve.</h3>
          <p>
            Every sign has an official catalogue profile — its story, its
            record, and its place among the Twelve.
          </p>
          <a
            href={`/registry/${bridgeSign.slug}/`}
            class="race-board__bridge-link"
            onClick={() => trackAnalytics('race_to_astrofolio', { sign: bridgeSign.slug, source: 'race' })}
          >
            Meet {bridgeSign.name} →
          </a>
        </div>
      )}
    </div>
  );
}
