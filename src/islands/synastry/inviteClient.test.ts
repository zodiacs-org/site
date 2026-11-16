import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INVITE_PENDING_COMPLETION_KEY_PREFIX,
  beaconPendingCompletion,
  completeInvite,
  openInviteSession,
  replayPendingCompletion,
} from './inviteClient';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const bodies = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
  'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node',
].map((body, index) => ({ body, lon: index * 29 }));
bodies[0].lon = 95;

const ready = {
  state: 'ready',
  payload: {
    version: 1,
    label: 'Frida',
    sunSign: 'cancer',
    positions: {
      bodies,
      angles: { asc: 120, mc: 30 },
      houseSystem: 'whole',
      engineVersion: '0.1.0',
    },
    timeKnown: true,
    expiresAt: '2026-08-07T00:00:00.000Z',
  },
};
const HANDLE_A = 'A'.repeat(22);
const HANDLE_B = 'B'.repeat(22);

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true, sendBeacon: vi.fn(() => true) },
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete (globalThis as { navigator?: unknown }).navigator;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('Phase 4 invitation browser boundary', () => {
  it('accepts the positions-only ready envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(ready), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    await expect(openInviteSession(HANDLE_A, fetcher as typeof fetch)).resolves.toEqual({
      ...ready,
      handle: HANDLE_A,
    });
    expect(fetcher).toHaveBeenCalledWith(
      `/api/compatibility/invite-session?session=${HANDLE_A}`,
      expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      }),
    );
  });

  it('collapses every non-ready response to one unavailable state', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ state: 'used' }), { status: 200 }));
    await expect(openInviteSession(HANDLE_A, fetcher as typeof fetch))
      .resolves.toEqual({ state: 'unavailable' });
    await expect(openInviteSession('malformed', fetcher as typeof fetch))
      .resolves.toEqual({ state: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reports offline without touching the network', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false, sendBeacon: vi.fn(() => true) },
      configurable: true,
    });
    const fetcher = vi.fn();
    await expect(openInviteSession(HANDLE_A, fetcher as typeof fetch))
      .resolves.toEqual({ state: 'offline' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('persists a failed completion and removes it after a successful replay', async () => {
    const failing = vi.fn(async () => new Response('{}', { status: 503 }));
    await expect(
      completeInvite(HANDLE_A, '2099-08-07T00:00:00.000Z', failing as typeof fetch),
    ).resolves.toBe(false);
    expect(localStorage.getItem(`${INVITE_PENDING_COMPLETION_KEY_PREFIX}${HANDLE_A}`))
      .not.toBeNull();

    const success = vi.fn(async () => new Response(JSON.stringify({ outcome: 'duplicate' }), { status: 200 }));
    await expect(replayPendingCompletion(success as typeof fetch)).resolves.toBe(true);
    expect(localStorage.getItem(`${INVITE_PENDING_COMPLETION_KEY_PREFIX}${HANDLE_A}`))
      .toBeNull();
  });

  it('keeps the replay queued when a generic 200 says unavailable', async () => {
    const unavailable = vi.fn(async () => new Response(
      JSON.stringify({ outcome: 'unavailable' }),
      { status: 200 },
    ));
    await expect(
      completeInvite(HANDLE_A, '2099-08-07T00:00:00.000Z', unavailable as typeof fetch),
    ).resolves.toBe(false);
    expect(localStorage.getItem(`${INVITE_PENDING_COMPLETION_KEY_PREFIX}${HANDLE_A}`))
      .not.toBeNull();
  });

  it('keeps multiple tab handles isolated across replay and rejects malformed handles', async () => {
    const failing = vi.fn(async () => new Response('{}', { status: 503 }));
    await completeInvite(HANDLE_A, '2099-08-07T00:00:00.000Z', failing as typeof fetch);
    await completeInvite(HANDLE_B, '2099-08-08T00:00:00.000Z', failing as typeof fetch);

    const storedA = JSON.parse(String(
      localStorage.getItem(`${INVITE_PENDING_COMPLETION_KEY_PREFIX}${HANDLE_A}`),
    ));
    const storedB = JSON.parse(String(
      localStorage.getItem(`${INVITE_PENDING_COMPLETION_KEY_PREFIX}${HANDLE_B}`),
    ));
    expect(storedA).toMatchObject({
      version: 2,
      handle: HANDLE_A,
      expiresAt: '2099-08-07T00:00:00.000Z',
    });
    expect(storedB).toMatchObject({
      version: 2,
      handle: HANDLE_B,
      expiresAt: '2099-08-08T00:00:00.000Z',
    });

    const replay = vi.fn(async (input: string | URL | Request) => new Response(
      JSON.stringify({
        outcome: String(input).includes(HANDLE_A) ? 'duplicate' : 'unavailable',
      }),
      { status: 200 },
    ));
    await expect(replayPendingCompletion(replay as typeof fetch)).resolves.toBe(true);
    expect(replay.mock.calls.map(([input]) => String(input))).toEqual([
      `/api/compatibility/invite-complete?session=${HANDLE_A}`,
      `/api/compatibility/invite-complete?session=${HANDLE_B}`,
    ]);
    expect(localStorage.getItem(`${INVITE_PENDING_COMPLETION_KEY_PREFIX}${HANDLE_A}`))
      .toBeNull();
    expect(localStorage.getItem(`${INVITE_PENDING_COMPLETION_KEY_PREFIX}${HANDLE_B}`))
      .not.toBeNull();

    const noFetch = vi.fn();
    await expect(
      completeInvite('malformed', '2099-08-09T00:00:00.000Z', noFetch as typeof fetch),
    ).resolves.toBe(false);
    expect(noFetch).not.toHaveBeenCalled();
  });

  it('uses the empty JSON completion body for the page-exit beacon', async () => {
    const failing = vi.fn(async () => new Response('{}', { status: 503 }));
    await completeInvite(HANDLE_A, '2099-08-07T00:00:00.000Z', failing as typeof fetch);
    await completeInvite(HANDLE_B, '2099-08-08T00:00:00.000Z', failing as typeof fetch);
    expect(beaconPendingCompletion()).toBe(true);
    expect(vi.mocked(navigator.sendBeacon).mock.calls.map(([url]) => url)).toEqual([
      `/api/compatibility/invite-complete?session=${HANDLE_A}`,
      `/api/compatibility/invite-complete?session=${HANDLE_B}`,
    ]);
    for (const [, body] of vi.mocked(navigator.sendBeacon).mock.calls) {
      expect(body).toBeInstanceOf(Blob);
    }
  });

  it('carries the recipient consent version through completion, replay and the page-exit beacon, and nothing else', async () => {
    const version = 'invite-recipient-2026-11-16.v1';
    const failing = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response('{}', { status: 503 }));
    await completeInvite(HANDLE_A, '2099-08-07T00:00:00.000Z', failing as typeof fetch, version);
    expect(JSON.parse(String(failing.mock.calls[0]?.[1]?.body))).toEqual({ consentVersion: version });
    expect(JSON.parse(String(localStorage.getItem(`${INVITE_PENDING_COMPLETION_KEY_PREFIX}${HANDLE_A}`))))
      .toMatchObject({ version: 2, handle: HANDLE_A, consentVersion: version });

    expect(beaconPendingCompletion()).toBe(true);
    const beaconBody = vi.mocked(navigator.sendBeacon).mock.calls[0]?.[1] as Blob;
    expect(JSON.parse(await beaconBody.text())).toEqual({ consentVersion: version });

    const replay = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ outcome: 'duplicate' }), { status: 200 }));
    await expect(replayPendingCompletion(replay as typeof fetch)).resolves.toBe(true);
    expect(JSON.parse(String(replay.mock.calls[0]?.[1]?.body))).toEqual({ consentVersion: version });

    // Without a version, or with a malformed one, the body is the released empty object.
    const plain = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ outcome: 'completed' }), { status: 200 }));
    await completeInvite(HANDLE_B, '2099-08-08T00:00:00.000Z', plain as typeof fetch);
    await completeInvite(HANDLE_B, '2099-08-08T00:00:00.000Z', plain as typeof fetch, 'Not A Version');
    expect(plain.mock.calls.map(([, init]) => init?.body)).toEqual(['{}', '{}']);
  });
});
