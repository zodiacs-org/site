/**
 * Where the visitor is in the Moon's cycle, worked out on the device from the
 * lunations the page was built with (the committed sky data, signs read from
 * the full engine at build time), plus the journal's two downloads. No
 * ephemeris runs here: the instants are already exact.
 */
import { serializeSkyEvents, type SkyCalendarEvent } from '../ical';
import { MOON_JOURNAL_COPY, type MoonJournalCopy, type MoonJournalLocale } from './copy';
import type { JournalEntry, Lunation } from './types';

/** 'new-2026-11-09': a lunation's id, by phase and UTC day. */
export function lunationKey(lunation: Pick<Lunation, 'type' | 'at'>): string {
  return `${lunation.type}-${lunation.at.slice(0, 10)}`;
}

export interface CycleState {
  /** The most recent new or full Moon at or before now: the one to write at. */
  current: Lunation | null;
  /** The same phase one cycle earlier, whose note shows beside the prompt. */
  previousSamePhase: Lunation | null;
  nextNew: Lunation | null;
  nextFull: Lunation | null;
  /** True when fewer than two lunations remain in the page's data. */
  nearHorizon: boolean;
}

/** The cycle around an instant. `lunations` need not be sorted. */
export function cycleAt(lunations: readonly Lunation[], nowMs: number): CycleState {
  const sorted = [...lunations].sort((a, b) => a.at.localeCompare(b.at));
  const past = sorted.filter((lunation) => Date.parse(lunation.at) <= nowMs);
  const future = sorted.filter((lunation) => Date.parse(lunation.at) > nowMs);
  const current = past.at(-1) ?? null;
  const previousSamePhase = current
    ? [...past].reverse().find((lunation) => lunation.type === current.type && lunation.at < current.at) ?? null
    : null;
  return {
    current,
    previousSamePhase,
    nextNew: future.find((lunation) => lunation.type === 'new') ?? null,
    nextFull: future.find((lunation) => lunation.type === 'full') ?? null,
    nearHorizon: future.length < 2,
  };
}

/** The question for a lunation, in a locale's words. */
export function promptFor(lunation: Pick<Lunation, 'type' | 'sign'>, locale: MoonJournalLocale = 'en'): string {
  return MOON_JOURNAL_COPY[locale].prompts[lunation.type][lunation.sign];
}

/** The next `perPhase` new Moons and `perPhase` full Moons after now, in time order. */
export function upcomingLunations(lunations: readonly Lunation[], nowMs: number, perPhase = 12): Lunation[] {
  const future = [...lunations]
    .filter((lunation) => Date.parse(lunation.at) > nowMs)
    .sort((a, b) => a.at.localeCompare(b.at));
  const news = future.filter((lunation) => lunation.type === 'new').slice(0, perPhase);
  const fulls = future.filter((lunation) => lunation.type === 'full').slice(0, perPhase);
  return [...news, ...fulls].sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * A calendar of upcoming new and full Moons, each with its journal question.
 * Public sky facts only: it never carries an entry.
 */
export function lunationCalendar(
  lunations: readonly Lunation[],
  nowMs: number,
  signName: (slug: string) => string,
  locale: MoonJournalLocale = 'en',
): string | null {
  const copy: MoonJournalCopy = MOON_JOURNAL_COPY[locale];
  const upcoming = upcomingLunations(lunations, nowMs);
  if (upcoming.length === 0) return null;
  const events: SkyCalendarEvent[] = upcoming.map((lunation) => ({
    id: `moon-journal-${lunationKey(lunation)}`,
    start: lunation.at,
    summary: copy.lunationTitle(lunation.type, signName(lunation.sign)),
    description: copy.ui.calendarDescription(promptFor(lunation, locale)),
    url: 'https://zodiacs.org/moon-journal/',
  }));
  return serializeSkyEvents(events, { generatedAt: new Date(nowMs), calendarName: copy.ui.calendarName });
}

/** The journal as a Markdown file, newest entry first. */
export function journalMarkdown(
  entries: readonly JournalEntry[],
  options: {
    downloadedOn: string;
    formatDay: (iso: string) => string;
    signName: (slug: string) => string;
    locale?: MoonJournalLocale;
  },
): string {
  const copy = MOON_JOURNAL_COPY[options.locale ?? 'en'];
  const lines = [`# ${copy.ui.exportTitle}`, '', copy.ui.exportIntro(options.downloadedOn), ''];
  for (const entry of [...entries].sort((a, b) => b.at.localeCompare(a.at))) {
    lines.push(
      `## ${copy.lunationTitle(entry.phase, options.signName(entry.sign))}, ${options.formatDay(entry.at)}`,
      '',
      `*${copy.ui.exportPrompt}: ${entry.prompt}*`,
      '',
      entry.text.trim(),
      '',
    );
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
