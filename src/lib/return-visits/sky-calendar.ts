/** Public, precomputed sky facts only. No chart input is accepted by this feed. */
import sky from '../../data/sky.json';
import eclipses from '../../data/eclipses.json';
import { serializeSkyEvents, type SkyCalendarEvent } from '../ical';
import { planetLabel } from '../i18n/astrology';
import type { CatalogLocale } from '../i18n/core';
import { returnText as s } from './copy';

export function skyCalendarEvents(locale: CatalogLocale): SkyCalendarEvent[] {
  const moons = sky.moons.filter((moon) => moon.type === 'new' || moon.type === 'full').map((moon) => ({
    id: `${moon.type}-moon-${moon.at}`, start: moon.at,
    summary: s(locale, moon.type === 'new' ? 'newMoon' : 'fullMoon'),
    description: s(locale, 'calendarEventNote'), url: 'https://zodiacs.org/methodology/',
  }));
  const peaks = eclipses.eclipses.map((eclipse) => ({
    id: `${eclipse.type}-eclipse-${eclipse.peak}`, start: eclipse.peak,
    summary: s(locale, eclipse.type === 'solar' ? 'solarEclipse' : 'lunarEclipse'),
    description: s(locale, 'eclipseNote'), url: 'https://zodiacs.org/eclipses/',
  }));
  const retrogrades = sky.retrogrades.map((window) => ({
    id: `${window.planet}-retrograde-${window.from}`, start: window.from, end: window.to,
    summary: s(locale, 'retrogradeWindow', { planet: planetLabel(locale, window.planet) }),
    description: s(locale, 'retrogradeNote'), url: 'https://zodiacs.org/retrogrades/',
  }));
  return [...moons, ...peaks, ...retrogrades].sort((a, b) => String(a.start).localeCompare(String(b.start)));
}
export function skyCalendar(locale: CatalogLocale): string {
  const generatedAt = [sky.generatedAt, eclipses.generatedAt].sort().at(-1)!;
  return serializeSkyEvents(skyCalendarEvents(locale), { generatedAt, calendarName: s(locale, 'calendarTitle') })
    .replace('CALSCALE:GREGORIAN\r\n', 'CALSCALE:GREGORIAN\r\nREFRESH-INTERVAL;VALUE=DURATION:P1D\r\nX-PUBLISHED-TTL:P1D\r\n');
}
export function skyCalendarResponse(locale: CatalogLocale): Response {
  return new Response(skyCalendar(locale), { headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `inline; filename="zodiacs-sky-${locale}.ics"`,
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'X-Content-Type-Options': 'nosniff',
  } });
}
