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
