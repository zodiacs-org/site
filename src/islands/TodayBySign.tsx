/**
 * Zero-input value on the homepage: tap your sun sign, get today's sky
 * read from its solar houses — the same computed lines the horoscope
 * pages carry, one tap and no birth time. Pure over the committed daily
 * JSON; the ephemeris never loads here (homepage bundle rule).
 */
import { useState } from 'preact/hooks';
import { SIGNS, signName } from '../lib/signs';
import PlanetGlyph from '../components/PlanetGlyph';
import EvidenceDisclosure from './EvidenceDisclosure';
import type { Daily } from '../lib/daily';
import { englishOnlyCue, localizePath, normalizeCatalogLocale, t, tf, type CatalogLocale as Locale } from '../lib/i18n';
import { formatDate } from '../lib/i18n/dates';
import { moonPhaseLabel } from '../lib/i18n/astrology';
import { dailyReadingForLocale } from '../lib/i18n/daily-reading';
import daily from '../data/daily.json';

interface Props { locale?: Locale }

export default function TodayBySign({ locale: rawLocale = 'en' }: Props) {
  const locale = normalizeCatalogLocale(rawLocale);
  const [sel, setSel] = useState<string | null>(null);
  if (locale === 'ru') {
    return (
      <section class="tbs" aria-label={t(locale, 'todayBySignTitle')}>
        <div class="tbs__head"><h2>{t(locale, 'todayBySignTitle')}</h2></div>
        <p class="tbs__prompt">Ежедневные выпуски пока выходят по-английски. Расчётные данные — для любого языка.</p>
      </section>
    );
  }
  const reading = sel ? dailyReadingForLocale(sel, daily as Daily, locale) : null;
  const active = sel ? SIGNS.find((s) => s.slug === sel)! : null;
  const horoscopePath = active ? `/horoscopes/${active.slug}/` : '/horoscopes/';
  const horoscopeHref = localizePath(locale, horoscopePath);
  const englishOnly = horoscopeHref === horoscopePath ? englishOnlyCue(locale) : undefined;

  return (
    <section class="tbs" aria-label={t(locale, 'todayBySignTitle')}>
      <div class="tbs__head">
        <h2>{t(locale, 'todayBySignTitle')}</h2>
        <span class="mono tbs__stamp">
          {formatDate(locale, `${daily.date}T12:00:00Z`, {
            year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
          })} · {moonPhaseLabel(locale, daily.moon.phase)}
        </span>
      </div>

      <div class="tbs__signs" role="group" aria-label={t(locale, 'todayBySignTitle')}>
        {SIGNS.map((s) => (
          <button
            key={s.slug}
            type="button"
            aria-pressed={sel === s.slug}
            aria-controls="today-by-sign-reading"
            class={`tbs__sign${sel === s.slug ? ' tbs__sign--on' : ''}`}
            style={`--sign:${s.hue}`}
            onClick={() => setSel((cur) => (cur === s.slug ? null : s.slug))}
          >
            <picture class="tbs__icon">
              <source srcset={`/assets/zodiac-icons/48/${s.slug}.avif`} type="image/avif" />
              <img src={`/assets/zodiac-icons/48/${s.slug}.webp`} width="30" height="30" alt="" loading="lazy" decoding="async" />
            </picture>
            <span class="tbs__name">{signName(s, locale)}</span>
          </button>
        ))}
      </div>

      <div id="today-by-sign-reading" aria-live="polite">
        {reading && active ? (
          <div class="tbs__read" style={`--sign:${active.hue}`}>
            <div class="tbs__read-head">
              <strong>{signName(active, locale)} · {t(locale, 'today')}</strong>
            </div>
            <ul class="tbs__lines">
              {reading.lines.map((l) => (
                <li key={l.receipt}>
                  <p>{l.text}</p>
                </li>
              ))}
            </ul>
            <EvidenceDisclosure label={t(locale, 'whyThisReading')}>
              <p>{t(locale, 'todaySolarNote')}.</p>
              <ul class="evidence-disclosure__list">
                {reading.lines.map((l) => (
                  <li class="mono evidence-disclosure__receipt" key={l.receipt}>
                    {l.body && <PlanetGlyph body={l.body} hue={l.hue} size={13} class="rcpt-glyph" />}
                    <span>{l.receipt}</span>
                  </li>
                ))}
              </ul>
            </EvidenceDisclosure>
            <a class="tbs__more" href={horoscopeHref} hreflang={englishOnly ? 'en' : undefined} title={englishOnly?.aria}>
              {tf(locale, 'todayHoroscopeLink', { sign: signName(active, locale) })}{englishOnly?.suffix} →
            </a>
          </div>
        ) : (
          <p class="tbs__prompt">{t(locale, 'todayBySignPrompt')}</p>
        )}
      </div>
    </section>
  );
}
