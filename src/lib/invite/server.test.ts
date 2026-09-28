import { describe, expect, it, vi } from 'vitest';
import { POSITION_BODY_ORDER } from '../share-positions';
import {
  completeCompatibilityInvite,
  createCompatibilityInvite,
  getOwnedSyncedChartPayload,
  listCompatibilityInvites,
  readCompatibilityInvite,
} from './server';
import { deriveInviteChartFromSyncedPayload } from './validate';

const OWNER = {
  id: '110e8400-e29b-41d4-a716-446655440000',
  email: 'owner@example.com',
};
const CHART_ID = '220e8400-e29b-41d4-a716-446655440000';
const INVITE_ID = '330e8400-e29b-41d4-a716-446655440000';
const HASH = 'a'.repeat(64);
const ENV = {
  PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function chartPayload(): Record<string, unknown> {
  return {
    name: 'Private chart',
    birth: {
      date: '1907-07-06',
      time: '08:30',
      timeKnown: true,
      place: { name: 'Private place', lat: 1, lon: 2, tz: 'Etc/UTC' },
    },
    summary: {
      engineVersion: 'zodiacs-1.0.0',
      utcISO: '1907-07-06T08:30:00.000Z',
      houseSystem: 'whole',
      bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: index * 27 })),
      angles: { asc: 12, mc: 101 },
    },
  };
}

describe('Phase 4 invite Supabase boundary', () => {
  it('loads a chart only through the owner/id pair', async () => {
    const fetcher = vi.fn().mockResolvedValue(json([{ id: CHART_ID, payload: chartPayload() }]));
    await expect(getOwnedSyncedChartPayload(OWNER.id, CHART_ID, ENV, fetcher))
      .resolves.toMatchObject({ name: 'Private chart' });
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/rest/v1/charts');
    expect(url.searchParams.get('user_id')).toBe(`eq.${OWNER.id}`);
    expect(url.searchParams.get('id')).toBe(`eq.${CHART_ID}`);
  });

  it('creates with a digest and derived positions, never a raw token or birth input', async () => {
    const chart = deriveInviteChartFromSyncedPayload(chartPayload())!;
    const fetcher = vi.fn().mockResolvedValue(json({
      outcome: 'created',
      invite_id: INVITE_ID,
      expires_at: '2026-08-07T00:00:00.000Z',
    }));
    await expect(createCompatibilityInvite(OWNER, chart, true, HASH, ENV, fetcher))
      .resolves.toEqual({
        outcome: 'created',
        id: INVITE_ID,
        expiresAt: '2026-08-07T00:00:00.000Z',
      });
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.candidate_token_hash).toBe(HASH);
    expect(body.candidate_positions.b).toHaveLength(12);
    expect(JSON.stringify(body)).not.toMatch(
      /owner@example|1907|Private place|birth|timezone|chart_id|raw_token/iu,
    );
  });

  it('normalizes the ready payload and rejects no terminal detail', async () => {
    const chart = deriveInviteChartFromSyncedPayload(chartPayload())!;
    const ready = vi.fn().mockResolvedValue(json({
      outcome: 'ready',
      label: chart.label,
      sun_sign: chart.sunSign,
      positions: chart.positions,
      time_known: true,
      expires_at: '2026-08-07T00:00:00.000Z',
    }));
    await expect(readCompatibilityInvite(HASH, ENV, ready)).resolves.toMatchObject({
      outcome: 'ready',
      payload: {
        label: 'Private chart',
        timeKnown: true,
        positions: { bodies: expect.arrayContaining([{ body: 'Sun', lon: 0 }]) },
      },
    });
    const unavailable = vi.fn().mockResolvedValue(json({ outcome: 'unavailable' }));
    await expect(readCompatibilityInvite(HASH, ENV, unavailable))
      .resolves.toEqual({ outcome: 'unavailable' });
  });

  it('returns authoritative completion evidence for first and replay calls', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({
      outcome: 'duplicate',
      invite_id: INVITE_ID,
      owner_user_id: OWNER.id,
      label: 'Private chart',
      notify_on_complete: true,
      completed_at: '2026-07-24T08:00:00.000Z',
    }));
    await expect(completeCompatibilityInvite(HASH, ENV, fetcher)).resolves.toEqual({
      outcome: 'duplicate',
      inviteId: INVITE_ID,
      ownerUserId: OWNER.id,
      label: 'Private chart',
      notify: true,
      completedAt: '2026-07-24T08:00:00.000Z',
    });
  });

  it('returns only bounded, positions-free owner rows', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({
      outcome: 'ok',
      invites: [{
        id: INVITE_ID,
        label: 'Private chart',
        sun_sign: 'cancer',
        status: 'active',
        notify_on_complete: false,
        created_at: '2026-07-24T00:00:00.000Z',
        expires_at: '2026-08-07T00:00:00.000Z',
        opened_at: '2026-07-24T01:00:00.000Z',
        completed_at: null,
        revoked_at: null,
        expired_at: null,
        owner_hidden_at: null,
      }],
    }));
    const rows = await listCompatibilityInvites(OWNER.id, ENV, fetcher);
    expect(rows).toEqual([{
      id: INVITE_ID,
      label: 'Private chart',
      sunSign: 'cancer',
      state: 'opened',
      createdAt: '2026-07-24T00:00:00.000Z',
      expiresAt: '2026-08-07T00:00:00.000Z',
      openedAt: '2026-07-24T01:00:00.000Z',
      closedAt: null,
      hiddenAt: null,
    }]);
    expect(JSON.stringify(rows)).not.toMatch(/positions|token|email|notify/iu);
  });
});
