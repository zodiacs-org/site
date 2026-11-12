import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { City } from '../lib/geo/search';
import type { CatalogLocale as Locale } from '../lib/i18n';
import { t } from '../lib/i18n';
import { createModuleLoader } from '../lib/module-load';
import type { CalendarChoice } from '../lib/time/birth-calendar';
import { CALENDAR_CHOICE_BEFORE } from '../lib/time/calendar-choice';
import PlaceSearch from './PlaceSearch';

export type { CalendarChoice };

/** The calendar control, its copy and the adoption table: loaded only for a date before 1924. */
export const loadBirthCalendar = createModuleLoader(() => import('./BirthCalendar'));

/**
 * Whether the calendar is in play for a birth date: Old Style is chosen, or a
 * date written before 1924, or text the date input cannot hold.
 */
export function calendarInPlay(date: string, calendar: CalendarChoice | undefined): boolean {
  return calendar === 'julian' || (calendar !== undefined && date !== ''
    && (date < CALENDAR_CHOICE_BEFORE || !/^\d{4}-\d\d-\d\d$/.test(date)));
}

/**
 * The Gregorian date a chart is computed from, with the one-line Old Style
 * note when it was converted, or the message for the date field.
 */
export async function birthDateForChart(locale: Locale, date: string, calendar?: CalendarChoice) {
  return calendarInPlay(date, calendar)
    ? (await loadBirthCalendar()).readChartBirthDate(locale, date, calendar!)
    : { date };
}

type CalendarControl = typeof import('./BirthCalendar').default;

interface BirthDateFieldProps {
  locale: Locale;
  id: string;
  date: string;
  /** The birthplace, when one is picked: its country selects the calendar note. */
  city: City | null;
  onDateChange: (date: string) => void;
  /** The date's calendar; with its handler, a date before 1924 offers the Julian (Old Style). */
  calendar?: CalendarChoice;
  onCalendarChange?: (calendar: CalendarChoice) => void;
  /** The date of a chart already computed (a saved chart or a link): no calendar note. */
  charted?: boolean;
  onFocus?: () => unknown;
  help?: ComponentChildren;
  error?: string;
}

/** The birth date field, with the calendar control once a date before 1924 is entered. */
export function BirthDateField({
  locale, id, date, city, onDateChange, calendar, onCalendarChange, charted, onFocus, help, error,
}: BirthDateFieldProps) {
  const [Calendar, setCalendar] = useState<CalendarControl | null>(null);
  // The control asks for a text field while a date is typed as written.
  const [textFormat, setTextFormat] = useState<string | null>(null);
  const inPlay = onCalendarChange !== undefined && calendarInPlay(date, calendar);
  useEffect(() => {
    if (inPlay && !Calendar) loadBirthCalendar().then((module) => setCalendar(() => module.default), () => {});
  }, [inPlay]);

  return (
    <div class="field">
      <label class="field__label" for={id}>{t(locale, 'birthDate')}</label>
      <input
        id={id} class="field__input" type={textFormat ? 'text' : 'date'} required
        min="1800-01-01" max="2199-12-31" value={date}
        placeholder={textFormat ?? undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onFocus={onFocus}
        onInput={(e) => onDateChange((e.target as HTMLInputElement).value)}
      />
      {error && <p id={`${id}-error`} class="field__error" role="alert">{error}</p>}
      {inPlay && Calendar && (
        <Calendar
          locale={locale} id={id} date={date} calendar={calendar!} country={charted ? undefined : city?.country}
          onCalendarChange={onCalendarChange!} onTextEntry={setTextFormat}
        />
      )}
      {help}
    </div>
  );
}

interface BirthFieldsProps {
  locale: Locale;
  dateId: string;
  timeId: string;
  placeId: string;
  date: string;
  time: string;
  timeKnown: boolean;
  city: City | null;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onTimeKnownChange: (timeKnown: boolean) => void;
  onCityChange: (city: City | null) => void;
  /** The date's calendar; with its handler, a date before 1924 offers the Julian (Old Style). */
  calendar?: CalendarChoice;
  onCalendarChange?: (calendar: CalendarChoice) => void;
  /** The date of a chart already computed (a saved chart or a link): no calendar note. */
  charted?: boolean;
  onWarm?: () => unknown;
  showUnknownTime?: boolean;
  requireKnownTime?: boolean;
  timeHelp?: ComponentChildren;
  placeHelp?: ComponentChildren;
  dateError?: string;
  timeError?: string;
  placeError?: string;
}

/** Shared, controlled birth date/time/place fields used by calculator islands. */
export function BirthFields({
  locale,
  dateId,
  timeId,
  placeId,
  date,
  time,
  timeKnown,
  city,
  onDateChange,
  onTimeChange,
  onTimeKnownChange,
  onCityChange,
  calendar,
  onCalendarChange,
  charted,
  onWarm,
  showUnknownTime = true,
  requireKnownTime = false,
  timeHelp,
  placeHelp,
  dateError,
  timeError,
  placeError,
}: BirthFieldsProps) {
  // This is the same unkeyed sibling set without a Fragment wrapper; keep the
  // direct array return to protect the calculator host's hard bundle budget.
  return [
    <BirthDateField
      locale={locale} id={dateId} date={date} city={city} onDateChange={onDateChange}
      calendar={calendar} onCalendarChange={onCalendarChange} charted={charted} error={dateError}
    />,

    <div class="field">
      <div class="field__labelrow">
        <label class="field__label" id={`${timeId}-label`} for={timeId}>{t(locale, 'birthTime')}</label>
        {showUnknownTime && (
          <label class="field__toggle">
            {/* Named with the Birth time label first, so the checkbox says
                what it refers to when reached by Tab ("Birth time, I don't
                know it"), in every locale without a new string. */}
            <input
              type="checkbox" checked={!timeKnown}
              aria-labelledby={`${timeId}-label ${timeId}-unknown`}
              onChange={(e) => onTimeKnownChange(!(e.target as HTMLInputElement).checked)}
            />
            <span id={`${timeId}-unknown`}>{t(locale, 'noBirthTime')}</span>
          </label>
        )}
      </div>
      <input
        id={timeId} class="field__input" type="time"
        disabled={!timeKnown} required={requireKnownTime && timeKnown} value={time}
        aria-invalid={timeError ? 'true' : undefined}
        aria-describedby={[
          timeError ? `${timeId}-error` : null,
          timeHelp !== undefined ? `${timeId}-help` : null,
        ].filter(Boolean).join(' ') || undefined}
        onFocus={onWarm}
        onInput={(e) => onTimeChange((e.target as HTMLInputElement).value)}
      />
      {timeError && <p id={`${timeId}-error`} class="field__error" role="alert">{timeError}</p>}
      {timeHelp !== undefined && <p id={`${timeId}-help`} class="field__help">{timeHelp}</p>}
    </div>,

    <div class="field">
      <label class="field__label" for={placeId}>{t(locale, 'birthplace')}</label>
      <PlaceSearch
        id={placeId}
        selected={city}
        onSelect={onCityChange}
        locale={locale}
        validationError={placeError}
        selectionHint={t(locale, 'placePickHint')}
        required
      />
      {placeHelp !== undefined && <p class="field__help">{placeHelp}</p>}
    </div>,
  ];
}
