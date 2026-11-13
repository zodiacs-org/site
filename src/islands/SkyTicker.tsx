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
/** `sign` swaps the line glyph for that sign's pastel disc (the Sun and Moon). */
interface Item { kind: IconKind; text: string; hue?: string; sign?: string }

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

/**
 * `discs` (default) seats the Sun and Moon on their signs' pastel discs.
 * Chart pages pass discs={false}: there every sign picture is asked for as
 * a whole zodiac-ordered set (audit finding F-18), and two discs are not one.
 */
export default function SkyTicker({ locale: rawLocale = 'en', discs = true }: { locale?: Locale; discs?: boolean }) {
  const locale = normalizeCatalogLocale(rawLocale);
  const receiptDate = formatShortDate(locale, `${daily.date}T12:00:00.000Z`);
  const compactReceiptDate = formatDate(locale, `${daily.date}T12:00:00.000Z`, {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
  const items = useMemo<Item[]>(() => {
    // Use the committed daily receipt for both SSR and hydration. Live-clock
    // math here used to make the server HTML stale before Preact attached.
    const asOfIso = `${daily.date}T12:00:00.000Z`;
    const out: Item[] = [];

    const sunLon = daily.bodies.find((body) => body.body === 'Sun')!.lon;
    const moonLon = daily.bodies.find((body) => body.body === 'Moon')!.lon;
    const moonSign = signForLongitude(moonLon);
    const sunSign = signForLongitude(sunLon);
    out.push({ kind: 'sun', text: `${t(locale, 'sun')} ${formatLongitude(sunLon, locale)}`, hue: sunSign.hue, sign: sunSign.slug });
    out.push({
      kind: 'moon',
      text: `${t(locale, 'moonIn')} ${locale === 'ru' ? signPrepositional(moonSign) : signName(moonSign, locale)}`,
      hue: moonSign.hue,
      sign: moonSign.slug,
    });

    const active = daily.bodies.filter((body) => body.retrograde).map((body) => body.body);
    out.push(active.includes('Mercury')
      ? { kind: 'retro', text: t(locale, 'skyMercuryRetrograde') }
      : { kind: 'direct', text: t(locale, 'skyMercuryDirect') });
    const others = active.filter((planet) => planet !== 'Mercury');
    // English and Russian templates read naturally with a list of planets, so
    // the rest of the retrograde planets share one item there. The other
    // catalogs agree the adjective with one planet, so they keep one each.
    if (others.length > 1 && (locale === 'en' || locale === 'ru')) {
      out.push({
        kind: 'retro',
        text: tf(locale, 'skyPlanetRetrograde', {
          planet: others.map((planet) => planetLabel(locale, planet)).join(', '),
        }),
      });
    } else {
      for (const planet of others) {
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
        <span class={`skyticker__item skyticker__item--${item.kind}`} key={item.text}>
          {item.sign && discs ? (
            <span class="skyticker__icon skyticker__icon--disc">
              <img src={`/assets/zodiac-icons/48/${item.sign}.webp`} width="18" height="18" alt="" decoding="async" />
            </span>
          ) : (
            <span class="skyticker__icon" style={item.hue ? `color:${item.hue}` : undefined}>
              <TickerIcon kind={item.kind} />
            </span>
          )}
          <span>{item.text}</span>
        </span>
      ))}
    </p>
  );
}
