import { describe, expect, it } from 'vitest';
import { refFrom } from './server';
import { executeAiTool, refUrl } from './tools';

const on = { now: () => new Date('2026-10-11T12:00:00Z'), occasions: true };

describe('?ref= on zodiacs.org links from the tools', () => {
  it('adds the assistant before any # and leaves other sites alone', () => {
    expect(refUrl('https://zodiacs.org/methodology/', 'chatgpt')).toBe('https://zodiacs.org/methodology/?ref=chatgpt');
    expect(refUrl('https://zodiacs.org/occasions/#o=wedding&d=2027-06-12', 'assistant')).toBe('https://zodiacs.org/occasions/?ref=assistant#o=wedding&d=2027-06-12');
    expect(refUrl('https://zodiacs.org/a/?x=1', 'chatgpt')).toBe('https://zodiacs.org/a/?x=1&ref=chatgpt');
    expect(refUrl('https://example.com/', 'chatgpt')).toBe('https://example.com/');
  });

  it('knows ChatGPT by its openai/ metadata and counts every other host as an assistant', () => {
    expect(refFrom({ 'openai/userLocation': { timezone: 'Europe/Rome' } })).toBe('chatgpt');
    expect(refFrom({ progressToken: 1 })).toBe('assistant');
    expect(refFrom(undefined)).toBe('assistant');
  });

  it('tags the links and the card address of a result, and nothing without a ref', async () => {
    const tagged = await executeAiTool('get_life_milestones', { birthDate: '1997-03-15' }, on, { ref: 'chatgpt' });
    expect(tagged.ok).toBe(true);
    if (tagged.ok && tagged.tool === 'get_life_milestones') {
      expect(tagged.data.cardUrl).toBe('https://zodiacs.org/occasions/milestones/?ref=chatgpt#b=1997-03-15');
      for (const link of tagged.links) expect(link.url).toMatch(/\?ref=chatgpt$/u);
    }
    const calendar = await executeAiTool('get_sky_calendar', {}, on, { ref: 'chatgpt' });
    expect(calendar).toMatchObject({ ok: true, data: { feedUrl: 'https://zodiacs.org/sky-calendar.ics', pageUrl: 'https://zodiacs.org/sky-calendar/?ref=chatgpt' } });
    const plain = await executeAiTool('get_life_milestones', { birthDate: '1997-03-15' }, on);
    if (plain.ok && plain.tool === 'get_life_milestones') expect(JSON.stringify(plain)).not.toContain('ref=');
  });

  it('offers the complete printable occasion link without losing its place or local clock', async () => {
    const result = await executeAiTool('get_occasion_sky', {
      occasion: 'wedding', date: '2027-06-12', time: '17:00', zone: 'Europe/Rome',
      latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy',
    }, on, { ref: 'chatgpt' });
    if (!result.ok || result.tool !== 'get_occasion_sky') throw new Error('expected a card');
    expect(result.links[0]).toEqual({ title: 'Open the printable card', url: result.data.cardUrl });
    const url = new URL(result.links[0].url);
    expect([...url.searchParams]).toEqual([['ref', 'chatgpt']]);
    expect(Object.fromEntries(new URLSearchParams(url.hash.slice(1)))).toEqual({
      o: 'wedding', d: '2027-06-12', t: '17:00', tz: 'Europe/Rome',
      lat: '43.7696', lon: '11.2558', place: 'Florence, Italy',
    });

    const noPlace = await executeAiTool('get_occasion_sky', {
      occasion: 'wedding', date: '2027-06-12', time: '17:00', zone: 'Europe/Rome',
    }, on, { ref: 'chatgpt' });
    if (!noPlace.ok || noPlace.tool !== 'get_occasion_sky') throw new Error('expected a card');
    expect(noPlace.data.cardUrl).toBeNull();
    expect(noPlace.links[0].url).toBe('https://zodiacs.org/occasions/?ref=chatgpt');
  });
});
