# Phase 1 trust release — 3 October 2026

Scope: the owner's approved five trust fixes and standing privacy rules. Stop for owner review before implementing Phase 2 or Phase 3. The owner separately approved the exact Guide cloud-processing notice and no-wallet disclosure used here.

| Item | Change | Verification | Limits / uncertainty |
| --- | --- | --- | --- |
| 1. Free FAQ | Six-language visible FAQ and matching FAQ schema say that astrology tools and guides are free, Zodiacs.org operates Astrofolio, and link disclosure. Shared collection footers carry the operator relationship. | Catalog parity, source boundary and claim-ledger tests; production schema validation; desktop/mobile visual comparisons. | Independent purchase services retain their own terms and risks. No new legal wording was inferred. |
| 2. Zodiac Games | Banner and race page explain twelve sign teams, 100 points for the first join, and 25 for one check-in per UTC week. Shares, purchases, holdings and prices give no points. Operator/disclosure copy accompanies token references. | Tests pin the explanation to existing SQL scoring constants and six catalogs; existing Games SQL CI gates. | First-join and weekly awards are per anonymous identity, not proof of a unique human. Existing seasonal resets and feature flags remain unchanged. |
| 3. Accuracy FAQ | Two plain sentences distinguish tested astronomical calculations, input precision and interpretive astrology. Time-zone details stay in methodology. | Six-catalog and visible/schema parity, claims evidence, locale links and schema checks. | Astrology is not a scientifically validated prediction. Birth inputs and historical time-zone records limit precision. |
| 4. Check our math | Chart results show the actual computed UTC instant with a methodology link. Unknown-time charts label their reference instant; placement-only received charts disclose the unavailable original instant. Natal and transit receipts remain distinct. | Helper/unit tests; known/unknown chart browser coverage in six locales; fragment-sharing, embedded chart and relationship drives; numerical reference tests. | Shared positions cannot reconstruct their original birth instant. Due-date and public-record results retain their distinct basis. Unknown birth time yields no rising sign or houses. |
| 5. Human opening | Result surfaces start with a short reflective sentence before the data, localized in all six catalogs. | Source/result tests and responsive browser checks. | These openings are reflective copy, not a new prediction or claim of personality measurement. |

## Standing-rule enforcement

- Tool chrome and chart results omit Astrofolio collection branding and promotional records links.
- Wallet discovery, connection, signatures and transaction submission are retired. Public-address lookup and independent purchase links remain.
- Guide does not attach saved personal charts or personal placements. Old ephemeral requests with personal attachments are rejected before provider work. The approved cloud notice, existing retention disclosure and safety checks remain.
- Existing chart sharing uses URL fragments or local rendered images. The server-preview option is removed.
- Personal server-calendar subscriptions are retired; the existing browser-built `.ics` snapshot remains. This does not implement Phase 3's public sky feed.
- No feature flags, prices, production account data, or calculation fixtures were changed.

## Local verification

- Production build passes dist integrity, 1,322 JSON-LD documents, locale links, widget checks and route bundle budgets.
- Type check: 0 errors, 0 warnings, 39 non-blocking hints.
- Unit suite: 6,368 passed, 5 intentionally skipped, 0 failed.
- Guide: 46 checks passed. Exchange: 110 checks passed. Sharing, relationships, foreign-origin widgets and local transit-calendar drives passed.
- All 18 required exact-width acceptance captures pass and match the current build fingerprint.
- Three numerical snapshot comparisons were already failing on an untouched base checkout on macOS. Tests now explicitly bound nodal velocity roundoff to 1e-7 / 1e-8 degrees per day and SVG coordinate roundoff to 1e-10 pixels; original reference fixtures, snapshots and engine code remain unchanged.
- Platform visual comparisons and all 19 CI jobs are release gates, not waived requirements. Their final status is recorded in the pull request.

## Follow-up for owner review

Dense transit timeline dates can share pointer positions. The foreground marker is clickable and every marker is keyboard-accessible; exact-date links provide another route. The layout is unchanged in this trust release. A later polish pass could separate clustered targets without changing dates or calculations.

## Release-gate remediation

The first CI run passed 17 of 19 jobs. It exposed an upstream HTTP-cache advisory (CVE-2026-93748, no published fixed release on 3 October) and the compatibility route slightly over its existing 36 KB initial-JS limit under production feature flags.

The cache dependency now resolves to a local, explicitly named fork containing the narrow upstream PR #58 patch, pinned to its exact source hash with the original BSD license and provenance. It is not represented as an upstream-approved release. Ten regression checks cover restricted cookie/private/revalidation responses, serialization/restoration and ordinary public/ private caching. The zero-advisory production gate and high/critical development gate stay unchanged. Replace the local override when a verified fixed upstream release exists.

The comparison receipt markup is moved into the existing lazy result module. The 36 KB route limit stays unchanged. No calculation or visible result behavior changes.
