# Baseline 2026-11-08

| File | What | Status |
| --- | --- | --- |
| `external.json` | Gathered outside the sandbox: Search Console Domain property verified today (no history); zodiacs.org named in 0 of 100 Claude and Google answers to 50 questions (ChatGPT, Gemini, Grok not run); competitors and cited list pages; the fifteen priority phrases; pitches already sent on 2026-10-24 | Summary only: the raw answers and the exact 50 questions are still needed for a like-for-like re-run |
| `coverage.json`, `coverage.md` | Pages per locale and family (horoscope, compatibility, birth chart, sky events, signs): count, sub-types, sitemap lastmod, median words, JSON-LD, dash titles. Local build of `main` at f17b7ce2, default flags (`coverage.mjs`) | Done |
| `pages.json` | Title, description, H1, opening, H2s, JSON-LD types, canonical, robots and linking-page count for each question's target page (`page-baseline.mjs --dist dist`) | Done |
| `rankings.json` | Search results for 22 phrases, outreach candidates and domain checks from the session's web search tool. Not Google, full of spam subdomains, zodiacs.org absent everywhere. Context only | Partial |
| `REPORT.md` | `report.mjs --rank` output for the phrase set | Placeholder until answers and Search Console data exist |
| `gsc.json` | Search Console per phrase and per family x locale (`gsc.mjs`) | None: the property has no history before 2026-11-08 |
| `ai/*.json` | Full answers with citations from `ai-answers.mjs` | Not collected in the sandbox (no keys) |

The keyword tables with volumes TBD are in `docs/visibility/keywords/`.
