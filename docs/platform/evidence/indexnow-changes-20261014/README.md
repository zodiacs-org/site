# IndexNow for every new, changed or removed URL (S8), 2026-10-14

S8 is not accepted: Bing's verification rests on the owner's report (below). The
other gap #745's review found, page changes the sitemap does not date, is closed
by the sitemap-date check (F-97, below).

S8 asks for IndexNow on every new or changed URL, covering the developer docs
and the datasets, and for Bing Webmaster Tools and Google Search Console to be
verified.

## The workflow

#744, merged as `f4a6b34458fae91890f973f7c2f28c10af263f6e` on 2026-10-14 at
07:04:18Z, adds **IndexNow Changes** (`.github/workflows/indexnow-changes.yml`,
`scripts/indexnow-changed-urls.mjs`). It runs on Vercel's
`vercel.deployment.ready` and `vercel.deployment.promoted` repository
dispatches for this project's production deployments, and every six hours,
since Vercel sends no dispatch for an Instant Rollback. Each run reads
`https://zodiacs.org/sitemap.xml`, compares it with the sitemap IndexNow last
accepted (kept in the Actions cache), and submits every URL that is new, has a
new `lastmod`, or is gone. `check-dist` fails a build whose sitemap misses an
indexable page, so the developer docs and the dataset pages are in it.

## In production

Vercel `dpl_GxWNXNnEYdwQdMskMP1Q6aq8zDu6` built the merge for production and
sent both dispatches, which GitHub received at 07:07:43Z:

- **Run 38526348519** (`vercel.deployment.promoted`, 07:07:46–07:08:33Z) found
  no earlier record, read the live sitemap at 07:08:27.671Z (1,838 URLs) and
  submitted the 415 dated 2026-09-14 or later to IndexNow, which answered HTTP
  200; it then recorded the sitemap. The URLs are in
  [`submitted-38526348519.txt`](submitted-38526348519.txt): 36 are developer
  pages (`/developers/…`), and the dataset pages of the full-moon calendar,
  Mercury retrograde, retrogrades and the sky calendar are there in every
  locale.
- **Run 38526348438** (`vercel.deployment.ready`, 07:08:37–07:09:09Z), queued
  behind it, restored that record, read the sitemap again at 07:09:04.602Z
  (1,838 URLs) and found 0 new, 0 changed and 0 removed: nothing to submit.

From now on each deployment, promotion and six-hourly run submits only what
changed since the last accepted sitemap.

## Bing and Google

- **Google Search Console.** zodiacs.org is a domain property, verified by DNS:
  the domain's public TXT records include a `google-site-verification` record
  (read on 2026-10-14; the token is not recorded here).
- **Bing Webmaster Tools.** Bing imported zodiacs.org from Search Console on
  2026-09-30, by the owner's report. The import leaves nothing public, and this
  repository cannot observe the account, so the gate's Bing half rests on that
  report alone.

## #745 in production

#745, merged as `8ae5a7aff3c28b55f51020dcbc73a16e6b6c3a13` on 2026-10-14 at
16:53:50Z, re-dated the three developer pages #740 and #742 had changed.

- **Deployment.** Vercel `dpl_BCPzM8CJW4ZXCostxbedzoqwKppC` built the merge for
  production and was READY at 16:57:55Z, with zodiacs.org on it.
- **Sitemap.** `https://zodiacs.org/sitemap.xml`, read at 16:58:37Z, listed
  1,838 URLs and dated `/developers/compare/` 2026-10-13 and
  `/developers/compute/` and `/developers/mcp/` 2026-10-14; `/developers/` and
  `/developers/docs/` kept 2026-10-12.
- **IndexNow.** Run 38602573527 (`vercel.deployment.promoted`, 16:57:58Z) read
  that sitemap against the one submitted at 15:47:19Z and found 0 new,
  3 changed and 0 removed. It submitted exactly those three URLs (HTTP 200).
- **Schedule.** The first scheduled run, 38607867003, started at 17:34:58Z: the
  12:41Z slot of its six-hourly cron, about five hours late, as GitHub delays
  scheduled runs. It found nothing to submit.
- **Earlier deployments.** #746's run 38553968065 submitted `/privacy/` alone,
  which #746 re-dated. #747's runs found nothing to submit, as it re-dated
  nothing.

## The sitemap-date check (F-97)

The **Sitemap Dates** workflow (`.github/workflows/sitemap-dates.yml`) runs
on every pull request.

- **Two builds.** It builds the merge GitHub tests and its base branch with
  exactly the environment of `site-check.yml`'s production-flags build:
  production's feature flags and the daily email chain's stand-ins, with which
  `/birth-chart/` renders the post-chart brief as production does.
  `scripts/sitemap-rendered-changes.test.mjs` holds the two environments
  equal.
- **Fingerprints.** `scripts/sitemap-rendered-changes.mjs` fingerprints every
  page of each build's sitemap: its title, its meta description, and the text,
  link targets and image descriptions of its `<main>`, with:
  - the copy its attributes carry: a field's placeholder, an accessible name,
    a tooltip, a shown input value, and a responsive table's `data-label`,
    which the stylesheets show with `content: attr()`;
  - the files its images, video and frames show, lazy-loaded ones
    (`data-src`) included;
  - the words its stylesheets add with `content`, counted on a page whose
    markup carries the classes their rule selects.
- **The rule.** A page whose content changed fails the check when its date did
  not change and is not the edition's day. A page already dated that day
  passes, since a sitemap date says only which day a page last changed. A
  page dated after that day fails, changed or not, since no page can have
  changed later than the day it is built for (Codex's tenth finding on #752).
  Every record here was compared again under this rule, from its saved
  fingerprints, and found the same pages.
  IndexNow Changes covers that case. On every run it digests each live page
  dated in the last three days (the run's day and the two before, or back to
  its last run's day if that is earlier) with the same fingerprint, keeps the
  digests in its snapshot, and submits a page whose digest moved since the
  last run. A second change made the same day therefore reaches IndexNow, as
  does a change that becomes live a day later through a late deployment, a
  promotion or a recovery run (Codex's third, fifth and seventh findings on
  #752).
- **One clock.** Some pages print when they were built, such as the
  void-of-course Moon's "As of" line, or a body's position at that time, such
  as the rising-sign pages' chart rulers. Both builds therefore read one
  pinned clock, noon UTC of the head's daily edition, which
  `scripts/frozen-clock.mjs` sets through `NODE_OPTIONS`.
- **By hand.** Run by hand, the workflow compares any two commits of one
  edition.
- **Edition rolls.** Only the daily publication rolls the edition, in a commit
  of its own package, which it may publish through a pull request. Its pages
  take their dates from the edition, and builds of two editions cannot share
  one clock, so a pull request that changes nothing but that package passes
  with nothing to compare. One that rolls the edition and changes anything
  else fails (Codex's second finding on #752).

The reports in [`sitemap-dates/`](sitemap-dates/) are this Mac's builds of
2026-10-15, with that environment and the pinned clock. Every prebuild step
ran except `editorial:daily:verify`, which fails here by one last bit (F-95).

- **The email chain** ([`brief-control.txt`](sitemap-dates/brief-control.txt)).
  Codex found that the check's first environment left out the daily email
  chain, which production has. A change to the post-chart brief's device note
  alone, against `26802bcd`, fails `/birth-chart/` with production's
  environment and passed with the first one.
- **Attribute copy**
  ([`placeholder-control.txt`](sitemap-dates/placeholder-control.txt),
  [`data-label-control.txt`](sitemap-dates/data-label-control.txt)). Codex
  found that copy held in attributes changed no fingerprint. Against
  `26802bcd`, each control changes one thing and passed with the earlier
  fingerprint:
  - the people search's placeholder alone now fails `/people/`;
  - the full-moon tables' time `data-label` alone now fails the four
    localized full-moon calendars.
- **Lazy-loaded media**
  ([`lazy-media-control.txt`](sitemap-dates/lazy-media-control.txt)). A change
  to the home page's second hero video source alone, against `26802bcd`,
  fails `/` with this fingerprint and passed with the previous one.
- **Stylesheet words**
  ([`stylesheet-control.txt`](sitemap-dates/stylesheet-control.txt)). A
  change to the word `events.css` adds to the events hub's disclosure (Show
  to Open), against `26802bcd`, fails `/events/` alone and passed with the
  previous fingerprint. The 92 other sitemap pages that load `events.css`'s
  rules, in a shared stylesheet, do not carry the class it selects.
- **Every other report** here was built again with the whole environment and
  this fingerprint, and found what it found before.
- **Determinism** ([`determinism.txt`](sitemap-dates/determinism.txt)). Two
  builds of main fingerprint all 1,838 pages alike. Without the pinned clock,
  two builds half an hour apart differ on 36 pages, the build-time ones above.
- **#740** ([`merge-740.txt`](sitemap-dates/merge-740.txt)). Its merge against
  its first parent fails four pages: `/developers/`, `/developers/compare/`,
  `/developers/compute/` and `/developers/mcp/`.
- **#742** ([`merge-742.txt`](sitemap-dates/merge-742.txt)). Its merge fails
  four pages: `/developers/`, `/developers/compute/`,
  `/developers/docs/astrology-mcp-server/` and `/developers/mcp/`.
- **The 2026-10-13 edition**
  ([`edition-2026-10-13.txt`](sitemap-dates/edition-2026-10-13.txt)). Six
  merges (#728, #731, #730, #735, #737, #740) changed nine pages without
  re-dating them. Besides the developer pages, these are `/developers/docs/`,
  for #735's guides, and four Portuguese pages,
  `/pt/eclipses/`, `/pt/full-moon-calendar/`, `/pt/mercury-retrograde/` and
  `/pt/retrogrades/`, whose dates gained #737's first-day ordinal ("1º de
  maio"). 28 Spanish and Portuguese daily pages also changed; they were already
  dated 2026-10-13 and pass.
- **The 2026-10-14 edition**
  ([`edition-2026-10-14.txt`](sitemap-dates/edition-2026-10-14.txt)). Up to
  main at `8ae5a7af`, two pages were still undated: `/developers/` and
  `/developers/docs/astrology-mcp-server/`.
- **Re-dated here** ([`redated.txt`](sitemap-dates/redated.txt)). The seven
  pages still undated in production get the day they changed:
  `/developers/` and `/developers/docs/astrology-mcp-server/` 2026-10-14;
  `/developers/docs/` and the four Portuguese pages 2026-10-13. A build of this
  branch against main changes exactly those seven dates and no page's content.

Limits:

- It compares two commits of one edition, so a pull request and its base, never
  two days.
- Changes before the 2026-10-13 edition were not audited.
- It reads a page's `<main>`, title and description, with the copy above, not
  its JSON-LD or the rest of its head.
- It reads the HTML a page is served with, which is what a crawler reads
  without interacting. Every island renders on the server (no page uses
  `client:only`). Text a script writes in answer to the visitor, such as
  `/people/`'s count after a search or a calculator's reading after a birth
  is entered, is not part of a page's indexable content and is not
  fingerprinted (Codex's eighth finding on #752).
- It does not check a new page's date.

## What keeps S8 open

- **Changed pages.** Enforced from this change on, for every pull request
  (F-97); the pages found undated are re-dated.
- **Bing.** Evidence the repository can reproduce, such as an export from the
  owner's account, has to come from the owner.
