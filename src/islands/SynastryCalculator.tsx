/**
 * Two charts, compared. Saved charts flow straight from localStorage
 * summaries into the pure synastry math — the ephemeris never loads on
 * that path. Birth-detail entry (or a stale engine version) lazy-loads
 * the engine the same way the chart calculator does.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BirthFields, birthDateForChart, type CalendarChoice } from './BirthFields';
import type { CopyLinkState } from './CopyLinkButton';
import SignChip from './SignChip';
import { NextActionCard } from '../components/NextActionCard';
import {
  MAX_PAIRS,
  deletePair,
  hasPair,
  loadPairs,
  pairSideLabels,
  positionsPairSide,
  prunePairs,
  savePair,
} from '../lib/profile/pairs';
import type { SavedPair, SavedPairSide } from '../lib/profile/pairs';
import type { SavedChart } from '../lib/profile/schema';
import type { MinimalBody, PairSummary } from '../lib/engine/synastry';
import type { ShareChartInput } from '../lib/share';
import type { PositionsShareChart, PositionsShareInput } from '../lib/share-positions';
import type { City } from '../lib/geo/search';
import { LOCALE_META, localizePath, normalizeCatalogLocale, t, tf, type CatalogLocale as Locale } from '../lib/i18n';
import { useEngine, type EngineLoader } from '../lib/hooks/useEngine';
import CalculationReload, { calculationError } from './CalculationReload';
import { loadModule } from '../lib/module-load';
import { useProfile } from '../lib/hooks/useProfile';
import { useProfileAccessGeneration } from '../lib/hooks/useProfileAccessGeneration';
import { profileAccessAllowed } from '../lib/account-v2/profile-access-reader';

export interface SlotState {
  source: 'saved' | 'form' | 'link' | 'positions';
  savedId: string;
  name: string;
  date: string;
  time: string;
  timeKnown: boolean;
  city: City | null;
  /** The calendar the form's date was written in; absent is Gregorian. */
  calendar?: CalendarChoice;
  /** Set on the copy a comparison reads: the Old Style date beside the Gregorian one. */
  oldStyle?: string;
  /** Chart carried by value — locked, clearable. `received` means it
   *  arrived in someone else's invite link (never re-shared); without it
   *  the side was restored from a saved comparison. */
  link: { input: ShareChartInput; label: string; received?: boolean } | null;
  /** Positions-only side from a one-reading invitation or a returned result. */
  positions: { chart: PositionsShareChart; label: string; invite?: boolean } | null;
}

interface Person {
  computedUtc?: Date | string;
  label: string;
  bodies: MinimalBody[];
  asc: number | null;
  /** False when the birth time was unknown — the Moon is a noon estimate. */
  timeKnown: boolean;
  /** Ring-drawing extras (retrograde marks, MC, house cusps where known). */
  wheel: {
    bodies: { body: string; lon: number; retrograde?: boolean }[];
    mc: number | null;
    cusps: number[] | null;
  };
  /** Latitude-bearing bodies for the sphere view; null off the engine paths. */
  depth: { body: string; lon: number; lat: number; retrograde?: boolean }[] | null;
  /** Privacy-safe shape used by the positions-only send-back codec. */
  positions: PositionsShareInput;
  /** A chart computed here without a birth time: its civil date, so a link carries noon UTC on it. */
  untimedDate?: string;
  /** A chart computed here with a birth time: its UTC instant, so a link carries its bodies at the whole minute. */
  utc?: Date | string;
  /** The Old Style date entered beside the Gregorian one, as one line. */
  oldStyle?: string;
}

type WheelModule = typeof import('./synastry/RelationshipWheel');
type CopyLinkModule = typeof import('./CopyLinkButton');
type ShareModule = typeof import('../lib/share');
type CompatibilityShareModule = typeof import('./CompatibilityShareControl');
type PrefilledPairModule = typeof import('./PrefilledPairNotice');
type InviteExperienceModule = typeof import('./synastry/InviteExperience');
type SendBackExperienceModule = typeof import('./synastry/SendBackExperience');

const emptySlot = (): SlotState => ({
  source: 'form', savedId: '', name: '', date: '', time: '', timeKnown: true, city: null, link: null, positions: null,
});

const COMPAT_INVITES_UI_ENABLED = import.meta.env.PUBLIC_COMPAT_INVITES_ENABLED === '1';

// Saved-comparison strings stay module-local (the RelationshipWheel COPY
// precedent): only this island uses them, and the central UI dictionary
// rides in every island page's closure — the flagship shouldn't pay for
// compatibility-only chrome.
const PAIR_COPY_EN = {
  savedPairs: 'Saved comparisons',
  useMyChart: 'Use my chart — {handle}',
  dismissMyChart: 'Dismiss saved-chart suggestion',
  saveCue: 'Up next',
  savePairTitle: 'Keep this reading',
  savePair: 'Save this comparison',
  savePairBenefit: 'Keep this reading together so you can return without entering both charts again.',
  savedPairTitle: 'Comparison saved',
  openSavedPairs: 'Open Saved charts',
  reopenPairNote: 'Reopen this comparison anytime from Saved charts.',
  pairSaved: 'Comparison saved on this device.',
  pairExists: 'Already saved.',
  pairSaveFull: 'You can save up to {n} comparisons — remove one first.',
  pairRemoved: 'Comparison removed.',
  savedComparisonSide: 'from a saved comparison',
  restoredSideHelp: 'This side came from a saved comparison — clear it to enter someone else.',
} as const;

const PAIR_COPY = {
  en: PAIR_COPY_EN,
  es: {
    savedPairs: 'Comparaciones guardadas',
    useMyChart: 'Usar mi carta — {handle}',
    dismissMyChart: 'Descartar sugerencia de carta guardada',
    saveCue: 'A continuación',
    savePairTitle: 'Conserva esta lectura',
    savePair: 'Guardar esta comparación',
    savePairBenefit: 'Guarda esta lectura para volver sin ingresar ambas cartas de nuevo.',
    savedPairTitle: 'Comparación guardada',
    openSavedPairs: 'Abrir Cartas guardadas',
    reopenPairNote: 'Vuelve a abrir esta comparación cuando quieras desde Cartas guardadas.',
    pairSaved: 'Comparación guardada en este dispositivo.',
    pairExists: 'Ya está guardada.',
    pairSaveFull: 'Puedes guardar hasta {n} comparaciones — elimina una primero.',
    pairRemoved: 'Comparación eliminada.',
    savedComparisonSide: 'de una comparación guardada',
    restoredSideHelp: 'Este lado viene de una comparación guardada — bórralo para ingresar los datos de otra persona.',
  },
  pt: {
    savedPairs: 'Comparações salvas',
    useMyChart: 'Usar meu mapa — {handle}',
    dismissMyChart: 'Dispensar sugestão de mapa salvo',
    saveCue: 'A seguir',
    savePairTitle: 'Guarde esta leitura',
    savePair: 'Salvar esta comparação',
    savePairBenefit: 'Guarde esta leitura para voltar sem inserir os dois mapas novamente.',
    savedPairTitle: 'Comparação salva',
    openSavedPairs: 'Abrir Mapas salvos',
    reopenPairNote: 'Abra esta comparação novamente quando quiser em Mapas salvos.',
    pairSaved: 'Comparação salva neste dispositivo.',
    pairExists: 'Já está salva.',
    pairSaveFull: 'Você pode salvar até {n} comparações — remova uma primeiro.',
    pairRemoved: 'Comparação removida.',
    savedComparisonSide: 'de uma comparação salva',
    restoredSideHelp: 'Este lado veio de uma comparação salva — limpe-o para inserir os dados de outra pessoa.',
  },
  fr: {
    savedPairs: 'Comparaisons enregistrées',
    useMyChart: 'Utiliser mon thème — {handle}',
    dismissMyChart: 'Fermer la suggestion de thème enregistré',
    saveCue: 'À suivre',
    savePairTitle: 'Garde cette lecture',
    savePair: 'Enregistrer cette comparaison',
    savePairBenefit: 'Garde cette lecture pour y revenir sans saisir à nouveau les deux thèmes.',
    savedPairTitle: 'Comparaison enregistrée',
    openSavedPairs: 'Ouvrir Thèmes enregistrés',
    reopenPairNote: 'Rouvre cette comparaison à tout moment depuis Thèmes enregistrés.',
    pairSaved: 'Comparaison enregistrée sur cet appareil.',
    pairExists: 'Déjà enregistrée.',
    pairSaveFull: 'Tu peux enregistrer jusqu’à {n} comparaisons — supprime-en une d’abord.',
    pairRemoved: 'Comparaison supprimée.',
    savedComparisonSide: 'd’une comparaison enregistrée',
    restoredSideHelp: 'Ce côté provient d’une comparaison enregistrée — efface-le pour saisir les données d’une autre personne.',
  },
  it: {
    savedPairs: 'Confronti salvati',
    useMyChart: 'Usa il mio tema — {handle}',
    dismissMyChart: 'Chiudi il suggerimento del tema salvato',
    saveCue: 'Prossimo passo',
    savePairTitle: 'Conserva questa lettura',
    savePair: 'Salva questo confronto',
    savePairBenefit: 'Conserva questa lettura per tornare senza inserire di nuovo entrambi i temi.',
    savedPairTitle: 'Confronto salvato',
    openSavedPairs: 'Apri Temi salvati',
    reopenPairNote: 'Riapri questo confronto quando vuoi da Temi salvati.',
    pairSaved: 'Confronto salvato su questo dispositivo.',
    pairExists: 'Già salvato.',
    pairSaveFull: 'Puoi salvare fino a {n} confronti — prima rimuovine uno.',
    pairRemoved: 'Confronto rimosso.',
    savedComparisonSide: 'da un confronto salvato',
    restoredSideHelp: 'Questo lato proviene da un confronto salvato — cancellalo per inserire i dati di un’altra persona.',
  },
  ru: {
    savedPairs: 'Сохранённые сравнения',
    useMyChart: 'Использовать мою карту — {handle}',
    dismissMyChart: 'Закрыть предложение сохранённой карты',
    saveCue: 'Дальше',
    savePairTitle: 'Сохраните это чтение',
    savePair: 'Сохранить сравнение',
    savePairBenefit: 'Сохраните это чтение, чтобы вернуться без повторного ввода обеих карт.',
    savedPairTitle: 'Сравнение сохранено',
    openSavedPairs: 'Открыть сохранённые карты',
    reopenPairNote: 'Это сравнение можно открыть снова в разделе сохранённых карт.',
    pairSaved: 'Сравнение сохранено на этом устройстве.',
    pairExists: 'Уже сохранено.',
    pairSaveFull: 'Можно сохранить до {n} сравнений — сначала удалите одно.',
    pairRemoved: 'Сравнение удалено.',
    savedComparisonSide: 'из сохранённого сравнения',
    restoredSideHelp: 'Эта сторона восстановлена из сохранённого сравнения — очистите её, чтобы ввести другого человека.',
  },
} as const satisfies Record<Locale, Record<keyof typeof PAIR_COPY_EN, string>>;

const pc = (locale: Locale, key: keyof typeof PAIR_COPY_EN) => PAIR_COPY[locale][key];
const pcf = (locale: Locale, key: keyof typeof PAIR_COPY_EN, values: Record<string, string | number>) =>
  pc(locale, key).replace(/\{(\w+)\}/g, (_token: string, k: string) => String(values[k] ?? ''));
const listLocale = (locale: Locale) => LOCALE_META[locale].intlLocale;

export type PairSaveState = 'idle' | 'saved' | 'exists' | 'full' | 'error';
export type ComparisonResultSource = 'plain' | 'invite' | 'invite-restored' | 'returned';

/** One completed state covers both a save from this result and a pair that
 *  was already present when the comparison opened. */
export const pairSaveIsComplete = (state: PairSaveState, alreadyStored: boolean) =>
  alreadyStored || state === 'saved' || state === 'exists';

export function comparisonResultSource(
  aSource: SlotState['source'],
  aIsFreshInvite: boolean,
  bSource: SlotState['source'],
): Exclude<ComparisonResultSource, 'returned'> {
  if (aSource === 'positions' && aIsFreshInvite) return 'invite';
  if (aSource === 'positions' && bSource === 'positions') return 'invite-restored';
  return 'plain';
}

/** Short handle for sentences: chart names like "Cancer Sun · 1990-02-01" trim to "Cancer Sun". */
const handleOf = (name: string) => name.split('·')[0].trim() || name;

export async function resolveSaved(chart: SavedChart, loadEngine: EngineLoader): Promise<Person> {
  const { resolveSavedChart } = await loadModule(() => import('../lib/profile/resolve'));
  const resolved = await resolveSavedChart(chart, loadEngine);
  const { summary } = resolved;
  // Comparing reads a saved chart and never writes it back.
  return {
    label: handleOf(chart.name),
    bodies: resolved.bodies,
    asc: resolved.asc,
    timeKnown: resolved.timeKnown,
    wheel: {
      bodies: summary.bodies,
      mc: summary.angles?.mc ?? null,
      cusps: null,
    },
    // Stored summaries are longitude-only on purpose; the sphere says so.
    depth: null,
    positions: {
      bodies: resolved.bodies as PositionsShareInput['bodies'],
      angles: summary.angles,
      houseSystem: summary.houseSystem,
      engineVersion: summary.engineVersion,
    },
    computedUtc: summary.utcISO,
    ...(resolved.timeKnown ? { utc: summary.utcISO } : { untimedDate: chart.birth.date }),
  };
}

export async function resolveLink(link: { input: ShareChartInput; label: string }, loadEngine: EngineLoader): Promise<Person> {
  const [engine, { prepareLocalTime, resolveLocalToUtc }] = await Promise.all([
    loadEngine(),
    loadModule(() => import('../lib/time/localToUtc')),
  ]);
  const { input } = link;
  await prepareLocalTime(input.date, input.tz);
  const resolved = resolveLocalToUtc(
    input.date,
    input.timeKnown && input.time ? input.time : '12:00',
    input.tz,
    { longitude: input.lon },
  );
  const result = engine.computeChart({
    utc: resolved.utc,
    latitude: input.lat,
    longitude: input.lon,
    houseSystem: 'whole',
    timeKnown: input.timeKnown,
    flags: resolved.flags,
  });
  return {
    label: link.label,
    bodies: result.bodies.map(({ body, lon }) => ({ body, lon })),
    asc: result.angles?.asc ?? null,
    timeKnown: input.timeKnown,
    wheel: {
      bodies: result.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
      mc: result.angles?.mc ?? null,
      cusps: input.timeKnown ? (result.houses?.cusps ?? null) : null,
    },
    depth: result.bodies.map(({ body, lon, lat, retrograde }) => ({ body, lon, lat, retrograde })),
    positions: {
      bodies: result.bodies,
      angles: result.angles ? { asc: result.angles.asc, mc: result.angles.mc } : null,
      houseSystem: result.input.houseSystem,
      engineVersion: result.engineVersion,
    },
    computedUtc: resolved.utc,
    ...(input.timeKnown ? { utc: resolved.utc } : { untimedDate: input.date }),
  };
}

export async function resolveForm(slot: SlotState, fallbackLabel: string, loadEngine: EngineLoader): Promise<Person> {
  const [engine, { prepareLocalTime, resolveLocalToUtc }] = await Promise.all([
    loadEngine(),
    loadModule(() => import('../lib/time/localToUtc')),
  ]);
  await prepareLocalTime(slot.date, slot.city!.tz);
  const timeKnown = slot.timeKnown && slot.time !== '';
  const resolved = resolveLocalToUtc(slot.date, timeKnown ? slot.time : '12:00', slot.city!.tz, { longitude: slot.city!.lon });
  const result = engine.computeChart({
    utc: resolved.utc,
    latitude: slot.city!.lat,
    longitude: slot.city!.lon,
    houseSystem: 'whole',
    timeKnown,
    flags: resolved.flags,
  });
  return {
    label: slot.name.trim() || fallbackLabel,
    bodies: result.bodies.map(({ body, lon }) => ({ body, lon })),
    asc: result.angles?.asc ?? null,
    timeKnown,
    wheel: {
      bodies: result.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
      mc: result.angles?.mc ?? null,
      cusps: timeKnown ? (result.houses?.cusps ?? null) : null,
    },
    depth: result.bodies.map(({ body, lon, lat, retrograde }) => ({ body, lon, lat, retrograde })),
    positions: {
      bodies: result.bodies,
      angles: result.angles ? { asc: result.angles.asc, mc: result.angles.mc } : null,
      houseSystem: result.input.houseSystem,
      engineVersion: result.engineVersion,
    },
    computedUtc: resolved.utc,
    ...(timeKnown ? { utc: resolved.utc } : { untimedDate: slot.date }),
    oldStyle: slot.oldStyle,
  };
}

/**
 * Each form side with its date read in its calendar, so the chart, a saved
 * comparison and an invitation all carry the Gregorian date; or the first
 * date that cannot be read, named by its side.
 */
export async function readSlotDates(slots: [SlotState, string][], locale: Locale): Promise<SlotState[] | string> {
  const read: SlotState[] = [];
  for (const [slot, label] of slots) {
    const entry = slot.source === 'form' ? await birthDateForChart(locale, slot.date, slot.calendar ?? 'gregorian') : null;
    if (entry && 'error' in entry) return `${label}${locale === 'fr' ? '\u202f:' : ':'} ${entry.error}`;
    read.push(entry ? { ...slot, date: entry.date, oldStyle: entry.oldStyle } : slot);
  }
  return read;
}

function resolvePositions(
  received: { chart: PositionsShareChart; label: string },
): Person {
  const { chart } = received;
  return {
    label: received.label,
    bodies: chart.bodies,
    asc: chart.angles?.asc ?? null,
    timeKnown: chart.angles !== null,
    wheel: {
      bodies: chart.bodies,
      mc: chart.angles?.mc ?? null,
      cusps: null,
    },
    depth: null,
    positions: chart,
  };
}

function SlotForm({
  slot, setSlot, charts, idPrefix, fallbackLabel, locale, loadEngine,
}: {
  slot: SlotState;
  setSlot: (updater: (s: SlotState) => SlotState) => void;
  charts: SavedChart[];
  idPrefix: string;
  fallbackLabel: string;
  locale: Locale;
  loadEngine: EngineLoader;
}) {
  if (slot.source === 'positions' && slot.positions) {
    return (
      <div class="syn__slot">
        <span class="mono--label">{fallbackLabel}</span>
        <div class="field">
          <label class="field__label" for={`${idPrefix}-positions`}>{t(locale, 'chart')}</label>
          <span class="place__chip">
            <input
              id={`${idPrefix}-positions`}
              class="place__chip-value"
              type="text"
              readOnly
              value={`${slot.positions.label} · ${t(locale, 'sharedWithYou')}`}
            />
            <button
              type="button"
              class="place__clear"
              aria-label={t(locale, 'removeSharedChart')}
              onClick={() => setSlot(() => emptySlot())}
            >×</button>
          </span>
          <p class="field__help">This side arrived as chart positions, with no birth details.</p>
        </div>
      </div>
    );
  }

  if (slot.source === 'link' && slot.link) {
    const received = slot.link.received === true;
    return (
      <div class="syn__slot">
        <span class="mono--label">{fallbackLabel}</span>
        <div class="field">
          <label class="field__label" for={`${idPrefix}-linked`}>{t(locale, 'chart')}</label>
          <span class="place__chip">
            <input
              id={`${idPrefix}-linked`} class="place__chip-value" type="text" readOnly
              value={`${slot.link.label} · ${received ? t(locale, 'sharedWithYou') : pc(locale, 'savedComparisonSide')}`}
            />
            <button
              type="button" class="place__clear" aria-label={t(locale, 'removeSharedChart')}
              onClick={() => setSlot(() => emptySlot())}
            >×</button>
          </span>
          <p class="field__help">{received ? t(locale, 'sharedSideHelp') : pc(locale, 'restoredSideHelp')}</p>
        </div>
      </div>
    );
  }

  return (
    <div class="syn__slot">
      <span class="mono--label">{fallbackLabel}</span>

      {charts.length > 0 && (
        <div class="field">
          <label class="field__label" for={`${idPrefix}-source`}>{t(locale, 'chart')}</label>
          <select
            id={`${idPrefix}-source`} class="field__input"
            value={slot.source === 'saved' ? slot.savedId : ''}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              setSlot((s) => (v === ''
                ? { ...s, source: 'form', savedId: '' }
                : { ...s, source: 'saved', savedId: v }));
            }}
          >
            <option value="">{t(locale, 'enterBirthDetails')}</option>
            {charts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {slot.source === 'form' && (
        <>
          <div class="field">
            <label class="field__label" for={`${idPrefix}-name`}>{t(locale, 'name')} <span class="field__optional">{t(locale, 'optional')}</span></label>
            <input
              id={`${idPrefix}-name`} class="field__input" type="text" maxLength={24}
              placeholder={fallbackLabel} value={slot.name}
              onInput={(e) => { const v = (e.target as HTMLInputElement).value; setSlot((s) => ({ ...s, name: v })); }}
            />
          </div>
          <BirthFields
            locale={locale}
            dateId={`${idPrefix}-date`}
            timeId={`${idPrefix}-time`}
            placeId={`${idPrefix}-place`}
            date={slot.date}
            time={slot.time}
            timeKnown={slot.timeKnown}
            city={slot.city}
            onDateChange={(date) => setSlot((s) => ({ ...s, date }))}
            calendar={slot.calendar ?? 'gregorian'}
            onCalendarChange={(calendar) => setSlot((s) => ({ ...s, calendar }))}
            onTimeChange={(time) => setSlot((s) => ({ ...s, time }))}
            onTimeKnownChange={(timeKnown) => setSlot((s) => ({ ...s, timeKnown }))}
            onCityChange={(city) => setSlot((s) => ({ ...s, city }))}
            onWarm={loadEngine}
          />
        </>
      )}
    </div>
  );
}

function PersonCard({ person, locale }: { person: Person; locale: Locale }) {
  const find = (name: string) => person.bodies.find((b) => b.body === name);
  const sun = find('Sun');
  const moon = find('Moon');
  return (
    <div class="syn__person">
      <strong>{person.label}</strong>
      <div class="syn__three">
        {sun && <span class="syn__placement"><span class="mono--label">{t(locale, 'sun')}</span> <SignChip lon={sun.lon} locale={locale} /></span>}
        {moon && <span class="syn__placement"><span class="mono--label">{t(locale, 'moon')}</span> <SignChip lon={moon.lon} locale={locale} /></span>}
        {person.asc !== null && <span class="syn__placement"><span class="mono--label">{t(locale, 'rising')}</span> <SignChip lon={person.asc} locale={locale} /></span>}
      </div>
    </div>
  );
}

function LoadRecovery({ error, onRetry, locale, area, reopenLink = false }: {
  error: string; onRetry: () => void; locale: Locale; area: string; reopenLink?: boolean;
}) {
  return (
    <div data-syn-recovery={area}>
      <p class="calc__error" role="alert">{error}</p>
      <button class="btn btn--glass" type="button" onClick={onRetry}>{t(locale, 'calculationRetry')}</button>
      <CalculationReload error={error} locale={locale} />
      {reopenLink && <p class="field__help">If you reload, open the original invitation or reading link again.</p>}
    </div>
  );
}

export default function SynastryCalculator({ locale: rawLocale = 'en' }: { locale?: Locale }) {
  const locale = normalizeCatalogLocale(rawLocale);
  const inviteUiActive = COMPAT_INVITES_UI_ENABLED
    && locale === 'en'
    && typeof window !== 'undefined'
    && window.location.pathname === '/compatibility/';
  const loadEngine = useEngine();
  const { profile, ready: profileReady } = useProfile();
  const [slotA, setSlotA] = useState<SlotState>(emptySlot());
  const [slotB, setSlotB] = useState<SlotState>(emptySlot());
  const [result, setResult] = useState<{
    a: Person; b: Person; summary: PairSummary; at: number;
    sides: [SavedPairSide | null, SavedPairSide | null];
    source: ComparisonResultSource;
  } | null>(null);
  const [wheelMod, setWheelMod] = useState<WheelModule | null>(null);
  const [copyLinkMod, setCopyLinkMod] = useState<CopyLinkModule | null>(null);
  const [shareMod, setShareMod] = useState<ShareModule | null>(null);
  const [compatShareMod, setCompatShareMod] = useState<CompatibilityShareModule | null>(null);
  const [prefilledPairMod, setPrefilledPairMod] = useState<PrefilledPairModule | null>(null);
  const [inviteExperienceMod, setInviteExperienceMod] = useState<InviteExperienceModule | null>(null);
  const [sendBackMod, setSendBackMod] = useState<SendBackExperienceModule | null>(null);
  const [arrival, setArrival] = useState<
    | { state: 'idle' | 'loading' }
    | {
      state: 'ready';
      handle: string;
      payload: import('../lib/invite/types').InvitePublicPayload;
    }
    | { state: 'unavailable' | 'offline' }
    | { state: 'error'; error: string }
  >({ state: 'idle' });
  const [returnBand, setReturnBand] = useState<'none' | 'loading' | 'valid' | 'invalid'>('none');
  const [returnError, setReturnError] = useState('');
  const [sharingLoadError, setSharingLoadError] = useState('');
  const [sharingRetry, setSharingRetry] = useState(0);
  const [inviteUiError, setInviteUiError] = useState('');
  const [inviteUiRetry, setInviteUiRetry] = useState(0);
  const [accessTick, setAccessTick] = useState(0);
  const [meetingSettled, setMeetingSettled] = useState(true);
  const [invitePanelExpanded, setInvitePanelExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [autoRan, setAutoRan] = useState(false);
  const [invite, setInvite] = useState<ShareChartInput | null>(null);
  const [inviteState, setInviteState] = useState<CopyLinkState>('idle');
  const [pairs, setPairs] = useState<SavedPair[]>([]);
  const [pairSave, setPairSave] = useState<PairSaveState>('idle');
  const [pairAnnounce, setPairAnnounce] = useState('');
  const [restoreTick, setRestoreTick] = useState(0);
  const [quickFillDismissed, setQuickFillDismissed] = useState(false);
  const compareInFlightRef = useRef(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const focusAfterComputeRef = useRef(false);
  const profileLinksReadRef = useRef(false);
  const inviteCompletionRef = useRef<number | null>(null);
  const inviteOpenTrackedRef = useRef(false);
  const inviteArrivalHandleRef = useRef('');
  const returnTokenRef = useRef<string | null>(null);
  const activeRef = useRef(true);
  const requestRef = useRef(0);
  const profileAccessGeneration = useProfileAccessGeneration(() => {
    requestRef.current += 1;
    inviteArrivalHandleRef.current = '';
    returnTokenRef.current = null;
    setArrival({ state: 'idle' });
    setReturnBand('none');
    setReturnError('');
    setSharingLoadError('');
    setInviteUiError('');
    compareInFlightRef.current = false;
    focusAfterComputeRef.current = false;
    setSlotA(emptySlot());
    setSlotB(emptySlot());
    setResult(null);
    setInvite(null);
    setInviteState('idle');
    setInvitePanelExpanded(false);
    setPairs([]);
    setPairSave('idle');
    setPairAnnounce('');
    setAutoRan(false);
    setRestoreTick(0);
    setBusy(false);
    setError('');
  });

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      requestRef.current += 1;
      inviteArrivalHandleRef.current = '';
      returnTokenRef.current = null;
    };
  }, []);

  const requestIsCurrent = (request: number, access: number) => activeRef.current
    && request === requestRef.current && access === profileAccessGeneration.current;

  // The access guard invalidates pending downloads on every cutover. Retry
  // optional controls on the next render, including a grant/restoration.
  useEffect(() => {
    const refresh = () => {
      // A grant also invalidates pending comparisons. Release that request
      // here; its stale finally block must not release a newer comparison.
      compareInFlightRef.current = false;
      focusAfterComputeRef.current = false;
      setBusy(false);
      setAccessTick((tick) => tick + 1);
    };
    window.addEventListener('zodiacs:profile-access', refresh);
    return () => window.removeEventListener('zodiacs:profile-access', refresh);
  }, []);

  useEffect(() => {
    if (accessTick === 0) return;
    // A real revocation already cleared these refs. A grant may interrupt
    // an in-flight link read without revoking its in-memory input.
    if (arrival.state === 'loading' && inviteArrivalHandleRef.current) void openArrival(inviteArrivalHandleRef.current);
    if (returnBand === 'loading' && returnTokenRef.current !== null) void openReturnedReading(returnTokenRef.current);
  }, [accessTick]);

  // Result-only actions stay outside the entry form's initial closure.
  useEffect(() => {
    if (!result || busy) return;
    let cancelled = false;
    const request = requestRef.current;
    const access = profileAccessGeneration.current;
    const isCurrent = () => !cancelled && requestIsCurrent(request, access);
    const install = async <T,>(pending: Promise<T>, assign: (module: T) => void) => {
      const module = await pending;
      if (isCurrent()) assign(module);
    };
    setSharingLoadError('');
    void Promise.all([
      install(copyLinkMod ? Promise.resolve(copyLinkMod) : loadModule(() => import('./CopyLinkButton')), setCopyLinkMod),
      install(shareMod ? Promise.resolve(shareMod) : loadModule(() => import('../lib/share')), setShareMod),
      install(compatShareMod ? Promise.resolve(compatShareMod) : loadModule(() => import('./CompatibilityShareControl')), setCompatShareMod),
      install(sendBackMod ? Promise.resolve(sendBackMod) : loadModule(() => import('./synastry/SendBackExperience')), setSendBackMod),
    ]).catch((cause) => {
      if (isCurrent()) setSharingLoadError(calculationError(cause, locale, t(locale, 'cardError')));
    });
    return () => { cancelled = true; };
  }, [result, busy, sharingRetry, locale, accessTick]);

  useEffect(() => {
    if (!inviteUiActive) return;
    let active = true;
    const access = profileAccessGeneration.current;
    const isCurrent = () => active && activeRef.current && access === profileAccessGeneration.current;
    const install = async <T,>(pending: Promise<T>, assign: (module: T) => void) => {
      const module = await pending;
      if (isCurrent()) assign(module);
    };
    setInviteUiError('');
    void Promise.all([
      install(loadModule(() => import('./synastry/InviteExperience')), setInviteExperienceMod),
      install(loadModule(() => import('./synastry/SendBackExperience')), setSendBackMod),
    ]).catch((cause) => {
      if (isCurrent()) setInviteUiError(calculationError(cause, locale, 'The invitation controls could not load. Try again.'));
    });
    return () => { active = false; };
  }, [inviteUiActive, inviteUiRetry, accessTick]);

  async function openArrival(handle: string): Promise<void> {
    if (!activeRef.current) return;
    const request = ++requestRef.current;
    const access = profileAccessGeneration.current;
    inviteArrivalHandleRef.current = handle;
    compareInFlightRef.current = false;
    setBusy(false);
    setArrival({ state: 'loading' });
    try {
      const { openInviteSession } = await loadModule(() => import('./synastry/inviteClient'));
      if (!requestIsCurrent(request, access)) return;
      const next = await openInviteSession(handle);
      if (!requestIsCurrent(request, access)) return;
      setArrival(next);
      if (next.state === 'ready') {
        setSlotA({
          ...emptySlot(),
          source: 'positions',
          positions: { chart: next.payload.positions, label: next.payload.label, invite: true },
        });
        setResult(null);
      }
      if (!inviteOpenTrackedRef.current) {
        inviteOpenTrackedRef.current = true;
        track('invite_opened', { state: next.state });
      }
    } catch (cause) {
      if (!requestIsCurrent(request, access)) return;
      setArrival({
        state: 'error',
        error: calculationError(cause, locale, 'The invitation could not be opened. Check your connection and try again.'),
      });
    }
  }

  async function openReturnedReading(token: string): Promise<void> {
    if (!activeRef.current) return;
    const request = ++requestRef.current;
    const access = profileAccessGeneration.current;
    returnTokenRef.current = token;
    compareInFlightRef.current = false;
    setBusy(false);
    setReturnBand('loading');
    setReturnError('');
    try {
      const [codec, synastry, wheel] = await Promise.all([
        loadModule(() => import('../lib/share-synastry')),
        loadModule(() => import('../lib/engine/synastry')),
        loadModule(() => import('./synastry/RelationshipWheel')),
      ]);
      if (!requestIsCurrent(request, access)) return;
      const decoded = token ? codec.decodeSynastryLink(token) : null;
      if (!decoded) {
        returnTokenRef.current = null;
        setReturnBand('invalid');
        return;
      }
      const a = resolvePositions({
        chart: decoded.sides[0].chart,
        label: decoded.sides[0].label || 'Their side',
      });
      const b = resolvePositions({
        chart: decoded.sides[1].chart,
        label: decoded.sides[1].label || 'The other side',
      });
      setWheelMod(wheel);
      setResult({
        a,
        b,
        summary: synastry.summarizePair(a.bodies, b.bodies, 8),
        at: Date.now(),
        sides: [null, null],
        source: 'returned',
      });
      setReturnBand('valid');
      returnTokenRef.current = null;
      setMeetingSettled(true);
      track('compat_computed', { source: 'returned' });
    } catch (cause) {
      if (!requestIsCurrent(request, access)) return;
      setReturnBand('none');
      setReturnError(calculationError(cause, locale, 'The reading could not be opened. Try again.'));
    }
  }

  useEffect(() => {
    if (!inviteUiActive) return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const inviteHandles = fragment.getAll('invite');
    const inviteArrival = fragment.has('invite');
    const inviteHandle = inviteHandles.length === 1
      && Array.from(fragment.keys()).every((key) => key === 'invite')
      ? inviteHandles[0] ?? ''
      : '';
    const returnTokens = fragment.getAll('s');

    if (inviteArrival) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      void openArrival(inviteHandle);
      return;
    }
    if (!fragment.has('s')) return;

    const token = returnTokens.length === 1 && Array.from(fragment.keys()).every((key) => key === 's')
      ? returnTokens[0]
      : '';
    history.replaceState(null, '', window.location.pathname + window.location.search);
    void openReturnedReading(token);
  }, [inviteUiActive]);

  useEffect(() => {
    if (!inviteUiActive || !profileAccessAllowed()) return;
    let active = true;
    const access = profileAccessGeneration.current;
    const isCurrent = () => active && activeRef.current && profileAccessAllowed()
      && access === profileAccessGeneration.current;
    const flush = () => {
      void loadModule(() => import('./synastry/inviteClient')).then(({ beaconPendingCompletion }) => {
        if (isCurrent()) beaconPendingCompletion();
      }).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    void loadModule(() => import('./synastry/inviteClient')).then(({ replayPendingCompletion }) => {
      if (isCurrent()) return replayPendingCompletion();
    }).catch(() => {});
    return () => {
      active = false;
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [inviteUiActive, accessTick]);

  useEffect(() => {
    if (!profileAccessAllowed() || !result || result.source !== 'invite' || arrival.state !== 'ready') return;
    if (inviteCompletionRef.current === result.at) return;
    let active = true;
    const request = requestRef.current;
    const access = profileAccessGeneration.current;
    void loadModule(() => import('./synastry/inviteClient')).then(({ completeInvite }) => {
      if (!active || !profileAccessAllowed() || !requestIsCurrent(request, access)) return;
      inviteCompletionRef.current = result.at;
      track('invite_completed');
      return completeInvite(arrival.handle, arrival.payload.expiresAt);
    }).catch(() => {});
    return () => { active = false; };
  }, [result, arrival, accessTick]);

  useEffect(() => {
    if (!result) return;
    if (result.source === 'returned'
      || result.source === 'invite-restored'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMeetingSettled(true);
      return;
    }
    setMeetingSettled(false);
    const settle = () => setMeetingSettled(true);
    const timer = window.setTimeout(settle, 1_400);
    window.addEventListener('pointerdown', settle, { once: true });
    window.addEventListener('keydown', settle, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', settle);
      window.removeEventListener('keydown', settle);
    };
  }, [result?.at]);

  useEffect(() => {
    if (!profileReady || profileLinksReadRef.current) return;
    let active = true;
    profileLinksReadRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.has('sign1') || params.has('sign2')) {
      void import('./PrefilledPairNotice').then((module) => {
        if (active) setPrefilledPairMod(module);
      }, () => {});
    }
    // ?pair= deep link (the profile page's saved-comparisons strip):
    // restore the stored pair and compare. Same-device ids, like ?a=&b=.
    const pairId = params.get('pair');
    const storedPair = pairId ? loadPairs().find((p) => p.id === pairId) : undefined;
    let savedA = false;
    let savedB = false;
    if (storedPair && sideRestorable(storedPair.a) && sideRestorable(storedPair.b)) {
      restorePair(storedPair);
    } else {
      // ?a=&b= deep link: preselect saved charts by their device-local ids.
      const idA = params.get('a');
      const idB = params.get('b');
      let linked = 0;
      if (idA && profile.charts.some((c) => c.id === idA)) {
        setSlotA((s) => ({ ...s, source: 'saved', savedId: idA }));
        savedA = true;
        linked += 1;
      }
      if (idB && profile.charts.some((c) => c.id === idB)) {
        setSlotB((s) => ({ ...s, source: 'saved', savedId: idB }));
        savedB = true;
        linked += 1;
      }
      if (linked === 2) setAutoRan(true);
    }
    // #a= / #b= fragments carry one or both charts by value. This supports
    // an invite with one open side and the permission-first other-person
    // flow with both sides ready. Details and labels never enter the query.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const valuesA = fragment.getAll('a');
    const valuesB = fragment.getAll('b');
    const tokenA = valuesA.length === 1 ? valuesA[0] : null;
    const tokenB = valuesB.length === 1 ? valuesB[0] : null;
    if (fragment.has('a') || fragment.has('b')) {
      void import('../lib/share').then((module) => {
        if (!active) return;
        setShareMod(module);
        const decodedA = tokenA ? module.decodeChartLink(tokenA) : null;
        const decodedB = tokenB ? module.decodeChartLink(tokenB) : null;
        if (decodedA) {
          setSlotA({
            ...emptySlot(),
            source: 'link',
            link: { input: decodedA, label: decodedA.name ?? t(locale, 'personA'), received: true },
          });
        }
        if (decodedB) {
          setSlotB({
            ...emptySlot(),
            source: 'link',
            link: { input: decodedB, label: decodedB.name ?? t(locale, 'personB'), received: true },
          });
        }
        if ((savedA || decodedA) && (savedB || decodedB)) setAutoRan(true);
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [profileReady, profile, locale]);

  // Saved comparisons live beside the profile; every same-page write
  // (save, remove, prune) re-arrives through the zodiacs:pairs event so
  // one listener keeps the strip current.
  useEffect(() => {
    setPairs(loadPairs());
    const onPairs = (e: Event) => setPairs((e as CustomEvent<SavedPair[]>).detail);
    const onProfileAccess = () => setPairs(loadPairs());
    window.addEventListener('zodiacs:pairs', onPairs);
    window.addEventListener('zodiacs:profile-access', onProfileAccess);
    return () => {
      window.removeEventListener('zodiacs:pairs', onPairs);
      window.removeEventListener('zodiacs:profile-access', onProfileAccess);
    };
  }, []);

  // Pairs are only read here, so this is where orphans get cleaned up:
  // once the chart list is live, drop pairs whose saved chart is gone
  // (deleted on /profile/, or removed by a remote sync merge). A no-op
  // prune writes and dispatches nothing. An EMPTY chart list is never
  // pruned against — `ready` means "load attempted", and a corrupt or
  // version-skewed profile key also reads as empty; orphans there stay
  // hidden by the render filter instead of being destroyed.
  useEffect(() => {
    if (!profileReady || profile.charts.length === 0) return;
    prunePairs(new Set(profile.charts.map((c) => c.id)));
  }, [profileReady, profile]);

  // The save state describes a stored pair; keep it honest when the
  // store changes underneath it (the just-saved pair removed → the
  // button must offer saving again; a slot freed → the full alert is
  // stale).
  useEffect(() => {
    if (pairSave === 'idle' || pairSave === 'error') return;
    if (pairSave === 'full') {
      if (pairs.length < MAX_PAIRS) setPairSave('idle');
      return;
    }
    const [a, b] = result?.sides ?? [null, null];
    if (a && b && !hasPair(pairs, a, b)) setPairSave('idle');
  }, [pairs]);

  const charts = profile.charts;
  const latestChart = useMemo(
    () => charts.reduce<SavedChart | null>((latest, chart) => (
      !latest || chart.updatedAt > latest.updatedAt ? chart : latest
    ), null),
    [charts],
  );
  const slotAIsUntouched = slotA.source === 'form'
    && slotA.name === '' && slotA.date === '' && slotA.time === ''
    && slotA.timeKnown && slotA.city === null && slotA.link === null;
  const slotBIsUntouched = slotB.source === 'form'
    && slotB.name === '' && slotB.date === '' && slotB.time === ''
    && slotB.timeKnown && slotB.city === null && slotB.link === null
    && slotB.positions === null;
  const showQuickFill = profileReady && latestChart !== null
    && slotAIsUntouched && !quickFillDismissed;
  const CopyLinkButton = copyLinkMod?.CopyLinkButton;

  const slotReady = (slot: SlotState) =>
    slot.source === 'saved' ? charts.some((c) => c.id === slot.savedId)
      : slot.source === 'link' ? slot.link !== null
      : slot.source === 'positions' ? slot.positions !== null
      : slot.date !== '' && slot.city !== null;

  const sameSaved =
    slotA.source === 'saved' && slotB.source === 'saved'
    && slotA.savedId !== '' && slotA.savedId === slotB.savedId;

  const canCompare = slotReady(slotA) && slotReady(slotB) && !sameSaved && !busy;

  // Only the inviter's own side rides in an invite link — a chart that
  // itself arrived by link is someone else's data and never re-shared.
  // A side restored from a saved comparison is this device's own data.
  function inviteFromSlot(slot: SlotState): ShareChartInput | null {
    if (slot.source === 'positions') return null;
    if (slot.source === 'link') {
      return slot.link && slot.link.received !== true ? slot.link.input : null;
    }
    if (slot.source === 'saved') {
      const c = charts.find((x) => x.id === slot.savedId);
      if (!c || !c.birth.place) return null;
      return {
        date: c.birth.date,
        time: c.birth.time,
        timeKnown: c.birth.timeKnown,
        lat: c.birth.place.lat,
        lon: c.birth.place.lon,
        tz: c.birth.place.tz,
        name: handleOf(c.name),
        place: c.birth.place.name,
        houseSystem: 'whole',
      };
    }
    if (slot.date === '' || slot.city === null) return null;
    const timeKnown = slot.timeKnown && slot.time !== '';
    return {
      date: slot.date,
      time: timeKnown ? slot.time : null,
      timeKnown,
      lat: slot.city.lat,
      lon: slot.city.lon,
      tz: slot.city.tz,
      name: slot.name.trim() || undefined,
      place: slot.city.name,
      houseSystem: 'whole',
    };
  }

  const inviteUrl = () =>
    `${window.location.origin}${localizePath(locale, '/compatibility/')}#a=${shareMod!.encodeChartLink(invite!)}`;

  const track = (name: string, props: Record<string, string> = {}) => {
    (window as unknown as {
      zodiacsAnalytics?: { track?: (n: string, p: Record<string, string>) => void };
    }).zodiacsAnalytics?.track?.(name, props);
  };

  /** Snapshot one slot as a storable pair side — a saved chart by
   *  reference (renames flow through), everything else by value. */
  function sideFromSlot(slot: SlotState, label: string): SavedPairSide | null {
    if (slot.source === 'positions') {
      return slot.positions ? positionsPairSide(slot.positions.chart, label) : null;
    }
    if (slot.source === 'saved') {
      const c = charts.find((x) => x.id === slot.savedId);
      if (!c) return null;
      // The birth key lets this person dedupe against a by-value save of
      // the same birth data (e.g. they first arrived in an invite link).
      const birthKey = c.birth.place
        ? `${c.birth.date}|${c.birth.time ?? ''}|${c.birth.place.lat}|${c.birth.place.lon}`
        : undefined;
      return { kind: 'chart', chartId: c.id, label, ...(birthKey ? { birthKey } : {}) };
    }
    if (slot.source === 'link') {
      return slot.link
        ? { kind: 'input', input: slot.link.input, label, ...(slot.link.received ? { received: true } : {}) }
        : null;
    }
    if (slot.date === '' || slot.city === null) return null;
    const timeKnown = slot.timeKnown && slot.time !== '';
    return {
      kind: 'input',
      input: {
        date: slot.date,
        time: timeKnown ? slot.time : null,
        timeKnown,
        lat: slot.city.lat,
        lon: slot.city.lon,
        tz: slot.city.tz,
        name: slot.name.trim() || undefined,
        place: slot.city.name,
        houseSystem: 'whole',
      },
      label,
    };
  }

  function onSavePair() {
    if (!result || !result.sides[0] || !result.sides[1]) return;
    const outcome = savePair({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      a: result.sides[0],
      b: result.sides[1],
    });
    setPairSave(outcome);
    if (outcome === 'saved' || outcome === 'exists') {
      setPairAnnounce(pc(locale, outcome === 'saved' ? 'pairSaved' : 'pairExists'));
    }
    if (outcome === 'saved') track('chart_saved', { source: 'pair' });
  }

  function saveInvitationPair(): boolean {
    if (!result || result.source !== 'invite') return false;
    const a = positionsPairSide(result.a.positions, result.a.label);
    const b = positionsPairSide(result.b.positions, result.b.label);
    if (!a || !b) return false;
    const outcome = savePair({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      a,
      b,
    });
    if (outcome === 'saved' || outcome === 'exists') {
      setPairSave(outcome);
      setPairAnnounce(pc(locale, outcome === 'saved' ? 'pairSaved' : 'pairExists'));
      if (outcome === 'saved') track('chart_saved', { source: 'invite_pair' });
      return true;
    }
    setPairSave(outcome);
    return false;
  }

  async function saveInvitationOwnChart(): Promise<boolean> {
    if (!result || result.source !== 'invite') return false;
    if (slotB.source === 'saved') return charts.some((chart) => chart.id === slotB.savedId);
    if (slotB.source !== 'form' || !slotB.city || !slotB.date) return false;
    const timeKnown = slotB.timeKnown && slotB.time !== '';
    const accessGeneration = profileAccessGeneration.current;
    try {
      const [{ prepareLocalTime, resolveLocalToUtc }, { saveChart }, read] = await Promise.all([
        import('../lib/time/localToUtc'),
        import('../lib/profile/store'),
        readSlotDates([[slotB, '']], locale),
      ]);
      if (typeof read === 'string') return false;
      const own = read[0];
      await prepareLocalTime(own.date, slotB.city.tz);
      if (accessGeneration !== profileAccessGeneration.current) return false;
      const resolved = resolveLocalToUtc(
        own.date,
        timeKnown ? slotB.time : '12:00',
        slotB.city.tz,
        { longitude: slotB.city.lon },
      );
      const now = new Date().toISOString();
      const outcome = saveChart({
        id: crypto.randomUUID(),
        name: (slotB.name.trim() || result.b.label || 'My chart').slice(0, 40),
        createdAt: now,
        updatedAt: now,
        birth: {
          date: own.date,
          time: timeKnown ? slotB.time : null,
          timeKnown,
          place: {
            name: slotB.city.name,
            admin1: slotB.city.admin1,
            country: slotB.city.country,
            lat: slotB.city.lat,
            lon: slotB.city.lon,
            tz: slotB.city.tz,
          },
        },
        summary: {
          engineVersion: result.b.positions.engineVersion,
          utcISO: resolved.utc.toISOString(),
          houseSystem: result.b.positions.houseSystem,
          bodies: result.b.wheel.bodies.map((body) => ({
            body: body.body,
            lon: body.lon,
            retrograde: body.retrograde === true,
          })),
          angles: result.b.positions.angles
            ? { asc: result.b.positions.angles.asc, mc: result.b.positions.angles.mc }
            : null,
          flags: resolved.flags,
        },
      });
      if (outcome === 'saved' || outcome === 'updated') {
        track('chart_saved', { source: 'invite' });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function startOwnInvitationLoop(): void {
    if (slotB.source !== 'form' && slotB.source !== 'saved') return;
    requestRef.current += 1;
    compareInFlightRef.current = false;
    focusAfterComputeRef.current = false;
    setBusy(false);
    inviteArrivalHandleRef.current = '';
    returnTokenRef.current = null;
    setSlotA(slotB);
    setSlotB(emptySlot());
    setResult(null);
    setArrival({ state: 'idle' });
    setInvitePanelExpanded(false);
    requestAnimationFrame(() => {
      document.getElementById('calculator')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }

  function onRemovePair(pair: SavedPair, index: number) {
    if (!deletePair(pair.id)) {
      setPairAnnounce(t(locale, 'chartSaveError'));
      return;
    }
    setPairAnnounce(pc(locale, 'pairRemoved'));
    // The button under the pointer/cursor just unmounted — hand focus to
    // the nearest surviving chip, else back into the form.
    requestAnimationFrame(() => {
      const chips = document.querySelectorAll<HTMLElement>('.syn__pair-restore');
      const next = chips[Math.min(index, chips.length - 1)]
        ?? document.getElementById('syn-a-source')
        ?? document.getElementById('syn-a-name');
      next?.focus();
    });
  }

  function restorePair(pair: SavedPair) {
    const toSlot = (side: SavedPairSide): SlotState => {
      if (side.kind === 'chart') {
        return { ...emptySlot(), source: 'saved', savedId: side.chartId };
      }
      if (side.kind === 'positions') {
        return {
          ...emptySlot(),
          source: 'positions',
          positions: { chart: side.chart, label: side.label },
        };
      }
      return {
        ...emptySlot(),
        source: 'link',
        link: { input: side.input, label: side.label, received: side.received },
      };
    };
    setSlotA(toSlot(pair.a));
    setSlotB(toSlot(pair.b));
    setRestoreTick((n) => n + 1);
  }

  // A pair is only offered when both sides can still resolve — a chart
  // side whose saved chart is gone (mid-sync) would just error.
  const sideRestorable = (side: SavedPairSide) =>
    side.kind !== 'chart' || charts.some((c) => c.id === side.chartId);
  const visiblePairs = pairs.filter((pair) => sideRestorable(pair.a) && sideRestorable(pair.b));
  const resultPairAlreadyStored = result?.sides[0] && result.sides[1]
    ? hasPair(pairs, result.sides[0], result.sides[1])
    : false;
  const pairSaveComplete = pairSaveIsComplete(pairSave, resultPairAlreadyStored);
  const pairName = (pair: SavedPair) => pairSideLabels(pair, charts).join(' × ');
  // Accessible names spell the glyph out: "Frida and Diego", not
  // "Frida multiplication sign Diego".
  const pairSpokenName = (pair: SavedPair) => new Intl.ListFormat(listLocale(locale), {
    style: 'long', type: 'conjunction',
  }).format(pairSideLabels(pair, charts));

  async function compare(e?: Event) {
    e?.preventDefault();
    // Ref, not state: two effects in one commit share the same stale
    // `busy` closure, so state can't gate re-entry.
    if (compareInFlightRef.current) return;
    if (!slotReady(slotA) || !slotReady(slotB) || sameSaved) return;
    const request = ++requestRef.current;
    returnTokenRef.current = null;
    setReturnBand('none');
    setReturnError('');
    if (arrival.state !== 'ready') {
      inviteArrivalHandleRef.current = '';
      setArrival({ state: 'idle' });
    }
    compareInFlightRef.current = true;
    focusAfterComputeRef.current = e !== undefined;
    setBusy(true);
    setError('');
    const accessGeneration = profileAccessGeneration.current;
    try {
      const read = await readSlotDates([
        [slotA, slotA.name.trim() || t(locale, 'personA')],
        [slotB, slotB.name.trim() || t(locale, 'personB')],
      ], locale);
      if (!requestIsCurrent(request, accessGeneration)) return;
      if (typeof read === 'string') {
        setError(read);
        return;
      }
      const [sideA, sideB] = read;
      const resolve = (slot: SlotState, fallback: string) =>
        slot.source === 'saved' ? resolveSaved(charts.find((c) => c.id === slot.savedId)!, loadEngine)
          : slot.source === 'link' ? resolveLink(slot.link!, loadEngine)
          : slot.source === 'positions' ? Promise.resolve(resolvePositions(slot.positions!))
          : resolveForm(slot, fallback, loadEngine);
      const [a, b, mod, { summarizePair }] = await Promise.all([
        resolve(sideA, t(locale, 'personA')),
        resolve(sideB, t(locale, 'personB')),
        wheelMod ? Promise.resolve(wheelMod) : loadModule(() => import('./synastry/RelationshipWheel')),
        loadModule(() => import('../lib/engine/synastry')),
      ]);
      if (!requestIsCurrent(request, accessGeneration)) return;
      const summary = summarizePair(a.bodies, b.bodies, 8);
      const resultSource = comparisonResultSource(
        slotA.source,
        slotA.positions?.invite === true,
        slotB.source,
      );
      setWheelMod(mod);
      setMeetingSettled(resultSource === 'invite-restored');
      setResult({
        a, b, summary, at: Date.now(),
        sides: [sideFromSlot(sideA, a.label), sideFromSlot(sideB, b.label)],
        source: resultSource,
      });
      setInvite(inviteFromSlot(sideA));
      setInviteState('idle');
      setInvitePanelExpanded(false);
      setPairSave('idle');
      setPairAnnounce(''); // same-text re-announcements need a mutation
      track('compat_computed', {
        source: slotA.source === 'positions' && slotA.positions?.invite
          ? 'invite'
          : slotA.source === 'form' && slotB.source === 'form' ? 'form' : 'restored',
      });
    } catch (err) {
      if (!requestIsCurrent(request, accessGeneration)) return;
      setError(calculationError(err, locale, t(locale, 'compareError')));
      console.error(err);
    } finally {
      if (!requestIsCurrent(request, accessGeneration)) return;
      compareInFlightRef.current = false;
      setBusy(false);
    }
  }

  // Deep-linked pairs run themselves — the saved path is pure math.
  useEffect(() => {
    if (autoRan && slotReady(slotA) && slotReady(slotB) && !result && !busy) {
      compare();
    }
  }, [autoRan, profile, slotA, slotB]);

  // A restored comparison compares itself once the slots have settled.
  // The synthetic event marks the compute user-initiated, so focus moves
  // to the result like any pressed Compare. The tick is consumed on the
  // first non-busy evaluation whether or not it fires — a restore whose
  // slots were edited away must not ambush a later hand-filled form.
  useEffect(() => {
    if (restoreTick === 0 || busy) return;
    setRestoreTick(0);
    if (slotReady(slotA) && slotReady(slotB)) {
      compare(new Event('zodiacs:restore'));
    }
  }, [restoreTick, slotA, slotB, busy]);

  useEffect(() => {
    if (busy || !focusAfterComputeRef.current) return;
    if (error) {
      errorRef.current?.focus();
      focusAfterComputeRef.current = false;
      return;
    }
    if (result) {
      resultHeadingRef.current?.focus();
      focusAfterComputeRef.current = false;
    }
  }, [busy, error, result]);

  return (
    <div class="calc">
      {inviteUiError && <LoadRecovery error={inviteUiError} locale={locale} area="invite-ui" onRetry={() => setInviteUiRetry((n) => n + 1)} />}
      {returnBand === 'loading' && <p role="status">Opening the returned reading…</p>}
      {returnError && <LoadRecovery error={returnError} locale={locale} area="return" reopenLink onRetry={() => {
        if (returnTokenRef.current !== null) void openReturnedReading(returnTokenRef.current);
      }} />}
      {sendBackMod && (returnBand === 'valid' || returnBand === 'invalid') && (
        <sendBackMod.ReturnBand
          invalid={returnBand === 'invalid'}
          onDismiss={() => {
            returnTokenRef.current = null;
            setReturnBand('none');
            requestAnimationFrame(() => resultHeadingRef.current?.focus());
          }}
        />
      )}
      {arrival.state === 'error' && <LoadRecovery error={arrival.error} locale={locale} area="arrival" reopenLink onRetry={() => {
        if (inviteArrivalHandleRef.current) void openArrival(inviteArrivalHandleRef.current);
      }} />}
      {inviteExperienceMod && arrival.state !== 'idle' && arrival.state !== 'error' && (
        <inviteExperienceMod.InviteArrival
          view={arrival}
          onRetry={() => { if (inviteArrivalHandleRef.current) void openArrival(inviteArrivalHandleRef.current); }}
          onClear={() => {
            requestRef.current += 1;
            compareInFlightRef.current = false;
            focusAfterComputeRef.current = false;
            setBusy(false);
            inviteArrivalHandleRef.current = '';
            setSlotA(emptySlot());
            setArrival({ state: 'idle' });
            setPairAnnounce('Shared side removed. The page is a normal comparison now.');
          }}
        />
      )}
      <form class="calc__form shell" onSubmit={compare} aria-busy={busy}>
        <div class="core calc__core">
          {/* Always mounted: role=status nodes inserted together with
              their text are routinely missed by VoiceOver — the region
              must pre-exist (the ChartCalculator announcer pattern). */}
          <p class="sr-only" role="status">{pairAnnounce}</p>
          {visiblePairs.length > 0 && (
            <div class="syn__pairs">
              <span class="mono--label" id="syn-pairs-label">{pc(locale, 'savedPairs')}</span>
              {/* Explicit role: list-style:none strips list semantics in
                  Safari/VoiceOver. */}
              <ul class="syn__pairs-list" role="list" aria-labelledby="syn-pairs-label">
                {visiblePairs.map((pair, index) => {
                  const spoken = pairSpokenName(pair);
                  return (
                    <li key={pair.id} class="syn__pair">
                      <button
                        type="button" class="syn__pair-restore"
                        aria-label={`${t(locale, 'compareCharts')}: ${spoken}`}
                        onClick={() => restorePair(pair)}
                      >
                        {pairName(pair)}
                      </button>
                      <button
                        type="button" class="syn__pair-remove"
                        aria-label={`${t(locale, 'remove')}: ${spoken}`}
                        onClick={() => onRemovePair(pair, index)}
                      >×</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {prefilledPairMod && <prefilledPairMod.PrefilledPairNotice locale={locale} />}
          {showQuickFill && (
            <div class="syn__quick-row">
              <div class="syn__quick-fill">
                <button type="button" class="syn__quick-use" onClick={() => {
                  setQuickFillDismissed(true);
                  setSlotA((s) => ({ ...s, source: 'saved', savedId: latestChart.id }));
                }}>{pcf(locale, 'useMyChart', { handle: handleOf(latestChart.name) })}</button>
                <button type="button" class="syn__quick-dismiss" aria-label={pc(locale, 'dismissMyChart')} onClick={() => setQuickFillDismissed(true)}>×</button>
              </div>
            </div>
          )}
          <div class="syn__slots">
            <SlotForm
              slot={slotA}
              setSlot={(u) => setSlotA(u)}
              charts={charts}
              idPrefix="syn-a"
              fallbackLabel={t(locale, 'personA')}
              locale={locale}
              loadEngine={loadEngine}
            />
            <SlotForm slot={slotB} setSlot={(u) => setSlotB(u)} charts={charts} idPrefix="syn-b" fallbackLabel={t(locale, 'personB')} locale={locale} loadEngine={loadEngine} />
          </div>

          <button class="btn btn--primary calc__submit" type="submit" disabled={!canCompare}>
            <span>{busy ? t(locale, 'comparing') : t(locale, 'compareCharts')}</span>
            <span class="orb">↗</span>
          </button>
          <p class="calc__privacy">{t(locale, 'privacyDevice')}</p>
          {locale === 'en' && <p class="calc__guide">Questions about these charts? <a href="/ask/" data-assistant-open>Ask Guide</a></p>}
          {sameSaved && (
            <p class="field__help">{t(locale, 'sameChart')}</p>
          )}
          {charts.length < 2 && (
            <p class="field__help">
              {t(locale, 'compareSavedHelp')}{' '}
              <a href={localizePath(locale, '/birth-chart/')}>{t(locale, 'getBirthChart')} →</a>
            </p>
          )}
          {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <CalculationReload error={error} locale={locale} />
        </div>
      </form>

      {inviteExperienceMod && (
        <inviteExperienceMod.InvitePanel
          enabled={inviteUiActive}
          visible={
            (
              slotReady(slotA)
              && slotBIsUntouched
              && slotA.source !== 'positions'
              && !(slotA.source === 'link' && slotA.link?.received)
            )
            || invitePanelExpanded
          }
          charts={charts}
        />
      )}

      {result && (
        <div class={`calc__result syn-meet${meetingSettled ? ' is-settled' : ''}`}>
          <h2 class="sr-only" tabIndex={-1} ref={resultHeadingRef}>{t(locale, 'compatibility')}</h2>
          {wheelMod && <wheelMod.ResultOpening locale={locale} kind="pair" />}
          {wheelMod && [result.a, result.b].map((person, index) => <wheelMod.CheckOurMath key={index} locale={locale} subject={person.label} utc={person.computedUtc ?? person.utc} basis={person.timeKnown ? 'birth' : 'reference'} />)}
          {(!result.a.timeKnown || !result.b.timeKnown) && (
            <p class="notice" role="status">
              {t(locale, 'compareNoTimeNotice')} {new Intl.ListFormat(listLocale(locale), {
                style: 'long', type: 'conjunction',
              }).format([result.a, result.b].filter((p) => !p.timeKnown).map((p) => p.label))},
              {' '}{t(locale, 'moonMiddayEstimate')}
            </p>
          )}
          {[result.a, result.b].map((person, index) => person.oldStyle && (
            <p class="notice" role="status" key={index} data-old-style-date>
              {person.label}{locale === 'fr' ? '\u202f:' : ':'} {person.oldStyle}
            </p>
          ))}
          <div class="syn__people">
            <PersonCard person={result.a} locale={locale} />
            <span class="syn__vs mono">×</span>
            <PersonCard person={result.b} locale={locale} />
          </div>

          {wheelMod && (
            /* Keyed per compare: a fresh pair resets the swap and any
               focused contact — nothing stale carries over. */
            <wheelMod.default
              key={result.at}
              locale={locale}
              a={{
                label: result.a.label,
                bodies: result.a.wheel.bodies,
                depth: result.a.depth,
                asc: result.a.asc,
                mc: result.a.wheel.mc,
                cusps: result.a.wheel.cusps,
                timeKnown: result.a.timeKnown,
                untimedDate: result.a.untimedDate,
                utc: result.a.utc,
              }}
              b={{
                label: result.b.label,
                bodies: result.b.wheel.bodies,
                depth: result.b.depth,
                asc: result.b.asc,
                mc: result.b.wheel.mc,
                cusps: result.b.wheel.cusps,
                timeKnown: result.b.timeKnown,
                untimedDate: result.b.untimedDate,
                utc: result.b.utc,
              }}
              summary={result.summary}
            />
          )}

          {result.source === 'plain' && sendBackMod && (
            <sendBackMod.SendBackCard
              variant="share"
              a={result.a}
              b={result.b}
              summary={result.summary}
              inviterLabel={result.b.label}
            />
          )}

          {sharingLoadError && <LoadRecovery error={sharingLoadError} locale={locale} area="sharing" onRetry={() => setSharingRetry((n) => n + 1)} />}

          {(result.source === 'invite' || result.source === 'invite-restored') && sendBackMod && (
            <>
              <sendBackMod.SendBackCard
                a={result.a}
                b={result.b}
                summary={result.summary}
                inviterLabel={result.a.label}
                onReturned={(method) => track('invite_returned', { method })}
              />
              {result.source === 'invite'
                && (slotB.source === 'form' || slotB.source === 'saved') && (
                <sendBackMod.InvitationConversionCard
                  inviterLabel={result.a.label}
                  onSaveChart={saveInvitationOwnChart}
                  onSavePair={saveInvitationPair}
                  onStartOwn={startOwnInvitationLoop}
                  onConverted={(action) => track('invite_converted', { action })}
                />
              )}
            </>
          )}

          {(compatShareMod || (result.sides[0] && result.sides[1])) && (
            pairSaveComplete ? (
              <div class="syn__result-actions">
                {result.sides[0] && result.sides[1] && (
                  <div class="syn__save-complete" data-pair-status>
                    <div class="syn__save-status">
                      <span class="syn__save-check" aria-hidden="true">✓</span>
                      <span>
                        <strong>{pc(locale, 'savedPairTitle')}</strong>
                        <small>{pc(locale, 'reopenPairNote')}</small>
                      </span>
                    </div>
                    <a class="btn btn--ghost" href={localizePath(locale, '/profile/')}>
                      <span>{pc(locale, 'openSavedPairs')}</span>
                      <span class="orb" aria-hidden="true">→</span>
                    </a>
                  </div>
                )}
                {compatShareMod && (
                  <div class="calc__actions syn__result-secondary">
                    <compatShareMod.CompatibilityPairingCta
                      a={{ label: result.a.label, bodies: result.a.bodies, asc: result.a.asc }}
                      b={{ label: result.b.label, bodies: result.b.bodies, asc: result.b.asc }}
                      locale={locale}
                    />
                    <compatShareMod.CompatibilityShareControl
                      key={result.at}
                      a={{ label: result.a.label, bodies: result.a.bodies, asc: result.a.asc, untimedDate: result.a.untimedDate, utc: result.a.utc }}
                      b={{ label: result.b.label, bodies: result.b.bodies, asc: result.b.asc, untimedDate: result.b.untimedDate, utc: result.b.utc }}
                      summary={result.summary}
                      locale={locale}
                    />
                  </div>
                )}
              </div>
            ) : result.sides[0] && result.sides[1] ? (
              <NextActionCard
                className="syn__next-action"
                cue={pc(locale, 'saveCue')}
                title={pc(locale, 'savePairTitle')}
                body={pc(locale, 'savePairBenefit')}
                headingLevel={3}
                primary={(
                  <button
                    type="button" class="btn btn--primary" data-save-pair onClick={onSavePair}
                  >
                    <span>{pc(locale, 'savePair')}</span>
                    <span class="orb" aria-hidden="true">+</span>
                  </button>
                )}
                secondary={compatShareMod ? (
                  <>
                    <compatShareMod.CompatibilityPairingCta
                      a={{ label: result.a.label, bodies: result.a.bodies, asc: result.a.asc }}
                      b={{ label: result.b.label, bodies: result.b.bodies, asc: result.b.asc }}
                      locale={locale}
                    />
                    <compatShareMod.CompatibilityShareControl
                      key={result.at}
                      a={{ label: result.a.label, bodies: result.a.bodies, asc: result.a.asc, untimedDate: result.a.untimedDate, utc: result.a.utc }}
                      b={{ label: result.b.label, bodies: result.b.bodies, asc: result.b.asc, untimedDate: result.b.untimedDate, utc: result.b.utc }}
                      summary={result.summary}
                      locale={locale}
                    />
                  </>
                ) : undefined}
              />
            ) : null
          )}
          {/* Announcement rides the persistent status node above; these
              visible notes are for sighted users (alerts announce fine
              on insertion). */}
          {(pairSave === 'full' || pairSave === 'error') && (
            pairSave === 'full'
              ? <p class="calc__error" role="alert" data-pair-status>{pcf(locale, 'pairSaveFull', { n: MAX_PAIRS })}</p>
              : <p class="calc__error" role="alert" data-pair-status>{t(locale, 'chartSaveError')}</p>
          )}

          {/* Invite: A's side rides in the link; B fills their own */}
          {invite && CopyLinkButton && shareMod && (
            <div class="calc__share">
              <CopyLinkButton
                url={inviteUrl()}
                state={inviteState}
                onStateChange={setInviteState}
                idleLabel={tf(locale, 'inviteWith', { name: result.a.label })}
                copiedLabel={t(locale, 'linkCopied')}
                ariaLabel={t(locale, 'inviteLink')}
                buttonClass="btn btn--ghost"
                dataHook="invite"
              >
                <p class="calc__share-note">
                  {tf(locale, 'inviteNamedNote', { name: result.a.label })}
                </p>
                {inviteState === 'copied' && (
                  <p class="sr-only" role="status">{t(locale, 'inviteCopied')}</p>
                )}
              </CopyLinkButton>
            </div>
          )}
          {inviteUiActive
            && inviteExperienceMod
            && result.source === 'plain'
            && slotA.source !== 'positions'
            && !(slotA.source === 'link' && slotA.link?.received)
            && !invitePanelExpanded && (
              <button
                type="button"
                class="btn btn--ghost syn-invite__open"
                onClick={() => {
                  setInvitePanelExpanded(true);
                  requestAnimationFrame(() => {
                    document.getElementById('syn-invite-title')?.scrollIntoView({
                      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                      block: 'center',
                    });
                  });
                }}
              >
                Invite someone to compare with {result.a.label}
              </button>
            )}
        </div>
      )}
    </div>
  );
}
