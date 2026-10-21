# zodiacs.org indexing audit, 21 October 2026

Evidence snapshot from 21 October 2026. Local evidence paths refer to the audit session, not repository dependencies. Current CI is recorded in the PR body.

The live site does not have a sitewide indexing block in the evidence sampled. The audit found a concrete internal-discovery defect affecting 69 sitemap URLs. Fixing that defect improves crawl access, but cannot explain or promise recovery of all pages reportedly absent from Google. An approximate Google result count is not a reliable indexed-page inventory. Search Console was not used because its data is essentially empty. Google's chosen canonicals, crawl history, impressions and exclusion reasons remain unknown.

## Evidence and limits

The interrupted run saved 901 HTML files, including six empty files after the disk filled. This run reused the saved homepage, robots.txt, sitemap.xml and pages. It made 142 additional page requests, below the 150 limit, including four 404 probes for nonexistent localized birthday directories. It repaired all six empty samples and obtained 1,033 usable HTML samples in total. There were 138 successful new GETs and 160 HEAD checks of previously saved pages, all returning 200 with no indexing-blocking response header. Original saved pages lack individual response headers because the interrupted run never saved its in-memory results. Their HTML is evidence of markup, not independently verified status codes. The homepage was checked live again with curl.

Samples include all 366 English birthdays, all 78 English compatibility pairs, English horoscope variants, translated birthdays and pairs, all six locale homepages and tool directories, events, learning hubs and articles, developer pages, People, and the Registry wing. The live sitemap contains 1,871 URLs, rather than the approximate 1,783 in the brief. Sampling and link extraction scripts plus JSON evidence are under /tmp/indexing. The previous raw evidence remains untouched under /workspace/indexing.

/workspace/indexing and /workspace/orchestra are mounted read-only for this session. The requested report destination and shared board cannot be updated here. This report is saved under /tmp/indexing/REPORT.md and copied into docs/indexing-2026-10.md for review. STATUS.md records this restriction. No dependencies were installed, no credentials or auth files were read, and no existing files were deleted.

## Findings ranked by likely impact

### 1. Proven discovery gap: 69 URLs in isolated sections

A breadth-first crawl of rendered HTML anchors from https://zodiacs.org/ reached 1,802 of the 1,871 sitemap URLs. Depth counts before the repair: 66 at one click, 894 at two, 632 at three, 209 at four, plus the homepage. The remaining 69 were the 65 Chinese zodiac pages (13 pages in each of EN, ES, PT, FR and IT), /occasions/ and its two children, and /feeds/.

The Chinese zodiac hubs and animals linked among themselves and between translated equivalents. They had no ordinary incoming anchor from the connected part of the sampled site. Source search confirmed that Chinese zodiac route links existed only within that section's own page templates. Hreflang and sitemap links do not substitute for navigable anchors. Likewise the footer's RSS link led directly to /feeds/horoscopes.xml, leaving the feeds directory undiscovered in the HTML graph. The occasion directory linked to its two children but lacked a connected entry point.

Fix: add three contextual links in the existing Tools directory, covering occasion cards, the Chinese zodiac calendar and the RSS directory. Keep the existing dark design and page copy. Update only /tools/'s source-controlled sitemap revision date to 2026-10-21. This gives every sitemap URL an HTML path from home in the local build. The complete build checks all HTML files, which also removes the partial-live-crawl limitation from the regression gate.

This is a confirmed defect with bounded reach. It does not explain why other well-linked pages would be absent from Google.

### 2. Index selection, demand and template similarity need observation, not mass rewrites

The largest families are programmatic and share navigation, layout and supporting explanations. That can make Google's selection harder, especially on a growing site with limited external discovery. This is a hypothesis, not a proven Google exclusion reason.

The English birthday samples contain about 991 to 1,719 main-content words, with a median of 1,106. English pair articles are generally around 1,269 main-content words. An exploratory comparison of the first 25 sorted samples found adjacent five-word-shingle Jaccard overlap of about 0.14 to 0.33 for birthdays and 0.16 to 0.23 for pairs. The sampled horoscope variants overlap more, about 0.22 to 0.61. These are simple text measurements, not Google's duplicate-content assessment. They do not support calling all birthday or pair pages empty duplicates. Horoscope periods and themed readings deserve later editorial review of usefulness and distinct intent.

No existing readings were rewritten, no predictions added, no bulk noindex applied, and no translated pages removed. Later: build an actual indexed-URL inventory when Search Console has usable coverage, inspect representative omitted pages, and compare server crawl logs and demand before deciding on consolidation or publication changes. Legitimate contextual references from relevant external sites may help discovery; no public messages were sent.

### 3. Rendering and response size add cost, but content is available without JavaScript

The saved homepage is 312,393 bytes, birth-chart HTML is about 367 KB, Astrofolio about 511 KB, and sampled pair HTML about 260 KB. Repeated SVG, inline CSS and shared chrome increase transfer and parsing cost. These are uncompressed HTML sizes, not download sizes after content encoding. The source and raw HTML show substantive rendered text, headings and anchors before client JavaScript. Calculators appropriately need JavaScript, but editorial readings and links are already in HTML. There is no observed blank client-only editorial shell.

The existing build already enforces bundle isolation and size budgets. Further HTML deduplication and performance work should be measured separately with visual and zero-CLS checks. It is not established as the cause of Google's index count, so this change does not alter resource-loading behavior.

### 4. Robots, canonical, sitemap and hreflang checks are broadly healthy

robots.txt allows general crawling and names https://zodiacs.org/sitemap.xml. That endpoint is a single XML urlset, not a sitemap index; one file is appropriate for 1,871 entries. There are no duplicate locs, future lastmod dates, or literal Vercel redirect sources in the saved sitemap. The source uses explicit publication and template dates rather than assigning the build date to every page. Most dates cluster on the October 16 design sweep (942) and October 19 changes (499). Those are plausible source revision receipts, not evidence that every page was crawled then. Vercel's HTTP Last-Modified is a deployment timestamp and must not be confused with editorial sitemap lastmod.

All 1,033 usable sampled pages declare exactly the expected self canonical, including HTTPS, apex hostname and trailing slash. No sampled page canonical points to home or another article. Sampled sitemap URLs have no meta noindex. Four deliberately probed localized Learn landing pages are 200 with noindex, follow and are omitted from the sitemap, as the existing publication policy intends. Four localized birthday directory probes return 404; these directories are not sitemap entries, while released localized birthday articles are indexable. These are not sitemap defects.

All sampled hreflang destinations are present in the sitemap. Where both endpoints were sampled, their alternate maps are reciprocal and consistent, with no mismatches. x-default points to the English equivalent. The build already checks alternate-file existence, noindex exclusion, reciprocal maps, exact locale policy and self canonicals. Optional/staged routes use explicit feature flags rather than a production-wide preview noindex switch. Vercel header rules apply noindex to bounded machine/private surfaces, not all pages.

The new build check extends exact self-canonical enforcement to every sitemap entry, including families previously checked only for file existence and noindex. It rejects duplicate canonical tags and literal redirect-source collisions. A new graph gate fails the build if any sitemap URL lacks a rendered anchor path from home. Tests cover missing, duplicate and conflicting canonicals, redirect collisions, relative URLs, fragments, shortest paths, external/query links, nofollow, and references inside scripts or comments.

### 5. Redirects and status codes

Live curl checks: HTTPS www returns 308 directly to the HTTPS apex homepage; /aries returns 308 to /aries/, whose final response is 200; a random missing URL returns a real 404. No chain was observed in those HTTPS paths. Both HTTP apex and HTTP www probes timed out from this execution environment, so HTTP-to-HTTPS behavior is unverified and should be checked from an independent network. Vercel's deployment HTTPS policy is outside the source redirect audit. No production setting was changed.

The 298 newly verified successful GET/HEAD samples returned 200. A sample cannot establish every live route's status. The local build checks every sitemap URL against actual emitted HTML, self canonicals, noindex policy, hreflang reciprocity and reachability. The local default-flags sitemap has 1,868 entries; production has 1,871. The difference is exactly /race/, /games/history/ and /registry/collection/, which production enables with their existing Games and Registry feature flags. There are no additional default-build-only sitemap URLs.

## Validation and handoff

Final local build passed, including all 5,163 HTML files, all 1,868 default-build sitemap entries reachable, self-canonicals, existing hreflang checks and bundle budgets. Typecheck passed with zero errors and zero warnings (49 existing hints). The full test run passed 7,874 tests and timed out in two unrelated tests. Both affected files then passed in isolation, 116 tests total. The nine new consistency tests pass. Protected-scope guard passes. Browser verification of the changed Tools page at 360 px and 1280 px returned 200 with all three new links present, zero CLS and no horizontal overflow. Existing protected visual templates and their screenshot receipts are untouched.

Draft PR: https://github.com/zodiacs-org/site/pull/816

The PR connects the three isolated sections through the Tools directory, updates its honest revision date, and adds build-time discovery, canonical and redirect consistency gates with regression tests. It makes no dependency, hosting, theme or reading-copy changes. The initial head finished with 20 passing checks, one optional skip and only the known main-wide Vite advisory failure. The review follow-up removes retained HTML from the discovery gate, shares canonical parsing, ignores data attributes and inert markup, styles the Tools links and adds parser and browser regression coverage. Follow-up CI results are recorded in the PR body and the session report.

The Vite security advisory also affects main. Dependencies and that gate are unchanged by instruction. A red advisory gate means the PR is not fully CI-green.

Left for later: owner review and merge, then production crawl verification, independent HTTP redirect verification, actual indexed-URL coverage and Googlebot crawl history when available, and evidence-led assessment of long-tail demand and horoscope similarity. Indexing recovery is not guaranteed by these changes. No merge or ready-for-review action has been taken.


Review outcome: all four code findings addressed, plus the missing parser cases and repeatable Tools browser checks. Localized Tools entry links remain a follow-up; translated Chinese zodiac pages currently remain reachable through language links.
