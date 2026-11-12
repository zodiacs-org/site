import { BirthFields } from './BirthFields';
import { birthFieldMessages } from './birth-field-check';
import { t, type CatalogLocale } from '../lib/i18n';
import type { ChartEntry } from '../lib/sharing/chart-entry';
import { sharingText } from '../lib/sharing/copy';

const entryIds = (entry: ChartEntry) => {
  const prefix = `share-person-${entry.id}`;
  return { date: `${prefix}-date`, time: `${prefix}-time`, place: `${prefix}-place` };
};

/** What an entry still needs before it can be calculated, field by field, with the first field's id. */
export const entryMessages = (entry: ChartEntry, locale: CatalogLocale) =>
  birthFieldMessages(locale, entryIds(entry), { ...entry, requireTime: true });

export default function SharingBirthForm({ entry, onChange, locale, warm, named = false, checked = false }: {
  entry: ChartEntry; onChange: (patch: Partial<ChartEntry>) => void; locale: CatalogLocale; warm: () => unknown; named?: boolean;
  /** Set after a submit that could not run: each incomplete field says what it needs. */
  checked?: boolean;
}) {
  const prefix = `share-person-${entry.id}`;
  const messages = checked ? entryMessages(entry, locale) : {};
  return <>
    {named && <div class="field"><label class="field__label" for={`${prefix}-name`}>{sharingText(locale, 'nameHelp')} <span class="field__optional">{t(locale, 'optional')}</span></label>
      <input id={`${prefix}-name`} class="field__input" value={entry.name} maxLength={24} autoComplete="off" onInput={(event) => onChange({ name: event.currentTarget.value })} /></div>}
    <BirthFields locale={locale} dateId={`${prefix}-date`} timeId={`${prefix}-time`} placeId={`${prefix}-place`}
      date={entry.date} time={entry.time} timeKnown={entry.timeKnown} city={entry.city} calendar={entry.calendar}
      onDateChange={(date) => onChange({ date })} onTimeChange={(time) => onChange({ time })}
      onTimeKnownChange={(timeKnown) => onChange({ timeKnown })} onCityChange={(city) => onChange({ city })}
      onCalendarChange={(calendar) => onChange({ calendar })} onWarm={warm}
      dateError={messages.dateError} timeError={messages.timeError} placeError={messages.placeError} />
  </>;
}
