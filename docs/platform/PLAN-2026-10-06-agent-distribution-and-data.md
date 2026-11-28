# Plan, 6 October 2026: distribution to AI assistants, and the data layer

Written 6 October 2026 by a Claude Code session on Fable 5.1, from the brief of
the same date, the repository at `main` `6c1766ed` (#656), pull request #618 at
`ede0cb6c`, and a research round of 22 agents (six repository readers, six
fact-checkers against primary sources, one registry probe, a completeness
critic and eight follow-ups) run the same day. This document changes no code
and no ledger. It updates the September strategy
(`ENGINE-AND-PLATFORM-BRIEF.md`, version 2) for two things: getting
Zodiacs.org into the places assistants and their users find tools, and the
outside data we archive, license or build. Every work package below is meant
to be carried out by Opus 5.5 in its own session, after the owner has answered
the decisions in part 5.

Dates are 2026 unless written out. "Checked" means read on 6 October on the
source's own page or in the repository at the commit named above.

---

## 1. Owner summary

**Where we are.** Everything that gets Zodiacs.org in front of AI assistants
waits on one thing: a live address, `https://zodiacs.org/mcp`, where ChatGPT,
Claude and the others can call our tools over the connection standard they
all share (MCP). Today that address answers "not found". The code exists twice. The programme's own server, already in the main
code line, has six tools and runs only on a person's own computer. Pull
request #618 has a second, separate server with six tools of its own (four
new names, and two that share a name with the programme's tools but take
different inputs and give different outputs), connected to the `/mcp`
address but switched off. Both stores (Claude's directory and the ChatGPT
directory), the official registry, and the external-builder trial you
decided on 5 October all need the same live address. So the first
job is to make one server from the two, switch it on, and then list it
everywhere in one sweep.

**What to do first, in order.**

1. Answer the decisions in part 5. The ones that block work are 1 to 7: one
   server and one set of tool names; whether the hosted server takes birth
   data at all; the name of the package developers install (on npm, the
   download site for JavaScript packages); a small public code repository
   for the plugin files; which Claude and OpenAI accounts submit; the name we
   register under in the official MCP Registry (`org.zodiacs`, which you
   prove you own with one DNS record on zodiacs.org); and the name of the
   one-instant sky tool.
2. Do the four things only you can do: in Vercel's Firewall, lower the two
   rate limits on the compute API, as you decided on 5 October, from 40 to 30
   and from 10 to 6 requests a minute per visitor address (the live settings
   are still 40 and 10); put the OpenAI verification through (it is "in
   review"); decide whether to pay for one Claude plan, which the Claude
   directory requires and which your 28 September no-new-spending decision
   does not cover (decision 5); add one DNS TXT record on zodiacs.org, whose
   exact text Opus will give you, to prove we own the registry name.
3. Let Opus merge the two servers into one, deploy it to a preview, show you,
   then switch it on (work package WP-1). Same week: the registry entry
   (WP-3). The npm package (WP-2) waits for your answer to decision 3: on 5
   October you decided the next npm publication is the 1.0 candidate, and
   the first upload is a manual publish from your own npm account that only
   you can do.
4. List, in this order: the official MCP Registry (free, same day), the Claude
   connector (a URL, scanned automatically, listed as "Community"), the Claude
   plugin (a small public repository), then ChatGPT (needs the verification, a small proof-of-ownership file on
   zodiacs.org, a demo video, and eight test cases, most of which #618
   already has). Then the cheap extras: the Gemini extension gallery,
   Cursor's marketplace, Glama (a directory that picks us up from the
   registry on its own) and the community-kept "awesome" lists on GitHub. Skip Microsoft, Alexa and Apple for now; they have no
   open route.
5. On data: the vault the cloud session started today is right. Keep it,
   adopt its rules, and add a second copy in a place you choose. Read the
   Astro-Databank contract before archiving anything from it. Nothing from
   the Open Gauquelin database goes public until its maintainer confirms its
   licence. The one exception is the seven birth-certificate transcriptions
   the project itself marks CC BY-SA 4.0: WP-11 uses those now, with credit,
   as a separate share-alike dataset.
6. Start two things the research round found nowhere else on 6 October: a
   machine-readable "how good
   is this birth time" record format with sources (built on the people pilot,
   with the Gauquelin pilot as its first test), and an open corpus of
   newspaper evidence for historical clock time, which feeds the time atlas.
   Kill the on-chain timestamps idea.

**Why this and not more precision.** The honest numbers: on the public
conformance suite our shipped engine is within a median of 2.1 arcseconds of
NASA's Horizons, worst case 18.8, across 240 positions from 1851 to 2148.
Swiss Ephemeris is at 0.006 on the same test, and the best hosted competitor
publishes 0.05. No natal reading can see any of these differences, but we
cannot sell precision this year. What we can sell, and none of the hosted services or MCP
servers the research round checked on 6 October offers: a public test suite
anyone can run against any engine; a receipt on every answer that anyone can
recompute with our open engine (Astro Agents' hashes can only be checked
through its own service); an engine under the permissive MIT licence that a
developer can run on their own machine; no sign-up key and no stored birth
data; and the only open and cited handling of historical clock time among
them (Astrodienst's atlas is proprietary), which is where most wrong charts
come from. That is the pitch in part 3B, in
three sentences you can repeat.

**What this plan does not do.** It does not merge #618 as it is. It splits it
into four pieces that land one at a time. It does not change the programme's
ledger; it proposes the ledger changes as decisions for you to record.

---

## 2. What I verified and what I could not

The brief asked for everything to be treated as leads. The research round
checked each lead against a primary source on 6 October. The table gives the
verdicts that change the plan; the full reports are in the session's
research folder and are not committed.

### 2.1 Corrections to the brief

| Brief said | Checked | What is true (6 October) |
| --- | --- | --- |
| The site repository is "about 2 GB" | GitHub at `ede0cb6c` | 779.5 MiB unpacked, 17,933 files and folders. Still far over Claude's limits (50 MiB archived, 256 MiB unpacked, 10,000 entries), so the conclusion stands: plugins need their own small public repository |
| #618's checks "were failing on 6 October" | GitHub Actions | All 20 Site Check jobs passed on `ede0cb6c` at 13:06 UTC and the PR was mergeable. `main` itself was red from 07:00 UTC (Lighthouse on `/ru/`, the i18n route-boundary test) |
| ChatGPT plugins date from 30 September | OpenAI developer docs | Codex plugins: 25 March. The plugin directory replaced the app directory on 9 July (secondary source). Interactive extensions: 29 September. The directory is shared by ChatGPT and Codex |
| Submission needs an organisation owner | OpenAI developer docs | Any member with the Apps Management Write role can submit. Individual or business verification is enforced |
| "Select plugins are available in all plans, including ChatGPT Free" | help.openai.com (blocked, 403) | Not found. Search summaries say the directory is visible on all plans and availability varies by plugin; extensions are not on Free or Go. Unverified |
| Reviewer credentials are required for MCP plugins | OpenAI developer docs | Only when the server needs sign-in. Ours does not |
| Category "Lifestyle" (used in six places in #618) | OpenAI plugin manifest reference; live directory | Not an accepted value. The 13 accepted values include Education & Research, Entertainment and Other. Open Ephemeris, the closest precedent, is listed under Education & Research. Any other value fails with `plugin_category_unknown` |
| Claude needs `_meta.ui.domain` set to a hash under `claudemcpcontent.com` | Anthropic docs; ext-apps tests | Optional on Claude, validated only when present (absent: 10 of 10 rendered; wrong: 0 of 8). OpenAI requires a domain for UI submissions and defines `openai/widgetDomain` as an alias. One static `_meta.ui.domain` cannot satisfy both hosts; the alias probably can (unverified in OpenAI's portal) |
| Claude: any paid plan can submit; two listing kinds; the review rules; the exclusions; the 50 MiB, 40-word README, LICENSE and lockfile rules | Anthropic docs | All confirmed. Added: Team and Enterprise need an Owner; the repository may stay private until go-live; plugins reach paid plans only, connectors reach Free users; no DNS or `.well-known` proof is required; authless servers are accepted; "Verified" cannot be applied for |
| The MCP Registry verifies a namespace by GitHub login or DNS | Registry docs and source | Four methods: GitHub login (`io.github.<login>`), GitHub Actions OIDC, DNS TXT (grants subdomains too), or an HTTP file at `/.well-known/mcp-registry-auth` (exact domain only). Schema `2025-12-11`; a remote entry needs `remotes[{type: streamable-http, url}]`; an npm entry needs `mcpName` in the published `package.json`. Free, still "preview", publishes no install counts, and entries cannot be deleted |
| A registry entry gets the server "listed wherever MCP clients discover servers" | Registry docs; client docs | No. Only Glama ingests the registry automatically (PulseMCP has paused submissions, as its submit page dated 3 September says; Zed plans a migration). GitHub's registry for VS Code and Copilot is curated (375 servers; none of the registry's astrology servers). Anthropic's directory ignores it. Every other listing is a separate submission |
| Gemini CLI has an extensions gallery | Google docs | Yes (2,165 entries; a public repository with `gemini-extension.json` and the topic `gemini-cli-extension`; crawled daily, no review). But Gemini CLI stopped serving Free, AI Pro and Ultra users on 18 June; Antigravity replaced it with a curated marketplace. The consumer Gemini app lets a user add any MCP server by URL (US, 18+, English, personal accounts) and has no open directory (its Connected Apps list carries Google's partners only, with no public route in) |
| Microsoft Copilot, Alexa+, Apple | vendor docs | Consumer Copilot has only first-party connectors; the third-party store is for work and school tenants with certification and server authentication. Alexa+ MCP is for selected partners. Apple has no MCP route and lists fortune telling among saturated app types it will not accept |
| New since the brief | vendor docs | Meta opened a reviewed connector directory for Muse (US-only; business verification). Mistral's assistant is now Vibe; directory listing runs under partner terms with no public form. Every Grok user can add a custom MCP server; Grok Bot installs plugins from the Cursor marketplace, which requires open-source plugins |
| RoxyAPI: own ephemeris "verified against DE441" | roxyapi.com | The engine reads DE440; DE441 is the Horizons reference it is compared with. Its benchmark median went 16″ (April), 1.5″ (July), 0.05″ (29 September). 97 of its 258 tools are astrology; the rest are tarot, numerology and similar. Annual billing is $32 to $291 a month |
| Astro Agents: pay per call | astroagents site | Only over REST. MCP calls are free for three calls per client, then the tool points at the paid endpoint |
| Source Library: 75 texts | sourcelibrary.org | 75 is one sub-collection. The Astrology & Divination collection lists 1,726 books. It is listed in the Claude directory as a Community connector (10 tools, sign-in required) |
| Open Ephemeris: npx package | openephemeris.com | The package is a client of their hosted API; birth data still goes to their servers. Their terms forbid publishing a competitive benchmark without written consent |
| "Over a hundred community astrology MCP servers" | Registry, Smithery, Glama, GitHub | Official registry, keyword search: 99 entries, 71 remote; name search: 11. Smithery: about 25 real ones. GitHub: 143 repositories, 130 created in 2026; the 119 that name MCP come from about 100 owners. Estimate: 100 to 150 public servers, 40 to 60 hosted. Quote one count with its method |
| Astrology has precedent in the stores | live directories, signed out | ChatGPT: at least 39 astrology or divination plugins live (Open Ephemeris under Education & Research; others under Entertainment and Other). Claude: seven astrology or divination connectors, all Community, none Verified; three added after the portal opened on 25 September |
| HYG v4.0 "attribution required (U: CC BY-SA)" | astronexus | CC BY-SA 4.0 for v4.x; 2.5 applied to v3 and older. Current release v4.4 (12 July) on Codeberg; the GitHub repository is archived. ShareAlike binds any derived star list |
| JPL DE440/DE441: redistribution needs care | NAIF rules page | Unmodified kernels may be redistributed by anyone with attribution. A modified kernel must carry the modifier's name and a new file name. Nothing requires asking NAIF before distributing a derived coefficient pack, but NAIF's rules are silent on non-SPICE coefficient sets, so the repository's "wait for NAIF" caution (the September strategy's owner decision §10.8, NAIF; not this plan's decision 8) is not contradicted; it is simply ours |
| JPL Horizons: "no terms on the API page" | JPL SSD API Fair Use Policy | There is a policy: one request at a time, an application-specific `User-Agent` with name, version and contact, no embedding in a web page. None of the repository's four Horizons fetchers sends one. CI has never called Horizons live in 282 runs (it rebuilds from committed responses and would call live only if a response file were missing, which the drift gate would then fail), so this is a hygiene fix, not an incident |
| IERS EOP 20 C04 "free with citation" (site evidence) | IERS and Paris Observatory pages and file headers | No terms, licence or citation request is stated anywhere. The engine's reading ("no statement found") is right; the site's evidence folder and `sources.json` need correcting. Bulletin A is "Approved for public release: distribution unlimited" |
| tzdb pinned at 2025c | IANA | Latest is 2026e (29 September), five releases on. Pre-1970 changes that reach us: Dublin's 1925 fall-back, Yellowknife now following Edmonton (an unannounced backzone removal). No Node release carries 2026d or 2026e yet; from 1 November any 2026c host gives Manitoba winter offsets one hour off |
| Treindl's tz-list post, June 2020 | lists.iana.org archive | All quoted figures are there (about 25 million records; 1 %; zone-name cities; USA and Canada worst; counties and towns until 1967; Shanks). Nuances: the 1 % is measured against Astrodienst's own tables and reflects astro.com users' birthplaces; the law is the Uniform Time Act of 1966 |
| Chronicling America via the LoC API | loc.gov | Reachable only through the loc.gov API now. 20 JSON requests a minute, a one-hour block for going over, a general guideline of 10 a minute. Gallica: commercial reuse and AI use are paid unless academic. Delpher: text and data mining reserved against commercial parties. Trove: needs a key |
| Open Gauquelin Database | opengauquelin.org, g5 repository | Counts confirmed (25,872 people, 24,542 with times, 1572 to 1959, 25 countries). The About page lists GPL, FDL and CC BY-SA 4.0 without saying which covers the data; the exports carry no licence notice; the 92 birth-certificate transcriptions are each marked CC BY-SA 4.0. The vault's source note says the maintainer was asked by email on 6 October (sender not recorded); no answer yet. Some people born up to 1959 may be alive |
| Vercel plan "Hobby" (runbook) | Vercel API | Pro since 31 August. Twelve functions deployed, no cap on Pro. Functions run Node 22 (the project setting says 24 but `package.json` overrides it). `CLAUDE.md`'s "24.x" is wrong |
| Firewall rules 30 and 6 (decided 5 October) | Vercel Firewall config v6 | Still 40 and 10. F-78 stays open |
| GitHub Actions | run history | The account behaves like GitHub Free: 20 concurrent jobs, and Site Check's 19 jobs take 19 of them |
| `zodiacs-mcp-server` and `@zodiacs/mcp-server` on npm | npm | Neither exists. The unscoped name is unclaimed, so anyone could register it. `@zodiacs/engine`: `latest` rc.15, `next` rc.16; 468 downloads in the week to 4 October. PyPI `zodiacs` 0.1.0a1 wraps rc.14. JSR has the scope with no versions. One Zenodo DOI (rc.15) |
| Context7 and DeepWiki | their sites | Context7 does not index `zodiacs-org/engine` (404). DeepWiki could not be checked (bot challenge) |

### 2.2 What could not be verified, and why

First, one check the brief asked for before adding this file: whether any
test scans `docs/platform/PLAN-*.md`. None does. The tests that read
`docs/platform/` name `programme/*`, `evidence/**` and
`ENGINE-AND-PLATFORM-BRIEF.md`; the claims ledger's scope is the
consumer-boundary roots plus `docs/engine-validation/README.md`,
`public/llms-full.txt` and `scripts/build-assistant-context.mjs`. This file
is outside every scan.

- **Astro-Databank's export terms and price.** Not checked, by the owner's
  rule not to open those pages. The plan relies on the owner's email thread.
- **Anything inside the two store portals** (category lists, queue times,
  how a folder with both manifests is treated): the portals need the owner's
  sign-in and were not used.
- **Help Center and openai.com pages** (plan availability, usage policies):
  403 bot challenges, not bypassed.
- **Perplexity and xAI pages** (403): connector availability rests on press
  and changelogs.
- **Whether `openai/widgetDomain` satisfies OpenAI's UI submission check:**
  only an owner-run developer-mode test can settle it (WP-6).
- **Live behaviour of #618's server on Claude:** the endpoint is not deployed.
- **Vendors' tool counts and inline rendering:** taken from their pages; no
  vendor endpoint was called.
- **The Gauquelin pilot's certificate scans:** the pilot read the project's
  text transcriptions, not the scans.

### 2.3 Two findings about our own numbers

- The brief's "~30″ max" for the shipped path is a comparison with Swiss
  Ephemeris (the rc.17 refresh gives Pluto 29.1″ in 2199), which the claims
  policy forbids as the basis of a public accuracy claim. The public figure
  is the conformance suite's L1 result against Horizons: median 2.08″, p95
  12.0″, max 18.8″ (Neptune), 240 positions, 1851 to 2148, with Swiss at a
  0.0055″ maximum on the same vectors. The site's older "14.8″" covers 13
  longitudes at two dates. Any new page that quotes a figure needs a claims
  ledger record.
- The tree already departs from its own birth-data rule in one place: Frida
  Kahlo's 8:30 birth time, typed in from Astro-Databank and labelled "AA
  (birth record)", used in the demo chart, a profile disclosure and engine
  tests. Decision 16 asks what to do with it.

---

## 3. The plan

### A. Distribution

#### A.1 One endpoint, one package, one vocabulary

**The endpoint** is `https://zodiacs.org/mcp`: Streamable HTTP, stateless,
no authentication for public tools, read-only. It is served the way #618
already wires it: `vercel.json` rewrites `/mcp` and `/mcp/health` into the
existing `api/compatibility.ts` function, so no thirteenth function is added
(the repository's own test pins twelve). It stays off until
`ZODIACS_MCP_ENABLED=1` is set in production, after a preview the owner has
seen. Rate limits reuse the compute API's two Firewall rules, which the owner
sets to 30 and 6 (decision of 5 October, not yet applied). A health probe
must not spend a quota slot, and neither should a `resources/read` (Chart
Studio's template is 0.95 MB and Claude re-reads it on most renders).

**The package** is `@zodiacs/mcp-server` on npm, the name the owner chose on
28 September (§4), replacing the unpublished `zodiacs-mcp-server`. It is the
stdio adapter for people who want the tools offline, in Claude Code, Cowork,
Codex or Cursor, and it is what the registry's npm entry points at (its
`package.json` must carry `mcpName: org.zodiacs/mcp`). The first publish is
manual from the owner's npm account with two-factor; releases after that use
trusted publishing from GitHub Actions, as the engine does. Do not publish a
placeholder under the unscoped name; just stop advertising it.

**The vocabulary.** The programme's adapter (`src/mcp/`) and #618's Sky server
(`src/ai-tools/`) are two implementations over the same compute modules
(`src/lib/compute-api/endpoints.ts`), so their receipts already agree and only
their tool names, schemas and `cite` anchors differ. They are one effort that
was built twice. The merged server keeps one `createServer()` factory and two
transports: the stdio bundle (no HTTP code, as the artifact test requires) and
the HTTP handler from #618 (host and origin checks, counters, fail-closed,
the 2026-07-28 protocol envelope that #618 already tests). The programme's
names win because they are in the ledger and the brief.

| Final name | Today on `main` | Today in #618 | Change |
| --- | --- | --- | --- |
| `get_capabilities` | yes | yes, different shape | one shape: tools, limits, engine, privacy, conventions |
| `get_positions` | yes (100 instants) | none | unchanged |
| `get_sky` | none | `get_sky` (one instant, Moon phase, display zone) | kept as the one-instant, reader-friendly tool. With no instant it answers for now, which is what the ledger's A1.d calls `get_sky_today`; decision 7 records the name |
| `find_events` | yes | `get_upcoming_events` (31-day window, `{}` means next 7 days) | one tool: `{}` means the next 7 days; the window cap is the compute API's 92 days, with the events budget applied |
| `check_sky_fact` | yes | yes, different schema | one schema, keeping #618's "depends" verdict for date-only claims |
| `calculate_natal_chart` | yes (local) | none | hosted only after decision 2; until then local (stdio and Chart Studio) only |
| `compare_calculation_records` | yes (local) | none | same as above; needs a 160 KiB body cap when hosted |
| `resolve_birth_time`, `search_places` | not yet (A1.c) | not yet (#618 bundles 1,000 cities into Chart Studio) | new, after WP-1's first slice; `search_places` from the GeoNames shards |
| `explain_factor` | not yet (A1.d) | none | later; needs the cited corpus (D8) |
| `search_zodiacs` | none | yes: at most five links to our own pages | dropped as a tool. Both stores forbid descriptions that promote or steer; a tool whose only output is our own URLs reads as promotion and fails on full-sentence queries anyway. The catalogue becomes an MCP resource, `zodiacs://pages`, beside `zodiacs://conventions` and `zodiacs://methodology` |
| `open_chart_studio` | none | yes (`{}`; MCP Apps resource) | kept, added by WP-7 and registered only when the client negotiates the MCP Apps extension; hidden otherwise |

Every tool: a `title`, `readOnlyHint: true`, `destructiveHint: false`,
`openWorldHint: false`, an output schema, and a `cite` with the receipt
digest. `idempotentHint` is true except where the default input is "now"
(`get_sky`, `find_events` with `{}`), which #618 already marks false. Tool
descriptions carry no product language: Anthropic's checklist and OpenAI's
guidelines both fail a description that steers the model.

**The listed set, at first.** When the flag goes on, the hosted server
exposes the public-sky tools (`get_capabilities`, `get_sky`, `get_positions`,
`find_events`, `check_sky_fact`); `open_chart_studio` and its UI resources
join with WP-7 as a tool update on the same endpoint (decision 8). The three tools that take birth
data or chart records stay local until decision 2, for two reasons: OpenAI's
guidelines ask for minimal inputs with no raw location fields, and the
owner's rule is that birth data stays in the browser. Chart Studio already
keeps it there. Adding the natal tools later is a tool update on the same
endpoint: Claude rescans, OpenAI holds the update for its automated checks.

**What happens to #618.** It is not merged whole. It splits along the lanes
in part E: the server (folded into WP-1), the plugin folders (moved to the
plugin repository, WP-4), Chart Studio (WP-7), and Sky Watch (its own
decision, 11). Its evidence folder and the submission notes stay in the
repository as history. Its 12 binary ZIPs under `integrations/packages/` do
not come to `main`; packages are built by CI in the plugin repository.

#### A.2 Host by host

Order is by cost against reach, after the endpoint is live. "Have" means in
the repository or #618 today. Every listing, skill, README and example prompt
stays inside the consumer content boundary: no token, market or crypto
language and no wing link (brief §4.1 and §9); the cross-promotion question
stays with counsel (the September strategy's owner decision §10.9). WP-5 and
WP-6 check the store descriptions and prompts against the same rules by hand
before submission.

| Host | Requires (checked 6 October) | Have | Gap | When | Owner decisions |
| --- | --- | --- | --- | --- | --- |
| **Official MCP Registry** | a `server.json` (schema 2025-12-11): reverse-DNS name, description ≤ 100 chars, version, `remotes[streamable-http]`, optionally `packages[npm]` with `mcpName` in the published package; namespace proof by DNS TXT (`org.zodiacs`, covers subdomains) or GitHub login (`io.github.zodiacs-org`); free; preview; entries are permanent | nothing | the live endpoint; the DNS record; the npm package for the second entry | day the server goes live | 6 (namespace), 3 (package name) |
| **Claude connector listing** | a server URL on a paid plan; tools with `title` and `readOnlyHint`/`destructiveHint`; read and write as separate tools; no promotion in descriptions; every tool succeeds with valid input; public docs; a testing account where sign-in exists (not ours); domain matches the service; at least three working example prompts; authless accepted | tools and annotations on `main`; docs at `/developers/mcp/` | the live endpoint; a paid Claude account; the three prompts; the publisher dashboard baseline | day 1 after go-live; scanned automatically, listed as Community | 5 (account) |
| **Claude plugin bundle** | a folder in a public GitHub repository with `.claude-plugin/plugin.json`, skills, `.mcp.json` with `"type": "http"`; repository under 50 MiB archived, 256 MiB unpacked, 10,000 entries; README ≥ 40 words; `LICENSE` or `license`; a lockfile install is held for a human; plugins reach paid plans only; a remote server shows on the plugin's Connectors tab, a local server runs only in Claude Code and Cowork | skills and a root `plugin.json` in #618, no Claude manifest; `.mcp.json` has no `type` (Claude Code would skip it) | the small repository; the manifest; `type: http`; a licence; the Developer plugin's local server replaced by `npx @zodiacs/mcp-server` so there is no lockfile and no 1.5 MB bundle | week 1 to 2 | 4 (repository and licence) |
| **ChatGPT and Codex plugin directory** | a ZIP with root `plugin.json` (Agent Plugins schema) and `mcp.json`; display name and subtitle ≤ 30 chars; website, support, privacy, terms URLs; up to three starter prompts (≤ 128 chars); exactly five positive and three negative test cases; a reviewer-accessible demo recording; release notes; an annotation justification per hint value (the docs contradict themselves; supply them); the domain token at `/.well-known/openai-apps-challenge`; individual or business verification (in review); a valid category; for UI, a unique widget domain; daily scans after publication; a new ZIP and review for metadata or skill changes | all of it in #618 except: the video is empty, the category is "Lifestyle" (invalid), the submission JSON points at the old schema URL, `_meta.ui.domain` is unset | fix the category to Education & Research (the precedent), the schema URL, emit `openai/widgetDomain: https://zodiacs.org` on the two UI resources, add the challenge file, record the video, pass the eight cases on the live server | week 2 to 4, after verification clears | 5 (account), 8 (Chart Studio in the first listing) |
| **Gemini app** | a user adds any MCP server by URL (US, 18+, English, personal accounts); no open directory (Connected Apps is partners only), no vetting | none | a "connect from Gemini" paragraph on `/developers/mcp/` | with the docs update in WP-1 | none |
| **Gemini CLI and Antigravity** | a public repository with `gemini-extension.json` at its root and the topic `gemini-cli-extension`; crawled daily; no review. Reach is shrinking since Gemini CLI left the free tiers; Antigravity's marketplace is curated by interest form | none | one small file in the plugin repository | week 2 | 4 |
| **Cursor marketplace (also feeds Grok Bot)** | open-source plugins; Cursor does not expand `${PLUGIN_ROOT}` (the Developer plugin's stdio path) | #618's plugins say "Proprietary" | a permissive licence on the bundle; the remote URL instead of a local path | week 2 to 3 | 4 (licence) |
| **GitHub Copilot (CLI, cloud agent, app)** | a plugin in a public GitHub repository in the Agent Plugins 1.0 layout (root `plugin.json`, `skills/`, `mcp.json`); listed through the external-plugin issue form in `github/awesome-copilot`, approved by its maintainers into `plugins/external.json`, re-reviewed every six months; the CLI expands `${PLUGIN_ROOT}`; GitHub's own MCP Registry (375 servers) is curated with no self-serve path | the WP-4 folder is that layout | the issue-form submission once the repository is public | week 3 to 4, with the awesome lists | 4 |
| **Glama, PulseMCP, Zed** | Glama ingests the official registry; PulseMCP has paused submissions (its submit page, dated 3 September, says so); Zed plans to read the registry | none | nothing beyond the registry entry; claim the Glama listing when it appears | automatic | none |
| **mcp.so, MCP Market, mcpservers.org, Smithery** | free queues exist; paid fast lanes ($29 to $39); Smithery lists remote servers but routes calls through its gateway, which would see tool arguments | none | free-queue submissions only; Smithery as a listing of our URL, never as the gateway | week 3 | none |
| **awesome-mcp-servers lists** | punkpeye's main list needs a public repository; its remote list needs a Glama badge and an endpoint that answers `initialize`; wong2's takes no PRs; appcypher's is archived | none | pull requests after the plugin repository exists | week 3 to 4 | none |
| **Meta Muse connector directory** | US-only; business verification; a data-processing questionnaire; a test account | none | a decision on whether a US-only reviewed listing is worth the paperwork | later | 9 |
| **Mistral Vibe** | custom MCP connectors by users; directory under partner terms, no public form | none | nothing beyond docs | none | none |
| **Perplexity** | custom remote connectors on paid plans (secondary source) | none | a docs paragraph | none | none |
| **Microsoft Copilot, Alexa+, Apple** | work tenants with certification and server authentication; selected partners; no MCP route | none | skip; a certified Copilot connector would need authentication, which the brief rules out for public tools | none | none |
| **Context7 and DeepWiki** (A5) | Context7 does not index the engine; DeepWiki unverified | none | submit the engine repository to Context7; check DeepWiki by hand | week 1 | none |

Recorded, not pursued: the Gemini app takes an uploaded `SKILL.md` from each
user (a user action, not a listing); the Raycast Store (reviewed pull
requests; MCP on its paid tier only) and OpenClaw's ClawHub are open but small.

#### A.3 Chart Studio's panels on Claude

What the research established (6 October): Claude advertises the two host
capabilities the panel needs (`updateModelContext` and `message`); its
sandbox CSP allows the `blob:` worker the time explorer uses; a 0.95 MB
template renders (no refusal reports in 1,076 community issues); and Claude's
backend probably sends no `Origin` header, though one report says it did and
was blocked, so `https://claude.ai` goes on the allowlist. Three things to
change before Chart Studio can be offered on Claude:

1. **Route.** Plugin-provided servers do not advertise the UI extension on
   Claude, so Chart Studio is reached through the connector listing, not the
   plugin bundle. The plugin can still carry the skill and point at the same
   server.
2. **Domain field.** Emit `openai/widgetDomain: https://zodiacs.org` on both
   UI resources and never a static `_meta.ui.domain`, which Claude would
   reject if it does not match its own hash. If OpenAI's portal rejects the
   alias, the fallback is a ChatGPT-only resource on the same origin.
3. **Honesty of the share step.** Claude stores a context update and the
   model reads it only if it calls a widget-context tool, which is usual but
   not guaranteed, and each update replaces the last. The button copy must
   say "attached for the assistant to read", the tool result should hint
   that the model read the widget context, and the sentence "Earlier shared
   selections remain in the conversation" must go. Clipboard writes and
   downloads are blocked in the sandbox; the manual-copy path #618 built is
   the right one on both hosts.

Known risks: a Claude bug with stateless servers that answer `GET` with 405;
Cowork on mobile never mounts MCP Apps; Claude's multi-connection pattern
presses on #618's global 40-a-minute quota. WP-7 tests the three hosts
(claude.ai web, Claude Desktop, ChatGPT web) and records what rendered.

#### A.4 The order, as one sequence

Flag off → preview deployment seen by the owner → flag on → health check →
registry entry (same day) → Claude connector (same day) → plugin repository →
Claude plugin → ChatGPT submission → Gemini extension, Cursor, free-queue
directories, awesome lists → external-builder packet refreshed and handed to
the owner (decision of 5 October §2) → Meta Muse if decision 9 says yes.

### B. Positioning

Three sentences the owner can repeat:

> Zodiacs.org is the astrology computation service that publishes its
> evidence: every answer carries a receipt anyone can recompute, our accuracy
> tests are public and any engine can run them, and the engine is MIT-licensed
> so you can run it on your own machine instead of ours. It is free without a
> key, it keeps no birth data, and it handles historical clock time, which is
> where most wrong charts come from. Where others are more precise today, we
> say so and show the number.

Why this holds against the field in §4.2 of the brief, as checked on 6
October:

- **Evidence.** RoxyAPI publishes a benchmark anyone can rerun; nobody else
  does. Nobody publishes a conformance suite other engines can run or results
  for a rival engine beside their own. Astro Agents does put an input and a
  result hash on every answer, with a verify endpoint, but its engine is
  closed, so the hash proves reproducibility, not correctness; our receipt
  can be recomputed with the MIT engine. We publish all three (B1, A6, D1 in
  part).
- **Licence and locality.** Three of the four hosted services run closed
  engines; Open Ephemeris's "npx" package is a thin client of its servers.
  Ours is MIT, runs in the browser (Chart Studio keeps the birth data there),
  in Node, and soon from npm as a stdio server.
- **Price.** $39 to $349 a month, prepaid credits, or a per-call charge
  through agent-payment protocols, against free and keyless (owner decision of 28 September §5, kept: see
  decision 20 for the trigger that reopens it).
- **Time.** Swiss Ephemeris has no time-zone data at all; on the suite's L3
  level the shipped engine passes 69 vectors where Swiss passes 60. The
  atlas, backzone tzdb inside the engine and birthplace local mean time are
  ours alone among the §4.2 services (outside that field Astrodienst's
  proprietary atlas covers the same ground, closed), and the Gauquelin pilot
  found four pre-1967 US births that
  differ by an hour between the lists and tzdb's zone-wide rule, which is
  exactly the gap the atlas exists to close.
- **Precision is not the pitch this year.** Our L1 median is about 40 times
  RoxyAPI's and the maximum about 24 times. The brief's Phase 4 backend
  closes that; until it ships, the public wording is "tested against NASA
  JPL Horizons: median 2.1″, maximum 18.8″ over 240 positions 1851 to 2148,
  with Swiss Ephemeris at 0.006″ beside it", bound to the conformance page's
  ledger claim.

The brief's line "Existing is not a differentiator" is confirmed: 100 to 150
public astrology servers, 40 to 60 hosted, 39 or more plugins already live in
ChatGPT and seven connectors in Claude's directory. The only thing none of
them had on 6 October is a public test other engines can run and a receipt a
third party can recompute without calling the vendor (Astro Agents' digests
are checked through its own endpoint).

### C. The data-source programme

#### C.1 The vault, as it already exists

The cloud session started a vault today at
`/Volumes/MAC_EXT/UserData/Downloads/zodiacs-data-vault/`, with a `README.md`,
a `SOURCES.md` register, one folder per source and version
(`open-gauquelin/2026-10-06/`, `tzdb/2025c/`, `tzdb/2026e/`, `hyg/v4.0/`,
`geonames/2026-10-06/`, `iers/2026-10-06/`, `timezone-boundary-builder/2026d/`),
each with a `SOURCE.md` and a `SHA256SUMS`, plus `_reports/` for working files
and `_logs/`. Its five rules are the right ones and this plan adopts them
verbatim: originals only, never edited; a `SOURCE.md` and a `SHA256SUMS` in
every folder; nothing in the vault is public and only small processed slices
enter the site under a licence that allows it; licensed data under
`licensed/` and never in the public repository, contract read first; a second
copy elsewhere. Additions:

- **A second copy** the owner controls (decision 12): the simplest is a
  private cloud bucket or drive the owner already pays for; a private GitHub
  repository is wrong for this (the PostgreSQL dump alone is 119 MB).
- **A public mirror of the register, without the data:**
  `docs/platform/data/REGISTER.md` in this repository lists every source, its
  licence class, the vault folder name, what the site uses, and the refresh
  rule. It is the file agents read before touching outside data.
- **`_reports/` is never cleared for publication by default.** A report
  leaves the vault only through a work package that names the licence it
  relies on.
- **Agents never fetch into the vault from the repository's CI.** Fetches are
  manual runs on the owner's machine (the cloud session or Codex), logged in
  `_logs/`, so the vault's provenance is a person's action, dated.

#### C.2 Licence classes and the mixing rule

| Class | Sources | What it allows | Rule |
| --- | --- | --- | --- |
| Public domain or CC0 | tzdb (with BSD-licensed exceptions), Wikidata, IERS Bulletin A ("distribution unlimited"), our conformance vectors and benchmark, the public-domain originals (Lilly 1647, Ashmand 1822, Alan Leo, Allen 1899, Robson 1923 in the US) | anything | cite anyway |
| Attribution (CC BY, ODC-By) | GeoNames (CC BY 4.0), Getty TGN (ODC-By 1.0 with its credit line), our atlas (CC BY 4.0), our sky data (CC BY 4.0), the ΔT table (CC BY 4.0) | reuse with credit | keep the credit line where the data appears; GeoNames's credit is already on the footer, the calculator, `/methodology/` and `/terms/`, but not in the Developer plugin's NOTICE |
| Share-alike (CC BY-SA, ODbL) | HYG v4 (CC BY-SA 4.0), Open Gauquelin's transcriptions (CC BY-SA 4.0; the database itself unconfirmed), timezone-boundary-builder (ODbL) | reuse, but a derived database must carry the same licence | never merge share-alike data into a CC BY dataset. The atlas stays CC BY, so time-zone polygons and Gauquelin-derived birth lists live in their own datasets under their own licences, and ODbL and CC BY-SA cannot be merged with each other either |
| No terms stated | IERS EOP 20 C04, JPL Horizons responses, NASA GSFC eclipse instants | archive and cite; redistribution of the raw files is a judgement | say "no licence stated" in public copy (F-55); follow the JPL SSD API Fair Use Policy when fetching (one request at a time, an identifying `User-Agent`) |
| Contract | Astro-Databank export (subscription, time-limited, back-link or not) | whatever the contract says | `licensed/` only; nothing shown publicly until the owner has read the contract and decided (decision 13); showing records after a lapse is a separate decision |
| Code licences on data projects | g5 (GPL-3) | the code, not the data | do not import g5 code into the site |
| Restricted reuse | Gallica (commercial and AI reuse paid), Delpher (text mining reserved), Trove (key) | read and cite | the atlas evidence corpus stores citations and short quotations, never page images or full text from these three; the Library of Congress newspapers are believed public domain and may be stored |

#### C.3 The register

Start from the vault's `SOURCES.md` and the brief's §7, corrected:

| Layer | Source | Licence (checked) | In the vault | On the site | Refresh |
| --- | --- | --- | --- | --- | --- |
| Sky | JPL Horizons (DE441 reference) | SSD API Fair Use Policy | responses committed in evidence folders | arbiter for the conformance suite and tests | on demand; fix the `User-Agent` in the four fetchers |
| Sky | JPL DE440, DE441, DE442 kernels | NAIF rules: unmodified redistribution allowed with attribution | not yet; add | referenced; the hosted backend reads a kernel on the server (Phase 4) | with each JPL release |
| Sky | JPL Small-Body Database API | same fair-use policy | no | no (Chiron and the asteroids, Phase 2) | none |
| Sky | astronomy-engine 2.1.19 | MIT | npm | the shipped ephemeris | with the engine |
| Sky | HYG v4.0 (v4.4 current) | CC BY-SA 4.0 | yes | 103 stars in the Registry constellation maps, credited in `public/assets/constellations/ATTRIBUTION.txt`; not in the root LICENSE | yearly; keep derived star lists share-alike |
| Sky | NASA GSFC eclipse canon | no terms | four instants in a corpus | eclipses are computed, not copied | none |
| Time | IANA tzdb 2025c, 2026e | public domain | yes | 2025c pinned, compiled into `tz-lmt.json` and `tz-history/` | WP-16 refreshes to 2026e |
| Time | IERS EOP 20 C04, Bulletin A | none stated; "distribution unlimited" | yes | ΔT monitor, UT1 values in the engine | weekly monitor |
| Time | ΔT table (Stephenson, Morrison and Hohenkerk 2016) | CC BY 4.0 | none | the engine | none |
| Time | tz mailing list (lists.iana.org) | no licence; quote under fair use | no | research leads for B3 | none |
| Time | Library of Congress newspapers (loc.gov API) | believed public domain; 20 requests a minute | no | no | WP-13 |
| Time | Gallica, Delpher, Trove | restricted (see C.2) | no | no | citations only |
| Place | GeoNames | CC BY 4.0 | yes (6 October dump) | 33,934 cities, last regenerated 5 July with no retrieval date or digest recorded | add the date and digest at the next rebuild |
| Place | timezone-boundary-builder 2026d | ODbL | yes | no | with releases; separate dataset if ever used |
| Place | Getty TGN | ODC-By 1.0 | no | no | D.3's place-at-date resolver (A1.c's `search_places`, extended; no package yet; WP-11 records place ids by hand until it ships) |
| People | Wikidata, Wikipedia, Commons | CC0; CC BY-SA text (revision ids only are stored); per-file image licences | none | 501 people, all with `timeQuality: unknown` | the pilot's tools |
| People | Open Gauquelin Database | unconfirmed (CC BY-SA 4.0 is the natural reading); transcriptions CC BY-SA 4.0 | yes (exports, dump, code snapshot) | no for the database, nothing until confirmed; the seven certificate transcriptions (CC BY-SA 4.0, credited) enter WP-11's separate share-alike dataset now | none |
| People | Astro-Databank export | contract; not yet on sale | no | no | after the owner reads the contract |
| People | Open Archives (openarch.nl) | free API, 4 requests a second, some parts need a key; it runs its own MCP server | no | no | WP-12 |
| People | French departmental archives | no common API; terms vary by department | no | the project's seven certificate transcriptions cite the Archives de Paris (four) and the departmental archives of Meurthe-et-Moselle, Gironde and Hauts-de-Seine (one each) | by hand |
| Tradition | Source Library | originals public domain; translations CC BY-SA 4.0; AI training needs a licence | no | no | cite or partner; never duplicate |
| Tradition | public-domain originals | public domain (Robson in the US) | no | no (D8) | none |

The brief's §7 also has a "Reach" row (the official MCP Registry). It is not
a data source; it is covered in A.2 and WP-3.

#### C.4 The people layer

**Astro-Databank.** The owner's thread with Astrodienst (5 and 6 October)
stands as the only source. What the plan says: once the subscription exists,
the export goes to `licensed/astro-databank/<date>/` with the contract text
beside it; nothing is shown publicly, and no record enters the repository,
until the owner has answered decision 13 with the contract in hand. Chart
twins stays locked. Agents never open Astro-Databank pages; the export is a
file the owner downloads.

**Open Gauquelin.** The pilot run today in the vault's `_reports/` is the
first real test of a provenance layer, and its results shape WP-11:

- 72 of the site's 501 people are in the database (53 through the project's
  own Wikidata table, 19 by family name and exact birth date); 17 of them
  have searchable pages.
- Seven have a birth certificate the project transcribed (all French, none
  searchable); 45 are registry-office times never checked against the
  certificate; two are family records; 17 came through astrological
  publications and are excluded by the people pilot's rule ("never copied
  from an astrology source"); one has no time.
- The export's own offsets, universal times and coordinates are unreliable
  (five people's coordinates lie 194 to 5,521 km from the birthplace; Camus,
  born near Dréan in Algeria, is placed in Italy). Only the recorded local
  time and place name are usable, resolved by our own time resolver.
- Four pre-1967 US summer births (1922 Minnesota, 1925 Missouri, 1927 South
  Carolina, 1931 Alabama) differ by one hour between the lists and our
  tz-history rules, because tzdb applies New York's and Chicago's daylight
  saving zone-wide. These are not tzdb errors; they are the atlas's job (B3),
  and they become its first US test cases.

Nothing from the database is published until the maintainer confirms the
licence; if it is CC BY-SA 4.0, any birth list derived from it is a separate
share-alike dataset (C.2). The project's certificate transcriptions are
usable now as CC BY-SA 4.0 with credit.

**Civil records.** Open Archives already runs an MCP server with 22 tools
(21 generated from its OpenAPI spec plus a scan viewer) over mostly Dutch and
Belgian records (A2A schema, which has hour and minute fields; the sampled
birth records had dates only). We do not rebuild that. The people layer uses
it, and the French departmental archives by hand, as sources for our own
records, with the people pilot's rules: deceased or clearly public figures,
living people excluded unless the owner decides otherwise (four are protected
today), a noon chart with houses omitted when the time is unknown.

**Wikidata** is the identity spine (every record keys on a Q-id) but cannot
hold the time: its date precision stops at the day, and the task to change
that (Phabricator T57755) is open at low priority. So our dataset holds the
time and Wikidata holds the identity.

**A lookup tool for agents.** Yes, but narrow (D.2 below): "resolve and grade
a cited record", returning the recorded local time, the place, the source
citation, the evidence grade, the resolved UTC with its basis and flags, and
never a time we did not source. The generic "look up anyone's birth time"
tool is rejected: it would either invent or scrape.

#### C.5 What goes on the public site

Under their own licences, with Dataset markup and DOIs where X-7 applies:
the atlas and its evidence corpus (CC BY 4.0); the conformance vectors and
the sky-fact benchmark (CC0); the sky data (CC BY 4.0); the conventions and
the birth-record profile (CC0 as a spec); our own sourced birth records (CC BY
4.0, with CC BY-SA 4.0 for the records that derive from the Gauquelin
transcriptions, kept apart); the vocabulary (D9). Never: kernels or derived
packs (until NAIF answers), the Astro-Databank export, the Gauquelin
database as a whole, HYG beyond the credited subset, time-zone polygons,
newspaper page images from the restricted archives.

### D. What does not exist yet

Ranked by one question: how much does it make other people's software, data
or writing depend on Zodiacs.org? The research round checked each seed in
§8 of the brief for prior art on 6 October; where something already exists,
the idea is narrowed to the part that does not.

1. **A birth-record provenance profile with a crosswalk, not a new schema.**
   Evidence grades already exist in five places that do not talk to each
   other: Rodden ratings in astrology software (Stellium, Enigma, VedAstro),
   the Gauquelin project's trust levels 1 to 5 (the only one that records
   how the clock offset was derived), GEDCOM 7's `QUAY` 0 to 3 (whose own
   spec calls its confidence structure inadequate), GEDCOM X's High, Medium,
   Low, and Wikidata's sourcing-circumstances qualifier. None maps to the
   others and none carries a resolved UTC with its basis. The people pilot
   already has `timeQuality` and `birthTimeEvidence`. The new thing is a JSON Schema profile, `birth-record.v1`, served from
   zodiacs.org as a versioned file (the §4.4 registry, once it exists, adopts
   it):
   legal local time and precision; place as a Wikidata or GeoNames id; the
   source citation (archive, register, page); a grade with the crosswalk to
   the five systems; the resolved UTC, its basis and flags from
   `resolve_birth_time`; and the record's own licence. Our first dataset is
   the seven certificate-backed French records plus every record we source
   ourselves; the Gauquelin pilot is the test input. Dependence: any tool
   that wants a graded, resolvable birth record adopts the profile, and the
   atlas and the resolver are the only software that fills it. (Seed 1,
   kept and narrowed.)
2. **"Resolve and grade a cited record" for agents** (`resolve_birth_record`):
   the tool form of item 1, limited to deceased or clearly public figures,
   returning the record with its grade, source and resolved UTC, and a typed
   refusal when no sourced record exists. Open Archives, FamilySearch,
   WikiTree and six Wikidata servers already offer generic lookups; ours is
   the only one that grades and resolves. (Seed 2, narrowed.)
3. **A place-at-date resolver** (`search_places` is the ledger's A1.c, not
   started; the new part is the date): `search_places` that knows what a
   place was called and which rules applied on a given date, from GeoNames,
   Getty TGN (ODC-By, historical names) and the atlas. Needed by items 1 and 2 and
   by every historical chart; nobody offers it as data.
4. **An open evidence corpus for historical clock time** (new as a dataset;
   B3.a's 59 rules already carry 66 primary citations, which the corpus
   absorbs as its first entries): dated
   notices of time changes (a town adopting standard time, a county's summer
   time) from the Library of Congress newspapers, with citations, under CC BY
   4.0, feeding the atlas's rules and the tzdb submissions below. Gallica,
   Delpher and Trove contribute citations only (C.2). This is the research
   layer the brief's B3 risk ("research-heavy") needs, and it is what makes
   genealogists and the tz project cite us.
5. **Atlas findings sent upstream to tzdb** with citations (seed 3, kept).
   Only backzone-level findings qualify (tzdb is zone-wide before 1970 by
   design, so the four US cases are atlas material, not tzdb bugs). The
   posts go to the tz list from the owner's account, sent by the owner;
   agents write the drafts and never send mail.
6. **Conformance results for hosted services** (seed 4, kept with terms).
   RoxyAPI's terms allow testing and published comparisons if the method and
   inputs are disclosed; Open Ephemeris forbids publishing a benchmark
   without written consent; AstrologyAPI forbids building a competing service
   and says nothing about testing; Astro Agents gives three free MCP calls
   then charges. So: publish the adapter contract and an invitation, run
   RoxyAPI with full disclosure, and list the others as "invited, not run"
   until they consent in writing. A results table that names who declined
   is itself a credential.
7. **A receipt verifier endpoint** (new, small): `POST /api/v1/verify` and
   the existing `compare_calculation_records` exposed remotely, so anyone
   can recompute any Zodiacs receipt without installing anything, and other
   providers that adopt the §4.4 spec can be verified the same way. Cheap,
   because the comparison code exists.
8. **Cited founding moments** (seed 5, kept, low). Wikidata has an inception
   date for all 200 sovereign states, 143 of them to the day (118 with a
   reference) and none with a time of day; 58 states hold competing dates. A dataset of competing founding moments keyed to Q-ids,
   each with a primary source and a grade, with "date only" where no time
   exists. Modest dependence; it is mostly honesty about an area where
   astrology books assert times.

Folded into other items rather than listed: the corrections programme (seed
7) extends the conformance suite's discrepancy process (B1.d, accepted) to
the atlas and the records, with public credit; partnership before rivalry
(seed 8) is a stance, and every contact is the owner's to make; the paid
tier (seed 9) is decision 20.

### E. Operating model

#### E.1 What happened on 5 and 6 October

Facts from the repository and GitHub, read on 6 October:

- Three agents and a bot merged 17 pull requests on 5 October and 9 by 13:28
  UTC on 6 October, all as the `zodiacs-org` account. The median gap between
  merges was about an hour; the peak was three Codex merges in one hour.
- Site Check runs 19 jobs on every pull request and every push to `main`,
  with no path filters. A docs-only checkpoint runs the full 37 to 45 minutes
  twice. The GitHub account allows 20 concurrent jobs; one Site Check takes
  19 of them, so a second run queues.
- `main` has no required status checks and no rulesets; it requires a pull
  request with zero approvals. Six Codex pull requests (one late on 5
  October, five on 6 October) were merged between 23 seconds and 91 minutes
  after opening, before Site Check finished, and all six head runs later
  failed. `main` was red from 07:00 UTC.
  Every merge deploys production (previews are off for `main`'s config).
- The programme session waited for green on all 11 of its merges; the
  localisation session on all three.
- The rebases were all on the localisation pull requests (#656 four times,
  #650 three). Two causes repeat: the one shared allowance file for
  protected paths must be pinned to the exact base commit, so every merge to
  `main` invalidates every other open allowance; and the Phase 1 screenshot
  receipt goes stale whenever `main` changes a template.
- Merge methods are mixed: the handoff says merge commits only, but four
  recent merges were squashes, which break the programme branch's
  fast-forward pattern.
- No file in the repository says who owns which paths, beyond "no file is
  owned by two in the same phase" (`docs/MASTER-PLAN.md` §17) and one
  Fable-owned file in `CLAUDE.md`.

#### E.2 Rules proposed

1. **Lanes by path**, written down in `docs/platform/LANES.md` (WP-15) and
   kept to by every session:
   - Codex: `plugins/` (until it moves to the plugin repository),
     `integrations/`, `src/ai-tools/` (until folded into WP-1), Chart Studio,
     navigation and profile surfaces, Sky Watch.
   - The programme session: `docs/platform/programme/`, `src/mcp/`,
     `src/lib/compute-api/`, `api/_compute/`, `api/_ai/` after WP-1, engine
     adoption, the conformance and benchmark pages.
   - The localisation session: `src/content/{es,pt,fr,it}/`, the
     `additions.*` string files, the locale page trees.
   - Fable sessions: `docs/platform/PLAN-*.md`, reviews, and nothing under
     `src/` without a lane's agreement.
   - The data layer (WP-10, WP-11 and WP-13; WP-12 is the programme's):
     `docs/platform/data/`, the vault, the engine repository's `atlas/`.
   A change outside your lane is a request to that lane, in the pull
   request, not a commit.
2. **Nobody merges on red.** A pull request merges only after Site Check is
   green on its head commit and the owner has said yes to that pull request.
   The owner can make this mechanical by turning on the required status check
   "Build & Check" and, if GitHub offers it for a user-owned repository, the
   merge queue (repository settings only the owner can change; decision 18).
   The merge queue would also serialise the three agents without anyone
   polling; without it, the merge windows in rule 6 do.
3. **Merge commits only, no squashes, no force-pushes to shared branches**
   (the handoff's rule, restated), because the programme branch depends on
   fast-forwarding.
4. **A docs-only fast lane in CI** (WP-15): a pull request whose every
   changed file is a Markdown file under `docs/`, outside the paths that are
   test fixtures or claims evidence (listed in WP-15), runs the tests that
   read docs (the programme-ledger, claims-ledger, claims-bindings and
   candidate-docs tests, and the trust-surface test that reads
   `docs/STRATEGY.md`) and skips the build and the browser drives. Pushes to
   `main` keep the full run.
5. **One allowance file per pull request** instead of one shared file
   (`.github/phase1-scope-allowances/<id>.json`, WP-15), so a merge to `main`
   invalidates only the allowances it actually conflicts with. The guard is
   a gate, so this change gets a Fable review before it merges.
6. **Merge windows for the two slow lanes.** The programme's checkpoint pull
   requests and the localisation pull requests merge in the hour after the
   00:00 UTC Daily Sky run, when `main` is quiet and the daily freshness
   check passes; Codex's UI merges avoid that hour.
7. **One record of the owner's yes.** The owner's approval is quoted in the
   pull request before merging, as the allowance convention already does.
8. **A preview before anything goes live.** A pull request that changes
   anything served (`src/pages/`, `public/`, `api/`, the generated bundles,
   `vercel.json`) ships a preview deployment the owner has seen before it
   merges, because every merge to `main` deploys production. Git previews
   are off, so it is a CLI preview or a `preview/*` branch (the route WP-1
   settles first); a pull request that touches only `docs/` needs none.

#### E.3 How the work packages map to lanes

Part 4 marks each package with its lane and whether it can run beside the
others. The rule for parallel work is simple: two packages may run at once if
they touch no gated path in common (the Phase 1 receipt's hashed directories,
the allowance's protected paths, the programme ledger, `vercel.json`, the
generated bundles).

### F. Measures

The September strategy's §9 (measures of success) stands. Distribution adds
only what the stores and the hosting can actually report, checked on 6
October:

| Measure | Where it comes from | Limit |
| --- | --- | --- |
| Listing status per host | a table in `docs/platform/DISTRIBUTION-STATUS.md`, read from each portal by hand (Claude: Draft, Scanning, In review, Published, Delisted; OpenAI: review status, scan findings, held updates) | manual |
| Installs, active accounts, tool calls, errors, latency, by surface (claude.ai, Desktop, Claude Code, Cowork) and by tool | Claude's publisher Usage tab and connector dashboard: 90 days, CSV export, daily, up to 24 hours late; rows under 5 calls per tool or 50 per product are dropped | needs the paid plan; counts Claude traffic only |
| ChatGPT and Codex calls | nothing from OpenAI (status views only). Count `POST /mcp` by `User-Agent` family in Vercel Observability: `openai-mcp/1.0.0` is ChatGPT, `openai-mcp/1.0.0 (Codex)` is Codex; Claude's agent is undocumented (Anthropic identifies by egress range) | 30 days of retention; no tool names, because every call is one POST and bodies are not logged |
| Tool calls by tool and host | an enum-only counter in the server (tool name, host family, outcome; never arguments) | an owner decision (21), because it adds a counter and a sentence to the hosted server's privacy claim (#618's `priv.ai-integration`, which WP-1 brings to `main`; today's nearest records are `priv.compute-api` and `priv.local-tools`) |
| Registry and directory presence | the MCP Registry (status and timestamps only), Glama health, npm weekly downloads (468 for the engine in the week to 4 October), PyPI | public, no install counts from the registry |
| The monthly assistant panel (A8) and the benchmark (B4.b) | the owner's free accounts on ChatGPT, Claude, Gemini and Perplexity; Copilot cannot be scored "with the tools" because consumer Copilot has no third-party connector route | four assistants, not five, unless a work tenant is set up |
| The external-builder trial | replies to the packet the owner sends after go-live | none |

The brief's "remote MCP sessions per day" and "distinct callers" cannot be
measured as worded: the server is stateless and Vercel refuses unique
aggregation. The honest substitutes are requests per day by host family and
Claude's "accounts that used a tool" figure.

---

## 4. Work packages for Opus 5.5

Each package stands on its own. "Gates" names the repository checks it will
meet (part E and the research round's gate map, 6 October); "Waits on" names
the decisions in part 5. "Parallel" says which packages can run at the same
time without touching a gated path in common. Weights are not given; the
ledger's denominator is fixed and decision 22 proposes the units.

### WP-1 One remote server at `zodiacs.org/mcp`

- **Lane:** programme (with Codex's agreement, since it absorbs `src/ai-tools/`).
- **Outcome:** one `createServer()` with the vocabulary in A.1, two bundles
  (stdio for npm, HTTP for `/mcp`), served through the `api/compatibility.ts`
  rewrite behind `ZODIACS_MCP_ENABLED`, stateless, authless, read-only,
  answering the 2026-07-28 protocol envelope, with `https://claude.ai`,
  `https://chatgpt.com` and `https://chat.openai.com` on the origin allowlist,
  counters that count tool calls and not health probes or resource reads,
  and a fail-closed path when a counter is unavailable.
- **Files and gates:** `src/mcp/*`, `src/ai-tools/*` (folded in or deleted),
  `api/_ai/*`, `api/compatibility.ts`, `vercel.json` (the `/mcp` rewrites and
  the trailing-slash exemption so `POST /mcp` is not redirected),
  `scripts/build-mcp-server.mjs`, `scripts/pack-mcp-server.mjs`,
  `examples/mcp-server/`, `src/pages/developers/mcp/`, `public/llms.txt`,
  `public/llms-full.txt`. Gates: the consumer boundary scans `src/mcp` tool
  descriptions; the claims ledger scans `src/mcp` and the developer pages
  (every public sentence about privacy or the hosted server needs a record);
  `mcp-artifact.test.mjs` forbids HTTP code in the stdio bundle; the
  runtime-imports test (`tests/api/runtime-imports.test.ts`, whose
  twelve-entry `EXPECTED_HANDLERS` list pins the deployed function files);
  the MCP archive is immutable, so the version bumps and the evidence JSONs
  are re-recorded; the assistant context is regenerated. If the merge
  changes `package.json` or `package-lock.json` (as #618 does), the Phase 1
  receipt and `src/data/daily-publication-manifest.json` are regenerated in
  the same pull request; prefer a merge that leaves both files alone.
- **Acceptance:** P3.6's rule as written in the ledger: the MCP project's
  conformance tests and the Inspector CLI pass against every tool, and the
  registry entry resolves (WP-3). Plus both stores' checklists: every tool
  has a title and annotations, succeeds with valid input, and refuses with a
  typed message otherwise. Plus a negative control showing no request body
  in any log line. Plus the existing drives (protocol 106 of 106, Claude Code
  host 7 of 7, benchmark 18 of 18) on the merged stdio bundle.
- **First slice (two weeks):** the public-sky set on the HTTP bundle,
  deployed to a preview by the route settled on day one, the owner shown the
  preview, then the flag on in production and the health check green.
  `search_zodiacs` retired to a resource. `open_chart_studio` and the UI
  resources come with WP-7; the natal tools stay local in this slice.
- **Main risk:** the preview path. Git previews are off only for branches
  that carry `main`'s `vercel.json`, so there are two routes. (1) A CLI
  deployment (target preview, Vercel authentication on): it worked three
  times for #618, but two were blocked, one on 5 October and one on 6
  October, with a link to Vercel's team-configuration troubleshooting page;
  the cause is unverified, and the likely one is Vercel's commit-author
  check, since both blocked deployments carried the author name
  `diasmal917` and the ready ones `Zodiacs`. (2) A throwaway branch named
  `preview/<name>` whose own `vercel.json` enables Git previews for all
  branches with an `ignoreCommand` of `exit 1`, its head titled "Preview
  only: build this branch on Vercel (never merge)"; this built ready Git
  previews three times on 5 October. Settle the route on day one with a
  no-op deployment, before merging the servers.
- **Waits on:** decisions 1, 2, 7; the Firewall numbers (owner action).
- **Parallel:** with WP-4, WP-10, WP-11, WP-13, WP-14, WP-15. Not with WP-2,
  WP-12 or WP-16 (each changes a declared source of the MCP bundle, listed in
  `examples/mcp-server/candidate.json`, and re-cuts the same archive), and
  not with WP-7 (same files).

### WP-2 Publish `@zodiacs/mcp-server`

- **Lane:** programme.
- **Outcome:** the stdio bundle on npm under the scoped name with `mcpName:
  org.zodiacs/mcp`, SLSA provenance after the first manual publish, the JSR
  mirror attempted, the developer page and `llms.txt` saying "on npm" with
  the version, and the "not on npm" sentences retired from the claims ledger.
- **Files and gates:** `examples/mcp-server/package.json` (scoped name,
  `private` removed, `mcpName`), `npm-shrinkwrap.json`, `candidate.json`,
  `README.md`, and `scripts/mcp-artifact.test.mjs` (it pins `private: true`,
  the "There is no `npm install zodiacs-mcp-server`" sentence and the
  "unpublished candidate" row, so it changes in the same commit);
  `src/mcp/tools.ts` and `src/mcp/outputs.ts` (the `'unpublished-candidate'`
  literals) and `src/mcp/bounds.ts` (`ADAPTER_VERSION`); the pack script;
  `public/llms.txt` and `src/pages/developers/mcp/` (the version and the
  "not on npm" sentences, with claims-ledger records);
  `platform-candidate-docs.test.mjs` and the engine-reference test; the new
  publish workflow added to `scripts/github-actions-trust-contract.test.mjs`
  with its `environment:` and `permissions: contents: read`. Because
  `src/mcp` changes, this is a full archive re-cut: rebuild `server.mjs`,
  re-record the protocol, benchmark and host drives, bump the version, pack,
  then pin `artifactCommit` in a second commit.
- **Acceptance:** P3.1b's rule for this package: `npm view` shows it with
  provenance; a clean-consumer install runs the protocol drive.
- **First slice:** the package renamed and packed; the owner's one manual
  publish; the trusted-publisher configuration.
- **Main risk:** the first publish must bundle a released engine, and the
  engine's next release is the 1.0 candidate (decision of 5 October §7). If
  the owner wants the server on npm before the 1.0 candidate, the package
  bundles rc.16 (on npm) rather than rc.17 (vendored only).
- **Waits on:** decision 3; the owner's publish.
- **Parallel:** not with WP-1, WP-7, WP-12 or WP-16 (each re-cuts the same
  MCP bundle). Run it as the first re-cut after WP-1's first slice lands, or
  fold the rename into WP-1's re-cut.

### WP-3 The MCP Registry entry

- **Lane:** programme.
- **Outcome:** `org.zodiacs/mcp` published with a `remotes` entry for the live
  endpoint and, once WP-2 lands, a `packages` entry for npm; the namespace
  proven by the owner's DNS TXT record; S7's Organization `sameAs` pointing at
  the registry's API URL for the server (the UI has no per-server page).
- **Files and gates:** a `server.json` in the repository (location: beside
  `examples/mcp-server/`), `src/strings/seo.en.mjs` for `sameAs`, the
  structured-data tests.
- **Acceptance:** the registry resolves the entry; Glama shows the server
  within a week; a search for the name in the registry API returns it.
- **First slice:** the whole package; it is a day's work once the endpoint
  is live.
- **Main risk:** entries are permanent and one remote URL can belong to only
  one name, so publish only when the endpoint is live and the name is final.
  CI publishing under `org.zodiacs` needs the domain's private key as an
  Actions secret, which the trust-contract test must allow.
- **Waits on:** decision 6; the DNS record; WP-1.
- **Parallel:** with WP-4 onward.

### WP-4 The plugin repository

- **Lane:** Codex (the plugin folders are theirs), with the programme session
  reviewing the manifests.
- **Outcome:** a small public repository (name in decision 4; `zodiacs-org/plugins`
  is proposed) holding one folder per plugin that both stores accept from one
  source: root `plugin.json` (Agent Plugins schema with `extensions.com.openai`),
  `mcp.json` (`type: streamable-http`), `.claude-plugin/plugin.json`,
  `.mcp.json` (`type: http`), `skills/`, a README of at least 40 words, a
  `LICENSE` (MIT for the manifests and skill text, with the icon named as an
  all-rights-reserved exception), the icon; no `hooks/`, no `.app.json`, no
  symlinks, no lockfile;
  a `gemini-extension.json` and the `gemini-cli-extension` topic for the
  Gemini gallery; a `.claude-plugin/marketplace.json` for Claude Code users
  who want it without the directory; CI that builds the ChatGPT ZIP and its
  SHA-256 manifest (so the ZIPs leave the site repository). The Developer
  plugin points at `npx @zodiacs/mcp-server` instead of shipping a 1.5 MB
  bundle with a lockfile, which removes the reviewer hold and the Cursor
  path problem.
- **Files and gates:** the new repository only; in the site repository, the
  removal of `plugins/`, `integrations/packages/*.zip` and the marketplace
  file from #618's scope. Anthropic's limits: under 50 MiB archived, 256 MiB
  unpacked, 10,000 entries, 5 MiB per file. Gate in the new repository: the
  vocabulary rules of `scripts/consumer-boundary-lib.mjs` copied into its CI
  and run over every skill, README and manifest string with no carve-outs,
  because the site's scanner does not reach `plugins/**` today and cannot
  reach another repository; no link into the wing (`/registry`,
  `/astrofolio`, `/terminal`, `/sdk`, `/thesis`, `/archive`) anywhere in the
  bundle.
- **Acceptance:** Anthropic's pre-submission checklist passes with no Blocks;
  OpenAI's package check accepts the ZIP (category valid, schema URL current,
  no `plugin_category_unknown`); Claude Code loads the `.mcp.json` entry
  (it needs `type: http`); Codex loads the same folder.
- **First slice:** the Sky plugin folder, both manifests, the README, the
  licence, the ZIP build. The Developer plugin follows WP-2.
- **Main risk:** the licence. "Proprietary" and an all-rights-reserved
  LICENSE keep it out of Cursor's marketplace and sit oddly beside the MIT
  server. The bundle holds skill text and manifests, plus the icon as a named
  all-rights-reserved exception, not the site's copy or other artwork; MIT
  for the rest keeps the site repository's all-rights-reserved decision
  intact.
- **Waits on:** decision 4.
- **Parallel:** with everything.

### WP-5 The Claude listings

- **Lane:** programme (the server) and Codex (the plugin), submitted by the owner.
- **Outcome:** the connector listed (Community) from the live URL, with three
  working example prompts and a testing note that no account exists; the
  plugin listed from the repository; the publisher dashboard's first
  readings recorded in `DISTRIBUTION-STATUS.md`.
- **Files and gates:** no repository code beyond the status file; the
  developer page's wording about Claude goes through the claims ledger.
- **Acceptance:** both listings show "Published"; the connector's health
  badge is "Healthy" (2 % or fewer request errors over 30 days) after the
  first month.
- **First slice:** the connector submission, the same day the endpoint is
  live; the plugin a week later.
- **Main risk:** none technical. The paid plan is the owner's; on a Team or
  Enterprise plan only an Owner can submit.
- **Waits on:** decisions 5 and 10; WP-1; WP-4 for the plugin.
- **Parallel:** with everything.

### WP-6 The ChatGPT and Codex listing

- **Lane:** Codex.
- **Outcome:** the Sky plugin published in the directory under Education &
  Research, with the eight test cases passing on the live server (case 4,
  which used `search_zodiacs`, rewritten to use a resource read or replaced),
  an annotation justification per hint on every tool, the challenge file at
  `/.well-known/openai-apps-challenge`, `openai/widgetDomain` on the two UI
  resources, the submission JSON pointing at the current schema, the demo
  recording made in developer mode, and the daily scan clean.
- **Files and gates:** the plugin repository (WP-4); in the site repository
  the challenge file under `public/.well-known/` (the trailing-slash rule
  already exempts `.well-known`) and the docs page; `check-dist` counts.
- **Acceptance:** the directory listing is live and the first daily scan has
  no findings; the owner has seen a preview of the changed page and the
  challenge file before merge.
- **First slice:** everything except the submission itself, which waits for
  the verification to clear. Record the video once the live server answers
  the eight cases.
- **Main risk:** the widget domain. If the portal rejects the alias, fall
  back to a ChatGPT-only UI resource on the same origin with `_meta.ui.domain`
  set, and keep Claude on the alias-free resource.
- **Waits on:** decisions 5, 8 and 10; the verification; WP-1; WP-7 if Chart
  Studio is in the first listing.
- **Parallel:** with WP-5, WP-8 onward.

### WP-7 Chart Studio on both hosts

- **Lane:** Codex.
- **Outcome:** the panel renders in claude.ai, Claude Desktop and ChatGPT
  from the same resource; the three changes in A.3 made (connector route,
  the domain alias, honest share copy and a hint in the tool result); manual
  copy as the export path on both hosts; a test record per host with
  screenshots; `resources/read` excluded from the quota.
- **Files and gates:** `src/ai-tools/studio/*` (or wherever WP-1 puts it),
  `integrations/generated/chart-studio.mjs`, the UI resource metadata and the
  `open_chart_studio` registration in the server (`src/mcp`, a declared
  source of the MCP bundle: bundle rebuilt, the three evidence files
  re-recorded, version bumped, archive re-cut and pinned in two commits); the
  claims ledger for the privacy sentences in the panel.
- **Acceptance:** on each host, the example chart renders, a house comparison
  runs, the time explorer's worker starts, the manual-copy text matches the
  record, and the share step's wording matches what the host actually does.
- **First slice:** Claude Desktop and claude.ai web with the connector route.
- **Main risk:** Claude's model-context delivery is not guaranteed and has
  open regressions; the panel must not claim more than "attached".
- **Waits on:** decision 8; WP-1.
- **Parallel:** not with WP-1, WP-2, WP-12 or WP-16 (it re-cuts the same MCP
  bundle); with everything else.

### WP-8 The other hosts

- **Lane:** Codex, with the programme session for the docs page.
- **Outcome:** a "Connect from your assistant" section on `/developers/mcp/`
  with the exact steps for Claude, ChatGPT, Codex, Gemini (add by URL),
  Cursor, Claude Code, Perplexity and Grok; the Gemini extension in the
  gallery; the Cursor marketplace entry; the free-queue submissions (mcp.so,
  MCP Market, mcpservers.org) and the Smithery listing by URL only; the
  awesome-list pull requests; the `github/awesome-copilot` external-plugin
  submission; Context7 submitted; DeepWiki checked by hand. Every submission
  and outside pull request is made from the owner's accounts by the owner,
  or by Codex on the owner's computer when the owner asks, after the owner
  has seen the listing text; agents prepare the text and record the result
  in `DISTRIBUTION-STATUS.md`.
- **Files and gates:** the docs page (claims ledger, check-dist, the
  assistant context), the plugin repository.
- **Acceptance:** each listing live or its refusal recorded; the docs page's
  Markdown twin updated; the owner has seen a preview of the changed page
  before merge.
- **First slice:** the docs section and the Gemini file.
- **Main risk:** low. Smithery's gateway would see tool arguments if used as
  the route, so it is a listing of our URL only.
- **Waits on:** WP-4; WP-1 (the section describes connecting to the live
  address and edits `src/pages/developers/mcp/`, which WP-1 rewrites).
- **Parallel:** with everything except WP-1 (same page).

### WP-9 Measures

- **Lane:** programme.
- **Outcome:** `docs/platform/DISTRIBUTION-STATUS.md` with the listing table;
  a read-only script that queries Vercel Observability for `POST /mcp` by
  `User-Agent` family (30-day retention, so it runs monthly and commits the
  aggregate); the monthly Claude Usage export; the enum-only counter if
  decision 21 says yes, with the privacy claim updated; the A8 panel's
  prompts committed and its first run recorded for four assistants.
- **Files and gates:** the status file, `scripts/`, the privacy page in all
  six locales (en, es, pt, fr, it, ru; `scripts/trust-surface-consistency.test.mjs`
  checks them together) and the claims ledger if the counter is added,
  `docs/platform/programme/` for A8's method.
- **Acceptance:** the first monthly reading committed with its method; A8's
  first run recorded (which unblocks the ledger unit).
- **First slice:** the status file and the Vercel script.
- **Main risk:** the counter's privacy wording; without it, per-tool figures
  come only from Claude.
- **Waits on:** decision 21; WP-1; WP-5 for Claude figures.
- **Parallel:** with everything.

### WP-10 The data register and the vault procedure

- **Lane:** data.
- **Outcome:** `docs/platform/data/REGISTER.md` (C.3, kept in step with the
  vault's `SOURCES.md`), `docs/platform/data/LICENCES.md` (C.2 with the
  mixing rule), the vault's README amended with C.1's additions, and the
  corrections the research round found: the IERS wording in the ΔT evidence
  folder and `sources.json` and its generator; an identifying `User-Agent`
  in the four Horizons fetchers; the GeoNames retrieval date and digest at
  the next rebuild; GeoNames credit in the Developer plugin's NOTICE (in the
  plugin repository once WP-4 has moved it; until then #618's
  `plugins/zodiacs-developer/NOTICE`); HYG listed in the root LICENSE's
  third-party section; the note that says 2026d where it means 2026c, in
  `src/data/conformance/summary.json` and the engine repository's L3-TZ-0045
  vector note (Morocco's permanent +00 came in 2026c).
- **Files and gates:** `docs/platform/data/`, the evidence folders named
  above (the Horizons manifest's drift gate: the fetchers change, the
  committed responses do not), `LICENSE`, the claims ledger for any public
  sentence changed.
- **Acceptance:** every row in the register names a licence class and either
  its vault folder or "not archived" with the reason; the drift gates pass;
  the IERS and Horizons sentences in public copy match the sources.
- **First slice:** the two docs files and the IERS correction.
- **Main risk:** none; it is documentation and hygiene.
- **Waits on:** decision 12 (the second copy) for the README line only.
- **Parallel:** with everything.

### WP-11 The birth-record profile and our first records

- **Lane:** data; the programme session reviews the profile against
  `zodiacs://conventions`. The A1.c tools (`resolve_birth_time`, and
  `search_places` with Getty TGN's historical names, D.3) are programme work
  after WP-1's first slice and belong to no package in this plan.
- **Outcome:** `birth-record.v1` as a served, versioned JSON Schema
  (`public/developers/birth-record/v1/schema.json`; the §4.4 registry does
  not exist yet and adopts the profile when it does) with the crosswalk table (Rodden, Gauquelin trust 1 to 5, GEDCOM `QUAY`, GEDCOM X
  confidence, Wikidata P1480); the people manifest's `timeQuality` and
  `birthTimeEvidence` mapped onto it; a first dataset: the seven
  certificate-backed French records (CC BY-SA 4.0, credited to the Gauquelin
  project's transcriptions) and any record the team sources from an archive
  itself (CC BY 4.0), each resolved through the compute API's
  `POST /api/v1/time` (the site's resolver); the MCP tool `resolve_birth_time`
  is ledger unit A1.c, not started, and when it ships after WP-1's first
  slice the records are re-resolved through it with the same inputs; the place field recorded by hand as a GeoNames or Wikidata id with the name
  the record uses; when A1.c's `search_places`, extended with Getty TGN's
  historical names for the records' dates (D.3), ships, the place field is
  re-resolved through it; the Gauquelin pilot's 72 rows as a test
  fixture in the vault, not in the repository, until the licence is
  confirmed; the four US rows handed to WP-13 as leads (name, date, place,
  the list's hour, our hour), in the vault report; Frida Kahlo's time
  re-sourced or relabelled per decision 16.
- **Files and gates:** the profile as a served, versioned JSON Schema at
  `public/developers/birth-record/v1/schema.json` (the sky-benchmark
  precedent: published versions are immutable), with the crosswalk in
  `docs/platform/data/birth-record-v1.md`; the §4.4 registry does not exist
  yet (programme ledger: Standards §4.4, 0 of 1 unit) and the conventions
  vocabulary lives only in the MCP resource `zodiacs://conventions` in
  `src/mcp/resources.ts`, which this package does not edit (it is WP-1's and
  is in the MCP bundle); `docs/phase5/people-pilot/schema.json` (additive),
  `src/data/people.json` (regenerated; the people drift check), the claims
  ledger for any public sentence about birth times; `check-dist` for the new
  served file.
- **Acceptance:** the schema validates every record in the dataset and every
  row of the pilot fixture; the people pilot's validator still rejects
  astrology-site sources; no record in the repository derives from the
  Gauquelin database proper until the maintainer's answer is filed in the
  vault.
- **First slice:** the schema, the crosswalk, the seven records.
- **Main risk:** the Gauquelin licence answer never comes; the slice does not
  depend on it.
- **Waits on:** decisions 14, 16.
- **Parallel:** with everything except WP-12.

### WP-12 `resolve_birth_record` for agents

- **Lane:** programme.
- **Outcome:** a read-only tool and a `POST /api/v1/birth-record` endpoint
  that take a person (Q-id or name and birth date) and return the sourced
  record in `birth-record.v1` form or a typed refusal, for deceased or clearly
  public figures only, with the source and grade on every answer; Open
  Archives and Wikidata as the identity sources; never a time without a
  citation.
- **Files and gates:** `src/mcp` (a new tool: bundle rebuilt, the three
  evidence files re-recorded, version bumped, archive re-cut and pinned in
  two commits); `src/lib/compute-api` (inside the Phase 1 receipt boundary,
  so the captures are retaken last; `api/_compute/compute.mjs` rebuilt byte
  for byte, `tests/api/compute-api-bundle.test.ts`); `vercel.json` (an
  explicit rewrite `/api/v1/birth-record` to
  `/api/compatibility?__zodiacs_compute=birth-record`, like the other
  endpoints, plus `tests/api/compute-api-vercel.test.ts`); the OpenAPI
  document and `src/lib/compute-api/examples.json` (regenerated); the
  `api/v1/index.json` endpoint list (`check-dist`); the claims ledger; the
  consumer boundary; the owner's allowlist of living people as a committed
  file, proposed `docs/phase5/people-pilot/living-allowlist.json`, empty
  until the owner adds a name.
- **Acceptance:** 100 % of answers cite a source; a test proves the tool
  refuses every person without a sourced record and every living person not
  on the owner's allowlist; the stores' checklists pass for the new tool.
- **First slice:** the endpoint over the WP-11 dataset only.
- **Main risk:** scope creep into lookup of living people; the allowlist and
  the refusal test hold the line.
- **Waits on:** decision 14; WP-11; WP-1 (it adds a tool to WP-1's server
  and a rewrite to WP-1's `vercel.json`).
- **Parallel:** with WP-4 to WP-6, WP-8 to WP-10 and WP-13 to WP-15. Not
  with WP-1, WP-2, WP-7 or WP-16 (the same MCP bundle, `vercel.json`,
  compute bundles and Phase 1 receipt), and not with WP-11.

### WP-13 The atlas evidence corpus and the tzdb drafts

- **Lane:** data, in the engine repository's `atlas/`.
- **Outcome:** a CC BY 4.0 dataset of dated time-change notices from the
  Library of Congress newspapers (fetched with an identifying `User-Agent`
  at 10 requests a minute or fewer), each with the newspaper, date, page and
  a short quotation; citations only from Gallica, Delpher and Trove; the
  corpus feeding the atlas's US and France rules and the four pilot cases;
  draft posts for the tz list for any backzone-level finding, left in the
  engine repository's `atlas/` for the owner to send.
- **Files and gates:** the engine repository (`atlas/`, its schema and
  tests), the vault's `_logs/`.
- **Acceptance:** every atlas rule the corpus touches cites a notice; the
  round-trip tests pass; the four pilot cases resolve to the hour the notices
  support, with the notice cited; where a notice contradicts the Gauquelin
  list, the list's hour is recorded as a discrepancy with the citation, not
  adopted.
- **First slice:** the four pilot cases (Minnesota 1922, Missouri 1925, South
  Carolina 1927, Alabama 1931) and the notices behind them.
- **Main risk:** archival research takes calendar time; the first slice is
  deliberately four cases.
- **Waits on:** nothing.
- **Parallel:** with everything.

### WP-14 Conformance results for hosted services

- **Lane:** programme.
- **Outcome:** the adapter contract published with an invitation page;
  RoxyAPI run with full disclosure of method and inputs; the others listed
  as invited; results on the conformance page beside the engine and Swiss.
- **Files and gates:** the conformance harness in the engine repository,
  `src/pages/developers/conformance/`, the claims ledger (any sentence about
  another service's accuracy needs a record and a date).
- **Acceptance:** the run is preregistered, happens once, and is published
  with its receipts; no service is run whose terms forbid it.
- **First slice:** the contract, the page, and RoxyAPI's run once its key
  exists; without a key inside the slice, its row reads "invited, not run".
- **Main risk:** a vendor objects. The terms check and the invitation first
  are the answer.
- **Waits on:** decision 19 and the RoxyAPI key (an owner action; no agent
  creates an account, requests a trial or adds a payment method).
- **Parallel:** with everything.

### WP-15 The operating model in files and settings

- **Lane:** Fable writes `LANES.md`; the programme session makes the CI
  change; the owner changes the repository settings.
- **Outcome:** `docs/platform/LANES.md`; the docs-only fast lane in
  `site-check.yml`; per-pull-request allowance files in the scope guard;
  `HANDOFF-2026-09-30`'s merge rules restated in `CLAUDE.md`'s "Checks"
  section; the owner's required status check "Build & Check" turned on and,
  if GitHub offers it for a user-owned repository (unverified: `zodiacs-org`
  is a User account, and GitHub documents the merge queue for
  organization-owned repositories), the merge queue; without the queue, the
  merge window in E.2 rule 6 serialises the lanes.
- **Files and gates:** `.github/workflows/site-check.yml`,
  `scripts/phase1-scope-guard.mjs` and its test (a gate: Fable review before
  merge), `CLAUDE.md`, the new docs file.
- **Acceptance:** a docs-only pull request finishes its checks in under ten
  minutes; a merge to `main` no longer invalidates an unrelated allowance;
  the next week shows no merge on red.
- **First slice:** `LANES.md` and the fast lane.
- **Main risk:** a "docs-only" change that is also a test fixture. The fast
  lane applies only when every changed file is a Markdown file under `docs/`
  and none is under `docs/acceptance/`, `docs/claims/`,
  `docs/engine-validation/`, `docs/growth/`, `docs/phase5/`,
  `docs/platform/evidence/`, `docs/platform/programme/` or
  `docs/build-report-2026-07-15/`, and none is `docs/STRATEGY.md` or a
  `docs/REGISTRY-*.md` file; those paths are test fixtures or claims
  evidence and keep the full run.
- **Waits on:** decision 18 for the settings.
- **Parallel:** with everything.

### WP-16 tzdb 2026e

- **Lane:** programme (time).
- **Outcome:** `tz-lmt.json` and `tz-history/2026e/` regenerated with zic
  2026b or later, the pinned URL and digest updated, Dublin's 1925 fall-back
  and Yellowknife's change recorded as test cases, the conformance
  configuration and the compute examples' runtime note updated, and the two
  tests that depend on the host's tzdb made to say which version they expect.
- **Files and gates:** `scripts/build-tz-*.mjs` (compile with zic 2026b or
  later, or pass `-b fat`: the 2026b release notes warn that an older zic in
  slim mode writes TZif that breaks RFC 9636 for 2026b+ data;
  `build-tz-history.mjs` runs the host's zic without `-b`, and the CI
  runner's zic version is unverified, so make the flag explicit),
  `src/data/tz-*`, `src/lib/compute-api/constants.ts` (`PINNED_TZDB_RELEASE`),
  `api/_compute/local-time.mjs` (rebuilt byte for byte),
  `src/lib/compute-api/examples.json` (regenerated; its `runtimeTzdb` is
  2026c and the OpenAPI test byte-compares only on a 2026c host), the
  tz-data-drift CI job, the claims-ledger sentences that name 2025c.
  `constants.ts` is a declared source of the MCP bundle, so the bundle is
  rebuilt, the three evidence files re-recorded, the version bumped and the
  archive re-cut and pinned in two commits; `constants.ts` and
  `examples.json` are inside the Phase 1 receipt boundary, so the captures
  are retaken last.
- **Acceptance:** the drift job is green on 2026e; the divergence list is
  re-derived and every change from 2025c explained; the owner has seen a
  preview of the methodology page before merge.
- **First slice:** the whole package; it is bounded.
- **Main risk:** the runtime gap after 1 November (Manitoba) is in the host's
  Intl data, not in this package; say so on the methodology page, in all
  six languages.
- **Waits on:** nothing.
- **Parallel:** with WP-4 to WP-6, WP-8 to WP-11 and WP-13 to WP-15. Not
  with WP-1, WP-2, WP-7 or WP-12 (the same MCP bundle and, for WP-12, the
  same compute bundles and Phase 1 receipt).

### WP-17 The ledger decisions, recorded

- **Lane:** programme (a checkpoint pull request).
- **Outcome:** the `DECISIONS-<date>.md` file that records whatever the
  owner answers in decision 22, the `denominator.changes` entry with the new
  digest if units are added, and the status changes the packages earn: P3.6
  and S7 from WP-1 and WP-3, P3.1b from WP-2, A1.d in part from WP-1
  (`get_sky` only; `explain_factor` stays open), G5 from WP-8's curated-list
  submissions, A8 from WP-9's first panel run.
- **Files and gates:** `docs/platform/programme/acceptance-ledger.json`
  (status, release, evidence; a `denominator.changes` entry only if a unit
  is added or reweighted), `docs/platform/programme/LEDGER.md` regenerated
  with `node scripts/programme-ledger.mjs`, `docs/platform/programme/STATUS.md`
  (the printed figure), the new DECISIONS file. Gates:
  `scripts/programme-ledger.test.mjs` (the digest, `LEDGER.md` byte-equal to
  the render, `STATUS.md`'s overall figure); an accepted unit needs evidence,
  a deployed, released or merged release state and no `blockedBy`; a gate
  passed only under an amendment adopted after its residual was seen is
  validated, not accepted, until the owner ratifies.
- **Acceptance:** `node scripts/programme-ledger.mjs --check` passes;
  `STATUS.md` states the printed figure.
- **First slice:** the DECISIONS file and the A1.d rename (decision 7); P3.6
  moves only when WP-1's and WP-3's evidence is committed.
- **Main risk:** the fixed denominator (151 units, digest `52f0e085…`):
  adding units changes the digest and needs the owner's recorded decision,
  and the programme may not accept its own work on a reading it proposed
  after seeing the results (decision of 5 October §4).
- **Waits on:** decision 22 and the packages' evidence.
- **Parallel:** last.

---

## 5. Owner decisions

Answer one by one. "Recommended" is this plan's view; the reasons are in the
sections named.

1. **One server, one vocabulary, #618 split** (A.1). Recommended: yes. The
   programme's tool names are canonical; #618's HTTP handler and Chart
   Studio are kept; `search_zodiacs` becomes a resource; the pull request is
   split into WP-1, WP-4, WP-7 and decision 11.
2. **Does the hosted server take birth data at all?** (A.1). Recommended:
   not in the first listing. Chart Studio keeps birth data in the browser,
   and OpenAI's guideline asks for minimal inputs. Add `calculate_natal_chart`,
   `compare_calculation_records` and `resolve_birth_time` to the hosted set
   later, as a tool update, once the privacy wording is in the claims ledger
   and you have seen it. If you prefer them from day one, WP-1's first slice
   includes them and the negative-control test proves nothing is logged.
3. **The package name** (A.1, WP-2). Recommended: `@zodiacs/mcp-server`, as
   decided on 28 September, with `mcpName: org.zodiacs/mcp`; do not publish
   under the unscoped name. And: publish now bundling rc.16, or wait for the
   1.0 candidate? Recommended: wait, unless the stores' review needs the
   package first.
4. **The plugin repository** (WP-4). Its name (`zodiacs-org/plugins` is
   proposed) and its licence. Recommended: MIT for the bundle files, which
   are manifests and skill text, with the icon excepted as a brand asset,
   and the site repository staying all rights reserved. MIT is also what
   Cursor's marketplace requires.
5. **Accounts** (A.2). First, whether to pay for a Claude plan at all. This
   is new spending and departs from the 28 September decision (§5, no
   additional spending; §9, the owner's free assistant accounts);
   Anthropic's directory cannot be submitted to from a free account (checked
   6 October), so without it there is no Claude connector or plugin listing.
   If yes: on which account, and who clicks submit (on Team or Enterprise,
   an Owner). For OpenAI, which member holds Apps Management Write, and the
   state of the verification "in review".
6. **The registry namespace** (WP-3). Recommended: `org.zodiacs`, proven by
   one DNS TXT record you add, which also covers subdomains. The alternative,
   `io.github.zodiacs-org`, is granted by the `zodiacs-org` GitHub login or
   by GitHub Actions from the repository with no secret, but it is a personal
   namespace, since `zodiacs-org` is a GitHub User, and it does not match
   the domain.
7. **The name `get_sky`** (A.1). The ledger's A1.d calls the tool
   `get_sky_today`. Recommended: `get_sky`, with "now" as its default, and a
   note in the next DECISIONS file so the ledger's wording follows.
8. **Chart Studio in the first listings?** (A.3, WP-7). Recommended: in the
   ChatGPT listing (it is built for it and the review cases use it), and on
   Claude through the connector once WP-7's test record shows it rendering.
   Not in the Claude plugin, which cannot carry it.
9. **Meta Muse** (A.2). A US-only reviewed directory that needs business
   verification and a data-processing questionnaire. Recommended: later, when
   the Claude and ChatGPT listings are stable.
10. **Categories** (A.2). Recommended: Education & Research on ChatGPT (the
    precedent, and "Lifestyle" is invalid); Education on Claude.
11. **Sky Watch** (#618's OAuth preview on its own Vercel project and
    database). It is a stateful, authenticated service, outside this plan's
    read-only server, and it costs a separate project under the "no new
    spending" decision of 28 September. Recommended: shelve it until a
    store supports event subscriptions on a listed plugin, and count what it
    costs today.
12. **The vault's second copy** (C.1). Where: a private bucket or drive you
    control. Recommended: whichever you already pay for; not a GitHub
    repository.
13. **Astro-Databank** (C.4). Before signing: which form (with or without the
    back-link), the period and price, whether the birth time and rating may be
    shown publicly, and what happens after a lapse. Recommended: ask before
    signing; archive to `licensed/` only; show nothing until you have decided
    on the contract in hand; keep chart twins locked.
14. **The birth-record tool's scope** (C.4, WP-12). Recommended: deceased or
    clearly public figures only; the four protected living people stay
    excluded; any widening is your call, per record.
15. **Open Gauquelin** (C.4). If the maintainer confirms CC BY-SA 4.0,
    proceed with a separate share-alike dataset; if he does not answer, the
    pilot stays a private test fixture. The seven certificate transcriptions
    the project marks CC BY-SA 4.0 go ahead in WP-11 either way. The
    follow-up message is yours to send, not an agent's.
16. **Frida Kahlo's birth time** (2.3). It was typed in from Astro-Databank,
    which the repository's own rule forbids. Recommended: re-source it from a
    primary record (the Coyoacán civil registry is the kind of source the
    profile wants) or relabel it as unsourced and drop the time from the demo.
17. **Astrology-publication times** (C.4). The Gauquelin pilot excludes 17
    people whose only time came through an astrological publication, by the
    people pilot's rule. Recommended: keep the rule as written.
18. **Repository settings** (E.2). Turn on the required status check "Build &
    Check" and, if GitHub offers it for a repository owned by a user account,
    the merge queue; merge commits only; nobody merges on red; your yes
    quoted in the pull request. Recommended: yes to all four; the required
    check alone already delivers "nobody merges on red".
19. **Conformance against hosted services** (D.6, WP-14). RoxyAPI's terms
    allow the run and a published comparison when the method and inputs are
    disclosed, but every call needs a key: a paid plan from $39 a month, or a
    trial key requested through their contact page, which is a message to a
    third party that only you send. Recommended: yes, with you asking for the
    trial key; if none comes, RoxyAPI is listed as "invited, not run" until
    you decide to pay. The others are invited and run only with written
    consent.
20. **The free tier** (B). Stays free and keyless. Recommended trigger to
    revisit: when the Pro plan's monthly credit is used up or the Firewall
    refuses more than one request in twenty, the programme brings you the
    cost and a volume-tier proposal.
21. **A tool-call counter** (F). An enum-only counter (tool name, host
    family, outcome; never arguments) and one new sentence in the privacy
    claim, written in all six languages. Recommended: yes; without it,
    per-tool figures exist only for Claude.
22. **Ledger changes** (WP-17), for you to record in a DECISIONS file: rename
    A1.d's tool as in decision 7; add units for the plugin bundles, the
    store listings and the birth-record profile, or leave them outside the
    denominator as "distribution outcomes"; and ratify the status changes
    WP-1 to WP-3, WP-8 and WP-9 earn, as WP-17 lists them. Recommended: keep
    the denominator as it is and track listings as outcomes beside the
    strategy's §9 measures, so no unit is added after the fact.
23. **The external-builder packet** (decision of 5 October §2). Once the
    server is live and the packet is refreshed, the recipients are yours to
    name.

## 6. Ideas I rejected

- **On-chain timestamps as "genesis moments"** (seed 6): it ties the
  platform to the token, which the brief's §9 (no token, market or crypto
  language outside the wing) and §4.1 (the token collection stays out of
  every listing; counsel before any cross-promotion) forbid, and no
  assistant needs it.
- **A generic "find anyone's birth time" tool** (seed 2 as written): it
  would invent or scrape; the narrow "resolve and grade a cited record" keeps
  the useful part.
- **A brand-new provenance schema** (seed 1 as written): five schemes exist;
  a profile with a crosswalk is what is missing.
- **A paid tier now** (seed 9): the 28 September decision stands; decision
  20 sets the trigger.
- **Merging #618 whole**: 292 files across four lanes, with a server that
  duplicates the programme's; it lands in pieces.
- **Two endpoints, one public and one full**: one address is the point; the
  tool set grows on it instead.
- **Keeping `search_zodiacs` as a tool**: it reads as promotion under both
  stores' rules and fails on full sentences.
- **A static `_meta.ui.domain` for both hosts**: Claude rejects a value that
  is not its own hash; the alias is the only single value that can work.
- **Squatting the unscoped npm name**: the owner's rule against placeholder
  uploads (PyPI) applies.
- **Smithery as the route**: its gateway sees tool arguments; a listing of
  our URL is fine.
- **Microsoft Copilot Studio certification**: needs server authentication and
  a work tenant, against the brief's authless public tools.
- **Paid fast lanes in directories** ($29 to $39): the free queues exist and
  the owner's no-new-spending decision applies.
- **Sending tzdb the four US cases as bugs**: tzdb is zone-wide before 1970
  by design; they are atlas material.
- **Importing g5's code (GPL-3) or the Gauquelin exports' offsets and
  coordinates**: the code's licence does not fit the site, and the project
  itself says those fields are unreliable.
- **Storing texts from Gallica or Delpher**: their terms reserve commercial
  and AI reuse; citations only.
- **Re-asking NAIF**: the question was sent on 30 September and the
  repository's rule is not to resend it.
- **A Wikidata item for Zodiacs.org**: S7 already says only with independent
  references, and never a self-made edit.
- **Running conformance against Open Ephemeris or AstrologyAPI without
  consent**: their terms forbid or do not allow it.
