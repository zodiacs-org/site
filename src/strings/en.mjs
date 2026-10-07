/**
 * English source catalogue for additive trust/growth surfaces.
 *
 * Keep these keys stable: the parallel locale branch can translate this
 * catalogue without searching Astro, JSX, or generated HTML. Until a locale
 * supplies a value, new pages deliberately fall back to this English copy.
 */
export const EN = Object.freeze({
  'disclosure.metaTitle': 'Disclosure — Zodiacs.org Registry',
  'disclosure.metaDescription': 'Plain-language operator, economic-interest, provenance, public-address lookup, external purchase-link, Registry classification, and digital-asset risk disclosures.',
  'disclosure.kicker': 'Registry disclosure',
  'disclosure.title': 'The facts, including the unresolved ones.',
  'disclosure.intro': 'This page separates facts supported by public evidence from statements supplied by the operator, Zodiacs LLC. An operator attestation is dated and labeled as an attestation; it is never presented as independently verified.',
  'disclosure.scope': 'These disclosures apply to the Registry wing. The astrology tools remain free, browser-computed, and usable without the Registry.',
  'disclosure.tableLabel': 'Registry disclosures and evidence status',
  'disclosure.statementHeading': 'Statement',
  'disclosure.evidenceHeading': 'Status and evidence',
  'disclosure.statusVerified': 'Verified from published materials',
  'disclosure.statusAttested': 'Operator attested — not independently verified',
  'disclosure.statusPending': 'Pending operator confirmation',
  'disclosure.operatorLabel': 'Operator relationship',
  'disclosure.operatorStatement': 'Operator update (2026-08-23): The operator controls the zodiacs.org domain, repository, deployments, Registry content, and the official Astrofolio consumer experience at zodiacs.org/astrofolio. astrofolio.xyz redirects to that page and is not a separate consumer surface. This update does not establish who controls token deployment or administrative authorities, treasury, liquidity, or market activity.',
  'disclosure.operatorEvidence': 'Based on an operator-supplied domain update dated 2026-08-23; not independently verified. It supersedes only the 2026-08-02 claim that the former domain and Astrofolio were separate consumer surfaces. The holdings and no-compensation attestation remains separately dated 2026-08-02.',
  'disclosure.economicLabel': 'Economic interest',
  'disclosure.economicStatement': 'The operator attests (2026-08-02) to holding positions in one or more of the twelve Registry assets, and to receiving no referral, platform-fee, liquidity, or marketplace compensation for any trade reached through the site.',
  'disclosure.economicEvidence': 'The holdings attestation is the operator’s own statement, dated 2026-08-02 and not independently verified; assets, wallets, amounts, and any lockup, vesting, or disposal policy are not enumerated in it, and private holdings are not inferred from any wallet. Holder distribution is reported through public snapshots. As of 20 July 2026, the top-ten token-account share ranged from 23.0% to 30.6% across the twelve assets, with a median of 27.2%. The figures can be checked against the published snapshots and public chain records.',
  'disclosure.economicSnapshotsLink': 'Distribution snapshots',
  'disclosure.originLabel': 'Origin',
  'disclosure.originStatement': 'Each canonical record is evidenced by its origin receipt: the transaction that created the sign’s native mint on Solana.',
  'disclosure.originEvidence': 'All twelve receipts are dated 5 July 2024. Each was located by instruction-level inspection on archival RPC and cross-checked against Solscan’s independently indexed public pages; token names were never used as evidence. Base representations are official bridges and are disclosed separately in the thesis instrument table.',
  'disclosure.originSlot': '{sign} origin receipt — {date}',
  'disclosure.separationLabel': 'Separation',
  'disclosure.separationStatement': 'The core astrology tools remain free, contain no advertising or cross-site trackers, and can be used without the Registry. Registry Collection is an optional cross-link that reads a saved chart and one public wallet record side by side; the wallet record does not alter the chart calculation.',
  'disclosure.separationEvidence': 'The calculators compute in the browser and require no Registry interaction. Aura keeps chart computation local and sends only the selected public address through its holdings lookup.',
  'disclosure.readOnlyLabel': 'Read-only posture',
  'disclosure.readOnlyStatement': "Zodiacs.org does not connect wallets, request signatures, or submit transactions. Public address lookups use an address you paste. Purchase links open independent services with their own terms and risks.",
  'disclosure.readOnlyEvidence': "Zodiacs.org does not connect wallets, request signatures, or submit transactions. Public address lookups use an address you paste. Purchase links open independent services with their own terms and risks.",
  'disclosure.tradeLabel': 'Catalogue transaction boundary',
  'disclosure.tradeStatement': "Zodiacs.org does not connect wallets, request signatures, or submit transactions. Public address lookups use an address you paste. Purchase links open independent services with their own terms and risks.",
  'disclosure.tradeEvidence': "Zodiacs.org does not connect wallets, request signatures, or submit transactions. Public address lookups use an address you paste. Purchase links open independent services with their own terms and risks.",
  'disclosure.linkTradeExample': "Public address guide",
  'disclosure.adviceLabel': 'Financial advice and solicitation',
  'disclosure.adviceStatement': 'Registry records, market context, and Registry Collection are not financial advice or a solicitation to buy, sell, or hold an asset. The Collection is a symbolic reflection, not a wallet score or price signal, and no purchase is required.',
  'disclosure.adviceEvidence': '“Official” is a Registry classification only: it means an address, contract, mint, or representation matches the Registry’s published list—not government approval, identity verification, safety, value, liquidity, or future performance. Contextual notices and the terms state the digital-asset risks.',
  'disclosure.linkPrivacy': 'Privacy',
  'disclosure.linkMethodology': 'Methodology',
  'disclosure.linkRegistry': 'Machine-readable Registry',
  'disclosure.linkSdk': 'SDK posture',
  'disclosure.linkTerms': 'Terms',
  'disclosure.linkThesis': 'Thesis',
  'disclosure.establishedLabel': 'Registry establishment',
  'disclosure.establishedPrefix': 'Est.',
  'disclosure.establishedProvenance': 'Earliest origin receipt · 2024-07-05',
  'disclosure.establishedPending': 'Earliest deploy provenance — pending',
  'disclosure.operatorRequest': 'What “operator attested” means',
  'disclosure.operatorRequestBody': 'The operator-relationship row summarizes the operator’s dated domain update. The economic-interest row carries forward the operator’s separately dated attestation. Neither is independently verified, so both carry the attestation chip rather than the verified one. Every other row links evidence a stranger can check.',
  'disclosure.backRegistry': 'Return to Zodiacs Registry',
  'disclosure.linkLabel': 'Disclosure',
  'disclosure.aboutNotice': 'The Registry’s operator and economic-interest attestations, the twelve dated origin receipts, and the establishment provenance are published on the disclosure page.',
  'disclosure.aboutLink': 'Read the Registry disclosure',
  'disclosure.provenancePendingShort': 'Deploy provenance pending',
  'disclosure.provenanceShort': 'Origin receipts — 5 Jul 2024',
  'registry.verifierNotFoundSentence': 'Not found in the official Zodiacs.org registry.',
  'registry.verifierNotFoundInline': 'not found in the official Zodiacs.org registry',
  'registry.establishmentProvenanceLink': 'Provenance ↗',
  'registry.ogLotAlt': '{sign} — Nº {number} of 12, Lot {lot} of XII in the official Zodiacs.org Registry.',
  'archive.receiptsLabel': 'Receipts',
  'archive.archivedReceipt': 'Archived copy',
  'archive.pendingPrimary': 'Pending archived primary source',
  'archive.verifiedRegistry': 'Matches the official record',
  'archive.entries.accidental-libra.receipts.wrongLibra': 'Portnoy: “I’m buying the wrong libra”',
  'archive.entries.accidental-libra.receipts.mintAddress': 'Portnoy post containing the Libra mint address',
  'archive.entries.zodiac-iwo.receipts.primary': 'inversebrah: zodiac shorthand post',
  'archive.entries.onboarding-wave.receipts.primary': 'wantonwallet: 1,200+ wallet onboarding record',
  'archive.entries.astrology-girlies.receipts.primary': 'iJaadee: astrology community call',
  'archive.entries.oldest-meme.receipts.primary': 'Andrew Kang: “Human Civilization’s Oldest Meme”',
  'archive.entries.astrologers-arrive.receipts.primary': 'TikTokInvestors: “The astrologers have arrived”',
  'archive.entries.horoscopes-to-hodl.receipts.primary': 'Numinous Realm: “Horoscopes to HODL”',
  'archive.entries.origin.receipts.registry': 'Published machine-readable registry',
  'archive.entries.pure-belief.receipts.primary': 'CZ: “Just a pure belief system”',
});

/** @param {keyof typeof EN} key @returns {string} */
export function en(key) {
  return String(EN[key]);
}

/**
 * @param {keyof typeof EN} key
 * @param {Record<string, string | number>} values
 * @returns {string}
 */
export function enFormat(key, values) {
  return Object.entries(values).reduce(
    (copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)),
    String(EN[key]),
  );
}
