import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EN } from '../strings/en.mjs';
import { additionFormat } from '../strings/additions';
import originReceipts from '../data/registry-origin-receipts.json';
import {
  DISCLOSURE_ROWS,
  disclosureRows,
  disclosureText,
  statusText,
  type DisclosureTextKey,
} from './disclosure';
import { RELEASED_LOCALES, LOCALE_META, localizePath, type ReleasedLocale as Locale } from './i18n';
import {
  REGISTRY_ESTABLISHED,
  REGISTRY_ESTABLISHMENT,
  REGISTRY_ESTABLISHMENT_PROVENANCE_URL,
} from './registry-establishment.mjs';
import { SIGNS, signName } from './signs';

const ROW_IDS = [
  'operator',
  'economic-interest',
  'origin',
  'separation',
  'read-only',
  'trade-panel',
  'financial-advice',
] as const;
const ATTESTED_IDS = ['operator', 'economic-interest'] as const;
const VERIFIED_IDS = ['origin', 'separation', 'read-only', 'trade-panel', 'financial-advice'] as const;
// The Registry catalogue boundary and separate opt-in Astrofolio tool are
// checkable in source, so nothing is pending. The chip machinery stays for
// future rows.
const PENDING_IDS = [] as const;
const ROUTE_TEXT_KEYS = [
  'metaTitle',
  'metaDescription',
  'kicker',
  'title',
  'intro',
  'scope',
  'establishedLabel',
  'establishedPrefix',
  'establishedProvenance',
  'establishedPending',
  'tableLabel',
  'statementHeading',
  'evidenceHeading',
  'statusPending',
  'statusAttested',
  'statusVerified',
  'operatorLabel',
  'operatorStatement',
  'operatorEvidence',
  'economicLabel',
  'economicStatement',
  'economicEvidence',
  'originLabel',
  'originStatement',
  'originEvidence',
  'separationLabel',
  'separationStatement',
  'separationEvidence',
  'readOnlyLabel',
  'readOnlyStatement',
  'readOnlyEvidence',
  'tradeLabel',
  'tradeStatement',
  'tradeEvidence',
  'linkTradeExample',
  'adviceLabel',
  'adviceStatement',
  'adviceEvidence',
  'linkPrivacy',
  'linkMethodology',
  'linkRegistry',
  'linkSdk',
  'linkTerms',
  'linkThesis',
  'operatorRequest',
  'operatorRequestBody',
  'backRegistry',
] as const satisfies readonly DisclosureTextKey[];

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RECEIPT_DATE = '2024-07-05';
const SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

function routeFile(locale: Locale): string {
  const prefix = LOCALE_META[locale].pathPrefix.replace(/^\//, '');
  return resolve(repo, 'dist', prefix, 'disclosure/index.html');
}

function routeRow(html: string, id: typeof ROW_IDS[number]): string {
  return html.match(new RegExp(`<tr\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/tr>`))?.[1] ?? '';
}

function literalTextPattern(value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'u');
}

describe('origin-receipt evidence file', () => {
  const receipts = originReceipts.receipts;

  it('records one verified receipt per canonical mint', async () => {
    const registry = JSON.parse(
      await readFile(resolve(repo, 'public/registry/zodiacs.registry.json'), 'utf8'),
    );
    const registryMints = new Map(
      registry.assets.map((asset: { sign: string; native: { address: string } }) => [
        asset.sign,
        asset.native.address,
      ]),
    );
    expect(receipts).toHaveLength(12);
    expect(new Set(receipts.map((r) => r.sign)).size).toBe(12);
    expect(new Set(receipts.map((r) => r.signature)).size).toBe(12);
    for (const receipt of receipts) {
      expect(registryMints.get(receipt.sign), receipt.sign).toBe(receipt.mint);
      expect(receipt.signature, receipt.sign).toMatch(SIGNATURE_PATTERN);
      expect(receipt.blockTime, receipt.sign).toMatch(
        new RegExp(`^${RECEIPT_DATE}T\\d{2}:\\d{2}:\\d{2}\\.000Z$`),
      );
      expect(receipt.explorerUrl, receipt.sign).toBe(`https://solscan.io/tx/${receipt.signature}`);
      expect(receipt.verification.rpc.initializeMintObserved, receipt.sign).toBe(true);
      expect(receipt.verification.solscan.pageResolved, receipt.sign).toBe(true);
      expect(receipt.verification.solscan.slotShown, receipt.sign).toBe(true);
      expect(receipt.verification.solscan.initializeMintShown, receipt.sign).toBe(true);
    }
  });

  it('derives the establishment from the earliest verified receipt', () => {
    const earliest = [...receipts].sort((a, b) => a.slot - b.slot)[0];
    expect(originReceipts.establishment.earliestReceipt.signature).toBe(earliest.signature);
    expect(REGISTRY_ESTABLISHMENT_PROVENANCE_URL).toBe(earliest.explorerUrl);
    expect(REGISTRY_ESTABLISHED).toBe(originReceipts.establishment.romanYear);
    expect(REGISTRY_ESTABLISHMENT.year).toBe(Number(earliest.blockTime.slice(0, 4)));
    expect(REGISTRY_ESTABLISHMENT.provenanceStatus).toBe('verified');
  });
});

describe('candidacy observations are reproducible and never overclaim', () => {
  const EVIDENCE_URL = 'https://zodiacs.org/thesis/thesis-candidacy-evidence.json';

  it('backs every reader-facing field with a complete evidence record', async () => {
    const candidacy = JSON.parse(
      await readFile(resolve(repo, 'public/thesis/thesis-candidacy.json'), 'utf8'),
    );
    const evidence = JSON.parse(
      await readFile(resolve(repo, 'public/thesis/thesis-candidacy-evidence.json'), 'utf8'),
    );
    const criteria = Object.keys(candidacy.criteria);
    expect(criteria).toEqual(Object.keys(evidence.criteria));
    for (const key of criteria) {
      const field = candidacy.criteria[key];
      const record = evidence.criteria[key];
      expect(field.status, key).toBe('filled');
      expect(field.verifyUrl, key).toBe(EVIDENCE_URL);
      // Negative observations are scoped to their search, never exhaustive zeros.
      expect(field.value, key).not.toMatch(/(^|[^\d.])0 (verified|editorial|independent|qualifying)/i);
      for (const required of ['definition', 'method', 'capturedAtUtc', 'exclusions', 'result'] as const) {
        expect(typeof record[required], `${key}.${required}`).toBe('string');
        expect(record[required].length, `${key}.${required}`).toBeGreaterThan(20);
      }
      expect(Array.isArray(record.sourcesSearched) && record.sourcesSearched.length > 0, key).toBe(true);
      expect(Array.isArray(record.verificationUrls) && record.verificationUrls.length > 0, key).toBe(true);
    }
    for (const key of ['independentIntegrations', 'thirdPartyCitations'] as const) {
      expect(candidacy.criteria[key].value, key).toMatch(/no qualifying/i);
      expect(evidence.criteria[key].result, key).toMatch(/not exhaustive/i);
    }
    // The historical liquidity claim is exactly what the receipts support.
    expect(evidence.criteria.liquidityPersistence.pools).toHaveLength(12);
    for (const pool of evidence.criteria.liquidityPersistence.pools) {
      expect(pool.pairCreatedAtPerDexscreener, pool.sign).toBe('2024-07-05');
      expect(pool.verificationUrl, pool.sign).toContain(pool.pairAddress);
    }
    expect(candidacy.criteria.liquidityPersistence.value).toMatch(/not archived/i);
    expect(candidacy.criteria.liquidityPersistence.value).not.toMatch(/persisted since|live since/i);
    // The archive count is backed by the embedded CDX rows.
    const cdxRows = evidence.criteria.archiveContinuity.cdxRows;
    expect(Array.isArray(cdxRows)).toBe(true);
    expect(candidacy.criteria.archiveContinuity.value).toContain(`${cdxRows.length} captures`);
  });
});

describe('registry disclosure contract', () => {
  it('publishes every required disclosure row exactly once', () => {
    expect(DISCLOSURE_ROWS.map((row) => row.id)).toEqual(ROW_IDS);
  });

  it('labels operator statements as dated attestations, never as verified', () => {
    const attested = DISCLOSURE_ROWS.filter((row) => row.status === 'operator-attested');
    expect(attested.map((row) => row.id)).toEqual([...ATTESTED_IDS]);
    // An attestation names its own evidentiary limit and its date.
    for (const row of attested) {
      expect(row.evidence).toMatch(/not independently verified/i);
      expect(row.evidence).toMatch(/\b2026-\d{2}-\d{2}\b/);
    }
    expect(statusText('en', 'operator-attested')).toBe(EN['disclosure.statusAttested']);
    expect(EN['disclosure.statusAttested']).toMatch(/not independently verified/i);
    // The current attestation corrects the former domain-separation claim while
    // leaving token administration, treasury, liquidity, and market control
    // explicitly unestablished.
    const operator = DISCLOSURE_ROWS.find((row) => row.id === 'operator')!;
    expect(operator.statement).toContain('official Astrofolio consumer experience at zodiacs.org/astrofolio');
    expect(operator.statement).toContain('astrofolio.xyz redirects to that page and is not a separate consumer surface');
    expect(operator.statement).toContain('does not establish who controls token deployment or administrative authorities, treasury, liquidity, or market activity');
    expect(operator.evidence).toContain('supersedes only the 2026-08-02 claim');
    expect(operator.statement).not.toMatch(/bitcoin/i);
    expect(operator.evidence).not.toContain('No public record identifies');
    // The economic row pairs the attested holdings statement with the
    // publicly verifiable distribution figures, without refusal framing.
    const economic = DISCLOSURE_ROWS.find((row) => row.id === 'economic-interest')!;
    expect(operator.statement).toContain('2026-08-23');
    expect(economic.statement).toContain('2026-08-02');
    expect(economic.statement).not.toContain('2026-08-23');
    expect(economic.statement).toContain('holding positions in one or more of the twelve Registry assets');
    expect(economic.evidence).toContain('ranged from 23.0% to 30.6%');
    expect(economic.evidence).toContain('median of 27.2%');
    expect(economic.evidence).toContain('checked against the published snapshots and public chain records');
    expect(economic.links.map((link) => link.href)).toEqual([
      'https://github.com/zodiacs-org/site/commits/main/public/assets/distribution.json',
    ]);
    for (const row of [operator, economic]) {
      const text = `${row.statement} ${row.evidence}`;
      expect(text).not.toMatch(/partial, without specifying/i);
      expect(text).not.toMatch(/did not authorize|declined/i);
      expect(text).not.toMatch(/evenly distributed/i);
    }
    // Nothing is pending now the catalogue transaction boundary is verifiable;
    // no operator scaffolding remains.
    expect(DISCLOSURE_ROWS.filter((row) => row.status === 'pending').map((row) => row.id))
      .toEqual([...PENDING_IDS]);
    expect(DISCLOSURE_ROWS.every((row) => !`${row.statement} ${row.evidence}`.includes('[OPERATOR'))).toBe(true);
  });

  it('publishes twelve linked origin receipts on the verified origin row', () => {
    const origin = DISCLOSURE_ROWS.find((row) => row.id === 'origin')!;
    expect(origin.status).toBe('verified');
    expect(origin.links).toHaveLength(12);
    for (const [index, link] of origin.links.entries()) {
      const receipt = originReceipts.receipts.find(
        (r) => r.sign === SIGNS[index].slug,
      )!;
      expect(link.href, SIGNS[index].slug).toBe(receipt.explorerUrl);
      expect(link.external, SIGNS[index].slug).toBe(true);
      expect(link.label, SIGNS[index].slug).toContain(RECEIPT_DATE);
      expect(link.label, SIGNS[index].slug).not.toMatch(/pending/i);
    }
  });

  it('states the approved paste-address and independent-service boundary', () => {
    for (const id of ['read-only', 'trade-panel']) {
      const row = DISCLOSURE_ROWS.find((candidate) => candidate.id === id)!;
      expect(row.status).toBe('verified');
      expect(row.statement).toBe('Zodiacs.org does not connect wallets, request signatures, or submit transactions. Public address lookups use an address you paste. Purchase links open independent services with their own terms and risks.');
      expect(row.statement).not.toMatch(/may connect|reviews and signs|Jupiter convenience/);
    }
    const row = DISCLOSURE_ROWS.find((candidate) => candidate.id === 'trade-panel')!;
    expect(row.links.map((link) => link.href)).toEqual(['/astrofolio/how-to-buy/', '/terms/']);
  });

  it('defines official as a Registry classification without implying safety or value', () => {
    const row = DISCLOSURE_ROWS.find((candidate) => candidate.id === 'financial-advice')!;
    expect(row.statement).toContain('not a wallet score or price signal');
    expect(row.statement).toContain('no purchase is required');
    expect(row.evidence).toContain('“Official” is a Registry classification only');
    for (const excludedClaim of [
      'government approval',
      'identity verification',
      'safety',
      'value',
      'liquidity',
      'future performance',
    ]) {
      expect(row.evidence).toContain(excludedClaim);
    }
  });

  it('keeps one quiet public-lookup note at the Accession Desk', async () => {
    const source = await readFile(resolve(repo, 'src/islands/RegistryAura.tsx'), 'utf8');
    const boundary = (source.match(/<details class="aura-wallet-connect aura-desk-details"[\s\S]*?<\/details>/)?.[0] ?? '')
      .replace(/\s+/g, ' ');

    expect(boundary).toContain('sends the public address to its holdings provider');
    expect(source).not.toMatch(/connectSolanaWallet|connectEip6963Provider|Connect Solana wallet|Connect Base wallet/);
    expect(boundary).toContain('href="/privacy/"');
    expect(boundary).toContain('href="/disclosure/"');
  });

  it('keeps the English privacy and terms pages explicit about Aura data and asset risk', async () => {
    const [privacySource, termsSource] = await Promise.all([
      readFile(resolve(repo, 'src/pages/privacy/index.astro'), 'utf8'),
      readFile(resolve(repo, 'src/pages/terms/index.astro'), 'utf8'),
    ]);
    const privacy = privacySource.replace(/\s+/g, ' ');
    const terms = termsSource.replace(/\s+/g, ' ');

    for (const required of [
      'configured blockchain-data provider',
      'does not include birth fields, chart names, chart placements, or chart geometry',
      'becomes ineligible for restoration after eight hours',
      'ineligible after 24 hours',
      'deleted the next time Aura reads them',
      'We do not promise that a public-address request is never logged',
      'Clearing Aura cannot recall copies',
      'no birth data, public address, chart identifier, connected account identifier, or exact held-sign list',
    ]) {
      expect(privacy).toContain(required);
    }

    for (const required of [
      'result in a total loss',
      'Blockchain transactions are often irreversible',
      "does not prove control of an address, legal ownership of an asset, or a person's identity",
      '“official,” “official Zodiac,” and similar wording mean only',
      'not an endorsement, solicitation, or statement that an asset is suitable for you',
      'as a dated operator attestation',
      'must not be treated as independently verified',
    ]) {
      expect(terms).toContain(required);
    }
    expect(terms).not.toContain('still pending operator confirmation');
  });

  it('links verified establishment provenance from the receipts file', () => {
    expect(REGISTRY_ESTABLISHED).toBe(REGISTRY_ESTABLISHMENT.romanYear);
    expect(REGISTRY_ESTABLISHMENT_PROVENANCE_URL).toMatch(/^https:\/\/solscan\.io\/tx\//);
  });

  it('keeps pending chips on the established #E0B080 convention for future rows', async () => {
    const source = await readFile(resolve(repo, 'src/components/DisclosureTable.astro'), 'utf8');
    expect(source).toMatch(/\.status-chip--pending\s*\{[\s\S]*color:\s*#E0B080;/);
    // The attested chip is visually distinct from both verified and pending.
    expect(source).toMatch(/\.status-chip--operator-attested\s*\{[\s\S]*color:\s*#B6D4E4;/);
  });

  it('keeps the seven-row contract and receipt links localized in every catalog', () => {
    for (const locale of RELEASED_LOCALES) {
      const rows = disclosureRows(locale);
      expect(rows.map((row) => row.id), locale).toEqual(ROW_IDS);
      expect(rows.filter((row) => row.status === 'operator-attested').map((row) => row.id), locale)
        .toEqual([...ATTESTED_IDS]);
      expect(rows.filter((row) => row.status === 'verified').map((row) => row.id), locale)
        .toEqual([...VERIFIED_IDS]);
      expect(rows.filter((row) => row.status === 'pending').map((row) => row.id), locale)
        .toEqual([...PENDING_IDS]);
      expect(rows.every((row) => !`${row.statement} ${row.evidence}`.includes('[OPERATOR')), locale)
        .toBe(true);

      const origin = rows.find((row) => row.id === 'origin')!;
      expect(origin.links, locale).toHaveLength(SIGNS.length);
      expect(origin.links.map((link) => link.label), locale).toEqual(SIGNS.map((sign) => (
        additionFormat(
          locale,
          'disclosure.originSlot',
          { sign: signName(sign, locale), date: RECEIPT_DATE },
          EN['disclosure.originSlot'],
        )
      )));
      expect(
        origin.links.every((link) => link.href?.startsWith('https://solscan.io/tx/') && link.external),
        locale,
      ).toBe(true);

      const separation = rows.find((row) => row.id === 'separation')!;
      expect(separation.links.map((link) => link.href), locale).toEqual([
        localizePath(locale, '/privacy/'),
        localizePath(locale, '/methodology/'),
      ]);
    }
  });

  // Dist-dependent render check: skipped on a fresh clone (same idiom as
  // build-audit.test.ts); CI always builds before testing, so it runs there.
  it.skipIf(!existsSync(resolve(repo, 'dist')))('render-checks all five routes without pending chips or English copy leakage', async () => {
    for (const locale of RELEASED_LOCALES) {
      const html = await readFile(routeFile(locale), 'utf8');
      const route = localizePath(locale, '/disclosure/');
      // Enabled features add lifecycle attributes to the document root.
      // Keep the locale contract while checking the complete opening tag.
      expect(html, locale).toMatch(new RegExp(`<html lang="${LOCALE_META[locale].htmlLang}"(?:\\s[^>]*)?>`));
      expect(html, locale).toContain(`<link rel="canonical" href="https://zodiacs.org${route}">`);
      expect(html, locale).not.toContain('[OPERATOR');
      for (const key of [
        'operatorStatement',
        'operatorEvidence',
        'economicStatement',
        'economicEvidence',
      ] as const) {
        expect(html, `${locale}:disclosure.${key}`).toContain(disclosureText(locale, key));
      }
      expect(html.match(/class="[^"]*status-chip--pending[^"]*"/g), locale).toBeNull();
      expect(html.match(/class="[^"]*status-chip--operator-attested[^"]*"/g), locale).toHaveLength(2);
      expect(html.match(/class="[^"]*status-chip--verified[^"]*"/g), locale).toHaveLength(5);
      expect(html.match(/class="[^"]*establishment__pending[^"]*"/g), locale).toBeNull();
      expect(html, locale).toContain(`href="${REGISTRY_ESTABLISHMENT_PROVENANCE_URL}"`);
      expect(html, locale).toContain(disclosureText(locale, 'establishedProvenance'));
      expect(html.match(/class="[^"]*evidence-slot[^"]*"/g), locale).toBeNull();
      for (const receipt of originReceipts.receipts) {
        expect(html, `${locale}:${receipt.sign}`).toContain(`href="${receipt.explorerUrl}"`);
      }
      for (const link of disclosureRows(locale).find((row) => row.id === 'origin')!.links) {
        expect(html, `${locale}:${link.label}`).toContain(link.label);
      }

      for (const id of ATTESTED_IDS) {
        const row = routeRow(html, id);
        expect(row, `${locale}:${id}`).toContain('status-chip--operator-attested');
        expect(row, `${locale}:${id}`).toContain(disclosureText(locale, 'statusAttested'));
        expect(row, `${locale}:${id}`).not.toContain('status-chip--verified');
        expect(row, `${locale}:${id}`).not.toContain('status-chip--pending');
      }
      const originRow = routeRow(html, 'origin');
      expect(originRow, `${locale}:origin`).toContain('status-chip--verified');
      expect(originRow, `${locale}:origin`).not.toContain('status-chip--operator-attested');

      for (const hreflang of ['en', 'es', 'pt-BR', 'fr', 'it', 'x-default']) {
        expect(html, `${locale}:${hreflang}`).toContain(`hreflang="${hreflang}"`);
      }
      expect(html, locale).toContain(`href="${localizePath(locale, '/disclosure/')}"`);
      expect(html, locale).toContain(`href="${localizePath(locale, '/privacy/')}"`);
      expect(html, locale).toContain(`href="${localizePath(locale, '/methodology/')}"`);

      if (locale === 'en') continue;
      for (const key of ROUTE_TEXT_KEYS) {
        const english = EN[`disclosure.${key}`];
        if (english === disclosureText(locale, key)) continue;
        expect(html, `${locale} leaked disclosure.${key}`).not.toMatch(literalTextPattern(english));
      }
    }
  });
});
