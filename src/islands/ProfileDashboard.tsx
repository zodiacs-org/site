/**
 * The daily layer of /profile/: today's sky pressed against one saved
 * chart, plus the chart's next twelve months. Transits are pure
 * arithmetic over committed data (no ephemeris); the year scan — solar
 * return, Jupiter/Saturn hits on Sun/Moon/ASC, Saturn-return seasons —
 * loads the engine once per chart and caches in localStorage keyed by
 * chart id + calculation inputs + engine version, refreshed every two weeks.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useEngine } from '../lib/hooks/useEngine';
import { useProfile } from '../lib/hooks/useProfile';
import { todayReading } from '../lib/profile/today-reading';
import { explicitSelfChart } from '../lib/profile/read-store';
import { livingChartCaptureEnabled } from '../lib/living-chart/feature-flags';
import { transitLine } from '../lib/transits';
import PlanetGlyph from '../components/PlanetGlyph';
import PanelArt from '../components/PanelArt';
import EvidenceDisclosure from './EvidenceDisclosure';
import CalculationReload, { calculationError } from './CalculationReload';
import { loadModule } from '../lib/module-load';
import { type EclipseRecord } from '../lib/upcoming';
import {
  YEAR_AHEAD_CACHE_KEY,
  aspectEvents,
  assembleYearAhead,
  eclipseEvents,
  ingressEvents,
  saturnSeasonEvents,
  solarReturnEvents,
  yearCacheFresh,
  type IngressWindow,
  type YearScanCache,
} from '../lib/year-ahead';
import { signBySlug, signForLongitude } from '../lib/signs';
import { localizePath, normalizeCatalogLocale, t, type CatalogLocale as Locale } from '../lib/i18n';
import { aspectLabel, moonPhaseLabel, planetLabel } from '../lib/i18n/astrology';
import daily from '../data/daily.json';
import { profileAccessAllowed } from '../lib/account-v2/profile-access-reader';

/** Each transiting body's current-sign hue, for the leading receipt glyph. */
const SKY_HUE: Record<string, string> = Object.fromEntries(
  daily.bodies.map((b) => [b.body, signBySlug(b.sign).hue]),
);
import eclipsesData from '../data/eclipses.json';
import ingressesData from '../data/ingresses.json';

interface Props { locale?: Locale }

const ECLIPSES = (eclipsesData as { eclipses: EclipseRecord[] }).eclipses;
const INGRESSES = (ingressesData as { windows: IngressWindow[] }).windows;
const YEAR_MS = 366 * 86400_000;

type ChartYearCache = YearScanCache & { chartKey: string };
type YearCacheFile = Record<string, ChartYearCache>;
type YearState = { key: string; entry: ChartYearCache | null; busy: boolean; error: string | null };

const readYearCache = (): YearCacheFile => {
  if (!profileAccessAllowed()) return {};
  try {
    const file: unknown = JSON.parse(localStorage.getItem(YEAR_AHEAD_CACHE_KEY) ?? '{}');
    return file && typeof file === 'object' && !Array.isArray(file) ? file as YearCacheFile : {};
  } catch {
    return {};
  }
};

export default function ProfileDashboard({ locale: rawLocale = 'en' }: Props) {
  const locale = normalizeCatalogLocale(rawLocale);
  const loadEngine = useEngine();
  const { profile, ready } = useProfile();
  const charts = useMemo(
    () => [...profile.charts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [profile.charts],
  );
  const [sel, setSel] = useState<string | null>(null);
  const [yearState, setYearState] = useState<YearState | null>(null);
  const [yearAttempt, setYearAttempt] = useState(0);

  const personalChart = livingChartCaptureEnabled() ? explicitSelfChart(charts) : null;
  const chart = charts.find((c) => c.id === sel) ?? personalChart ?? charts[0] ?? null;
  // A saved chart can be recomputed without changing its id or engine version.
  // Hide the previous scan immediately, before this render's effect runs.
  const chartKey = chart ? JSON.stringify([chart.id, chart.birth.timeKnown, chart.summary]) : null;
  const requestKey = JSON.stringify([chartKey, locale, yearAttempt]);
  const currentRequest = useRef(requestKey);
  currentRequest.current = requestKey;
  const currentYear = yearState?.key === requestKey ? yearState : null;
  const year = currentYear?.entry ?? null;
  const yearBusy = currentYear?.busy ?? Boolean(chart && profileAccessAllowed());
  const yearError = currentYear?.error ?? null;
  const natalPointLabel = (body: string) => locale === 'ru'
    ? `${body === 'Moon' || body === 'Venus' ? 'натальная' : 'натальный'} ${planetLabel(locale, body)}`
    : `${t(locale, 'natal')} ${planetLabel(locale, body)}`;

  // Year scan: cache first; compute (lazy engine) only on a miss or after
  // two weeks, so repeat visits stay ephemeris-free.
  useEffect(() => {
    setYearState(null);
    if (!chart || !chartKey || !profileAccessAllowed()) return;
    let cancelled = false;
    const active = () => !cancelled && currentRequest.current === requestKey && profileAccessAllowed();
    // Revocation permanently cancels this request. A quick revoke/restore can
    // be batched into one render with the same chart, so explicitly start a new
    // attempt on restoration instead of leaving the cancelled attempt busy.
    let restartQueued = false;
    const onProfileAccess = () => {
      if (!profileAccessAllowed()) cancelled = true;
      else if (cancelled && !restartQueued && currentRequest.current === requestKey) {
        restartQueued = true;
        setYearAttempt((attempt) => attempt + 1);
      }
    };
    window.addEventListener('zodiacs:profile-access', onProfileAccess);
    const cleanup = () => {
      cancelled = true;
      window.removeEventListener('zodiacs:profile-access', onProfileAccess);
    };
    const cached = readYearCache()[chart.id];
    if (cached?.chartKey === chartKey && yearCacheFresh(cached, chart.summary.engineVersion, new Date())) {
      if (active()) setYearState({ key: requestKey, entry: cached, busy: false, error: null });
      return cleanup;
    }
    if (!active()) return cleanup;
    setYearState({ key: requestKey, entry: null, busy: true, error: null });
    void (async () => {
      try {
        const bodies = chart.summary.bodies;
        const sunLon = bodies.find((b) => b.body === 'Sun')?.lon;
        const moonLon = bodies.find((b) => b.body === 'Moon')?.lon ?? null;
        const ascLon = chart.birth.timeKnown ? chart.summary.angles?.asc ?? null : null;
        const birthUtc = new Date(chart.summary.utcISO);
        if (sunLon == null || !Number.isFinite(sunLon) ||
          (moonLon != null && !Number.isFinite(moonLon)) ||
          (ascLon != null && !Number.isFinite(ascLon)) || !Number.isFinite(birthUtc.getTime())) {
          throw new RangeError('Saved chart is missing year-scan inputs');
        }
        const { yearScan } = await loadModule(() => import('../lib/engine/year-scan'));
        if (!active()) return;
        const from = new Date();
        const to = new Date(from.getTime() + YEAR_MS);
        const scan = yearScan({ sunLon, moonLon, ascLon, birthUtc }, from, to);
        const entry: ChartYearCache = {
          chartKey,
          engineVersion: chart.summary.engineVersion,
          computedAt: from.toISOString(),
          from: from.toISOString(),
          to: to.toISOString(),
          scan,
        };
        if (!active()) return;
        try {
          const file = readYearCache();
          file[chart.id] = entry;
          if (!active()) return;
          localStorage.setItem(YEAR_AHEAD_CACHE_KEY, JSON.stringify(file));
        } catch { /* cache is best-effort */ }
        if (!active()) return;
        setYearState({ key: requestKey, entry, busy: false, error: null });
      } catch (cause) {
        if (active()) setYearState({
          key: requestKey, entry: null, busy: false,
          error: calculationError(cause, locale, t(locale, 'pfdYearError')),
        });
      } finally {
        if (active()) setYearState((state) => state?.key === requestKey ? { ...state, busy: false } : state);
      }
    })();
    return cleanup;
  }, [requestKey]);

  // Stale saved summaries are rewritten once; the profile event from that
  // write re-reads today and the year ahead from the corrected chart.
  useEffect(() => {
    void import('../lib/profile/refresh')
      .then(({ refreshSavedChartSummaries }) => refreshSavedChartSummaries(loadEngine))
      .catch(() => {});
  }, []);

  const today = useMemo(() => (chart ? todayReading(chart) : null), [chart]);

  // The merged twelve-month timeline: engine-scanned events from the
  // cache, plus ingresses and eclipse hits from committed data.
  const timeline = useMemo(() => {
    if (!chart) return [];
    const now = new Date();
    const to = new Date(now.getTime() + YEAR_MS);
    const natal = chart.summary.bodies.map(({ body, lon }) => ({ body, lon }));
    const sunLon = natal.find((n) => n.body === 'Sun')?.lon;
    const sunSign = chart.birth.timeKnown === true && sunLon != null ? signForLongitude(sunLon).slug : '';
    const asc = chart.birth.timeKnown ? chart.summary.angles?.asc : null;
    const risingSign = asc != null ? signForLongitude(asc).slug : null;
    const parts = [
      ingressEvents(INGRESSES, sunSign, risingSign, now, to),
      eclipseEvents(ECLIPSES, natal, now, to),
    ];
    if (year) {
      parts.push(
        solarReturnEvents(year.scan),
        aspectEvents(year.scan),
        saturnSeasonEvents(year.scan.saturnSeasons, now, to),
      );
    }
    // Keep windows still running; drop events fully in the past.
    return assembleYearAhead(parts)
      .filter((e) => new Date(e.endAt ?? e.at) >= now)
      .slice(0, 8);
  }, [chart, year]);

  if (!chart) {
    return (
      // Until this browser's storage is read, the panel says so: a browser
      // that keeps charts holds its room hidden (ProfilePrepaint) rather
      // than flash the no-chart invitation before its Today panel.
      <section class="shell pfd" aria-label={t(locale, 'pfdEmptyTitle')} data-pf-pending={ready ? undefined : ''}>
        <div class="core pfd__core pfd__empty">
          <PanelArt name="profile-keepsake" class="pf-art--keepsake" />
          <h2>{t(locale, 'pfdEmptyTitle')}</h2>
          <p>{t(locale, 'pfdEmptyBody')}</p>
          <a class="btn btn--primary" href={localizePath(locale, '/birth-chart/')}>
            <span>{t(locale, 'getBirthChart')}</span><span class="orb">↗</span>
          </a>
        </div>
      </section>
    );
  }

  return (
    <section class="pfd" aria-label={t(locale, 'pfdToday')}>
      <a class="btn btn--ghost pf-saved-shortcut" href="#saved-charts">{t(locale, 'navSavedCharts')} <span aria-hidden="true">↓</span></a>
      <div class="shell pfd__today">
        <div class="core pfd__core">
          <PanelArt name="today-orrery" class="pf-art--today" />
          <div class="pfd__head">
            <h2>{t(locale, 'pfdToday')}</h2>
            <span class="mono pfd__stamp">
              {daily.date} · {moonPhaseLabel(locale, daily.moon.phase)}
            </span>
          </div>
          {chart.birth.timeKnown !== true && <p class="pfd__quiet">{t(locale, 'unknownTimeSunReference')}</p>}
          {charts.length > 1 && (
            <label class="pfd__pick">
              <span class="mono">{t(locale, 'pfdChartPick')}</span>
              <select
                class="field__input"
                value={chart.id}
                onChange={(e) => setSel((e.target as HTMLSelectElement).value)}
              >
                {charts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
          {locale !== 'ru' && today && today.houseLines.length > 0 && (
            <ul class="pfd__lines">
              {today.houseLines.map((l) => (
                <li key={l.receipt}>
                  <p>{l.text}</p>
                </li>
              ))}
            </ul>
          )}
          {locale === 'ru' ? (
            <p class="pfd__quiet">Ежедневные выпуски пока выходят по-английски. Расчётные данные ниже — для любого языка.</p>
          ) : today && today.hits.length > 0 ? (
            <ul class="pfd__lines">
              {today.hits.map((a) => (
                <li key={`${a.a}-${a.b}-${a.type}`}>
                  <p>{transitLine(a.a, a.type, a.b)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p class="pfd__quiet">{t(locale, 'pfdQuietSky')}</p>
          )}
          {today && (today.houseLines.length > 0 || today.hits.length > 0) && (
            <EvidenceDisclosure label={t(locale, 'whyThisReading')}>
              <ul class="evidence-disclosure__list">
                {locale !== 'ru' && today.houseLines.map((l) => (
                  <li class="mono evidence-disclosure__receipt" key={l.receipt}>
                    {l.body && <PlanetGlyph body={l.body} hue={l.hue} size={13} class="rcpt-glyph" />}
                    <span>{l.receipt}</span>
                  </li>
                ))}
                {today.hits.map((a) => (
                  <li class="mono evidence-disclosure__receipt" key={`${a.a}-${a.b}-${a.type}`}>
                    <PlanetGlyph body={a.a} hue={SKY_HUE[a.a]} size={13} class="rcpt-glyph" />
                    <span>{planetLabel(locale, a.a)} {aspectLabel(locale, a.type)} {natalPointLabel(a.b)} · {t(locale, 'orb')} {a.orb.toFixed(1)}°</span>
                  </li>
                ))}
              </ul>
            </EvidenceDisclosure>
          )}
          <a class="pfd__more" href={localizePath(locale, '/transits/')}>{t(locale, 'allTransits')} →</a>
        </div>
      </div>

      <div class="shell pfd__year">
        <div class="core pfd__core">
          <div class="pfd__head">
            <h2>{t(locale, 'pfdYearAhead')}</h2>
            <span class="mono pfd__stamp">{chart.name}</span>
          </div>
          {chart.birth.timeKnown !== true && <p class="pfd__quiet">{t(locale, 'unknownTimeSunReference')}</p>}
          {yearError && (
            <div>
              <p class="field__error" role="alert">{yearError}</p>
              <button class="btn btn--glass" type="button" onClick={() => setYearAttempt((attempt) => attempt + 1)}>
                {t(locale, 'calculationRetry')}
              </button>
              <CalculationReload error={yearError} locale={locale} />
            </div>
          )}
          {yearBusy && <p class="pfd__quiet" role="status">{t(locale, 'pfdYearBusy')}</p>}
          {locale === 'ru' ? (
            <p class="pfd__quiet">Персональное чтение года впереди пока доступно по-английски. Расчёт выполняется на вашем устройстве.</p>
          ) : timeline.length > 0 ? (
            <ul class="pfd__lines">
              {timeline.map((ev) => (
                <li key={`${ev.kind}-${ev.at}-${ev.receipt}`}>
                  <p>{ev.line}</p>
                </li>
              ))}
            </ul>
          ) : !yearBusy && !yearError ? (
            <p class="pfd__quiet">{t(locale, 'pfdQuietAhead')}</p>
          ) : null}
          {locale !== 'ru' && timeline.length > 0 && (
            <EvidenceDisclosure label={t(locale, 'whyThisReading')}>
              <p>{t(locale, 'pfdYearNote')}</p>
              <ul class="evidence-disclosure__list">
                {timeline.map((ev) => (
                  <li class="mono evidence-disclosure__receipt" key={`${ev.kind}-${ev.at}-${ev.receipt}`}>
                    {ev.body && <PlanetGlyph body={ev.body} size={13} class="rcpt-glyph" />}
                    <span>{ev.receipt}</span>
                  </li>
                ))}
              </ul>
            </EvidenceDisclosure>
          )}
        </div>
      </div>
    </section>
  );
}
