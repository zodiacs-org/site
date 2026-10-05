import { CheckOurMath } from './ChartTrust';
/**
 * Due-date sky reader: what a birth around a given date would carry.
 * Honest by construction — the Sun is nearly certain (with cusp caveats
 * computed, not hand-waved), the Moon is listed as the week's spans
 * because it changes signs every two or three days, and the rising sign
 * is named as unknowable before the birth minute. Engine loads lazily
 * on first compute (bundle rule: only full.ts touches the ephemeris).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { signForLongitude, signName, signPrepositional, type Sign } from '../lib/signs';
import { birthdaySlug } from '../lib/birthdays';
import { localizePath, normalizeCatalogLocale, t, type CatalogLocale as Locale } from '../lib/i18n';
import { intlLocale } from '../lib/i18n/dates';
import { planetLabel } from '../lib/i18n/astrology';
import { useEngine } from '../lib/hooks/useEngine';
import CalculationReload, { calculationError } from './CalculationReload';
import sky from '../data/sky.json';

interface Props { locale?: Locale }

interface MoonSpan { fromISO: string; toISO: string; sign: Sign }

interface Reading {
  dueISO: string;
  computedUtc: Date;
  sun: { kind: 'single'; sign: Sign; nearEdge: Sign | null } | { kind: 'split'; a: Sign; b: Sign };
  moonSpans: MoonSpan[];
  retro: string[];
  birthdayHref: string;
}

const DAY = 86400_000;

function fmtDay(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(intlLocale(locale), {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

export default function BabyZodiac({ locale: rawLocale = 'en' }: Props) {
  const locale = normalizeCatalogLocale(rawLocale);
  const loadEngine = useEngine();
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const focusAfterComputeRef = useRef(false);

  const compute = async (e: Event) => {
    e.preventDefault();
    focusAfterComputeRef.current = true;
    setError(null);
    setReading(null);
    if (!due) {
      setError(t(locale, 'babyNeedDate'));
      return;
    }
    const noon = new Date(`${due}T12:00:00Z`);
    if (Number.isNaN(noon.getTime())) {
      setError(t(locale, 'babyNeedDate'));
      return;
    }
    setBusy(true);
    try {
      const { bodyLongitude } = await loadEngine();

      // Sun: split-day check via the day's two ends, then a near-edge note.
      const dayStart = new Date(`${due}T00:00:00Z`);
      const s0 = signForLongitude(bodyLongitude('Sun', dayStart));
      const s1 = signForLongitude(bodyLongitude('Sun', new Date(dayStart.getTime() + DAY - 1000)));
      let sun: Reading['sun'];
      if (s0.slug !== s1.slug) {
        sun = { kind: 'split', a: s0, b: s1 };
      } else {
        const lon = bodyLongitude('Sun', noon);
        const inSign = ((lon % 360) + 360) % 360 % 30;
        // Within ~a degree of an edge, one day's drift crosses the line.
        const nearEdge =
          inSign < 1 ? signForLongitude(lon - 2) : inSign > 29 ? signForLongitude(lon + 2) : null;
        sun = { kind: 'single', sign: s0, nearEdge };
      }

      // Moon: noon sign for due-3 … due+3, compressed into spans.
      const spans: MoonSpan[] = [];
      for (let d = -3; d <= 3; d += 1) {
        const at = new Date(noon.getTime() + d * DAY);
        const sign = signForLongitude(bodyLongitude('Moon', at));
        const last = spans[spans.length - 1];
        if (last && last.sign.slug === sign.slug) {
          last.toISO = at.toISOString();
        } else {
          spans.push({ fromISO: at.toISOString(), toISO: at.toISOString(), sign });
        }
      }

      // Retrogrades active on the due date, from the committed windows.
      const retro = (sky.retrogrades as { planet: string; from: string; to: string | null }[])
        .filter((w) => new Date(w.from) <= noon && (w.to === null || new Date(w.to) >= noon))
        .map((w) => w.planet);

      const m = noon.getUTCMonth() + 1;
      const day = noon.getUTCDate();
      setReading({
        dueISO: noon.toISOString(),
        computedUtc: noon,
        sun,
        moonSpans: spans,
        retro,
        birthdayHref: `/birthday/${birthdaySlug(m, day)}/`,
      });
    } catch (cause) {
      setError(calculationError(cause, locale, t(locale, 'babyError')));
    }
    setBusy(false);
  };

  useEffect(() => {
    if (busy || !focusAfterComputeRef.current) return;
    if (error) {
      errorRef.current?.focus();
      focusAfterComputeRef.current = false;
      return;
    }
    if (reading) {
      resultHeadingRef.current?.focus();
      focusAfterComputeRef.current = false;
    }
  }, [busy, error, reading]);

  return (
    <div class="calc">
      <form class="calc__form" onSubmit={compute} aria-busy={busy}>
        <div class="calc__grid">
          <label class="field">
            <span class="field__label mono">{t(locale, 'babyDueDate')}</span>
            <input
              class="field__input"
              type="date"
              value={due}
              min="1990-01-01"
              max="2028-12-31"
              onInput={(e) => setDue((e.target as HTMLInputElement).value)}
              onFocus={() => { void loadEngine(); }}
              required
            />
          </label>
        </div>
        <div class="calc__actions">
          <button class="btn btn--primary" type="submit" disabled={busy}>
            <span>{busy ? t(locale, 'computing') : t(locale, 'babyCompute')}</span>
            <span class="orb">{busy ? '…' : '→'}</span>
          </button>
        </div>
        {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
        <CalculationReload error={error} locale={locale} />
      </form>

      {reading && (
        <div class="calc__result">
          <h2 class="sr-only" tabIndex={-1} ref={resultHeadingRef}>{t(locale, 'babyCompute')}</h2>
          <p class="chart-trust__opening" data-result-opening>{t(locale, 'trustDueIntro')}</p>
          <CheckOurMath utc={reading.computedUtc} basis="sky-reference" locale={locale} />
          <div class="baby-block">
            <h3>{t(locale, 'babySunHead')}</h3>
            {reading.sun.kind === 'single' ? (
              <>
                <p>
                  {t(locale, 'babySunSingle')} <strong>{signName(reading.sun.sign, locale)}</strong>.
                  {reading.sun.nearEdge && (
                    <> {t(locale, 'babySunNearEdge')} {signName(reading.sun.nearEdge, locale)} {t(locale, 'babySunNearEdgeTail')}</>
                  )}
                </p>
                <span class="mono baby-receipt">
                  {fmtDay(reading.dueISO, locale)} · {t(locale, 'babyNoonNote')}
                </span>
              </>
            ) : (
              <>
                <p>
                  {t(locale, 'babySunSplitA')} <strong>{signName(reading.sun.a, locale)}</strong> {t(locale, 'babySunSplitOr')}{' '}
                  <strong>{signName(reading.sun.b, locale)}</strong> {t(locale, 'babySunSplitTail')}
                </p>
                <span class="mono baby-receipt">
                  {fmtDay(reading.dueISO, locale)} · {signName(reading.sun.a, locale)} → {signName(reading.sun.b, locale)}
                </span>
              </>
            )}
          </div>

          <div class="baby-block">
            <h3>{t(locale, 'babyMoonHead')}</h3>
            <p>{t(locale, 'babyMoonBody')}</p>
            <ul class="baby-spans">
              {reading.moonSpans.map((s) => (
                <li key={s.fromISO}>
                  <span class="mono baby-receipt">
                    {fmtDay(s.fromISO, locale)}
                    {s.toISO !== s.fromISO && <> – {fmtDay(s.toISO, locale)}</>}
                  </span>
                  <span>{t(locale, 'moonIn')} {locale === 'ru' ? signPrepositional(s.sign) : signName(s.sign, locale)}</span>
                </li>
              ))}
            </ul>
          </div>

          {reading.retro.length > 0 && (
            <div class="baby-block">
              <h3>{t(locale, 'babyRetroHead')}</h3>
              <p>
                {reading.retro.map((planet) => planetLabel(locale, planet)).join(' · ')} — {t(locale, 'babyRetroBody')}
              </p>
            </div>
          )}

          <div class="baby-block">
            <h3>{t(locale, 'babyRisingHead')}</h3>
            <p>{t(locale, 'babyRisingBody')}</p>
          </div>

          <div class="calc__actions">
            <a
              class="btn btn--ghost"
              href={reading.birthdayHref}
              title={locale === 'ru' ? 'Материал пока доступен по-английски' : undefined}
            >
              <span>{t(locale, 'babyDateLink')}{locale === 'ru' ? ' — пока по-английски' : ''}</span><span class="orb">→</span>
            </a>
            <a class="btn btn--primary" href={localizePath(locale, '/birth-chart/')}>
              <span>{t(locale, 'babyChartLink')}</span><span class="orb">↗</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
