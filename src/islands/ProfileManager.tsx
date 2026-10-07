/**
 * Saved charts — the local-first chart library and profile surface. Renders
 * saved charts from localStorage, supports rename/delete, and frames
 * the local-first sync model honestly.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { deleteChart, renameChart } from '../lib/profile/store';
import { deletePair, loadPairs, pairSideLabels, prunePairs } from '../lib/profile/pairs';
import type { SavedPair } from '../lib/profile/pairs';
import type { SavedChart } from '../lib/profile/schema';
import { useEngine } from '../lib/hooks/useEngine';
import { useProfile } from '../lib/hooks/useProfile';
import { signForLongitude, formatLongitude, signName } from '../lib/signs';
import { signIcon } from '../lib/sign-icon';
import { profileChartHandoffFragment } from '../lib/chart-handoff';
import type { Session } from '@supabase/supabase-js';
import type * as Sync from '../lib/profile/sync';
import { localizePath, normalizeCatalogLocale, t, tf, tp, type CatalogLocale as Locale, type UiKey } from '../lib/i18n';
import { russianRuntime } from '../lib/i18n/ru-runtime';
import { formatDate, intlLocale } from '../lib/i18n/dates';
import {
  browserTimezoneChoices,
  deleteDailyChartPreference,
  getDailyChartPreference,
  getSyncedChartIds,
  maskDailyEmail,
  pauseDailyChartPreferenceForDeletion,
  rememberDailyChartSelection,
  rememberedDailyChartSelection,
  resendDailyChartPreference,
  setDailyChartPreference,
  type DailyChartPreference,
} from '../lib/profile/daily-email-client';
import { weeklyDigestSignupEnabled } from '../lib/weekly-digest/feature-flags';
import EvidenceDisclosure from './EvidenceDisclosure';

type PushOptInModule = typeof import('./PushOptIn');

/** "Cancer Sun · 1907-07-06" → "Cancer Sun" for compact CTAs. */
const handle = (name: string) => name.split('·')[0].trim() || name;

// Module-local like the compatibility island's PAIR_COPY — only this
// page uses these two strings.
const PF_PAIR_COPY = {
  en: { savedPairs: 'Saved comparisons', pairRemoved: 'Comparison removed.' },
  es: { savedPairs: 'Comparaciones guardadas', pairRemoved: 'Comparación eliminada.' },
  pt: { savedPairs: 'Comparações salvas', pairRemoved: 'Comparação removida.' },
  fr: { savedPairs: 'Comparaisons enregistrées', pairRemoved: 'Comparaison supprimée.' },
  it: { savedPairs: 'Confronti salvati', pairRemoved: 'Confronto rimosso.' },
  ru: { savedPairs: 'Сохранённые сравнения', pairRemoved: 'Сравнение удалено.' },
} as const satisfies Record<Locale, Record<'savedPairs' | 'pairRemoved', string>>;
const PF_EMAIL_COPY = {
  en: {
    syncLabel: 'Email for chart sync',
    digestLabel: 'Optional weekly email',
    digestTitle: 'Personalized weekly sky email',
    digestCopy: 'A forecast based on your synced saved chart. Off until you check this box.',
  },
  es: {
    syncLabel: 'Email para sincronizar cartas',
    digestLabel: 'Email semanal opcional',
    digestTitle: 'Email semanal personalizado del cielo',
    digestCopy: 'Un pronóstico basado en tu carta guardada y sincronizada. Está desactivado hasta que marques esta casilla.',
  },
  pt: {
    syncLabel: 'E-mail para sincronizar mapas',
    digestLabel: 'E-mail semanal opcional',
    digestTitle: 'E-mail semanal personalizado do céu',
    digestCopy: 'Uma previsão baseada no seu mapa salvo e sincronizado. Fica desativada até você marcar esta caixa.',
  },
  fr: {
    syncLabel: 'E-mail pour synchroniser les thèmes',
    digestLabel: 'E-mail hebdomadaire facultatif',
    digestTitle: 'E-mail personnalisé du ciel de la semaine',
    digestCopy: 'Une prévision basée sur ton thème enregistré et synchronisé. Désactivée tant que tu ne coches pas cette case.',
  },
  it: {
    syncLabel: 'E-mail per sincronizzare i temi',
    digestLabel: 'E-mail settimanale facoltativa',
    digestTitle: 'E-mail personalizzata del cielo settimanale',
    digestCopy: 'Una previsione basata sul tema salvato e sincronizzato. Resta disattivata finché non selezioni questa casella.',
  },
  ru: {
    syncLabel: 'Почта для синхронизации карт',
    digestLabel: 'Необязательное еженедельное письмо',
    digestTitle: 'Персональный еженедельный прогноз',
    digestCopy: 'Прогноз по вашей сохранённой и синхронизированной карте. Выключен, пока вы сами не поставите отметку.',
  },
} as const satisfies Record<Locale, Record<'syncLabel' | 'digestLabel' | 'digestTitle' | 'digestCopy', string>>;
const PF_DAILY_COPY = {
  title: 'Personal daily brief',
  body: 'One synced chart, read against each morning’s sky, in your inbox.',
  noChartsBeforeLink: 'This needs a synced chart. Charts saved only on this device never enter email — sync one first if you want the brief.',
  syncLink: 'How chart sync works',
  chartLegend: 'Which chart should the brief read?',
  timezoneLabel: 'Deliver around 7:00 in',
  timezoneUtc: 'UTC (the default morning)',
  consentNote: 'One email each morning for this chart. Stop anytime here, or from any email’s unsubscribe link.',
  enroll: 'Start my daily brief',
  pendingTitle: 'Confirm from your inbox.',
  pendingBody: (maskedEmail: string) => `We sent a link to ${maskedEmail}. The brief begins after you confirm — until then, nothing is sent.`,
  pendingAddressChanged: 'A confirmation is still pending. Resend the link to your current account email, then confirm it to begin the brief.',
  pendingResend: 'Resend the link',
  pendingAgain: 'Another confirmation link is on its way. The newest link is the one that works.',
  pendingCancel: 'Cancel this request',
  reconfirmTitle: 'Confirm your current email.',
  reconfirmBody: 'Your account email changed. Delivery is paused until you confirm the current address.',
  reconfirmAction: 'Confirm my current email',
  activeLine: (chartName: string, timezone: string) => `On · reading ${chartName} · arriving around 7:00, ${timezone}`,
  changeChart: 'Change chart',
  chartChanged: (chartName: string) => `Switched. Tomorrow’s brief reads ${chartName}.`,
  timezoneChanged: (timezone: string) => `Saved. Tomorrow arrives around 7:00, ${timezone}.`,
  stop: 'Stop the daily brief',
  stopNote: 'Stops the personal brief immediately. If this address also has the sun-sign daily, that one resumes on its own.',
  pausedBanner: 'Paused — the chart this brief read was deleted. Delivery stays stopped until you choose another below.',
  vsWeekly: 'Separate from the weekly: the “Personalized weekly sky email” below remains its own choice.',
  error: "Couldn't update this preference. Please try again.",
} as const;
const PF_DAILY_DELETE_BLOCKED = {
  en: 'Sign in before removing this synced chart so its daily email and cloud copy can stop together.',
  es: 'Inicia sesión antes de eliminar esta carta sincronizada para que su email diario y su copia en la nube se detengan a la vez.',
  pt: 'Entre na conta antes de remover este mapa sincronizado para que o e-mail diário e a cópia na nuvem sejam interrompidos juntos.',
  fr: 'Connecte-toi avant de supprimer ce thème synchronisé afin que son e-mail quotidien et sa copie dans le cloud s’arrêtent ensemble.',
  it: 'Accedi prima di rimuovere questo tema sincronizzato, così l’email quotidiana e la copia nel cloud si interrompono insieme.',
  ru: 'Войдите в аккаунт перед удалением синхронизированной карты, чтобы одновременно остановить её ежедневное письмо и удалить облачную копию.',
} as const satisfies Record<Locale, string>;
export const PF_BOOK_COPY = {
  en: {
    count: (n: number) => n === 1
      ? '1 birth chart saved.'
      : `${n} birth charts saved — yours and the people you read for.`,
    add: "Add someone's chart",
    privacy: 'Saved on this device. Nothing is uploaded unless you turn sync on.',
    details: 'Birth details',
  },
  es: {
    count: (n: number) => n === 1
      ? '1 carta natal guardada.'
      : `${n} cartas natales guardadas: la tuya y las de las personas para quienes haces lecturas.`,
    add: 'Agrega la carta de alguien',
    privacy: 'Guardado en este dispositivo. No se sube nada salvo que actives la sincronización.',
    details: 'Datos de nacimiento',
  },
  pt: {
    count: (n: number) => n === 1
      ? '1 mapa astral salvo.'
      : `${n} mapas astrais salvos: o seu e os das pessoas para quem você faz leituras.`,
    add: 'Adicionar o mapa de alguém',
    privacy: 'Salvo neste dispositivo. Nada é enviado, a menos que você ative a sincronização.',
    details: 'Dados de nascimento',
  },
  fr: {
    count: (n: number) => n === 1
      ? '1 thème astral enregistré.'
      : `${n} thèmes astraux enregistrés : le tien et ceux que tu interprètes pour d’autres personnes.`,
    add: 'Ajouter le thème de quelqu’un',
    privacy: 'Enregistré sur cet appareil. Rien n’est envoyé tant que tu n’actives pas la synchronisation.',
    details: 'Données de naissance',
  },
  it: {
    count: (n: number) => n === 1
      ? '1 tema natale salvato.'
      : `${n} temi natali salvati: il tuo e quelli che interpreti per altre persone.`,
    add: 'Aggiungi il tema di qualcuno',
    privacy: 'Salvato su questo dispositivo. Non viene caricato nulla, a meno che tu non attivi la sincronizzazione.',
    details: 'Dati di nascita',
  },
  ru: {
    count: (n: number) => `${tp('ru', 'savedCharts', n, russianRuntime().plurals)} — ваши и тех, для кого вы читаете.`,
    add: 'Добавить карту другого человека',
    privacy: 'Сохранено на этом устройстве. Ничего не загружается, пока вы сами не включите синхронизацию.',
    details: 'Данные рождения',
  },
} as const;
const HAS_PROFILE_SYNC = Boolean(
  import.meta.env.PUBLIC_SUPABASE_URL &&
  (import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY)
);
const WEB_PUSH_ENABLED = import.meta.env.PUBLIC_WEB_PUSH_ENABLED === '1';

function dailyChartIdentity(chart: SavedChart): string {
  const date = formatDate('en', `${chart.birth.date}T12:00:00Z`, {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  let time = 'Time unknown';
  if (chart.birth.timeKnown && chart.birth.time) {
    const [hours, minutes] = chart.birth.time.split(':').map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      time = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
    }
  }
  const place = chart.birth.place
    ? `${chart.birth.place.name}, ${chart.birth.place.country}`
    : 'Place not saved';
  return `${date} · ${time} · ${place}`;
}

interface ProfileManagerProps {
  locale?: Locale;
  /** Server-computed only; the island cannot infer or enable this feature. */
  dailyEmailEnabled?: boolean;
  /** Server-computed exact flag; suppresses the legacy upload-everything sync UI. */
  accountSyncV2Enabled?: boolean;
}

function ChipRow({ chart, locale }: { chart: SavedChart; locale: Locale }) {
  const find = (name: string) => chart.summary.bodies.find((b) => b.body === name);
  const entries: { label: UiKey; lon: number | null }[] = [
    { label: 'sun', lon: find('Sun')?.lon ?? null },
    { label: 'moon', lon: find('Moon')?.lon ?? null },
    { label: 'rising', lon: chart.summary.angles?.asc ?? null },
  ];
  return (
    <div class="pf-chart__three">
      {entries.map(({ label, lon }) => {
        if (lon === null) {
          return (
            <span class="pf-chip pf-chip--empty" key={label}>
              <span class="pf-chip__label">{t(locale, label)}</span> {t(locale, 'needsTime')}
            </span>
          );
        }
        const s = signForLongitude(lon);
        return (
          <a class="pf-chip" href={localizePath(locale, `/${s.slug}/`)} style={`--sign:${s.hue}`} key={label} title={formatLongitude(lon, locale)}>
            <picture class="pf-chip__icon">
              <img src={signIcon(48, s.slug)} width="16" height="16" alt="" loading="lazy" decoding="async" />
            </picture>
            <span class="pf-chip__label">{t(locale, label)}</span> {signName(s, locale)}
          </a>
        );
      })}
    </div>
  );
}

export default function ProfileManager({
  locale: rawLocale = 'en',
  dailyEmailEnabled = false,
  accountSyncV2Enabled = false,
}: ProfileManagerProps) {
  const locale = normalizeCatalogLocale(rawLocale);
  const showDailyEmail = dailyEmailEnabled && locale === 'en';
  const loadEngine = useEngine();
  const { profile, ready: profileReady } = useProfile();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pairs, setPairs] = useState<SavedPair[]>([]);
  const [pairAnnounce, setPairAnnounce] = useState('');
  const [syncApi, setSyncApi] = useState<typeof Sync | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [syncState, setSyncState] = useState<'idle' | 'sending' | 'sent' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [digestMessage, setDigestMessage] = useState('');
  const [digestState, setDigestState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [digestOptIn, setDigestOptInState] = useState(false);
  const [digestBusy, setDigestBusy] = useState(false);
  const [syncedChartIds, setSyncedChartIds] = useState<string[]>([]);
  const [dailyPreference, setDailyPreference] = useState<DailyChartPreference | null>(null);
  const [dailyPending, setDailyPending] = useState<{
    chartId: string;
    timezone: string;
    maskedEmail: string | null;
  } | null>(null);
  const [dailyChartId, setDailyChartId] = useState('');
  const [dailyTimezone, setDailyTimezone] = useState('UTC');
  const [dailyBusy, setDailyBusy] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyEditingChart, setDailyEditingChart] = useState(false);
  const [dailyMessage, setDailyMessage] = useState('');
  const [dailyError, setDailyError] = useState(false);
  const [pushModule, setPushModule] = useState<PushOptInModule | null>(null);

  function resetDailyState() {
    setSyncedChartIds([]);
    setDailyPreference(null);
    setDailyPending(null);
    setDailyChartId('');
    setDailyTimezone('UTC');
    setDailyBusy(false);
    setDailyLoading(false);
    setDailyEditingChart(false);
    setDailyMessage('');
    setDailyError(false);
  }

  async function loadDailyState(
    current: Session,
  ): Promise<'pending' | 'resolved' | 'unavailable'> {
    if (!showDailyEmail) return 'unavailable';
    setDailyLoading(true);
    setDailyError(false);
    setDailyMessage('');
    try {
      const [ids, preference] = await Promise.all([
        getSyncedChartIds(current.user.id),
        getDailyChartPreference(current.access_token),
      ]);
      setSyncedChartIds(ids);
      if (preference.pending && preference.chartId && preference.timezone) {
        rememberDailyChartSelection(preference.chartId);
        setDailyPreference(null);
        setDailyPending({
          chartId: preference.chartId,
          timezone: preference.timezone,
          maskedEmail: preference.maskedEmail,
        });
        setDailyChartId(preference.chartId);
        setDailyTimezone(preference.timezone);
        return 'pending';
      } else if (preference.enabled || preference.requiresConfirmation) {
        rememberDailyChartSelection(preference.paused ? null : preference.chartId);
        setDailyPreference(preference);
        setDailyPending(null);
        setDailyChartId(preference.chartId ?? '');
        setDailyTimezone(preference.timezone ?? 'UTC');
        return 'resolved';
      } else {
        rememberDailyChartSelection(null);
        setDailyPreference(null);
        setDailyPending(null);
        return 'resolved';
      }
    } catch {
      setDailyError(true);
      setDailyMessage(PF_DAILY_COPY.error);
      return 'unavailable';
    } finally {
      setDailyLoading(false);
    }
  }

  useEffect(() => {
    if (!WEB_PUSH_ENABLED || locale !== 'en') return;
    let live = true;
    void import('./PushOptIn').then((module) => {
      if (live) setPushModule(module);
    }).catch(() => {});
    return () => { live = false; };
  }, [locale]);

  useEffect(() => {
    let unsubscribe = () => {};
    // Stale saved summaries are rewritten before this page's first sync
    // uploads them. A refresh that cannot load leaves them as stored.
    const refreshed = import('../lib/profile/refresh')
      .then(({ refreshSavedChartSummaries }) => refreshSavedChartSummaries(loadEngine))
      .catch(() => 0);
    if (!HAS_PROFILE_SYNC || accountSyncV2Enabled) return () => unsubscribe();
    import('../lib/profile/sync')
      .then(async (api) => {
        if (!api.isSupabaseConfigured()) return;
        setSyncApi(api);
        const current = await api.getSyncSession();
        setSession(current);
        if (current) {
          setSyncState('syncing');
          await refreshed;
          if (!await api.syncNow()) throw new Error('Charts are saved in this browser. Sign in again to resume sync.');
          setDigestOptInState(await api.getDigestOptIn());
          setSyncState('synced');
          await loadDailyState(current);
        }
        unsubscribe = api.onSyncAuthChange(async (next) => {
          setSession(next);
          if (!next) {
            setDigestOptInState(false);
            resetDailyState();
            return;
          }
          setSyncState('syncing');
          if (!await api.syncNow()) { setSyncState('error'); return; }
          setDigestOptInState(await api.getDigestOptIn());
          setSyncState('synced');
          await loadDailyState(next);
        });
      })
      .catch(() => {});
    return () => unsubscribe();
  }, [accountSyncV2Enabled]);

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

  // Same read-time cleanup the compatibility island does — this page is
  // where charts get deleted, so orphaned pairs heal right here. Never
  // pruned against an EMPTY chart list (a corrupt or version-skewed
  // profile read also looks empty).
  useEffect(() => {
    if (!profileReady || profile.charts.length === 0) return;
    prunePairs(new Set(profile.charts.map((c) => c.id)));
  }, [profileReady, profile]);

  const sideRestorable = (side: SavedPair['a']) =>
    side.kind !== 'chart' || profile.charts.some((c) => c.id === side.chartId);
  const visiblePairs = pairs.filter((pair) => sideRestorable(pair.a) && sideRestorable(pair.b));

  function onRemovePair(pair: SavedPair, index: number) {
    if (!deletePair(pair.id)) {
      setPairAnnounce(t(locale, 'chartSaveError'));
      return;
    }
    setPairAnnounce(PF_PAIR_COPY[locale].pairRemoved);
    requestAnimationFrame(() => {
      const chips = document.querySelectorAll<HTMLElement>('.pf-pairs .syn__pair-restore');
      const next = chips[Math.min(index, chips.length - 1)]
        ?? document.querySelector<HTMLElement>('.pf-foot .btn, .pfd__empty .btn');
      next?.focus();
    });
  }

  const pairsBlock = visiblePairs.length > 0 && (
    <div class="syn__pairs pf-pairs">
      <span class="mono--label" id="pf-pairs-label">{PF_PAIR_COPY[locale].savedPairs}</span>
      <ul class="syn__pairs-list" role="list" aria-labelledby="pf-pairs-label">
        {visiblePairs.map((pair, index) => {
          const labels = pairSideLabels(pair, profile.charts);
          const spoken = new Intl.ListFormat(intlLocale(locale), {
            style: 'long', type: 'conjunction',
          }).format(labels);
          return (
            <li key={pair.id} class="syn__pair">
              <a
                class="syn__pair-restore"
                href={`${localizePath(locale, '/compatibility/')}?pair=${pair.id}`}
                aria-label={`${t(locale, 'compareCharts')}: ${spoken}`}
              >
                {labels.join(' × ')}
              </a>
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
  );

  async function onSendLink(e: Event) {
    e.preventDefault();
    if (!syncApi || !email.trim()) return;
    setSyncState('sending');
    setSyncMessage('');
    const result = await syncApi.sendMagicLink(email.trim());
    if (result.ok) {
      setSyncState('sent');
      setSyncMessage(t(locale, 'checkEmail'));
    } else {
      setSyncState('error');
      setSyncMessage(locale === 'ru' ? t(locale, 'syncFailed') : result.message);
    }
  }

  async function onSyncNow() {
    if (!syncApi) return;
    setSyncState('syncing');
    try {
      if (!await syncApi.syncNow()) throw new Error('Charts are saved in this browser. Sign in again to resume sync.');
      setSyncState('synced');
      if (session) await loadDailyState(session);
    } catch (err) {
      setSyncState('error');
      setSyncMessage(locale === 'ru'
        ? t(locale, 'syncFailed')
        : err instanceof Error ? err.message : t(locale, 'syncFailed'));
    }
  }

  async function onSignOut() {
    if (!syncApi) return;
    await syncApi.signOutOfSync();
    setSession(null);
    setDigestOptInState(false);
    setDigestMessage('');
    setDigestState('idle');
    setSyncState('idle');
    resetDailyState();
  }

  async function onDigestChange(e: Event) {
    if (!syncApi || !session) return;
    const checked = (e.currentTarget as HTMLInputElement).checked;
    const previous = digestOptIn;
    setDigestOptInState(checked);
    setDigestBusy(true);
    setDigestMessage('');
    setDigestState('idle');
    try {
      const saved = await syncApi.setDigestOptIn(checked);
      if (!saved) throw new Error(t(locale, 'digestFailed'));
      setDigestState('saved');
      setDigestMessage(t(locale, 'digestSaved'));
    } catch {
      setDigestOptInState(previous);
      setDigestState('error');
      setDigestMessage(t(locale, 'digestFailed'));
    } finally {
      setDigestBusy(false);
    }
  }

  const syncedChartIdSet = new Set(syncedChartIds);
  const dailyCharts = profile.charts.filter((chart) => syncedChartIdSet.has(chart.id));
  const effectiveDailyChartId = dailyCharts.some((chart) => chart.id === dailyChartId)
    ? dailyChartId
    : dailyCharts[0]?.id ?? '';
  const activeDailyChart = dailyPreference
    ? dailyCharts.find((chart) => chart.id === dailyPreference.chartId) ?? null
    : null;
  const dailyPaused = dailyPreference?.paused === true
    || Boolean(dailyPreference && !activeDailyChart);
  const dailyNeedsConfirmation = dailyPreference?.requiresConfirmation === true
    && !dailyPaused;
  const dailyTimezoneChoices = useMemo(() => browserTimezoneChoices([
    dailyTimezone,
    ...profile.charts.flatMap((chart) => chart.birth.place?.tz ? [chart.birth.place.tz] : []),
  ]), [dailyTimezone, profile]);

  async function saveDailyPreference(
    chartId: string,
    timezone: string,
    successMessage = '',
  ): Promise<boolean> {
    if (!session || !chartId) return false;
    setDailyBusy(true);
    setDailyError(false);
    setDailyMessage('');
    try {
      const result = await setDailyChartPreference(session.access_token, { chartId, timezone });
      rememberDailyChartSelection(chartId);
      setDailyChartId(chartId);
      setDailyTimezone(timezone);
      if (result.pending) {
        setDailyPreference(null);
        setDailyPending({ chartId, timezone, maskedEmail: maskDailyEmail(session.user.email) });
      } else {
        setDailyPending(null);
        await loadDailyState(session);
        setDailyMessage(successMessage);
      }
      return true;
    } catch {
      setDailyMessage(PF_DAILY_COPY.error);
      return false;
    } finally {
      setDailyBusy(false);
    }
  }

  async function onDailyEnroll(e: Event) {
    e.preventDefault();
    await saveDailyPreference(effectiveDailyChartId, dailyTimezone);
  }

  async function onDailyResend() {
    if (!dailyPending || !session) return;
    setDailyBusy(true);
    setDailyError(false);
    setDailyMessage('');
    try {
      await resendDailyChartPreference(session.access_token);
      const freshState = await loadDailyState(session);
      if (freshState === 'pending') setDailyMessage(PF_DAILY_COPY.pendingAgain);
    } catch {
      // A concurrent confirmation/cancellation is resolved by the fresh read;
      // otherwise retain the pending state and offer an honest retry.
      const freshState = await loadDailyState(session);
      if (freshState !== 'resolved') setDailyMessage(PF_DAILY_COPY.error);
    } finally {
      setDailyBusy(false);
    }
  }

  async function onDailyReconfirm() {
    if (!dailyPreference?.chartId || !dailyPreference.timezone) return;
    await saveDailyPreference(dailyPreference.chartId, dailyPreference.timezone);
  }

  async function onDailyCancel() {
    if (!session) return;
    setDailyBusy(true);
    setDailyError(false);
    setDailyMessage('');
    try {
      await deleteDailyChartPreference(session.access_token);
      rememberDailyChartSelection(null);
      setDailyPending(null);
      setDailyPreference(null);
    } catch {
      setDailyMessage(PF_DAILY_COPY.error);
    } finally {
      setDailyBusy(false);
    }
  }

  async function onDailyStop() {
    if (!session) return;
    setDailyBusy(true);
    setDailyError(false);
    setDailyMessage('');
    try {
      await deleteDailyChartPreference(session.access_token);
      rememberDailyChartSelection(null);
      setDailyPreference(null);
      setDailyPending(null);
      setDailyEditingChart(false);
      setDailyMessage(PF_DAILY_COPY.stopNote);
    } catch {
      setDailyMessage(PF_DAILY_COPY.error);
    } finally {
      setDailyBusy(false);
    }
  }

  async function onDailyChartChange(chart: SavedChart) {
    if (!dailyPreference || !dailyPreference.timezone || chart.id === dailyPreference.chartId) return;
    const saved = await saveDailyPreference(
      chart.id,
      dailyPreference.timezone,
      PF_DAILY_COPY.chartChanged(chart.name),
    );
    if (saved) setDailyEditingChart(false);
  }

  async function onDailyTimezoneChange(e: Event) {
    if (!dailyPreference || !dailyPreference.chartId || !activeDailyChart) return;
    const timezone = (e.currentTarget as HTMLSelectElement).value;
    await saveDailyPreference(
      dailyPreference.chartId,
      timezone,
      PF_DAILY_COPY.timezoneChanged(timezone),
    );
  }

  async function onDeleteChart(chart: SavedChart) {
    if (!confirm(tf(locale, 'removeChartConfirm', { name: chart.name }))) return;
    // Only a chart this device knows was selected for daily email adds a
    // network dependency to otherwise-local deletion. The marker survives a
    // feature kill switch or sign-out, but contains only the chart UUID.
    const lifecycleEnabled = dailyEmailEnabled
      || (typeof document !== 'undefined'
        && document.documentElement.hasAttribute('data-daily-email-lifecycle'));
    const requiresDailyPauseCheck = (lifecycleEnabled && Boolean(session))
      || rememberedDailyChartSelection() === chart.id
      || dailyPreference?.chartId === chart.id
      || dailyPending?.chartId === chart.id;
    if (requiresDailyPauseCheck && !session) {
      setSyncState('error');
      setSyncMessage(PF_DAILY_DELETE_BLOCKED[locale]);
      return;
    }
    if (requiresDailyPauseCheck) {
      setDailyBusy(true);
      setDailyError(false);
      setDailyMessage('');
      try {
        const result = await pauseDailyChartPreferenceForDeletion(
          session!.access_token,
          chart.id,
        );
        rememberDailyChartSelection(result.selectedChartId);
        if (result.outcome === 'paused') {
          setDailyPreference((current) => current ? { ...current, chartId: null, paused: true } : current);
        } else if (result.outcome === 'cancelled' || dailyPending?.chartId === chart.id) {
          setDailyPending(null);
        }
      } catch {
        setDailyError(true);
        setDailyMessage(locale === 'ru'
          ? t(locale, 'syncFailed')
          : "Couldn't pause the daily brief, so this synced chart was not deleted. Please try again online.");
        setSyncState('error');
        setSyncMessage(t(locale, 'syncFailed'));
        setDailyBusy(false);
        return;
      }
      setDailyBusy(false);
    }
    deleteChart(chart.id);
  }

  const dailyChartChooser = dailyCharts.length > 0 && (
    <>
      <fieldset class="pf-daily__charts">
        <legend>{PF_DAILY_COPY.chartLegend}</legend>
        {dailyCharts.map((chart) => (
          <label class="pf-daily__chart" key={chart.id}>
            <input
              type="radio"
              name="chartId"
              value={chart.id}
              checked={effectiveDailyChartId === chart.id}
              onChange={() => setDailyChartId(chart.id)}
              disabled={dailyBusy}
              required
            />
            <span>
              <strong>{chart.name}</strong>
              <small>{dailyChartIdentity(chart)}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <label class="pf-daily__timezone" for="pf-daily-timezone">
        <span>{PF_DAILY_COPY.timezoneLabel}</span>
        <select
          id="pf-daily-timezone"
          name="timezone"
          value={dailyTimezone}
          onChange={(e) => setDailyTimezone((e.currentTarget as HTMLSelectElement).value)}
          disabled={dailyBusy}
          required
        >
          {dailyTimezoneChoices.map((timezone) => (
            <option value={timezone} key={timezone}>
              {timezone === 'UTC' ? PF_DAILY_COPY.timezoneUtc : timezone}
            </option>
          ))}
        </select>
      </label>
    </>
  );

  const dailyPanel = showDailyEmail && session && (
    <section
      class="pf-daily"
      id="daily-brief"
      aria-labelledby="pf-daily-title"
      aria-busy={dailyLoading || dailyBusy}
    >
      <h2 id="pf-daily-title">{PF_DAILY_COPY.title}</h2>
      <p class="pf-daily__dek">{PF_DAILY_COPY.body}</p>

      {!dailyLoading && !dailyError && dailyPending && (
        <div class="pf-daily__state">
          <h3>{PF_DAILY_COPY.pendingTitle}</h3>
          <p
            class="pf-daily__truncate"
            title={dailyPending.maskedEmail ?? undefined}
            role="status"
            aria-live="polite"
          >
            {dailyPending.maskedEmail
              ? PF_DAILY_COPY.pendingBody(dailyPending.maskedEmail)
              : PF_DAILY_COPY.pendingAddressChanged}
          </p>
          <div class="pf-daily__actions">
            <button class="btn btn--ghost" type="button" onClick={onDailyResend} disabled={dailyBusy}>
              {PF_DAILY_COPY.pendingResend}
            </button>
            <button class="pf-daily__text-action" type="button" onClick={onDailyCancel} disabled={dailyBusy}>
              {PF_DAILY_COPY.pendingCancel}
            </button>
          </div>
        </div>
      )}

      {!dailyLoading && !dailyError && !dailyPending && dailyPreference && dailyPaused && (
        <div class="pf-daily__state">
          <p class="pf-daily__banner" role="status" aria-live="polite">{PF_DAILY_COPY.pausedBanner}</p>
          {dailyCharts.length > 0 ? (
            <form method="post" action="/api/email/chart-preference" onSubmit={onDailyEnroll}>
              {dailyChartChooser}
              <p class="pf-daily__consent">{PF_DAILY_COPY.consentNote}</p>
              <button class="btn btn--primary" type="submit" disabled={dailyBusy || !effectiveDailyChartId}>
                <span>{PF_DAILY_COPY.enroll}</span><span class="orb">↗</span>
              </button>
            </form>
          ) : (
            <p>{PF_DAILY_COPY.noChartsBeforeLink} <a href="#profile-sync">{PF_DAILY_COPY.syncLink}</a></p>
          )}
        </div>
      )}

      {!dailyLoading && !dailyError && !dailyPending && dailyPreference && dailyNeedsConfirmation && (
        <div class="pf-daily__state">
          <h3>{PF_DAILY_COPY.reconfirmTitle}</h3>
          <p role="status" aria-live="polite">{PF_DAILY_COPY.reconfirmBody}</p>
          <div class="pf-daily__actions">
            <button
              class="btn btn--primary"
              type="button"
              onClick={() => void onDailyReconfirm()}
              disabled={dailyBusy}
            >
              {PF_DAILY_COPY.reconfirmAction}
            </button>
          </div>
        </div>
      )}

      {!dailyLoading && !dailyError && !dailyPending && dailyPreference && !dailyPaused && !dailyNeedsConfirmation && activeDailyChart && (
        <div class="pf-daily__state">
          <p class="pf-daily__active pf-daily__truncate" title={activeDailyChart.name}>
            {PF_DAILY_COPY.activeLine(activeDailyChart.name, dailyPreference.timezone ?? 'UTC')}
          </p>
          <div class="pf-daily__actions">
            <button
              class="btn btn--ghost"
              type="button"
              aria-expanded={dailyEditingChart}
              aria-controls="pf-daily-chart-change"
              onClick={() => setDailyEditingChart((open) => !open)}
              disabled={dailyBusy}
            >
              {PF_DAILY_COPY.changeChart}
            </button>
          </div>
          {dailyEditingChart && (
            <fieldset class="pf-daily__charts" id="pf-daily-chart-change">
              <legend>{PF_DAILY_COPY.chartLegend}</legend>
              {dailyCharts.map((chart) => (
                <label class="pf-daily__chart" key={chart.id}>
                  <input
                    type="radio"
                    name="activeChartId"
                    value={chart.id}
                    checked={dailyPreference.chartId === chart.id}
                    onChange={() => void onDailyChartChange(chart)}
                    disabled={dailyBusy}
                  />
                  <span>
                    <strong>{chart.name}</strong>
                    <small>{dailyChartIdentity(chart)}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <label class="pf-daily__timezone" for="pf-daily-active-timezone">
            <span>{PF_DAILY_COPY.timezoneLabel}</span>
            <select
              id="pf-daily-active-timezone"
              value={dailyPreference.timezone ?? 'UTC'}
              onChange={onDailyTimezoneChange}
              disabled={dailyBusy}
            >
              {dailyTimezoneChoices.map((timezone) => (
                <option value={timezone} key={timezone}>
                  {timezone === 'UTC' ? PF_DAILY_COPY.timezoneUtc : timezone}
                </option>
              ))}
            </select>
          </label>
          <button class="btn btn--ghost pf-daily__stop" type="button" onClick={onDailyStop} disabled={dailyBusy}>
            {PF_DAILY_COPY.stop}
          </button>
          <p class="pf-daily__consent">{PF_DAILY_COPY.stopNote}</p>
        </div>
      )}

      {!dailyLoading && !dailyError && !dailyPending && !dailyPreference && (
        <div class="pf-daily__state">
          {dailyCharts.length === 0 ? (
            <p>{PF_DAILY_COPY.noChartsBeforeLink} <a href="#profile-sync">{PF_DAILY_COPY.syncLink}</a></p>
          ) : (
            <form method="post" action="/api/email/chart-preference" onSubmit={onDailyEnroll}>
              {dailyChartChooser}
              <p class="pf-daily__consent">{PF_DAILY_COPY.consentNote}</p>
              <button class="btn btn--primary" type="submit" disabled={dailyBusy || !effectiveDailyChartId}>
                <span>{PF_DAILY_COPY.enroll}</span><span class="orb">↗</span>
              </button>
            </form>
          )}
        </div>
      )}

      {dailyMessage && (
        <p
          class="pf-sync__message pf-daily__message"
          role="status"
          aria-live="polite"
        >
          {dailyMessage}
        </p>
      )}
      <p class="pf-daily__weekly-note">{PF_DAILY_COPY.vsWeekly}</p>
    </section>
  );

  const syncPanel = HAS_PROFILE_SYNC && !accountSyncV2Enabled && (
    <aside class="pf-sync shell" id="profile-sync">
      <div class="core pf-sync__core">
        <div>
          <span class="mono--label pf-sync__label">{PF_EMAIL_COPY[locale].syncLabel}</span>
          <strong>{session ? t(locale, 'syncOn') : t(locale, 'keepEveryDevice')}</strong>
          <p>
            {session
              ? `${session.user.email ? tf(locale, 'signedInAs', { email: session.user.email }) : t(locale, 'signedIn')}. ${t(locale, 'syncCopyOn')}`
              : t(locale, 'syncCopyOff')}
          </p>
          {syncMessage && <p class={`pf-sync__message pf-sync__message--${syncState}`}>{syncMessage}</p>}
        </div>
        {session ? (
          <div class="pf-sync__actions">
            <button class="pf-chart__action" type="button" onClick={onSyncNow} disabled={syncState === 'syncing'}>
              {syncState === 'syncing' ? t(locale, 'syncing') : syncState === 'synced' ? t(locale, 'synced') : t(locale, 'syncNow')}
            </button>
            <button class="pf-chart__action" type="button" onClick={onSignOut}>{t(locale, 'signOut')}</button>
          </div>
        ) : (
          <form class="pf-sync__form" onSubmit={onSendLink}>
            <input
              class="field__input"
              type="email"
              inputMode="email"
              autocomplete="email"
              placeholder="you@example.com"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              aria-label={t(locale, 'emailSyncAria')}
              required
            />
            <button class="btn btn--primary" type="submit" disabled={!syncApi || syncState === 'sending'}>
              <span>{syncState === 'sending' ? t(locale, 'sending') : t(locale, 'sendSignIn')}</span><span class="orb">↗</span>
            </button>
          </form>
        )}
        {dailyPanel}
        {/* Keep the return fragment present before the asynchronous session resolves. */}
        <div id="weekly-digest">
          {session && locale !== 'ru' && weeklyDigestSignupEnabled() && (
            <div class="pf-digest-panel">
              <span class="mono--label">{PF_EMAIL_COPY[locale].digestLabel}</span>
              <label class="pf-digest">
                <input
                  type="checkbox"
                  checked={digestOptIn}
                  disabled={digestBusy}
                  onChange={onDigestChange}
                  aria-label={t(locale, 'weeklyDigestAria')}
                />
                <span>
                  <strong>{PF_EMAIL_COPY[locale].digestTitle}</strong>
                  <small>{PF_EMAIL_COPY[locale].digestCopy}</small>
                </span>
              </label>
              {digestMessage && <p class={`pf-sync__message pf-sync__message--${digestState}`}>{digestMessage}</p>}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
  const ProfilePushOptIn = pushModule?.default;
  const pushPanel = ProfilePushOptIn && locale !== 'ru' && (
    <ProfilePushOptIn locale={locale} context="profile" />
  );

  if (profile.charts.length === 0) {
    return (
      <div class="pf" id="saved-charts" tabIndex={-1}>
        <p class="sr-only" role="status">{pairAnnounce}</p>
        {/* Inline-side pairs need no saved charts — still show them. */}
        {pairsBlock}
        {syncPanel}
        {pushPanel}
      </div>
    );
  }

  return (
    <div class="pf" id="saved-charts" tabIndex={-1}>
      <p class="sr-only" role="status">{pairAnnounce}</p>
      <p class="pf-count mono">
        {PF_BOOK_COPY[locale].count(profile.charts.length)}
      </p>

      <div class="pf-list">
        {profile.charts.map((chart) => (
          <article class="pf-chart shell" key={chart.id}>
            <div class="core pf-chart__core">
              <header class="pf-chart__head">
                {editing === chart.id ? (
                  <form
                    class="pf-chart__rename"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draft.trim()) renameChart(chart.id, draft.trim());
                      setEditing(null);
                    }}
                  >
                    <input
                      class="field__input"
                      value={draft}
                      onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
                      aria-label={t(locale, 'chartName')}
                    />
                    <button class="pf-chart__action" type="submit">{t(locale, 'save')}</button>
                  </form>
                ) : (
                  <h2>{chart.name}</h2>
                )}
                <div class="pf-chart__actions">
                  {chart.birth.place && (
                    <a
                      class="pf-chart__action"
                      href={`${localizePath(locale, '/birth-chart/')}#${profileChartHandoffFragment(chart.id) ?? ''}`}
                    >
                      {t(locale, 'openChart')}
                    </a>
                  )}
                  <button
                    class="pf-chart__action"
                    type="button"
                    onClick={() => { setEditing(chart.id); setDraft(chart.name); }}
                  >
                    {t(locale, 'rename')}
                  </button>
                  <button
                    class="pf-chart__action pf-chart__action--danger"
                    type="button"
                    onClick={() => void onDeleteChart(chart)}
                  >
                    {t(locale, 'remove')}
                  </button>
                </div>
              </header>

              <ChipRow chart={chart} locale={locale} />

              <EvidenceDisclosure label={PF_BOOK_COPY[locale].details} className="pf-chart__details">
                <p class="pf-chart__birth mono">
                  {formatDate(locale, `${chart.birth.date}T12:00:00Z`, {
                    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
                  })}
                  {chart.birth.time ? ` · ${chart.birth.time}` : ` · ${t(locale, 'timeUnknown')}`}
                  {chart.birth.place ? ` · ${chart.birth.place.name}, ${chart.birth.place.country}` : ''}
                </p>
              </EvidenceDisclosure>
            </div>
          </article>
        ))}
      </div>

      <p class="pf-privacy">{PF_BOOK_COPY[locale].privacy}</p>

      {pairsBlock}

      {profile.charts.length >= 2 && (
        <div class="pf-next shell tinted" style="--sign:var(--sign-libra)">
          <div class="core tinted pf-next__core">
            <strong>
              {tf(locale, 'compareSavedHeading', {
                a: handle(profile.charts[0].name), b: handle(profile.charts[1].name),
              })}
            </strong>
            <p>
              {t(locale, 'compareSavedPitch')}
            </p>
            <a
              class="btn btn--primary pf-next__cta"
              href={`${localizePath(locale, '/compatibility/')}?a=${profile.charts[0].id}&b=${profile.charts[1].id}`}
            >
              <span>{t(locale, 'compareThese')}</span><span class="orb">↗</span>
            </a>
          </div>
        </div>
      )}

      <div class="pf-foot">
        <a class="btn btn--ghost" href={locale === 'en' ? '/birth-chart/someone-else/' : localizePath(locale, '/birth-chart/')}><span>{PF_BOOK_COPY[locale].add}</span><span class="orb">+</span></a>
      </div>

      {syncPanel}
      {pushPanel}
    </div>
  );
}
