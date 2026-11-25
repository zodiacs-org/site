# Personal tools (next plugin version)

Four tools for the next version of the ChatGPT and Claude plugins, each in its
own draft pull request on top of the shared plumbing described here:

| Tool | What it answers |
| --- | --- |
| `get_astrocartography` | Where each planet was rising, setting, overhead or underfoot at birth, as map lines, and the closest lines to towns or cities the person names. |
| `get_vedic_signs` | Sidereal (Lahiri by default) Sun, Moon and rising signs, and the Moon's nakshatra. |
| `get_personal_day` | Today's transits to the person's own chart, ranked, with plain meanings. |
| `get_retrograde_for_me` | When Mercury, Venus or Mars is or next goes retrograde, the natal house it falls in, and what that house traditionally covers. |

## The switch

`ZODIACS_PERSONAL_TOOLS_ENABLED`, read as exactly `1`, and only with
`ZODIACS_OCCASIONS_ENABLED=1` and `ZODIACS_COVERAGE_ENABLED=1`. It is off in
production. Off, `initialize`, `tools/list`, `resources/list`, `get_capabilities`
and the account routes answer byte for byte as before
(`src/ai-tools/personal-tools.test.ts` compares them with
`src/ai-tools/accounts/flag-off.fixture.json`). On, the personal tools are
listed after every other tool, so every earlier entry keeps its place.

Nobody switches it on from a pull request; that is the owner's call.

## Where they are served

Since ZOD-63 (#1120), `/mcp` answers from the frozen published runtime
(`api/_ai/published/runtime.mjs`, checked against
`docs/platform/evidence/site-engine-1-1-0/connector-transition.json`) and
`/mcp/de440` from the current build, `api/_ai/runtime.mjs`. The personal tools
are in the current build only, so with the switch on they are offered on
`/mcp/de440`. Offering them on `/mcp` means publishing a new runtime there,
which changes the bytes the directories reviewed; that is the owner's call. The
local developer connector keeps its released server too (packaged as 0.3.56),
so these pull requests package no developer version of their own.

## The pages' switches

Each page has its own build flag: `PUBLIC_VEDIC_SIGNS_ENABLED` for
`/vedic-signs/`, `PUBLIC_YOUR_DAY_ENABLED` for `/your-day/`,
`PUBLIC_RETROGRADES_FOR_YOU_ENABLED` for `/retrogrades/for-you/` and
`PUBLIC_ASTROCARTOGRAPHY_ENABLED` for `/astrocartography/`
(`src/lib/launch-flags.ts`). Each is on only when exactly `1`. Off, the page
redirects to the 404 page, and its hub card, menu entry, sitemap row, links
from other pages, Guide line and share routes are all absent. Switch a page's
flag on and deploy before `ZODIACS_PERSONAL_TOOLS_ENABLED`. The hosted MCP
reads the same variable at run time: a tool whose definition names a
`pageFlag` returns its `pageUrl`, its `shareUrl`s and the link to its page only
while that flag is exactly `1`, and otherwise returns `null` for each and no
page link, so the order cannot leave a link to a missing page.

The Guide's line is the exception: the site assistant reads the committed
`api/_assistant/context.ts`, which is generated with every switch unset, and
the normal build does not regenerate it. Setting the flag on Vercel therefore
does not add the page to the Guide, and
`scripts/build-assistant-context.test.mjs` holds the committed module to the
switches-unset output. To put a launched page in the Guide, a pull request
removes its route from `LAUNCH_FLAGGED_ROUTES` in
`scripts/build-assistant-context.mjs` (for example, `'/retrogrades/for-you/'`
or `'/astrocartography/'`), runs `npm run data:assistant-context` with no
switch set, and commits the regenerated `api/_assistant/context.ts`, which
gains exactly that page's one line. Merge it only after the flag is on in
production, so the Guide never names a page that is not live. Until then the
Guide does not mention the page.

`public/llms-full.txt` is a static file and cannot follow a flag, so it keeps
saying the site uses neither `@zodiacs/engine/timing` nor
`@zodiacs/engine/vedic` while `PUBLIC_VEDIC_SIGNS_ENABLED` is off. In the
change that switches Vedic signs on, replace that clause with "the root imports
neither; this site uses the sidereal one only, for the ayanamsa, sidereal
longitudes and nakshatras of its Vedic signs page and get_vedic_signs tool, and
Hellenistic timing not at all." and update its record in
`docs/claims/ledger.json` to match.

## How a tool is added

Each tool is one module in `src/ai-tools/personal/` that exports a definition
made with `definePersonalTool` (name, title, description, input and output
schemas, whether its answer moves with the clock, an example call for the
shared tests, and `run`), appended to `PERSONAL_TOOLS` in
`src/ai-tools/personal/registry.ts`. `contracts.ts`, `tools.ts`, `server.ts`
and `http.ts` read the registry and need no change of their own. Pull requests
that each add one tool therefore touch the registry's list and the generated
bundles in common, and nothing else.

## Rules every personal tool keeps

- The answer is computed by Zodiacs' own code (the vendored `@zodiacs/engine`)
  and pre-written wording. No tool calls a language model.
- Birth details and place names are used for the one call. They are not stored,
  logged, counted or put in a link. Usage counting (`src/ai-tools/usage.ts`)
  names no personal tool, so no usage migration is needed while they are in
  preview; counting them at release needs an additive migration.
- A birth date less than 13 years ago, or still to come, gets the fixed
  under-13 refusal before anything is worked out, from the hosted server and
  from `executeAiTool` itself.
- Under 18, romantic and attraction wording is left out (`softenMinor`), and
  the sixth house never reads as health (`softenHealth`).
- Copy rule (Dias, November 2026): money, career, health and wellbeing, and
  legal themes are welcome as astrology traditionally reads them ("Jupiter in
  your 2nd house is traditionally a strong year for earnings", "Saturn here
  asks you to take rest seriously", "a good window to sign contracts"). Never:
  specific price, stock or crypto calls, buy or sell signals, diagnoses or
  medical timing, death predictions, or "you will win or lose" legal outcomes.
  `FORBIDDEN_CLAIMS` in `src/ai-tools/personal/shared.ts` catches those in
  every answer the shared tests make.
- A "for reflection" note is used only where it genuinely fits, not stamped on
  every result.
- No em or en dashes, and no token, market or crypto language in consumer copy.
  Each reading carries its "Reading confidence NN%" label.
- The rule above applies to the personal tools. The published tools, the
  server's `initialize` instructions and `AGENTS.md` still carry the earlier
  wording ("no ... health predictions"); changing those changes bytes the
  directories reviewed, so it is left for the release.
