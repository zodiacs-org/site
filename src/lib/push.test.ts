import { describe, expect, it, vi } from 'vitest';
import {
  PUSH_PREFERENCE_KEY,
  claimPushPrompt,
  fetchTopicStatus,
  isIosDevice,
  leavePushTopic,
  parseTopicStatus,
  isStandaloneDisplay,
  readPushPreference,
  setPushPreference,
  vapidKeyBytes,
} from './push';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe('push prompt preference', () => {
  it('claims the contextual affordance once without invoking browser permission', () => {
    const storage = memoryStorage();
    const requestPermission = vi.fn();
    expect(claimPushPrompt(storage)).toBe(true);
    expect(claimPushPrompt(storage)).toBe(false);
    expect(storage.values.get(PUSH_PREFERENCE_KEY)).toBe('offered');
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('persists dismissal and subscription states', () => {
    const storage = memoryStorage();
    setPushPreference(storage, 'dismissed');
    expect(readPushPreference(storage)).toBe('dismissed');
    setPushPreference(storage, 'subscribed');
    expect(readPushPreference(storage)).toBe('subscribed');
  });

  it('recognizes iOS install requirements and standalone mode', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5) AppleWebKit Mobile/15E148')).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit Mobile/15E148')).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 15) Chrome/136')).toBe(false);
    expect(isStandaloneDisplay({ standalone: true }, () => ({ matches: false }))).toBe(true);
    expect(isStandaloneDisplay({}, () => ({ matches: true }))).toBe(true);
  });

  it('decodes a URL-safe VAPID public key', () => {
    vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'));
    expect([...new Uint8Array(vapidKeyBytes('AQID-_8'))]).toEqual([1, 2, 3, 251, 255]);
    vi.unstubAllGlobals();
  });
});

describe('push topics', () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/example';
  const answer = (body: unknown, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body }));

  it('reads a status answer, and treats one without topics as unknown', async () => {
    expect(parseTopicStatus({ ok: true, topics: { sky: false, lunation: true } })).toEqual({ sky: false, lunation: true });
    expect(parseTopicStatus({ ok: true })).toBeNull();
    expect(parseTopicStatus({ topics: { sky: 'yes', lunation: true } })).toBeNull();

    const fetchImpl = answer({ ok: true, topics: { sky: true, lunation: false } });
    await expect(fetchTopicStatus(endpoint, fetchImpl)).resolves.toEqual({ sky: true, lunation: false });
    const [path, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/push/subscribe');
    // Only the endpoint goes: no keys, no language, nothing else.
    expect(JSON.parse(String(init.body))).toEqual({ action: 'status', endpoint });
    await expect(fetchTopicStatus(endpoint, answer({}, false))).rejects.toThrow(/503/u);
  });

  it('keeps the browser subscription only when the server says another stream uses it', async () => {
    const shared = answer({ ok: true, remaining: true });
    await expect(leavePushTopic(endpoint, 'lunation', shared)).resolves.toBe(true);
    const [, init] = shared.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(String(init.body))).toEqual({ endpoint, topic: 'lunation' });
    await expect(leavePushTopic(endpoint, 'sky', answer({ ok: true, remaining: false }))).resolves.toBe(false);
    await expect(leavePushTopic(endpoint, 'sky', answer({ ok: true }))).resolves.toBe(false);
    await expect(leavePushTopic(endpoint, 'sky', answer({}, false))).rejects.toThrow(/503/u);
  });
});
