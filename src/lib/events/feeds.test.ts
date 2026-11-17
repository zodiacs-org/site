import { describe, expect, it } from 'vitest';
import { SIGNS } from '../signs';
import { eventsPublication } from './site-publication';
import { eventsJsonFeed, feedEvents, signEventsRss } from './feeds';

describe('the sky-event feeds', () => {
  it('splits the timeline by the signs each event takes place in, losing none', () => {
    const covered = new Set<string>();
    for (const sign of SIGNS) {
      const events = feedEvents(sign.slug);
      expect(events.length, sign.slug).toBeGreaterThan(0);
      for (const event of events) {
        expect(event.signs).toContain(sign.slug);
        covered.add(event.id);
      }
    }
    expect(covered.size).toBe(eventsPublication.timeline.length);
  });

  it('writes one RSS item per event in a sign, each linking its own page', () => {
    for (const sign of SIGNS) {
      const xml = signEventsRss(sign);
      const events = feedEvents(sign.slug);
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"')).toBe(true);
      expect((xml.match(/<item>/g) ?? []).length).toBe(events.length);
      expect(xml).toContain(`<atom:link href="https://zodiacs.org/feeds/events/${sign.slug}.xml" rel="self"`);
      for (const event of events) expect(xml).toContain(`<link>https://zodiacs.org${event.path}</link>`);
      expect(xml).not.toMatch(/[‒-―]/u);
    }
  });

  it('writes a JSON Feed 1.1 with every event in time order and its UTC instant', () => {
    const feed = eventsJsonFeed();
    expect(feed.version).toBe('https://jsonfeed.org/version/1.1');
    expect(feed.feed_url).toBe('https://zodiacs.org/feeds/events.json');
    expect(feed.items).toHaveLength(eventsPublication.timeline.length);
    const times = feed.items.map((item) => item.date_published);
    expect(times).toEqual([...times].sort());
    for (const item of feed.items) {
      expect(item.url).toMatch(/^https:\/\/zodiacs\.org\//);
      expect(item._zodiacs.at_utc).toBe(item.date_published);
      expect(new Date(item.date_published).toISOString()).toBe(item.date_published);
      expect(item.id).toMatch(/^https:\/\/zodiacs\.org\/feeds\/events\//);
    }
    expect(new Set(feed.items.map((item) => item.id)).size).toBe(feed.items.length);
    expect(feed._zodiacs.per_sign).toHaveLength(12);
    expect(JSON.stringify(feed)).not.toMatch(/[‒-―]/u);
  });

  it('gives each sign its own JSON Feed with the same items as its RSS feed', () => {
    for (const sign of SIGNS) {
      const feed = eventsJsonFeed(sign);
      expect(feed.feed_url).toBe(`https://zodiacs.org/feeds/events/${sign.slug}.json`);
      expect(feed.items.map((item) => item._zodiacs.event_id)).toEqual(feedEvents(sign.slug).map((event) => event.id));
      expect('per_sign' in feed._zodiacs).toBe(false);
    }
  });

  it('carries no personal or birth data field', () => {
    const text = JSON.stringify(eventsJsonFeed());
    expect(text).not.toMatch(/birth|natal|"name":"(?!Zodiacs\.org)/iu);
  });
});
