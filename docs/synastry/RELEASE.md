# First-build review edition

Scope: the synastry hub and Sun-Moon, Moon-Venus and Moon-Mars references.
No other editorial topic is implemented. The existing 78 sign-pair routes
and five geometry guides retain their route assertions.

The public release is held. No named astrology review or meaningful
post-repair crawl evidence was supplied with this build. Selected search
canonicals and current indexing remain unknown. Local rendering and a
successful calculation do not substitute for either review or crawl evidence.
The release clock has not started. No acquisition result is claimed.

Normal builds emit none of the four new routes or their discovery links.
The local review build uses `PUBLIC_SYNASTRY_REFERENCE_PREVIEW=1`. It emits
four noindex, self-canonical English pages, without sitemap entries or
locale alternates. No alternate language, reversed pair, natal reference,
additional calculator or input-specific URL is introduced.

The source pages live outside automatic page discovery in
`src/reference-pages/aspects/`. `scripts/synastry-reference-policy.mjs`
registers the hub and detail routes only for local review or a completed
publication record. This keeps drafts out of normal public generation.
Both the site routes and the lightweight result-link resolver use the
same publication record. Changing a preview flag cannot mark a draft as
published. Named approval, review dates, reviewed article status and an
indexing-evidence record are required before public release. The three pair MDX
files must also change from `draft: true` to `draft: false`; a complete
publication record with draft entries fails the build explicitly.

The plan's existing-core cohort is frozen at these twenty routes:

| Historical indexed set | Existing calculator and Learn parents |
| --- | --- |
| `/` | `/birth-chart/` |
| `/ru/` | `/compatibility/` |
| `/es/` | `/learn/` |
| `/fr/` | `/tools/` |
| `/gemini/` | `/moon-sign/` |
| `/es/gemini/` | `/rising-sign/` |
| `/fr/gemini/` | `/learn/aspects/` |
| `/pt/gemini/` | `/learn/planets/` |
| `/it/gemini/` | `/big-three/` |
| `/compatibility/gemini-gemini/` | `/methodology/` |

Historical membership comes from the supplied plan. It is not a current
indexed count. Current selected canonicals, meaningful last crawl, live
HTTP redirect behavior and the indexed numerator over twenty are unknown.
`core-inventory.json` records each route's local canonical, robots directive
and sitemap membership, with unavailable inspection fields left null.
Two meaningful post-repair crawl observations are still required. The
broader indexing inventory and Chinese-family audit remain prerequisites
for release, outside this topic's implementation. Existing sitemap policy
is preserved; the four draft routes are explicitly excluded.

The six examples use synthetic UTC instants and the actual site chart and
two-chart adapters. Engine version, input roles, longitudes, separation,
target angle, residual orb and provenance are retained in generated data.
Two separately labeled schematic cases cover wraparound and outside-orb
behavior. A deterministic replay verifies calculations only. The discussion
prompts are original editorial suggestions, with named interpretation and
source review still pending. Primary references establish the general
geometry and comparison context, not behavioral outcomes.

Existing save and private-invitation controls remain optional. Reference
links carry only pair and geometry. The three new event names use closed
topic, page, locale, task and destination values. A thirty-minute same-tab
marker contains only page and expiry; successful comparison consumes it
once. Navigation, invitations, saves, downloads and enrollment are separate
actions and are not counted as comparison completion.

The normal CI checks remain intact. A separate review-edition job builds
the pages, replays their fixture generator, runs browser checks and gates
all four routes with the existing Lighthouse thresholds. Static entry
closures are limited to 0 KiB in `budgets.synastry.json`. No existing budget,
score, stall rule, CLS requirement or visual tolerance changes.

Automated browser/ARIA and Lighthouse accessibility checks are recorded in
`BUILD-NOTES.md`. Named astrology/source approval and manual screen reader
review remain release requirements. They are not claimed by automation.
