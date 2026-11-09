# Technical SEO pass (part 3, 2026-11-09)

One postbuild audit, `scripts/seo/seo-audit.mjs`, now runs after the
English-links check on every build. Its rules live in
`scripts/seo/seo-audit-lib.mjs`, each with a unit test in
`seo-audit-lib.test.mjs`. It reads every built page outside the legacy wing
(registry, thesis, archive, sdk, terminal, the generated engine reference),
the embeds and the share receivers.

| Rule | What passes |
|---|---|
| Canonical | Every indexable page is self-canonical: absolute on https://zodiacs.org, no query or fragment, trailing slash |
| html lang | The page's `lang` matches its path's locale (pt-BR, zh-Hans and zh-Hant included) |
| Hreflang | None on noindex pages. Otherwise the set includes the page itself, an x-default equal to the English alternate, and no duplicates |
| Reciprocity | Every alternate is built, indexable and lists exactly the same set back. This now covers every page, not only sitemap pages |
| Structured data | Each page type carries its nodes: horoscopes Article and BreadcrumbList; pairs and rising profiles Article, BreadcrumbList and FAQPage; Moon pages and zodiac dates Article and BreadcrumbList; calculators WebApplication; sign guides BreadcrumbList. Every Article or WebApplication says the page's language and URL. All JSON-LD parses |
| Locale links | A localized page never links the English page when its own language has the same page indexable. Links that declare `hreflang` (the language switcher, the English-only cue) are deliberate |
| Locale sitemaps | `/sitemaps/{locale}.xml` lists only that locale's pages, every listed page is built and indexable, and `sitemap-index.xml` lists each file |

The audit sits beside the existing gates (`check-dist` sections 6 and 6b,
`scripts/i18n-hreflang-policy.mjs`, `check-i18n-english-links.mjs`,
`scripts/validate-schema.mjs`) and does not replace them. Those gates hold
exact counts and the sitemap; this one holds the per-page rules everywhere.

## What it found on the 2026-11-09 build, and the fixes

- **24 pages without Article markup:** the Spanish and Portuguese daily
  horoscopes carried no Article, while the English daily does.
  `LocalizedHoroscope.astro` now passes the same Article, dated with the
  edition and in the page's language. This also covers the French, Italian
  and Russian daily pages when they are released.
- **Hreflang came from the request path, not the canonical.** `SEO.astro`
  computed alternates from `path` while the canonical used `canonicalPath`.
  It now uses `canonicalPath`, so a page served at another address declares
  its canonical page's alternates. Only `/c/` and the wing's how-to-buy page
  pass a different canonical.
- Nothing else failed: no stray canonicals, missing x-defaults, broken
  reciprocity or mixed-locale sitemaps across 4,416 pages. Every localized
  link to English that has a same-language twin already declares `hreflang`.

## Per-locale sitemaps

They already existed (`src/pages/sitemaps/_sections.ts`), one file per
locale. The audit now holds what they may contain. Released locale-expansion
pages join their locale's file through `alternatePathEntries`. Held pages
never appear in them, as `check-dist` and the publication tests show.
