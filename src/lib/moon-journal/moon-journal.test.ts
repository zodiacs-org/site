import { describe, expect, it } from 'vitest';
import sky from '../../data/sky.json';
import { MOON_JOURNAL_COPY } from './copy';
import { cycleAt, journalMarkdown, lunationCalendar, lunationKey, promptFor, upcomingLunations } from './cycle';
import {
  MAX_ENTRY_LENGTH, MOON_JOURNAL_KEY, deleteEverything, probeStorage, readEntries, removeEntry,
  upsertEntry, writeEntries, type JournalStorage,
} from './store';
import { SIGN_SLUGS, type JournalEntry, type Lunation } from './types';

const DASHES = /[\u2012\u2013\u2014\u2015]/;

function memoryStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

const throwing: JournalStorage = {
  getItem: () => { throw new DOMException('denied', 'SecurityError'); },
  setItem: () => { throw new DOMException('denied', 'SecurityError'); },
  removeItem: () => { throw new DOMException('denied', 'SecurityError'); },
};

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'new-2026-11-09',
    phase: 'new',
    sign: 'scorpio',
    at: '2026-11-09T07:02:00.000Z',
    prompt: promptFor({ type: 'new', sign: 'scorpio' }),
    text: 'Starting the garden plan.',
    savedAt: '2026-11-09T20:00:00.000Z',
    ...overrides,
  };
}

/** Every string a copy object holds, functions called with sample values. */
function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [String((value as (...args: unknown[]) => unknown)('Scorpio', 'November 9, 2026'))];
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

describe('Moon journal copy', () => {
  const copy = MOON_JOURNAL_COPY.en;

  it('has a question for every sign at both the new and the full Moon', () => {
    for (const phase of ['new', 'full'] as const) {
      expect(Object.keys(copy.prompts[phase]).sort()).toEqual([...SIGN_SLUGS].sort());
      for (const sign of SIGN_SLUGS) {
        const prompt = copy.prompts[phase][sign];
        expect(prompt.length, `${phase} ${sign}`).toBeGreaterThan(20);
        expect(prompt.endsWith('?'), `${phase} ${sign}`).toBe(true);
      }
    }
    const all = [...Object.values(copy.prompts.new), ...Object.values(copy.prompts.full)];
    expect(new Set(all).size).toBe(24);
  });

  it('asks about starting at the new Moon and about what came to light at the full Moon, never predicting', () => {
    for (const prompt of [...Object.values(copy.prompts.new), ...Object.values(copy.prompts.full)]) {
      expect(prompt).not.toMatch(/\bwill (happen|come|bring)\b|\bguarantee|\bluck|\bmoney\b|\bhealth\b/i);
    }
    expect(copy.prompts.new.aries).toMatch(/starting/);
    expect(copy.prompts.full.aries).toMatch(/come to light/);
  });

  it('uses no em or en dashes anywhere', () => {
    const strings = allStrings(copy);
    expect(strings.length).toBeGreaterThan(60);
    for (const line of strings) expect(line, line).not.toMatch(DASHES);
    expect(copy.ui.deleteAllConfirm(1)).toMatch(/1 entry /);
    expect(copy.ui.deleteAllConfirm(3)).toMatch(/3 entries /);
  });
});

describe('Moon journal storage', () => {
  it('saves, reads back, edits and deletes entries', () => {
    const storage = memoryStorage();
    expect(probeStorage(storage)).toBe('ok');
    expect(storage.data.size).toBe(0); // the probe cleans up after itself
    let entries = upsertEntry([], entry());
    expect(writeEntries(storage, entries)).toEqual({ ok: true });
    expect(readEntries(storage)).toEqual(entries);

    entries = upsertEntry(entries, entry({ text: 'Starting the garden plan, and a letter.' }));
    expect(entries).toHaveLength(1);
    entries = upsertEntry(entries, entry({ id: 'full-2026-11-24', phase: 'full', sign: 'gemini', at: '2026-11-24T14:53:00.000Z' }));
    writeEntries(storage, entries);
    expect(readEntries(storage).map((saved) => saved.id)).toEqual(['full-2026-11-24', 'new-2026-11-09']);

    entries = removeEntry(entries, 'new-2026-11-09');
    writeEntries(storage, entries);
    expect(readEntries(storage).map((saved) => saved.id)).toEqual(['full-2026-11-24']);

    expect(deleteEverything(storage)).toEqual({ ok: true });
    expect(storage.data.has(MOON_JOURNAL_KEY)).toBe(false);
    expect(readEntries(storage)).toEqual([]);
  });

  it('treats an empty note as no entry, and caps a very long one', () => {
    expect(upsertEntry([entry()], entry({ text: '   \n' }))).toEqual([]);
    expect(upsertEntry([], entry({ text: 'x'.repeat(MAX_ENTRY_LENGTH + 50) }))[0].text).toHaveLength(MAX_ENTRY_LENGTH);
  });

  it('reports blocked storage instead of throwing', () => {
    expect(probeStorage(null)).toBe('blocked');
    expect(probeStorage(throwing)).toBe('blocked');
    expect(readEntries(null)).toEqual([]);
    expect(readEntries(throwing)).toEqual([]);
    expect(writeEntries(null, [entry()])).toEqual({ ok: false, reason: 'blocked' });
    expect(writeEntries(throwing, [entry()])).toEqual({ ok: false, reason: 'blocked' });
    expect(deleteEverything(throwing)).toEqual({ ok: false, reason: 'blocked' });
  });

  it('reports a storage that accepts writes but keeps nothing as blocked', () => {
    const forgetful: JournalStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    expect(probeStorage(forgetful)).toBe('blocked');
  });

  it('reports a full quota as full', () => {
    const full: JournalStorage = {
      ...memoryStorage(),
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); },
    };
    expect(writeEntries(full, [entry()])).toEqual({ ok: false, reason: 'full' });
  });

  it('ignores a damaged record and damaged entries', () => {
    const storage = memoryStorage();
    storage.setItem(MOON_JOURNAL_KEY, '{not json');
    expect(readEntries(storage)).toEqual([]);
    storage.setItem(MOON_JOURNAL_KEY, JSON.stringify({ version: 1, entries: [entry(), { id: 'x', phase: 'half' }, null] }));
    expect(readEntries(storage)).toEqual([entry()]);
  });
});

describe('Moon journal cycle', () => {
  const lunations: Lunation[] = [
    { type: 'full', at: '2026-10-26T04:12:00.000Z', sign: 'taurus' },
    { type: 'new', at: '2026-11-09T07:02:00.000Z', sign: 'scorpio' },
    { type: 'full', at: '2026-11-24T14:53:00.000Z', sign: 'gemini' },
    { type: 'new', at: '2026-12-09T00:51:00.000Z', sign: 'sagittarius' },
    { type: 'full', at: '2026-12-24T01:28:00.000Z', sign: 'cancer' },
    { type: 'new', at: '2026-10-10T03:50:00.000Z', sign: 'libra' },
  ];

  it('finds the lunation to write at, the same phase one cycle back, and the next of each', () => {
    const state = cycleAt(lunations, Date.parse('2026-11-15T00:00:00Z'));
    expect(state.current && lunationKey(state.current)).toBe('new-2026-11-09');
    expect(state.previousSamePhase && lunationKey(state.previousSamePhase)).toBe('new-2026-10-10');
    expect(state.nextFull?.at).toBe('2026-11-24T14:53:00.000Z');
    expect(state.nextNew?.at).toBe('2026-12-09T00:51:00.000Z');
    expect(state.nearHorizon).toBe(false);
  });

  it('switches to the full Moon the moment it is exact', () => {
    const state = cycleAt(lunations, Date.parse('2026-11-24T14:53:00.000Z'));
    expect(state.current?.type).toBe('full');
    expect(state.previousSamePhase?.at).toBe('2026-10-26T04:12:00.000Z');
  });

  it('says when the page’s dates are about to run out', () => {
    expect(cycleAt(lunations, Date.parse('2026-12-20T00:00:00Z')).nearHorizon).toBe(true);
  });

  it('has a prompt for every lunation in the committed sky data', () => {
    for (const moon of sky.moons as { type: 'new' | 'full' }[]) {
      for (const sign of SIGN_SLUGS) expect(promptFor({ type: moon.type, sign })).toBeTruthy();
    }
  });

  it('lists the next twelve new and twelve full Moons for the calendar', () => {
    const all: Lunation[] = (sky.moons as { type: 'new' | 'full'; at: string }[])
      .map((moon) => ({ ...moon, sign: 'aries' as const }));
    const upcoming = upcomingLunations(all, Date.parse('2026-11-05T00:00:00Z'));
    expect(upcoming.filter((lunation) => lunation.type === 'new')).toHaveLength(12);
    expect(upcoming.filter((lunation) => lunation.type === 'full')).toHaveLength(12);
    expect(upcoming[0].at > '2026-11-05').toBe(true);

    const calendar = lunationCalendar(all, Date.parse('2026-11-05T00:00:00Z'), (slug) => slug.toUpperCase())!;
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(24);
    expect(calendar).toContain('SUMMARY:New Moon in ARIES');
    expect(calendar).toContain('URL:https://zodiacs.org/moon-journal/');
    expect(calendar).not.toMatch(DASHES);
  });

  it('never puts an entry in the calendar', () => {
    const calendar = lunationCalendar(lunations, Date.parse('2026-11-05T00:00:00Z'), (slug) => slug)!;
    expect(calendar).not.toContain('garden');
    expect(lunationCalendar(lunations, Date.parse('2027-06-01T00:00:00Z'), (slug) => slug)).toBeNull();
  });

  it('exports the journal as Markdown, newest first', () => {
    const markdown = journalMarkdown([
      entry(),
      entry({ id: 'full-2026-11-24', phase: 'full', sign: 'gemini', at: '2026-11-24T14:53:00.000Z', prompt: 'What came to light?', text: 'A clear answer.' }),
    ], {
      downloadedOn: 'November 30, 2026',
      formatDay: (iso) => iso.slice(0, 10),
      signName: (slug) => slug.charAt(0).toUpperCase() + slug.slice(1),
    });
    expect(markdown).toBe([
      '# My Moon journal',
      '',
      'Kept on my own device at zodiacs.org/moon-journal/. Downloaded November 30, 2026.',
      '',
      '## Full Moon in Gemini, 2026-11-24',
      '',
      '*Question: What came to light?*',
      '',
      'A clear answer.',
      '',
      '## New Moon in Scorpio, 2026-11-09',
      '',
      `*Question: ${promptFor({ type: 'new', sign: 'scorpio' })}*`,
      '',
      'Starting the garden plan.',
      '',
    ].join('\n'));
  });
});
