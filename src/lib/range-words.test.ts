import { describe, expect, it } from 'vitest';
import { phraseUntil, rangeWords, sincePhrase } from './range-words';

describe('ranges in words', () => {
  it('joins two days with each locale’s range words', () => {
    expect(rangeWords('en', 'Mar 3, 2026', 'Apr 1, 2026')).toBe('Mar 3, 2026 to Apr 1, 2026');
    expect(rangeWords('es', '3 mar 2026', '1 abr 2026')).toBe('del 3 mar 2026 al 1 abr 2026');
    expect(rangeWords('pt', '3 de mar. de 2026', '1º de abr. de 2026')).toBe('de 3 de mar. de 2026 a 1º de abr. de 2026');
    expect(rangeWords('fr', '3 mars 2026', '1 avr. 2026')).toBe('du 3 mars 2026 au 1 avr. 2026');
    expect(rangeWords('ru', '12 мар. 2026 г.', '9 апр. 2026 г.')).toBe('с 12 мар. 2026 г. по 9 апр. 2026 г.');
  });

  it('elides the Italian article before 1, 8 and 11 only', () => {
    expect(rangeWords('it', '8 mar 2026', '11 apr 2026')).toBe('dall’8 mar 2026 all’11 apr 2026');
    expect(rangeWords('it', '1 mar 2026', '18 apr 2026')).toBe('dall’1 mar 2026 al 18 apr 2026');
    expect(rangeWords('it', '21 mar 2026', '19 apr 2026')).toBe('dal 21 mar 2026 al 19 apr 2026');
  });

  it('takes "со" before the second day in Russian', () => {
    expect(rangeWords('ru', '2 мар.', '9 апр.')).toBe('со 2 мар. по 9 апр.');
    expect(rangeWords('ru', '22 мар.', '9 апр.')).toBe('с 22 мар. по 9 апр.');
  });

  it('uses plain range words for degrees and years', () => {
    expect(rangeWords('en', '12°34′ Leo', '13°20′ Leo', 'plain')).toBe('12°34′ Leo to 13°20′ Leo');
    expect(rangeWords('es', '1900', '2100', 'plain')).toBe('de 1900 a 2100');
    expect(rangeWords('fr', '1900', '2100', 'plain')).toBe('de 1900 à 2100');
    expect(rangeWords('it', '1900', '2100', 'plain')).toBe('da 1900 a 2100');
    expect(rangeWords('ru', '1900', '2100', 'plain')).toBe('от 1900 до 2100');
  });

  it('sets a phrase endpoint apart with a comma', () => {
    expect(sincePhrase('es', '3 oct 2026', 'en curso')).toBe('desde el 3 oct 2026, en curso');
    expect(sincePhrase('it', '8 ott 2026', 'in corso')).toBe('dall’8 ott 2026, in corso');
    expect(phraseUntil('fr', 'déjà rétrograde au début de 2026', '12 févr. 2026')).toBe('déjà rétrograde au début de 2026, jusqu’au 12 févr. 2026');
    expect(phraseUntil('it', 'già in moto retrogrado all’inizio del 2026', '1 feb 2026')).toBe('già in moto retrogrado all’inizio del 2026, fino all’1 feb 2026');
  });

  it('never prints a dash', () => {
    for (const locale of ['en', 'es', 'pt', 'fr', 'it', 'ru'] as const) {
      for (const kind of ['days', 'plain'] as const) expect(rangeWords(locale, '2', '9', kind)).not.toMatch(/[—–]/u);
      expect(sincePhrase(locale, '2', 'x')).not.toMatch(/[—–]/u);
      expect(phraseUntil(locale, 'x', '2')).not.toMatch(/[—–]/u);
    }
  });
});
