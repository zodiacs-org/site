import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { PEOPLE } from '../../lib/people';
import { renderFromDisk } from '../../../scripts/build-ai-people.mjs';
import {
  PEOPLE_INDEX, TWINS_NOTES, chartTwinsData, chartTwinsInput, famousChartData, famousChartInput,
  findChartTwins, getFamousChart, noonChartNote,
} from './people';

describe('people-index.json', () => {
  it('matches what scripts/build-ai-people.mjs produces', async () => {
    const committed = await readFile(new URL('./people-index.json', import.meta.url), 'utf8');
    expect(committed).toBe(await renderFromDisk());
  });

  it('holds exactly the directory people and no living, protected or deferred record', () => {
    const directory = PEOPLE.filter((person) => person.indexEligibility.eligible).map((person) => person.slug).sort();
    expect(PEOPLE_INDEX.map((person) => person.slug)).toEqual(directory);
    const bySlug = new Map(PEOPLE.map((person) => [person.slug, person]));
    for (const entry of PEOPLE_INDEX) {
      const person = bySlug.get(entry.slug)!;
      expect(person.living).toBe(false);
      expect(person.indexEligibility.eligible).toBe(true);
      expect(entry.moon.sign).toBe(person.moon.uncertain ? null : person.moon.sign);
    }
    for (const person of PEOPLE.filter((candidate) => !candidate.indexEligibility.eligible)) {
      expect(PEOPLE_INDEX.some((entry) => entry.slug === person.slug)).toBe(false);
    }
  });
});

describe('find_chart_twins', () => {
  it('refuses a time without a zone, as get_life_milestones does', () => {
    expect(chartTwinsInput.safeParse({ birthDate: '1990-07-15', time: '08:30' }).success).toBe(false);
    expect(chartTwinsInput.safeParse({ birthDate: '1990-07-15', latitude: 51.5 }).success).toBe(false);
    expect(chartTwinsInput.safeParse({ birthDate: '1990-07-15', zone: 'Europe/London' }).success).toBe(true);
  });

  it('compares the Sun only without a birth time', async () => {
    const localTime = createLocalTimeModule();
    try {
      const { data, links } = await findChartTwins({ birthDate: '1990-07-15' }, localTime);
      expect(chartTwinsData.parse(data)).toEqual(data);
      expect(data.timeKnown).toBe(false);
      expect(data.you).toEqual({ sun: 'cancer', moon: null });
      expect(data.notes).toContain(TWINS_NOTES.noMoon);
      expect(data.total).toBe(PEOPLE_INDEX.filter((person) => person.sun.sign === 'cancer').length);
      expect(data.twins.length).toBe(Math.min(12, data.total));
      expect(data.twins.every((twin) => twin.shares === 'sun' && twin.url === `https://zodiacs.org/people/${twin.slug}/`)).toBe(true);
      expect(data.pageUrl).toBe('https://zodiacs.org/chart-twins/');
      expect(links.map((link) => link.url)).toEqual(['https://zodiacs.org/chart-twins/', 'https://zodiacs.org/people/']);
    } finally { localTime.dispose(); }
  });

  it('adds the Moon with a birth time and puts both-sign matches first', async () => {
    const localTime = createLocalTimeModule();
    try {
      const { data } = await findChartTwins({ birthDate: '1990-07-15', time: '08:30', zone: 'europe/london', longitude: -0.1276, latitude: 51.5072 }, localTime, 'https://example.test');
      chartTwinsData.parse(data);
      expect(data.timeKnown).toBe(true);
      expect(data.you.sun).toBe('cancer');
      expect(data.you.moon).not.toBeNull();
      expect(data.notes).not.toContain(TWINS_NOTES.noMoon);
      const expected = PEOPLE_INDEX.filter((person) => person.sun.sign === 'cancer' || person.moon.sign === data.you.moon).length;
      expect(data.total).toBe(expected);
      const ranks = data.twins.map((twin) => (twin.shares === 'sun-and-moon' ? 0 : 1));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(data.twins[0].url.startsWith('https://example.test/people/')).toBe(true);
    } finally { localTime.dispose(); }
  });

  it('rejects an impossible date', async () => {
    const localTime = createLocalTimeModule();
    try {
      await expect(findChartTwins({ birthDate: '1990-02-30' }, localTime)).rejects.toThrow(RangeError);
    } finally { localTime.dispose(); }
  });
});

describe('get_famous_chart', () => {
  it('finds an exact name', () => {
    const { data, links } = getFamousChart({ name: 'Ada Lovelace' });
    expect(famousChartData.parse(data)).toEqual(data);
    if (!data.found) throw new Error('expected a match');
    expect(data.person.slug).toBe('ada-lovelace');
    expect(data.person.placements).toHaveLength(10);
    expect(data.person.url).toBe('https://zodiacs.org/people/ada-lovelace/');
    expect(data.person.birthdayUrl).toBe('https://zodiacs.org/birthday/december-10/');
    expect(data.note).toBe(noonChartNote(data.person.birthplace));
    expect(links[0].url).toBe(data.person.url);
  });

  it('ignores accents and letter case', () => {
    const { data } = getFamousChart({ name: 'gabriel garcia marquez' });
    expect(data.found && data.person.name).toBe('Gabriel García Márquez');
    const { data: bolivar } = getFamousChart({ name: 'SIMON BOLIVAR' });
    expect(bolivar.found && bolivar.person.slug).toBe(PEOPLE_INDEX.find((person) => person.name === 'Simón Bolívar')!.slug);
  });

  it('matches part of a name and lists the others', () => {
    const { data } = getFamousChart({ name: 'Hepburn' });
    if (!data.found) throw new Error('expected a match');
    expect(data.person.name).toBe('Audrey Hepburn');
    expect(data.alsoMatched.map((person) => person.name)).toEqual(['Katharine Hepburn']);
    const { data: prefix } = getFamousChart({ name: 'Nietz' });
    expect(prefix.found && prefix.person.name).toBe('Friedrich Nietzsche');
  });

  it('says so when the directory has nobody by that name', () => {
    const { data, links } = getFamousChart({ name: 'Zzyzx Nobody' });
    expect(famousChartData.parse(data)).toEqual(data);
    expect(data).toMatchObject({ found: false, suggestions: [], directoryUrl: 'https://zodiacs.org/people/' });
    expect(links).toEqual([{ title: 'Famous birth charts on Zodiacs', url: 'https://zodiacs.org/people/' }]);
    expect(famousChartInput.safeParse({ name: 'A' }).success).toBe(false);
  });
});
