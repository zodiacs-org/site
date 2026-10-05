import { BirthFields } from './BirthFields';
import { t, type CatalogLocale } from '../lib/i18n';
import type { ChartEntry } from '../lib/sharing/chart-entry';
import { sharingText } from '../lib/sharing/copy';

export default function SharingBirthForm({ entry, onChange, locale, warm, named = false }: {
  entry: ChartEntry; onChange: (patch: Partial<ChartEntry>) => void; locale: CatalogLocale; warm: () => unknown; named?: boolean;
}) {
  const prefix = `share-person-${entry.id}`;
  return <>
    {named && <div class="field"><label class="field__label" for={`${prefix}-name`}>{sharingText(locale, 'nameHelp')} <span class="field__optional">{t(locale, 'optional')}</span></label>
      <input id={`${prefix}-name`} class="field__input" value={entry.name} maxLength={24} autoComplete="off" onInput={(event) => onChange({ name: event.currentTarget.value })} /></div>}
    <BirthFields locale={locale} dateId={`${prefix}-date`} timeId={`${prefix}-time`} placeId={`${prefix}-place`}
      date={entry.date} time={entry.time} timeKnown={entry.timeKnown} city={entry.city} calendar={entry.calendar}
      onDateChange={(date) => onChange({ date })} onTimeChange={(time) => onChange({ time })}
      onTimeKnownChange={(timeKnown) => onChange({ timeKnown })} onCityChange={(city) => onChange({ city })}
      onCalendarChange={(calendar) => onChange({ calendar })} onWarm={warm} />
  </>;
}
