# Visibility program

Started 2026-11-08. Owner decisions: Dias. Draft PRs only; nothing is bought,
published or merged without Dias's yes. No em or en dashes and no token,
market or crypto words in consumer copy.

The program has two layers:

1. **Main: the high-volume families in every locale** ([FAMILIES.md](FAMILIES.md)).
   Horoscope per sign, sign pair compatibility, birth chart, sky events, sign
   meanings, across en, es, pt, fr, it, and later ru, zh and ar. Re-centred
   here by Dias on 2026-11-08.
2. **Secondary: fifteen exact phrases** ([PHRASES.md](PHRASES.md)) for the
   privacy, no-signup and accuracy questions people ask AI assistants. Lower
   volume; the page edits are drafted and parked
   ([parked/](parked/)) until Dias wants them.

## What Dias needs to do

1. **Get search volumes.** Paste each locale's `query` column from
   [keywords/](keywords/) into Google Keyword Planner ("Get search volume and
   forecasts", language and locations as the file says) and save the
   downloads. Then run, per locale,
   `node scripts/visibility/families.mjs --volumes <download> --locale es`,
   or hand the files to a session.
2. **Score competition.** For 10 sample queries per family and locale, look at
   page one and give a 0 to 1 score (0.9 all national media and old astrology
   sites, 0.5 mixed, 0.2 thin). Put them in `docs/visibility/competition.json`
   as `{"horoscope:es": 0.8, ...}`, or allow a session a browser that reaches
   Google to do it.
3. **Decide four things:**
   - Is Russian meant to be public? 23 `/ru/` pages are in the sitemap and
     indexable though `ru` is not a released locale.
   - The pace cap. Spanish and Portuguese week, month and tomorrow horoscopes
     are 72 new pages; under the Growth OS cap of 10 a week that takes about
     7 weeks.
   - Whether to pay for a native speaker to read a sample per language before
     a family goes live there. The localized copy is model-written.
   - Which of PRs F2, F4 and F5 (no new pages) to start now.
4. **Export Search Console** at weeks 4 and 8 (Performance, Search results,
   Export, CSV) and run `node scripts/visibility/gsc.mjs --csv <folder> --label <date>`.
   The property was verified on 2026-11-08, so there is no earlier history.
   Check Security & Manual actions at the same time.
5. **AI re-run.** The 2026-11-08 baseline covered Claude and Google only.
   For the re-run, send the exact 50 questions that baseline used so
   [questions.json](questions.json) can match them, and either run
   `node scripts/visibility/ai-answers.mjs --label <date> --runs 3` with API
   keys in the shell, or allow `api.openai.com` and `api.x.ai` and save the keys
   as environment secrets. A full run costs roughly $20 to $60 (check prices
   first).
6. **Domains:** the recommendation is to buy none ([DOMAINS.md](DOMAINS.md)).

## Baseline recorded on 2026-11-08

| Input | Result | File |
| --- | --- | --- |
| Locales and families | en full in all five families; es and pt daily horoscope only; fr and it no horoscopes; ru calculators only; zh and ar nothing in these families | [baseline/2026-11-08/coverage.md](baseline/2026-11-08/coverage.md) |
| Keyword tables | 2,664 queries across 9 languages, volumes TBD | [keywords/](keywords/) |
| Search Console | Domain property verified 2026-11-08; no history, so every family and phrase starts at zero | [baseline/2026-11-08/external.json](baseline/2026-11-08/external.json) |
| AI and Google answers | zodiacs.org named in **0 of 100** answers (50 questions on Claude and Google). ChatGPT, Gemini and Grok not run | same |
| Competitors named most | Cafe Astrology, Astro-Seek, Astro.com, CHANI, TimePassages, The Pattern, Co-Star; small sites Augurine, ZodiScope, ChartNova, ChartLune | same |
| Page snapshot for the 15 phrases | None of the 15 appears exactly in any title, H1, opening or H2 | [baseline/2026-11-08/pages.json](baseline/2026-11-08/pages.json) |
| Search results from the session's tool | Not Google; noisy; zodiacs.org absent | [baseline/2026-11-08/rankings.json](baseline/2026-11-08/rankings.json) |
| Vercel Web Analytics | Not enabled for the project, per the Vercel API | none |
| Live site | Not reachable from the session; the local build stands in | none |

## Measures of success

At weeks 4 and 8 after each family PR merges, per family and locale:

- Search Console impressions, clicks and average position from the
  `families` block in `gsc.json`, compared with the same window length.
- Which URL Google shows for the sample queries (it should be the page in
  that language).
- AI answers: the share of runs naming or citing zodiacs.org, per assistant.
- No spam signals: Manual actions "No issues detected"; no rise in
  "Duplicate" or "Crawled, currently not indexed" for the new or changed URLs.

## Spam guardrails

- One page per intent and language. No page per wording variant; the
  fifteen phrases share pages with their intent.
- No copies of the site on other domains. Exact-match domains are only ever a
  redirect to the matching page, or not bought.
- New pages must carry a working tool or computed data (Growth OS rule).
- Localized pages are written in the language, never machine-literal, and
  sampled by a native speaker before scale if Dias agrees.
- No paid links, link swaps or comment spam in outreach.

## Scripts

All in `scripts/visibility/`, plain Node, no new dependencies.

| Script | Does |
| --- | --- |
| `coverage.mjs` | Family x locale coverage from a local build (`--dist dist`) |
| `build-keywords.mjs` | Writes the keyword tables; `--check` for drift; keeps filled volumes |
| `families.mjs` | `--volumes` merges a Keyword Planner export; `--rank` writes RANKING.md |
| `gsc.mjs` | Search Console per phrase and per family x locale, from CSV or API (read only) |
| `ai-answers.mjs` | The question set on ChatGPT, Gemini, Claude and Grok with web search; resumes |
| `page-baseline.mjs` | Title, H1, opening, H2s, JSON-LD and inbound links for target pages |
| `report.mjs` | Ranks the phrase set or compares two baseline dates |
| `lib.test.mjs` | Unit tests (run under `npm test`) |
