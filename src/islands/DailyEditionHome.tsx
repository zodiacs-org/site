import { useEffect, useState } from 'preact/hooks';
import { localizePath, type CatalogLocale } from '../lib/i18n';
import { returnText as s } from '../lib/return-visits/copy';

type Edition = { day: string; name: string };

/**
 * Server render shows the latest approved edition as of the build, so crawlers
 * and no-JS readers never see "no chart yet" above a listed chart. In the
 * browser the visitor's UTC day decides: today's edition if one is approved,
 * otherwise the latest one on or before today.
 */
export default function DailyEditionHome({ editions, locale, buildDay }: { editions: Edition[]; locale: CatalogLocale; buildDay: string }) {
  const [day, setDay] = useState(buildDay);
  useEffect(() => { const update = () => setDay(new Date().toISOString().slice(0, 10)); update(); const timer = window.setInterval(update, 60_000); return () => window.clearInterval(timer); }, []);
  const published = editions.filter((edition) => edition.day <= day).sort((a, b) => b.day.localeCompare(a.day));
  const featured = published[0];
  const isToday = featured?.day === day;
  const archive = published.slice(1);
  const href = (edition: Edition) => `${localizePath(locale, '/chart-of-the-day/')}${edition.day}/`;
  return <div class="return-panel" data-daily-home>
    {featured
      ? <a class="btn btn--primary" href={href(featured)} data-daily-featured>{isToday ? s(locale, 'dayToday', { name: featured.name }) : s(locale, 'dayLatest', { name: featured.name, day: featured.day })} →</a>
      : <p>{s(locale, 'dayPending')}</p>}
    {archive.length > 0 && <ul class="return-contact-list">{archive.map((edition) => <li key={edition.day}><a href={href(edition)}>{edition.day} · {edition.name}</a></li>)}</ul>}
  </div>;
}
