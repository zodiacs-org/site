/** Build-time only: the feed's events in the shape the month view draws. */
import type { CatalogLocale } from '../i18n/core';
import { skyCalendarEvents } from './sky-calendar';
import { localizePath } from '../i18n';
import type { SkyMonthEvent, SkyMonthKind } from './sky-month';

export function skyMonthEvents(locale: CatalogLocale): SkyMonthEvent[] {
  return skyCalendarEvents(locale).map((event) => {
    const id = event.id;
    const kind: SkyMonthKind = id.startsWith('new-moon') ? 'new'
      : id.startsWith('full-moon') ? 'full'
      : id.startsWith('solar-eclipse') ? 'solar'
      : id.startsWith('lunar-eclipse') ? 'lunar'
      : 'retro';
    const href = kind === 'retro' ? '/retrogrades/' : kind === 'solar' || kind === 'lunar' ? '/eclipses/' : '/moon-phase/';
    return {
      kind,
      at: String(event.start),
      ...(event.end ? { end: String(event.end) } : {}),
      label: event.summary,
      ...(locale === 'en' || localizePath(locale, href).startsWith(`/${locale}/`) ? { href: localizePath(locale, href) } : {}),
    };
  });
}

