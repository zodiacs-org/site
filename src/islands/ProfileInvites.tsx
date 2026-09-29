import type { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  inviteLinksForRows,
  readInviteLink,
  removeInviteLink,
} from '../lib/invite/local-links';
import { trackAnalytics } from '../lib/analytics';
import type { InviteState, InviteStatusRow } from '../lib/invite/types';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase/client';
import { SIGNS, SIGN_SLUGS } from '../lib/signs';
import { signIcon } from '../lib/sign-icon';

const STATUS_CACHE_PREFIX = 'zodiacs.compat.invite-status.v1.';
const INVITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INVITE_STATES = new Set<InviteState>([
  'waiting',
  'opened',
  'completed',
  'revoked',
  'expired',
]);
const FORBIDDEN_ROW_KEYS = new Set([
  'token',
  'tokenHash',
  'url',
  'positions',
  'birth',
  'birthDate',
  'birthTime',
  'birthPlace',
  'chartId',
  'email',
]);

export const PF_INVITE_COPY = {
  title: 'Compatibility invitations',
  body: "Links you've made that carry one chart's positions. Each closes once it's read — or after 14 days at the latest.",
  empty: 'No invitations yet. Make one from any comparison on the compatibility page.',
  create: 'Make an invitation',
  status: {
    waiting: 'Waiting',
    opened: 'Opened',
    completed: 'Reading done',
    revoked: 'Ended by you',
    expired: 'Expired',
  } satisfies Record<InviteState, string>,
  copy: 'Copy link',
  copied: 'Link copied.',
  end: 'End this invitation',
  endedAnnounce: 'Invitation ended. The link no longer works.',
  endError: "Couldn't end it just now. Please try again.",
  hide: 'Remove from this list',
  hidden: 'Removed.',
  stale: "Statuses may be out of date — this device is offline or the check didn't go through.",
  paused: "Invitations are off right now, so these links won't open. You can still end one — ending always works.",
  anyDevice: "Invitations belong to your account — manage them from any device you're signed in to.",
} as const;

interface ProfileInvitesProps {
  /** Server-computed public UI flag. Status, End, and Hide never depend on it. */
  inviteUiEnabled?: boolean;
}

interface ProfileInvitesViewProps extends ProfileInvitesProps {
  rows: readonly InviteStatusRow[];
  links: Readonly<Record<string, string>>;
  stale?: boolean;
  loading?: boolean;
  busyIds?: ReadonlySet<string>;
  pendingClosureIds?: ReadonlySet<string>;
  rowErrors?: Readonly<Record<string, string>>;
  manualCopyIds?: ReadonlySet<string>;
  announcement?: string;
  onCopy?: (row: InviteStatusRow) => void;
  onEnd?: (row: InviteStatusRow) => void;
  onHide?: (row: InviteStatusRow) => void;
}

function optionalIso(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return undefined;
  return value;
}

function parseStatusRow(value: unknown): InviteStatusRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => FORBIDDEN_ROW_KEYS.has(key))) return null;
  if (
    typeof row.id !== 'string'
    || !INVITE_ID.test(row.id)
    || typeof row.label !== 'string'
    || row.label.trim().length === 0
    || [...row.label].length > 24
    || typeof row.sunSign !== 'string'
    || !SIGN_SLUGS.includes(row.sunSign)
    || typeof row.state !== 'string'
    || !INVITE_STATES.has(row.state as InviteState)
    || typeof row.createdAt !== 'string'
    || !Number.isFinite(Date.parse(row.createdAt))
    || typeof row.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(row.expiresAt))
  ) return null;

  const openedAt = optionalIso(row.openedAt);
  const closedAt = optionalIso(row.closedAt);
  const hiddenAt = optionalIso(row.hiddenAt);
  if (openedAt === undefined || closedAt === undefined || hiddenAt === undefined) return null;

  return {
    id: row.id,
    label: row.label.trim(),
    sunSign: row.sunSign as InviteStatusRow['sunSign'],
    state: row.state as InviteState,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    openedAt,
    closedAt,
    hiddenAt,
  };
}

export function parseInviteStatusResponse(value: unknown): InviteStatusRow[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const invites = (value as { invites?: unknown }).invites;
  if (!Array.isArray(invites)) return null;
  const rows = invites.map(parseStatusRow);
  if (rows.some((row) => row === null)) return null;
  return (rows as InviteStatusRow[])
    .filter((row) => row.hiddenAt === null)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function formatInviteDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function detailFor(
  row: InviteStatusRow,
  stale: boolean,
  pendingClosure: boolean,
): string | null {
  if (row.state === 'waiting') {
    return `Not opened yet. The link works until ${formatInviteDate(row.expiresAt)}.`;
  }
  if (row.state === 'opened') {
    return `Opened, no reading yet. Closes ${formatInviteDate(row.expiresAt)}.`;
  }
  // Never repeat a server-side deletion claim from stale cache, or while an
  // optimistic End request has not yet been verified.
  if (stale || pendingClosure) return null;
  if (row.state === 'completed' && row.closedAt) {
    return `Their reading happened ${formatInviteDate(row.closedAt)}. The link closed and its positions are deleted. The result comes back only if they send it.`;
  }
  if (row.state === 'revoked' && row.closedAt) {
    return `You ended this on ${formatInviteDate(row.closedAt)}. Its positions are deleted.`;
  }
  if (row.state === 'expired') {
    const date = formatInviteDate(row.closedAt ?? row.expiresAt);
    return row.openedAt
      ? `Expired ${date}. Its positions are deleted.`
      : `Expired ${date} unopened. Its positions are deleted.`;
  }
  return null;
}

function SignDisc({ slug }: { slug: InviteStatusRow['sunSign'] }) {
  const sign = SIGNS.find((candidate) => candidate.slug === slug);
  if (!sign) return null;
  return (
    <picture class="pf-invites__disc" aria-hidden="true">
      <img
        src={signIcon(48, sign.slug)}
        width="32"
        height="32"
        alt=""
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

export function ProfileInvitesView({
  inviteUiEnabled = false,
  rows,
  links,
  stale = false,
  loading = false,
  busyIds = new Set<string>(),
  pendingClosureIds = new Set<string>(),
  rowErrors = {},
  manualCopyIds = new Set<string>(),
  announcement = '',
  onCopy = () => {},
  onEnd = () => {},
  onHide = () => {},
}: ProfileInvitesViewProps) {
  if ((!inviteUiEnabled && rows.length === 0) || (loading && rows.length === 0)) {
    return null;
  }

  return (
    <section
      class="pf-invites shell"
      id="compat-invites"
      aria-labelledby="pf-invites-title"
      aria-busy={loading}
    >
      <div class="core pf-invites__core">
        <header class="pf-invites__head">
          <h2 id="pf-invites-title">{PF_INVITE_COPY.title}</h2>
          <p>{PF_INVITE_COPY.body}</p>
        </header>

        {!inviteUiEnabled && rows.length > 0 && (
          <p class="pf-invites__notice" role="status">{PF_INVITE_COPY.paused}</p>
        )}
        {stale && (
          <p class="pf-invites__notice" role="status">{PF_INVITE_COPY.stale}</p>
        )}

        {!loading && !stale && rows.length === 0 && (
          <div class="pf-invites__empty">
            <p>{PF_INVITE_COPY.empty}</p>
            <a class="pf-invites__text-action" href="/compatibility/">
              {PF_INVITE_COPY.create}
            </a>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <ul class="pf-invites__list" role="list">
              {rows.map((row) => {
                const active = row.state === 'waiting' || row.state === 'opened';
                const busy = busyIds.has(row.id);
                const pendingClosure = pendingClosureIds.has(row.id);
                const link = links[row.id] ?? null;
                const detail = detailFor(row, stale, pendingClosure);
                return (
                  <li
                    class="pf-invites__row"
                    key={row.id}
                    data-invite-id={row.id}
                    data-invite-state={row.state}
                  >
                    <div class="pf-invites__identity">
                      <SignDisc slug={row.sunSign} />
                      <span
                        class="pf-invites__who"
                        title={`${row.label} · ${formatInviteDate(row.createdAt)}`}
                      >
                        {row.label} · {formatInviteDate(row.createdAt)}
                      </span>
                    </div>
                    <span class="pf-invites__status">{PF_INVITE_COPY.status[row.state]}</span>
                    {detail && <p class="pf-invites__detail">{detail}</p>}
                    <div class="pf-invites__actions">
                      {active && link && (
                        <button
                          class="btn btn--ghost"
                          type="button"
                          onClick={() => onCopy(row)}
                          disabled={!inviteUiEnabled || busy}
                          data-invite-copy
                        >
                          {PF_INVITE_COPY.copy}
                        </button>
                      )}
                      {active && (
                        <button
                          class="pf-invites__text-action"
                          type="button"
                          onClick={() => onEnd(row)}
                          disabled={stale || busy}
                          data-invite-end
                        >
                          {PF_INVITE_COPY.end}
                        </button>
                      )}
                      {!active && !pendingClosure && (
                        <button
                          class="pf-invites__text-action"
                          type="button"
                          onClick={() => onHide(row)}
                          disabled={busy}
                          data-invite-hide
                        >
                          {PF_INVITE_COPY.hide}
                        </button>
                      )}
                    </div>
                    {manualCopyIds.has(row.id) && link && (
                      <input
                        class="field__input pf-invites__manual"
                        type="text"
                        readOnly
                        value={link}
                        aria-label={`Private invitation link for ${row.label}`}
                        onFocus={(event) => (event.currentTarget as HTMLInputElement).select()}
                      />
                    )}
                    {rowErrors[row.id] && (
                      <p class="pf-invites__error" role="alert">{rowErrors[row.id]}</p>
                    )}
                  </li>
                );
              })}
            </ul>
            <p class="pf-invites__account mono">{PF_INVITE_COPY.anyDevice}</p>
          </>
        )}
        <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
      </div>
    </section>
  );
}

function cacheKey(userId: string): string {
  return `${STATUS_CACHE_PREFIX}${userId}`;
}

function readCachedRows(userId: string): InviteStatusRow[] {
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return [];
    return parseInviteStatusResponse({ invites: JSON.parse(raw) }) ?? [];
  } catch {
    return [];
  }
}

function writeCachedRows(userId: string, rows: readonly InviteStatusRow[]) {
  try {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(rows));
  } catch {
    // Positions-free cache is best-effort.
  }
}

async function statusRows(accessToken: string): Promise<InviteStatusRow[]> {
  const response = await fetch('/api/compatibility/invites', {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error('status-failed');
  const rows = parseInviteStatusResponse(await response.json());
  if (!rows) throw new Error('status-invalid');
  return rows;
}

async function mutateInvite(
  endpoint: '/api/compatibility/invite-revoke' | '/api/compatibility/invite-hide',
  accessToken: string,
  id: string,
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error('mutation-failed');
}

export default function ProfileInvites({
  inviteUiEnabled = false,
}: ProfileInvitesProps) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [rows, setRows] = useState<InviteStatusRow[]>([]);
  const [links, setLinks] = useState<Readonly<Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [pendingClosureIds, setPendingClosureIds] = useState<Set<string>>(new Set());
  const [manualCopyIds, setManualCopyIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState('');
  const latestRows = useRef(rows);
  latestRows.current = rows;

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSession(null);
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      setSession(null);
      return;
    }
    let live = true;
    void client.auth.getSession().then(({ data }) => {
      if (live) setSession(data.session);
    }).catch(() => {
      if (live) setSession(null);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (live) setSession(next);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setBusyIds(new Set());
    setPendingClosureIds(new Set());
    setManualCopyIds(new Set());
    setRowErrors({});
    setAnnouncement('');
    if (!session) {
      setRows([]);
      setLinks({});
      setStale(false);
      setLoading(false);
      return;
    }
    let live = true;
    const cached = readCachedRows(session.user.id);
    setRows(cached);
    setLinks(inviteLinksForRows(cached.map((row) => row.id)));
    setStale(cached.length > 0);
    setLoading(true);

    void statusRows(session.access_token).then((fresh) => {
      if (!live) return;
      for (const row of fresh) {
        if (row.state === 'completed' || row.state === 'revoked' || row.state === 'expired') {
          removeInviteLink(row.id);
        }
      }
      writeCachedRows(session.user.id, fresh);
      setRows(fresh);
      setLinks(inviteLinksForRows(fresh.map((row) => row.id)));
      setStale(false);
    }).catch(() => {
      if (!live) return;
      setRows(cached);
      setLinks(inviteLinksForRows(cached.map((row) => row.id)));
      setStale(true);
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => { live = false; };
  }, [session?.access_token, session?.user.id]);

  const stableBusyIds = useMemo(() => busyIds, [busyIds]);

  async function onCopy(row: InviteStatusRow) {
    const url = readInviteLink(row.id);
    if (!url || !inviteUiEnabled) return;
    try {
      await navigator.clipboard.writeText(url);
      setManualCopyIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      setAnnouncement(PF_INVITE_COPY.copied);
    } catch {
      setManualCopyIds((current) => new Set(current).add(row.id));
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>(
          `.pf-invites__row[data-invite-id="${row.id}"] .pf-invites__manual`,
        )?.focus();
      });
    }
  }

  async function onEnd(row: InviteStatusRow) {
    if (!session || stale || busyIds.has(row.id)) return;
    const before = latestRows.current;
    const now = new Date().toISOString();
    setBusyIds((current) => new Set(current).add(row.id));
    setPendingClosureIds((current) => new Set(current).add(row.id));
    setRowErrors((current) => ({ ...current, [row.id]: '' }));
    setRows((current) => current.map((candidate) => (
      candidate.id === row.id
        ? { ...candidate, state: 'revoked', closedAt: now }
        : candidate
    )));
    try {
      await mutateInvite('/api/compatibility/invite-revoke', session.access_token, row.id);
      removeInviteLink(row.id);
      setLinks((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      const closed = latestRows.current.map((candidate) => (
        candidate.id === row.id
          ? { ...candidate, state: 'revoked' as const, closedAt: now }
          : candidate
      ));
      setRows(closed);
      writeCachedRows(session.user.id, closed);
      trackAnalytics('invite_revoked');
      setAnnouncement(PF_INVITE_COPY.endedAnnounce);
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(
          `.pf-invites__row[data-invite-id="${row.id}"] [data-invite-hide]`,
        )?.focus();
      });
    } catch {
      setRows(before);
      setRowErrors((current) => ({ ...current, [row.id]: PF_INVITE_COPY.endError }));
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(
          `.pf-invites__row[data-invite-id="${row.id}"] [data-invite-end]`,
        )?.focus();
      });
    } finally {
      setPendingClosureIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  }

  async function onHide(row: InviteStatusRow) {
    if (!session || busyIds.has(row.id)) return;
    setBusyIds((current) => new Set(current).add(row.id));
    setRowErrors((current) => ({ ...current, [row.id]: '' }));
    try {
      await mutateInvite('/api/compatibility/invite-hide', session.access_token, row.id);
      removeInviteLink(row.id);
      const visible = latestRows.current.filter((candidate) => candidate.id !== row.id);
      setRows(visible);
      setLinks(inviteLinksForRows(visible.map((candidate) => candidate.id)));
      writeCachedRows(session.user.id, visible);
      setAnnouncement(PF_INVITE_COPY.hidden);
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(
          '.pf-invites__row button, .pf-invites__empty a, #pf-invites-title',
        )?.focus();
      });
    } catch {
      setStale(true);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  }

  if (session === undefined || session === null) return null;

  return (
    <ProfileInvitesView
      inviteUiEnabled={inviteUiEnabled}
      rows={rows}
      links={links}
      stale={stale}
      loading={loading}
      busyIds={stableBusyIds}
      pendingClosureIds={pendingClosureIds}
      rowErrors={rowErrors}
      manualCopyIds={manualCopyIds}
      announcement={announcement}
      onCopy={(row) => void onCopy(row)}
      onEnd={(row) => void onEnd(row)}
      onHide={(row) => void onHide(row)}
    />
  );
}
