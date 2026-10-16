/**
 * The proof strip: one dated daily-sky receipt in a quiet mono line, with a
 * small celestial glyph per fact so it reads as an almanac row, not flat
 * text. Positions and retrograde state come from daily.json; the next
 * lunation comes from build-time sky data. The ephemeris never loads here.
 */
import { useMemo } from 'preact/hooks';
import { formatLongitude, signForLongitude, signName, signPrepositional } from '../lib/signs';
import sky from '../data/sky.json';
import daily from '../data/daily.json';
import { normalizeCatalogLocale, t, tf, type CatalogLocale as Locale } from '../lib/i18n';
import { planetLabel } from '../lib/i18n/astrology';
import { formatDate, formatShortDate } from '../lib/i18n/dates';

type IconKind = 'sun' | 'moon' | 'retro' | 'direct' | 'newMoon' | 'fullMoon';
interface Item { kind: IconKind; text: string; hue?: string }

/** Small line-art sky glyphs, drawn at ~13px. Stroke presentation is set in
 * CSS (.skyticker__icon svg); the two filled glyphs flip to fill via style. */
const FILLED = 'fill:currentColor;stroke:none';
function TickerIcon({ kind }: { kind: IconKind }) {
  switch (kind) {
    case 'sun':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.9" />
          <path d="M12 2.2v2.1M12 19.7v2.1M4.3 4.3l1.5 1.5M18.2 18.2l1.5 1.5M2.2 12h2.1M19.7 12h2.1M4.3 19.7l1.5-1.5M18.2 5.8l1.5-1.5" />
        </svg>
      );
    case 'moon':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" style={FILLED}>
          <path d="M20.5 14.3A8.6 8.6 0 1 1 9.7 3.5a6.7 6.7 0 0 0 10.8 10.8Z" />
        </svg>
      );
    case 'retro': // apparent backward motion — a counter-clockwise turn
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 2.6-6.3L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      );
    case 'direct':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.6-6.3L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      );
    case 'newMoon':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.2" />
        </svg>
      );
    case 'fullMoon':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" style={FILLED}>
          <circle cx="12" cy="12" r="8.2" />
        </svg>
      );
  }
}

export default function SkyTicker({ locale: rawLocale = 'en' }: { locale?: Locale }) {
  const locale = normalizeCatalogLocale(rawLocale);
  const receiptDate = formatShortDate(locale, `${daily.date}T12:00:00.000Z`);
  const compactReceiptDate = formatDate(locale, `${daily.date}T12:00:00.000Z`, {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
  const items = useMemo<Item[]>(() => {
    // Use the committed daily receipt for both SSR and hydration. Live-clock
    // math here used to make the server HTML stale before Preact attached.
    const asOfIso = `${daily.date}T12:00:00.000Z`;
    const out: Item[] = [];

    const sunLon = daily.bodies.find((body) => body.body === 'Sun')!.lon;
    const moonLon = daily.bodies.find((body) => body.body === 'Moon')!.lon;
    const moonSign = signForLongitude(moonLon);
    out.push({ kind: 'sun', text: `${t(locale, 'sun')} ${formatLongitude(sunLon, locale)}`, hue: signForLongitude(sunLon).hue });
    out.push({
      kind: 'moon',
      text: `${t(locale, 'moonIn')} ${locale === 'ru' ? signPrepositional(moonSign) : signName(moonSign, locale)}`,
      hue: moonSign.hue,
    });

    const active = daily.bodies.filter((body) => body.retrograde).map((body) => body.body);
    out.push(active.includes('Mercury')
      ? { kind: 'retro', text: t(locale, 'skyMercuryRetrograde') }
      : { kind: 'direct', text: t(locale, 'skyMercuryDirect') });
    for (const planet of active) {
      if (planet !== 'Mercury') {
        out.push({
          kind: 'retro',
          text: tf(locale, 'skyPlanetRetrograde', { planet: planetLabel(locale, planet) }),
        });
      }
    }

    const nextMoon = (sky.moons as { type: string; at: string }[]).find((m) => m.at > asOfIso);
    if (nextMoon) {
      const full = nextMoon.type === 'full';
      const label = full
        ? t(locale, 'skyFullMoon')
        : t(locale, 'skyNewMoon');
      const text = tf(locale, 'skyMoonOn', {
        event: label,
        date: formatDate(locale, nextMoon.at, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      });
      out.push({ kind: full ? 'fullMoon' : 'newMoon', text });
    }

    return out;
  }, [locale]);

  return (
    <p class="skyticker" aria-label={tf(locale, 'skyTickerAria', { date: receiptDate })}>
      <span class="skyticker__label">{tf(locale, 'skyAsOf', { date: compactReceiptDate })}</span>
      {items.map((item) => (
        <span class="skyticker__item" key={item.text}>
          <span class="skyticker__icon" style={item.hue ? `color:${item.hue}` : undefined}>
            <TickerIcon kind={item.kind} />
          </span>
          <span>{item.text}</span>
        </span>
      ))}
    </p>
  );
}
