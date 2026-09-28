# Owner decisions of 2026-09-28

On 2026-09-28 the owner delegated the open decisions of brief §10 and the
programme's owner actions: "Choose the best decision for me. It's beyond my
expertise. Anything you can't do, I can have Codex do it via computer use."

This record gives each decision, the reason for it, and what it changes. Where
a step needs the owner's own accounts, it is listed in [STATUS.md](STATUS.md)
under "Steps that need the owner's accounts", for the owner or Codex to carry
out. A decision here does not count as done in the ledger until its work is.

## 1. Amendments A1 and A3: rejected

A1 (rule 1b: 8″ at 66° instead of 5″) and A3 (rule 1g: 1.5″ a day instead of
1″) were adopted by an agent after the residuals they relax had been seen.
Ratifying them would loosen two gates after the fact, which the
preregistration rules forbid. Both are rejected, and the original gates stand.

- Steps 1.3 and 1.8 are recorded as **failed** on the engine that was measured
  (rc.7 and rc.8), no longer as waiting for ratification.
- They return when the precise backend (Phase 4) is measured against the
  original gates.

## 2. The calendar feed and share URLs (§10.4, R9, F-20): opaque feed ids

The calendar feed puts the chart's positions in its URL, and those give the
birth instant to about 4 seconds. The URL reaches platform logs, a shared
cache and the calendar provider. Coarsening cannot fix this. A token that no
longer gives the birth date (the Sun to about a degree) or time (the Moon to
about half a degree) no longer gives a usable transit calendar either: a slow
planet's contact date moves by weeks.

Decision: **random opaque feed ids stored server-side**.

- **URL.** A new subscription gets a random 128-bit id. The URL carries only
  that id.
- **What is stored.** The server keeps only what the feed computes from: the
  positions, with whole-degree angles. It keeps no name, place or birth time.
- **Retention.** A feed is removed after 12 months without a fetch. It can be
  revoked at any time from the page that made it.
- **Older URLs.** Existing token URLs keep working for 60 days. During that
  time their feed carries an event asking the subscriber to subscribe again,
  and after it they return 410 Gone.
- **Privacy page.** It will say what is stored, where, for how long, and how to
  remove it.

This makes the feed stateful. It stays within §6: the site keeps a small
record only because the person asked for a subscription, and no birth data is
left in any URL.

## 3. Swiss Ephemeris output in the repository (F-22): removed from the tree

Brief §6 says "no Swiss code, data or output in `src/` or any pack". The raw
Swiss fixtures under `src/lib/engine/fixtures/`, and raw Swiss values in
evidence folders, are removed from the current tree. Statistics and SHA-256
digests stay.

- **Tests.** Tests that read the raw fixtures move to independent arbiters
  (the conformance vectors, Horizons, ERFA). Where a Swiss comparison is still
  wanted, a script regenerates Swiss's values on demand, and only statistics
  are committed.
- **History.** Git history is not rewritten; earlier commits keep the files.

## 4. npm, PyPI and JSR (§10.3): the shared `@zodiacs` scope

- **Scope.** Publish under the existing `@zodiacs` scope, which the `zodiacs`
  account already controls (`@zodiacs/sdk` 1.0.1 is published there):
  `@zodiacs/engine` and `@zodiacs/mcp-server` first, then `@zodiacs/cli`,
  `@zodiacs/ai-tools` and `@zodiacs/wheel`.
  - One namespace matches the domain.
  - A second scope would split the name and need its own account security.
  - The token boundary (R6) is kept in the packages themselves: their
    metadata, READMEs and docs carry no token or ownership language.
- **Publish rights.** They stay with the `zodiacs` account, with two-factor
  authentication for writes.
- **The first publish.** npm allows a trusted publisher only for a package
  that exists. So the first publish of each name is manual: the verified
  0.1.1-rc.13 archive, with the `next` tag. After it, releases come from
  GitHub Actions through npm trusted publishing (OIDC), with provenance and
  no stored token.
- **PyPI.** `zodiacs` is reserved by a pending trusted publisher, with no
  placeholder upload.
- **JSR.** The `@zodiacs` scope is created and linked to the engine
  repository.

## 5. The hosted API (§10.5): free, and no new spending

- **Tier.** Free and anonymous: no keys, no paid tier.
- **Hosting.** The compute endpoints run on the existing Vercel project and
  plan. They are rate-limited per client address with Vercel Firewall rules,
  as the calendar feed already is, and each request has a compute budget
  that ends in a typed `budget-exhausted` refusal.
- **Spending.** No additional spending. If use approaches the plan's limits,
  the endpoints refuse with the rate-limit error. A decision to spend comes
  back to the owner.

## 6. The site repository's licence (§10.6): all rights reserved

The site repository is public and holds the product's copy, artwork, the
Registry wing and brand assets. An open licence would let anyone republish
them. It keeps all rights reserved, and its README says so.

The open parts of the programme live where they are meant to be reused:

| part | licence |
| --- | --- |
| the engine | MIT |
| the conformance vectors | CC0 1.0 |
| the public sky data | CC BY 4.0, as already stated |
| the atlas | CC BY 4.0 |

The site repository can be opened later; openness cannot be withdrawn once
granted.

## 7. Data licences (§10.10)

- **Conformance vectors:** CC0 1.0, as the brief recommends. A reference suite
  is most useful when anyone can copy it without conditions.
- **Time atlas:** CC BY 4.0. Where GeoNames data is included, its CC BY
  attribution is kept, with a link to the licence and a note of changes.

## 8. Search Console, Bing Webmaster Tools and Plausible (§9, P0.7b, S8)

Codex exports the baselines from the owner's accounts, and verifies the site
in Bing Webmaster Tools if it is not yet verified.

- **Where they go.** The raw exports go to a new **private** repository,
  `zodiacs-org/analytics-baselines`, because the site repository is public.
- **What is published.** Only aggregate figures are committed to this
  repository.

## 9. The assistants (A8, B4.b)

The monthly panel and the benchmark use the owner's free accounts on ChatGPT,
Claude, Gemini, Microsoft Copilot and Perplexity, through Codex. There is no
paid API spending. Raw answers go to the private baselines repository, and
scores to this one.

## 10. Zenodo (G4)

Connect Zenodo to `zodiacs-org/engine`, so that every GitHub release of the
engine gets a DOI. The engine gets a `CITATION.cff` and `.zenodo.json` first.

## 11. NAIF (§10.8)

Send NAIF the derived-coefficient question from the owner's address. The
question asks whether coefficients derived from DE440 may be redistributed as
a compressed pack, and with what attribution. Until NAIF answers, no derived
pack is distributed. The hosted backend does not depend on the answer.

## 12. Outside review (§10.7): after publication

Send the external-builder packet, and approach an astronomer and an author of
astrology software, after the engine is on npm and the conformance results
page is live. Reviewers then have a stable, installable release to look at.
Any review that happens is recorded as outside review. Agent reviews are never
described as outside review.

## 13. Counsel on the token boundary (§10.9): not needed now

Nothing promotes the token from the engine or platform, or the engine or
platform from the token. Counsel is needed only if that ever changes, and
before it does.

## 14. New locales for the Vedic and Chinese tools (§10.11): later

These wait until the tools ship and show demand, Hindi first, since the Vedic
tools come first.

## 15. "A drop-in alternative to Swiss Ephemeris" (§10.1): not yet

The wording is allowed only after Phases 2 and 4 pass their gates, and then
with its limits stated beside it. It is not allowed now: the engine's
positions still differ from JPL's by arcseconds (Neptune by 14.8″ in the
published comparison), and the precise backend that is meant to close that
gap is Phase 4 work.
