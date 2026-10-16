import { useEffect, useState } from 'preact/hooks';
import type { MinimalBody, PairSummary } from '../lib/engine/synastry';
import { tf, type CatalogLocale as Locale } from '../lib/i18n';
import { pairSlug } from '../lib/pair-slug';
import { shareCardText } from '../lib/share-card-copy';
import { signForLongitude, signName } from '../lib/signs';
import type { SavedPairSide } from '../lib/profile/pairs';
import type { SavedChart } from '../lib/profile/schema';

interface CompatibilitySharePerson {
  label: string;
  bodies: MinimalBody[];
  asc: number | null;
  /** A chart computed here without a birth time: the picture draws noon UTC on this date (compatibilityPicturePeople). */
  untimedDate?: string;
  /** A chart computed here with a birth time: the picture draws its bodies at the whole minute. */
  utc?: Date | string;
}

interface CompatibilityShareControlProps {
  a: CompatibilitySharePerson;
  b: CompatibilitySharePerson;
  summary: PairSummary;
  locale: Locale;
}

type CardState = 'idle' | 'busy' | 'saved' | 'error';

export function CompatibilityPairingCta({
  a,
  b,
  locale,
}: Omit<CompatibilityShareControlProps, 'summary'>) {
  const sunA = a.bodies.find((body) => body.body === 'Sun');
  const sunB = b.bodies.find((body) => body.body === 'Sun');
  if (!sunA || !sunB) return null;
  const signA = signForLongitude(sunA.lon);
  const signB = signForLongitude(sunB.lon);
  return (
    <a
      class="btn btn--ghost"
      // The pair guides are translated for es, pt, fr and it; English and Russian read the English one.
      href={`${locale === 'en' || locale === 'ru' ? '' : `/${locale}`}/compatibility/${pairSlug(signA.slug, signB.slug)}/`}
      title={locale === 'ru' ? 'Материал пока доступен по-английски' : undefined}
    >
      <span>{tf(locale, 'pairingCta', {
        a: signName(signA, locale),
        b: signName(signB, locale),
      })}{locale === 'ru' ? ' (пока по-английски)' : ''}</span>
      <span class="orb">→</span>
    </a>
  );
}

/** Result-only chrome; the canvas implementation stays behind the click. */
export function CompatibilityShareControl({
  a,
  b,
  summary,
  locale,
}: CompatibilityShareControlProps) {
  const [card, setCard] = useState<CardState>('idle');
  const noTime = [a, b].some((person) => person.untimedDate !== undefined || person.asc === null);

  async function share() {
    if (card === 'busy') return;
    setCard('busy');
    try {
      const { saveCompatibilityCard } = await import('../lib/compatibility-card');
      const outcome = await saveCompatibilityCard(a, b, summary, locale);
      if (outcome === 'cancelled') {
        setCard('idle');
        return;
      }
      (window as Window & {
        zodiacsAnalytics?: { track?: (name: string, props: { variant: string }) => void };
      }).zodiacsAnalytics?.track?.('share_card_downloaded', { variant: 'compatibility' });
      setCard('saved');
    } catch (error) {
      console.error(error);
      setCard('error');
    }
  }

  return (
    <>
      <button
        type="button"
        class="btn btn--glass"
        onClick={share}
        disabled={card === 'busy'}
        data-share-compatibility
      >
        <span>{card === 'busy'
          ? shareCardText(locale, 'compatibilityBusy')
          : shareCardText(locale, 'compatibilityAction')}</span>
        <span class="orb">{card === 'saved' ? '✓' : '↗'}</span>
      </button>
      {noTime && <p class="field__help" data-compatibility-no-time>{shareCardText(locale, 'compatibilityNoTimeNote')}</p>}
      {card === 'saved' && (
        <p class="sr-only" role="status">{shareCardText(locale, 'compatibilitySaved')}</p>
      )}
      {card === 'error' && (
        <p class="calc__error" role="alert">{shareCardText(locale, 'compatibilityError')}</p>
      )}
    </>
  );
}

interface CompatibilityResult {
  a: CompatibilitySharePerson;
  b: CompatibilitySharePerson;
  summary: PairSummary;
  sides: readonly [SavedPairSide | null, SavedPairSide | null];
}

/**
 * The actions under a compatibility result: the pair guide, the share card
 * and, where the build has it on, "Save to your profile". The calculator
 * hands over the whole result, and the fields each action needs are picked
 * here, in this module that loads after the result renders, so the
 * compatibility page's first load carries none of it.
 */
export function CompatibilityResultActions({ result, charts, locale }: {
  result: CompatibilityResult;
  charts: readonly SavedChart[];
  locale: Locale;
}) {
  const person = ({ label, bodies, asc, untimedDate, utc }: CompatibilitySharePerson): CompatibilitySharePerson => (
    { label, bodies, asc, untimedDate, utc }
  );
  const [a, b] = result.sides;
  return (
    <>
      <CompatibilityPairingCta a={person(result.a)} b={person(result.b)} locale={locale} />
      <CompatibilityShareControl a={person(result.a)} b={person(result.b)} summary={result.summary} locale={locale} />
      {ACCOUNT_SAVES && a && b && <CompatibilityAccountSave a={a} b={b} charts={charts} locale={locale} />}
    </>
  );
}

/**
 * "Save to your profile" under a compatibility result, in English, where the
 * build has it on. It loads the save line itself rather than through
 * account-save-loader: a static import of that shared chunk would add its name
 * to the compatibility page's first-load preload list.
 */
const ACCOUNT_SAVES = import.meta.env.PUBLIC_ACCOUNT_SAVES_ENABLED === '1' && Boolean(import.meta.env.PUBLIC_SUPABASE_URL);

function CompatibilityAccountSave({ a, b, charts, locale }: {
  a: SavedPairSide;
  b: SavedPairSide;
  charts: readonly SavedChart[];
  locale: Locale;
}) {
  const [account, setAccount] = useState<typeof import('./AccountSaveAction') | null>(null);
  useEffect(() => {
    if (!ACCOUNT_SAVES || locale !== 'en') return;
    let active = true;
    void import('./AccountSaveAction').then((loaded) => { if (active) setAccount(loaded); }).catch(() => {});
    return () => { active = false; };
  }, [locale]);
  return account ? <account.ComparisonSave a={a} b={b} charts={charts} /> : null;
}
