import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readingConfidenceText, readingConfidence } from '../src/ai-tools/reading-confidence.ts';
import {
  SHORTS_CONFIDENCE,
  balanceLines,
  SHORTS_SIGNS,
  SHORTS_TEXT,
  SHORTS_TIMING,
  hasDash,
  isShowable,
  pickSentences,
  sentencesOf,
  shortsCaption,
  shortsConfidenceLabel,
  shortsTimeline,
  todayReadings,
  wrapLines,
} from './daily-shorts-lib.mjs';

const root = resolve(import.meta.dirname, '..');
const program = JSON.parse(readFileSync(resolve(root, 'src/data/horoscope-program.json'), 'utf8'));
const horoscopeWindow = JSON.parse(readFileSync(resolve(root, 'src/data/horoscope-window.json'), 'utf8'));
const END_CARD_SECONDS = 2;

describe('the daily short videos', () => {
  it('covers all twelve signs, in order', () => {
    expect(SHORTS_SIGNS.map((sign) => sign.slug)).toEqual([
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ]);
  });

  it('prints the label the site prints for a Sun-sign reading', () => {
    expect(SHORTS_CONFIDENCE).toBe(readingConfidence('sign'));
    expect(shortsConfidenceLabel()).toBe(`Sun-sign reading. ${readingConfidenceText(readingConfidence('sign'))}`);
  });

  it('splits sentences and wraps lines within the budget', () => {
    expect(sentencesOf('One thing. Another; still one. Last!')).toEqual(['One thing.', 'Another; still one.', 'Last!']);
    const lines = wrapLines('For Capricorn, responsibility is clearer when you distinguish the essential from the inherited.');
    expect(lines.join(' ')).toBe('For Capricorn, responsibility is clearer when you distinguish the essential from the inherited.');
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(SHORTS_TEXT.maxChars);
    const sentence = 'For Aries, a clean first move matters more than a dramatic sprint.';
    const balanced = balanceLines(sentence);
    expect(balanced).toHaveLength(wrapLines(sentence).length);
    expect(balanced.join(' ')).toBe(sentence);
    expect(Math.min(...balanced.map((line) => line.length))).toBeGreaterThan(10);
  });

  it('never shows a dash or a money, health or betting sentence', () => {
    expect(isShowable('Today, choose one change that would make your daily work easier.')).toBe(true);
    expect(isShowable('Mercury brings attention to shared finances, debts, intimacy, and trust.')).toBe(false);
    expect(isShowable('The Moon puts daily work, health routines, and responsibilities on the agenda.')).toBe(false);
    expect(isShowable('A pause \u2014 then the answer.')).toBe(false);
    expect(isShowable('A pause \u2013 then the answer.')).toBe(false);
    const picked = pickSentences([
      { text: 'Your money looks up. Today, ask the plain question. Say what you need.' },
    ]);
    expect(picked.map((sentence) => sentence.text)).toEqual(['Today, ask the plain question.', 'Say what you need.']);
  });

  for (const day of [program.anchorDate, ...horoscopeWindow.editions.map((edition) => edition.anchorDate)]) {
    it(`quotes only published sentences that fit, for every sign on ${day}`, () => {
      const readings = todayReadings({ program, window: horoscopeWindow, day });
      expect(readings.signs).toHaveLength(12);
      for (const sign of readings.signs) {
        const source = (program.anchorDate === day
          ? program.signs.find((entry) => entry.sign === sign.slug).readings.today
          : horoscopeWindow.editions.find((edition) => edition.anchorDate === day).signs[sign.slug].today
        ).passages.map((passage) => passage.text).join(' ');
        expect(sign.sentences.length, sign.slug).toBeGreaterThan(0);
        const lines = sign.sentences.flatMap((sentence) => sentence.lines);
        expect(lines.length, sign.slug).toBeLessThanOrEqual(SHORTS_TEXT.maxLines);
        for (const sentence of sign.sentences) {
          expect(source, sign.slug).toContain(sentence.text);
          expect(sentence.lines.join(' ')).toBe(sentence.text);
          expect(hasDash(sentence.text)).toBe(false);
          for (const line of sentence.lines) expect(line.length, line).toBeLessThanOrEqual(SHORTS_TEXT.maxChars);
        }
        const { starts, body } = shortsTimeline(sign.sentences);
        expect(starts).toHaveLength(sign.sentences.length);
        expect(body).toBeGreaterThanOrEqual(SHORTS_TIMING.minBody);
        expect(body + END_CARD_SECONDS).toBeLessThanOrEqual(20);
        expect(body + END_CARD_SECONDS).toBeGreaterThanOrEqual(12);
        expect(starts.at(-1)).toBeLessThan(body - 1.5);

        const caption = shortsCaption({ slug: sign.slug, name: sign.name, day, sentences: sign.sentences });
        expect(hasDash(caption), sign.slug).toBe(false);
        expect(caption).toContain(sign.name);
        expect(caption).toContain(sign.sentences[0].text);
        expect(caption).toContain(`zodiacs.org/${sign.slug}/`);
        expect(caption).toContain('Reading confidence 40%');
        expect(caption).toMatch(/#horoscope/u);
        expect(caption).not.toMatch(/\b(token|crypto|market|invest|buy|price|guarantee)\w*/iu);
      }
    });
  }

  it('refuses a day nobody published', () => {
    expect(() => todayReadings({ program, window: horoscopeWindow, day: '1999-01-01' })).toThrow(/No published daily horoscope/u);
  });
});
