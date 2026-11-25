/**
 * Birth date, time and birthplace fields that ask for the time and the
 * birthplace only once the birth date has passed the page's age check.
 *
 * The date is checked as it is entered: at once for a Gregorian date the
 * input already holds, and after conversion (birthDateForChart) for an Old
 * Style date or one typed another way, so a date written differently cannot
 * pass the check and then become a child's date. Until the converted date is
 * accepted, the time input is disabled and empty, no PlaceSearch is mounted
 * (so no city lookup request is sent), and a refused date clears a time and
 * birthplace entered for an earlier date. The refusal sentence is shown at
 * the date field. Pages still check the converted date again on submit.
 *
 * No request depends on what is entered: the calendar module loads with the
 * fields, whatever date is typed (so no request tells a date before 1924 from
 * a later one), and the birthplace search loads the whole city index
 * (PlaceSearch wholeIndex), so not even a place's first letter shows in a
 * request address.
 *
 * Shared, byte for byte, by the personal pages that read a birth chart
 * (retrogrades for you, your day, Vedic signs), so their branches merge in
 * any order. Pure UI: nothing is stored, logged or sent.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { City } from '../lib/geo/search';
import type { CatalogLocale as Locale } from '../lib/i18n';
import { t } from '../lib/i18n';
import { BirthDateField, birthDateForChart, calendarInPlay, loadBirthCalendar, type CalendarChoice } from './BirthFields';
import PlaceSearch from './PlaceSearch';

/** The converted Gregorian birth date, the sentence for the date field, or null while there is no date to check. */
export type BirthDateCheck = { date: string } | { error: string } | null;

/** A page's refusal sentence for a Gregorian birth date (the shared UTC-12 policy), or null when it may be read. */
export type BirthDateRefuser = (birthDate: string, now: Date) => string | null;

/** Shown in the time and birthplace help while they are locked. */
export const LOCKED_HELP = 'Enter the birth date first.';

/**
 * The check for a date the input already holds as a Gregorian date, at once: null with no date, undefined when the
 * date is written another way and has to be converted first (checkedBirthDate).
 */
export function quickBirthDateCheck(date: string, calendar: CalendarChoice, refuse: BirthDateRefuser, now = new Date()): BirthDateCheck | undefined {
  if (!date) return null;
  if (calendarInPlay(date, calendar)) return undefined;
  const refusal = refuse(date, now);
  return refusal ? { error: refusal } : { date };
}

/** The Gregorian date the chart would be read for, after any conversion, or the sentence for the form. */
export async function checkedBirthDate(date: string, calendar: CalendarChoice, refuse: BirthDateRefuser, now = new Date()): Promise<{ date: string } | { error: string }> {
  let birthDate = date;
  if (calendarInPlay(date, calendar)) {
    const entry = await birthDateForChart('en', date, calendar);
    if ('error' in entry) return { error: entry.error };
    birthDate = entry.date;
  }
  const refusal = refuse(birthDate, now);
  return refusal ? { error: refusal } : { date: birthDate };
}

/** The date's check as the form is filled in: at once for a Gregorian date, after conversion otherwise. */
export function useBirthDateCheck(date: string, calendar: CalendarChoice, refuse: BirthDateRefuser): BirthDateCheck {
  const key = `${calendar}|${date}`;
  const quick = quickBirthDateCheck(date, calendar, refuse);
  const [converted, setConverted] = useState<{ key: string; check: BirthDateCheck } | null>(null);
  useEffect(() => {
    if (quick !== undefined) return;
    let live = true;
    checkedBirthDate(date, calendar, refuse).then(
      (check) => { if (live) setConverted({ key, check }); },
      () => { if (live) setConverted({ key, check: null }); },
    );
    return () => { live = false; };
  }, [key]);
  return quick !== undefined ? quick : converted?.key === key ? converted.check : null;
}

export const birthDateOpen = (check: BirthDateCheck): check is { date: string } => check !== null && 'date' in check;

/** What a refused date clears: the time and the birthplace entered for an earlier date, and nothing while it is open. */
export function staleBirthDetails(check: BirthDateCheck, time: string, city: City | null): { time: boolean; city: boolean } {
  const refused = check !== null && 'error' in check;
  return { time: refused && time !== '', city: refused && city !== null };
}

interface GatedBirthFieldsProps {
  locale: Locale;
  dateId: string;
  timeId: string;
  placeId: string;
  date: string;
  calendar: CalendarChoice;
  /** useBirthDateCheck(date, calendar, refuse). */
  check: BirthDateCheck;
  time: string;
  timeKnown: boolean;
  city: City | null;
  onDateChange: (date: string) => void;
  onCalendarChange: (calendar: CalendarChoice) => void;
  onTimeChange: (time: string) => void;
  onTimeKnownChange: (timeKnown: boolean) => void;
  onCityChange: (city: City | null) => void;
  showUnknownTime?: boolean;
  requireKnownTime?: boolean;
  timeHelp?: ComponentChildren;
  placeHelp?: ComponentChildren;
}

/** BirthFields' date, time and birthplace, with the time and birthplace opened only by an accepted date. */
export function GatedBirthFields({
  locale, dateId, timeId, placeId, date, calendar, check, time, timeKnown, city,
  onDateChange, onCalendarChange, onTimeChange, onTimeKnownChange, onCityChange,
  showUnknownTime = true, requireKnownTime = false, timeHelp, placeHelp,
}: GatedBirthFieldsProps) {
  const open = birthDateOpen(check);
  const refusal = check !== null && 'error' in check ? check.error : undefined;
  // A refused date clears a time and birthplace entered for an earlier date, so the form never holds them for it.
  const stale = staleBirthDetails(check, time, city);
  // The calendar control and its conversion load with the fields, whatever date is entered, so no request tells a
  // date before 1924 from a later one. BirthDateField and birthDateForChart then reuse the module already loaded.
  useEffect(() => { loadBirthCalendar().catch(() => {}); }, []);
  useEffect(() => {
    if (stale.time) onTimeChange('');
    if (stale.city) onCityChange(null);
  }, [stale.time, stale.city]);
  const locked = (help: ComponentChildren) => (open ? help : help === undefined ? LOCKED_HELP : [`${LOCKED_HELP} `, help]);
  const shownTimeHelp = locked(timeHelp);
  const shownPlaceHelp = locked(placeHelp);
  return [
    <BirthDateField
      locale={locale} id={dateId} date={date} city={open ? city : null} onDateChange={onDateChange}
      calendar={calendar} onCalendarChange={onCalendarChange} error={refusal}
    />,

    <div class="field">
      <div class="field__labelrow">
        <label class="field__label" for={timeId}>{t(locale, 'birthTime')}</label>
        {showUnknownTime && (
          <label class="field__toggle">
            <input
              type="checkbox" checked={!timeKnown} disabled={!open}
              onChange={(e) => onTimeKnownChange(!(e.target as HTMLInputElement).checked)}
            />
            {t(locale, 'noBirthTime')}
          </label>
        )}
      </div>
      <input
        id={timeId} class="field__input" type="time"
        disabled={!open || !timeKnown} required={open && requireKnownTime && timeKnown} value={open ? time : ''}
        aria-describedby={shownTimeHelp !== undefined ? `${timeId}-help` : undefined}
        onInput={(e) => onTimeChange((e.target as HTMLInputElement).value)}
      />
      {shownTimeHelp !== undefined && <p id={`${timeId}-help`} class="field__help">{shownTimeHelp}</p>}
    </div>,

    <div class="field">
      <label class="field__label" for={placeId}>{t(locale, 'birthplace')}</label>
      {open
        ? <PlaceSearch id={placeId} selected={city} onSelect={onCityChange} locale={locale} selectionHint={t(locale, 'placePickHint')} required wholeIndex />
        : <input id={placeId} class="field__input" type="text" disabled placeholder={t(locale, 'placePlaceholder')} aria-describedby={`${placeId}-help`} />}
      {shownPlaceHelp !== undefined && <p id={`${placeId}-help`} class="field__help">{shownPlaceHelp}</p>}
    </div>,
  ];
}
