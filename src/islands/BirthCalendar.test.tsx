import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { CATALOG_LOCALES, t } from '../lib/i18n';
import { adoptionNote } from '../lib/time/birth-calendar';
import BirthCalendar, { adoptionNoteText, longDate, oldStyleLine, readChartBirthDate } from './BirthCalendar';
import { BIRTH_CALENDAR_COPY } from './birth-calendar-copy';
import { birthDateForChart, calendarInPlay } from './BirthFields';
import { readSlotDates, type SlotState } from './SynastryCalculator';

/** Some ICU releases space dates with no-break spaces. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

describe('the calendar choice in the birth forms', () => {
  it('is in play only before 1924, once Old Style is chosen, or for text the date input cannot hold', () => {
    expect(calendarInPlay('1923-12-31', 'gregorian')).toBe(true);
    expect(calendarInPlay('1800-01-01', 'gregorian')).toBe(true);
    expect(calendarInPlay('1924-01-01', 'gregorian')).toBe(false);
    expect(calendarInPlay('1990-06-15', 'gregorian')).toBe(false);
    expect(calendarInPlay('', 'gregorian')).toBe(false);
    // Chosen Old Style stays while the date is retyped.
    expect(calendarInPlay('', 'julian')).toBe(true);
    expect(calendarInPlay('1917-10-2', 'julian')).toBe(true);
    // A Julian leap day the date input cannot show stays in the text field.
    expect(calendarInPlay('1900-02-29', 'gregorian')).toBe(true);
    expect(calendarInPlay('19501231', 'gregorian')).toBe(true);
    // A form without the control (the Registry's frozen wallet chart) never shows it.
    expect(calendarInPlay('1917-10-25', undefined)).toBe(false);
  });

  it('computes a Gregorian date as it did before, without loading the control', async () => {
    await expect(birthDateForChart('en', '1990-06-15', 'gregorian')).resolves.toEqual({ date: '1990-06-15' });
    await expect(birthDateForChart('en', '1917-10-25')).resolves.toEqual({ date: '1917-10-25' });
  });

  it('reads an Old Style date as the Gregorian date the chart uses, with one line for the result', async () => {
    const entry = await birthDateForChart('en', '1917-10-25', 'julian');
    expect(entry).toEqual({ date: '1917-11-07', oldStyle: expect.any(String) });
    expect(plain((entry as { oldStyle: string }).oldStyle)).toBe('October 25, 1917 (Old Style), November 7, 1917 (New Style)');
    await expect(birthDateForChart('en', '1917-10-25', 'gregorian')).resolves.toEqual({ date: '1917-10-25' });
  });

  it('rejects a date that does not exist in its calendar with a plain message', () => {
    expect(readChartBirthDate('en', '1900-02-29', 'gregorian')).toEqual({ error: 'There is no such date in the Gregorian calendar.' });
    expect(readChartBirthDate('en', '1900-02-30', 'julian')).toEqual({ error: 'There is no such date in the Julian calendar.' });
    expect(readChartBirthDate('en', '25.10.1917', 'julian')).toEqual({ error: 'Write the date as year, month and day, for example 1917-10-25.' });
    expect(readChartBirthDate('en', '1799-12-31', 'julian')).toEqual({ error: t('en', 'birthDateRange') });
    expect(readChartBirthDate('ru', '1900-02-30', 'julian')).toEqual({ error: 'Такой даты нет в юлианском календаре.' });
    expect(readChartBirthDate('en', '1900-02-29', 'julian')).toMatchObject({ date: '1900-03-13' });
  });
});

describe('dates and notes as the reader sees them', () => {
  it.each([
    ['en', '1917-10-25', 'October 25, 1917'],
    ['en', '1900-02-29', 'February 29, 1900'],
    ['es', '1918-02-14', '14 de febrero de 1918'],
    ['pt', '1923-03-01', '1º de março de 1923'],
    ['fr', '1923-03-01', '1er mars 1923'],
    ['it', '1923-03-01', '1º marzo 1923'],
    ['ru', '1918-02-14', '14 февраля 1918 г.'],
  ] as const)('writes %s %s as %s', (locale, iso, expected) => {
    expect(plain(longDate(locale, iso))).toBe(expected);
  });

  it('puts the entered date beside the Gregorian one in each locale', () => {
    expect(plain(oldStyleLine('ru', '1917-10-25', '1917-11-07'))).toBe('25 октября 1917 г. (старый стиль), 7 ноября 1917 г. (новый стиль)');
    expect(plain(oldStyleLine('fr', '1917-10-25', '1917-11-07'))).toBe('25 octobre 1917 (ancien style), 7 novembre 1917 (nouveau style)');
  });

  it('names the birthplace\'s country and its first New Style day', () => {
    const russia = adoptionNote('1917-10-25', 'gregorian', 'Russia')!;
    expect(plain(adoptionNoteText('en', russia))).toBe('Russia: before February 14, 1918, dates were usually written in the Old Style (Julian) calendar. If this date comes from a record of that time, choose Julian.');
    expect(plain(adoptionNoteText('ru', russia))).toBe('Россия: до 14 февраля 1918 г. даты обычно записывали по старому стилю (юлианский календарь). Если дата взята из документа того времени, выберите юлианский календарь.');
    expect(plain(adoptionNoteText('fr', russia))).toBe('Russie : avant le 14 février 1918, les dates suivaient généralement le calendrier julien (ancien style). Si cette date provient d’un document de l’époque, choisis le calendrier julien.');
    const britain = adoptionNote('1850-06-01', 'julian', 'United Kingdom')!;
    expect(plain(adoptionNoteText('en', britain))).toBe('United Kingdom: from September 14, 1752, dates were usually written in the New Style (Gregorian) calendar. If this date comes from a record of that time, choose Gregorian.');
    const japan = adoptionNote('1860-05-01', 'gregorian', 'Japan')!;
    expect(plain(adoptionNoteText('en', japan))).toBe('Japan: before January 1, 1873, dates were usually written in a different calendar, which this form does not convert. Enter the Gregorian date.');
  });

  it('keeps every locale\'s copy complete, calm and in the standard terms', () => {
    const standard = {
      es: 'calendario juliano (estilo antiguo)',
      fr: 'calendrier julien (ancien style)',
      it: 'calendario giuliano (vecchio stile)',
      pt: 'calendário juliano (estilo antigo)',
      ru: 'по старому стилю (юлианский календарь)',
    } as const;
    for (const locale of CATALOG_LOCALES) {
      const copy = BIRTH_CALENDAR_COPY[locale];
      for (const [key, text] of Object.entries(copy)) {
        expect(text.trim(), `${locale}.${key}`).not.toBe('');
        expect(text, `${locale}.${key}`).not.toMatch(/!|properly/i);
      }
      for (const key of ['oldStyleNote', 'newStyleNote', 'otherCalendarNote'] as const) {
        expect(copy[key], `${locale}.${key}`).toMatch(/^\{country\}\u202f?: .*\{date\}/);
      }
      expect(copy.converted, locale).toMatch(/^\{julian\} \(.+\), \{gregorian\} \(.+\)$/);
      if (locale !== 'en') expect(copy.oldStyleNote, locale).toContain(standard[locale]);
    }
  });
});

describe('the calendar control', () => {
  const control = (calendar: 'gregorian' | 'julian') => render(
    <BirthCalendar
      locale="en" id="birth-date" date="1917-10-25" calendar={calendar} country="Russia"
      onCalendarChange={() => {}} onTextEntry={() => {}}
    />,
  );

  it('is a labelled radio group with a polite live note', () => {
    const html = control('gregorian');
    expect(html).toContain('<fieldset class="birth-calendar__choice">');
    expect(html).toContain('<legend class="birth-calendar__legend">Calendar</legend><div class="birth-calendar__options">');
    expect(html.match(/type="radio" name="birth-date-calendar"/g)).toHaveLength(2);
    expect(html).toMatch(/value="gregorian" checked[^>]*>Gregorian \(New Style\)<\/label>/);
    expect(html).toMatch(/value="julian"[^>]*>Julian \(Old Style\)<\/label>/);
    expect(html).toContain('id="birth-date-calendar-note" class="field__help birth-calendar__note" aria-live="polite"');
    expect(control('julian')).toMatch(/value="julian" checked/);
  });
});

describe('the compatibility page\'s two people', () => {
  const side = (date: string, calendar?: 'gregorian' | 'julian'): SlotState => ({
    source: 'form', savedId: '', name: '', date, time: '12:00', timeKnown: true, calendar,
    city: { name: 'Saint Petersburg', admin1: 'St.-Petersburg', country: 'Russia', lat: 59.94, lon: 30.31, tz: 'Europe/Moscow', pop: 1 },
    link: null, positions: null,
  });

  it('reads each side in its own calendar before charting, saving or inviting', async () => {
    const read = await readSlotDates([[side('1917-10-25', 'julian'), 'Anna'], [side('1990-06-15'), 'Person B']], 'en');
    expect(Array.isArray(read)).toBe(true);
    const [a, b] = read as SlotState[];
    expect(a.date).toBe('1917-11-07');
    expect(plain(a.oldStyle!)).toBe('October 25, 1917 (Old Style), November 7, 1917 (New Style)');
    expect(b).toEqual(side('1990-06-15'));
  });

  it('names the side whose date does not exist', async () => {
    await expect(readSlotDates([[side('1990-06-15'), 'Anna'], [side('1900-02-30', 'julian'), 'Person B']], 'en'))
      .resolves.toBe('Person B: There is no such date in the Julian calendar.');
    await expect(readSlotDates([[side('1900-02-30', 'julian'), 'Anna']], 'fr'))
      .resolves.toBe(`Anna\u202f: ${BIRTH_CALENDAR_COPY.fr.julianError}`);
  });
});
