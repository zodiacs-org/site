import { describe, expect, it } from 'vitest';
import sky from '../data/sky.json';
import { CATALOG_LOCALES } from './i18n/core';
import { nasaStationAt } from './nasa-instants';
import { skyCalendar, skyCalendarEvents } from './return-visits/sky-calendar';
import { siteSkyCalendar, siteSkyCalendarEvents } from './sky-calendar-feed';

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

  it('changes nothing but the station times and the unseen eclipse line', () => {
    const differs = (a: string, b: string) => {
      const la = unfold(a).split('\r\n');
      const lb = unfold(b).split('\r\n');
      return la.filter((line) => !lb.includes(line));
    };
    const changed = differs(siteSkyCalendar('en'), skyCalendar('en'));
    for (const line of changed) expect(line).toMatch(/^(DTSTART|DTEND|DESCRIPTION):/);
    expect(changed.filter((line) => line.startsWith('DESCRIPTION:'))).toEqual([
      expect.stringContaining('So slight that no eye or camera will see it: NASA gives a penumbral magnitude of 0.0014.'),
    ]);
  });
});
