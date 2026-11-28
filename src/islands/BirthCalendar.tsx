/**
 * The birth date's calendar control (engine brief step 1.13b). BirthFields
 * loads this module only once a date before 1924 is entered, so no page's
 * first bundle carries it, its copy or the adoption table.
 *
 * Old Style dates are typed as written, year first: the browser's date input
 * holds only Gregorian dates, and a Julian 29 February 1900 is not one.
 */
import { useEffect, useState } from 'preact/hooks';
import { LOCALE_META, t, type CatalogLocale } from '../lib/i18n';
import {
  adoptionNote,
  readBirthDate,
  writtenDate,
  type AdoptionNote,
  type CalendarChoice,
  type BirthDateProblem,
} from '../lib/time/birth-calendar';
import { CALENDAR_CHOICE_BEFORE } from '../lib/time/calendar-choice';
import { parseCivilDate } from '../lib/time/civil-date';
import { BIRTH_CALENDAR_COPY } from './birth-calendar-copy';
import '../styles/birth-calendar.css';

/** The first of the month where the locale writes it as an ordinal. */
const FIRST_DAY: Partial<Record<CatalogLocale, string>> = { fr: '1er', it: '1º', pt: '1º' };

/**
 * A YYYY-MM-DD date in the locale's long form, as written: month and day are
 * named from 2000, a leap year in both calendars, so an Old Style 29 February
 * 1900 keeps its day, and the year is put back as written.
 */
export function longDate(locale: CatalogLocale, iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE_META[locale].intlLocale, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).formatToParts(Date.UTC(2000, month - 1, day))
    .map((part) => part.type === 'year' ? String(year)
      : part.type === 'day' && day === 1 ? FIRST_DAY[locale] ?? part.value
        : part.value)
    .join('');
}

function countryName(locale: CatalogLocale, note: AdoptionNote): string {
  try {
    return new Intl.DisplayNames(LOCALE_META[locale].intlLocale, { type: 'region' }).of(note.adoption.code)
      ?? note.adoption.country;
  } catch {
    return note.adoption.country;
  }
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (token, name: string) => values[name] ?? token);

/** One line: the date as written with its calendar, and the Gregorian date the chart uses. */
export function oldStyleLine(locale: CatalogLocale, julian: string, gregorian: string): string {
  return fill(BIRTH_CALENDAR_COPY[locale].converted, {
    julian: longDate(locale, julian),
    gregorian: longDate(locale, gregorian),
  });
}

export function adoptionNoteText(locale: CatalogLocale, note: AdoptionNote): string {
  const copy = BIRTH_CALENDAR_COPY[locale];
  const template = note.kind === 'old-style' ? copy.oldStyleNote
    : note.kind === 'new-style' ? copy.newStyleNote
      : copy.otherCalendarNote;
  return fill(template, { country: countryName(locale, note), date: longDate(locale, note.adoption.firstGregorian) });
}

export function birthDateProblemText(locale: CatalogLocale, problem: BirthDateProblem): string {
  const copy = BIRTH_CALENDAR_COPY[locale];
  return problem === 'range' ? t(locale, 'birthDateRange')
    : problem === 'format' ? copy.formatError
      : problem === 'julian' ? copy.julianError
        : copy.gregorianError;
}

export type ChartBirthDate = { date: string; oldStyle?: string; writtenJulianDate?: string } | { error: string };

/**
 * What a form computes from: the Gregorian date, with the one-line Old Style
 * note and the entered Julian YYYY-MM-DD when the date was converted, or the
 * message for the date field.
 */
export function readChartBirthDate(locale: CatalogLocale, value: string, calendar: CalendarChoice): ChartBirthDate {
  const reading = readBirthDate(value, calendar);
  if ('problem' in reading) return { error: birthDateProblemText(locale, reading.problem) };
  return reading.oldStyle
    ? { date: reading.date, oldStyle: oldStyleLine(locale, reading.oldStyle, reading.date), writtenJulianDate: reading.oldStyle }
    : { date: reading.date };
}

interface Props {
  locale: CatalogLocale;
  /** The date input's id; the radio group and note are named from it. */
  id: string;
  date: string;
  calendar: CalendarChoice;
  /** The picked birthplace's country, as the city index names it. */
  country?: string;
  onCalendarChange: (calendar: CalendarChoice) => void;
  /** Ask BirthFields for a text field (with this placeholder), or back to the date input. */
  onTextEntry: (format: string | null) => void;
}

export default function BirthCalendar({ locale, id, date, calendar, country, onCalendarChange, onTextEntry }: Props) {
  const copy = BIRTH_CALENDAR_COPY[locale];
  const julian = calendar === 'julian';
  const written = writtenDate(date);
  // Old Style dates, and a written date the date input cannot hold, are typed.
  const text = julian || (date !== '' && !parseCivilDate(date));

  useEffect(() => {
    // A complete date written in 1924 or later is Gregorian; a day the calendar does not have (1990-02-30) stays
    // Old Style, where it is refused, so switching calendars never lets it through.
    if (julian && parseCivilDate(written) && written >= CALENDAR_CHOICE_BEFORE) onCalendarChange('gregorian');
  }, [julian, written]);
  useEffect(() => { onTextEntry(text ? copy.format : null); }, [text, copy.format]);
  useEffect(() => () => onTextEntry(null), []);

  const reading = readBirthDate(date, calendar);
  const note = adoptionNote(date, calendar, country);
  const message = [
    'date' in reading && reading.oldStyle ? oldStyleLine(locale, reading.oldStyle, reading.date) : '',
    note ? adoptionNoteText(locale, note) : '',
  ].filter(Boolean).join(' ');
  // The live region is in place before its first words, so they are announced.
  const [announced, setAnnounced] = useState('');
  useEffect(() => { setAnnounced(message); }, [message]);

  return (
    <div class="birth-calendar" data-birth-calendar>
      <fieldset class="birth-calendar__choice">
        <legend class="birth-calendar__legend">{copy.legend}</legend>
        <div class="birth-calendar__options">
          {(['gregorian', 'julian'] as const).map((value) => (
            <label class="birth-calendar__option" key={value}>
              <input
                type="radio" name={`${id}-calendar`} value={value}
                checked={calendar === value}
                onChange={() => onCalendarChange(value)}
              />
              {copy[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <p id={`${id}-calendar-note`} class="field__help birth-calendar__note" aria-live="polite">{announced}</p>
    </div>
  );
}
