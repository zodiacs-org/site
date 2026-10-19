# Handoff to Codex, 20 October 2026

Written by Claude at the end of the session that built the share images, the
brand lockup, the localized art cards, the story pictures, the resubmission
fixes and the share links for the last three assistant cards. It says what is
left and exactly how to do it. Read it whole, then `CLAUDE.md` and
`DESIGN.md`; both are binding. The prompt Dias gives you says where things
stood at the moment of handoff; check it against GitHub before acting.

## Who you are working for

Dias Malayev owns zodiacs.org and is not a coder. Report to him in plain
words: what you did, what he will see, and the one thing he has to do, if
any. Do the work yourself; never hand him commands to run. Ask him before
anything that cannot be undone and before every step in the OpenAI portal.
He approved merging the pull requests named here once CI is green ("all next
steps are approved", 19 October); nothing else is pre-approved.

## Rules that bite

Everything in `CLAUDE.md` applies. These are the ones this work runs into.

- **Copy.** No dashes as punctuation in copy (no em or en dash; number ranges
  such as 1800–2199 are fine). No middle dots in copy; the lockup's dot in
  ZODIACS · ORG is the one exception. Scores and ratings are fine; never
  guarantee an outcome; no health or investment claims. No token, market or
  crypto words on any consumer surface, share pages and pictures included.
- **Match the site.** Dias's standing instruction: "Match the site's outcome
  exactly. Don't invent a separate card style. If the site doesn't do
  something, the cards don't either."
- **Generated files.** Never hand-edit generated output. After any change
  under `src/ai-tools/`: `npm run ai:build`, then `npm run ai:package`, then
  `npm run ai:check`, and commit the regenerated runtimes
  (`api/_ai/runtime.mjs`, `plugins/zodiacs-developer/mcp/server.mjs`,
  `integrations/generated/*.mjs`) and the rebuilt
  `integrations/packages/zodiacs-developer-0.3.13.zip` and `manifest.json`
  with the source. When `tools/list` changes, recapture the flag-off fixture:
  `CAPTURE_FLAG_OFF_FIXTURE=1 npx vitest run src/ai-tools/accounts/flag-off.test.ts`.
- **Pinned files.** Never overwrite a published file under a pinned or dated
  name: OG card families v2 to v8 (including `v8/{es,fr,it,pt}/`), Registry v3
  and v4, Astrofolio v4 to v6, `zodiacs-sky-0.5.0.zip`. New versions get new
  names.
- **Fonts.** Self-hosted only. The share renderer (`@vercel/og`) fetches a font
  from Google whenever a glyph is missing from the fonts it was given; the
  tests forbid `fetch`, so a missing glyph fails a test. That is why the story
  arrow is drawn as SVG and why EB Garamond's Cyrillic 500 is bundled. The
  renderer's body text is Noto (Latin only): never put a Cyrillic or other
  non-Latin string in a Noto line.
- **Functions.** Every share route goes through `api/compatibility.ts` and its
  `__zodiacs_share` dispatcher (`isResultShareRoute`,
  `handleResultShareNodeRequest` in `src/server/result-preview.ts`), with a
  rewrite in `vercel.json`. Do not add a file under `api/`.
- **Share links** carry only what their picture shows, never a birth date,
  time or place. Each key once, only its own keys, every value from a fixed
  vocabulary or pattern; anything else is not a share and gets 400
  (`src/lib/share-results.ts`, `src/ai-tools/share-links.ts`).
- **Commits.** Commit regenerated output with its source. Pull requests go
  against `main`. Never push to `main` directly.
- **Never** delete the `ZodiacsOfficial` GitHub organization or create a
  repository named `site` or `sdk` in it. Never commit flag-on output (the
  Registry Aura marker stays `content="0"`). `api/_assistant/persona.ts` is
  edited only by Fable.

## What is merged and live (20 October)

| PR | What | Live check done |
| --- | --- | --- |
| #794 | Spanish, French, Italian and Portuguese art share cards | Yes: `/es/` serves `og/v8/es/home.jpg`, `/fr/aries/` serves `og/v8/fr/sign/aries.jpg` |
| #796 | Story pictures (1080 × 1920) for the five share links | Share page offers "Save the picture for your story" |
| #795 | Inline scripts minified at postbuild (speed headroom) | CI only |
| #797 | Russian sky calendar, "An Aries Sun", Cyrillic share names | See Task 2 |

Last in line: **#798** (`design/share-last-three`), share links, link
previews and stories for chart twins, a famous chart and a life milestone,
plus the chat cards' long-name fit. Claude meant to merge it before handing
over; if GitHub shows it merged, skip to step 4 of Task 1.

Skip any step GitHub or production shows is already done.

## Task 1: land #798

1. Check its CI ("Site Check" workflow, job "Build & Check", about 45
   minutes; Lighthouse alone about 12). If it is red, read the failing step's
   log before anything else. Known flakes; rerun the failed jobs once before
   investigating:
   - I18n route-boundary check on `/es/learn/`;
   - CLS on the Russian calculator (about 0.0076);
   - tiny CLS on Today's dated block (`nav.hz-signrail`, about 0.003) in
     "Today SSR and personalization";
   - CLS on `/ru/birth-chart/` in Browser Evidence.
2. If `main` has moved since its last run, merge `main` into the branch
   (`git fetch origin main && git merge origin/main`), then run
   `npm run ai:check` and
   `npx vitest run scripts/phase1-acceptance-evidence.test.mjs`. If the
   evidence test fails, recapture Phase 1 (recipe below) and commit it.
   Push, wait for CI again.
3. Merge with a merge commit (not squash), pinned to the head you tested
   (`gh api -X PUT repos/zodiacs-org/site/pulls/798/merge -f merge_method=merge -f sha=<head>`).
4. Wait for `main`'s own push run to finish green, and for the Vercel
   production deployment of the merge commit (project `zodiacs-org`, team
   `zodiacsofficial`) to be Ready.
5. Production checks. Open each in a browser or with a plain HTTP client
   (not a tool that adds query keys: the routes refuse unknown keys with 400,
   so Vercel's bypass-link fetcher always gets 400 here, which is expected):
   - `https://zodiacs.org/share/chart-twins/?s=taurus&m=leo`: a page titled
     with the Taurus Sun and its first twin; its `og:image` is
     `/api/og/chart-twins-image?s=taurus&m=leo`, a 1200 × 630 JPEG under
     300 KB; "Save the picture for your story" links
     `/api/og/chart-twins-story?s=taurus&m=leo`, a 1080 × 1920 JPEG.
   - `https://zodiacs.org/share/famous-chart/?p=frida-kahlo`: Frida Kahlo,
     "Cancer Sun at 13.5°"; image and story as above with `p=frida-kahlo`.
   - `https://zodiacs.org/share/milestone/?k=saturn-return&i=1&a=29&f=2026-04-23&l=2026-12-31`:
     "First Saturn return", age 29, "Under way now" while the date is between
     the two days; image and story with the same query.
   - `https://zodiacs.org/share/famous-chart/?p=not-a-person` answers 404 or
     400, never a page.
   - On the live MCP (`https://zodiacs.org/mcp`): `find_chart_twins` with
     `{ "birthDate": "1990-05-03" }` returns a `shareUrl` starting
     `https://zodiacs.org/share/chart-twins/?s=taurus`; `get_famous_chart`
     with `{ "name": "Frida Kahlo" }` returns
     `https://zodiacs.org/share/famous-chart/?p=frida-kahlo`;
     `get_life_milestones` with `{ "birthDate": "1997-05-01" }` returns a
     `shareUrl` under `/share/milestone/` with no `b=` or birth date in it.

## Task 2: production checks for #797

Through the live MCP at `https://zodiacs.org/mcp` (the occasion tools are on
in production):

- `get_sky_calendar` with `{ "language": "ru" }` answers (not
  `calculation-failed`) and its `next[0].title` is in Cyrillic.
- `get_occasion_sky` with
  `{ "occasion": "wedding", "date": "2027-04-10" }` (an Aries Sun) writes
  "An Aries Sun is the sign of beginnings" in its lines, never "A Aries".
- `get_compatibility` with
  `{ "a": { "name": "Анна", "birthDate": "1994-08-21" }, "b": { "name": "Иван", "birthDate": "1992-03-02" } }`
  returns a `shareUrl` whose `a` and `b` parameters decode to Анна and Иван,
  and that link's page shows "Анна and Иван" in the heading; its
  `/api/og/compatibility-image?...` picture draws both names in the serif.

If one fails, fix it on a new branch with a test that fails first, and open a
pull request; do not patch production by hand.

## Task 3: the OpenAI portal, with Dias watching

Only after Tasks 1 and 2, and only with Dias's yes for each step. The plan is
`docs/platform/zodiacs-ai/RESUBMISSION-0.5.0.md` ("The listing", "The demo",
"Checks that decide approval", "Who does what"):

1. Rescan the draft so it reads the new tool descriptions and output schemas
   (`get_birthday`, `get_sky_calendar`, `get_horoscope`, `find_chart_twins`,
   `get_famous_chart` and `get_life_milestones` changed).
2. Paste the About from "The listing" (it lost its two dashes on 20 October)
   and the changed test cases.
3. Record what the scan says in `docs/platform/zodiacs-ai/PORTAL_REVIEW.md`
   after each step.
4. When Dias has recorded the 45-second demo (shot list in
   `RESUBMISSION-0.5.0.md`), cut it as described under "After recording" and
   publish it at the path given there.
5. Dias authorizes the submission and confirms the attestations himself.
   Never submit or attest for him.

## Not to do without Dias

These came up during the work and are his decisions. Raise them; do not act.

- The chat cards' design: they keep the site's fonts and colours. ChatGPT's
  guidance discourages custom fonts and Claude prefers host colour tokens;
  switching is his call.
- The occasion cards' template address is still `ui://zodiacs/occasions-v4.html`
  (since 16 October), and the panel has changed since. If the rescanned app
  shows stale cards, the fix is the existing pattern in
  `src/ai-tools/contracts.ts`: `OCCASIONS_URI` to `occasions-v5.html`, the
  old address into `LEGACY_OCCASIONS_URIS`, then `ai:build`, `ai:package`,
  `ai:check`. Ask first; it is a release decision.
- The compatibility card's "Open both charts" link carries both people's full
  birth details in its address. It works as designed; shortening it is a
  privacy choice.
- Redoing the Famous chart reveal (built for direction B; the story pick is A).
- A Cyrillic italic for the share renderer: no kicker is Cyrillic today.
- The prime mark (′): Instrument Sans has none, so degree minutes fall back to
  another font on the site.
- Removing the `*.blob.core.windows.net` download allowance from Claude's
  environment settings (Dias added it so CI baselines could be downloaded).
- Refreshing old link previews in Facebook's Sharing Debugger and LinkedIn's
  Post Inspector: those need his login; never sign in for him.

## Recipes

**Phase 1 recapture.** Needed when a pull request changes a Phase 1 template
source (`tests/visual/phase1-evidence-contract.mjs` lists them; `package.json`
and `src/lib/share-results.ts` are among them) and
`scripts/phase1-acceptance-evidence.test.mjs` fails. From the branch with
`main` merged in and `node_modules` installed by `npm ci` (not symlinked:
11 path-sensitive tests fail on a symlinked copy):

```bash
DAY=$(node -p "require('./src/data/daily.json').date")   # the committed daily edition
CLOCK=${DAY}T12:00:00Z
ZODIACS_FROZEN_CLOCK=$CLOCK NODE_OPTIONS="--import=$PWD/scripts/frozen-clock.mjs --max-old-space-size=6144" npm run build
ZODIACS_FROZEN_CLOCK=$CLOCK NODE_OPTIONS="--import=$PWD/scripts/frozen-clock.mjs" node tests/phase1-acceptance-drive.mjs
npx vitest run scripts/phase1-acceptance-evidence.test.mjs
git add docs/acceptance/phase1/screenshots && git commit
```

If the merge conflicts in `docs/acceptance/phase1/screenshots/manifest.json`,
take `main`'s copy first; the drive rewrites it and the screenshots. The drive
needs a Chromium (it finds one through `tests/visual/browser.mjs`;
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and `CHROMIUM_PATH` point it at one).

**Visual baselines.** When a visual check fails only by text antialiasing,
take CI's "Browser Evidence" candidates (Chromium 149) as the new baselines.
Never regenerate baselines on another Chromium.

**Phase 1 scope guard.** `scripts/phase1-scope-guard.mjs` fails changes under
its protected paths (the Registry wing, the SDK, the English sign guides,
Learn, `src/pages/{es,pt,fr,it}/`, `src/lib/i18n`, locale catalogs). #798
touches none. If your own work must, add a one-time
`.github/phase1-scope-allowance.json` (`version`, `id`, `baseCommit`,
`protectedPaths`; see git history for the format) whose `baseCommit` is
`main`'s tip at the moment of merge; if `main` moves first, update it and push
again. If `main`'s push run fails the guard because `main` moved during a
merge, dispatch "Site Check" with `scope_base` set to the commit before the
merge.

**Merging.** The daily horoscope workflow commits to `main` every day at about
00:00 UTC, so `main` moves daily; re-check the head before merging.

**Fetching main in a worktree.** Use
`git fetch origin +refs/heads/main:refs/remotes/origin/main`; a plain
`git fetch` in some worktrees does not move `origin/main`.

## Definition of done

- #798 merged, `main` green, production checked as in Tasks 1 and 2.
- `npm run build && npm run check && npm test`, `node scripts/check-dist.mjs`
  and `npm run ai:check` pass on `main`.
- A short report to Dias in plain words: what is live, what he will see, and
  the portal steps waiting for his yes.
