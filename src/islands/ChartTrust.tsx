import { t, type CatalogLocale } from '../lib/i18n';
import '../styles/chart-trust.css';

export type InstantBasis = 'birth' | 'reference' | 'return' | 'approximate-return' | 'sky-reference' | 'record';

/** A receipt reports the instant actually computed, never infers missing birth data. */
export function mathInstant(value?: Date | string | null): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function CheckOurMath({ utc, basis = 'birth', locale = 'en', subject }: {
  utc?: Date | string | null;
  basis?: InstantBasis;
  locale?: CatalogLocale;
  subject?: string;
}) {
  const instant = mathInstant(utc);
  const key = ({ birth: 'trustInstant', reference: 'trustReference', return: 'trustReturnInstant',
    'approximate-return': 'trustApproxReturn', 'sky-reference': 'trustSkyReference', record: 'trustRecordInstant' } as const)[basis];
  return <aside class="chart-trust" data-check-our-math data-instant-basis={instant ? basis : 'unavailable'}>
    <a class="chart-trust__link" href={locale === 'en' ? '/methodology/' : `/${locale}/methodology/`}>{t(locale, 'trustMath')}</a>
    {subject && <span class="chart-trust__subject">{subject}</span>}
    <p>{instant ? <><span>{t(locale, key)}</span><time class="mono" dateTime={instant}>{instant}</time></>
      : t(locale, 'trustMissingInstant')}</p>
  </aside>;
}

export function ResultOpening({ locale = 'en', kind = 'self' }: {
  locale?: CatalogLocale;
  kind?: 'self' | 'other' | 'pair' | 'return' | 'saturn';
}) {
  const key = ({ self: 'trustIntro', other: 'trustOtherIntro', pair: 'trustPairIntro',
    return: 'trustReturnIntro', saturn: 'trustSaturnIntro' } as const)[kind];
  return <p class="chart-trust__opening" data-result-opening>{t(locale, key)}</p>;
}

/** Kept in the lazy comparison result module, outside its initial form bundle. */
export function RelationshipTrust({ locale, people }: {
  locale: CatalogLocale;
  people: readonly { label: string; computedUtc?: Date | string; utc?: Date | string; timeKnown: boolean }[];
}) {
  return <><ResultOpening locale={locale} kind="pair" />{people.map((person, index) =>
    <CheckOurMath key={index} locale={locale} subject={person.label} utc={person.computedUtc ?? person.utc}
      basis={person.timeKnown ? 'birth' : 'reference'} />)}</>;
}
