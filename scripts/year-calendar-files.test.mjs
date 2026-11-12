import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import sky from '../src/data/sky.json';
import { NASA_INSTANTS_REVISED_AT, nasaStationAt } from '../src/lib/nasa-instants.ts';
import { formatIcalUtc } from '../src/lib/ical.ts';
import { effectiveHeaders } from './lib/vercel-source-pattern.mjs';

/**
 * The 2027 year calendars are prerendered, so the headers their routes set
 * never reach production: Vercel serves the files with its own
 * Content-Disposition, from the file name ("2027.ics" for all three), unless
 * vercel.json gives one. vercel.json carries each route's download name.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));

const routes = {
  '/eclipses/2027.ics': () => import('../src/pages/eclipses/2027.ics.ts'),
  '/full-moon-calendar/2027.ics': () => import('../src/pages/full-moon-calendar/2027.ics.ts'),
  '/mercury-retrograde/2027.ics': () => import('../src/pages/mercury-retrograde/2027.ics.ts'),
};

const unfold = (ics) => ics.replace(/\r\n /g, '');

describe('the 2027 year calendars', () => {
  it('download under their own names in production', async () => {
    const names = new Set();
    for (const [path, load] of Object.entries(routes)) {
      const route = await load();
      expect(route.prerender, path).toBe(true);
      const disposition = route.GET({}).headers.get('Content-Disposition');
      expect(disposition, path).toMatch(/^attachment; filename="zodiacs-[a-z-]+-2027\.ics"$/);
      expect(effectiveHeaders(config, path).get('content-disposition'), path).toBe(disposition);
      names.add(disposition);
    }
    expect(names.size).toBe(Object.keys(routes).length);
  });

  it('mark each Mercury window NASA moved, and stamp the file with the revision', async () => {
    const { GET } = await routes['/mercury-retrograde/2027.ics']();
    const ics = unfold(await GET({}).text());
    const events = ics.split('BEGIN:VEVENT').slice(1);
    expect(events.length).toBeGreaterThan(0);

    const windows = sky.retrogrades.filter((window) => window.planet === 'Mercury' && window.to !== null
      && (window.from.startsWith('2027-') || window.to.startsWith('2027-')));
    const revisedAt = [sky.generatedAt, NASA_INSTANTS_REVISED_AT].map(formatIcalUtc).sort().at(-1);
    for (const window of windows) {
      const event = events.find((text) => text.includes(`UID:sky-mercury-retrograde-${window.from.slice(0, 10)}@zodiacs.org`));
      expect(event, window.from).toBeDefined();
      const moved = formatIcalUtc(nasaStationAt('Mercury', window.from) ?? window.from) !== formatIcalUtc(window.from)
        || formatIcalUtc(nasaStationAt('Mercury', window.to) ?? window.to) !== formatIcalUtc(window.to);
      // Every 2027 Mercury station is in NASA's table and none falls on the engine's second.
      expect(moved, window.from).toBe(true);
      expect(event).toContain(`\r\nLAST-MODIFIED:${revisedAt}\r\n`);
      expect(event).toContain('\r\nSEQUENCE:1\r\n');
      expect(event).toContain(`\r\nDTSTAMP:${revisedAt}\r\n`);
    }
    // The file's stamp is no longer the sky data's generation time.
    expect(revisedAt).not.toBe(formatIcalUtc(sky.generatedAt));
  });

  it('leave the eclipse and full moon files as the data stamps them', async () => {
    for (const path of ['/eclipses/2027.ics', '/full-moon-calendar/2027.ics']) {
      const { GET } = await routes[path]();
      const ics = unfold(await GET({}).text());
      expect(ics, path).not.toContain('LAST-MODIFIED:');
      expect(ics, path).not.toContain('SEQUENCE:');
    }
  });
});
