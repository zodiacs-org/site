/**
 * The returning-visitor strip. If this device holds saved charts, the
 * homepage acknowledges it — one quiet row, no fanfare. First-time
 * visitors get nothing at all: the section only exists after mount,
 * and only when a profile does.
 */
import SignChip from './SignChip';
import { NextActionCard } from '../components/NextActionCard';
import { useProfile } from '../lib/hooks/useProfile';
import { explicitSelfChart } from '../lib/profile/read-store';
import { livingChartCaptureEnabled } from '../lib/living-chart/feature-flags';
import { encodeChartLink } from '../lib/share';
import { localizePath, normalizeCatalogLocale, t, tf, type CatalogLocale as Locale } from '../lib/i18n';

export default function WelcomeBack({ locale: rawLocale = 'en' }: { locale?: Locale }) {
  const locale = normalizeCatalogLocale(rawLocale);
  const { profile } = useProfile();
  const personalToday = locale === 'en' && livingChartCaptureEnabled();
  const chart = personalToday
    ? explicitSelfChart(profile.charts)
    : [...profile.charts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const count = profile.charts.length;

  if (count === 0) return null;
  if (!chart) {
    return (
      <section class="container" aria-label={t(locale, 'savedChartAria')}>
        <NextActionCard
          className="wb-card"
          cue={t(locale, 'recommendedNext')}
          title="Make today personal"
          body="Choose your own birth chart once. Today will use it for your personal daily reading; other people’s charts stay separate."
          primary={<a class="btn btn--primary" href="/today/"><span>Choose my chart</span><span class="orb" aria-hidden="true">→</span></a>}
          secondary={<a class="next-action__quiet" href="/profile/">{t(locale, 'yourCharts')} ({count})</a>}
        />
      </section>
    );
  }

  const find = (name: string) => chart.summary.bodies.find((b) => b.body === name);
  const sun = find('Sun');
  // The stored summary has no across-day Moon proof for an unknown birth time.
  const moon = chart.birth.timeKnown ? find('Moon') : null;
  const asc = chart.birth.timeKnown ? chart.summary.angles?.asc ?? null : null;
  const handle = chart.name.split('·')[0].trim() || chart.name;

  // Reopen the saved chart straight in the calculator (needs coordinates to
  // reconstruct; charts saved without a place fall back to the profile list).
  const openHref = chart.birth.place
    ? `${localizePath(locale, '/birth-chart/')}#c=${encodeChartLink({
        date: chart.birth.date,
        time: chart.birth.time,
        timeKnown: chart.birth.timeKnown,
        lat: chart.birth.place.lat,
        lon: chart.birth.place.lon,
        tz: chart.birth.place.tz,
        name: chart.name,
        place: chart.birth.place.name,
        houseSystem: chart.summary.houseSystem,
      })}`
    : null;
  const nextHref = locale === 'en'
    ? localizePath(locale, '/today/')
    : localizePath(locale, '/transits/');
  const nextLabel = locale === 'en'
    ? t(locale, 'openDailyBrief')
    : t(locale, 'todayAgainstChart');

  return (
    <section class="container" aria-label={t(locale, 'savedChartAria')}>
      <NextActionCard
        className="wb-card"
        cue={t(locale, 'recommendedNext')}
        title={tf(locale, 'todayForName', { name: handle })}
        body={t(locale, 'savedChartTodayBody')}
        meta={(
          <dl class="wb__three">
            {sun && <><dt class="mono--label">{t(locale, 'sun')}</dt><dd><SignChip lon={sun.lon} locale={locale} /></dd></>}
            {moon && <><dt class="mono--label">{t(locale, 'moon')}</dt><dd><SignChip lon={moon.lon} locale={locale} /></dd></>}
            {asc !== null && <><dt class="mono--label">{t(locale, 'rising')}</dt><dd><SignChip lon={asc} locale={locale} /></dd></>}
          </dl>
        )}
        primary={(
          <a class="btn btn--primary" href={nextHref}>
            <span>{nextLabel}</span><span class="orb" aria-hidden="true">↗</span>
          </a>
        )}
        secondary={(
          <>
            {openHref && (
              <a class="btn btn--ghost" href={openHref}>
                <span>{t(locale, 'openSavedChart')}</span><span class="orb" aria-hidden="true">→</span>
              </a>
            )}
            <a class="next-action__quiet" href={localizePath(locale, '/profile/')}>
              {count > 1 ? <>{t(locale, 'yourCharts')} ({count})</> : t(locale, 'profile')}
              {' '}<span aria-hidden="true">→</span>
            </a>
          </>
        )}
      />
    </section>
  );
}
