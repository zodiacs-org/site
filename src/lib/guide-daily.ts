/**
 * The sign guide's daily card quotes the sign's published daily reading.
 * Nothing here writes or rewrites a sentence: the excerpt is the opening of
 * the edition's first passage, cut at a sentence end, and the date, Moon
 * phase and receipt are the edition's own values.
 */
import type { HoroscopeProgramPageReading } from './horoscope-page-data';

export interface GuideDailyExcerpt {
  editionDate: string;
  /** 'Friday, October 16' (UTC, the edition's own day). */
  dateLabel: string;
  /** 'Waxing crescent', from the edition's Moon marker, when it has one. */
  moonPhase: string | null;
  /** The first sentences of the first passage, verbatim. */
  excerpt: string;
  /** The first passage's sky receipt, e.g. 'Moon 29.5° Sagittarius at 12:00 UTC'. */
  receipt: string | null;
}

/** Longest excerpt the card takes before it stops at one sentence. */
export const GUIDE_DAILY_MAX = 220;

/** The passage's first two sentences, or its first alone when two run long. */
export function openingSentences(text: string, max = GUIDE_DAILY_MAX): string {
  // A sentence ends at . ! or ? (and any closing quote) before a space and a
  // capital, so a decimal like 29.5° never splits one.
  const sentences = text.trim().split(/(?<=[.!?][’”"')\]]*)\s+(?=[A-Z“"‘'(])/u);
  const first = sentences[0].trim();
  const two = sentences.length > 1 ? `${first} ${sentences[1].trim()}` : first;
  return two.length <= max ? two : first;
}

export function guideDailyExcerpt(reading: HoroscopeProgramPageReading): GuideDailyExcerpt {
  const editionDate = reading.datePublished.slice(0, 10);
  const first = reading.sections[0];
  if (!first?.body) throw new Error('guideDailyExcerpt: the reading has no first passage');
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${editionDate}T00:00:00.000Z`));
  const moon = reading.skyStrip.markers.find((marker) => marker.label === 'Moon');
  const phase = moon?.value.split(' · ')[0]?.trim() ?? '';
  const moonPhase = phase && !/\d/u.test(phase)
    ? phase.charAt(0).toUpperCase() + phase.slice(1).toLowerCase()
    : null;
  return {
    editionDate,
    dateLabel,
    moonPhase,
    excerpt: openingSentences(first.body),
    receipt: first.receipt ?? null,
  };
}
