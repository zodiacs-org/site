import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readingConfidence, readingConfidenceText } from '../ai-tools/reading-confidence';
import { EVENT_READING_CONFIDENCE } from './events/watch';
import { SEASON_READING_CONFIDENCE } from './seasons/copy';
import { SKY_READING_CONFIDENCE_NOTE } from './sky-reading-confidence-note';

const LABEL = readingConfidenceText(readingConfidence('sign'));
const distRoot = resolve(process.cwd(), 'dist');
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

function htmlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

describe('the sky reading-confidence note', () => {
  it('quotes the sign-level value the rule gives, which the event and season pages print', () => {
    expect(LABEL).toBe('Reading confidence 40%');
    expect(EVENT_READING_CONFIDENCE).toBe(LABEL);
    expect(SEASON_READING_CONFIDENCE).toBe(readingConfidence('sign'));
    expect(SKY_READING_CONFIDENCE_NOTE).toContain(`A ${readingConfidence('sign')}% reading is written for a Sun sign alone, with no birth date`);
  });

  it('says the label is not a probability, in one sentence with plain punctuation', () => {
    expect(SKY_READING_CONFIDENCE_NOTE).toContain('not the chance that anything happens.');
    expect(SKY_READING_CONFIDENCE_NOTE).not.toMatch(/[–—]/u);
    expect(SKY_READING_CONFIDENCE_NOTE.match(/\./g)).toHaveLength(1);
  });

  it('is printed after the label in the event layout, once per reading', () => {
    const layout = source('../components/events/EventPageLayout.astro');
    const labels = layout.split('<strong>{EVENT_READING_CONFIDENCE}</strong>').length - 1;
    expect(labels).toBe(2);
    expect(layout.split('{SKY_READING_CONFIDENCE_NOTE}').length - 1).toBe(labels);
    expect(layout.indexOf('{SKY_READING_CONFIDENCE_NOTE}')).toBeGreaterThan(layout.indexOf('<strong>{EVENT_READING_CONFIDENCE}</strong>'));
  });

  it('is printed once on a season page, after the twelve labelled readings', () => {
    const page = source('../components/seasons/SeasonPage.astro');
    expect(page.split('{SKY_READING_CONFIDENCE_NOTE}')).toHaveLength(2);
    expect(page.indexOf('{SKY_READING_CONFIDENCE_NOTE}')).toBeGreaterThan(page.indexOf('season-ask__confidence">{confidence}'));
  });
});

describe.skipIf(!existsSync(distRoot))('built pages that print the 40% label', () => {
  it('all carry the note', () => {
    const labelled = htmlFiles(distRoot).filter((path) => readFileSync(path, 'utf8').includes(LABEL));
    const missing = labelled
      .filter((path) => !readFileSync(path, 'utf8').includes(SKY_READING_CONFIDENCE_NOTE))
      .map((path) => relative(distRoot, path));
    expect(labelled.length).toBeGreaterThan(200);
    expect(missing).toEqual([]);
  });
});
