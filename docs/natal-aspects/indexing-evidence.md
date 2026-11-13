# Natal planet-pair aspects: indexing evidence

Record named by `indexingEvidence` in `src/data/natal-aspects-publication.json`.
It covers `/learn/aspects/sun-moon/`, `/learn/aspects/moon-venus/` and
`/learn/aspects/venus-mars/`.

## Release decision

- Owner approval for public release: Dias Malayev, 2026-10-26.
- Named astrology and source review: Dias Malayev, 2026-10-25 (recorded as
  `reviewer` and `reviewedAt` in the publication record and in each article's
  frontmatter).
- All three articles in `src/content/natal-aspect-pairs/` are `draft: false`.

## Pre-release readiness (2026-10-26)

This section records what the source and its automated checks establish
before deploy. It is not crawl evidence: no search engine has fetched the
released pages yet.

| Requirement | How it holds | Checked by |
| --- | --- | --- |
| Pages are emitted and answer 200 | The complete publication record makes `natalAspectRoutes()` inject the three static routes in every normal build | `tests/natal-aspects-publication-drive.mjs` (CI step "Natal aspect pairs released in normal builds") |
| Indexable | `NatalAspectPairPage.astro` passes `noindex={!natalAspectsPublished}`, so the released pages carry no `noindex` robots directive | publication drive; `tests/natal-aspects-reference-drive.mjs` |
| Self-canonical | Each page's canonical link is `https://zodiacs.org/learn/aspects/{pair}/`; no hreflang alternates (English only) | publication drive; reference drive |
| In the sitemap | `src/pages/sitemap.xml.ts` lists the three routes when the record is published, dated by the record's `updated` (2026-10-26) | publication drive |
| In the site search index | `scripts/build-search-index.mjs` indexes every indexable English page in `dist/` | publication drive |
| robots.txt allows them | `public/robots.txt` allows `/` for every listed agent and disallows nothing under `/learn/` | publication drive |
| Discoverable by internal links | The `/learn/aspects/` hub renders the planet-pair section, and each geometry guide links the same angle on all three pair pages | publication drive; `scripts/natal-aspects-policy.test.mjs` |
| Re-dated pages | The hub's editorial date and the five geometry guides' sitemap dates move to 2026-10-26, so the Sitemap Dates check and IndexNow see the change | `scripts/editorial-metadata-checks.test.mjs`; Sitemap Dates workflow |
| Policy and content gates | Publication rule, draft guard, closed three-pair allowlist, evidence replay, editorial depth, register and dash checks | `scripts/natal-aspects-policy.test.mjs`; `src/lib/natal-aspect-pairs.test.ts` |

The browser drive, Lighthouse (performance, accessibility and SEO) and the
bundle budget (`budgets.natal-aspects.json`, a 0 KB entry closure per page)
run in the CI job "Natal aspect pairs" on the pull request. That job's result,
not this record, is the proof that the built pages pass.

## Post-release crawl confirmation

Pending. After the production deploy, append below: the deploy date, the live
HTTP status and robots directive of each page, the sitemap fetch, the IndexNow
submission for the three new pages and the re-dated hub and guides, and the
first Search Console inspection or crawl date for each URL.
