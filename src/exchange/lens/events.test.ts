import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventDay, eventICS, foldICSLine, formatEventDate, formatEventTime, isSkyEvent, loadEventManifest, loadEvents } from './events';
import type { EventManifest, SkyEvent } from './types';

const event: SkyEvent = { id: 'new-moon-example', family: 'lunation', subtype: 'new', title: 'New moon', at: '2026-10-01T23:45:30.500Z', bodies: ['Moon', 'Sun'], interpretation: 'Traditionally associated with beginnings.', provenance: { catalog: 'src/data/transits-2026-10.json', sha256: 'a'.repeat(64), engineVersion: '0.1.1-rc.15', convention: 'Geocentric tropical; UTC exact instant.' } };
const manifest: EventManifest = { schema: 1, generatedAt: '2026-09-30T00:00:00Z', engineVersion: '0.1.1-rc.15', coverage: { start: '2026-09-01T00:00:00Z', end: '2026-11-01T00:00:00Z' }, months: ['2026-09', '2026-10'], supportedFamilies: ['lunation'], limitations: [] };
afterEach(() => vi.unstubAllGlobals());

describe('IANA calendar and exact event times', () => {
  it('groups an event by local date across midnight and fractional offsets', () => {
    expect(eventDay(event, 'UTC')).toBe('2026-10-01');
    expect(eventDay(event, 'Asia/Kathmandu')).toBe('2026-10-02');
    expect(formatEventTime(event, 'Asia/Kathmandu')).toContain('05:30:30');
    expect(formatEventTime(event, 'Asia/Kathmandu')).toContain('GMT+5:45');
    expect(formatEventDate(event, 'Asia/Kathmandu')).toBe('Oct 2, 2026');
  });
  it('uses DST spring and repeated autumn hours from Intl', () => {
    expect(formatEventTime('2026-03-08T06:30:00Z', 'America/New_York')).toContain('01:30:00 GMT-5');
    expect(formatEventTime('2026-03-08T07:30:00Z', 'America/New_York')).toContain('03:30:00 GMT-4');
    expect(formatEventTime('2026-11-01T05:30:00Z', 'America/New_York')).toContain('01:30:00 GMT-4');
    expect(formatEventTime('2026-11-01T06:30:00Z', 'America/New_York')).toContain('01:30:00 GMT-5');
  });
});

describe('ICS export', () => {
  it('preserves precise UTC time, stable UID, escaping, and CRLF', () => {
    const subject = { ...event, title: 'New moon, reflection; note\\text\nBEGIN:malicious' };
    const first = eventICS(subject, new Date('2026-09-30T00:00:00Z'));
    const second = eventICS(subject, new Date('2026-10-01T00:00:00Z'));
    expect(first).toContain('DTSTART:20261001T234530Z\r\n');
    expect(first).toContain('DURATION:PT1M');
    expect(first).toContain('SUMMARY:New moon\\, reflection\\; note\\\\text\\nBEGIN:malicious');
    expect(first.match(/^UID:.+$/m)?.[0]).toBe(second.match(/^UID:.+$/m)?.[0]);
    expect(first.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(first.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
  it('folds non-ASCII at octet boundaries without breaking a character', () => {
    const line = `DESCRIPTION:${'月é'.repeat(50)}`;
    const folded = foldICSLine(line);
    expect(folded.split('\r\n').every((part) => new TextEncoder().encode(part).length <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
});

describe('browser catalog loader', () => {
  it('requests only shards intersecting a UTC range and filters end exclusively', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [event, { ...event, id: 'later', at: '2026-10-02T00:00:00Z' }] });
    vi.stubGlobal('fetch', fetcher);
    const rows = await loadEvents(manifest, { start: '2026-10-01T00:00:00Z', end: '2026-10-02T00:00:00Z' });
    expect(rows).toEqual([event]);
    expect(fetcher.mock.calls[0][0]).toBe('/data/market-lens/events/2026-10.json');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects corrupt shards and unsupported months instead of publishing partial facts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ ...event, at: 'bad' }] }));
    await expect(loadEvents(manifest, ['2026-10'])).rejects.toThrow('invalid');
    await expect(loadEvents(manifest, ['../outside'])).rejects.toThrow('outside');
    expect(isSkyEvent({ ...event, end: '2020-01-01T00:00:00Z' })).toBe(false);
  });
  it('reports missing manifests and rejects duplicate events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadEventManifest()).rejects.toThrow('404');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [event, event] }));
    await expect(loadEvents(manifest, ['2026-10'])).rejects.toThrow('duplicate');
  });
});
