# IndexNow for every new, changed or removed URL (S8), 2026-10-14

S8 is not accepted: two gaps remain (below).

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

## What keeps S8 open

- **Changed pages.** A run submits a page as changed only when its sitemap
  `lastmod` changes, and `src/pages/sitemap.xml.ts` keeps the dates of
  evergreen pages by hand, with no check that ties a rendered change to a new
  date (F-97). #740 changed `/developers/compare/` and #742 changed
  `/developers/compute/` and `/developers/mcp/` without re-dating them; the
  first production run submitted all three only because it covered every URL
  dated within 30 days. #745 re-dates them; the check is open.
- **Bing.** Evidence the repository can reproduce, such as an export from the
  owner's account, has to come from the owner.
