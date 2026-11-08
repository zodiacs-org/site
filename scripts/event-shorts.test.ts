import { describe, expect, it } from 'vitest';
import publication from '../src/data/events-publication.json';
import { eventClock } from '../src/lib/events/format';
import { eventsCatalog } from '../src/lib/events/catalog';
import { nasaStationAt } from '../src/lib/nasa-instants';
import { SHORTS_TEXT, hasDash } from './daily-shorts-lib.mjs';
import { EVENT_SHORTS_FOOTER, INVISIBLE_NOTE, eventShort, eventShorts } from './event-shorts-lib';

const pages = publication.pages as Parameters<typeof eventShort>[0][];
const all = pages.map(eventShort);
const byId = (id: string) => {
  const short = all.find((entry) => entry.id === id);
  if (!short) throw new Error(`no short for ${id}`);
  return short;
};

describe('the sky event short videos', () => {
  it('can make a video of every published event page, within the line budget and without a dash', () => {
    expect(all).toHaveLength(pages.length);
    for (const short of all) {
      const lines = short.sentences.flatMap((sentence) => sentence.lines);
      expect(lines.length, short.id).toBeLessThanOrEqual(SHORTS_TEXT.maxLines);
      for (const line of lines) {
        if (line.includes(' ')) expect(line.length, `${short.id}: ${line}`).toBeLessThanOrEqual(SHORTS_TEXT.maxChars);
      }
      for (const text of [short.name, short.kicker, short.caption, ...short.sentences.map((s) => s.text)]) {
        expect(hasDash(text), `${short.id}: ${text}`).toBe(false);
      }
    }
  });

  it('opens with the page\'s own summary and links the page', () => {
    for (const [index, page] of pages.entries()) {
      expect(all[index].sentences[0].text).toBe(page.summary);
      expect(all[index].address).toBe(`zodiacs.org${page.path}`);
      expect(all[index].caption.startsWith(`${page.title}\n`)).toBe(true);
      expect(all[index].caption).toContain(`More: zodiacs.org${page.path}`);
      expect(all[index].footer).toBe(EVENT_SHORTS_FOOTER);
    }
  });

  it('prints NASA\'s station time for a retrograde, as its page does', () => {
    const page = pages.find((entry) => entry.id === 'mars-retrograde-2027-01-10')!;
    const nasa = nasaStationAt('Mars', page.anchor)!;
    expect(nasa).toBeDefined();
    const short = byId('mars-retrograde-2027-01-10');
    expect(short.at).toBe(nasa);
    expect(short.sentences.at(-1)!.text).toBe(`Mars stations retrograde at ${nasa.slice(11, 16)} UTC.`);
  });

  it('gives every event the time its page prints', () => {
    const catalog = eventsCatalog();
    for (const short of all) {
      const facts = catalog.byId.get(short.id)!.facts;
      const printed = facts.family === 'retrograde' ? facts.start! : facts.at!;
      expect(short.sentences.at(-1)!.text, short.id).toContain(eventClock(printed));
    }
  });

  it('says the 18 July 2027 eclipse cannot be seen, and no other', () => {
    const invisible = all.filter((short) => short.sentences.some((sentence) => sentence.text === INVISIBLE_NOTE));
    expect(invisible.map((short) => short.id)).toEqual(['eclipse-2027-07-18']);
    expect(byId('eclipse-2027-07-18').name).toBe('Penumbral lunar eclipse');
  });

  it('names each kind of event plainly', () => {
    expect(byId('full-moon-2026-11-24')).toMatchObject({ name: 'Full Moon', kicker: 'November 24, 2026, in Gemini' });
    expect(byId('jupiter-enters-virgo-2027-07-26').name).toBe('Jupiter enters Virgo');
    expect(byId('uranus-trine-pluto-2026-11-29')).toMatchObject({ name: 'Uranus trine Pluto', kicker: 'November 29, 2026' });
  });

  it('picks the events of a span in time order, or the ones asked for', () => {
    const span = eventShorts({ from: '2027-07-01T00:00:00Z', days: 31 });
    expect(span.length).toBeGreaterThan(3);
    expect(span.every((short) => short.at >= '2027-07-01' && short.at < '2027-08-01')).toBe(true);
    expect([...span].sort((a, b) => a.at.localeCompare(b.at))).toEqual(span);
    expect(eventShorts({ only: ['eclipse-2027-07-18'] }).map((short) => short.id)).toEqual(['eclipse-2027-07-18']);
    expect(() => eventShorts({ only: ['no-such-event'] })).toThrow(/No published event page/u);
  });
});
