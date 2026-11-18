import { describe, expect, it } from 'vitest';
import sky from '../data/sky.json';
import { CATALOG_LOCALES } from './i18n/core';
import { nasaStationAt } from './nasa-instants';
import { skyCalendar, skyCalendarEvents } from './return-visits/sky-calendar';
import { siteSkyCalendar, siteSkyCalendarEvents, skyCalendarEventPage } from './sky-calendar-feed';

const unfold = (ics: string) => ics.replace(/\r\n /g, '');

describe('the website sky calendar feed', () => {
  it('keeps every event, uid and summary of the bundled feed', () => {
    for (const locale of CATALOG_LOCALES) {
      const site = siteSkyCalendarEvents(locale);
      const bundled = skyCalendarEvents(locale);
      expect(site.map((e) => e.id).sort()).toEqual(bundled.map((e) => e.id).sort());
      expect(site.map((e) => e.summary).sort()).toEqual(bundled.map((e) => e.summary).sort());
      const uids = (ics: string) => unfold(ics).match(/^UID:.+$/gm)!.sort();
      expect(uids(siteSkyCalendar(locale))).toEqual(uids(skyCalendar(locale)));
    }
  });

  it('starts and ends each retrograde window at NASA JPL Horizons station instants', () => {
    const events = new Map(siteSkyCalendarEvents('en').map((e) => [e.id, e]));
    let refined = 0;
    for (const window of sky.retrogrades) {
      const event = events.get(`${window.planet}-retrograde-${window.from}`)!;
      const start = nasaStationAt(window.planet, window.from);
      expect(new Date(event.start).toISOString()).toBe(new Date(start ?? window.from).toISOString());
      if (window.to) {
        const end = nasaStationAt(window.planet, window.to);
        expect(new Date(event.end!).toISOString()).toBe(new Date(end ?? window.to).toISOString());
        if (end) refined += 1;
      }
      if (start) refined += 1;
    }
    // Every station the table holds is refined; only the clipped edges keep the data's instant.
    expect(refined).toBeGreaterThan(sky.retrogrades.length * 2 - 10);
  });

  it('changes nothing but the station times, the unseen eclipse line and the own-page links', () => {
    const bundled = unfold(skyCalendar('en'));
    const bundledLines = new Set(bundled.split('\r\n'));
    const changed = unfold(siteSkyCalendar('en')).split('\r\n').filter((line) => !bundledLines.has(line));
    for (const line of changed) expect(line).toMatch(/^(DTSTART|DTEND|DESCRIPTION|URL):/);
    const withoutLinks = changed
      .filter((line) => line.startsWith('DESCRIPTION:'))
      .map((line) => line.replace(/ https:\/\/zodiacs\.org\/\S+$/, ''))
      .filter((line) => !bundled.includes(line));
    expect(withoutLinks).toEqual([
      expect.stringContaining('So slight that no eye or camera will see it: NASA gives a penumbral magnitude of 0.0014.'),
    ]);
  });

  it('links each new and full Moon, eclipse and retrograde station to its own dated page', () => {
    for (const locale of CATALOG_LOCALES) {
      const events = siteSkyCalendarEvents(locale);
      const moons = events.filter((e) => /^(new|full)-moon-/.test(e.id));
      const eclipses = events.filter((e) => /-eclipse-/.test(e.id));
      expect(moons.length).toBeGreaterThan(100);
      for (const event of [...moons, ...eclipses]) {
        expect(event.url, event.id).toMatch(/^https:\/\/zodiacs\.org\/(new-moon|full-moon|eclipses)\/\d{4}-\d{2}-\d{2}\/$/);
        expect(event.description.endsWith(` ${event.url}`), event.id).toBe(true);
      }
      const windows = events.filter((e) => /-retrograde-/.test(e.id));
      // Mercury, Venus and Mars stations have dated pages; the outer planets' share the /retrogrades/ hub.
      const inner = windows.filter((e) => /^(Mercury|Venus|Mars)-retrograde-/.test(e.id));
      expect(inner.length).toBeGreaterThan(15);
      for (const event of inner) {
        expect(event.url, event.id).toMatch(/^https:\/\/zodiacs\.org\/(mercury|venus|mars)-retrograde\/\d{4}-\d{2}-\d{2}\/$/);
        expect(event.url).toBe(skyCalendarEventPage(event.id));
      }
    }
  });

  it('writes each own page into the calendar file as URL and in the description', () => {
    const ics = unfold(siteSkyCalendar('en'));
    const block = ics.split('BEGIN:VEVENT\r\n').find((b) => b.includes('UID:sky-full-moon-2026-01-03'))!;
    expect(block).toContain('URL:https://zodiacs.org/full-moon/2026-01-03/');
    expect(block).toMatch(/DESCRIPTION:.* https:\/\/zodiacs\.org\/full-moon\/2026-01-03\//);
  });
});
