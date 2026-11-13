import type { APIRoute } from 'astro';
import eclipseData from '../../data/eclipses.json';
import { signBySlug } from '../../lib/signs';
import { serializeSkyEvents, type SkyCalendarEvent } from '../../lib/ical';
import { isInvisiblePenumbral, penumbralMagnitude } from '../../lib/nasa-lunar-eclipses';

export const prerender = true;

const YEAR = 2027;

interface EclipseEntry {
  type: 'solar' | 'lunar';
  kind: string;
  peak: string;
  sign: string;
}

const events: SkyCalendarEvent[] = (eclipseData.eclipses as EclipseEntry[])
  .filter((eclipse) => eclipse.peak.startsWith(`${YEAR}-`))
  .map((eclipse) => {
    const day = eclipse.peak.slice(0, 10);
    const sign = signBySlug(eclipse.sign);
    const kind = eclipse.kind === 'annular' ? 'Annular' : eclipse.kind[0].toUpperCase() + eclipse.kind.slice(1);
    return {
      id: `eclipse-${day}-${eclipse.type}`,
      start: eclipse.peak,
      summary: `${kind} ${eclipse.type} eclipse in ${sign.name}`,
      description: `${kind} ${eclipse.type} eclipse, peak at ${eclipse.peak.slice(11, 16)} UTC on ${day}, in ${sign.name}.${
        eclipse.type === 'lunar' && isInvisiblePenumbral(eclipse.peak, eclipse.kind)
          ? ` So slight that no eye or camera will see it: NASA gives a penumbral magnitude of ${penumbralMagnitude(eclipse.peak)}.`
          : ''
      } Computed by Zodiacs.org.`,
      url: `https://zodiacs.org/eclipses/${YEAR}/#eclipse-${day}-${eclipse.type}`,
    };
  });

const calendar = serializeSkyEvents(events, {
  generatedAt: eclipseData.generatedAt,
  calendarName: `Zodiacs.org eclipses ${YEAR}`,
});

export const GET: APIRoute = () => new Response(calendar, {
  headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="zodiacs-eclipses-${YEAR}.ics"`,
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
  },
});
