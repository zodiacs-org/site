# Programme status

Checkpoint 2: the owner's decisions, 2026-09-28. The next session should start here.

**Overall delivery: 7%** — 13 of 182.45 weighted units accepted; blocked on owner or external action: 5% (9.5).

The figure is computed by `node scripts/programme-ledger.mjs --summary` from [`acceptance-ledger.json`](acceptance-ledger.json). The method is in [README.md](README.md) and the unit list in [LEDGER.md](LEDGER.md).

## What changed since checkpoint 1

The owner delegated every open decision of brief §10. They are made and recorded in [DECISIONS-2026-09-28.md](DECISIONS-2026-09-28.md):

- amendments A1 and A3 are rejected;
- the calendar feed moves to opaque ids;
- raw Swiss output leaves the tree;
- publishing goes under the shared `@zodiacs` npm scope;
- the hosted API is free, with no new spending;
- the site repository keeps all rights reserved;
- the conformance vectors are CC0 1.0 and the atlas is CC BY 4.0.

No accepted weight changed. The blocked weight fell from 18.0 to 9.5:

- Four units no longer wait on a decision: the calendar feed (P1.15), the hosted API (P3.3), the site README (G2) and the atlas licence (B3.c).
- Steps 1.3 and 1.8 are now recorded as failed against their original gates. They were waiting for ratification, which is now refused.
- What remains blocked needs the owner's own accounts. The steps are below.

## Steps that need the owner's accounts

The owner, or Codex working on the owner's computer, can do these. Each says what to report back. None needs a password or token to be shared.

1. **npm: the first publish of `@zodiacs/engine`.** Do this once engine rc.13 is on `main` of `zodiacs-org/engine`.
   1. Sign in at npmjs.com as `zodiacs`, the account that publishes `@zodiacs/sdk`. Under Account, confirm that two-factor authentication covers authorization and writes.
   2. On any computer with Node 20 or later, fetch and check the archive:
      - `curl -LO https://github.com/zodiacs-org/engine/raw/main/artifacts/zodiacs-engine-0.1.1-rc.13.tgz`
      - `sha256sum zodiacs-engine-0.1.1-rc.13.tgz` must print `12db9dce0f2c7551924b41caa5609f57bf31dfb9051a72901b94cdae29d3b840`. If it does not, stop.
   3. Publish it:
      - `npm login` (as `zodiacs`)
      - `npm publish zodiacs-engine-0.1.1-rc.13.tgz --access public --tag next`, entering the one-time code when asked.
   4. On npmjs.com, open `@zodiacs/engine`, then Settings.
      - Under Trusted Publisher, choose GitHub Actions: organization `zodiacs-org`, repository `engine`, workflow `release.yml`, environment `npm`.
      - Under Publishing access, choose "Require two-factor authentication and disallow tokens".
   5. Report the output of `npm view @zodiacs/engine dist-tags` and a screenshot of the Trusted Publisher settings.
2. **PyPI: reserve `zodiacs`.**
   1. Sign in at pypi.org, or create an account with admin@zodiacs.org and turn on two-factor authentication.
   2. Under Your account, then Publishing, choose "Add a new pending publisher", then GitHub: project name `zodiacs`, owner `zodiacs-org`, repository `engine`, workflow `pypi.yml`, environment `pypi`.
   3. Report a screenshot.
3. **JSR: the `@zodiacs` scope.**
   1. Sign in at jsr.io with the GitHub account that administers `zodiacs-org`.
   2. Create the scope `zodiacs` and, in it, the package `engine`.
   3. In the package settings, link the GitHub repository `zodiacs-org/engine`.
   4. Report a screenshot.
4. **Zenodo.**
   1. Sign in at zenodo.org with the same GitHub account, and open Account, then GitHub.
   2. If `zodiacs-org` is not listed, grant it: on GitHub, open Settings, then Applications, then Authorized OAuth Apps, then Zenodo, and grant access to `zodiacs-org`.
   3. Turn on `zodiacs-org/engine`.
   4. Report a screenshot.
5. **The repositories' About boxes** on GitHub (the gear beside About).
   - `zodiacs-org/engine`:
     - description: "MIT-licensed astrology calculation engine: positions, houses, points and timing techniques, with receipts and a public conformance suite";
     - website: `https://zodiacs.org/developers/engine/`;
     - topics: astrology, ephemeris, astronomy, natal-chart, house-systems, typescript, conformance-testing.
   - `zodiacs-org/site`:
     - description: "Source of zodiacs.org. All rights reserved."
6. **Search and analytics baselines.**
   1. On GitHub, create the **private** repository `zodiacs-org/analytics-baselines`.
   2. Export these, and commit the files unchanged under `2026-09-28/`:
      - **Google Search Console** (property zodiacs.org): Performance, then Search results, with the date range "Last 16 months", then Export as CSV.
      - **Bing Webmaster Tools:** add and verify zodiacs.org if needed ("Import from Google Search Console" is quickest), then export Search Performance for the longest range offered.
      - **Plausible** (zodiacs.org): the last 12 months, exported as CSV.
   3. Say when it is done, so the repository can be attached read-only.
7. **NAIF.** Email the question below from admin@zodiacs.org to the general NAIF address listed at https://naif.jpl.nasa.gov/naif/contactinfo.html, and forward any answer.

   > Subject: Redistributing a compact file derived from DE440
   >
   > Hello NAIF team,
   >
   > We maintain Zodiacs.org, a free astrology site, and an MIT-licensed calculation engine. We would like to offer, as an optional download, a compact file derived from DE440 (de440s.bsp): the Sun, Moon and planet segments over 1790–2210, re-expressed in our own format to a stated precision. Its header would name DE440 and its citation (Park et al. 2021, AJ 161, 105, doi:10.3847/1538-3881/abd414), give the source kernel's SHA-256, and say the data were modified.
   >
   > Before distributing anything like this we would like to ask: may we redistribute coefficients derived from DE440 in this way, and is there an attribution or wording you would like us to use? If you would rather we distribute the unmodified kernel and let users derive the file themselves, we will do that.
   >
   > Thank you,
   > Zodiacs.org (admin@zodiacs.org)
8. **The assistants.** Confirm that free accounts exist on ChatGPT, Claude, Gemini, Microsoft Copilot and Perplexity for admin@zodiacs.org, with no payment method added. The panel questions will be supplied with the first run.

Later, once the site has rebuilt the MCP server on rc.13: the same first publish for `@zodiacs/mcp-server`, from its verified archive.

## Identities verified at this checkpoint

**Site.** `main` = `c7c591ba` (#594). Production serves it: `dpl_FrGg8yQgQWHoDrazdAohWMSPRP6i`, READY.

**Engine.** `main` = `df01d2d7` (PR #8, rc.12). The rc.13 candidate is on a local branch and not yet pushed:

- source `f05ea02b`, archive carried by `4eee7002`;
- archive SHA-256 `12db9dce…b840`, 79,092 bytes, rebuilt identically on Node 20, 22 and 24.

| archive | SHA-256 | source | status |
| --- | --- | --- | --- |
| rc.10 | `a377cdc8…565c` | `9c4f3fd7`, carried by `d0c5cd0c` | the site vendors it; production serves it |
| rc.11 | `d88e0ff8…7862` | `be3585b3` (merge `537ecaf4`) | merged; not adopted |
| rc.11 (superseded) | `13d637db…` | `00bdae79` | never merged; a second archive under the same version (F-01) |
| rc.12 | `c4cf150f…f7f0` | `a1d0f2c6` (merge `df01d2d7`) | merged; not adopted |

**MCP.** `0.1.0-rc.10`, `0405ecf4…3568`, 71,472 bytes; artifact commit `92162624`.

**Registries.** Nothing of the engine or platform is published. npm returns 404 for `@zodiacs/engine` and `@zodiacs/mcp-server`; `@zodiacs/sdk` 1.0.1 is the token SDK. PyPI `zodiacs` and the JSR `@zodiacs` scope do not exist.

## In progress

- **Engine rc.13**, which fixes the aspect exactness (F-06), the Sun's out-of-bounds flag (F-07), the rc.12 follow-ups (F-13–F-16), archive identity and CI binding (F-01, F-02), and the engine's token framing (F-21, engine part). It waits for an independent review before its PR.
- **Conformance suite v0** (B1): 500 vectors in three levels, each with an independent arbiter and a tolerance, adapters for this engine and for Swiss Ephemeris, and a CI job. It waits for an independent review before its PR.
- **Site privacy fixes** (F-17, F-18, F-19, F-40, F-26, F-27).
- **Engine features:** Hellenistic timing (profections, firdaria, zodiacal releasing, solar arc) and Vedic core (ayanamsas, nakshatras, vargas, KP, dashas), each on its own branch.

## Next

1. Review, push and merge rc.13, then adopt it on the site:
   - progressions through the package, keeping ChartLens's dynamic import;
   - the MCP server rebuilt under a new version;
   - docs and claims;
   - `/birth-chart/` measured against its 71 KB budget with production's flags;
   - the CI and install-snippet fixes F-03 and F-04 alongside.
2. Review and merge the conformance suite, then publish its results page at `/developers/conformance/`.
3. The site privacy PR, then the decisions' own work:
   - opaque calendar feed ids;
   - the removal of raw Swiss output;
   - the site README and licence statement.
4. Engine rc.14: the time steps in the package (1.1, 1.12, 1.13), the leap-second table and the receipts' time basis. After it, the Hellenistic and Vedic features.

**To resume.** Read this file, then `DECISIONS-2026-09-28.md`, `LEDGER.md` and `FINDINGS.md`. Check `git log` on site `main` and engine `main` against the identities above, and read the open PRs in both repositories.
