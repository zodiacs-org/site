import { localizePath, type ReleasedLocale as Locale } from './i18n';
import { SIGNS, signName } from './signs';
import { EN } from '../strings/en.mjs';
import { additionFormat, additionText } from '../strings/additions';
import originReceipts from '../data/registry-origin-receipts.json';

/**
 * verified — supported by public repository or onchain evidence.
 * operator-attested — supplied by the operator, dated and published, but not
 *   independently verified; rendered with its own chip, never as verified.
 * pending — unresolved; the amber chip. Kept for future rows.
 */
export type DisclosureStatus = 'verified' | 'operator-attested' | 'pending';

export interface DisclosureEvidence {
  label: string;
  href?: string;
  external?: boolean;
}

export interface DisclosureRow {
  id: 'operator' | 'economic-interest' | 'origin' | 'separation' | 'read-only' | 'trade-panel' | 'financial-advice';
  label: string;
  statement: string;
  status: DisclosureStatus;
  evidence: string;
  links: DisclosureEvidence[];
}

type DisclosureCatalogKey = Extract<keyof typeof EN, `disclosure.${string}`>;
export type DisclosureTextKey = DisclosureCatalogKey extends `disclosure.${infer Key}` ? Key : never;

export function disclosureText(locale: Locale, key: DisclosureTextKey): string {
  const catalogKey = `disclosure.${key}` as DisclosureCatalogKey;
  return additionText(locale, catalogKey, EN[catalogKey]);
}

const RECEIPT_BY_SIGN = new Map(
  originReceipts.receipts.map((receipt) => [receipt.sign, receipt]),
);

/** 2024-07-05T17:54:34.000Z → 2024-07-05 (UTC date of the receipt). */
function receiptDate(blockTime: string): string {
  return blockTime.slice(0, 10);
}

export function statusText(locale: Locale, status: DisclosureStatus): string {
  if (status === 'verified') return disclosureText(locale, 'statusVerified');
  if (status === 'operator-attested') return disclosureText(locale, 'statusAttested');
  return disclosureText(locale, 'statusPending');
}

/** In-page id of the public-address lookup notice on /disclosure/. */
export const ADDRESS_LOOKUP_ID = 'address-lookup';

export function addressLookupHref(locale: Locale): string {
  return `${localizePath(locale, '/disclosure/')}#${ADDRESS_LOOKUP_ID}`;
}

export function disclosureRows(locale: Locale): readonly DisclosureRow[] {
  return [
  {
    id: 'operator',
    label: disclosureText(locale, 'operatorLabel'),
    statement: disclosureText(locale, 'operatorStatement'),
    status: 'operator-attested',
    evidence: disclosureText(locale, 'operatorEvidence'),
    links: [],
  },
  {
    id: 'economic-interest',
    label: disclosureText(locale, 'economicLabel'),
    statement: disclosureText(locale, 'economicStatement'),
    status: 'operator-attested',
    evidence: disclosureText(locale, 'economicEvidence'),
    links: [
      {
        label: disclosureText(locale, 'economicSnapshotsLink'),
        href: 'https://github.com/zodiacs-org/site/commits/main/public/assets/distribution.json',
        external: true,
      },
    ],
  },
  {
    id: 'origin',
    label: disclosureText(locale, 'originLabel'),
    statement: disclosureText(locale, 'originStatement'),
    status: 'verified',
    evidence: disclosureText(locale, 'originEvidence'),
    links: SIGNS.map((sign) => {
      const receipt = RECEIPT_BY_SIGN.get(sign.slug);
      if (!receipt) throw new Error(`Missing origin receipt for ${sign.slug}`);
      return {
        label: additionFormat(
          locale,
          'disclosure.originSlot',
          { sign: signName(sign, locale), date: receiptDate(receipt.blockTime) },
          EN['disclosure.originSlot'],
        ),
        href: receipt.explorerUrl,
        external: true,
      };
    }),
  },
  {
    id: 'separation',
    label: disclosureText(locale, 'separationLabel'),
    statement: disclosureText(locale, 'separationStatement'),
    status: 'verified',
    evidence: disclosureText(locale, 'separationEvidence'),
    links: [
      { label: disclosureText(locale, 'linkPrivacy'), href: localizePath(locale, '/privacy/') },
      { label: disclosureText(locale, 'linkMethodology'), href: localizePath(locale, '/methodology/') },
    ],
  },
  {
    id: 'read-only',
    label: disclosureText(locale, 'readOnlyLabel'),
    statement: disclosureText(locale, 'readOnlyStatement'),
    status: 'verified',
    evidence: disclosureText(locale, 'readOnlyEvidence'),
    links: [
      { label: disclosureText(locale, 'linkRegistry'), href: '/registry/zodiacs.registry.json' },
      { label: disclosureText(locale, 'linkSdk'), href: '/sdk/' },
    ],
  },
  {
    id: 'trade-panel',
    label: disclosureText(locale, 'tradeLabel'),
    statement: disclosureText(locale, 'tradeStatement'),
    status: 'verified',
    evidence: disclosureText(locale, 'tradeEvidence'),
    links: [
      { label: disclosureText(locale, 'linkTradeExample'), href: '/astrofolio/how-to-buy/' },
      { label: disclosureText(locale, 'linkTerms'), href: '/terms/' },
    ],
  },
  {
    id: 'financial-advice',
    label: disclosureText(locale, 'adviceLabel'),
    statement: disclosureText(locale, 'adviceStatement'),
    status: 'verified',
    evidence: disclosureText(locale, 'adviceEvidence'),
    links: [
      { label: disclosureText(locale, 'addressLookupHeading'), href: addressLookupHref(locale) },
      { label: disclosureText(locale, 'linkThesis'), href: '/thesis/' },
    ],
  },
  ];
}

/** English compatibility export for existing consumers and contract tests. */
export const DISCLOSURE_ROWS: readonly DisclosureRow[] = disclosureRows('en');
