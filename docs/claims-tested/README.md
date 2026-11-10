# Astrology claims, tested (`/claims-tested/`)

A page listing every claim Zodiacs has tested and the honest result,
results at chance included. Built 9 November 2026; not published.

- Page: `src/pages/claims-tested/index.astro`, static, no script.
- Entries: `src/data/claims-tested.json`, checked by `src/lib/claims-tested.ts`
  and `src/lib/claims-tested.test.ts`.
- Switch: `PUBLIC_CLAIMS_TESTED_ENABLED=1` at build time shows the entries;
  unset, the page says it is not published. Either way it is `noindex`, out
  of the sitemap, search, the assistant's site guide and navigation.
- Share image: `public/assets/og/claims-tested/v1/card.jpg`
  (`npm run data:og -- --only-claims-tested-card`), checked by
  `verify-og-cards`.
- Browser drive: `npm run test:claims-tested:browser` (in CI, against the
  flag-off build); with `PUBLIC_CLAIMS_TESTED_ENABLED=1` and `--screenshots`
  it checks the full page and writes `docs/claims-tested/evidence/`.

## Adding an entry

Add a test only when its result is already in this repository, and cite that
evidence as `source.url`: a file on `main` or a page on zodiacs.org, never a
pull request. Give the result in the test's own numbers first. Use the
verdict the numbers support: `passed`, `passed-after-correction`, `mixed`,
`at-chance`, `failed` or `pending`. A result at chance or a failure stays on
the page. Keep the astro-markets lab's results out until the owner releases
them, and name no living person.

Good day finder outcome answers are never a source unless a preregistered design with a comparison group exists.

## Decisions (9 and 10 November 2026)

- Two kinds of entry, "Does the reading predict?" and "Is the sky right?":
  a pass on arithmetic must never read as evidence that astrology predicts.
- The prediction section comes first, even when it is empty: those are the
  claims the page exists to test.
- Verdicts are plain words in a hairline pill, not coloured dots: the design
  system has no status colours, and the words carry the result.
- Seeded with two results: the returns worked examples (passed,
  preregistered) and the NASA accuracy audit (passed after a correction).
  Both are calculation checks, so the page shows two tallies, one per kind,
  and the prediction section says there is no test to report yet.
- The Year Ahead trial is not listed (decided 10 November 2026): it was too
  small to report as a result, and it drew on market news.
- A source must be a file on `main` or a page on zodiacs.org, never a pull
  request: a pull request can change or close.
- The Registry thesis and research material is left out as astro-markets
  work, until the owner releases it.
- Sources link to GitHub, which is public, so every reader can check the
  evidence.
- No navigation link until publishing: linking an unpublished noindex page
  from the site would publish it in practice.
