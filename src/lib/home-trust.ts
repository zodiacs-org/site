import { localizePath, t, type CatalogLocale } from './i18n';

export function homeTrustFaq(locale: CatalogLocale) {
  return [
    { q: t(locale, 'trustFreeQuestion'), a: t(locale, 'trustFreeAnswer'), href: localizePath(locale, '/disclosure/'), link: t(locale, 'trustDisclosure') },
    { q: t(locale, 'trustAccuracyQuestion'), a: t(locale, 'trustAccuracyAnswer'), href: localizePath(locale, '/methodology/'), link: t(locale, 'trustMethodology') },
  ];
}
export function homeTrustSchema(locale: CatalogLocale) {
  return { '@type': 'FAQPage', mainEntity: homeTrustFaq(locale).map(({q,a,link}) => ({
    '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: `${a} ${link}.` },
  })) };
}
