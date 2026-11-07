import type { APIRoute } from 'astro';
import sky from '../../data/sky.json';
import { bodyLongitude } from '../../lib/engine/full';
import { formatLongitude } from '../../lib/signs';
import { serializeSkyEvents, type SkyCalendarEvent } from '../../lib/ical';
import { nasaStationAt } from '../../lib/nasa-instants';

export const prerender = true;

const YEAR = 2027;

const events: SkyCalendarEvent[] = (sky.retrogrades as { planet: string; from: string; to: string | null }[])
  .filter((window) => window.planet === 'Mercury' && window.to !== null)
  .filter((window) => window.from.startsWith(`${YEAR}-`) || window.to!.startsWith(`${YEAR}-`))
  .map((window) => {
    const from = new Date(window.from);
    const to = new Date(window.to!);
    const day = window.from.slice(0, 10);
    return {
      id: `mercury-retrograde-${day}`,
      // The stations' times are NASA's (src/lib/nasa-instants.ts); the positions are the engine's.
      start: new Date(nasaStationAt('Mercury', window.from) ?? window.from),
      end: new Date(nasaStationAt('Mercury', window.to!) ?? window.to!),
      summary: 'Mercury retrograde',
      description: `Mercury stations retrograde at ${formatLongitude(bodyLongitude('Mercury', from))} on ${day} and direct at ${formatLongitude(bodyLongitude('Mercury', to))} on ${window.to!.slice(0, 10)} (universal time). Station times from NASA JPL Horizons (DE441); positions computed by Zodiacs.org.`,
      url: `https://zodiacs.org/mercury-retrograde/${YEAR}/#mercury-retrograde-${day}`,
    };
  });

const calendar = serializeSkyEvents(events, {
  generatedAt: sky.generatedAt,
  calendarName: `Zodiacs.org Mercury retrograde ${YEAR}`,
});

export const GET: APIRoute = () => new Response(calendar, {
  headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="zodiacs-mercury-retrograde-${YEAR}.ics"`,
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
  },
});
