import { h } from 'preact';
import render from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import type { InviteStatusRow } from '../lib/invite/types';
import {
  PF_INVITE_COPY,
  ProfileInvitesView,
  formatInviteDate,
  parseInviteStatusResponse,
} from './ProfileInvites';

const WAITING: InviteStatusRow = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Frida Kahlo',
  sunSign: 'cancer',
  state: 'waiting',
  createdAt: '2026-07-24T04:00:00.000Z',
  expiresAt: '2026-08-07T04:00:00.000Z',
  openedAt: null,
  closedAt: null,
  hiddenAt: null,
};

const COMPLETED: InviteStatusRow = {
  ...WAITING,
  id: '22222222-2222-4222-8222-222222222222',
  state: 'completed',
  createdAt: '2026-07-20T04:00:00.000Z',
  openedAt: '2026-07-22T04:00:00.000Z',
  closedAt: '2026-07-23T04:00:00.000Z',
};

const PRIVATE_URL = `https://zodiacs.org/c/${'A'.repeat(43)}/`;

function view(
  props: Partial<Parameters<typeof ProfileInvitesView>[0]> = {},
): string {
  return render(h(ProfileInvitesView, {
    inviteUiEnabled: true,
    rows: [WAITING],
    links: { [WAITING.id]: PRIVATE_URL },
    ...props,
  }));
}

describe('Phase 4 profile invitation status parser', () => {
  it('accepts positions-free rows newest first', () => {
    expect(parseInviteStatusResponse({ invites: [COMPLETED, WAITING] })).toEqual([
      WAITING,
      COMPLETED,
    ]);
  });

  it('rejects raw tokens, URLs, positions, chart IDs, and birth data', () => {
    for (const extra of [
      { token: 'private' },
      { url: PRIVATE_URL },
      { positions: { bodies: [] } },
      { chartId: WAITING.id },
      { birthDate: '1907-07-06' },
      { email: 'person@example.com' },
    ]) {
      expect(parseInviteStatusResponse({
        invites: [{ ...WAITING, ...extra }],
      })).toBeNull();
    }
  });

  it('rejects malformed labels, dates, signs, states, and identifiers', () => {
    expect(parseInviteStatusResponse({ invites: [{ ...WAITING, id: 'bad' }] })).toBeNull();
    expect(parseInviteStatusResponse({ invites: [{ ...WAITING, label: '' }] })).toBeNull();
    expect(parseInviteStatusResponse({
      invites: [{ ...WAITING, label: 'x'.repeat(25) }],
    })).toBeNull();
    expect(parseInviteStatusResponse({
      invites: [{ ...WAITING, sunSign: 'ophiuchus' }],
    })).toBeNull();
    expect(parseInviteStatusResponse({
      invites: [{ ...WAITING, state: 'secret' }],
    })).toBeNull();
    expect(parseInviteStatusResponse({
      invites: [{ ...WAITING, expiresAt: 'not-a-date' }],
    })).toBeNull();
  });
});

describe('ProfileInvitesView', () => {
  it('renders nothing when the public flag is off and the account has no rows', () => {
    expect(view({ inviteUiEnabled: false, rows: [], links: {} })).toBe('');
  });

  it('renders the empty action only when the public UI is available', () => {
    const markup = view({ rows: [], links: {} });
    expect(markup).toContain(PF_INVITE_COPY.empty);
    expect(markup).toContain('href="/compatibility/"');
    expect(markup).toContain(PF_INVITE_COPY.create);
  });

  it('keeps End live but disables Copy while invitations are paused', () => {
    const markup = view({ inviteUiEnabled: false });
    expect(markup).toContain(PF_INVITE_COPY.paused);
    expect(markup).toMatch(/data-invite-copy[^>]*disabled|disabled[^>]*data-invite-copy/u);
    expect(markup).toContain('data-invite-end');
    expect(markup).not.toMatch(/data-invite-end[^>]*disabled|disabled[^>]*data-invite-end/u);
  });

  it('offers Copy only on a browser that has the one-time private URL', () => {
    expect(view()).toContain('data-invite-copy');
    expect(view({ links: {} })).not.toContain('data-invite-copy');
    expect(view()).not.toContain(PRIVATE_URL);
  });

  it('keeps cached Copy but disables End when status is stale', () => {
    const markup = view({ stale: true });
    expect(markup).toContain(PF_INVITE_COPY.stale);
    expect(markup).toContain('data-invite-copy');
    expect(markup).not.toMatch(/data-invite-copy[^>]*disabled|disabled[^>]*data-invite-copy/u);
    expect(markup).toMatch(/data-invite-end[^>]*disabled|disabled[^>]*data-invite-end/u);
  });

  it('uses the canonical pastel disc and contains no raw birth details', () => {
    const markup = view();
    // WebP only: an AVIF <source> would be fetched for this Sun sign alone
    // (signIcon in lib/sign-icon.ts asks for all twelve WebP discs first).
    expect(markup).not.toContain('/assets/zodiac-icons/48/cancer.avif');
    expect(markup).toContain('/assets/zodiac-icons/48/cancer.webp');
    expect(markup).not.toMatch(/birth date|birth time|birth place|latitude|longitude/iu);
  });

  it('shows deletion copy only for a fresh, verified terminal row', () => {
    const fresh = view({ rows: [COMPLETED], links: {} });
    expect(fresh).toContain('Their reading happened July 23.');
    expect(fresh).toContain('its positions are deleted');
    expect(fresh).toContain('data-invite-hide');

    const stale = view({ rows: [COMPLETED], links: {}, stale: true });
    expect(stale).toContain(PF_INVITE_COPY.status.completed);
    expect(stale).not.toContain('its positions are deleted');
  });

  it('formats receipt dates deterministically in UTC', () => {
    expect(formatInviteDate('2026-07-24T23:59:59.000Z')).toBe('July 24');
  });
});
