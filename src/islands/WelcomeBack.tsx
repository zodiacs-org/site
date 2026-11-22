import SignChip from './SignChip';
import { NextActionCard } from '../components/NextActionCard';
import { newestSavedChart } from '../lib/today/state';
import { useProfile } from '../lib/hooks/useProfile';
import { explicitSelfChart } from '../lib/profile/read-store';
import { livingChartCaptureEnabled } from '../lib/living-chart/feature-flags';
import { profileChartHandoffFragment } from '../lib/chart-handoff';
import { localizePath, normalizeCatalogLocale, t, tf, type CatalogLocale as Locale } from '../lib/i18n';

export default function WelcomeBack({ locale: rawLocale = 'en' }: { locale?: Locale }) {
  const locale = normalizeCatalogLocale(rawLocale);
  const { profile, ready } = useProfile();
  const englishHome = locale === 'en';
  const shells = englishHome && !ready;
  const charts = englishHome
    ? profile.charts.filter(chart => Array.isArray(chart?.summary?.bodies)
      && chart.summary.bodies.some(body => Number.isFinite(body?.lon)))
    : profile.charts;
  const count = charts.length;
  if (!shells && !count) return null;

  const chart = englishHome
    ? (livingChartCaptureEnabled() ? explicitSelfChart(charts) : newestSavedChart(profile))
    : [...charts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const find = (name: string) => chart?.summary.bodies.find(b => b?.body === name && Number.isFinite(b.lon));
  const sun = find('Sun');
  // An unknown time does not establish the Moon or rising sign.
  const moon = chart?.birth?.timeKnown ? find('Moon') : null;
  const asc = chart?.birth?.timeKnown ? chart.summary.angles?.asc : null;
  const name = typeof chart?.name === 'string' ? chart.name : '';
  const handle = name.split('·')[0].trim() || name;
  const openFragment = chart?.birth?.place ? profileChartHandoffFragment(chart.id) : null;
  const openChart = openFragment && (
    <a class={englishHome ? 'next-action__quiet' : 'btn btn--ghost'} href={`${localizePath(locale, '/birth-chart/')}#${openFragment}`}>
      <span>{t(locale, 'openSavedChart')}</span>{!englishHome && <span class="orb" aria-hidden="true">→</span>}
    </a>
  );
  const chartsLink = (
    <a class="next-action__quiet" href={localizePath(locale, '/profile/')}>
      {englishHome || count > 1 ? t(locale, 'yourCharts') : t(locale, 'profile')}
      {!englishHome && count > 1 && ` (${count})`}{!englishHome && <span aria-hidden="true"> →</span>}
    </a>
  );

  return (
    <section class={englishHome ? 'container wb-greeting' : 'container'} aria-label={t(locale, 'savedChartAria')}>
      {(shells || chart) && (
        <NextActionCard
          key="chart"
          className="wb-card wb-chart"
          cue={t(locale, 'recommendedNext')}
          title={!englishHome || handle ? tf(locale, 'todayForName', { name: handle }) : 'Today, for your chart'}
          body={t(locale, 'savedChartTodayBody')}
          meta={(
            <dl class="wb__three" aria-hidden={!chart || undefined}>
              {sun && <><dt class="mono--label">{t(locale, 'sun')}</dt><dd><SignChip lon={sun.lon} locale={locale} /></dd></>}
              {moon && <><dt class="mono--label">{t(locale, 'moon')}</dt><dd><SignChip lon={moon.lon} locale={locale} /></dd></>}
              {asc != null && Number.isFinite(asc) && <><dt class="mono--label">{t(locale, 'rising')}</dt><dd><SignChip lon={asc} locale={locale} /></dd></>}
            </dl>
          )}
          primary={(
            <a class="btn btn--primary" href={localizePath(locale, englishHome ? '/today/' : '/transits/')}>
              <span>{englishHome ? 'Open my daily brief' : t(locale, 'todayAgainstChart')}</span><span class="orb" aria-hidden="true">↗</span>
            </a>
          )}
          secondary={englishHome ? <>{chartsLink}{openChart}</> : <>{openChart}{chartsLink}</>}
        />
      )}
      {(shells || !chart) && (
        <NextActionCard
          key="choose"
          className="wb-card wb-choose"
          cue={t(locale, 'recommendedNext')}
          title="Make today personal"
          body="Choose your own birth chart once. Today will use it for your personal daily reading; other people’s charts stay separate."
          primary={<a class="btn btn--primary" href="/today/"><span>Choose my chart</span><span class="orb" aria-hidden="true">→</span></a>}
          secondary={chartsLink}
        />
      )}
    </section>
  );
}
