# Release gates and rollback

Review candidate dated 2026-10-01. This implementation does not activate
production, submit an app, publish a package or claim a marketplace listing.
Local passing tests are evidence for the adapter only.

## Next concrete checkpoint: owner-controlled staging and real hosts

1. Review this diff and its generated bundles. Preserve the published rc.15 pin.
   Run `npm run ai:check`, `npm run ai:test`, `npm run ai:eval`,
   `npm run ai:widget`, `npm run build`, `npm run check` and `npm test`.
   The existing full Lighthouse gate currently fails homepage accessibility on
   clean main. Resolve that separately documented issue in
   [REGRESSIONS.md](./REGRESSIONS.md), then require the complete site-wide CI gate.
2. The current OpenAI extension, connection, package and submission guides were
   retrieved on 2026-10-01. Portable manifests and MCP files pass Agent Plugins
   1.0.0 schemas. Confirm the verified publisher account and workspace eligibility.
3. Deploy only to an authorized HTTPS staging host. Explicitly allow that
   hostname through `ZODIACS_MCP_STAGING_HOST`, publish the existing compute and
   events Firewall counters, then
   set `ZODIACS_MCP_ENABLED=1`. Test missing rules, shared provider-address quotas,
   health, malformed requests and rollback before connecting ChatGPT.
4. In ChatGPT Settings → Security and login, enable Developer mode. Add the
   staging MCP connection in ChatGPT Plugins and refresh metadata after changes.
   Complete all five
   positive submission cases, three negative cases, timezone ambiguity, unsupported
   kinds and widget errors. Record actual host outputs/screenshots. Confirm that
   the host accepts the tool schemas, hints, noauth and UI resource metadata.
   Open both native sidebar and thread entrypoints; confirm the initial seven-day
   UTC result needs no duplicate request. Change a date window and display zone.
5. Install the developer candidate in the actual Codex host. Current CLI help
   confirms `codex plugin marketplace add /absolute/path/to/site` and
   `codex plugin add zodiacs-developer@zodiacs-local-review`. Installation itself
   is blocked here by a read-only plugin-cache mount. CLI discovery recognizes
   both portable candidates. Install pinned runtime dependencies in the installed plugin
   directory, check working-directory resolution, invoke each skill and produce
   a tested integration in a disposable synthetic project.
6. Inspect hosting/provider logging and retention with synthetic canaries.
   Measure cold/warm latency and actual per-completion cost with representative
   bounded searches. Local timing is not production capacity or cost evidence.
7. Invite a small consenting panel only after these checks. Compare general sky
   updates, claim checking, developer jobs and the synthetic Personal Week Ahead
   demonstration. Collect aggregate usefulness and repeat-use feedback without
   birth fields, charts or identifying activity trails.
8. The packaged legal/support/privacy URLs and 512px icon pass local checks.
   Record actual host screenshots and the required reviewer-accessible video.
   Upload the sky ZIP, finish domain verification with the exact portal challenge,
   resolve scans, submit, and publish only after platform approval. These portal
   actions need access to the verified publisher's account. Local stdio MCP public
   distribution needs an OpenAI-supported path; do not submit it as remote HTTP.

The cloud environment has GitHub access but no Vercel token/project binding or
ChatGPT publishing session. The existing production `/mcp/health` returned 404
before deployment. No synthetic token, hosted screenshot, review result or
retention/cost observation should be substituted for these missing inputs.

## Distribution after acceptance

Use existing calendars, calculators, developer docs and source examples as
optional follow-through. A chat answer remains complete without a click. Do not
promise search-ranking gains, directory traffic or mandatory attribution.
Keep developer integrations and consumer links separate from the Registry wing.
Use relevant accepted fixes; never promotional commits in unrelated repositories.

Establish an admissible aggregate baseline before activation: useful completions
by operation/week, categorized error/refusal rates, latency/cost, aggregate
contextual referrals, consenting panel's reported second use and functioning
external integrations. No new user identifiers or event trails are implemented.
Follow the existing growth measurement restrictions; no metrics here are a
measured adoption or traffic baseline.

## Rollback

Set `ZODIACS_MCP_ENABLED=0` (or unset it): health and calculation requests return
503 with Retry-After and no-store. Remove the connection in the host if needed.
The existing compute API and local MCP adapter are unaffected. If reverting the
candidate, remove only its two rewrites, compatibility dispatch and new files;
do not change engine releases or existing compute Firewall rules.

## Personal release

The generated `evidence/synthetic-personal-week.json` uses an arbitrary chart,
unknown time and no houses/angles. It tests concept output only. Real personal
transit tools require accepted import/handoff, unknown-time behavior, privacy,
host retention and consenting beta evidence before implementation or launch.
