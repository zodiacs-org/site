/**
 * The calculator island — birth data in, chart out, entirely on-device.
 * The ephemeris (engine/full) is lazy-loaded so the form is interactive
 * immediately; a prefetch warms it on first focus.
 *
 * mode:
 *   'full'   — the flagship: big three, wheel, placements, aspects
 *   'moon'   — moon-focused result view (same engine)
 *   'rising' — rising-focused result view (time required)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BirthFields, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import AstroTerm from './AstroTerm';
import SignChip from './SignChip';
import PlanetGlyph from '../components/PlanetGlyph';
import AspectGlyph from '../components/AspectGlyph';
import Wheel from '../lib/wheel/Wheel';
import LayerChips from './explorer/LayerChips';
import { moonCandidates, moonIsUncertain, moonLabel } from '../lib/moon-certainty';
import { createModuleLoader } from '../lib/module-load';
import { downloadCalculationReceipt } from '../lib/receipt-download';
import { savedRecordsEnabled } from '../lib/profile/saved-record-flags';
import type { SavedRecordsCopy } from './saved-records-copy';
import type { ReadingScrollBehavior } from './explorer/ReadingPath';
import {
  EMPTY_FIRST_READING,
  readFirstReadingProgress,
  writeFirstReadingProgress,
  type FirstReadingProgress,
  type FirstReadingStatus,
} from './explorer/tour/progress';
import { buildSceneModel } from '../lib/scene/build';
import { emphasisFor } from '../lib/scene/emphasis';
import {
  ALL_ASPECT_TYPES, entityId, parseEntityId,
  type ChartSceneModel, type EntityRef,
} from '../lib/scene/types';
import { formatLongitude, signBySlug, signForLongitude, signName } from '../lib/signs';
import { signIcon } from '../lib/sign-icon';
import { bigThree } from '../lib/interpretations';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import { assessLocalDateReference } from '../lib/time/local-date-reference';
import { houseOf } from '../lib/engine/houses';
import { moonPhaseNameFromAngle } from '../lib/engine/lite';
import { registryAuraChartAnalytics, registryAuraChartLink } from '../lib/registry-aura-entry.mjs';
import { decodeChartLink, NAME_MAX } from '../lib/share';
import type { ShareChartInput } from '../lib/share';
import {
  chartHandoffFragment,
  dateHandoffFromHash,
  compatibilityHandoffPath,
  mineHandoffFromHash,
  profileChartIdFromHash,
  profileHandoffOriginsFromHash,
  someoneElseHandoffPath,
  someoneElseProfileHandoffPath,
  subjectModeFromHash,
  type MineHandoff,
  type SubjectMode,
} from '../lib/chart-handoff';
import type { PositionsShareChart } from '../lib/share-positions';
import type { TourVisual } from '../lib/scene/chapters';
import { ENGINE_VERSION } from '../lib/engine/types';
import type { Chart, HouseSystem } from '../lib/engine/types';
import type { City } from '../lib/geo/search';
import { CATALOG_LOCALES, RELEASED_LOCALES, localizePath, normalizeCatalogLocale, t, tf, tp, type CatalogLocale as Locale, type ReleasedLocale } from '../lib/i18n';
import { aspectLabel, moonPhaseLabel, planetLabel } from '../lib/i18n/astrology';
import { russianRuntime } from '../lib/i18n/ru-runtime';
import { useEngine } from '../lib/hooks/useEngine';
import CalculationReload, { calculationError, calculationLoadMessage } from './CalculationReload';
import { useProfileAccessGeneration } from '../lib/hooks/useProfileAccessGeneration';
import { profileAccessAllowed } from '../lib/account-v2/profile-access-reader';
import { learningInputIdentity } from '../lib/learning-input-identity';
import type { AspectType } from '../lib/engine/types';
import { trackAnalytics } from '../lib/analytics';
import {
  clearPostChartContext,
  publishPostChartContext,
} from '../lib/profile/post-chart-context';
import '../styles/evidence-disclosure.css';

type Mode = 'full' | 'moon' | 'rising';

interface Props { mode: Mode; locale?: Locale }

interface RunInput {
  date: string;
  time: string;
  timeKnown: boolean;
  city: City;
  houseSystem: HouseSystem;
  name?: string;
  subjectMode?: SubjectMode;
  mine?: MineHandoff | null;
  /** The entered Old Style date beside the Gregorian `date`, as one line for the result. */
  oldStyle?: string;
}

interface FormFieldErrors {
  date?: 'required' | 'range';
  /** A date that does not exist in its calendar, or cannot be read as a date. */
  calendar?: string;
  time?: boolean;
  place?: boolean;
}

type ChartComputedSource = 'fresh' | 'shared_details' | 'shared_positions';
type ChartSignature = import('../lib/chart-signature').ChartSignature;

type ShareSurfaceModule = typeof import('./PositionsShareSurface');
type ShareDialogModule = typeof import('./ChartShareDialog');
type ChartActionDockModule = typeof import('./ChartActionDock');
const loadChartControls = createModuleLoader(() => import('./ChartActionDock'));
const loadCalculatorReceipt = createModuleLoader(() => import('../lib/engine/calculator-receipt'));
interface ChartResultOwner {
  chart: Chart;
  runId: number;
  inputRevision: number;
  accessGeneration: number;
  requiresProfileAccess: boolean;
}
interface ChartReceiptExport extends ChartResultOwner {
  envelopeJson: string;
}
type SavedRecordAccess = typeof import('../lib/profile/saved-record-access');
type SavedRecordScope = import('../lib/profile/saved-record-access').SavedRecordScope;
type SavedRecordMode = import('../lib/profile/saved-record-access').SavedRecordMode;
/** Explicit keep-on-this-device outcome for the current result; never retried automatically. */
type RecordKeepStatus = 'opening' | 'idle' | 'busy' | 'kept' | 'uncertain' | 'changed' | 'failed' | 'full' | 'unavailable' | 'locked' | 'read-only' | 'pending' | 'stale';
type PreparedPrimaryShare = Awaited<ReturnType<ShareSurfaceModule['preparePrimaryShareArtifact']>>;
type PrimaryShareHandle = {
  artifact: PreparedPrimaryShare;
  share: ShareSurfaceModule['sharePrimaryArtifact'];
};
interface ShareRuntime {
  surface?: ShareSurfaceModule;
  dialog?: ShareDialogModule['default'];
  primary?: PrimaryShareHandle;
}
type TourModule = typeof import('./explorer/tour');
type LensModule = typeof import('./explorer/lens/ChartLens');
type DepthModule = typeof import('./chart3d/EclipticView');
type LensId = import('./explorer/lens/copy').LensId;
type LensRingRenderer = (geo: import('../lib/wheel/Wheel').WheelGeometry) => import('preact').ComponentChildren;

/** Rail labels stay host-local: they render before the lens module loads. */
const LENS_LABELS: Record<ReleasedLocale, Record<'rail' | 'natal' | LensId, string>> = {
  en: { rail: 'Chart through time', natal: 'Natal', sky: 'Sky now', progressed: 'Progressed', return: 'Solar return' },
  es: { rail: 'La carta en el tiempo', natal: 'Natal', sky: 'Cielo ahora', progressed: 'Progresada', return: 'Retorno solar' },
  pt: { rail: 'O mapa ao longo do tempo', natal: 'Natal', sky: 'Céu agora', progressed: 'Progredido', return: 'Retorno solar' },
  fr: { rail: 'Le thème au fil du temps', natal: 'Natal', sky: 'Ciel actuel', progressed: 'Progressé', return: 'Révolution solaire' },
  it: { rail: 'Il tema nel tempo', natal: 'Natale', sky: 'Cielo attuale', progressed: 'Progredito', return: 'Rivoluzione solare' },
};
const DETAIL_LABELS: Record<ReleasedLocale, { lead: string; placements: string; aspects: string }> = {
  en: { lead: 'See exact chart data — ', placements: ' placements · ', aspects: ' aspects' },
  es: { lead: 'Ver los datos exactos — ', placements: ' posiciones · ', aspects: ' aspectos' },
  pt: { lead: 'Ver os dados exatos — ', placements: ' posições · ', aspects: ' aspectos' },
  fr: { lead: 'Voir les données exactes — ', placements: ' positions · ', aspects: ' aspects' },
  it: { lead: 'Vedi i dati esatti — ', placements: ' posizioni · ', aspects: ' aspetti' },
};
const DETAIL_STORAGE_KEY = 'zodiacs.detail.v1';
const CHART_BOOK_COPY = {
  en: { label: 'Whose chart is this?', save: 'Save', skip: 'Skip' },
  es: { label: '¿De quién es esta carta?', save: 'Guardar', skip: 'Omitir' },
  pt: { label: 'De quem é este mapa?', save: 'Salvar', skip: 'Pular' },
  fr: { label: 'À qui appartient ce thème\u202f?', save: 'Enregistrer', skip: 'Passer' },
  it: { label: 'Di chi è questo tema?', save: 'Salva', skip: 'Salta' },
} as const satisfies Record<ReleasedLocale, { label: string; save: string; skip: string }>;
const REGISTRY_AURA_CHART_COPY = {
  en: {
    discover: 'Your saved chart can meet the Registry records carried by a public address.',
    discoverLink: 'Read this chart beside a public address →',
    return: 'Your chart is saved.',
    returnLink: 'Return to Registry Collection →',
  },
  es: {
    discover: 'Tu carta guardada puede encontrarse con los registros que lleva una dirección pública.',
    discoverLink: 'Lee esta carta junto a una dirección pública →',
    return: 'Tu carta está guardada.',
    returnLink: 'Volver a Registry Collection →',
  },
  pt: {
    discover: 'Seu mapa salvo pode se encontrar com os registros associados a um endereço público.',
    discoverLink: 'Leia este mapa ao lado de um endereço público →',
    return: 'Seu mapa foi salvo.',
    returnLink: 'Voltar para Registry Collection →',
  },
  fr: {
    discover: 'Votre thème enregistré peut rencontrer les notices portées par une adresse publique.',
    discoverLink: 'Lire ce thème à côté d’une adresse publique →',
    return: 'Votre thème est enregistré.',
    returnLink: 'Retourner à Registry Collection →',
  },
  it: {
    discover: 'Il tema salvato può incontrare i registri associati a un indirizzo pubblico.',
    discoverLink: 'Leggi questa carta accanto a un indirizzo pubblico →',
    return: 'Il tema è stato salvato.',
    returnLink: 'Torna a Registry Collection →',
  },
} as const satisfies Record<ReleasedLocale, {
  discover: string;
  discoverLink: string;
  return: string;
  returnLink: string;
}>;
const PERSON_CHART_COPY = {
  en: (name: string) => `${name}'s chart — "you" below means ${name}.`,
  es: (name: string) => `La carta de ${name}: el "tú" de abajo se refiere a ${name}.`,
  pt: (name: string) => `O mapa de ${name}: o "você" abaixo se refere a ${name}.`,
  fr: (name: string) => `Le thème de ${name}\u00a0: le «\u00a0tu\u00a0» ci-dessous désigne ${name}.`,
  it: (name: string) => `Il tema di ${name}: il «tu» qui sotto si riferisce a ${name}.`,
} satisfies Record<ReleasedLocale, (name: string) => string>;
const OTHER_SUBJECT_COPY = {
  en: {
    unnamed: 'You’re reading someone else’s chart. “You” below means the person whose birth details you entered.',
    named: (name: string) => `You’re reading ${name}’s chart. “You” below means ${name}.`,
    heading: (name: string | null) => name ? `${name}’s birth chart` : 'Someone else’s birth chart',
    submit: 'Update their chart',
    privacy: 'Private by default. Their birth details stay in this browser.',
  },
  es: {
    unnamed: 'Estás leyendo la carta de otra persona. El “tú” de abajo se refiere a la persona cuyos datos ingresaste.',
    named: (name: string) => `Estás leyendo la carta de ${name}. El “tú” de abajo se refiere a ${name}.`,
    heading: (name: string | null) => name ? `Carta natal de ${name}` : 'Carta natal de otra persona',
    submit: 'Actualizar su carta',
    privacy: 'Privado de forma predeterminada. Sus datos de nacimiento permanecen en este navegador.',
  },
  pt: {
    unnamed: 'Você está lendo o mapa de outra pessoa. O “você” abaixo se refere à pessoa cujos dados foram inseridos.',
    named: (name: string) => `Você está lendo o mapa de ${name}. O “você” abaixo se refere a ${name}.`,
    heading: (name: string | null) => name ? `Mapa astral de ${name}` : 'Mapa astral de outra pessoa',
    submit: 'Atualizar o mapa dela',
    privacy: 'Privado por padrão. Os dados de nascimento dessa pessoa permanecem neste navegador.',
  },
  fr: {
    unnamed: 'Tu lis le thème d’une autre personne. Le « tu » ci-dessous désigne la personne dont tu as saisi les données.',
    named: (name: string) => `Tu lis le thème de ${name}. Le « tu » ci-dessous désigne ${name}.`,
    heading: (name: string | null) => name ? `Thème astral de ${name}` : 'Thème astral d’une autre personne',
    submit: 'Mettre son thème à jour',
    privacy: 'Privé par défaut. Ses données de naissance restent dans ce navigateur.',
  },
  it: {
    unnamed: 'Stai leggendo il tema di un’altra persona. Il «tu» qui sotto indica la persona di cui hai inserito i dati.',
    named: (name: string) => `Stai leggendo il tema di ${name}. Il «tu» qui sotto indica ${name}.`,
    heading: (name: string | null) => name ? `Tema natale di ${name}` : 'Tema natale di un’altra persona',
    submit: 'Aggiorna il suo tema',
    privacy: 'Privato per impostazione predefinita. I suoi dati di nascita restano in questo browser.',
  },
} as const satisfies Record<ReleasedLocale, {
  unnamed: string;
  named: (name: string) => string;
  heading: (name: string | null) => string;
  submit: string;
  privacy: string;
}>;
const AUTO_NAME_SUN = {
  en: 'Sun',
  es: 'Sol',
  pt: 'Sol',
  fr: 'Soleil',
  it: 'Sole',
} as const satisfies Record<ReleasedLocale, string>;

// Recognition spans locales, while each browser page loads only its own catalog.
const AUTO_NAME_REFERENCE = {
  en: 'Reference', es: 'Referencia', pt: 'Referência',
  fr: 'Référence', it: 'Riferimento', ru: 'Ориентир',
} as const;

function russianNameTemplate(template: string, name: string): string {
  return template.replaceAll('{name}', name);
}
type SavePrefillSource = 'link' | 'match' | 'auto';
type CalendarSubscribeModule = typeof import('./CalendarSubscribe');
type CommunicationReadModule = typeof import('./CommunicationRead');
type ApproachReadModule = typeof import('./ApproachRead');
type A2hsHint = import('../lib/a2hs').A2hsHint;
type PushOptInModule = typeof import('./PushOptIn');
type PwaInstallModule = typeof import('./PwaInstallPrompt');

interface ChartSpotlight {
  id: string;
  run: number;
  phase: 'primed' | 'settled';
  motion: 'animated' | 'instant';
}

const WEB_PUSH_ENABLED = import.meta.env.PUBLIC_WEB_PUSH_ENABLED === '1';

/** Does the scene still contain the selected entity? (Recompute survival.) */
function sceneHas(scene: ChartSceneModel, ref: EntityRef): boolean {
  switch (ref.kind) {
    case 'body': return scene.bodies.some((b) => b.body === ref.body);
    case 'sign': return scene.signs.some((s) => s.slug === ref.sign);
    case 'house': return scene.houses != null && ref.house >= 1 && ref.house <= 12;
    case 'aspect': return scene.aspects.some((a) => a.a === ref.a && a.b === ref.b && a.type === ref.type);
    case 'angle': return scene.angles != null;
  }
}

/** Receipt fragment for the computed house system; EN gets the tap-to-explain term. */
function HouseSystemReceipt({ locale, system }: { locale: Locale; system: HouseSystem }) {
  const label = t(locale, system === 'whole' ? 'wholeSignHouses' : 'placidusHouses');
  if (locale !== 'en') return <>{` · ${label}`}</>;
  return (
    <>
      {' · '}
      <AstroTerm
        term={system === 'whole' ? 'whole-sign-houses' : 'placidus'}
        label={label}
        surface="chart-receipt"
      />
    </>
  );
}

export default function ChartCalculator({ mode, locale: rawLocale = 'en' }: Props) {
  const locale = normalizeCatalogLocale(rawLocale);
  const russianCopy = locale === 'ru' ? russianRuntime() : null;
  const releasedLocale: ReleasedLocale | null = locale === 'ru' ? null : locale;
  const lensLabels = russianCopy?.chart.lens ?? LENS_LABELS[releasedLocale!];
  const detailLabels = russianCopy?.chart.detail ?? DETAIL_LABELS[releasedLocale!];
  const wheelActionCopy = russianCopy?.chart.wheelActions ?? {
    actions: t(locale, 'chartWheelActions'),
    guide: t(locale, 'chartWheelGuide'),
    replay: t(locale, 'chartWheelReplay'),
    another: t(locale, 'chartWheelAnother'),
    signatureSelf: t(locale, 'chartWheelSignatureSelf'),
    signatureOther: t(locale, 'chartWheelSignatureOther'),
    compareMine: t(locale, 'chartWheelCompareMine'),
    compareAdd: t(locale, 'chartWheelCompareAdd'),
    shareOther: t(locale, 'chartWheelShareOther'),
  };
  const chartBookCopy = russianCopy?.chart.chartBook ?? CHART_BOOK_COPY[releasedLocale!];
  const registryAuraCopy = russianCopy?.chart.registryAura ?? REGISTRY_AURA_CHART_COPY[releasedLocale!];
  const otherSubjectCopy = russianCopy
    ? {
        unnamed: russianCopy.chart.otherSubject.unnamed,
        named: (name: string) => russianNameTemplate(russianCopy.chart.otherSubject.namedTemplate, name),
        heading: (name: string | null) => name
          ? russianNameTemplate(russianCopy.chart.otherSubject.headingTemplate, name)
          : russianCopy.chart.otherSubject.headingUnnamed,
        submit: russianCopy.chart.otherSubject.submit,
        privacy: russianCopy.chart.otherSubject.privacy,
      }
    : OTHER_SUBJECT_COPY[releasedLocale!];
  const personChartCopy = (name: string) => russianCopy
    ? russianNameTemplate(russianCopy.chart.personChartTemplate, name)
    : PERSON_CHART_COPY[releasedLocale!](name);
  const showsEnglishInterpretation = locale === 'en';
  const registryAuraLink = typeof window === 'undefined'
    ? null
    : registryAuraChartLink(window.location.search, {
        PUBLIC_REGISTRY_COLLECTION_ENABLED: import.meta.env.PUBLIC_REGISTRY_COLLECTION_ENABLED,
        PUBLIC_REGISTRY_AURA_ENABLED: import.meta.env.PUBLIC_REGISTRY_AURA_ENABLED,
      });
  const loadEngine = useEngine();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timeKnown, setTimeKnown] = useState(true);
  const [city, setCity] = useState<City | null>(null);
  // The calendar the date was written in; a date filled in from a link or a
  // saved chart is Gregorian.
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  // That date, which was already charted: it gets no calendar note, which
  // could send it through the Old Style conversion a second time.
  const [storedDate, setStoredDate] = useState('');
  const [houseSystem, setHouseSystem] = useState<HouseSystem>('whole');
  const [chart, setChart] = useState<Chart | null>(null);
  // Read on the birthplace's own local mean time. Since engine rc.15 the
  // `lmt` flag says so too, whole minutes included; before, it marked only an
  // offset with seconds, which a whole-minute mean time lacked.
  const [onMeanTime, setOnMeanTime] = useState(false);
  const resultOwnerRef = useRef<ChartResultOwner | null>(null);
  const [receiptExport, setReceiptExport] = useState<ChartReceiptExport | null>(null);
  const receiptExportRef = useRef<ChartReceiptExport | null>(null);
  const [receiptDownloadError, setReceiptDownloadError] = useState(false);
  const [recordKeep, setRecordKeep] = useState<RecordKeepStatus>('idle');
  const [recordMode, setRecordMode] = useState<SavedRecordMode | null>(null);
  const [recordErasedNote, setRecordErasedNote] = useState(false);
  // Copy loads with the record module, keeping the route closure unchanged when nothing is kept.
  const [recordCopy, setRecordCopy] = useState<SavedRecordsCopy | null>(null);
  const recordScopeRef = useRef<SavedRecordScope | null>(null);
  const recordAccessRef = useRef<SavedRecordAccess | null>(null);
  /** Fences scope re-opens (any access or scope change) against each other. */
  const recordKeepRunRef = useRef(0);
  /** Fences a keep outcome to the result it was clicked for; only a new or cleared result advances it. */
  const recordResultRunRef = useRef(0);
  /** Re-opens the record scope after a refusal that a fresh inventory can explain (erased elsewhere). */
  const recordReopenRef = useRef<(() => void) | null>(null);
  /** The namespace this result was kept in; a re-open of the same admitted namespace keeps the confirmation. */
  /** The record this result was confirmed kept as, so a removal elsewhere can withdraw "Kept". */
  const recordKeptRef = useRef<{ ownerKey: string; id: string } | null>(null);
  const recordKeptNoteRef = useRef<HTMLParagraphElement | null>(null);
  const recordsEnabled = mode === 'full' && savedRecordsEnabled();
  const [signature, setSignature] = useState<ChartSignature | null>(null);
  const [moonAmbiguous, setMoonAmbiguous] = useState(false);
  const [registryRecordSlug, setRegistryRecordSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
  const [saved, setSaved] = useState<'idle' | 'saved' | 'full' | 'error'>('idle');
  const [shareInput, setShareInput] = useState<ShareChartInput | null>(null);
  const [computedInput, setComputedInput] = useState<RunInput | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const [card, setCard] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle');
  const [fromLink, setFromLink] = useState(false);
  const [linkName, setLinkName] = useState<string | null>(null);
  const [subjectMode, setSubjectMode] = useState<SubjectMode>('self');
  const [mineHandoff, setMineHandoff] = useState<MineHandoff | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const savePromptGenerationRef = useRef(0);
  const [saveDraft, setSaveDraft] = useState('');
  const [saveInitial, setSaveInitial] = useState('');
  const [saveSource, setSaveSource] = useState<SavePrefillSource>('auto');
  const [positionsOnly, setPositionsOnly] = useState<PositionsShareChart | null>(null);
  const [depthMod, setDepthMod] = useState<DepthModule | null>(null);
  const [depthOpen, setDepthOpen] = useState(false);
  const [calendarSurface, setCalendarSurface] = useState<CalendarSubscribeModule | null>(null);
  const [chartActionDockModule, setChartActionDockModule] = useState<ChartActionDockModule | null>(null);
  const [controlsError, setControlsError] = useState(false);
  const [communicationSurface, setCommunicationSurface] = useState<CommunicationReadModule | null>(null);
  const [approachSurface, setApproachSurface] = useState<ApproachReadModule | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [a2hsHint, setA2hsHint] = useState<A2hsHint | null>(null);
  const [pushOptIn, setPushOptIn] = useState<PushOptInModule | null>(null);
  const [pwaInstallModule, setPwaInstallModule] = useState<PwaInstallModule | null>(null);
  const [pwaComputationCount, setPwaComputationCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const saveNameRef = useRef<HTMLInputElement>(null);
  const saveReturnRef = useRef<HTMLElement | null>(null);
  const saveOriginRef = useRef<'tour' | 'free'>('free');
  const shareReturnRef = useRef<HTMLElement | null>(null);
  const focusAfterComputeRef = useRef(false);
  const chartContextIdRef = useRef(0);
  const inputRevisionRef = useRef(0);
  const [inputRevision, setInputRevision] = useState(0);
  function clearReceiptExport(): void {
    receiptExportRef.current = null;
    setReceiptExport(null);
    setReceiptDownloadError(false);
  }
  function advanceInputRevision(): void {
    clearReceiptExport();
    inputRevisionRef.current += 1;
    setInputRevision(inputRevisionRef.current);
  }
  function resultIsCurrent(owner: ChartResultOwner | null): owner is ChartResultOwner {
    return owner !== null && owner === resultOwnerRef.current
      && owner.runId === runChartIdRef.current
      && owner.inputRevision === inputRevisionRef.current
      && (!owner.requiresProfileAccess || (
        owner.accessGeneration === profileAccessGeneration.current && profileAccessAllowed()
      ));
  }
  function currentResultOwner(): ChartResultOwner | null {
    const owner = resultOwnerRef.current;
    return resultIsCurrent(owner) && owner.chart === chart ? owner : null;
  }
  function clearResult(): void {
    savePromptGenerationRef.current += 1;
    resultOwnerRef.current = null;
    clearReceiptExport();
    chartContextIdRef.current += 1;
    clearPostChartContext();
    shareRuntimeRef.current.primary = undefined;
    setChart(null);
    setOnMeanTime(false);
    setComputedInput(null);
    setShareInput(null);
    setSignature(null);
    setRegistryRecordSlug(null);
    setPositionsOnly(null);
    setMoonAmbiguous(false);
    setCard('idle');
    setSaved('idle');
    setMatchedName(null);
    setSavePromptOpen(false);
    setShareDialogOpen(false);
    setA2hsHint(null);
    resetLens();
    exitTour();
    cancelSpotlightArrival();
    setSelection(null);
    setSpotlight(null);
    setAnnounce('');
    setDepthOpen(false);
  }
  const registryBridgeImpressionChartRef = useRef<Chart | null>(null);
  const primaryProfileOriginRef = useRef(false);
  const primaryProfileChartIdRef = useRef<string | null>(null);
  const mineProfileOriginRef = useRef(false);
  const runChartIdRef = useRef(0);
  useEffect(() => () => {
    runChartIdRef.current += 1;
    chartContextIdRef.current += 1;
    resultOwnerRef.current = null;
    receiptExportRef.current = null;
    shareRuntimeRef.current.primary = undefined;
    clearPostChartContext();
  }, []);

  // The record scope answers "can this result be kept, and for whom?" It is
  // opened lazily once a result exists and re-opened after every access or
  // scope change; a stale handle is closed, never reused.
  useEffect(() => {
    // A new or cleared result invalidates every keep outcome of the previous one.
    recordResultRunRef.current += 1;
    recordKeepRunRef.current += 1;
    recordKeptRef.current = null;
    setRecordErasedNote(false);
    if (!recordsEnabled || !receiptExport) { setRecordKeep('idle'); recordReopenRef.current = null; return; }
    setRecordKeep('opening');
    let live = true;
    let unsubscribe = () => {};
    const reopen = async () => {
      const run = ++recordKeepRunRef.current;
      recordScopeRef.current?.close();
      recordScopeRef.current = null;
      setRecordMode(null);
      // The button waits until the scope is known; a keep in flight and an
      // uncertain outcome for this result keep their own state.
      setRecordKeep((current) => (current === 'busy' || current === 'uncertain' ? current : 'opening'));
      try {
        const [api, copyModule] = await Promise.all([
          recordAccessRef.current ?? import('../lib/profile/saved-record-access'),
          import('./saved-records-copy'),
        ]);
        recordAccessRef.current = api;
        if (live) setRecordCopy(copyModule.SAVED_RECORDS_COPY[locale]);
        const opened = await api.openSavedRecordScope();
        if (!live || run !== recordKeepRunRef.current) { if (opened.status === 'ready') opened.scope.close(); return; }
        if (opened.status === 'stale') {
          // The evaluation moved during the open; the change that moved it
          // has scheduled its own re-open unless it landed before subscribing.
          setTimeout(() => { if (live && run === recordKeepRunRef.current) void reopen(); }, 0);
          return;
        }
        if (opened.status !== 'ready') {
          setRecordKeep((current) => (current === 'busy' || current === 'uncertain' || current === 'changed' ? current
            : opened.status === 'locked' ? 'locked' : opened.status === 'pending' ? 'pending' : 'unavailable'));
          return;
        }
        recordScopeRef.current = opened.scope;
        setRecordMode(opened.scope.mode);
        setRecordErasedNote(opened.scope.state === 'owner-erased' || opened.scope.state === 'device-erased');
        const next: RecordKeepStatus = !opened.scope.canSave ? 'read-only' : opened.scope.state === 'erasure-pending' ? 'pending' : 'idle';
        // A keep still in flight reports its own outcome, and an uncertain
        // outcome for this result stays stated until the visitor reconciles
        // it under Profile; a confirmed keep survives only while the same
        // namespace is still admitted. The fresh scope replaces the rest.
        const kept = recordKeptRef.current;
        const sameKeptNamespace = opened.scope.state === null && kept !== null && opened.scope.ownerKey === kept.ownerKey;
        setRecordKeep((current) => (current === 'busy' || current === 'uncertain' || current === 'changed'
          || (current === 'kept' && sameKeptNamespace) ? current : next));
        if (!sameKeptNamespace) return;
        // The namespace survived the change that re-opened it, but the kept
        // record itself may have been removed under Profile in another tab:
        // "Kept" is withdrawn only once its absence is read from the store.
        const found = await opened.scope.store.get(kept.id);
        if (!live || run !== recordKeepRunRef.current || recordKeptRef.current !== kept) return;
        if (found.ok && found.value === null) {
          recordKeptRef.current = null;
          setRecordKeep((current) => (current === 'kept' ? next : current));
        }
      } catch {
        if (live && run === recordKeepRunRef.current) setRecordKeep('unavailable');
      }
    };
    recordReopenRef.current = () => { if (live) void reopen(); };
    void reopen();
    void import('../lib/profile/saved-record-access').then((api) => {
      if (!live) return;
      recordAccessRef.current = api;
      unsubscribe = api.subscribeSavedRecordScope(() => {
        recordKeepRunRef.current += 1;
        setRecordKeep((current) => (current === 'busy' || current === 'uncertain' || current === 'changed' ? current : 'stale'));
        setTimeout(() => { if (live) void reopen(); }, 0);
      });
    }).catch(() => {});
    return () => {
      live = false;
      unsubscribe();
      recordReopenRef.current = null;
      recordResultRunRef.current += 1;
      recordKeepRunRef.current += 1;
      recordScopeRef.current?.close();
      recordScopeRef.current = null;
    };
  }, [recordsEnabled, receiptExport]);
  const profileHandoffIdRef = useRef(0);
  const shareRuntimeRef = useRef<ShareRuntime>({});
  const profileAccessGeneration = useProfileAccessGeneration(() => {
    savePromptGenerationRef.current += 1;
    setMatchedName(null);
    setSaved('idle');
    setSavePromptOpen(false);
    setSaveDraft('');
    setSaveInitial('');
    setSaveSource('auto');
    if (mineProfileOriginRef.current) {
      mineProfileOriginRef.current = false;
      setMineHandoff(null);
    }
    if (!primaryProfileOriginRef.current) return;
    primaryProfileOriginRef.current = false;
    primaryProfileChartIdRef.current = null;
    runChartIdRef.current += 1;
    advanceInputRevision();
    clearResult();
    setDate('');
    setCalendar('gregorian');
    setStoredDate('');
    setTime('');
    setTimeKnown(true);
    setCity(null);
    setHouseSystem('whole');
    setFromLink(false);
    setLinkName(null);
    setSubjectMode('self');
    setError('');
    setFieldErrors({});
    setBusy(false);
    focusAfterComputeRef.current = false;
    try {
      setFirstReading(readFirstReadingProgress(localStorage));
    } catch { /* blocked storage keeps the already-scrubbed in-memory state */ }
  });

  function invalidateProfileHandoff(): void {
    advanceInputRevision();
    profileHandoffIdRef.current += 1;
    primaryProfileChartIdRef.current = null;
    runChartIdRef.current += 1;
    clearResult();
    setBusy(false);
    focusAfterComputeRef.current = false;
  }

  // ── Chart Explorer state (full mode) ──
  const [selection, setSelection] = useState<EntityRef | null>(null);
  const [aspectTypes, setAspectTypes] = useState<AspectType[]>(ALL_ASPECT_TYPES);
  const [showHouses, setShowHouses] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [spotlight, setSpotlight] = useState<ChartSpotlight | null>(null);
  const selFromUrl = useRef(false);
  const wheelboxRef = useRef<HTMLDivElement>(null);
  const detailPreferenceRef = useRef<'open' | 'closed' | null>(null);
  const spotlightRunRef = useRef(0);
  const spotlightArrivalCleanupRef = useRef<(() => void) | null>(null);

  // ── Guided tour (lazy — the module never loads until asked for) ──
  const [tourMod, setTourMod] = useState<TourModule | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourKind, setTourKind] = useState<'quick' | 'full' | null>(null);
  const [tourVisual, setTourVisual] = useState<TourVisual | null>(null);
  const [firstReading, setFirstReading] = useState<FirstReadingProgress>(EMPTY_FIRST_READING);
  const [firstReadingLoaded, setFirstReadingLoaded] = useState(false);
  const firstReadingImpressionRef = useRef('');

  // ── Time-Lens rail (lazy — same discipline as the tour) ──
  const [lensMod, setLensMod] = useState<LensModule | null>(null);
  const [lens, setLens] = useState<'natal' | LensId>('natal');
  const [lensRing, setLensRing] = useState<LensRingRenderer | null>(null);
  // Stable identity — the lens module's ring effect depends on it.
  const onLensRing = useCallback(
    (renderer: LensRingRenderer | null) => setLensRing(() => renderer),
    [],
  );

  const scene = useMemo(
    () => (chart && mode === 'full' ? buildSceneModel(chart) : null),
    [chart, mode],
  );
  const emphasis = useMemo(
    () => (scene ? emphasisFor(scene, selection) : { highlight: new Set<string>(), soft: new Set<string>() }),
    [scene, selection],
  );

  // What the wheel actually renders: the tour's render-only overrides win
  // while nothing is selected; a live selection always outranks the tour's
  // lighting, and the user's houses toggle outranks the morph preview.
  const viewScene = tourVisual?.scene ?? scene;
  const viewEmphasis = selection ? emphasis : (tourVisual?.emphasis ?? emphasis);
  const viewCusps = showHouses
    ? (tourVisual?.cusps ?? chart?.houses?.cusps ?? null)
    : null;

  useEffect(() => {
    return () => { spotlightArrivalCleanupRef.current?.(); };
  }, []);

  useEffect(() => {
    const onProfile = () => setProfileRevision((revision) => revision + 1);
    window.addEventListener('zodiacs:profile', onProfile);
    return () => window.removeEventListener('zodiacs:profile', onProfile);
  }, []);

  function track(name: string, props: Record<string, string>) {
    (window as unknown as {
      zodiacsAnalytics?: { track?: (n: string, p: Record<string, string>) => void };
    }).zodiacsAnalytics?.track?.(name, props);
  }

  function loadPushOptIn(): void {
    if (!WEB_PUSH_ENABLED || locale === 'ru') return;
    void import('./PushOptIn').then(setPushOptIn, () => {});
  }

  function keepWheelAboveTour() {
    requestAnimationFrame(() => {
      const box = wheelboxRef.current;
      if (!box || !matchMedia('(max-width: 959.5px)').matches) return;
      const rect = box.getBoundingClientRect();
      const visibleTop = 84 + (Number.parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--safe-top')) || 0);
      const sheetTop = window.innerHeight * 0.52;
      if (rect.top >= visibleTop && rect.bottom <= sheetTop) return;
      window.scrollBy({ top: rect.top - visibleTop, behavior: 'auto' });
    });
  }

  function persistFirstReading(
    status: FirstReadingStatus,
    step: number,
  ) {
    let next: FirstReadingProgress = {
      version: 1,
      status,
      step: Math.max(0, Math.min(3, step)),
      updatedAt: new Date().toISOString(),
    };
    try {
      next = writeFirstReadingProgress(localStorage, { status, step });
    } catch { /* storage unavailable — in-memory progress still works */ }
    setFirstReading(next);
    return next;
  }

  async function startTour(kind: 'quick' | 'full' = 'full') {
    const owner = currentResultOwner();
    if (!owner || !chartActionDockModule) return;
    try {
      const mod = tourMod ?? await import('./explorer/tour');
      if (!resultIsCurrent(owner)) return;
      setTourMod(mod);
      resetLens(); // the tour teaches the natal wheel; a lens ring would contradict it
      if (selection) applySelect(null);
      setTourKind(kind);
      setTourOpen(true);
      if (kind === 'full') track('tour_start', { variant: 'v1' });
      keepWheelAboveTour();
    } catch {
      if (!resultIsCurrent(owner)) return;
      setTourKind(null);
      setError(t(locale, 'chartError'));
    }
  }
  function exitTour() {
    setTourOpen(false);
    setTourKind(null);
    setTourVisual(null);
  }

  function startFirstReading() {
    if (!chartActionDockModule) return;
    const resume = firstReading.status === 'in_progress';
    const next = resume ? firstReading : persistFirstReading('in_progress', 0);
    track('first_reading_prompt', { action: resume ? 'resume' : 'start' });
    track('next_action_clicked', { state: resume ? 'guide_in_progress' : 'new_chart', action: 'guide' });
    setFirstReading(next);
    void startTour('quick');
  }

  function dismissFirstReading() {
    persistFirstReading('dismissed', 0);
    track('first_reading_prompt', { action: 'explore' });
  }

  function completeFirstReading() {
    if (firstReading.status !== 'complete') {
      persistFirstReading('complete', 3);
      track('first_reading_completed', {});
    }
    exitTour();
  }

  function resetLens() {
    setLens('natal');
    setLensRing(null);
  }
  async function selectLens(next: 'natal' | LensId) {
    const owner = currentResultOwner();
    if (!owner) return;
    if (next === lens) return;
    if (next === 'natal') {
      resetLens();
      track('lens_change', { lens: 'natal' });
      return;
    }
    try {
      const mod = lensMod ?? await import('./explorer/lens/ChartLens');
      if (!resultIsCurrent(owner)) return;
      setLensMod(mod);
      setLens(next);
      track('lens_change', { lens: next });
    } catch {
      if (resultIsCurrent(owner)) setError(t(locale, 'chartError'));
    }
  }

  /**
   * The third dimension is opt-in and lazily fetched: the flat wheel is the
   * default reading, and this chunk never reaches a reader who does not ask.
   */
  async function toggleDepth() {
    const owner = currentResultOwner();
    if (!owner) return;
    if (depthOpen) {
      setDepthOpen(false);
      return;
    }
    try {
      const mod = depthMod ?? await import('./chart3d/EclipticView');
      if (!resultIsCurrent(owner)) return;
      setDepthMod(mod);
      setDepthOpen(true);
    } catch {
      if (resultIsCurrent(owner)) setError(t(locale, 'chartError'));
    }
  }

  /** Spoken summary of a selection for the polite live region. */
  function describeSelection(ref: EntityRef): string {
    if (!scene) return '';
    switch (ref.kind) {
      case 'body': {
        const b = scene.bodies.find((x) => x.body === ref.body);
        if (!b) return '';
        return [
          planetLabel(locale, b.body),
          b.body === 'Moon' && chart && moonIsUncertain(chart)
            ? `${moonLabel(chart, locale)} · ${t(locale, 'needsBirthTime')}`
            : formatLongitude(b.lon, locale),
          b.house != null ? `${t(locale, 'house')} ${b.house}` : '',
          b.retrograde ? 'Rx' : '',
        ].filter(Boolean).join(', ');
      }
      case 'sign': return signName(signBySlug(ref.sign), locale);
      case 'house': return `${t(locale, 'house')} ${ref.house}`;
      case 'aspect': return `${planetLabel(locale, ref.a)} ${aspectLabel(locale, ref.type)} ${planetLabel(locale, ref.b)}`;
      case 'angle': return ref.angle.toUpperCase();
    }
  }

  /** The one selection entry point: state + URL + announcement + focus care. */
  function openDetailForSelection() {
    if (detailOpen) return;
    setDetailOpen(true);
  }

  function cancelSpotlightArrival() {
    spotlightArrivalCleanupRef.current?.();
    spotlightArrivalCleanupRef.current = null;
  }

  function applySelect(ref: EntityRef | null) {
    cancelSpotlightArrival();
    setSpotlight(null);
    // Selecting a house someone can't see makes no sense — re-light the layer.
    if (ref?.kind === 'house') setShowHouses(true);
    // The data rows now live inside a closed-by-default disclosure. Re-light
    // that layer before applying a body/aspect highlight from the Explorer.
    if (ref?.kind === 'body' || ref?.kind === 'aspect') openDetailForSelection();
    setSelection(ref);
    setAnnounce(ref ? describeSelection(ref) : t(locale, 'selectionCleared'));
    try {
      const url = new URL(window.location.href);
      if (ref) url.searchParams.set('sel', entityId(ref));
      else url.searchParams.delete('sel');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch { /* URL API unavailable — selection still works */ }
    if (!ref) {
      // Clearing may unmount the focused inspector (close button, Escape
      // inside the card) — focus falls to <body> without this hand-back.
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) wheelboxRef.current?.focus();
      });
    }
  }

  function showOnChartFromReading(ref: EntityRef, behavior: ReadingScrollBehavior): void {
    resetLens();
    if (ref.kind === 'aspect') {
      setAspectTypes((current) => current.includes(ref.type) ? current : [...current, ref.type]);
    }
    applySelect(ref);
    const id = entityId(ref);
    const run = ++spotlightRunRef.current;
    const motion: ChartSpotlight['motion'] = behavior === 'smooth' ? 'animated' : 'instant';
    setSpotlight({ id, run, phase: motion === 'animated' ? 'primed' : 'settled', motion });

    let outerFrame = 0;
    let watchFrame = 0;
    let fallback = 0;
    let cancelled = false;
    let scrollEndHandler: (() => void) | null = null;
    const detach = () => {
      if (outerFrame) cancelAnimationFrame(outerFrame);
      if (watchFrame) cancelAnimationFrame(watchFrame);
      if (fallback) window.clearTimeout(fallback);
      if (scrollEndHandler) window.removeEventListener('scrollend', scrollEndHandler);
    };
    const cleanup = () => {
      cancelled = true;
      detach();
    };
    spotlightArrivalCleanupRef.current = cleanup;

    outerFrame = requestAnimationFrame(() => {
      if (cancelled || spotlightRunRef.current !== run) return;
      const wheel = wheelboxRef.current;
      if (!wheel) {
        cleanup();
        return;
      }
      const target = Array.from(wheel.querySelectorAll<SVGElement>('[data-entity]'))
        .find((node) => node.getAttribute('data-entity') === id) ?? wheel;
      const mobile = matchMedia('(max-width: 959.5px)').matches;
      const destinationY = () => window.innerHeight * (mobile ? 0.34 : 0.5);
      const destinationTop = () => {
        const rect = target.getBoundingClientRect();
        return Math.max(0, window.scrollY + rect.top + rect.height / 2 - destinationY());
      };
      const arrived = () => {
        const rect = target.getBoundingClientRect();
        return Math.abs(rect.top + rect.height / 2 - destinationY()) <= 22;
      };
      const settle = (force = false) => {
        if (cancelled || spotlightRunRef.current !== run || (!force && !arrived())) return false;
        detach();
        setSpotlight((current) => current?.run === run
          ? { ...current, phase: 'settled' }
          : current);
        if (spotlightArrivalCleanupRef.current === cleanup) {
          spotlightArrivalCleanupRef.current = null;
        }
        return true;
      };

      if (motion === 'instant') {
        const root = document.documentElement;
        const previous = root.style.scrollBehavior;
        root.style.scrollBehavior = 'auto';
        window.scrollTo({ top: destinationTop(), behavior: 'auto' });
        root.style.scrollBehavior = previous;
        wheel.focus({ preventScroll: true });
        detach();
        if (spotlightArrivalCleanupRef.current === cleanup) {
          spotlightArrivalCleanupRef.current = null;
        }
        return;
      }

      window.scrollTo({ top: destinationTop(), behavior: 'smooth' });
      wheel.focus({ preventScroll: true });
      scrollEndHandler = () => { settle(); };
      window.addEventListener('scrollend', scrollEndHandler, { passive: true });
      const watchPosition = () => {
        if (settle()) return;
        if (!cancelled && spotlightRunRef.current === run) {
          watchFrame = requestAnimationFrame(watchPosition);
        }
      };
      watchFrame = requestAnimationFrame(watchPosition);
      fallback = window.setTimeout(() => {
        if (cancelled || spotlightRunRef.current !== run) return;
        const root = document.documentElement;
        const previous = root.style.scrollBehavior;
        root.style.scrollBehavior = 'auto';
        window.scrollTo({ top: destinationTop(), behavior: 'auto' });
        root.style.scrollBehavior = previous;
        settle(true);
      }, 1400);
    });
  }

  // A `?sel=` deep link applies once, after the first computed scene.
  useEffect(() => {
    if (!scene || selFromUrl.current) return;
    selFromUrl.current = true;
    const id = new URLSearchParams(window.location.search).get('sel');
    const ref = id ? parseEntityId(id) : null;
    if (ref && sceneHas(scene, ref)) {
      if (ref.kind === 'body' || ref.kind === 'aspect') openDetailForSelection();
      setSelection(ref);
    }
  }, [scene]);

  // Device-local preference. The server and first client paint stay closed;
  // the one mount read may restore an explicit choice without tracking it as
  // a fresh interaction.
  useEffect(() => {
    if (mode !== 'full') return;
    try {
      const stored = localStorage.getItem(DETAIL_STORAGE_KEY);
      detailPreferenceRef.current = stored === 'open' || stored === 'closed' ? stored : null;
      if (detailPreferenceRef.current === 'open') setDetailOpen(true);
    } catch { /* storage unavailable — closed default remains */ }
  }, []);

  // The first-reading prompt is a device preference, just like exact-data
  // disclosure. Delay its first paint until the stored state is known so a
  // dismissed or completed prompt never flashes back during hydration.
  useEffect(() => {
    if (mode === 'full') {
      try {
        setFirstReading(readFirstReadingProgress(localStorage));
      } catch { /* blocked storage keeps the unopened default */ }
    }
    setFirstReadingLoaded(true);
  }, []);

  useEffect(() => {
    if (!chart || mode !== 'full' || !firstReadingLoaded || tourOpen) return;
    if (firstReading.status !== 'not_started' && firstReading.status !== 'in_progress') return;
    const key = `${chart.input.utc.toISOString()}:${firstReading.status}`;
    if (firstReadingImpressionRef.current === key) return;
    firstReadingImpressionRef.current = key;
    track('first_reading_prompt', {
      action: firstReading.status === 'in_progress' ? 'resume_view' : 'view',
    });
  }, [chart, mode, firstReadingLoaded, firstReading.status, tourOpen]);

  function onDetailToggle(e: Event) {
    const open = (e.currentTarget as HTMLDetailsElement).open;
    setDetailOpen(open);
    const preference = open ? 'open' : 'closed';
    // A delayed DOM event for the mount-restored value is not a new visitor
    // interaction. The validated preference was read exactly once on mount.
    if (detailPreferenceRef.current === preference) return;
    detailPreferenceRef.current = preference;
    try {
      localStorage.setItem(DETAIL_STORAGE_KEY, preference);
    } catch { /* device preference is best effort */ }
    track('detail_toggle', { to: open ? 'full' : 'plain' });
  }

  // Recompute: keep the selection when the entity survives, clear it when
  // it doesn't (e.g. houses gone on a no-time chart).
  useEffect(() => {
    if (!scene || !selection) return;
    if (!sceneHas(scene, selection)) applySelect(null);
  }, [scene]);

  // Hiding the house layer clears a house selection; filtering an aspect
  // type off clears a selected aspect of that type — never leave the wheel
  // dimmed around a mark that is no longer rendered.
  useEffect(() => {
    if (!showHouses && selection?.kind === 'house') applySelect(null);
  }, [showHouses]);
  useEffect(() => {
    if (selection?.kind === 'aspect' && !aspectTypes.includes(selection.type)) applySelect(null);
  }, [aspectTypes]);

  function onWheelKeyDown(e: KeyboardEvent) {
    if (!scene) return;
    // Only keys pressed on the wheelbox itself — buttons inside the stage
    // (layer chips) keep their native keyboard behavior.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      // Cycle order: bodies by longitude, then the marked angles — so the
      // ASC/MC inspector notes are reachable without a pointer.
      const cycle: EntityRef[] = [
        ...[...scene.bodies].sort((a, b) => a.lon - b.lon)
          .map((b): EntityRef => ({ kind: 'body', body: b.body })),
        ...(scene.angles
          ? [{ kind: 'angle', angle: 'asc' } as EntityRef, { kind: 'angle', angle: 'mc' } as EntityRef]
          : []),
      ];
      const at = selection ? cycle.findIndex((c) => entityId(c) === entityId(selection)) : -1;
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const next = at === -1
        ? (step === 1 ? cycle[0] : cycle[cycle.length - 1])
        : cycle[(at + step + cycle.length) % cycle.length];
      applySelect(next);
    } else if (e.key === 'Enter' && selection) {
      e.preventDefault();
      (document.querySelector('[data-inspector-heading]') as HTMLElement | null)?.focus();
    } else if (e.key === 'Escape') {
      // First Escape clears a selection; a second (or a bare one) ends the
      // tour. The tour card handles its own Escape and stops propagation.
      if (selection) applySelect(null);
      else if (tourOpen) exitTour();
    }
  }

  // A shared chart arrives in the fragment. A v1 #c token carries birth
  // input and computes as before; a v2 #p token is loaded into a deliberately
  // reduced, read-only view. Never choose between two conflicting formats.
  useEffect(() => {
    if (mode !== 'full') return;
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    const nextSubjectMode = subjectModeFromHash(hash);
    const nextMineHandoff = mineHandoffFromHash(hash);
    const handoffOrigins = profileHandoffOriginsFromHash(hash);
    const clearFragment = () => history.replaceState(null, '', window.location.pathname + window.location.search);

    // A Moon lookup hands its date (and optional time) here without a place.
    // The fragment is consumed and cleared; the next needed field takes focus.
    if (params.has('date')) {
      const handoff = dateHandoffFromHash(hash);
      clearFragment();
      if (!handoff) return;
      setDate(handoff.date);
      setCalendar('gregorian');
      setTime(handoff.time ?? '');
      setTimeKnown(handoff.time !== null);
      queueMicrotask(() => formRef.current?.querySelector<HTMLElement>('#place')?.focus());
      return;
    }

    if (params.has('profileChartId')) {
      const profileChartId = profileChartIdFromHash(hash);
      const handoffId = profileHandoffIdRef.current + 1;
      profileHandoffIdRef.current = handoffId;
      clearFragment();
      if (!profileChartId || params.size !== 1) {
        setError(t(locale, 'chartError'));
        return;
      }
      let active = true;
      let resolving = false;
      const handoffIsCurrent = () => active && handoffId === profileHandoffIdRef.current;
      const onProfileAccess = () => { queueMicrotask(resolveCurrentProfileChart); };
      const resolveCurrentProfileChart = () => {
        if (!handoffIsCurrent() || resolving || !profileAccessAllowed()) return;
        resolving = true;
        const accessGeneration = profileAccessGeneration.current;
        void import('../lib/profile/profile-chart-handoff').then(({ loadProfileChartEditInput }) => {
          resolving = false;
          if (!handoffIsCurrent() || !profileAccessAllowed()) return;
          if (accessGeneration !== profileAccessGeneration.current) {
            queueMicrotask(resolveCurrentProfileChart);
            return;
          }
          const input = loadProfileChartEditInput(profileChartId);
          if (!input) {
            active = false;
            window.removeEventListener('zodiacs:profile-access', onProfileAccess);
            return;
          }
          const linkCity = input.city;
          active = false;
          window.removeEventListener('zodiacs:profile-access', onProfileAccess);
          primaryProfileOriginRef.current = true;
          primaryProfileChartIdRef.current = profileChartId;
          mineProfileOriginRef.current = false;
          setDate(input.date);
          setCalendar('gregorian');
          setStoredDate(input.date);
          setTime(input.time);
          setTimeKnown(input.timeKnown);
          setCity(linkCity);
          setHouseSystem(input.houseSystem);
          setFromLink(true);
          setLinkName(input.name ?? null);
          setPositionsOnly(null);
          if (linkCity) void runChart({ ...input, city: linkCity }, false);
        }).catch(() => {
          resolving = false;
          if (handoffIsCurrent() && accessGeneration === profileAccessGeneration.current) {
            setError(t(locale, 'chartError'));
          }
        });
      };
      window.addEventListener('zodiacs:profile-access', onProfileAccess);
      resolveCurrentProfileChart();
      return () => {
        active = false;
        window.removeEventListener('zodiacs:profile-access', onProfileAccess);
      };
    }

    let active = true;
    const revision = inputRevisionRef.current;
    const initialRun = runChartIdRef.current;
    const importAccessGeneration = profileAccessGeneration.current;
    const importIsCurrent = () => active && revision === inputRevisionRef.current
      && initialRun === runChartIdRef.current;

    if (params.has('c') && params.has('p')) {
      clearFragment();
      import('./PositionsShareSurface')
        .then((surface) => {
          if (importIsCurrent()) setError(surface.shareText(locale, 'shareLinkAmbiguous'));
        })
        .catch(() => {
          if (importIsCurrent()) setError(t(locale, 'chartError'));
        });
      return () => { active = false; };
    }

    if (params.has('p')) {
      const token = params.get('p') ?? '';
      import('./PositionsShareSurface')
        .then((surface) => {
          if (!importIsCurrent()) return;
          const decoded = surface.decodePositionsToken(token);
          if (!decoded) {
            setError(surface.shareText(locale, 'positionsLinkInvalid'));
            return;
          }
          const admittedMine = !handoffOrigins.mine || (profileAccessAllowed()
            && importAccessGeneration === profileAccessGeneration.current)
            ? nextMineHandoff : null;
          clearResult();
          shareRuntimeRef.current.surface = surface;
          setPositionsOnly(decoded);
          setSubjectMode(nextSubjectMode);
          setMineHandoff(admittedMine);
          primaryProfileOriginRef.current = false;
          primaryProfileChartIdRef.current = null;
          mineProfileOriginRef.current = handoffOrigins.mine && admittedMine !== null;
          track('chart_computed', { mode, source: 'shared_positions' });
          clearFragment();
        })
        .catch(() => {
          if (importIsCurrent()) setError(t(locale, 'chartError'));
        });
      return () => { active = false; };
    }

    const token = params.get('c');
    if (!token) return;
    const decoded = decodeChartLink(token);
    if (!decoded) return;
    const linkCity: City = {
      name: decoded.place ?? (russianCopy?.chart.sharedBirthplace ?? 'Shared birthplace'),
      admin1: '', country: '',
      lat: decoded.lat, lon: decoded.lon, tz: decoded.tz, pop: 0,
    };
    setDate(decoded.date);
    setCalendar('gregorian');
    setStoredDate(decoded.date);
    setTime(decoded.time ?? '');
    setTimeKnown(decoded.timeKnown);
    setCity(linkCity);
    setHouseSystem(decoded.houseSystem);
    setFromLink(true);
    setLinkName(decoded.name ?? null);
    setPositionsOnly(null);
    primaryProfileOriginRef.current = false;
    primaryProfileChartIdRef.current = null;
    mineProfileOriginRef.current = handoffOrigins.mine && nextMineHandoff !== null;
    clearFragment();
    runChart({
      date: decoded.date, time: decoded.time ?? '', timeKnown: decoded.timeKnown,
      city: linkCity, houseSystem: decoded.houseSystem,
      name: decoded.name,
      subjectMode: nextSubjectMode,
      mine: nextMineHandoff,
    }, false, 'shared_details');
  }, []);

  useEffect(() => {
    if (busy || !focusAfterComputeRef.current) return;
    if (error) {
      errorRef.current?.focus();
      focusAfterComputeRef.current = false;
      return;
    }
    if (chart) {
      resultHeadingRef.current?.focus();
      focusAfterComputeRef.current = false;
    }
  }, [busy, error, chart]);

  async function runChart(
    input: RunInput,
    focusAfterCompute: boolean,
    source: ChartComputedSource = 'fresh',
  ) {
    advanceInputRevision();
    clearResult();
    const runInputRevision = inputRevisionRef.current;
    const localDateReferenceFailure = new Error('Could not establish a calculation time within the local date.');
    const signatureModule = mode === 'full' && showsEnglishInterpretation
      ? import('../lib/chart-signature').catch(() => null)
      : null;
    const accessGeneration = profileAccessGeneration.current;
    const requiresProfileAccess = primaryProfileOriginRef.current;
    const runId = runChartIdRef.current + 1;
    runChartIdRef.current = runId;
    const runIsCurrent = () => (
      runId === runChartIdRef.current
      && runInputRevision === inputRevisionRef.current
      && (!requiresProfileAccess || (
        accessGeneration === profileAccessGeneration.current
        && profileAccessAllowed()
      ))
    );
    focusAfterComputeRef.current = focusAfterCompute;
    setBusy(true);
    setError('');
    setSaved('idle');
    setMatchedName(null);
    setSavePromptOpen(false);
    setA2hsHint(null);
    setCard('busy');
    setSubjectMode(input.subjectMode ?? 'self');
    setMineHandoff(input.mine ?? null);
    if (mode === 'full' && !chartActionDockModule) requestChartControls();
    try {
      // Early dates also download the local mean time table and the zone's
      // pinned history; the downloads run together. A rejection is observed
      // by the loader itself.
      const localTimeReady = prepareLocalTime(input.date, input.city.tz);
      const engine = await loadEngine();
      if (!runIsCurrent()) return;
      await localTimeReady;
      if (!runIsCurrent()) return;
      let receiptModule: Awaited<ReturnType<typeof loadCalculatorReceipt>> | null = null;
      if (mode === 'full') {
        try {
          receiptModule = await loadCalculatorReceipt();
        } catch {
          // A failed optional code download may use the existing calculation.
          // No natal calculation has run yet; calculation failures never retry.
        }
        if (!runIsCurrent()) return;
      }
      const effectiveTime = input.timeKnown ? input.time : '12:00';
      const resolved = resolveLocalToUtc(input.date, effectiveTime, input.city.tz, { longitude: input.city.lon });
      if (!input.timeKnown) {
        try {
          if (assessLocalDateReference(input.date, resolved.utc, input.city.tz).referenceStatus !== 'member') throw localDateReferenceFailure;
        } catch { throw localDateReferenceFailure; }
      }
      const calculationInput = {
        utc: resolved.utc,
        latitude: input.city.lat,
        longitude: input.city.lon,
        houseSystem: input.houseSystem,
        timeKnown: input.timeKnown,
        flags: resolved.flags,
      };
      const portable = receiptModule?.computeCalculatorReceipt(calculationInput, {
        date: input.date,
        time: effectiveTime,
        timeZone: input.city.tz,
        offsetMinutes: resolved.offsetMinutes,
        reference: input.timeKnown ? 'supplied-instant' : 'local-noon',
      });
      const result = portable ? portable.chart : engine.computeChart(calculationInput);
      if (!runIsCurrent()) return;
      const computedSun = result.bodies.find((body) => body.body === 'Sun');
      const computedSunSlug = computedSun ? signForLongitude(computedSun.lon).slug : null;
      let nextMoonAmbiguous = false;
      const nextRegistryRecordSlug = mode === 'full' && input.timeKnown ? computedSunSlug : null;
      if (!input.timeKnown) {
        // A reference instant does not verify the Moon's possible signs across
        // the birth date. Empty candidates use the existing unresolved state;
        // the numerical chart and portable receipt remain the reference result.
        result.moonSignCandidates = [];
        nextMoonAmbiguous = moonIsUncertain(result);
      }
      if (!runIsCurrent()) return;
      const owner: ChartResultOwner = {
        chart: result, runId, inputRevision: runInputRevision, accessGeneration, requiresProfileAccess,
      };
      resultOwnerRef.current = owner;
      setChart(result);
      setOnMeanTime(resolved.localMeanTime !== undefined);
      if (portable) {
        const captured: ChartReceiptExport = {
          ...owner, envelopeJson: portable.envelopeJson,
        };
        receiptExportRef.current = captured;
        setReceiptExport(captured);
      }
      if (signatureModule) {
        void signatureModule.then((module) => {
          if (!runIsCurrent() || !module) return;
          const nextSignature = module.chartSignature(result, locale);
          if (runIsCurrent()) setSignature(nextSignature);
        }, () => {});
      }
      setMoonAmbiguous(nextMoonAmbiguous);
      setRegistryRecordSlug(nextRegistryRecordSlug);
      setComputedInput({ ...input, city: { ...input.city } });
      setShareInput({
        date: input.date,
        time: input.timeKnown ? input.time : null,
        timeKnown: input.timeKnown,
        lat: input.city.lat,
        lon: input.city.lon,
        tz: input.city.tz,
        place: input.city.name || undefined,
        houseSystem: input.houseSystem,
        ...(input.name ? { name: input.name } : {}),
      });
      void import('./PositionsShareSurface').then(async (surface) => {
        if (!runIsCurrent()) return;
        const prepared = await surface.preparePrimaryShareArtifact(result, mode, locale, nextMoonAmbiguous, input.date);
        if (!runIsCurrent()) return;
        shareRuntimeRef.current.primary = { artifact: prepared, share: surface.sharePrimaryArtifact };
        setCard('idle');
      }).catch((shareError) => {
        console.error(shareError);
        if (runIsCurrent()) setCard('error');
      });
      const contextId = chartContextIdRef.current + 1;
      chartContextIdRef.current = contextId;
      clearPostChartContext();
      if (mode === 'full') {
        void import('./CalendarSubscribe').then(setCalendarSurface, () => {});
        if (showsEnglishInterpretation) {
          void import('./CommunicationRead').then(setCommunicationSurface, () => {});
          void import('./ApproachRead').then(setApproachSurface, () => {});
        }
      }
      track('result_rendered', { mode });
      track('chart_computed', { mode, source });
      if (locale !== 'ru') void import('./PwaInstallPrompt').then(setPwaInstallModule, () => {});
      setPwaComputationCount((count) => count + 1);
      window.dispatchEvent(new CustomEvent('zodiacs:chart-computed', {
        detail: {
          mode,
          sunSign: input.timeKnown && computedSun ? signForLongitude(computedSun.lon).slug : undefined,
          contextId,
        },
      }));
      requestAnimationFrame(() => {
        if (runIsCurrent()) resultRef.current?.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
      });
    } catch (err) {
      if (!runIsCurrent()) return;
      runChartIdRef.current += 1;
      clearResult();
      setBusy(false);
      setError(err === localDateReferenceFailure ? t(locale, 'localDateReferenceError')
        : calculationError(err, locale, t(locale, 'chartError')));
      console.error(err);
    } finally {
      if (runId === runChartIdRef.current) setBusy(false);
    }
  }

  function receiptExportIsCurrent(captured: ChartReceiptExport | null): captured is ChartReceiptExport {
    return captured !== null && captured === receiptExportRef.current && captured.chart === chart
      && captured.runId === runChartIdRef.current
      && captured.inputRevision === inputRevisionRef.current
      && !(captured.requiresProfileAccess && (
        captured.accessGeneration !== profileAccessGeneration.current || !profileAccessAllowed()
      ));
  }

  /**
   * Explicit "keep on this device". The exact bytes and the scope are
   * captured before any await; the result is re-checked after each await and
   * a stale completion shows nothing. An uncertain outcome is stated, never
   * retried: the visitor reconciles under Profile.
   */
  async function keepRecord(): Promise<void> {
    const captured = receiptExportRef.current;
    const scope = recordScopeRef.current;
    const api = recordAccessRef.current;
    if (!receiptExportIsCurrent(captured) || recordKeep === 'busy') return;
    if (!scope || !api) {
      // The scope is being replaced (a change in another tab or in the
      // sign-in state landed between the click and the re-render that
      // disables the button): nothing was stored, and the visitor is told.
      setRecordKeep('changed');
      return;
    }
    // A click while the scope is being replaced (another tab changed the
    // records, or the sign-in state moved) stores nothing and says so; the
    // re-open already scheduled keeps this outcome until the next click.
    if (scope.epoch !== api.savedRecordEvaluation()) { setRecordKeep('changed'); return; }
    if (!scope.canSave) { setRecordKeep('read-only'); return; }
    // A scope change during the commit must not swallow the outcome: the
    // store reports it as uncertain and that is what the visitor is told.
    const run = recordResultRunRef.current;
    const envelopeJson = captured.envelopeJson;
    // The exact bytes are the record; the store re-serializes the parsed
    // envelope canonically and the confirmation below checks equality.
    const envelope = api.parseCalculationEnvelope(envelopeJson);
    if (!envelope) { setRecordKeep('failed'); return; }
    // The label is display-only metadata around the immutable bytes, derived
    // from the calculation itself (never copied from a legacy saved chart,
    // which can be renamed or deleted independently); keep it printable.
    const label = [...autoName.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').trim()].slice(0, 120).join('');
    const admit = scope.state === 'not-admitted' || scope.state === 'owner-erased' || scope.state === 'device-erased';
    setRecordKeep('busy');
    track('record_keep', { admit: String(admit) });
    const created = await scope.store.create(envelope, label || undefined, { admit });
    if (run !== recordResultRunRef.current || !receiptExportIsCurrent(captured)) return;
    if (created.ok) {
      // The stored bytes must be exactly the bytes offered for download.
      const exact = created.value.record.envelopeJson === envelopeJson;
      recordKeptRef.current = exact ? { ownerKey: scope.ownerKey, id: created.value.record.id } : null;
      // The button disables itself on the kept state, which drops the keyboard
      // to the top of the document; land on the confirmation instead, where
      // the Profile link is.
      const fromButton = document.activeElement instanceof HTMLElement
        && document.activeElement.hasAttribute('data-keep-calculation-record');
      setRecordKeep(exact ? 'kept' : 'uncertain');
      if (exact && fromButton) setTimeout(() => recordKeptNoteRef.current?.focus(), 0);
      setRecordErasedNote(false);
      // A kept record is a fact for every open tab (inventories re-open on it,
      // and a readmission changes what other tabs may do); this tab's handle
      // already observed the new rows.
      api.broadcastSavedRecordScopeChange();
      return;
    }
    // Records removed or admitted from another tab are only visible to a
    // fresh inventory: state that nothing was stored, re-open so the next
    // explicit keep observes the new rows, and retry nothing on the
    // visitor's behalf.
    const changedElsewhere = !created.mayHaveCommitted && (created.code === 'stale' || created.code === 'access-denied'
      || created.code === 'owner-erased' || created.code === 'device-erased' || created.code === 'not-admitted');
    setRecordKeep(created.mayHaveCommitted ? 'uncertain'
      : changedElsewhere ? 'changed'
        : created.code === 'full' ? 'full'
          : created.code === 'erasure-pending' ? 'pending'
            : created.code === 'unsupported-storage' ? 'unavailable' : 'failed');
    if (changedElsewhere) recordReopenRef.current?.();
  }

  function exportReceipt(): void {
    const captured = receiptExportRef.current;
    if (!captured || captured !== receiptExport || captured.chart !== chart
      || captured.runId !== runChartIdRef.current
      || captured.inputRevision !== inputRevisionRef.current
      || (captured.requiresProfileAccess && (
        captured.accessGeneration !== profileAccessGeneration.current || !profileAccessAllowed()
      ))) return;
    setReceiptDownloadError(false);
    try {
      downloadCalculationReceipt(captured.envelopeJson);
    } catch {
      setReceiptDownloadError(true);
    }
  }

  function compute(e: Event) {
    e.preventDefault();
    if (busy) return;
    const dateInput = formRef.current?.querySelector<HTMLInputElement>('#birth-date');
    const nextFieldErrors: FormFieldErrors = {
      date: date === '' ? 'required' : dateInput?.validity.valid === false ? 'range' : undefined,
      time: timeKnown && time === '',
      place: city === null,
    };
    setFieldErrors(nextFieldErrors);
    setError('');
    const firstIncomplete = nextFieldErrors.date
      ? 'birth-date'
      : nextFieldErrors.time
        ? 'birth-time'
        : nextFieldErrors.place ? 'place' : null;
    if (firstIncomplete) {
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>(`#${firstIncomplete}`)?.focus();
      });
      return;
    }
    if (!city) return;
    const start = (entry: { date: string; oldStyle?: string }) => {
      invalidateProfileHandoff();
      setFromLink(false);
      if (subjectMode === 'self') setLinkName(null);
      runChart({
        date: entry.date,
        oldStyle: entry.oldStyle,
        time,
        timeKnown,
        city,
        houseSystem,
        subjectMode,
        mine: mineHandoff,
        ...(subjectMode === 'other' && linkName ? { name: linkName } : {}),
      }, true);
    };
    if (!calendarInPlay(date, calendar)) return start({ date });
    // A date before 1924 is read in its calendar first; an edit meanwhile wins.
    const revision = inputRevisionRef.current;
    void birthDateForChart(locale, date, calendar).then((entry) => {
      if (revision !== inputRevisionRef.current) return;
      if ('error' in entry) {
        setFieldErrors({ calendar: entry.error });
        formRef.current?.querySelector<HTMLElement>('#birth-date')?.focus();
      } else start(entry);
    }, () => setError(calculationLoadMessage(locale)));
  }

  function requestChartControls(returnFocus = false) {
    const owner = currentResultOwner();
    const runId = runChartIdRef.current;
    const revision = inputRevisionRef.current;
    const requestIsCurrent = () => runId === runChartIdRef.current
      && revision === inputRevisionRef.current;
    setControlsError(false);
    void loadChartControls().then((module) => {
      // The module remains useful across results; focus belongs to this retry.
      setChartActionDockModule(module);
      if (returnFocus && resultIsCurrent(owner)) requestAnimationFrame(() => {
        if (resultIsCurrent(owner)) resultRef.current?.querySelector<HTMLSelectElement>('[data-explorer-entity-picker]')?.focus();
      });
    }, () => {
      if (!requestIsCurrent()) return;
      setControlsError(true);
      if (returnFocus && resultIsCurrent(owner)) requestAnimationFrame(() => {
        if (resultIsCurrent(owner)) resultRef.current?.querySelector<HTMLButtonElement>('[data-chart-controls-retry]')?.focus();
      });
    });
  }

  const shareUrl = () =>
    `${window.location.origin}${localizePath(locale, '/birth-chart/')}#${chartHandoffFragment(shareInput!, {
      subjectMode,
    })}`;

  async function openShareOptions() {
    const owner = currentResultOwner();
    if (!owner || !shareInput) return;
    shareReturnRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    try {
      const surface = await import('./ChartShareDialog');
      if (!resultIsCurrent(owner)) return;
      shareRuntimeRef.current.dialog = surface.default;
      setShareDialogOpen(true);
    } catch (err) {
      console.error(err);
      if (resultIsCurrent(owner)) setCard('error');
    }
  }

  function shareChartFromAction() {
    const owner = currentResultOwner();
    if (!owner) return;
    const primary = shareRuntimeRef.current.primary;
    if (!primary) {
      void openShareOptions();
      return;
    }
    if (card === 'busy') return;
    setCard('busy');
    // This call reaches navigator.share before yielding, preserving the
    // exact tap's activation on iOS. Rendering happened after computation.
    void primary.share(primary.artifact, mode).then((state) => {
      if (resultIsCurrent(owner)) setCard(state);
    }, () => {
      if (resultIsCurrent(owner)) setCard('error');
    });
  }

  function closeShareDialog(): void {
    const owner = currentResultOwner();
    if (!owner) return;
    setShareDialogOpen(false);
    requestAnimationFrame(() => {
      if (!resultIsCurrent(owner)) return;
      const returnTo = shareReturnRef.current;
      if (returnTo?.isConnected) returnTo.focus();
      else wheelboxRef.current?.focus();
    });
  }

  const placements = useMemo(() => {
    if (!chart) return [];
    return chart.bodies.map((b) => ({
      ...b,
      label: formatLongitude(b.lon, locale),
      house: chart.houses ? houseOf(b.lon, chart.houses.cusps) : null,
    }));
  }, [chart]);

  // Trigger copy comes from this page's catalog; the 3D view remains lazy.
  const depthToggleLabel = t(locale, depthOpen ? 'chartDepthClose' : 'chartDepthOpen');

  const sun = chart?.bodies.find((b) => b.body === 'Sun');
  const moon = chart?.bodies.find((b) => b.body === 'Moon');
  // Use the retained full positions; normalize their difference exactly once.
  const moonPhase = mode === 'moon' && sun && moon
    ? moonPhaseNameFromAngle((((moon.lon - sun.lon) % 360) + 360) % 360)
    : null;
  const asc = chart?.angles?.asc ?? null;
  const sunSign = sun ? signForLongitude(sun.lon) : null;
  const autoNameLocales = locale === 'ru' ? CATALOG_LOCALES : RELEASED_LOCALES;
  const autoNames = autoNameLocales.map((candidate) => {
    if (!sunSign) return '';
    const sunLabel = candidate === 'ru'
      ? russianCopy!.chart.autoNameSun
      : AUTO_NAME_SUN[candidate];
    return `${signName(sunSign, candidate)} ${sunLabel} · ${computedInput?.date ?? date}`;
  });
  // Keep legacy automatic names recognizable without rewriting stored names.
  const referenceName = `${t(locale, 'referenceChartName')} · ${computedInput?.date ?? date}`;
  autoNames.push(...autoNameLocales.map(candidate => `${AUTO_NAME_REFERENCE[candidate]} · ${computedInput?.date ?? date}`));
  const autoName = computedInput?.timeKnown === false ? referenceName : sunSign
    ? `${signName(sunSign, locale)} ${locale === 'ru' ? russianCopy!.chart.autoNameSun : AUTO_NAME_SUN[locale]} · ${computedInput?.date ?? date}`
    : '';
  const isAutoName = (name: string | null) => name !== null && autoNames.includes(name);
  const personName = linkName && !isAutoName(linkName)
    ? linkName
    : matchedName && !isAutoName(matchedName) ? matchedName : null;
  const otherSubjectNotice = personName
    ? otherSubjectCopy.named(personName)
    : otherSubjectCopy.unnamed;
  const compareWithMineHref = subjectMode === 'other' && shareInput
    ? compatibilityHandoffPath(shareInput, mineHandoff)
    : undefined;
  const anotherChartHref = subjectMode === 'self' && shareInput
    ? primaryProfileOriginRef.current
      ? primaryProfileChartIdRef.current
        ? someoneElseProfileHandoffPath(primaryProfileChartIdRef.current) ?? '/birth-chart/someone-else/'
        : '/birth-chart/someone-else/'
      : someoneElseHandoffPath(shareInput)
    : '/birth-chart/someone-else/';

  useEffect(() => {
    const owner = currentResultOwner();
    if (!owner || !chart || !computedInput || mode !== 'full') return;
    let active = true;
    const contextId = chartContextIdRef.current;
    const accessGeneration = profileAccessGeneration.current;
    const identity = {
      birth: {
        date: computedInput.date,
        time: computedInput.timeKnown ? computedInput.time : null,
        timeKnown: computedInput.timeKnown,
        place: {
          name: computedInput.city.name,
          admin1: computedInput.city.admin1,
          country: computedInput.city.country,
          lat: computedInput.city.lat,
          lon: computedInput.city.lon,
          tz: computedInput.city.tz,
        },
      },
      summary: { houseSystem: chart.houses?.system ?? computedInput.houseSystem },
    };
    void import('../lib/profile/store').then(({ findMatchingChart }) => {
      if (
        !active
        || !resultIsCurrent(owner)
        || contextId !== chartContextIdRef.current
        || accessGeneration !== profileAccessGeneration.current
      ) return;
      const match = findMatchingChart(identity);
      if (!resultIsCurrent(owner) || accessGeneration !== profileAccessGeneration.current) return;
      setMatchedName(match?.name ?? null);
      publishPostChartContext({
        mode: 'full',
        sunSign: computedInput.timeKnown ? sunSign?.slug ?? null : null,
        chartId: match?.id ?? null,
        contextId,
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [chart, computedInput, mode, profileRevision, sunSign?.slug]);

  useEffect(() => {
    if (savePromptOpen) saveNameRef.current?.focus();
  }, [savePromptOpen]);

  function chartIdentity() {
    if (!currentResultOwner() || !chart || !computedInput) return null;
    return {
      birth: {
        date: computedInput.date,
        time: computedInput.timeKnown ? computedInput.time : null,
        timeKnown: computedInput.timeKnown,
        place: {
          name: computedInput.city.name,
          admin1: computedInput.city.admin1,
          country: computedInput.city.country,
          lat: computedInput.city.lat,
          lon: computedInput.city.lon,
          tz: computedInput.city.tz,
        },
      },
      summary: { houseSystem: chart.houses?.system ?? computedInput.houseSystem },
    };
  }

  function isConnectedSaveControl(candidate: EventTarget | null | undefined): candidate is HTMLElement {
    return candidate instanceof HTMLElement
      && candidate.isConnected
      && candidate.hasAttribute('data-save-chart');
  }

  function saveFocusFallback(): HTMLElement | null {
    if (isConnectedSaveControl(saveButtonRef.current)) return saveButtonRef.current;
    const dockSave = resultRef.current
      ?.querySelector<HTMLElement>('[data-chart-action-dock] [data-save-chart]') ?? null;
    return isConnectedSaveControl(dockSave) ? dockSave : null;
  }

  function closeSavePrompt() {
    const owner = currentResultOwner();
    if (!owner) return;
    const accessGeneration = profileAccessGeneration.current;
    const saveGeneration = savePromptGenerationRef.current;
    setSavePromptOpen(false);
    requestAnimationFrame(() => {
      if (!resultIsCurrent(owner) || accessGeneration !== profileAccessGeneration.current
        || saveGeneration !== savePromptGenerationRef.current) return;
      const returnTarget = isConnectedSaveControl(saveReturnRef.current)
        ? saveReturnRef.current
        : saveFocusFallback();
      saveReturnRef.current = null;
      returnTarget?.focus();
    });
  }

  function openSavePrompt(
    origin: 'tour' | 'free' = 'free',
    trigger?: EventTarget | null,
  ) {
    if (saved === 'saved') return;
    saveOriginRef.current = origin;
    if (subjectMode === 'self') return void commitSave(undefined, 'skip');
    if (!chartIdentity()) return;
    savePromptGenerationRef.current += 1;
    const source: SavePrefillSource = linkName ? 'link' : matchedName ? 'match' : 'auto';
    const prefill = (linkName ?? matchedName ?? autoName).slice(0, NAME_MAX);
    setSaveSource(source);
    setSaveInitial(prefill);
    setSaveDraft(prefill);
    saveReturnRef.current = isConnectedSaveControl(trigger)
      ? trigger
      : isConnectedSaveControl(document.activeElement) ? document.activeElement : null;
    setSavePromptOpen(true);
  }

  async function commitSave(explicitName: string | undefined, via: 'prompt' | 'link' | 'skip') {
    const owner = currentResultOwner();
    const identity = chartIdentity();
    if (!owner || !chart || !computedInput || !identity) return;
    track('chart_save', { source: saveOriginRef.current });
    const now = new Date().toISOString();
    const accessGeneration = profileAccessGeneration.current;
    const saveGeneration = savePromptGenerationRef.current;
    const saveUiIsCurrent = () => resultIsCurrent(owner)
      && accessGeneration === profileAccessGeneration.current
      && saveGeneration === savePromptGenerationRef.current;
    try {
      const { findMatchingChart, saveChart } = await import('../lib/profile/store');
      if (accessGeneration !== profileAccessGeneration.current) throw new Error();
      const status = saveChart({
        id: crypto.randomUUID(),
        name: explicitName ?? autoName,
        relationship: subjectMode === 'self' ? 'self' : 'other',
        createdAt: now,
        updatedAt: now,
        birth: identity.birth,
        summary: {
          engineVersion: ENGINE_VERSION,
          utcISO: chart.input.utc.toISOString(),
          houseSystem: chart.houses?.system ?? computedInput.houseSystem,
          bodies: chart.bodies.map((b) => ({ body: b.body, lon: b.lon, retrograde: b.retrograde })),
          angles: chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null,
          flags: chart.flags,
        },
      }, explicitName ? { explicitName } : undefined);
      // The requested write may already have completed. Only its UI belongs
      // to this result; an edit does not undo or retry persistence.
      if (!saveUiIsCurrent()) return;
      setSaved(status === 'updated' ? 'saved' : status);
      if (status === 'saved' || status === 'updated') {
        track('chart_saved', { source: saveOriginRef.current });
        track('chart_name_set', { via });
        const match = findMatchingChart(identity);
        if (!saveUiIsCurrent()) return;
        setMatchedName(match?.name ?? explicitName ?? matchedName ?? autoName);
        publishPostChartContext({
          mode: 'full',
          sunSign: computedInput.timeKnown ? sunSign?.slug ?? null : null,
          chartId: match?.id ?? null,
          contextId: chartContextIdRef.current,
        });
        void import('../lib/a2hs').then(({ claimA2hsHint }) => {
          if (!saveUiIsCurrent()) return;
          const hint = claimA2hsHint(locale, navigator.userAgent, localStorage);
          const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
            || window.matchMedia('(display-mode: standalone)').matches;
          if (!saveUiIsCurrent()) return;
          if (hint && !standalone) setA2hsHint(hint);
          else loadPushOptIn();
        }).catch(() => {});
      }
    } catch { if (saveUiIsCurrent()) setSaved('error'); }
    if (saveUiIsCurrent()) closeSavePrompt();
  }

  function submitSaveName(e: Event) {
    e.preventDefault();
    const value = saveDraft.trim();
    const accepted = value || autoName;
    // Existing profile renames may predate the 24-character share-link cap.
    // If the displayed, capped match is accepted unchanged, keep this save
    // non-explicit so saveChart preserves the full stored name.
    const unchangedMatch = saveSource === 'match' && accepted === saveInitial.trim();
    const explicitName = isAutoName(accepted) || unchangedMatch ? undefined : accepted;
    // A saved-name match has no fourth analytics category: accepting that
    // non-auto value in the naming prompt is a prompt commit.
    const via = saveSource === 'link' && accepted === saveInitial.trim()
      ? 'link'
      : explicitName || (unchangedMatch && !isAutoName(accepted)) ? 'prompt' : 'skip';
    void commitSave(explicitName, via);
  }

  function renderSavePrompt() {
    return (
      <form class="calc__save-prompt" onSubmit={submitSaveName} data-save-prompt>
        <label class="field__label" for="chart-save-name">{chartBookCopy.label}</label>
        <input
          ref={saveNameRef}
          class="field__input calc__save-name"
          id="chart-save-name"
          value={saveDraft}
          maxLength={NAME_MAX}
          onInput={(e) => setSaveDraft((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            closeSavePrompt();
          }}
        />
        <button class="btn btn--primary" type="submit">{chartBookCopy.save}</button>
        <button class="btn btn--ghost" type="button" onClick={() => void commitSave(undefined, 'skip')}>
          {chartBookCopy.skip}
        </button>
      </form>
    );
  }

  // The visual story uses planets only (nodes stay in exact data), plus the
  // strongest aspects and whole-chart balance derived once per result.
  const reading = useMemo(() => {
    if (!chart || mode !== 'full' || !chartActionDockModule) return null;
    const ps = placements
      .filter((p) => !p.body.includes('Node'))
      .map((p) => {
        const sign = signForLongitude(p.lon);
        return {
          body: p.body,
          lon: p.lon,
          house: p.house,
          retrograde: p.retrograde,
          signSlug: sign.slug,
        };
      });
    const settled = ps.filter((placement) => placement.body !== 'Moon' || !moonIsUncertain(chart));
    return {
      ps,
      top: chartActionDockModule.topAspects(
        chart.aspects.filter((aspect) => !aspect.a.includes('Node') && !aspect.b.includes('Node')
          && (!moonIsUncertain(chart) || (aspect.a !== 'Moon' && aspect.b !== 'Moon'))),
        4,
      ),
      weather: chartActionDockModule.chartWeather(
        settled.map((p) => ({ body: p.body, lon: p.lon, retrograde: p.retrograde, sign: p.signSlug })),
        chart.houses ? (b) => ps.find((x) => x.body === b)?.house ?? null : undefined,
      ),
    };
  }, [chart, placements, mode, chartActionDockModule]);

  const heroCards = useMemo(() => {
    if (!chart || !sun || !moon) return [];
    const cards: { kind: 'sun' | 'moon' | 'rising'; title: string; lon: number | null }[] =
      mode === 'moon'
        ? [{ kind: 'moon', title: t(locale, 'yourMoonSign'), lon: moon.lon }]
        : mode === 'rising'
          ? [{ kind: 'rising', title: t(locale, 'yourRisingSign'), lon: asc }]
          : [
            { kind: 'sun', title: t(locale, 'sun'), lon: sun.lon },
            { kind: 'moon', title: t(locale, 'moon'), lon: moon.lon },
            { kind: 'rising', title: t(locale, 'rising'), lon: asc },
          ];
    return cards;
  }, [chart, mode, sun, moon, asc, locale]);

  const PositionsOnlyView = shareRuntimeRef.current.surface?.PositionsOnlyResult;
  const ShareDialog = shareRuntimeRef.current.dialog;
  const displayedResultOwner = currentResultOwner();
  const ChartActionDock = chartActionDockModule?.default;
  const EntityPicker = chartActionDockModule?.EntityPicker;
  const ReadingPath = chartActionDockModule?.ReadingPath;
  const Inspector = chartActionDockModule?.Inspector;
  const ChartContext = chartActionDockModule?.ChartContext;
  const AspectPatternFeature = chartActionDockModule?.AspectPatternFeature;
  const saveError = saved === 'full'
    ? t(locale, 'chartSaveFull')
    : saved === 'error' ? t(locale, 'chartSaveError') : null;
  const CalendarSubscribe = calendarSurface?.default;
  const ApproachRead = approachSurface?.default;
  const CommunicationRead = communicationSurface?.default;
  const PushOptIn = pushOptIn?.default;
  const PwaInstallPrompt = pwaInstallModule?.default;
  const firstReadingPromptVisible = mode === 'full'
    && firstReadingLoaded
    && !tourOpen
    && (firstReading.status === 'not_started' || firstReading.status === 'in_progress');
  const shareActionLabel = subjectMode === 'other'
    ? wheelActionCopy.shareOther
    : t(locale, 'shareChart');
  const shareActionStatusLabel = card === 'busy'
    ? t(locale, 'rendering')
    : card === 'saved'
      ? t(locale, 'cardSaved')
      : shareActionLabel;
  const shareActionDisabled = card === 'busy';
  const sharedReceiver = typeof document !== 'undefined'
    && document.documentElement.hasAttribute('data-chart-share-receiver');
  const registryRecord = registryRecordSlug ? signBySlug(registryRecordSlug) : null;

  useEffect(() => {
    if (!chart || !registryRecord || mode !== 'full' || sharedReceiver) return;
    if (registryBridgeImpressionChartRef.current === chart) return;
    registryBridgeImpressionChartRef.current = chart;
    // No sign: here it is the visitor's own Sun sign, and analytics receive no
    // birth data. Sign guides and birthday pages send the page's sign.
    trackAnalytics('registry_bridge_impression', {
      surface: 'birth_chart',
      locale,
    });
  }, [chart, locale, mode, registryRecord?.slug, sharedReceiver]);

  return (
    <div class="calc" data-subject-mode={subjectMode}>
      <form
        ref={formRef}
        class="calc__form shell"
        onFocusCapture={() => { void loadEngine(); }}
        onSubmit={compute}
        aria-busy={busy} noValidate
      >
        <div class="core calc__core">
          <div class="calc__fields">
            <BirthFields
              locale={locale}
              dateId="birth-date"
              timeId="birth-time"
              placeId="place"
              date={date}
              time={time}
              timeKnown={timeKnown}
              city={city}
              onDateChange={(value) => {
                invalidateProfileHandoff();
                setDate(value);
                setFieldErrors((current) => current.date || current.calendar ? { ...current, date: undefined, calendar: undefined } : current);
              }}
              calendar={calendar}
              onCalendarChange={(value) => {
                invalidateProfileHandoff();
                setCalendar(value);
                setFieldErrors((current) => current.calendar ? { ...current, calendar: undefined } : current);
              }}
              charted={date === storedDate}
              onTimeChange={(value) => {
                invalidateProfileHandoff();
                setTime(value);
                setFieldErrors((current) => current.time ? { ...current, time: false } : current);
              }}
              onTimeKnownChange={(value) => {
                invalidateProfileHandoff();
                setTimeKnown(value);
                if (!value) setFieldErrors((current) => current.time ? { ...current, time: false } : current);
              }}
              onCityChange={(value) => {
                invalidateProfileHandoff();
                setCity(value);
                setFieldErrors((current) => current.place ? { ...current, place: false } : current);
              }}
              showUnknownTime={mode !== 'rising'}
              requireKnownTime
              timeHelp={mode === 'rising' ? t(locale, 'risingTimeHelp') : !timeKnown
                ? mode === 'moon' && locale === 'en'
                  ? 'Without a birth time, we show a reference position. Your Moon sign may be uncertain.'
                  : t(locale, 'chartTimeHelp')
                : undefined}
              placeHelp={t(locale, 'searchGeo')}
              dateError={fieldErrors.calendar ?? (fieldErrors.date === 'range'
                ? t(locale, 'birthDateRange')
                : fieldErrors.date ? t(locale, 'birthDateRequired') : undefined)}
              timeError={fieldErrors.time ? t(locale, 'birthTimeRequired') : undefined}
              placeError={fieldErrors.place ? t(locale, 'placePickHint') : undefined}
            />

            {mode === 'full' && (
              <details class="calc__options">
                <summary>{locale === 'en' ? 'Chart options' : t(locale, 'houseSystem')} <span>· {houseSystem === 'whole' ? t(locale, 'wholeSignDefault') : t(locale, 'placidus')}</span></summary>
                <div class="field">
                  <label class="field__label" for="house-system">{t(locale, 'houseSystem')}</label>
                  <select
                    id="house-system" class="field__input"
                    value={houseSystem}
                    onChange={(e) => {
                      invalidateProfileHandoff();
                      setHouseSystem((e.target as HTMLSelectElement).value as HouseSystem);
                    }}
                  >
                    <option value="whole">{t(locale, 'wholeSignDefault')}</option>
                    <option value="placidus">{t(locale, 'placidus')}</option>
                  </select>
                  {locale === 'en' ? (
                    <>
                      {/* Keep this sentence aligned with the houseSystemHelp catalog entry. */}
                      <p class="field__help">
                        How the chart divides into twelve areas of life.{' '}
                        <AstroTerm term="whole-sign-houses" label="Whole sign" surface="birth-chart-form" /> gives
                        each sign one house; <AstroTerm term="placidus" label="Placidus" surface="birth-chart-form" />{' '}
                        varies house sizes by exact birth time and place. Planets stay put — only house
                        boundaries move.
                      </p>
                      <p class="field__help calc__context-cue">{t(locale, 'contextHelpCue')}</p>
                    </>
                  ) : (
                    <p class="field__help">{t(locale, 'houseSystemHelp')}</p>
                  )}
                </div>
              </details>
            )}
          </div>

          <button class="btn btn--primary calc__submit" type="submit" disabled={busy}>
            <span>
              {busy ? t(locale, 'computing')
                : mode === 'moon' ? t(locale, 'findMoonSign')
                : mode === 'rising' ? t(locale, 'findRisingSign')
                : subjectMode === 'other'
                  ? otherSubjectCopy.submit
                  : t(locale, 'getBirthChart')}
            </span>
            <span class="orb">↗</span>
          </button>
          <p class="calc__privacy">
            {subjectMode === 'other' ? otherSubjectCopy.privacy : t(locale, 'privacyDevice')}
          </p>
          {locale === 'en' && <p class="calc__guide">Need a hand? <a href="/ask/" data-assistant-open>Ask Guide</a></p>}
          {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <CalculationReload error={error} locale={locale} />
        </div>
      </form>

      {positionsOnly && PositionsOnlyView && (
        <>
          {subjectMode === 'other' && (
            <p class="notice" role="status" data-chart-subject>{otherSubjectNotice}</p>
          )}
          <PositionsOnlyView chart={positionsOnly} locale={locale} />
        </>
      )}

      {chart && sun && moon && (
        <div class="calc__result" ref={resultRef}>
          <h2 class="sr-only" tabIndex={-1} ref={resultHeadingRef}>
            {subjectMode === 'other'
              ? otherSubjectCopy.heading(personName)
              : mode === 'moon'
              ? t(locale, 'yourMoonSign')
              : mode === 'rising'
                ? t(locale, 'yourRisingSign')
                : t(locale, 'birthChart')}
          </h2>
          {/* Notices */}
          {computedInput?.oldStyle && (
            <p class="notice" role="status" data-old-style-date>
              {t(locale, 'birthDate')}{locale === 'fr' ? '\u202f:' : ':'} {computedInput.oldStyle}
            </p>
          )}
          {chart.flags.includes('dst-gap') && (
            <p class="notice" role="status">{t(locale, 'dstGapNotice')}</p>
          )}
          {chart.flags.includes('dst-fold') && (
            <p class="notice" role="status">{t(locale, 'dstFoldNotice')}</p>
          )}
          {(chart.flags.includes('lmt') || onMeanTime) && (
            <p class="notice" role="status">{t(locale, 'lmtNotice')} <a href={localizePath(locale, '/methodology/')}>{t(locale, 'howWeCompute')}</a>.</p>
          )}
          {chart.flags.includes('polar-fallback') && (
            <p class="notice" role="status">{t(locale, 'polarNotice')}</p>
          )}
          {chart.flags.includes('no-time') && (
            <p class="notice" role="status">
              {t(locale, 'noTimeNotice')} {t(locale, 'unknownTimeSunReference')}
              {moonAmbiguous && ` ${t(locale, 'moonUnverifiedNotice')}`}
            </p>
          )}
          {fromLink && (
            <p class="notice" role="status">
              {t(locale, 'fromLinkNotice')}
            </p>
          )}
          {subjectMode === 'other' ? (
            <p class="notice" role="status" data-chart-subject>
              {otherSubjectNotice}
            </p>
          ) : personName && (
            <p class="notice" data-chart-person>
              {personChartCopy(personName)}
            </p>
          )}

          {/* Big three / hero cards */}
          <div class={`calc__three calc__three--${heroCards.length}`}>
            {heroCards.map(({ kind, title, lon }) => {
              if (kind === 'moon' && moonIsUncertain(chart)) {
                return (
                  <div class="three-card shell" key={kind} data-moon-uncertain>
                    <div class="core three-card__core">
                      <span class="mono--label">{title}</span>
                      <span class="three-card__sign">{moonLabel(chart, locale)}</span>
                      <p class="three-card__read">{t(locale, 'needsBirthTime')}</p>
                      {moonCandidates(chart).map((slug) => (
                        <a class="three-card__more" key={slug} href={localizePath(locale, `/${slug}/`)}>
                          {t(locale, 'read')} {signName(signBySlug(slug), locale)} →
                        </a>
                      ))}
                    </div>
                  </div>
                );
              }
              if (lon === null) {
                return (
                  <div class="three-card shell" key={kind}>
                    <div class="core three-card__core">
                      <span class="mono--label">{title}</span>
                      <p class="three-card__missing">{t(locale, 'needsBirthTime')}</p>
                    </div>
                  </div>
                );
              }
              const s = signForLongitude(lon);
              return (
                <div class="three-card shell tinted" style={`--sign:${s.hue}`} key={kind}>
                  <div class="core tinted three-card__core">
                    <span class="mono--label">{title}</span>
                    <span class="three-card__sign">
                      <picture class="three-card__icon">
                        <img src={signIcon(128, s.slug)} width="44" height="44" alt="" decoding="async" />
                      </picture>
                      {signName(s, locale)}
                    </span>
                    <span class="mono three-card__deg">{formatLongitude(lon, locale)}</span>
                    {showsEnglishInterpretation && <p class="three-card__read">{bigThree(kind, s.slug)}</p>}
                    <a class="three-card__more" href={localizePath(locale, `/${s.slug}/`)}>{t(locale, 'read')} {signName(s, locale)} →</a>
                  </div>
                </div>
              );
            })}
          </div>

          {firstReadingPromptVisible && (
            <aside class="calc__first-reading shell" aria-labelledby="first-reading-title" data-first-reading-prompt>
              <div class="core calc__first-reading-core">
                <div class="calc__first-reading-copy">
                  <span class="mono--label">{t(locale, 'firstReadingLabel')}</span>
                  <h2 id="first-reading-title">
                    {firstReading.status === 'in_progress'
                      ? t(locale, 'firstReadingResumeTitle')
                      : t(locale, 'firstReadingTitle')}
                  </h2>
                  <p>
                    {firstReading.status === 'in_progress'
                      ? t(locale, 'firstReadingResumeBody')
                      : t(locale, 'firstReadingBody')}
                  </p>
                  {firstReading.status === 'in_progress' && (
                    <span class="mono calc__first-reading-progress">
                      {t(locale, 'firstReadingStep')} {firstReading.step + 1} / 4
                    </span>
                  )}
                </div>
                <div class="calc__first-reading-actions">
                  <button class="btn btn--primary" type="button" onClick={startFirstReading} disabled={!chartActionDockModule} data-first-reading-start>
                    <span>{firstReading.status === 'in_progress'
                      ? t(locale, 'firstReadingResume')
                      : t(locale, 'firstReadingStart')}</span>
                    <span class="orb">→</span>
                  </button>
                  <button class="btn btn--ghost" type="button" onClick={dismissFirstReading} data-first-reading-dismiss>
                    {t(locale, 'firstReadingExplore')}
                  </button>
                </div>
              </div>
            </aside>
          )}

          {/* Moon-mode extra: phase at the calculated moment */}
          {mode === 'moon' && moonPhase && (
            <p class="calc__phase mono">{t(locale, chart.input.timeKnown ? 'moonPhaseAtBirth' : 'moonPhaseAtReference')}: {moonPhaseLabel(locale, moonPhase)}</p>
          )}

          {/* Rising-mode extra: chart ruler */}
          {mode === 'rising' && asc !== null && (() => {
            const rising = signForLongitude(asc);
            const rulerName = rising.ruler === 'Pluto' || rising.ruler === 'Uranus' || rising.ruler === 'Neptune'
              ? (rising.classicRuler ?? rising.ruler)
              : rising.ruler;
            const ruler = chart.bodies.find((b) => b.body === rulerName);
            return ruler ? (
              <p class="calc__phase mono">
                {t(locale, 'chartRuler')}{locale === 'fr' ? '\u202f:' : ':'} {planetLabel(locale, rulerName)} <PlanetGlyph body={rulerName} size={13} class="calc__pg" /> {t(locale, 'readIn')} {signName(signForLongitude(ruler.lon), locale)} - {t(locale, 'planetSteering')}
              </p>
            ) : null;
          })()}

          {/* Wheel + inspector + placements (full mode) — the Chart Explorer */}
          {mode !== 'full' && chart && (
            <details class="evidence-disclosure evidence-disclosure--quiet" data-evidence-disclosure data-evidence-variant="quiet">
              <summary>
                <span class="evidence-disclosure__summary">
                  <strong>{detailLabels.lead.replace(/\s*—\s*$/, '')}</strong>
                </span>
              </summary>
              <div class="evidence-disclosure__body">
                <p class="calc__receipt mono" data-chart-receipt>
                  {chart.input.utc.toISOString().replace('T', ' · ').slice(0, 21)} UTC
                  {city ? ` · ${city.lat.toFixed(2)}°, ${city.lon.toFixed(2)}°` : ''}
                  {chart.houses ? <HouseSystemReceipt locale={locale} system={chart.houses.system} /> : ''}
                  {' · '}{t(locale, 'engine')}{chart.engineVersion}
                </p>
              </div>
            </details>
          )}

          {mode === 'full' && scene && (
            <>
              <div class={`calc__wheel shell${tourOpen ? ' calc__wheel--tour' : ''}`}>
                <div class="core calc__wheel-core">
                  <div class="xplr">
                    <div class="xplr__stage">
                      {/* role=group implies no interaction model, so the
                          arrow-key affordance must be spoken: a hidden hint
                          reaches AT via aria-describedby. */}
                      <p class="sr-only" id="xplr-wheel-keys">{t(locale, 'explorerKeyHint')}</p>
                      <div
                        class="xplr__wheelbox"
                        ref={wheelboxRef}
                        tabIndex={0}
                        role="group"
                        aria-label={t(locale, 'explorerLabel')}
                        aria-describedby="xplr-wheel-keys"
                        onKeyDown={onWheelKeyDown}
                        data-spotlight-id={spotlight?.id}
                        data-spotlight-run={spotlight?.run}
                        data-spotlight-motion={spotlight?.motion}
                        data-spotlight-phase={spotlight?.phase}
                      >
                        <Wheel
                          bodies={chart.bodies.filter((b) => b.body !== 'South Node')}
                          asc={asc}
                          mc={chart.angles?.mc ?? null}
                          cusps={viewCusps}
                          aspects={lens === 'natal'
                            ? chart.aspects.filter((a) => a.orb < 6 && aspectTypes.includes(a.type))
                            : []}
                          renderOverlay={lensRing ?? undefined}
                          animate
                          interactive={{
                            scene: viewScene ?? scene,
                            selection,
                            emphasis: viewEmphasis,
                            onSelect: applySelect,
                            label: t(locale, 'explorerLabel'),
                            spotlight,
                          }}
                        />
                        {spotlight && selection && entityId(selection) === spotlight.id && (
                          <div
                            key={spotlight.run}
                            class="xplr__spotlight-cue"
                            data-motion={spotlight.motion}
                            data-phase={spotlight.phase}
                            aria-hidden="true"
                          >
                            <span>{russianCopy?.chart.wheelActions.spotlight ?? 'Highlighted on this chart'}</span>
                            <strong>{describeSelection(selection)}</strong>
                          </div>
                        )}
                      </div>
                      {!tourOpen && (
                        <div class="calc__lens-rail" role="group" aria-label={lensLabels.rail}>
                          {(['natal', 'sky', 'progressed', 'return'] as const).map((id) => (
                            <button
                              key={id}
                              type="button"
                              class={`calc__lens-btn${lens === id ? ' is-active' : ''}`}
                              aria-pressed={lens === id}
                              onClick={() => void selectLens(id)}
                              data-lens-btn={id}
                            >
                              {lensLabels[id]}
                            </button>
                          ))}
                        </div>
                      )}
                      <LayerChips
                        aspectTypes={aspectTypes}
                        onAspectTypes={setAspectTypes}
                        showHouses={showHouses}
                        onShowHouses={setShowHouses}
                        hasHouses={chart.houses != null}
                        locale={locale}
                      />
                      {EntityPicker ? <EntityPicker
                        scene={scene}
                        selection={selection}
                        locale={locale}
                        onSelect={(ref) => {
                          if (ref?.kind === 'aspect') {
                            resetLens();
                            setAspectTypes((current) => current.includes(ref.type) ? current : [...current, ref.type]);
                          }
                          applySelect(ref);
                        }}
                      /> : (
                        <div class="xplr-entity-picker" data-chart-controls-state={controlsError ? 'error' : 'loading'}>
                          <p class="field__help" role={controlsError ? 'alert' : 'status'}>
                            {t(locale, controlsError ? 'explorerControlsError' : 'explorerControlsLoading')}
                          </p>
                          {controlsError && <>
                            <button class="btn btn--glass" type="button" data-chart-controls-retry onClick={() => requestChartControls(true)}>{t(locale, 'calculationRetry')}</button>
                            <CalculationReload error={calculationLoadMessage(locale)} locale={locale} />
                          </>}
                        </div>
                      )}
                      <div class="calc__depth">
                        <button
                          type="button"
                          class="calc__depth-btn"
                          aria-expanded={depthOpen}
                          onClick={() => void toggleDepth()}
                        >
                          {depthToggleLabel}
                        </button>
                        {depthOpen && depthMod && (
                          <depthMod.default
                            bodies={chart.bodies}
                            aspects={chart.aspects.filter((a) => a.orb < 6)}
                            cusps={viewCusps}
                            asc={asc}
                            mc={chart.angles?.mc ?? null}
                            dsc={chart.angles?.dsc ?? null}
                            ic={chart.angles?.ic ?? null}
                            latitude={chart.input.latitude ?? null}
                            longitude={chart.input.longitude ?? null}
                            utcMs={chart.input.utc.getTime()}
                            houseSystem={chart.input.houseSystem}
                            polarFallback={chart.flags.includes('polar-fallback')}
                            birthClock={computedInput?.timeKnown ? computedInput.time : null}
                            locale={locale}
                            selection={selection}
                            onSelect={applySelect}
                            size={440}
                          />
                        )}
                      </div>
                      {lens !== 'natal' && lensMod && (
                        <lensMod.default
                          lens={lens}
                          chart={chart}
                          locale={locale}
                          loadEngine={loadEngine}
                          track={track}
                          onRing={onLensRing}
                        />
                      )}
                    </div>
                    <div class="xplr__aside">
                      {tourOpen && tourMod && chartActionDockModule && Inspector ? (
                        <tourMod.ChartTour
                        scene={scene}
                        chart={chart}
                        locale={locale}
                        variant={tourKind ?? 'full'}
                        initialStep={tourKind === 'quick' ? firstReading.step : 0}
                        moonAmbiguous={moonAmbiguous}
                        selection={selection}
                        loadEngine={loadEngine}
                        buildScene={buildSceneModel}
                        topAspects={chartActionDockModule.topAspects}
                        readAspect={chartActionDockModule.natalAspectLine}
                        readHouse={chartActionDockModule.planetInHouseLine}
                        renderInspector={(inspScene, banner) => (
                          <Inspector
                            scene={inspScene}
                            selection={selection}
                            onSelect={applySelect}
                            locale={locale}
                            banner={banner}
                          />
                        )}
                        onSelect={applySelect}
                        onAnnounce={setAnnounce}
                        onVisual={setTourVisual}
                        onEnsure={({ houses, allAspects }) => {
                          if (houses) setShowHouses(true);
                          if (allAspects) setAspectTypes(ALL_ASPECT_TYPES);
                        }}
                        onTrack={track}
                        onProgress={(step) => {
                          if (tourKind !== 'quick') return;
                          persistFirstReading('in_progress', step);
                          track('first_reading_step', { step: String(step + 1) });
                          keepWheelAboveTour();
                        }}
                        onComplete={completeFirstReading}
                        onOpenForecast={() => {
                          track('next_action_clicked', { state: 'guide_complete', action: 'year_ahead' });
                          void selectLens('return');
                        }}
                        onSave={() => {
                          if (tourKind === 'quick') {
                            track('next_action_clicked', { state: 'guide_complete', action: 'save' });
                          }
                          exitTour();
                          openSavePrompt('tour');
                        }}
                        shareLabel={shareActionLabel}
                        shareStatusLabel={shareActionStatusLabel}
                        shareDisabled={shareActionDisabled}
                        onShare={shareChartFromAction}
                        onExit={exitTour}
                        returnFocus={() => wheelboxRef.current?.focus()}
                      />
                      ) : Inspector && (
                        <Inspector
                          scene={scene}
                          selection={selection}
                          onSelect={applySelect}
                          locale={locale}
                        />
                      )}
                      {shareInput && ChartActionDock && (
                        <>
                          <ChartActionDock
                            tourOpen={tourOpen}
                            shareOnly={firstReadingPromptVisible}
                            actionLabel={wheelActionCopy.actions}
                            signature={showsEnglishInterpretation && signature ? {
                              headline: signature.title,
                              evidence: signature.kind === 'aspect' ? signature.detail ?? signature.summary : signature.summary,
                            } : null}
                            signatureLabel={subjectMode === 'other'
                              ? wheelActionCopy.signatureOther
                              : wheelActionCopy.signatureSelf}
                            guideLabel={firstReading.status === 'complete'
                              ? wheelActionCopy.replay
                              : wheelActionCopy.guide}
                            shareLabel={shareActionLabel}
                            shareStatusLabel={shareActionStatusLabel}
                            compareLabel={subjectMode === 'other'
                              ? mineHandoff
                                ? wheelActionCopy.compareMine
                                : wheelActionCopy.compareAdd
                              : undefined}
                            compareHref={compareWithMineHref}
                            saveLabel={saved === 'saved'
                              ? t(locale, 'chartSavedDevice')
                              : locale === 'en' && subjectMode === 'self'
                                ? 'Save my chart'
                                : t(locale, 'saveThisChart')}
                            onSave={saved === 'saved' ? undefined : (trigger) => {
                              track('next_action_clicked', {
                                state: firstReading.status === 'complete' ? 'guide_complete' : 'chart_result',
                                action: 'save',
                              });
                              openSavePrompt('free', trigger);
                            }}
                            anotherLabel={wheelActionCopy.another}
                            anotherHref={anotherChartHref}
                            onGuide={() => {
                              track('next_action_clicked', {
                                state: firstReading.status === 'complete' ? 'guide_complete' : 'chart_result',
                                action: firstReading.status === 'complete' ? 'replay_guide' : 'full_tour',
                              });
                              void startTour('full');
                            }}
                            onShare={shareChartFromAction}
                            shareDisabled={shareActionDisabled}
                          />
                          {savePromptOpen && (
                            <div class="chart-action-dock calc__actions">
                              {renderSavePrompt()}
                            </div>
                          )}
                          {saveError && <p class="calc__error" role="alert">{saveError}</p>}
                        </>
                      )}
                    </div>
                  </div>
                  <p class="sr-only" role="status">{announce}</p>
                </div>
              </div>

              {mode === 'full' && locale === 'en' && AspectPatternFeature && (
                <AspectPatternFeature context="natal" points={chart.bodies} aspects={chart.aspects}
                  imageOf={{ chart, birthDate: computedInput?.date }}
                  timeKnown={chart.input.timeKnown && !chart.flags.includes('no-time')}
                  sourceKey={String(chartContextIdRef.current)}
                  onSelectBody={(body) => showOnChartFromReading({ kind: 'body', body }, 'instant')} />
              )}

              {/* A visual story leads; exact data remains available below. */}
              {showsEnglishInterpretation && reading && ReadingPath && (
                <ReadingPath
                  practiceSource={primaryProfileChartIdRef.current && computedInput ? {
                    id: primaryProfileChartIdRef.current,
                    identity: learningInputIdentity({ ...computedInput, subjectMode: computedInput.subjectMode ?? 'self' }),
                    run: chartContextIdRef.current, inputRevision,
                    isCurrent: (run, revision) => run === chartContextIdRef.current && revision === inputRevisionRef.current
                      && primaryProfileChartIdRef.current !== null && profileAccessAllowed(),
                  } : null}
                  timeKnown={chart.input.timeKnown && !chart.flags.includes('no-time')}
                  effectiveHouseSystem={chart.houses?.system ?? null}
                  polarFallback={chart.flags.includes('polar-fallback')}
                  placements={reading.ps}
                  topAspects={reading.top}
                  weather={reading.weather}
                  risingLon={asc}
                  housesKnown={chart.houses != null}
                  moonSignCandidates={moonCandidates(chart)}
                  selection={selection}
                  onShowOnChart={showOnChartFromReading}
                />
              )}

              {mode === 'full' && ChartContext && (
                <ChartContext input={{ bodies: chart.bodies, timeKnown: chart.input.timeKnown,
                  moonSignCandidates: chart.moonSignCandidates, angles: chart.angles, houses: chart.houses }}
                  imageOf={{ chart, birthDate: computedInput?.date }}
                  locale={locale} inputRevision={inputRevision}
                  isInputCurrent={(revision) => inputRevisionRef.current === revision}
                  selection={selection} onShowOnChart={showOnChartFromReading} />
              )}

              {mode === 'full' && showsEnglishInterpretation && ApproachRead && (
                <ApproachRead chart={chart} locale={locale} moonAmbiguous={moonAmbiguous} birthDate={computedInput?.date} />
              )}

              {mode === 'full' && showsEnglishInterpretation && CommunicationRead && (
                <CommunicationRead chart={chart} locale={locale} birthDate={computedInput?.date} />
              )}
            </>
          )}

          {/* The one sanctioned records bridge on a tool page. It follows the
              chart's own readings so the first-time result is the chart first,
              and resolves only when the Sun sign is from a known-time calculation. */}
          {mode === 'full' && !sharedReceiver && registryRecord && (
            <aside
              class="calc__record"
              data-registry-bridge
              data-registry-bridge-sign={registryRecord.slug}
              data-registry-bridge-surface="birth_chart"
              data-registry-bridge-locale={locale}
            >
              <span class="calc__record-label mono">{t(locale, 'recordLabel')}</span>
              <span class="calc__record-copy">
                <strong class="calc__record-sun">
                  {tf(locale, 'recordChartSun', { sign: signName(registryRecord, locale) })}
                </strong>
                <span class="calc__record-text">
                  {tf(locale, 'recordChartBody', { sign: signName(registryRecord, locale) })}
                </span>
              </span>
              <a
                class="calc__record-link"
                href={`/registry/${registryRecord.slug}/`}
                title={russianCopy?.chart.englishOnlyTitle}
                onClick={() => trackAnalytics('registry_bridge_click', {
                  surface: 'birth_chart',
                  locale,
                })}
              >{tf(locale, 'recordChartLink', { sign: signName(registryRecord, locale) })}</a>
            </aside>
          )}

          {/* One primary action, derived from the visitor's current state. */}
          <div class="calc__actions">
            {savePromptOpen && !(mode === 'full' && shareInput) ? (
              renderSavePrompt()
            ) : mode === 'full' ? (
              saved === 'saved' ? (
                <a
                  class="btn btn--primary"
                  href="/today/"
                  title={russianCopy?.chart.englishOnlyTitle}
                  onClick={() => track('next_action_clicked', { state: 'saved', action: 'today' })}
                  data-primary-action="today"
                >
                  <span>{t(locale, 'seeTodaySky')}{russianCopy?.chart.englishOnlySuffix ?? ''}</span>
                  <span class="orb">→</span>
                </a>
              ) : null
            ) : (
              <>
                <button
                  ref={saveButtonRef}
                  class="btn btn--primary"
                  type="button"
                  onClick={saved === 'saved'
                    ? undefined
                    : (event) => openSavePrompt('free', event.currentTarget)}
                  aria-disabled={saved === 'saved'}
                  data-save-chart
                >
                  <span aria-live="polite">{saved === 'saved' ? t(locale, 'chartSavedDevice') : t(locale, 'saveThisChart')}</span>
                  <span class="orb">{saved === 'saved' ? '✓' : '+'}</span>
                </button>
                <button
                  class="btn btn--ghost"
                  type="button"
                  onClick={shareChartFromAction}
                  disabled={shareActionDisabled}
                  data-share-placement
                >
                  <span>{shareActionStatusLabel}</span>
                  <span class="orb">↗</span>
                </button>
                <a
                  class="btn btn--ghost"
                  href={shareInput
                    ? `${localizePath(locale, '/birth-chart/')}#${chartHandoffFragment(shareInput, { subjectMode })}`
                    : localizePath(locale, '/birth-chart/')}
                  data-birth-chart-handoff
                ><span>{t(locale, 'getBirthChart')}</span><span class="orb">↗</span></a>
              </>
            )}
          </div>
          {mode !== 'full' && shareInput && (
            <button
              class="calc__share-options-link"
              type="button"
              onClick={() => void openShareOptions()}
              data-share-options
            >
              {t(locale, 'shareChart')} · {t(locale, 'chartActionsMore')}
            </button>
          )}
          {mode === 'full'
            && saved !== 'saved'
            && firstReading.status !== 'not_started'
            && firstReading.status !== 'in_progress'
            && <p class="calc__saved">{t(locale, 'saveYearAheadNote')}</p>}
          {mode !== 'full' && saveError && <p class="calc__error" role="alert">{saveError}</p>}
          {saved === 'saved' && (subjectMode === 'self' && locale === 'en'
            ? <p class="calc__saved" data-your-page-ready>Saved as your chart. <a href="/profile/">Open your page</a> — it’s at zodiacs.org/me whenever you come back.</p>
            : <p class="calc__saved">{t(locale, 'chartSavedBeforeLink')} <a href={localizePath(locale, '/profile/')}>{t(locale, 'chartSavedLink')}</a> {t(locale, 'chartSavedAfterLink')}</p>)}
          {mode === 'full' && shareInput && (
            <details class="calc__more" data-chart-more>
              <summary class="calc__more-summary">
                <span>{t(locale, 'chartActionsMore')}</span>
                <span class="orb" aria-hidden="true">+</span>
              </summary>
              <div class="calc__more-body">
                <button
                  class="btn btn--glass"
                  type="button"
                  onClick={() => void openShareOptions()}
                  data-share-options
                >
                  <span>{t(locale, 'shareChart')} · {t(locale, 'chartActionsMore')}</span>
                  <span class="orb">↗</span>
                </button>
                <div class="calc__more-copy" data-calculation-receipt-export>
                    <button
                      class="btn btn--glass"
                      type="button"
                      onClick={exportReceipt}
                      disabled={!receiptExport || receiptExport.chart !== chart}
                      aria-describedby="calculation-receipt-privacy"
                      data-download-calculation-receipt
                    >
                      <span>{t(locale, 'chartReceiptDownload')}</span>
                      <span class="orb" aria-hidden="true">↓</span>
                    </button>
                    <p class="field__help" id="calculation-receipt-privacy">{t(locale,
                      receiptExport && receiptExport.chart === chart ? 'chartReceiptPrivacy' : 'chartReceiptUnavailable')}</p>
                    {receiptDownloadError && <p class="calc__error" role="alert">{t(locale, 'chartReceiptError')}</p>}
                    {recordsEnabled && recordCopy && receiptExport && receiptExport.chart === chart && (
                      <div class="calc__record-keep" data-record-keep data-record-keep-state={recordKeep}>
                        <button
                          class="btn btn--glass"
                          type="button"
                          onClick={() => void keepRecord()}
                          disabled={recordKeep === 'opening' || recordKeep === 'busy' || recordKeep === 'kept' || recordKeep === 'read-only'
                            || recordKeep === 'locked' || recordKeep === 'unavailable' || recordKeep === 'pending'}
                          aria-describedby="calculation-record-scope"
                          data-keep-calculation-record
                        >
                          <span>{recordKeep === 'busy' ? recordCopy.keeping
                            : recordKeep === 'kept' ? recordCopy.keptButton
                              : recordKeep === 'uncertain' || recordKeep === 'changed' || recordKeep === 'failed' ? recordCopy.keepAgain
                                : recordCopy.keep}</span>
                          <span class="orb" aria-hidden="true">{recordKeep === 'kept' ? '✓' : '+'}</span>
                        </button>
                        <p class="field__help" id="calculation-record-scope">
                          {recordMode === null ? ''
                            : recordMode.kind === 'account' ? recordCopy.accountScope
                              : recordMode.kind === 'retained' ? recordCopy.retainedScope
                                : recordCopy.guestScope}
                          {recordMode !== null && recordErasedNote && recordKeep === 'idle' ? ` ${recordCopy.keepErasedNote}` : ''}
                        </p>
                        {recordKeep === 'kept' && (
                          <p class="calc__saved" role="status" tabIndex={-1} ref={recordKeptNoteRef} data-record-kept>
                            {recordCopy.kept}{' '}
                            <a href={`${localizePath(locale, '/profile/')}#calculation-records`}>{recordCopy.keptLink}</a>
                          </p>
                        )}
                        {recordKeep !== 'opening' && recordKeep !== 'idle' && recordKeep !== 'busy' && recordKeep !== 'kept' && (
                          <p class="calc__error" role="alert" data-record-keep-message>
                            {recordKeep === 'uncertain' ? recordCopy.keepUncertain
                              : recordKeep === 'changed' ? recordCopy.keepChanged
                              : recordKeep === 'failed' ? recordCopy.keepFailed
                                : recordKeep === 'full' ? recordCopy.keepFull
                                  : recordKeep === 'unavailable' ? recordCopy.keepUnavailable
                                    : recordKeep === 'locked' ? recordCopy.keepLocked
                                      : recordKeep === 'read-only' ? recordCopy.keepReadOnly
                                        : recordKeep === 'pending' ? recordCopy.keepPending
                                          : recordCopy.staleRefresh}
                          </p>
                        )}
                      </div>
                    )}
                </div>
                {card === 'saved' && (
                  <p class="sr-only" role="status">{t(locale, 'chartCardSaved')}</p>
                )}
                {(saved === 'saved' || firstReading.status === 'complete') && CalendarSubscribe && (
                  <CalendarSubscribe
                    locale={locale}
                    positions={{
                      bodies: chart.bodies,
                      angles: chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null,
                      houseSystem: chart.houses?.system ?? houseSystem,
                      engineVersion: chart.engineVersion,
                      utc: chart.input.utc,
                    }}
                    birthDate={chart.input.timeKnown ? undefined : computedInput?.date ?? ''}
                  />
                )}
                {card === 'error' && <p class="calc__error" role="alert">{t(locale, 'cardError')}</p>}
              </div>
            </details>
          )}
          {mode === 'full' && !sharedReceiver && saved === 'saved' && registryAuraLink && (
            <p class="calc__saved" data-registry-aura-chart-link>
              {registryAuraLink.context === 'return'
                ? registryAuraCopy.return
                : registryAuraCopy.discover}{' '}
              <a href={registryAuraLink.href} onClick={() => {
                for (const event of registryAuraChartAnalytics(registryAuraLink.context)) {
                  track(event.name, event.properties);
                }
              }}>
                {registryAuraLink.context === 'return'
                  ? registryAuraCopy.returnLink
                  : registryAuraCopy.discoverLink}
              </a>
            </p>
          )}
          {a2hsHint && (
            <div class="notice calc__a2hs" role="status">
              <span>{a2hsHint.message}</span>
              <button
                type="button"
                class="place__clear"
                aria-label={a2hsHint.dismissLabel}
                onClick={() => {
                  setA2hsHint(null);
                  if (a2hsHint.platform !== 'ios') loadPushOptIn();
                }}
              >×</button>
            </div>
          )}
          {PushOptIn && locale !== 'ru' && <PushOptIn locale={locale} />}

          {mode === 'full' && scene && (
            <details
              class="calc__detail"
              data-detail
              data-evidence-disclosure
              open={detailOpen}
              onToggle={onDetailToggle}
            >
              <summary class="calc__detail-summary">
                {detailLabels.lead}<span class="mono">{placements.length}</span>{detailLabels.placements}
                {locale === 'ru'
                  ? tp('ru', 'aspects', chart.aspects.length, russianCopy!.plurals)
                  : <><span class="mono">{chart.aspects.length}</span>{detailLabels.aspects}</>}
              </summary>
              <div class="calc__detail-body">
                <p class="calc__receipt mono" data-chart-receipt>
                  {chart.input.utc.toISOString().replace('T', ' · ').slice(0, 21)} UTC
                  {city ? ` · ${city.lat.toFixed(2)}°, ${city.lon.toFixed(2)}°` : ''}
                  {chart.houses ? <HouseSystemReceipt locale={locale} system={chart.houses.system} /> : ''}
                  {' · '}{t(locale, 'engine')}{chart.engineVersion}
                </p>
                <div class="calc__table-wrap">
                  <table class="calc__table">
                    <thead>
                      <tr><th>{t(locale, 'body')}</th><th>{t(locale, 'position')}</th><th>{t(locale, 'sign')}</th>{chart.houses && <th>{t(locale, 'house')}</th>}<th><span class="sr-only">{t(locale, 'motion')}</span></th></tr>
                    </thead>
                    <tbody>
                      {placements.map((p) => {
                        const inScene = scene.bodies.some((b) => b.body === p.body);
                        const isSel = selection?.kind === 'body' && selection.body === p.body;
                        const hue = signForLongitude(p.lon).hue;
                        return (
                          <tr key={p.body} data-selected={isSel ? 'true' : undefined} style={isSel ? `--sign:${hue}` : undefined}>
                            <td>
                              {inScene ? (
                                <button
                                  class="calc__rowbtn"
                                  type="button"
                                  aria-pressed={isSel}
                                  onClick={() => applySelect(isSel ? null : { kind: 'body', body: p.body })}
                                >
                                  <span class="calc__glyph"><PlanetGlyph body={p.body} size={15} /></span> {planetLabel(locale, p.body)}
                                </button>
                              ) : (
                                <><span class="calc__glyph"><PlanetGlyph body={p.body} size={15} /></span> {planetLabel(locale, p.body)}</>
                              )}
                            </td>
                            <td class="mono">{p.label.split(' ')[0]}</td>
                            <td>{p.body === 'Moon' && moonIsUncertain(chart)
                              ? <>{moonLabel(chart, locale)} · {t(locale, 'needsBirthTime')}</>
                              : <SignChip lon={p.lon} locale={locale} />}</td>
                            {chart.houses && <td class="mono">{p.house}</td>}
                            <td class="mono calc__retro">{p.retrograde ? 'Rx' : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {chart.aspects.length > 0 && (
                  <section class="calc__aspects" aria-labelledby="calc-aspects-title">
                    <h3 id="calc-aspects-title">{t(locale, 'aspectsFound')} - {locale === 'ru'
                      ? tp('ru', 'aspects', chart.aspects.length, russianCopy!.plurals)
                      : <>{chart.aspects.length} {t(locale, 'found')}</>}</h3>
                    <ul>
                      {chart.aspects.map((a) => {
                        const ref: EntityRef = { kind: 'aspect', a: a.a, b: a.b, type: a.type };
                        const inScene = aspectTypes.includes(a.type)
                          && scene.aspects.some((x) => x.a === a.a && x.b === a.b && x.type === a.type);
                        const isSel = selection?.kind === 'aspect'
                          && selection.a === a.a && selection.b === a.b && selection.type === a.type;
                        const line = (
                          <>
                            <PlanetGlyph body={a.a} size={13} class="calc__pg" /> {planetLabel(locale, a.a)} <AspectGlyph type={a.type} size={13} class="calc__pg" /> {aspectLabel(locale, a.type)} <PlanetGlyph body={a.b} size={13} class="calc__pg" /> {planetLabel(locale, a.b)} · {t(locale, 'orb')} {a.orb.toFixed(1)}° · {t(locale, a.applying ? 'applying' : 'separating')}
                          </>
                        );
                        return (
                          <li key={`${a.a}${a.b}${a.type}`} class="mono" data-selected={isSel ? 'true' : undefined}>
                            {inScene ? (
                              <button class="calc__rowbtn" type="button" aria-pressed={isSel} onClick={() => applySelect(isSel ? null : ref)}>
                                {line}
                              </button>
                            ) : line}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </div>
            </details>
          )}

        </div>
      )}

      {chart && shareInput && shareDialogOpen && ShareDialog && (
        <ShareDialog
          chart={chart}
          locale={locale}
          mode={mode}
          card={card}
          onCardStateChange={(state) => {
            if (resultIsCurrent(displayedResultOwner)) setCard(state);
          }}
          onClose={() => {
            if (resultIsCurrent(displayedResultOwner)) closeShareDialog();
          }}
          detailsUrl={shareUrl()}
          receiverPath={localizePath(locale, '/birth-chart/')}
          birthDetails={computedInput ? {
            date: computedInput.date,
            time: computedInput.time,
            timeKnown: computedInput.timeKnown,
            city: computedInput.city.name,
            admin1: computedInput.city.admin1,
            country: computedInput.city.country,
            timezone: computedInput.city.tz,
          } : undefined}
          preparedPrimary={shareRuntimeRef.current.primary?.artifact}
          moonAmbiguous={moonAmbiguous}
        />
      )}

      {PwaInstallPrompt && locale !== 'ru' && (
        <PwaInstallPrompt locale={locale} computationCount={pwaComputationCount} />
      )}
    </div>
  );
}
