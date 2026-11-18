/**
 * The website's public sky calendar feed (/sky-calendar.ics and its
 * localized copies). It is src/lib/return-visits/sky-calendar.ts with two
 * site-only refinements, applied here because the AI tools and the published
 * developer plugin bundle that module byte for byte:
 *
 * - each retrograde window starts and ends at NASA JPL Horizons' station
 *   instants (src/lib/nasa-instants.ts), as the pages print them; a window
 *   clipped at the feed's edge keeps its edge;
 * - a lunar eclipse too slight to be seen says so
 *   (src/lib/nasa-lunar-eclipses.ts);
 * - an event the site gives its own dated page (a new or full Moon, an
 *   eclipse, a retrograde station; src/lib/events/site-publication.ts) links
 *   to that page in its URL and at the end of its description, since some
 *   calendar apps, Google Calendar among them, show no URL field.
 */
import sky from '../data/sky.json';
import eclipses from '../data/eclipses.json';
import { serializeSkyEvents, type SkyCalendarEvent } from './ical';
import type { CatalogLocale } from './i18n/core';
import { nasaStationAt } from './nasa-instants';
import { isInvisiblePenumbral, penumbralMagnitude } from './nasa-lunar-eclipses';
import { skyCalendarEvents } from './return-visits/sky-calendar';
import { returnText } from './return-visits/copy';
import { eventsPublication } from './events/site-publication';

const UNSEEN: Record<CatalogLocale, (magnitude: string) => string> = {
  en: (m) => `So slight that no eye or camera will see it: NASA gives a penumbral magnitude of ${m}.`,
  es: (m) => `Tan leve que ningún ojo ni cámara lo verá: la NASA le da una magnitud penumbral de ${m.replace('.', ',')}.`,
  pt: (m) => `Tão leve que nenhum olho nem câmera o verá: a NASA lhe dá uma magnitude penumbral de ${m.replace('.', ',')}.`,
  fr: (m) => `Si faible qu’aucun œil ni aucun appareil photo ne la verra : la NASA lui donne une magnitude pénombrale de ${m.replace('.', ',')}.`,
  it: (m) => `Così lieve che nessun occhio né fotocamera la vedrà: la NASA le dà una magnitudine penombrale di ${m.replace('.', ',')}.`,
  ru: (m) => `Настолько слабое, что его не увидит ни глаз, ни камера: NASA даёт полутеневую фазу ${m.replace('.', ',')}.`,
};

const retrogradeById = new Map(sky.retrogrades.map((window) => [`${window.planet}-retrograde-${window.from}`, window]));
const eclipseById = new Map(eclipses.eclipses.map((eclipse) => [`${eclipse.type}-eclipse-${eclipse.peak}`, eclipse]));

const SITE = 'https://zodiacs.org';
/** Dated event pages only: a timeline entry whose path is a hub or a hub anchor has no page of its own. */
const ownPage = (path: string) => /\/\d{4}-\d{2}-\d{2}\/$/.test(path) || (path.startsWith('/events/') && path !== '/events/');
const timeline = eventsPublication.timeline.filter((event) => ownPage(event.path));
const lunationPage = new Map(timeline.filter((e) => e.family === 'lunation').map((e) => [`${e.subtype}-moon-${e.anchor}`, e.path]));
const eclipsePage = new Map(timeline.filter((e) => e.family === 'eclipse').map((e) => [`${e.subtype}-eclipse-${e.anchor}`, e.path]));
const stationPage = new Map(timeline
  .filter((e) => e.family === 'station' && e.subtype === 'retrograde')
  .map((e) => [`${e.bodies[0]}-retrograde-${e.anchor}`, e.path]));

/** The site's own dated page for a feed event, as an absolute URL, when it has one. */
export function skyCalendarEventPage(id: string): string | undefined {
  const path = lunationPage.get(id) ?? eclipsePage.get(id) ?? stationPage.get(id);
  return path ? `${SITE}${path}` : undefined;
}

/** The event with its own page as its URL and as the description's last words. */
function withOwnPage(event: SkyCalendarEvent): SkyCalendarEvent {
  const page = skyCalendarEventPage(event.id);
  return page ? { ...event, url: page, description: `${event.description} ${page}` } : event;
}

/** The feed's events with NASA's station instants and the unseen-eclipse note. */
export function siteSkyCalendarEvents(locale: CatalogLocale): SkyCalendarEvent[] {
  return skyCalendarEvents(locale).map((event) => {
    const window = retrogradeById.get(event.id);
    if (window) {
      return {
        ...event,
        start: nasaStationAt(window.planet, window.from) ?? event.start,
        end: window.to ? nasaStationAt(window.planet, window.to) ?? event.end : event.end,
      };
    }
    const eclipse = eclipseById.get(event.id);
    if (eclipse && eclipse.type === 'lunar' && isInvisiblePenumbral(eclipse.peak, eclipse.kind)) {
      return { ...event, description: `${event.description} ${UNSEEN[locale](String(penumbralMagnitude(eclipse.peak)))}` };
    }
    return event;
  }).map(withOwnPage).sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

/** The feed as skyCalendar() writes it, from the site's events. */
export function siteSkyCalendar(locale: CatalogLocale): string {
  const generatedAt = [sky.generatedAt, eclipses.generatedAt].sort().at(-1)!;
  return serializeSkyEvents(siteSkyCalendarEvents(locale), { generatedAt, calendarName: returnText(locale, 'calendarTitle') })
    .replace('CALSCALE:GREGORIAN\r\n', 'CALSCALE:GREGORIAN\r\nREFRESH-INTERVAL;VALUE=DURATION:P1D\r\nX-PUBLISHED-TTL:P1D\r\n');
}

export function siteSkyCalendarResponse(locale: CatalogLocale): Response {
  return new Response(siteSkyCalendar(locale), { headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `inline; filename="zodiacs-sky-${locale}.ics"`,
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'X-Content-Type-Options': 'nosniff',
  } });
}
