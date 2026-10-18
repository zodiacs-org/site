import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// July measurements and their embedded inventory are a historical snapshot.
// Current catalog parity and placeholders are checked by build-i18n-additions.test.mjs.
const additions = await readFile(resolve(root, 'docs/build-report-2026-07-15/i18n-additions.md'), 'utf8');
const additionCount = additions.match(/^- `[^`]+`$/gm)?.length ?? 0;

if (additionCount !== 541 || !additions.includes('- `footerDisclosure`')
    || createHash('sha256').update(additions).digest('hex') !== '383b4ee60a93dc8c85e3325eab349a9a22a08429430d567a8e541292ed33b3b2') {
  throw new Error(`Expected the pinned historical 541-key i18n manifest; found ${additionCount} keys or altered bytes.`);
}

const report = `# BUILD REPORT — Trust, Growth Infrastructure & SDK Expansion

Generated 2026-07-15 from site branch \`codex/trust-growth-sdk-expansion-locales\`, rebased onto main \`24a835637af8cadd43e07995611fa5d9fd86026c\`. Package evidence comes from \`codex/engine-expansion\` at \`cced011659d48877b8b73b8a85796815234cf741\`.

Maintenance note (2026-09-19): the generator embeds the pinned historical inventory in \`docs/build-report-2026-07-15/i18n-additions.md\`. The root inventory describes current catalogs and is validated separately; none of the July measurements below were rerun.

## Outcome and limits of this report

All eight directive workstreams are implemented in the local site/package worktrees. The current site build is green, emits 1,824 Astro pages and 1,923 final HTML documents, and the latest unit run passes 555/555 tests across 87 files. The engine/SDK workspace passes 146/146 tests across 22 files.

This is an implementation and local-verification report, not a deployment claim. No production deploy, live analytics-provider event check, credentialed ESP delivery, live archival-chain provider check, or physical-device install check was performed without operator configuration. Those externally dependent acceptance items are identified below. Pending factual disclosures and missing archived receipts continue to render with the existing \`#E0B080\` pending-chip convention.

This report predates the later, feature-flagged Registry Collection work. Registry Collection can, only after a visitor's click, ask an installed wallet for the selected public address or accept a pasted public address. Zodiacs.org does not request a private key, signature, approval, payment, swap, network change, or transaction for the Collection; birth-chart data remains in the browser. Outbound wallet applications and trading venues are independent third parties with their own prompts, risks, and data practices.

## Source-control and locale coordination

- Locale foundation: PRs #100–#103 are present in main \`24a8356\`; the active rails are EN, ES, PT, FR, and IT.
- Additive replay: \`3bb50732d58f62fddc5d5e9e9733f1a25dcc46a0\` re-expressed the non-shared growth work on the five-locale structure.
- Shared surfaces were isolated and rebased one surface per commit. The Registry surface is \`e66f1e0\`, global head is \`a16af01\`, and footer is \`9a2a26e\`. The full Site Checks were rerun after each surface before proceeding.
- Navigation was not touched; there is no nav shared-surface commit.
- The coordinated indexing change is \`115543c\`. It is separate from all shared-surface work.
- Existing locale templates, \`LOCALE_META\`, split UI catalogues, localized paths, RSS links, WebMCP behavior, and locale language attributes were retained. New shared strings use catalogue keys. English fallback is intentional where a translation is still pending.

## Stack and repository audit

- Site: Astro 7 static output, Preact islands, TypeScript, Vite, Vitest, existing handcrafted CSS/tokens, committed data/assets, custom search/sitemap generators, and Vercel serverless functions under \`api/\`.
- Static-first posture: Astro pages render meaningful HTML before hydration. Registry pages remain committed/generated static documents sourced from the existing \`src/app.jsx\` and legacy build scripts; JavaScript only enhances filtering, verification, sharing, and optional market context.
- Astronomy: browser-first computation uses the MIT-licensed \`astronomy-engine\` dependency through the vendored \`@zodiacs/engine\` package. GeoNames and historical timezone resolution remain optional boundaries. The existing opt-in saved-chart sync was not modified.
- i18n: five strict locale rails (EN/ES/PT/FR/IT) with split UI catalogues and locale metadata. The additive manifest contains 541 keys. PT/FR/IT often use the documented English fallback for new work; Spanish and all-locale translations that already exist are recorded per key in \`i18n-additions.md\`.
- Deployment/CI: Vercel static/serverless output and GitHub Site Checks. No new framework, meta-framework, CSS system, consent banner, or account/paywall layer was introduced.
- Design tokens: existing Cosmic Void \`#060709\`, silver ink/type system, \`#E0B080\` pending state, spacing/radius/type scale, Instrument Sans, and Registry \`Nº\` convention.
- Canonical art: every added visual family uses \`/assets/zodiac-icons/48/{sign}.webp\` or \`/assets/zodiac-icons/128/{sign}.webp\`; there are no emoji, third-party glyphs, or substitute zodiac illustrations.

## Verification: current main baseline versus rebased result

The “before” column is current locale main \`24a8356\` before the growth replay. The “after” column is the rebased growth branch after the coordinated indexing commit and final report/i18n updates.

| Gate | Before: locale main | After: rebased growth branch |
| --- | --- | --- |
| Unit tests | 472 passed; 1 pre-existing deterministic snapshot failed | 555/555 passed across 87 files (latest run, 2026-07-15) |
| Astro production build | Green; 1,807 pages | Green; 1,824 pages; 832 search entries; 46.0 KB gzip search index |
| Distribution check | 1,824 HTML; 818 search entries; 9 feed items | 1,923 HTML; 832 search entries; 9 feed items |
| JSON-LD schema gate | Directive schema script absent | 795 JSON-LD documents; 3,146 graph nodes; 0 errors |
| Sitemap | Locale-project preservation baseline | 798 \`<loc>\` entries; 750 valid alternate links; zero WS5 hreflang alternates |
| Service worker | Locale-main shell | 158 precache URLs; cache \`908fb24d08af\`; Registry identity remains network-first/fetch-only |
| Programmatic uniqueness | No directive threshold gate | 78 pairs; maximum 5-gram Jaccard similarity 0.014; limit 0.42 |
| Visual regression | Locale-main baselines | 9/9 green; maximum changed pixels 0.0974%, below the 0.1% limit |
| Engine/SDK workspace | 110/111; one encoded-path documentation assertion | 146/146 across 22 files; engine/widgets/SDK build and typecheck green |

Additional local evidence:

- \`astro check\`: 0 errors and 3 non-blocking hints.
- Bundle gates, gzip actual/budget: home 26.6/42 KB; birth chart 44.6/52 KB; transits 19.6/30 KB; solar return 17.9/30 KB; today 15.7/16 KB; compatibility 25.0/35.5 KB; largest chunk 51.4/60 KB; engine chunk 21.1/25 KB. Engine isolation remained clear.
- Widget budgets: Moon and sky ship 0 KB initial JavaScript; the keyboard-complete mini chart ships 14.6 KB initial JavaScript gzip and 11.8 KB HTML; the script loader is 0.9 KB gzip.
- Schema: \`node scripts/validate-schema.mjs\` reports 795 documents, 3,146 nodes, 0 errors.
- Distribution: \`node scripts/check-dist.mjs\` reports 1,923 HTML files, 832 search entries, 9 feed items, Registry intact.
- Sitemap: 798 locations and 750 alternates in \`dist/sitemap.xml\`.
- Main-page Lighthouse: performance 100 on all nine runs, TBT 0, CLS 0.001; median LCP 0.63 s home, 0.66 s birth chart, and 0.48 s Aries.
- Widget Lighthouse: moon 100/100 performance/accessibility, sky 100/96, mini chart 100/100; every score meets the ≥95 acceptance floor.
- Foreign-origin widget browser checks pass for all three embeds.
- Client share rendering in the deterministic T17 run: full chart 64 ms and Big Three 42 ms, both 1080×1350; cancellation, privacy, and analytics-event assertions pass.
- Serverless TypeScript smoke bundles: email subscribe 58.6 KB, email confirm 57 KB, wallet birth 40.1 KB, push subscribe 4.9 KB.
- OG verifier: all 45 directive-required files are distinct 1200×630 PNGs and the existing global fallback remains frozen.

## Workstream status against acceptance criteria

### WS1 — Trust and disclosure

**Implemented locally; factual evidence remains operator-dependent.** \`/disclosure/\` renders the six required rows, dry evidence/status language, twelve deploy-transaction slots, astrology/Registry separation, read-only guarantees, and no-advice/no-solicitation statement. The Registry header/footer, Registry lots, About, Thesis, Archive, and SDK surfaces link to it; astrology-tool navigation was not expanded.

Archive data now requires \`receipts: [{ label, url, archivedUrl }]\`, renders external chips with \`rel="noopener nofollow"\`, and emits a build warning for zero-receipt entries. \`accidental-libra\` cannot become verified without an archived primary source and remains pending. The following receipt IDs have direct URLs but still have empty \`archivedUrl\` slots: \`accidental-libra\` (first priority), \`zodiac-iwo\`, \`onboarding-wave\`, \`astrology-girlies\`, \`oldest-meme\`, \`astrologers-arrive\`, \`horoscopes-to-hodl\`, \`origin\`, and \`pure-belief\`.

Registry establishment text consumes the single source \`src/lib/registry-establishment.mjs\`. \`MMXXIV\` remains provisional, visibly paired with a pending provenance slot. Acceptance is complete for route/link/schema behavior; operator wording, year, transaction evidence, and archived sources are unresolved.

### WS2 — Growth infrastructure

**Implemented locally; live-provider acceptance is pending credentials.**

- Analytics: the Plausible-compatible shim is absent when unset and loads with \`defer\` only when configured. It canonicalizes paths, nulls outbound referrers, and allowlists the eleven directive events plus existing fixed-enum events. The integration uses no cookies or persistent/browser fingerprinting. Under the accepted bounded exception, Plausible may briefly process the request IP address and User-Agent into a salted site/device/day identifier for aggregate deduplication; raw values are not stored, the salt rotates and is deleted every 24 hours, and no identifier is exposed to Zodiacs.org or Growth OS. It rejects query strings, free text, birth details, chart positions, email values, and wallet addresses. The taxonomy is documented in \`docs/ANALYTICS.md\`. Local event tests pass; “events visible in analytics” requires a configured deployment and remains pending.
- Email: one \`EmailCapture\` powers post-chart, \`/horoscopes/\`, and astrology-footer placements in all five locale rails. Only normalized email plus optional self-declared sun sign enters the adapter. Resend, Buttondown, and Loops are env-selected and the component is omitted when configuration is incomplete. Scanner-safe opaque AES-GCM Resend confirmation and a mocked end-to-end Buttondown request pass. A credentialed delivery/confirmation smoke test against the operator's chosen ESP remains pending.
- OG/Twitter: 45 directive-required images are unique 1200×630 PNGs, use canonical sign art, and are wired per page; the cache-busted \`/assets/og/v2/share-pastel-wheel-20261019.png\` is the global fallback. The complete rendered inventory appears below.
- Structured data: homepage \`WebSite\`, \`Organization\`, and existing FAQ \`FAQPage\`; sitewide \`BreadcrumbList\`; guide/learn \`Article\` (including the five learn section hubs); and tool \`WebApplication\` validate with 0 errors. Disclosure references the canonical site \`@id\`.

### WS3 — Shareable result cards

**Acceptance complete in local browser tests.** Big Three, full-chart, and compatibility cards render entirely client-side at 2× output, use canonical icons as their only illustration, provide Web Share with download fallback, and fire \`share_card_downloaded\`. The full-card boundary receives chart results rather than raw birth input, uses a generic filename, and renders only fields the user selected. Deterministic Big Three/full-card timings are well below one second; compatibility and cancellation/error paths pass.

### WS4 — PWA and retention scaffold

**Implementation and automated acceptance complete; physical-device smoke remains a deployment-candidate check.** \`site.webmanifest\` and the 192/512/maskable icons use the twelve-icon wheel motif on \`#060709\`. The worker precaches 158 versioned tool-shell/data URLs under cache \`908fb24d08af\`, while Registry identity JSON is never authoritative from a stale cache. The prompt appears after the second computed chart and a local dismissal prevents repeat prompts.

Push remains default-off. Client, endpoint, worker, and delivery code require both public/server flags and VAPID configuration; the default production worker has push disabled and the client does not expose the prompt. iOS/Android installability was validated through manifest/worker/browser gates, but a final physical-device install smoke should be run on the deployment candidate.

### WS5 — Programmatic SEO and coordinated indexing

**Acceptance complete for English static generation/indexing.** The 78 compatibility pairs and 366 birthday pages were already collection-backed on locale main and already self-canonical; this branch preserves that implementation and adds the engine-derived CTA/share/indexing work without duplicating routes. The uniqueness gate is 0.014 versus 0.42. Birthday pages retain verified 1940–2030 sign/date data, degrees, decans, cusp handling, adjacent-day links, and chart/sign CTAs.

The Chinese-zodiac hub and twelve animal-year pages are statically rendered, self-canonical, internally linked, culturally framed, and explicitly separated from Western tropical astrology.

Coordinated commit \`115543c555fa834f54eeec505e120797cb16ad19\` adds exactly fourteen EN sitemap locations—\`/disclosure/\` plus the Chinese-zodiac hub and twelve animal pages—while count-gating all 78 pair and 366 birthday pages already emitted by the collections. It refreshes the locale drift baseline to the intentional new output rather than disabling drift protection. WS5 pages have zero hreflang alternates because no WS5 translation exists; TODO(i18n) assertions preserve that rule. \`robots.txt\` was already correct and was not changed.

Final sitemap: 798 locations and 750 alternates. Existing translated pages retain only real EN/ES/PT/FR/IT/x-default relationships.

### WS6 — Embeddable widgets

**Acceptance complete in local foreign-origin and Lighthouse tests.** \`/widgets/\` builds live previews and copyable iframe/script snippets for Moon phase today, The sky today, and Mini birth chart. Theme/accent inputs are constrained for readable contrast. Every embed retains canonical zodiac art and the non-removable \`Powered by Zodiacs.org\` link. Embeds contain no visitor analytics; only the parent generator fires \`widget_embed_copied\`. The iframe documents are standalone and lazy-load chart computation; all Lighthouse scores are ≥95.

### WS7 — Engine and widgets packages

**Package implementation/verification complete; npm publication is pending operator action.** The licensing gate is GO, detailed below. \`@zodiacs/engine@0.1.0\` exposes \`positions\`, \`natalChart\`, \`transits\`, \`synastry\`, \`moonPhase\`, \`saturnReturn\`, the requested type vocabulary, whole-sign/Placidus houses, browser/Node ESM, and optional \`@zodiacs/engine/geo\`. The site consumes the exact vendored package artifact, preventing a second calculation implementation from drifting.

\`@zodiacs/widgets@0.1.0\` wraps WS6 mounting. \`@zodiacs/sdk\`'s read-only API was not changed; only sibling cross-links/documentation/posture coverage changed. TypeDoc is at \`/sdk/engine/\`, and root \`llms.txt\` / \`llms-full.txt\` cover Registry, SDK, engine, and copy-paste integrations.

Package audits: engine 17 files, 17.4 KB compressed / 58.4 KB unpacked; widgets 5 files, 4.9 KB compressed / 13.7 KB unpacked. Vendored engine SHA-256 is \`8da3e0f2eb3818fe2c5833e05331be61da9b605ffa118a8462182821412e7cbe\`. Neither new package has been published to npm.

### WS8 — Wallet natal chart

**Implemented and mocked for both chains; live-provider acceptance remains pending and the feature is off.** \`/registry/wallet-chart/\` is paste-only, validates Solana base58/Base \`0x\` formats, uses the Registry's neutral not-found language, and has no connect/sign/approval/transaction path. A \`WalletBirthProvider\` supports paginated Solana history and Base explorer/history fallback with explicit cost/completeness caveats and bounded cache behavior.

The chart is UTC, planets-in-signs only: a wallet has a time but no birthplace, houses, or angles. Optional owner details and synastry remain in the browser; the endpoint receives only a pasted public address. Official held-sign context appears only after a positive read-only balance result. Share art truncates the address and preserves the symbolic/read-only/not-financial-advice posture. \`wallet_chart_computed\` never includes the address.

The route/API hide unless \`PUBLIC_WALLET_CHART_ENABLED=1\` and a provider exists. Local mocked Solana/Base tests pass; credentialed oldest-history checks against archival providers remain pending.

## WS7 licensing gate

**Outcome: GO for MIT extraction, subject to the repository operator having authority to publish the Zodiacs.org-authored adapter code under MIT. No Swiss Ephemeris-derived code or fixture was shipped.**

- Provenance traces to Zodiacs.org TypeScript adapters over \`astronomy-engine@2.1.19\`, whose npm/source license is MIT (Don Cross, 2019–2023).
- Repository, dependency, package, and bundled-output scans found no Swiss Ephemeris runtime import, package, vendored source, table, or binary.
- Website-only Placidus reference constants generated with \`pyswisseph\` were explicitly excluded from the distributable package.
- Package accuracy uses public JPL Horizons vectors, geometric/astronomical invariants, and synthetic aspects. Maximum modern longitude error is 0.004104°; historic maximum is 0.001735°, within the site-equivalent hundredths-of-a-degree tolerance.
- \`@zodiacs/engine/geo\` is code-only. It bundles no GeoNames records or tzdb. \`NOTICE\` includes GeoNames CC BY 4.0 and downstream retention instructions; timezone conversion relies on host \`Intl\`/ICU coverage.
- Evidence: \`../zodiacs-engine/packages/engine/LICENSING.md\`, \`NOTICE\`, \`LICENSE\`, package tests, and \`npm pack\` contents. Package source commit: \`cced011659d48877b8b73b8a85796815234cf741\`.

## i18n status

- Active rails: EN, ES, PT, FR, IT.
- Additive key count: 541, including \`footerDisclosure\`.
- Every additive key has an English default, a one-line location/tone/length brief, placeholder/\`<br/>\` preservation instructions where applicable, and an explicit pending-locale list. The manifest carries an explicit \`TODO(i18n)\` handoff marker.
- Shared additions render through the five-locale catalogues. Twenty-two keys now have explicit copy in all five locales, including the feature-flagged push-prompt copy; English fallback is used only where the manifest marks a locale pending.
- No new WS5 page has hreflang alternates until a translated page actually exists.
- The canonical manifest is embedded byte-for-byte at the end of this report and also exists independently as \`i18n-additions.md\`.

## Environment variables introduced or consumed by these workstreams

| Variable | Purpose and safe default |
| --- | --- |
| \`PUBLIC_PLAUSIBLE_SCRIPT_URL\` | Full cookieless analytics script URL. When unset, no provider script is emitted. |
| \`PUBLIC_PLAUSIBLE_ENDPOINT\` | Optional first-party/self-hosted Plausible-compatible event endpoint. |
| \`PUBLIC_PLAUSIBLE_DOMAIN\` | Optional analytics site/domain identifier. |
| \`EMAIL_PROVIDER\` | Selects \`resend\`, \`buttondown\`, or \`loops\`. Capture is omitted unless the chosen adapter is complete. |
| \`RESEND_API_KEY\` | Server-only Resend API key. |
| \`RESEND_FROM_EMAIL\` | Verified sender for the first-party confirmation email. |
| \`EMAIL_CONFIRM_SECRET\` | Independently generated random value of at least 32 bytes; authenticates 48-hour confirmation tokens, with email-bearing standalone and daily-Sun claims sealed by AES-256-GCM. |
| \`EMAIL_CONFIRM_BASE_URL\` | Optional HTTPS confirmation origin; defaults to \`https://zodiacs.org\`. |
| \`RESEND_SEGMENT_ID\` | Optional segment assigned only after explicit confirmation. |
| \`RESEND_SIGN_PROPERTY\` | Optional selected-sign contact property; defaults to \`sun_sign\`. |
| \`BUTTONDOWN_API_KEY\` | Server-only subscriber-write key; creates Buttondown's native unactivated/double-opt-in subscriber. |
| \`LOOPS_FORM_ENDPOINT\` | Exact Loops newsletter-form endpoint. |
| \`LOOPS_DOUBLE_OPT_IN_CONFIRMED\` | Must equal \`1\` only after the operator confirms Loops double opt-in is enabled/published. |
| \`LOOPS_MAILING_LIST_ID\` | Optional Loops mailing-list ID. |
| \`LOOPS_SIGN_PROPERTY\` | Optional sign property; defaults to \`sunSign\`. |
| \`PUBLIC_WALLET_CHART_ENABLED\` | Must equal \`1\` to expose WS8; default is off. |
| \`SOLANA_RPC_URL\` | Server-only archival Solana JSON-RPC URL. |
| \`SOLANA_WALLET_MAX_PAGES\` | 1,000-signature page cap; default 200, maximum 1,000. |
| \`BASE_EXPLORER_API_KEY\` | Enables Etherscan v2 Base account-history lookup. |
| \`BASE_EXPLORER_API_URL\` | Optional Base explorer endpoint override. |
| \`BASE_RPC_URL\` | Archive-capable Base fallback/history and read-only official-balance RPC. |
| \`WALLET_BIRTH_CACHE_TTL_SECONDS\` | Warm-function address-cache TTL; default 86,400 seconds, bounded 5 minutes–7 days. |
| \`PUBLIC_WEB_PUSH_ENABLED\` | Public build flag for the future push scaffold; default is off. |
| \`PUSH_ENABLED\` | Server/build kill switch; both push flags must equal \`1\` before activation. |
| \`PUBLIC_VAPID_KEY\` | Browser-visible VAPID public key. |
| \`VAPID_SUBJECT\` | Server delivery contact URI. |
| \`VAPID_PUBLIC_KEY\` | Server delivery public key. |
| \`VAPID_PRIVATE_KEY\` | Server-only delivery private key. |
| \`PUBLIC_SUPABASE_URL\` | Existing Supabase origin reused only by the flag-off push endpoint/delivery scaffold. |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Existing server-only credential reused by the flag-off push endpoint/delivery scaffold. |

## Rendered visual inventory and paths

### OG/Twitter images

There are 186 PNGs under \`/assets/og/v2/\`. The exhaustive directive-required set is machine-readable at \`/assets/og/v2/manifest.json\` (45 unique files, 1200×630, English art). All rendered files are covered by these exact families:

- Required sign guides (12): \`/assets/og/v2/sign/{aquarius,aries,cancer,capricorn,gemini,leo,libra,pisces,sagittarius,scorpio,taurus,virgo}.png\`.
- Required Registry lots (12): \`/assets/og/v2/registry/{aquarius,aries,cancer,capricorn,gemini,leo,libra,pisces,sagittarius,scorpio,taurus,virgo}.png\`.
- Required standalone cards (3): \`/assets/og/v2/registry.png\`, \`/assets/og/v2/thesis.png\`, \`/assets/og/v2/disclosure.png\`.
- Required tool/content cards (18): \`/assets/og/v2/tool/{baby-zodiac,birth-chart,birthday,compatibility,eclipses,full-moon-calendar,horoscopes,how-to-read-a-birth-chart,learn,mercury-retrograde,moon-phase,moon-sign,retrogrades,rising-sign,saturn-return,today,tools,transits}.png\`.
- Additional generated compatibility-pair cards (78): \`/assets/og/v2/pair/{canonical-sign1-sign2}.png\`; one file for every generated pair.
- Additional monthly horoscope cards (12): \`/assets/og/v2/horoscope/{sign}.png\`.
- Additional rising-sign cards (12): \`/assets/og/v2/rising/{sign}.png\`.
- Additional placement cards (10): \`/assets/og/v2/placements/{sun,moon,mercury,venus,mars,jupiter,saturn,uranus,neptune,pluto}.png\`.
- Pinterest/social variants (25): \`/assets/og/v2/pin/{sign}.png\` (12), \`/assets/og/v2/pin/horoscope-{sign}.png\` (12), and \`/assets/og/v2/pin/how-to-read-a-birth-chart.png\`.
- Almanac cards (3): \`/assets/og/v2/almanac/{index,reading-a-childs-chart,sky-2026-08}.png\`.
- Cache-busted global fallback (1): \`/assets/og/v2/share-pastel-wheel-20261019.png\`.

### Client-generated share cards

Share cards intentionally are not committed with user data. Their rendered route/test paths are:

- Big Three and full chart: compute on \`/birth-chart/\`; deterministic coverage in \`tests/t17-positions-share.mjs\` and \`src/lib/share-card.test.ts\`.
- Compatibility: compute on \`/compatibility/\`; deterministic coverage in \`src/lib/compatibility-card.test.ts\`.
- Wallet placements/owner synastry: compute on feature-on \`/registry/wallet-chart/\`; deterministic coverage in \`src/lib/wallet/share-card.test.ts\`.

All share-card renderers use canonical sign WebPs, \`#060709\`, silver type, and local 2× canvas output. No server render or image upload occurs.

### Widgets and PWA icons

- Generator/live previews: \`/widgets/\`.
- Standalone iframe documents: \`/embed/moon/\`, \`/embed/sky/\`, \`/embed/chart/\`.
- Script embed loader: \`/assets/widgets.js\`.
- Foreign-origin/Lighthouse evidence: \`tests/widgets-drive.mjs\`, \`tests/visual/widget-lighthouse.mjs\`.
- App icons: \`/assets/app-icons/v3/favicon.svg\`, \`favicon-16.png\`, \`favicon-32.png\`, \`favicon-96.png\`, \`icon-192.png\`, \`icon-512.png\`, \`maskable-512.png\`, and \`apple-touch-icon.png\`.

## Operator inputs and externally pending checks

1. Confirm the exact Zodiacs.org/Astrofolio shared-operator wording.
2. Confirm the operator's economic-interest statement.
3. Confirm the Registry establishment year and provide the earliest deploy transaction proving it.
4. Supply one deploy-transaction link per sign.
5. Supply archived primary-source URLs for these exact receipt IDs: \`accidental-libra\` first, then \`zodiac-iwo\`, \`onboarding-wave\`, \`astrology-girlies\`, \`oldest-meme\`, \`astrologers-arrive\`, \`horoscopes-to-hodl\`, \`origin\`, and \`pure-belief\`.
6. Select/configure Plausible or a compatible self-hosted endpoint and verify the eleven directive events on a deployment candidate.
7. Select Resend, Buttondown, or Loops; supply credentials; run a real delivery/confirmation/unsubscribe smoke test without linking email to chart data.
8. Supply archival Solana and Base provider credentials and run live oldest-history checks before enabling WS8.
9. Supply VAPID keys only if future push is separately authorized; push remains off.
10. Confirm authority to publish the site-authored adapter code under MIT and publish \`@zodiacs/engine\` / \`@zodiacs/widgets\` if desired.
11. Repeat iOS and Android physical-device install/offline smoke checks on the deployment candidate.

## Exact coordination commit ledger

Shared-surface commits, in branch order:

1. \`e66f1e00c9f283c33d32d5e3f2e2f13ce308f303\` — \`[shared-surface] rebase Registry disclosure and provenance links\`
2. \`a16af01432615c07fcd355ac6ade22b76020df4a\` — \`[shared-surface] rebase head analytics and structured data\`
3. \`9a2a26e44db16d9226eb770f871c2e05f6023af1\` — \`[shared-surface] rebase footer capture and disclosure link\`

No nav commit exists because navigation was not touched.

Coordinated indexing:

- \`115543c555fa834f54eeec505e120797cb16ad19\` — \`[coordinated-indexing] register EN WS5 pages and refresh drift baseline\`

That commit intentionally changes sitemap output, updates the drift-check baseline to the new expected bytes/counts, asserts zero WS5 hreflang while translations are absent, and leaves robots unchanged.

## Full i18n additions manifest (embedded verbatim)

The remainder is the historical content of \`i18n-additions.md\`, retained in \`docs/build-report-2026-07-15/i18n-additions.md\`.

${additions}`;

await writeFile(resolve(root, 'BUILD-REPORT.md'), report, 'utf8');
console.log(`BUILD-REPORT.md written (${report.length} bytes; ${additionCount} i18n keys embedded).`);
