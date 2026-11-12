import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { HoroscopeProgram } from '../src/lib/horoscope-program-types';
import { SIGNS } from '../src/lib/signs';
import {
  BANNED_WORDS,
  CONFIDENCE_LABEL,
  NOTE_CONFIDENCE,
  POSTAL_ADDRESS_PLACEHOLDER,
  UNSUBSCRIBE_TAG,
  buildMondayNote,
  committedSources,
  copyProblems,
  isWeekStart,
  parseArgs,
  writeMondayNote,
  type NoteSources,
} from './build-monday-note';

const ROOT = resolve(__dirname, '..');
const WEEK = '2026-11-23';
/** Flags off, as a shell with nothing set. */
const sources = (overrides: Partial<NoteSources> = {}): NoteSources => ({ ...committedSources({}), ...overrides });
const tempDirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'monday-note-'));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

/** The text part's sections, keyed by their heading as the text part prints it. */
function sectionsOf(text: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of text.split('\n')) {
    if (/^[A-Z][A-Z ]+$/u.test(line)) {
      current = [];
      sections.set(line, current);
    } else if (current && line.trim()) {
      current.push(line);
    }
  }
  return sections;
}

const FORECAST_SECTIONS = ['ONE THING TO DO', 'ONE DAY TO PROTECT', 'YOUR SUN SIGN THIS WEEK'];

/** Every forecast line in a draft: the readings, the day lines, the thing to do and the day to protect. */
function forecastLines(text: string): string[] {
  const sections = sectionsOf(text);
  const days = [...sections].find(([heading]) => /^(TWO DAYS THAT MATTER|THE DAY THAT MATTERS)$/u.test(heading))?.[1] ?? [];
  return [
    // A day's receipt line is indented beneath it and is a computed fact, not a reading.
    ...days.filter((line) => !line.startsWith('  ')),
    ...FORECAST_SECTIONS.flatMap((heading) => sections.get(heading) ?? []),
  ];
}

function mondaysBetween(from: string, through: string): string[] {
  const weeks: string[] = [];
  for (let time = Date.parse(`${from}T00:00:00.000Z`); time <= Date.parse(`${through}T00:00:00.000Z`); time += 7 * 86_400_000) {
    weeks.push(new Date(time).toISOString().slice(0, 10));
  }
  return weeks;
}

function syntheticProgram(week: string, text: (sign: string) => string): HoroscopeProgram {
  const base = committedSources({}).program;
  const through = new Date(Date.parse(`${week}T00:00:00.000Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  return {
    ...base,
    signs: base.signs.map((entry) => ({
      ...entry,
      readings: {
        ...entry.readings,
        weekly: {
          ...entry.readings.weekly,
          status: 'publishable',
          period: { from: week, through, utcBasis: true },
          passages: [{ text: text(entry.sign), evidenceRefs: [] }],
          text: text(entry.sign),
        },
      },
    })),
  };
}

describe('Monday Note builder', () => {
  const note = buildMondayNote(WEEK, sources());

  it('writes the same bytes for the same week and data', () => {
    const again = buildMondayNote(WEEK, sources());
    expect(again.html).toBe(note.html);
    expect(again.text).toBe(note.text);
    const first = writeMondayNote(note, tempDir());
    const second = writeMondayNote(again, tempDir());
    expect(readFileSync(first.html)).toEqual(readFileSync(second.html));
    expect(readFileSync(first.text)).toEqual(readFileSync(second.text));
    expect(first.html.endsWith(`${WEEK}.html`)).toBe(true);
    expect(first.text.endsWith(`${WEEK}.txt`)).toBe(true);
  });

  it('runs from the command line, writing an HTML and a text file, byte for byte the same twice', () => {
    const out = [tempDir(), tempDir()];
    const env = { ...process.env, PUBLIC_GOOD_DAYS_ENABLED: '' };
    for (const dir of out) {
      execFileSync(resolve(ROOT, 'node_modules/.bin/vite-node'), ['--script', 'scripts/build-monday-note.ts', '--week', WEEK, '--out', dir], { cwd: ROOT, env, stdio: 'pipe' });
    }
    for (const ext of ['html', 'txt']) {
      const a = readFileSync(join(out[0], `${WEEK}.${ext}`));
      expect(a).toEqual(readFileSync(join(out[1], `${WEEK}.${ext}`)));
      expect(a.toString('utf8')).toBe(ext === 'html' ? note.html : note.text);
    }
  }, 60_000);

  it('picks the two days that matter from the published sky, with their computed facts', () => {
    expect(note.days.map((day) => day.day).sort()).toEqual(['2026-11-24', '2026-11-29']);
    const sections = sectionsOf(note.text);
    expect(sections.get('TWO DAYS THAT MATTER')).toEqual([
      expect.stringMatching(/^Tuesday, November 24: The full Moon in Gemini .*new Moon on November 9\./u),
      '  Full Moon at 2°20′ Gemini, 14:53 UTC',
      expect.stringMatching(/^Sunday, November 29: Uranus trine Pluto: /u),
      '  Uranus trine Pluto, exact at 11:27 UTC: Uranus 3°31′ Gemini, Pluto 3°31′ Aquarius',
    ]);
    expect(note.subject).toBe('This week: the full Moon in Gemini and Uranus trine Pluto');
  });

  it('has every part of the draft', () => {
    const sections = sectionsOf(note.text);
    expect([...sections.keys()]).toEqual([
      'TWO DAYS THAT MATTER',
      'ONE THING TO DO',
      'ONE DAY TO PROTECT',
      'COMING NEXT WEEK',
      'YOUR SUN SIGN THIS WEEK',
      'A QUESTION FOR NEXT WEEK',
    ]);
    expect(sections.get('ONE THING TO DO')).toEqual([expect.stringMatching(/^On Tuesday, finish or hand off one task/u)]);
    expect(sections.get('ONE DAY TO PROTECT')).toEqual([expect.stringMatching(/^Protect Sunday, November 29: Uranus trine Pluto is exact at 11:27 UTC\./u)]);
    expect(sections.get('COMING NEXT WEEK')).toEqual([
      'Monday, November 30: Sun trine Saturn, exact at 06:01 UTC: Sun 8°01′ Sagittarius, Saturn 8°01′ Aries.',
      'Friday, December 4: Venus enters Scorpio, 08:14 UTC.',
      'Sunday, December 6: Mercury enters Sagittarius, 08:33 UTC.',
    ]);
    const signs = sections.get('YOUR SUN SIGN THIS WEEK')!;
    expect(signs.map((line) => line.split(':')[0])).toEqual(SIGNS.map((sign) => sign.name));
    expect(signs[0]).toBe('Aries: The full Moon in Gemini falls in your third solar house: messages, errands and the people nearby. Answer the message you have been putting off. Reading confidence 40%');
    // The last section runs into the links and the footer, which follow it in the text part.
    expect(sections.get('A QUESTION FOR NEXT WEEK')!.slice(0, 3)).toEqual([
      'What did you finish or hand off at the full Moon?',
      'Reply with one line.',
      "Open today's sky: https://zodiacs.org/today/?ref=note",
    ]);
  });

  it('ends with the postal address placeholder and the provider unsubscribe tag, in both parts', () => {
    for (const part of [note.html, note.text]) {
      expect(part).toContain(POSTAL_ADDRESS_PLACEHOLDER);
      expect(part).toContain(UNSUBSCRIBE_TAG);
      expect(part).not.toContain('unsubscribe.invalid');
    }
    expect(note.html).toContain(`href="${UNSUBSCRIBE_TAG}"`);
    expect(note.text.trimEnd().endsWith(`Unsubscribe: ${UNSUBSCRIBE_TAG}`)).toBe(true);
  });

  it('labels every forecast line by the one confidence rule: 40 for a Sun sign alone', () => {
    expect(NOTE_CONFIDENCE).toBe(40);
    expect(CONFIDENCE_LABEL).toBe('Reading confidence 40%');
    const lines = forecastLines(note.text);
    expect(lines).toHaveLength(2 + 1 + 1 + 12);
    for (const line of lines) expect(line.endsWith(' Reading confidence 40%')).toBe(true);
    expect(note.text.match(/Reading confidence \d+%/gu)).toHaveLength(lines.length);
    expect(note.html.match(/Reading confidence 40%/gu)).toHaveLength(lines.length);
    expect(note.html).not.toMatch(/Reading confidence (?!40%)/u);
  });

  it('prints no banned word and no em or en dash', () => {
    expect(copyProblems(`${note.subject}\n${note.preheader}\n${note.text}`)).toEqual([]);
    expect(copyProblems(note.html)).toEqual([]);
  });

  it('catches the banned words and the dashes it scans for', () => {
    expect(copyProblems('A good week to invest: markets rise.')).toEqual(['banned word "invest"', 'banned word "markets"']);
    expect(copyProblems('Your health will improve.')).toEqual(['banned word "health"', 'banned word "will"']);
    expect(copyProblems('Money comes in. Luck, guaranteed.')).toEqual(['banned word "guaranteed"', 'banned word "luck"', 'banned word "money"']);
    expect(copyProblems('one \u2014 two \u2013 three')).toEqual(['dash U+2013', 'dash U+2014']);
    expect(copyProblems('Share the token with your wallet.')).toEqual(['banned word "token"', 'banned word "wallet"']);
    // Whole words only: a word that merely contains a banned one passes, and so does a hyphen.
    expect(copyProblems('Coincide, illustrate, a well-made plan.')).toEqual([]);
    expect(BANNED_WORDS).toEqual(expect.arrayContaining(['health', 'money', 'investment', 'market', 'markets', 'guarantee', 'crypto', 'token']));
  });

  it('links only to /today/, /good-days/ and /your-2027-sky/, with ref=note, and only to pages that are on', () => {
    const hrefs = [...note.html.matchAll(/href="([^"]*)"/gu)].map((match) => match[1]);
    expect(hrefs).toEqual([
      'https://zodiacs.org/today/?ref=note',
      'https://zodiacs.org/your-2027-sky/?ref=note',
      UNSUBSCRIBE_TAG,
    ]);
    // Good Days has a launch flag and a page: both must be on for the link.
    const flagOn = { PUBLIC_GOOD_DAYS_ENABLED: '1' };
    expect(buildMondayNote(WEEK, sources({ env: flagOn, routeExists: (route) => route !== '/good-days/' })).links.map((link) => link.url)).not.toContain('https://zodiacs.org/good-days/?ref=note');
    const built = buildMondayNote(WEEK, sources({ env: flagOn, routeExists: () => true }));
    expect(built.links.map((link) => link.url)).toEqual([
      'https://zodiacs.org/today/?ref=note',
      'https://zodiacs.org/good-days/?ref=note',
      'https://zodiacs.org/your-2027-sky/?ref=note',
    ]);
    for (const value of ['', '0', 'true', ' 1']) {
      expect(buildMondayNote(WEEK, sources({ env: { PUBLIC_GOOD_DAYS_ENABLED: value }, routeExists: () => true })).links).toHaveLength(2);
    }
    const noToday = buildMondayNote(WEEK, sources({ routeExists: (route) => route !== '/today/' }));
    expect(noToday.links.map((link) => link.url)).toEqual(['https://zodiacs.org/your-2027-sky/?ref=note']);
    expect(noToday.html).not.toContain('/today/');
    expect(noToday.text).not.toContain('/today/');
  });

  it('uses the published weekly readings when the committed program covers the week', () => {
    const week = '2026-11-30';
    const built = buildMondayNote(week, sources({ program: syntheticProgram(week, (sign) => `Plain opening for ${sign}. A second sentence stays on the page.`) }));
    expect(built.signLineSource).toBe('published-weekly');
    const lines = sectionsOf(built.text).get('YOUR SUN SIGN THIS WEEK')!;
    expect(lines).toEqual(SIGNS.map((sign) => `${sign.name}: Plain opening for ${sign.slug}. Reading confidence 40%`));
  });

  it('composes every line from the sky when a published opening would break the copy rules, or covers another week', () => {
    const week = '2026-11-30';
    const banned = syntheticProgram(week, (sign) => (sign === 'leo' ? 'Your money matters this week.' : `Plain opening for ${sign}.`));
    expect(buildMondayNote(week, sources({ program: banned })).signLineSource).toBe('composed');
    const otherWeek = syntheticProgram('2026-11-23', (sign) => `Plain opening for ${sign}.`);
    expect(buildMondayNote(week, sources({ program: otherWeek })).signLineSource).toBe('composed');
  });

  it('builds the committed program\'s own week', () => {
    const anchor = committedSources({}).program.anchorDate;
    const date = new Date(`${anchor}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const week = date.toISOString().slice(0, 10);
    const built = buildMondayNote(week, sources());
    for (const line of forecastLines(built.text)) expect(line.endsWith(` ${CONFIDENCE_LABEL}`)).toBe(true);
    expect(copyProblems(built.text)).toEqual([]);
  });

  it('writes a clean draft for every week the published data covers, quiet weeks included', () => {
    const shared = sources();
    let quiet = 0;
    for (const week of mondaysBetween('2026-01-05', '2030-12-16')) {
      const built = buildMondayNote(week, shared);
      if (built.days.length < 2) quiet += 1;
      const lines = forecastLines(built.text);
      expect(lines.length, week).toBe(built.days.length + 1 + 1 + 12);
      for (const line of lines) expect(line.endsWith(` ${CONFIDENCE_LABEL}`), `${week}: ${line}`).toBe(true);
      expect(copyProblems(`${built.subject}\n${built.text}`), week).toEqual([]);
      expect(copyProblems(built.html), week).toEqual([]);
      expect(sectionsOf(built.text).get('YOUR SUN SIGN THIS WEEK'), week).toHaveLength(12);
    }
    // 2027-02-22 has no exact event at all; a handful of others have one.
    expect(quiet).toBeGreaterThan(0);
    const empty = buildMondayNote('2027-02-22', shared);
    expect(empty.days).toEqual([]);
    expect(sectionsOf(empty.text).get('THIS WEEK')).toEqual(['No planet changes sign or direction this week, and no aspect is exact.']);
    expect(sectionsOf(empty.text).get('ONE DAY TO PROTECT')).toEqual([expect.stringMatching(/^Protect Sunday, February 28: nothing is exact/u)]);
  });

  it('refuses a day that is not a Monday, and a week past the published data', () => {
    expect(isWeekStart('2026-11-23')).toBe(true);
    expect(isWeekStart('2026-11-24')).toBe(false);
    expect(isWeekStart('2026-02-30')).toBe(false);
    expect(() => buildMondayNote('2026-11-24', sources())).toThrow(/must be a Monday/u);
    expect(() => buildMondayNote('2031-06-02', sources())).toThrow(/No published transits/u);
    expect(() => parseArgs([])).toThrow(/Usage/u);
    expect(() => parseArgs(['--week', WEEK, '--send'])).toThrow(/Unknown argument/u);
    expect(parseArgs(['--week', WEEK]).week).toBe(WEEK);
  });

  it('sends nothing and calls no model: the script has no network, provider or model code', () => {
    const source = readFileSync(resolve(ROOT, 'scripts/build-monday-note.ts'), 'utf8');
    for (const pattern of [/\bfetch\s*\(/u, /node:https?\b/u, /XMLHttpRequest/u, /@anthropic-ai/u, /openai/iu, /daily-resend/u, /email\/provider/u, /web-push/u, /supabase/iu, /process\.env\.[A-Z_]*(KEY|SECRET|TOKEN)/u]) {
      expect(source, String(pattern)).not.toMatch(pattern);
    }
  });
});
