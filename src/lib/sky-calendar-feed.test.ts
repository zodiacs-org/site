import { describe, expect, it } from 'vitest';
import sky from '../data/sky.json';
import { CATALOG_LOCALES } from './i18n/core';
import eclipses from '../data/eclipses.json';
import { formatIcalUtc } from './ical';
import { NASA_INSTANTS_REVISED_AT, nasaStationAt } from './nasa-instants';
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

  it('changes nothing but the station times, their revision stamps and the unseen eclipse line', () => {
    const differs = (a: string, b: string) => {
      const la = unfold(a).split('\r\n');
      const lb = unfold(b).split('\r\n');
      return la.filter((line) => !lb.includes(line));
    };
    const changed = differs(siteSkyCalendar('en'), skyCalendar('en'));
    for (const line of changed) expect(line).toMatch(/^(DTSTAMP|LAST-MODIFIED|SEQUENCE|DTSTART|DTEND|DESCRIPTION):/);
    expect(changed.filter((line) => line.startsWith('DESCRIPTION:'))).toEqual([
      expect.stringContaining('So slight that no eye or camera will see it: NASA gives a penumbral magnitude of 0.0014.'),
    ]);
  });

  it('marks each window whose times NASA moved, and moves the file stamp with it', () => {
    const revisedAt = [sky.generatedAt, eclipses.generatedAt, NASA_INSTANTS_REVISED_AT].map(formatIcalUtc).sort().at(-1)!;
    expect(revisedAt).toBe(formatIcalUtc(NASA_INSTANTS_REVISED_AT));
    for (const locale of CATALOG_LOCALES) {
      const ics = unfold(siteSkyCalendar(locale));
      // DTSTAMP was the data's generation time, older than the NASA times the windows now carry.
      expect(new Set(ics.match(/^DTSTAMP:.+$/gm))).toEqual(new Set([`DTSTAMP:${revisedAt}`]));
      const events = new Map(ics.split('BEGIN:VEVENT').slice(1).map((text) => [text.match(/^UID:(.+)$/m)![1], text]));
      let marked = 0;
      for (const window of sky.retrogrades) {
        const event = events.get(`sky-${`${window.planet}-retrograde-${window.from}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}@zodiacs.org`)!;
        expect(event, window.from).toBeDefined();
        const moved = [window.from, window.to].some((at) => at !== null
          && formatIcalUtc(nasaStationAt(window.planet, at) ?? at) !== formatIcalUtc(at));
        if (moved) {
          marked += 1;
          expect(event).toContain(`\r\nLAST-MODIFIED:${revisedAt}\r\n`);
          expect(event).toContain('\r\nSEQUENCE:1\r\n');
        } else {
          expect(event).not.toMatch(/LAST-MODIFIED|SEQUENCE/);
        }
      }
      expect(marked).toBeGreaterThan(sky.retrogrades.length - 5);
      // Lunations and eclipses kept their times, so they carry no revision.
      const unrevised = [...events.values()].filter((text) => !/LAST-MODIFIED/.test(text));
      expect(unrevised.length).toBe(events.size - marked);
    }
  });
});
