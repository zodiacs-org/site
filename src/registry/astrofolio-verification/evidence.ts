/** Build-only adapter. Public output contains reviewed facts, never private review notes. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EN } from '../../strings/en.mjs';
import originReceipts from '../../data/registry-origin-receipts.json';
import { BASE_COMPARISON_NOTE, NORMALIZATION_NOTE } from './checker';

export const sourceRevision = '7f953e3fca0e7d5009e5602a1dad69edff0f54cc';
const inspectedAt = '2026-09-08';
const platformRevision = '4bb0d70eaaf21ea950a8fe708a0e1a91f8fb1f4f';
const registryPath = 'public/registry/zodiacs.registry.json';
const sourcePins = {
  [registryPath]: 'f6a581f499a5c523910c2ff6566e91204660b60d9e8ba9197399816c10d87cfd',
  'src/data/registry-origin-receipts.json': 'bfbfcb9099b2d4de2b850dbd812fc576115fefbab603abb853ad917cc932cc4f',
  'src/strings/en.mjs': 'e67c76f64fb33f009959b63d0f81121e3a8d57cca8be4e3db00bd4bd5bef27c5',
  'src/pages/about/index.astro': '61b2621faa7ad14008e5aba99cc69e7c8972d9cdc4e6848001a1b1aca1bc5492',
  'src/pages/terms/index.astro': '701c073875779f7938b85441511382da1b4db62f00495076b567c48083c48f87',
  'scripts/thesis-disclosure-reviewed.json': '5c69c2e7ae873e1848f3e7a00429332e8828efde3b786a29eec361d8bcb3edd9',
  'public/thesis/thesis-candidacy-evidence.json': '52aec3d81050a8b57070f8fbfeeebf235c3805b85f7c46cbbb8ea59d29efc13b',
} as const;

export const STATUS_LABELS = {
  'supported-by-public-record': 'Supported by published records',
  'operator-attested': 'Operator statement · not independently verified',
  planned: 'Candidate or proposal',
  unresolved: 'Unresolved',
  superseded: 'Superseded statement',
} as const;
export type ClaimStatus = keyof typeof STATUS_LABELS;
type ReviewPolicy = 'historical-record' | 'dated-statement' | 'release-state' | 'missing-evidence' | 'superseded-record';
export const REVIEW_POLICY_LABELS: Record<ReviewPolicy, string> = {
  'historical-record': 'Historical record; review if the receipt, interpretation, or canonical source is corrected. No routine expiry.',
  'dated-statement': 'Statement as of its recorded date; review when the relationship or supporting source changes. A rebuild does not confirm it anew.',
  'release-state': 'Release status at the recorded checkpoint; check a newer release record before describing availability today.',
  'missing-evidence': 'Unresolved until supporting evidence is supplied and reviewed. Elapsed time does not resolve the gap.',
  'superseded-record': 'Retained for context only; use the identified replacement within its stated scope.',
};
export const COMPARISON_POLICY = {
  normalization: NORMALIZATION_NOTE,
  base: BASE_COMPARISON_NOTE,
  network: 'Identifiers are compared only on the selected Solana mainnet or Base mainnet (8453) network and representation.',
  source: 'Each check requests the same-origin Registry with no-store, then validates its shape and exact SHA-256 digest against this reviewed snapshot. A failed request or changed digest establishes no match; there is no silent snapshot fallback.',
  privacy: 'Comparison runs in the browser. The Registry request contains no pasted address; same-origin cookies may accompany it for site or preview authentication. This check does not request a wallet connection, signature, approval, trade or network switch.',
  scope: 'A match proves membership in this Registry snapshot on the selected network. It does not prove wallet control, personal identity, legal ownership, safety or current chain state. Base byte comparison is not transaction checksum validation.',
};
export interface EvidenceSource { label: string; url: string; revision?: string; sha256?: string }
export interface Claim {
  id: string;
  title: string;
  subject: string;
  statement: string;
  status: ClaimStatus;
  qualifications: string[];
  sources: EvidenceSource[];
  observedAt: string | null;
  review: { method: string; reviewedAt: string; policy: ReviewPolicy };
}
export interface VerificationRecord {
  sign: string;
  displayName: string;
  chain: 'solana' | 'base';
  networkLabel: string;
  kind: 'native' | 'bridged';
  address: string;
  tokenStandard: string;
  chainId?: number;
  originReceipt?: { explorerUrl: string; blockTime: string };
}
interface Representation {
  sign: string; chain: string; kind: string; tokenStandard: string; address: string;
  chainId?: number; originAddress?: string; originChain?: string;
  isOfficialRepresentation: boolean; isCanonicalOrigin: boolean;
}
interface Registry {
  version: string;
  assets: Array<{ sign: string; displayName: string; native: Representation; representations: Representation[] }>;
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
export function assertSourcePin(path: keyof typeof sourcePins, text: string) {
  if (sha256(text) !== sourcePins[path]) {
    throw new Error(`Verification evidence source changed: ${path}. Review and repin the source revision before publishing.`);
  }
}
const sourceText = Object.fromEntries(Object.keys(sourcePins).map((path) => {
  const text = readFileSync(resolve(process.cwd(), path), 'utf8');
  assertSourcePin(path as keyof typeof sourcePins, text);
  return [path, text];
}));
export const registrySha256 = sha256(sourceText[registryPath]);
const source = (path: keyof typeof sourcePins, label: string): EvidenceSource => ({
  label,
  url: `https://github.com/ZodiacsOfficial/site/blob/${sourceRevision}/${path}`,
  revision: sourceRevision,
  sha256: sourcePins[path],
});
const registrySource = source(registryPath, 'Canonical Registry at the reviewed revision');
const disclosureSource = source('src/strings/en.mjs', 'Published disclosure statements');
const termsSource = source('src/pages/terms/index.astro', 'Published terms');
const originSource = source('src/data/registry-origin-receipts.json', 'Dated native-mint origin receipts');

/** Unknowns and dated statements never acquire a verified status by aging or rebuilding. */
export function claimFreshness(claim: Claim, asOf: string) {
  const afterObservation = claim.observedAt !== null && asOf.slice(0, 10) > claim.observedAt.slice(0, 10);
  if (claim.status === 'superseded') return 'superseded';
  if (claim.status === 'unresolved') return 'unresolved';
  if (claim.review.policy === 'historical-record') return 'historical-record';
  return afterObservation ? 'dated-observation-not-current-verification' : 'dated-observation';
}

/** A local guard, not a new shared evidence framework or an independent certification. */
export function validateClaims(claims: Claim[]) {
  const ids = new Set<string>();
  for (const claim of claims) {
    if (ids.has(claim.id)) throw new Error(`Duplicate claim: ${claim.id}`);
    ids.add(claim.id);
    if (!claim.sources.length || !claim.qualifications.length || !claim.review.method || !claim.review.reviewedAt) {
      throw new Error(`Claim lacks source, qualification or review metadata: ${claim.id}`);
    }
    if (!(claim.status in STATUS_LABELS)) throw new Error(`Unknown evidence status: ${claim.id}`);
    if (claim.observedAt !== null && !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/u.test(claim.observedAt)) {
      throw new Error(`Invalid observation date: ${claim.id}`);
    }
    const protectedStatus: Record<string, ClaimStatus> = {
      'operator-relationship': 'operator-attested', 'economic-interests': 'operator-attested',
      'holder-rights': 'unresolved', 'source-conflict': 'unresolved',
      'former-domain': 'superseded', 'platform-candidate': 'planned',
    };
    if (protectedStatus[claim.id] && claim.status !== protectedStatus[claim.id]) {
      throw new Error(`Unreviewed evidence promotion: ${claim.id}`);
    }
    if (claim.review.policy === 'missing-evidence' && claim.status !== 'unresolved') {
      throw new Error(`Missing evidence cannot support a positive assertion: ${claim.id}`);
    }
  }
  return claims;
}

export function createEvidence({
  registryText = sourceText[registryPath],
  receipts = originReceipts,
} = {}) {
  assertSourcePin(registryPath, registryText);
  if (JSON.stringify(receipts) !== JSON.stringify(originReceipts)) {
    throw new Error('Origin evidence differs from the reviewed source. Review and repin before publishing.');
  }
  const registry = JSON.parse(registryText) as Registry;
  if (registry.assets.length !== 12 || receipts.receipts.length !== 12) throw new Error('The reviewed collection requires twelve complete origin records.');
  const receiptMap = new Map(receipts.receipts.map((receipt) => [receipt.sign, receipt]));
  if (receiptMap.size !== 12) throw new Error('Duplicate or missing origin receipt.');
  const seen = new Set<string>();
  const records: VerificationRecord[] = registry.assets.flatMap((asset) => {
    const receipt = receiptMap.get(asset.sign);
    if (!receipt || receipt.mint !== asset.native.address || !receipt.verification.rpc.initializeMintObserved || !receipt.verification.solscan.initializeMintShown || !receipt.verification.solscan.mintAddressShown) {
      throw new Error(`Missing or contradictory origin evidence: ${asset.sign}`);
    }
    if (asset.representations.length !== 2) throw new Error(`Unexpected representations: ${asset.sign}`);
    return asset.representations.map((representation) => {
      const { chain, kind, address } = representation;
      const native = chain === 'solana' && kind === 'native' && address === receipt.mint && representation.tokenStandard === 'SPL' && representation.isCanonicalOrigin;
      const bridged = chain === 'base' && kind === 'bridged' && representation.chainId === 8453 && representation.originAddress === receipt.mint && representation.originChain === 'solana' && representation.tokenStandard === 'ERC20' && !representation.isCanonicalOrigin;
      if ((!native && !bridged) || !representation.isOfficialRepresentation || representation.sign !== asset.sign) {
        throw new Error(`Contradictory network or representation: ${asset.sign}`);
      }
      const identity = `${chain}:${chain === 'base' ? address.toLowerCase() : address}`;
      if (seen.has(identity)) throw new Error(`Duplicate Registry identity: ${asset.sign}`);
      seen.add(identity);
      return {
        sign: asset.sign, displayName: asset.displayName, chain: chain as VerificationRecord['chain'],
        networkLabel: native ? 'Solana mainnet' : 'Base · chain 8453',
        kind: kind as VerificationRecord['kind'], address, tokenStandard: representation.tokenStandard,
        ...(representation.chainId ? { chainId: representation.chainId } : {}),
        ...(native ? { originReceipt: { explorerUrl: receipt.explorerUrl, blockTime: receipt.blockTime } } : {}),
      };
    });
  });
  const review = (policy: ReviewPolicy, method: string, reviewedAt = inspectedAt) => ({ policy, method, reviewedAt });
  const claims: Claim[] = [
    {
      id: 'collection-identity', title: 'One collection, one published Registry', subject: 'Astrofolio and the published Registry',
      statement: `Astrofolio is the collection experience at Zodiacs.org. Registry ${registry.version} lists ${registry.assets.length} Zodiac assets: native Solana records and bridged Base representations.`,
      status: 'supported-by-public-record', observedAt: '2026-08-23',
      sources: [registrySource, disclosureSource],
      qualifications: ['This identifies the operator-published collection. It does not confer ownership of astrology or authority over unrelated zodiac projects.', 'Solana and Base identifiers are separate network-specific records. Bridge classification is not an audit of bridge security.'],
      review: review('dated-statement', 'Compared the canonical Registry with the published Astrofolio relationship statement.'),
    },
    {
      id: 'registry-match', title: 'What a match establishes', subject: 'Registry classification',
      statement: EN['disclosure.adviceEvidence'], status: 'supported-by-public-record', observedAt: null,
      sources: [registrySource, termsSource, disclosureSource],
      qualifications: ['A name or ticker alone cannot establish a match. An unmatched identifier is not necessarily fraudulent.', 'Another interface using the listed assets is not automatically affiliated, authorized, or hostile.'],
      review: review('dated-statement', 'Read the published definition of official and compare identifiers within the selected network.'),
    },
    {
      id: 'operator-relationship', title: 'The stated operator', subject: 'Zodiacs LLC and site control',
      statement: EN['disclosure.operatorStatement'], status: 'operator-attested', observedAt: '2026-08-23',
      sources: [disclosureSource, source('src/pages/about/index.astro', 'Published company description')],
      qualifications: [EN['disclosure.operatorEvidence'], 'The About page describes Zodiacs LLC as a New Mexico company formed on August 11, 2026. This adapter does not independently verify a company filing or an assignment of rights.'],
      review: review('dated-statement', 'Preserved the operator-attested classification and original statement date.'),
    },
    {
      id: 'economic-interests', title: 'Economic interests remain attested', subject: 'Operator holdings and compensation',
      statement: EN['disclosure.economicStatement'], status: 'operator-attested', observedAt: '2026-08-02',
      sources: [disclosureSource],
      qualifications: ['The statement is not independently verified. It does not enumerate assets, wallets, amounts, lockups, vesting, or a disposal policy.', 'No private holdings or beneficial owners are inferred from wallet addresses or token-account concentration. The later domain update does not refresh this attestation.'],
      review: review('dated-statement', 'Kept the holdings attestation separate from the August 23 domain update.'),
    },
    {
      id: 'native-origin', title: 'Native mint origins: 5 July 2024', subject: 'The twelve canonical Solana mint accounts',
      statement: EN['disclosure.originStatement'], status: 'supported-by-public-record', observedAt: receipts.establishment.earliestReceipt.blockTime,
      sources: [originSource, { label: 'Earliest listed native origin receipt', url: receipts.establishment.earliestReceipt.explorerUrl }],
      qualifications: [`All twelve recorded initializations are dated 5 July 2024. The source review is dated ${receipts.reviewedAt}; this page does not perform a new chain audit.`, 'The recorded method is parsed RPC initializeMint inspection plus Solscan indexer cross-checks. These are limited record checks, not an independent security or legal certification.', 'Native mint creation is distinct from company formation, brand history and a product launch. These receipts do not establish a first-in-category claim or a Base bridge creation date.'],
      review: review('historical-record', 'Reused the reviewed origin receipts and checked each mint against the canonical Registry; original RPC/indexer review dates preserved.', receipts.reviewedAt),
    },
    {
      id: 'holder-rights', title: 'Token-holder benefits are not established', subject: 'Rights or benefits arising from holding a listed asset',
      statement: 'The available records do not establish a token-holder entitlement to dividends, revenue, governance, merchandise, intellectual property, or privileged astrology access.',
      status: 'unresolved', observedAt: null,
      sources: [termsSource, disclosureSource],
      qualifications: ['This is a gap in the inspected evidence, not a determination that no rights can exist. Any entitlement needs the applicable published terms or grant.', 'A proposed capability, a symbolic display, or company ownership of site content does not itself grant rights to token holders.'],
      review: review('missing-evidence', 'Reviewed the published terms and disclosure; no token-holder grant was identified in that source set.'),
    },
    {
      id: 'source-conflict', title: 'A filled field is not a verified claim', subject: 'Treasury and continuity evidence labels',
      statement: 'The thesis data uses “filled” for some fields whose provenance is an operator statement. That rendering label does not independently verify the statement.',
      status: 'unresolved', observedAt: '2026-07-14',
      sources: [source('scripts/thesis-disclosure-reviewed.json', 'Reviewed thesis source and provenance note'), disclosureSource],
      qualifications: ['The thesis source says its no-project-treasury classification was supplied by the owner. A holder page cannot by itself prove who beneficially owns or controls an account.', 'The later disclosure leaves token authorities, treasury, liquidity and market control outside its domain-control attestation. This page does not resolve that gap or overwrite either source.'],
      review: review('missing-evidence', 'Compared source provenance with the disclosure classification; retained the conflict rather than promoting a filled value.'),
    },
    {
      id: 'former-domain', title: 'An earlier domain statement is superseded', subject: 'Astrofolio’s former separate-surface description',
      statement: 'The August 23 operator update supersedes the August 2 description of Astrofolio and the former domain as separate consumer surfaces.',
      status: 'superseded', observedAt: '2026-08-02', sources: [disclosureSource],
      qualifications: ['The replacement is itself operator-attested. Supersession applies only to the domain/surface relationship, not to holdings or compensation.', 'This is not a fresh check of the former domain’s redirect.'],
      review: review('superseded-record', 'Read the explicit supersession scope in the canonical disclosure.'),
    },
    {
      id: 'platform-candidate', title: 'A tested candidate is not a public release', subject: '@zodiacs/engine@0.1.1-rc.1',
      statement: 'The inspected platform status describes @zodiacs/engine@0.1.1-rc.1 as an implemented and tested candidate, with npm publication and production release still held.',
      status: 'planned', observedAt: '2026-09-07',
      sources: [{ label: 'Platform status at the inspected branch revision', url: `https://github.com/ZodiacsOfficial/site/blob/${platformRevision}/docs/platform/STATUS.md`, revision: platformRevision }, source('public/thesis/thesis-candidacy-evidence.json', 'Earlier Registry SDK publication observations')],
      qualifications: ['This is a dated repository report, not tests rerun here, an unrestricted launch, or evidence of outside adoption.', 'This release statement concerns the named engine candidate. Earlier published @zodiacs/sdk versions are a separate package history.', 'A candidate or proposed future feature establishes no token-holder legal entitlement.'],
      review: review('release-state', 'Read the primary platform status on its actual branch; retained the exact candidate version and explicit release hold.'),
    },
    {
      id: 'public-information', title: 'Read the collection without connecting a wallet', subject: 'Published collection, Registry and disclosure information',
      statement: 'The Astrofolio collection, Registry identifiers and disclosure records provide public information that can be read without a wallet connection or purchase.',
      status: 'supported-by-public-record', observedAt: inspectedAt,
      sources: [{ label: 'Public Astrofolio collection', url: 'https://zodiacs.org/astrofolio/' }, registrySource, disclosureSource],
      qualifications: ['Public Astrofolio and disclosure text was retrieved on 2026-09-08. This observation is not an end-to-end test of every product feature.', 'The separate optional buying tool has a different transaction boundary. Merely reading a record does not prove a wallet holder’s identity or ownership.'],
      review: review('dated-statement', 'Read public page text and canonical identifiers; did not connect a wallet or perform a transaction.'),
    },
  ];
  validateClaims(claims);
  return {
    registryVersion: registry.version, registrySha256, sourceRevision,
    comparisonPolicySources: [{
      label: 'Comparison and source-loading implementation',
      url: 'https://github.com/ZodiacsOfficial/site/blob/59923241f49942025add0463b56984cdd0c5c668/src/registry/astrofolio-verification/checker.ts',
      revision: '59923241f49942025add0463b56984cdd0c5c668',
    }],
    sourceUrl: '/registry/zodiacs.registry.json', observedAt: inspectedAt,
    observationScope: 'Source adapter inspection only; claim dates and original reviews remain separate.',
    reviewScope: 'Operator-published sources and their dated evidence. This page is not independent certification.',
    freshnessPolicies: REVIEW_POLICY_LABELS,
    comparisonPolicy: COMPARISON_POLICY,
    records, claims,
  };
}

export const evidence = createEvidence();
