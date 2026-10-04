import { useEffect, useState } from 'preact/hooks';
import { localizePath, type CatalogLocale } from '../lib/i18n';
import { returnText as s } from '../lib/return-visits/copy';
export default function DailyEditionHome({ editions, locale }: { editions: { day: string; name: string }[]; locale: CatalogLocale }) {
  const [day, setDay] = useState('');
  useEffect(() => { const update = () => setDay(new Date().toISOString().slice(0, 10)); update(); const timer = window.setInterval(update, 60_000); return () => window.clearInterval(timer); }, []);
  const current = editions.find((edition) => edition.day === day);
  const archive = editions.filter((edition) => edition.day !== current?.day);
  return <div class="return-panel">
    {current ? <a class="btn btn--primary" href={`${localizePath(locale, '/chart-of-the-day/')}${current.day}/`}>{current.name} · {current.day} →</a> : <p>{s(locale, 'dayPending')}</p>}
    {archive.length > 0 && <ul class="return-contact-list">{[...archive].sort((a, b) => b.day.localeCompare(a.day)).map((edition) => <li key={edition.day}><a href={`${localizePath(locale, '/chart-of-the-day/')}${edition.day}/`}>{edition.day} · {edition.name}</a></li>)}</ul>}
  </div>;
}
