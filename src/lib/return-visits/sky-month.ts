/**
 * The month view on /sky-calendar/: the same public events the .ics feed
 * carries, laid out on a month grid. Pure string rendering so the page can
 * render the build month on the server (in UTC) and the visitor's own month
 * in their own time zone once the script runs. No chart input is involved.
 */
import type { CatalogLocale } from '../i18n/core';

export type SkyMonthKind = 'new' | 'full' | 'solar' | 'lunar' | 'retro';

export interface SkyMonthEvent {
  kind: SkyMonthKind;
  at: string;
  end?: string;
  label: string;
  /** The planet's English identifier for a retrograde window. */
  planet?: string;
  /** Absent where the page has no version in the visitor's language. */
  href?: string;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The calendar date (y, m, d) of an instant in a time zone. */
export function zonedDate(iso: string | Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

const linkOpen = (href: string | undefined, cls: string, style = '') =>
  href ? `<a class="${cls}" href="${href}"${style}>` : `<span class="${cls}"${style}>`;
const linkClose = (href: string | undefined) => (href ? '</a>' : '</span>');

const dayKey = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;

const MARK: Record<Exclude<SkyMonthKind, 'retro'>, string> = {
  new: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="var(--void-3)" stroke="var(--ink-2)" stroke-width="1.2"/></svg>',
  full: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.6" fill="var(--sign-cancer)"/></svg>',
  solar: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.6" fill="var(--sign-sagittarius)"/><circle cx="12" cy="9" r="6.6" fill="var(--void-1)"/></svg>',
  lunar: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.6" fill="var(--sign-aries)" opacity="0.85"/></svg>',
};
/** Retrograde stretches as thin bars, one hue per planet. */
const BARRED = ['Mercury', 'Venus', 'Mars'];
const RETRO_HUE: Record<string, string> = {
  Mercury: 'var(--sign-gemini)',
  Venus: 'var(--sign-libra)',
  Mars: 'var(--sign-aries)',
  Jupiter: 'var(--sign-sagittarius)',
  Saturn: 'var(--sign-capricorn)',
  Uranus: 'var(--sign-aquarius)',
  Neptune: 'var(--sign-pisces)',
  Pluto: 'var(--sign-scorpio)',
};

function retroHue(event: SkyMonthEvent, index: number): string {
  const planet = event.planet && event.planet in RETRO_HUE ? event.planet : undefined;
  return planet ? RETRO_HUE[planet] : Object.values(RETRO_HUE)[index % 8];
}

export interface SkyMonthOptions {
  year: number;
  /** 1–12 */
  month: number;
  locale: CatalogLocale;
  timeZone: string;
  /** The day to ring as today, if it falls in this month. */
  today?: { y: number; m: number; d: number };
}

export function skyMonthHtml(events: SkyMonthEvent[], options: SkyMonthOptions): string {
  const { year, month, locale, timeZone, today } = options;
  const lang = locale === 'pt' ? 'pt-BR' : locale;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Monday-first columns.
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const monthStart = dayKey(year, month, 1);
  const monthEnd = dayKey(year, month, daysInMonth);
  const timeFmt = new Intl.DateTimeFormat(lang, { timeZone, hour: '2-digit', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat(lang, { timeZone, day: 'numeric', month: 'short' });
  const weekdayFmt = new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' });

  const points = events.filter((e) => e.kind !== 'retro').map((e) => ({ e, day: zonedDate(e.at, timeZone) }))
    .filter(({ day }) => dayKey(day.y, day.m, day.d) >= monthStart && dayKey(day.y, day.m, day.d) <= monthEnd);
  const retros = events.filter((e) => e.kind === 'retro' && e.end).map((e, index) => {
    const from = zonedDate(e.at, timeZone);
    const to = zonedDate(e.end!, timeZone);
    return { e, hue: retroHue(e, index), from: dayKey(from.y, from.m, from.d), to: dayKey(to.y, to.m, to.d) };
  }).filter((r) => r.from <= monthEnd && r.to >= monthStart);
  // Bars only for the planets whose retrogrades come and go within weeks; the
  // outer planets spend months retrograde, so they stay in the list below.
  const barred = retros.filter((r) => r.e.planet !== undefined && BARRED.includes(r.e.planet));

  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
  const cells: string[] = weekdays.map((w) => `<div class="skym__wd" aria-hidden="true">${escapeHtml(w)}</div>`);
  for (let i = 0; i < lead; i += 1) cells.push('<div class="skym__cell skym__cell--pad" aria-hidden="true"></div>');
  for (let d = 1; d <= daysInMonth; d += 1) {
    const key = dayKey(year, month, d);
    const own = points.filter(({ day }) => day.d === d);
    const bars = barred.filter((r) => key >= r.from && key <= r.to)
      .map((r) => `<span class="skym__bar${key === r.from ? ' skym__bar--start' : ''}${key === r.to ? ' skym__bar--end' : ''}" style="--hue:${r.hue}"></span>`).join('');
    const starts = barred.filter((r) => key === r.from);
    const isToday = today && today.y === year && today.m === month && today.d === d;
    const items = [
      ...own.map(({ e }) => `${linkOpen(e.href, 'skym__ev')}${MARK[e.kind as Exclude<SkyMonthKind, 'retro'>]}<span><b>${escapeHtml(e.label)}</b><time datetime="${e.at}">${escapeHtml(timeFmt.format(new Date(e.at)))}</time></span>${linkClose(e.href)}`),
      ...starts.map((r) => `${linkOpen(r.e.href, 'skym__ev skym__ev--retro', ` style="--hue:${r.hue}"`)}<i aria-hidden="true"></i><span><b>${escapeHtml(r.e.label)}</b><time datetime="${r.e.at}">${escapeHtml(timeFmt.format(new Date(r.e.at)))}</time></span>${linkClose(r.e.href)}`),
    ].join('');
    const dots = [...own.map(({ e }) => `<i class="skym__dot skym__dot--${e.kind}"></i>`), ...starts.map((r) => `<i class="skym__dot" style="--hue:${r.hue}"></i>`)].join('');
    cells.push(`<div class="skym__cell${own.length || starts.length ? ' skym__cell--has' : ''}${isToday ? ' skym__cell--today' : ''}"${isToday ? ' aria-current="date"' : ''}><span class="skym__n">${d}</span><span class="skym__dots" aria-hidden="true">${dots}</span><div class="skym__evs">${items}</div><span class="skym__bars" aria-hidden="true">${bars}</span></div>`);
  }

  const list = [
    ...points.map(({ e }) => ({ at: e.at, html: `<li><span class="skym__mark">${MARK[e.kind as Exclude<SkyMonthKind, 'retro'>]}</span>${linkOpen(e.href, 'skym__name')}${escapeHtml(e.label)}${linkClose(e.href)}<time datetime="${e.at}">${escapeHtml(dateFmt.format(new Date(e.at)))} · ${escapeHtml(timeFmt.format(new Date(e.at)))}</time></li>` })),
    ...retros.map((r) => ({ at: r.e.at, html: `<li><span class="skym__mark skym__mark--retro" style="--hue:${r.hue}"></span>${linkOpen(r.e.href, 'skym__name')}${escapeHtml(r.e.label)}${linkClose(r.e.href)}<time datetime="${r.e.at}">${escapeHtml(dateFmt.format(new Date(r.e.at)))} – ${escapeHtml(dateFmt.format(new Date(r.e.end!)))}</time></li>` })),
  ].sort((a, b) => a.at.localeCompare(b.at)).map((item) => item.html).join('');

  return `<div class="skym__grid">${cells.join('')}</div><ul class="skym__list">${list}</ul>`;
}

export function monthTitle(year: number, month: number, locale: CatalogLocale): string {
  const lang = locale === 'pt' ? 'pt-BR' : locale;
  const text = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 15)));
  return text.charAt(0).toLocaleUpperCase(lang) + text.slice(1);
}
