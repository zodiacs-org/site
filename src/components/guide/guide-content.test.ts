import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import programData from '../../data/horoscope-program.json';
import { pageReadingFromProgram } from '../../lib/horoscope-page-data';
import type { HoroscopeProgram } from '../../lib/horoscope-program';
import { guideDailyExcerpt, openingSentences } from '../../lib/guide-daily';
import { guideFacts, guideReadingMinutes, signFigure, signOrdinal } from '../../lib/guide-facts';
import { guideLede, heritage, plainDashes } from '../../lib/legacy/sign-lore';
import { SIGNS } from '../../lib/signs';

const guidesDir = new URL('../../content/guides/', import.meta.url);

async function guideSources() {
  const files = (await readdir(guidesDir)).filter((name) => name.endsWith('.mdx')).sort();
  return Promise.all(files.map(async (name) => ({
    slug: name.replace(/\.mdx$/u, ''),
    source: await readFile(new URL(name, guidesDir), 'utf8'),
  })));
}

/** The guide's prose as a reader meets it: no components, links or emphasis. */
function prose(body: string): string {
  return body
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/[*_]/gu, '')
    .replace(/\s+/gu, ' ');
}

describe('sign guide content for the redesigned template', () => {
  it('pulls quotes only from sentences each guide already says', async () => {
    for (const { slug, source } of await guideSources()) {
      const body = source.slice(source.indexOf('\n---', 3) + 4);
      const pulls = [...body.matchAll(/<GuidePull>([^<]+)<\/GuidePull>/gu)].map((match) => match[1]);
      expect(pulls, `${slug} pull quotes`).toHaveLength(2);
      const text = prose(body.replace(/<GuidePull>[^<]+<\/GuidePull>/gu, ' '));
      for (const pull of pulls) {
        const core = pull.replace(/\.$/u, '');
        const lowered = core.charAt(0).toLowerCase() + core.slice(1);
        expect(text.includes(core) || text.includes(lowered), `${slug}: "${pull}" is not in the guide`).toBe(true);
      }
    }
  });

  it('wraps every guide in the same components, in reading order', async () => {
    for (const { slug, source } of await guideSources()) {
      const order = [...source.matchAll(/<(Guide[A-Za-z]+)\b/gu)].map((match) => match[1]);
      expect(order, slug).toEqual([
        'GuidePull',
        'GuideEdges', 'GuideEdge', 'GuideEdge',
        'GuidePull', 'GuidePartners', 'GuideLoveClose',
        'GuidePlaces', 'GuidePlace', 'GuidePlace', 'GuidePlace',
        'GuideWhere',
      ]);
      for (const match of source.matchAll(/\bsign="([a-z]+)"/gu)) expect(match[1], slug).toBe(slug);
      expect(source, `${slug} keeps no banned phrase`).not.toMatch(/in plain language/iu);
    }
  });
});

describe('sign guide facts', () => {
  it('derives every fact and note from data for all twelve signs', () => {
    SIGNS.forEach((sign, index) => {
      const lore = heritage(sign.slug);
      const facts = guideFacts(sign, lore.principalStar);
      expect(facts.longRange).toMatch(/^[A-Z][a-z]+ \d{1,2} to [A-Z][a-z]+ \d{1,2}$/u);
      for (const note of [facts.modalityNote, facts.rulerNote, facts.polarityNote, facts.starNote]) {
        expect(note, sign.slug).toMatch(/^[A-Z]/u);
        expect(note, sign.slug).not.toMatch(/[—–“”]/u);
      }
      expect(signOrdinal(index)).toMatch(/^[a-z]+$/u);
      expect(signFigure(lore.epithet)).toMatch(/^The [A-Z]/u);
      expect(guideLede(lore.lede)).not.toMatch(/record|[—–]/u);
      for (const paragraph of lore.paragraphs) expect(plainDashes(paragraph)).not.toMatch(/[—–]/u);
    });
    expect(guideFacts(SIGNS[0], heritage('aries').principalStar)).toMatchObject({
      longRange: 'March 21 to April 19',
      modalityNote: 'Opens a season',
      rulerNote: 'Drive, desire, conflict style',
      polarityNote: 'Outward-facing',
      starNote: 'Head of the ram',
    });
    expect(guideFacts(SIGNS[7], heritage('scorpio').principalStar).rulerNote).toBe('Traditionally Mars');
  });

  it('counts reading time from prose words', () => {
    expect(guideReadingMinutes(Array.from({ length: 460 }, () => 'word').join(' '))).toBe(2);
    expect(guideReadingMinutes('<GuideWhere sign="aries" /> [Leo](/leo/)')).toBe(1);
  });
});

describe('sign guide daily card', () => {
  it('quotes the opening of every sign’s published reading verbatim', () => {
    const program = programData as HoroscopeProgram;
    for (const sign of SIGNS) {
      const reading = pageReadingFromProgram(program, sign.slug, 'today');
      const daily = guideDailyExcerpt(reading);
      expect(reading.sections[0].body.startsWith(daily.excerpt), sign.slug).toBe(true);
      expect(daily.excerpt).toMatch(/[.!?]$/u);
      expect(daily.editionDate).toBe(program.anchorDate);
      expect(daily.dateLabel).toMatch(/^[A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}$/u);
    }
  });

  it('cuts at sentence ends, never inside a decimal', () => {
    expect(openingSentences('The Moon is at 29.5° Leo today. Keep going. Third.')).toBe('The Moon is at 29.5° Leo today. Keep going.');
    expect(openingSentences(`One. ${'Long '.repeat(60)}end.`)).toBe('One.');
  });
});
