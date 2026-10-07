/**
 * The get_horoscope answer: the reading written for the person's own date,
 * chosen from the assistant window (window.ts) in their time zone. Pure apart
 * from the window passed in; dates and times are formatted for people.
 */
import type { HoroscopeEvidenceReceipt, HoroscopeSign } from '../../lib/horoscope-program-types';
import type { HoroscopeWindow, WindowReading } from './window';

export const HOROSCOPE_URI = 'ui://zodiacs/horoscopes-v1.html';
export const HOROSCOPE_SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const satisfies readonly HoroscopeSign[];
export const HOROSCOPE_FOCUSES = ['general', 'love', 'career'] as const;
export const HOROSCOPE_PERIODS = ['day', 'week'] as const;
export type HoroscopeFocus = typeof HOROSCOPE_FOCUSES[number];
export type HoroscopePeriod = typeof HOROSCOPE_PERIODS[number];
/** Where the time zone came from: the request, the assistant's location hint, or neither (UTC). */
export type ZoneSource = 'request' | 'assistant' | 'default';

export const HOROSCOPE_DISCLOSURE = 'For reflection. Astrology does not establish what will happen in your life.';
const WHY_NOTE = 'These are sky positions we calculate. What they mean is astrological interpretation. Solar houses count signs from your Sun sign; they are not the houses of a personal birth chart.';

export interface HoroscopeRequest {
  sign?: HoroscopeSign;
  period: HoroscopePeriod;
  focus: HoroscopeFocus;
  date?: string;
}

export interface HoroscopeAnswer {
  status: 'available' | 'unavailable' | 'choose-sign';
  sign?: HoroscopeSign;
  signName?: string;
  period: HoroscopePeriod;
  focus: HoroscopeFocus;
  date: string;
  dateLabel: string;
  zone: string;
  zoneLabel: string;
  zoneSource: ZoneSource;
  reading?: { title: string; paragraphs: { heading?: string; text: string }[] };
  why?: { note: string; facts: { text: string; when: string }[]; houses: string[] };
  available?: { date: string; label: string }[];
  message?: string;
  disclosure: string;
}

/** A reading as the panel needs it: fact times stay as instants so the panel shows them on the reader's clock. */
export interface PanelReading {
  status: 'available' | 'unavailable';
  paragraphs: { heading?: string; text: string }[];
  facts: { text: string; at: string }[];
  houses: string[];
  from: string;
  through: string;
}

/** Every reading for one sign in the window, sent only to the panel so it can switch day, week or focus itself. */
export interface HoroscopePanelData {
  sign: HoroscopeSign;
  signName: string;
  requested: { period: HoroscopePeriod; focus: HoroscopeFocus; date?: string; zone?: string };
  days: { date: string; focuses: Record<HoroscopeFocus, PanelReading> }[];
  weeks: PanelReading[];
  note: string;
  disclosure: string;
}

export const cap = (value: string) => value[0].toUpperCase() + value.slice(1);

export function zoneLabel(zone: string): string {
  if (zone === 'UTC' || zone === 'Etc/UTC') return 'UTC';
  return (zone.split('/').pop() ?? zone).replaceAll('_', ' ');
}

export function dateInZone(now: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)!.value).join('-');
}

const noon = (date: string) => new Date(`${date}T12:00:00.000Z`);
const format = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(noon(date));

export function dayLabel(date: string): string {
  return format(date, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function weekLabel(from: string, through: string): string {
  const fromMonth = format(from, { month: 'long' });
  const throughMonth = format(through, { month: 'long' });
  const day = (date: string) => format(date, { day: 'numeric' });
  return fromMonth === throughMonth
    ? `Week of ${day(from)}–${day(through)} ${throughMonth}`
    : `Week of ${day(from)} ${fromMonth} – ${day(through)} ${throughMonth}`;
}

function localWhen(at: string, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(at));
}

function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  return `${value}${['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'}`;
}

/** One plain line per calculated fact, without the UTC-stamped label. */
export function factText(receipt: HoroscopeEvidenceReceipt): string {
  const sign = receipt.sign ? cap(receipt.sign) : '';
  if (receipt.kind === 'body-position') {
    return receipt.degree === undefined ? `${receipt.body} in ${sign}` : `${receipt.body} at ${Math.floor(receipt.degree)}° ${sign}`;
  }
  switch (receipt.eventKind) {
    case 'aspect': return `${receipt.a} ${receipt.eventType} ${receipt.b}`;
    case 'station': return `${receipt.body} turns ${receipt.eventType} in ${sign}`;
    case 'ingress': return `${receipt.body} enters ${sign}`;
    case 'eclipse': return `${cap(receipt.eventType ?? 'solar')} eclipse in ${sign}`;
    default: return receipt.label.replace(/ (?:on [A-Z][a-z]+ \d{1,2}, \d{4} )?at \d{2}:\d{2} UTC$/u, '');
  }
}

function houseText(receipt: HoroscopeEvidenceReceipt): string {
  const placed = receipt.label.split(' maps to ')[0];
  return `${placed}: your ${ordinal(receipt.house ?? 0)} solar house`;
}

function why(window: HoroscopeWindow, reading: WindowReading, zone: string): HoroscopeAnswer['why'] {
  const ids = new Set(reading.passages.flatMap((passage) => passage.evidenceRefs));
  for (const id of [...ids]) {
    const fact = window.evidence[id]?.sourceFactId;
    if (fact) ids.add(fact);
  }
  const receipts = [...ids].map((id) => window.evidence[id]).filter((receipt): receipt is HoroscopeEvidenceReceipt => !!receipt);
  const facts: { text: string; when: string }[] = [];
  for (const receipt of receipts.filter((item) => item.kind !== 'solar-house').sort((left, right) => left.at.localeCompare(right.at))) {
    const fact = { text: factText(receipt), when: localWhen(receipt.at, zone) };
    if (!facts.some((known) => known.text === fact.text && known.when === fact.when)) facts.push(fact);
  }
  const houses = [...new Set(receipts.filter((item) => item.kind === 'solar-house').map(houseText))];
  return { note: WHY_NOTE, facts, houses };
}

/**
 * Resolve a request against the window. `zone` must already be a valid IANA
 * name and `localDate` today's date there.
 */
export function resolveHoroscope(
  window: HoroscopeWindow,
  request: HoroscopeRequest,
  zone: string,
  zoneSource: ZoneSource,
  localDate: string,
): HoroscopeAnswer {
  const date = request.date ?? localDate;
  const focus: HoroscopeFocus = request.period === 'week' ? 'general' : request.focus;
  const base = { period: request.period, focus, date, dateLabel: dayLabel(date), zone, zoneLabel: zoneLabel(zone), zoneSource, disclosure: HOROSCOPE_DISCLOSURE };
  if (!request.sign) return { ...base, status: 'choose-sign' };
  const sign = request.sign;
  const named = { ...base, sign, signName: cap(sign) };
  const dates = window.editions.map((edition) => edition.anchorDate);
  const available = dates.map((value) => ({ date: value, label: dayLabel(value) }));
  let reading: WindowReading | undefined;
  if (request.period === 'week') {
    const edition = window.editions.find((candidate) => candidate.anchorDate === date)
      ?? window.editions.find((candidate) => {
        const week = candidate.signs[sign].weekly.period;
        return week.from <= date && date <= week.through;
      });
    reading = edition?.signs[sign].weekly;
  } else {
    reading = window.editions.find((candidate) => candidate.anchorDate === date)?.signs[sign][focus === 'general' ? 'today' : focus];
  }
  if (!reading) {
    const message = date > dates[dates.length - 1]
      ? `The reading for ${dayLabel(date)} isn't published yet. Each day's reading appears the day before.`
      : `The reading for ${dayLabel(date)} is no longer kept here. Recent readings are on zodiacs.org.`;
    return { ...named, status: 'unavailable', available, message };
  }
  if (reading.status !== 'publishable') {
    const kind = focus === 'general' ? '' : `${focus} `;
    return { ...named, status: 'unavailable', available, message: `There's no ${kind}reading for ${cap(sign)} on ${dayLabel(date)}.` };
  }
  const label = request.period === 'week' ? weekLabel(reading.period.from, reading.period.through) : dayLabel(date);
  const suffix = request.period === 'day' && focus !== 'general' ? ` · ${cap(focus)}` : '';
  return {
    ...named,
    status: 'available',
    dateLabel: label,
    reading: {
      title: `${cap(sign)} · ${label}${suffix}`,
      paragraphs: reading.passages.map((passage) => (passage.heading ? { heading: passage.heading, text: passage.text } : { text: passage.text })),
    },
    why: why(window, reading, zone),
  };
}

function panelReading(window: HoroscopeWindow, reading: WindowReading): PanelReading {
  const ids = new Set(reading.passages.flatMap((passage) => passage.evidenceRefs));
  for (const id of [...ids]) {
    const fact = window.evidence[id]?.sourceFactId;
    if (fact) ids.add(fact);
  }
  const receipts = [...ids].map((id) => window.evidence[id]).filter((receipt): receipt is HoroscopeEvidenceReceipt => !!receipt);
  const facts: { text: string; at: string }[] = [];
  for (const receipt of receipts.filter((item) => item.kind !== 'solar-house').sort((left, right) => left.at.localeCompare(right.at))) {
    const fact = { text: factText(receipt), at: receipt.at };
    if (!facts.some((known) => known.text === fact.text && known.at === fact.at)) facts.push(fact);
  }
  return {
    status: reading.status === 'publishable' ? 'available' : 'unavailable',
    paragraphs: reading.status === 'publishable' ? reading.passages.map((passage) => (passage.heading ? { heading: passage.heading, text: passage.text } : { text: passage.text })) : [],
    facts: reading.status === 'publishable' ? facts : [],
    houses: reading.status === 'publishable' ? [...new Set(receipts.filter((item) => item.kind === 'solar-house').map(houseText))] : [],
    from: reading.period.from,
    through: reading.period.through,
  };
}

export function horoscopePanel(window: HoroscopeWindow, sign: HoroscopeSign, requested: HoroscopePanelData['requested']): HoroscopePanelData {
  const weeks: PanelReading[] = [];
  for (const edition of window.editions) {
    const week = panelReading(window, edition.signs[sign].weekly);
    if (!weeks.some((known) => known.from === week.from)) weeks.push(week);
  }
  return {
    sign,
    signName: cap(sign),
    requested,
    days: window.editions.map((edition) => ({
      date: edition.anchorDate,
      focuses: {
        general: panelReading(window, edition.signs[sign].today),
        love: panelReading(window, edition.signs[sign].love),
        career: panelReading(window, edition.signs[sign].career),
      },
    })),
    weeks,
    note: WHY_NOTE,
    disclosure: HOROSCOPE_DISCLOSURE,
  };
}
