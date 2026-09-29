/** Small sign pill used inside result tables and synastry readouts. */
import { signForLongitude, signName } from '../lib/signs';
import { signIcon } from '../lib/sign-icon';
import { localizePath, normalizeCatalogLocale, type CatalogLocale as Locale } from '../lib/i18n';

export default function SignChip({ lon, locale: rawLocale = 'en' }: { lon: number; locale?: Locale }) {
  const locale = normalizeCatalogLocale(rawLocale);
  const s = signForLongitude(lon);
  return (
    <a class="chip" href={localizePath(locale, `/${s.slug}/`)} style={`--sign:${s.hue}`}>
      <picture class="chip__icon">
        <img src={signIcon(48, s.slug)} width="18" height="18" alt="" loading="lazy" decoding="async" />
      </picture>
      {signName(s, locale)}
    </a>
  );
}
