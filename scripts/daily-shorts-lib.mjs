/**
 * The words of the daily short videos (scripts/build-daily-shorts.mjs): which
 * of the day's published sentences each sign's video shows, how they break
 * into lines, how long the video holds them, and the caption the owner pastes
 * when posting by hand.
 *
 * Every reading line is a whole sentence of the sign's published "today"
 * horoscope (src/data/horoscope-program.json, or src/data/horoscope-window.json
 * for the day before or after), copied as the page prints it. Nothing here
 * writes a reading. Sentences that name money or health themes are left out,
 * so a short clip never reads as a money or health prediction out of its
 * context, and a sentence with an em or en dash is never shown.
 *
 * Plain Node, no imports beyond the import-free catalogues, so the vitest
 * suite and the generator read the same rules.
 */
import { OG_SIGNS } from '../src/strings/seo.signs.mjs';

export const SHORTS_SIGNS = Object.freeze(OG_SIGNS.map(({ slug, name, hue }) => Object.freeze({ slug, name, hue })));

/** The label the site's horoscope images print (src/server/result-preview.ts, src/ai-tools/reading-confidence.ts). */
export const SHORTS_CONFIDENCE = 40;
export const shortsConfidenceLabel = (value = SHORTS_CONFIDENCE) => `Sun-sign reading. Reading confidence ${value}%`;

/** The address each video and caption gives. */
export const shortsLink = (slug) => `zodiacs.org/horoscopes/${slug}/`;

/**
 * The reading block's text budget: at most `maxLines` lines of at most
 * `maxChars` characters, which at the video's type size (`fontSize` px
 * Instrument Sans) stay inside `maxWidth` px, clear of the apps' side buttons.
 * The renderer measures each line and shrinks the type if one would not fit.
 */
export const SHORTS_TEXT = Object.freeze({
  maxChars: 34,
  maxLines: 6,
  maxSentences: 3,
  fontSize: 48,
  maxWidth: 840,
});

/** Seconds: the open before the first sentence, the pause between sentences, reading speed, the close, and the bounds. */
export const SHORTS_TIMING = Object.freeze({
  intro: 2.2,
  wordsPerSecond: 2.6,
  minSentence: 2.2,
  outro: 2.4,
  minBody: 11,
  maxBody: 17,
});

const DASHES = /[\u2012\u2013\u2014\u2015\u2212]/u;

/** Words that would make a clip read as a money, health, betting or market prediction. */
const LEFT_OUT = /\b(financ\w*|debts?|money|budget\w*|cost\w*|invest\w*|income|salary|loans?|price\w*|market\w*|crypto\w*|tokens?|health\w*|medical|illness\w*|heal\w*|bet|bets|betting|gambl\w*|lottery|guarantee\w*|wins?|winning)\b/iu;

export const hasDash = (text) => DASHES.test(text);

/** A sentence the video may show: no dash, and no money, health or betting theme. */
export const isShowable = (sentence) => !hasDash(sentence) && !LEFT_OUT.test(sentence);

/** The sentences of a passage, each with its full stop. */
export function sentencesOf(text) {
  return String(text)
    .replace(/\s+/gu, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z‘“"'])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Greedy word wrap at `maxChars`; a word longer than the line stands alone. */
export function wrapLines(text, maxChars = SHORTS_TEXT.maxChars) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/u).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The same words in the same number of lines as `wrapLines`, with the lines
 * as even as they can be, so a sentence does not end on one stranded word.
 */
export function balanceLines(text, maxChars = SHORTS_TEXT.maxChars) {
  const greedy = wrapLines(text, maxChars);
  let best = greedy;
  for (let width = maxChars - 1; width > 0; width -= 1) {
    const lines = wrapLines(text, width);
    if (lines.length !== greedy.length || lines.some((line) => line.length > width && line.includes(' '))) break;
    best = lines;
  }
  return best;
}

/**
 * The sentences a sign's video shows, in the published order: whole sentences
 * from the passages, skipping any that `isShowable` refuses, until three are
 * chosen; a sentence that would pass the line budget is passed over for a
 * shorter one after it.
 *
 * @param {{ text: string }[]} passages
 * @returns {{ text: string, lines: string[] }[]}
 */
export function pickSentences(passages, budget = SHORTS_TEXT) {
  const picked = [];
  let lines = 0;
  for (const sentence of passages.flatMap((passage) => sentencesOf(passage.text))) {
    if (!isShowable(sentence)) continue;
    const wrapped = balanceLines(sentence, budget.maxChars);
    if (lines + wrapped.length > budget.maxLines) continue;
    picked.push({ text: sentence, lines: wrapped });
    lines += wrapped.length;
    if (picked.length >= budget.maxSentences) break;
  }
  return picked;
}

const wordCount = (text) => String(text).split(/\s+/u).filter(Boolean).length;

/**
 * The timeline of one video's main part, in seconds: when each sentence comes
 * in, and how long the part runs before the end card.
 */
export function shortsTimeline(sentences, timing = SHORTS_TIMING) {
  let at = timing.intro;
  const starts = sentences.map((sentence) => {
    const start = at;
    at += Math.max(timing.minSentence, wordCount(sentence.text) / timing.wordsPerSecond);
    return start;
  });
  const body = Math.min(timing.maxBody, Math.max(timing.minBody, at + timing.outro));
  return { starts, body };
}

/** "November 5, 2026" for a YYYY-MM-DD day. */
export function longDate(day) {
  const date = new Date(`${day}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day) || Number.isNaN(date.getTime())) throw new Error(`Not a date: ${day}`);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

const HASHTAG_WORD = (name) => name.toLowerCase().replace(/[^a-z]/gu, '');

/** The caption the owner pastes with a sign's video. */
export function shortsCaption({ slug, name, day, sentences }) {
  const hook = sentences[0]?.text;
  if (!hook) throw new Error(`No sentence to quote for ${slug}`);
  const caption = [
    `${name} daily horoscope for ${longDate(day)}`,
    '',
    hook,
    '',
    `More for ${name}: ${shortsLink(slug)}`,
    shortsConfidenceLabel(),
    '',
    [`#${HASHTAG_WORD(name)}`, '#horoscope', '#dailyhoroscope', '#astrology', '#zodiac'].join(' '),
    '',
  ].join('\n');
  if (hasDash(caption)) throw new Error(`The ${slug} caption carries a dash`);
  return caption;
}

/**
 * The day's "today" reading for each sign: from the published program when
 * its anchor date is `day` (or no day is asked for), otherwise from the
 * horoscope window's edition for that day.
 */
export function todayReadings({ program, window: horoscopeWindow, day }) {
  const anchor = day ?? program.anchorDate;
  let bySign;
  if (program.anchorDate === anchor) {
    bySign = new Map(program.signs.map((entry) => [entry.sign, entry.readings.today]));
  } else {
    const edition = horoscopeWindow?.editions?.find((entry) => entry.anchorDate === anchor);
    if (!edition) {
      const known = [program.anchorDate, ...(horoscopeWindow?.editions ?? []).map((entry) => entry.anchorDate)];
      throw new Error(`No published daily horoscope for ${anchor}; published days: ${[...new Set(known)].join(', ')}`);
    }
    bySign = new Map(Object.entries(edition.signs).map(([sign, readings]) => [sign, readings.today]));
  }
  return {
    day: anchor,
    signs: SHORTS_SIGNS.map((sign) => {
      const reading = bySign.get(sign.slug);
      if (!reading || reading.status !== 'publishable') throw new Error(`${sign.name}: no publishable reading for ${anchor}`);
      if (reading.period?.from !== anchor) throw new Error(`${sign.name}: the reading is for ${reading.period?.from}, not ${anchor}`);
      const sentences = pickSentences(reading.passages);
      if (!sentences.length) throw new Error(`${sign.name}: no sentence of the ${anchor} reading can be shown`);
      return { ...sign, day: anchor, sentences };
    }),
  };
}
