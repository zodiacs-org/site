# Programme status

Checkpoint 5: engine rc.14 and the time atlas are on the engine's `main`, every public repository has its basics, and the privacy fixes go to production, 2026-09-29. The next session should start here.

**Overall delivery: 17%** — 30.5 of 182.45 weighted units accepted; blocked on owner or external action: 5% (10).

The figure is computed by `node scripts/programme-ledger.mjs --summary` from [`acceptance-ledger.json`](acceptance-ledger.json). The method is in [README.md](README.md) and the unit list in [LEDGER.md](LEDGER.md).

## What changed since checkpoint 4

- **Engine rc.14 is on `main` of `zodiacs-org/engine`** (PR #10, merged as `8deda244`). It fixes what the audit found in rc.11 and rc.12 (F-01, F-02, F-06, F-07, F-10–F-16 and the engine part of F-21), and what four independent reviews found in rc.13 and in rc.14's builds. rc.13 was never released; its archive stays in `artifacts/` under its own identity and will not be published. The rc.14 archive:
  - `artifacts/zodiacs-engine-0.1.1-rc.14.tgz`, SHA-256 `adc9805e22cd2468fa3340a864d9c53b36ff91e8f1592fdb35d8da8b69f4476e`, 87,415 bytes;
  - built from `03db4bb`, and rebuilt byte for byte on Node 20.19.0, 22.22.2 and 24.21.0;
  - the same conformance verdicts as rc.12: 232 pass, 222 fail, 46 unsupported.

  The site still vendors rc.10, so none of these fixes counts until the site adopts rc.14 and production serves it. The npm step below is now ready.
- **The time atlas's first slice is on the engine's `main`** (PR #11, merged as `056bcd1a`). It records what civil clocks showed in the United States and France, Alsace and Moselle included, from 1870 to 1919:
  - 59 rules for 21 places, each with a primary citation, 66 in all;
  - 258 boundaries and 2,735 local↔UTC round trips checked in CI;
  - 108 differences from tzdb 2025c, each matched by exactly one of 11 explanations.

  An independent review and two re-checks checked the excerpts against their sources and recomputed the tzdb comparison. B3.a is accepted (7 units). The atlas does not feed `resolveBirth` yet (B3.b).
- **Every public repository has its basics.** The engine (PR #12, `b0ddb886`) and the SDK (`zodiacs-org/sdk` PR #14, `a95dc0cf`) now have every file the site got in #597: a security policy, a contribution guide, a code of conduct, citation metadata, agent notes and a wrong-result issue form. CodeQL, Scorecard and Dependabot run in both; the engine also has a release workflow for npm trusted publishing. P3.11 is accepted (0.5 units). The site still needs topics (G2) and code scanning (G3).
- **The engine's About box is set**: its description, website and topics read back as step 5 asked.
- **The privacy fixes** (#599) go to production with this checkpoint:
  - share codes and calendar feeds carry a timed birth only to its whole UTC minute, and a chart without a birth time as the sky at 12:00 UTC on its date;
  - every shared image is drawn no more precisely than its link;
  - a chart's page asks for all twelve sign pictures;
  - Guide gets the ascendant and midheaven to the whole degree.

  The privacy page says what each of these carries. This closes F-17, F-18, F-19, F-26, F-27 and F-40, and F-43–F-45, found while the fixes were made. Two independent checks verified the fixes. P1.15 stays partial: the opaque feed ids decided on 2026-09-28 are not built yet.
- The review of the birth-time window search found three minor engine defects, F-46–F-48. They are in [FINDINGS.md](FINDINGS.md).

## Steps that need the owner's accounts

The owner, or Codex working on the owner's computer, can do these. Each says what to report back. None needs a password or token to be shared.

1. **npm: the first publish of `@zodiacs/engine`.** Ready. Publish this archive and no other file:
   - `https://github.com/zodiacs-org/engine/raw/main/artifacts/zodiacs-engine-0.1.1-rc.14.tgz`
   - SHA-256 `adc9805e22cd2468fa3340a864d9c53b36ff91e8f1592fdb35d8da8b69f4476e`

   The steps:
   1. Sign in at npmjs.com as `zodiacs`, the account that publishes `@zodiacs/sdk`. Under Account, confirm that two-factor authentication covers authorization and writes.
   2. On any computer with Node 20.19 or later, download the archive, and check that `sha256sum` (on macOS, `shasum -a 256`) prints the value above. If it does not, stop.
   3. Publish it:
      - `npm login` (as `zodiacs`)
      - `npm publish zodiacs-engine-0.1.1-rc.14.tgz --access public --tag next`, entering the one-time code when asked.
   4. On GitHub, in `zodiacs-org/engine`, open Settings, then Environments, and create the environment `npm`. Under "Deployment branches and tags", choose "Selected branches and tags" and add `main`.
   5. On npmjs.com, open `@zodiacs/engine`, then Settings.
      - Under Trusted Publisher, choose GitHub Actions: organization or user `zodiacs-org`, repository `engine`, workflow `release.yml`, environment `npm`. Under Allowed actions, keep "npm stage publish" and also select "npm publish".
      - Under Publishing access, choose "Require two-factor authentication and disallow tokens".
   6. Report the output of `npm view @zodiacs/engine dist-tags` and of `npm view @zodiacs/engine@0.1.1-rc.14 dist.shasum dist.integrity`, a screenshot of each npm setting, and one of the GitHub environment.

   A correct publish reports `dist.shasum` `30498f08cc95550445ef2666e1324a5ac007d7d4` and `dist.integrity` `sha512-uOruhtGRmzAFnbaF+Kc8tPFDPZEk0cm77gLfF5Fdl78FjxkcZjvjyMrql/gTSkWFAniapdjpUoKxch4p/elc7Q==`.
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
5. **Repository settings** on GitHub.
   - `zodiacs-org/site`: its description and website are set. Add the topics (the gear beside About): astrology, birth-chart, natal-chart, horoscope, astro, typescript.
   - `zodiacs-org/engine`: its About box is done. Two settings remain:
     - Settings, then General, then Pull Requests: keep "Allow merge commits", and turn off "Allow squash merging" and "Allow rebase merging". The archive record names source commits that only a merge commit keeps.
     - Settings, then Rules, then Rulesets: a branch ruleset for the default branch that blocks force pushes and deletions, and requires these status checks to pass:
       - Engine (Node 20), Engine (Node 22), Engine (Node 24);
       - Every carried archive rebuilds from its source commit;
       - Pack;
       - Packed consumer (Node 20.19.0), Packed consumer (Node 22.7.0), Packed consumer (Node 22), Packed consumer (Node 24);
       - Conformance suite; Conformance vectors rebuild from their sources;
       - Time atlas checks.

       All of them run on every pull request.
   - In each public repository (`site`, `engine` and `sdk`): open Settings, then Code security, and turn on **Private vulnerability reporting**. Every SECURITY.md already offers its **Report a vulnerability** button beside email to admin@zodiacs.org.
   - Report a screenshot of each.
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

Later, once the site has rebuilt the MCP server on the published engine: the same first publish for `@zodiacs/mcp-server`, from its verified archive.


## Identities verified at this checkpoint

**Site.** `main` = `15949ec0` (the daily sky of 2026-09-29, after #597 `145d36e3`). Production serves it: `dpl_MtfvqRJszyHFx5RDEVb7kpRc6aun`, READY. The site vendors engine rc.10.

**Engine.** `main` = `b0ddb886` (PR #12). CI, Conformance, Atlas, CodeQL and Scorecard are green on it (runs 36535531997, 36535531826, 36535532013, 36535531827 and 36535531876). The package on `main` is rc.14.

| archive | SHA-256 | source | status |
| --- | --- | --- | --- |
| rc.10 | `a377cdc8…565c` | `9c4f3fd7`, carried by `d0c5cd0c` | the site vendors it; production serves it |
| rc.11 | `d88e0ff8…7862` | `be3585b3` (merge `537ecaf4`) | merged; not adopted |
| rc.11 (superseded) | `13d637db…` | `00bdae79` | never merged; a second archive under the same version (F-01) |
| rc.12 | `c4cf150f…f7f0` | `a1d0f2c6` (merge `df01d2d7`) | merged; not adopted |
| rc.13 | `12db9dce…b840` | `f05ea02b`, carried by `4eee7002` | carried on `main`; never released, and not to be published |
| rc.14 | `adc9805e…476e` | `03db4bb6`, carried by `b221534` (merge `8deda244`) | merged; the site's adoption is in progress; npm waits for step 1 |

**SDK.** `zodiacs-org/sdk` `main` = `a95dc0cf` (PR #14).

**MCP.** Production serves `0.1.0-rc.10`, `0405ecf4…3568`, 71,472 bytes (artifact commit `92162624`). The rc.14 adoption builds `0.1.0-rc.14`.

**Registries.** Nothing of the engine or platform is published. On 2026-09-29, npm returned 404 for `@zodiacs/engine` and `@zodiacs/mcp-server`; `@zodiacs/sdk` 1.0.1 is the token SDK. PyPI `zodiacs` and the JSR `@zodiacs` scope do not exist.

## In progress

- **The site's adoption of rc.14**, on its own branch, after this PR:
  - rc.14 vendored, with progressions through the package;
  - the MCP server rebuilt as `0.1.0-rc.14`;
  - F-03 (`mcp:pack:check` in CI) and F-04 (the install guard);
  - the conformance results refreshed, and the evidence.

  It needs main merged in, retaken captures and an independent review before its PR.
- **Engine rc.15**: the time steps (1.1, 1.12, 1.13, the leap-second table and the receipts' time basis), Hellenistic timing and the Vedic core. They are integrated with subpath exports and a size budget for each entry point. Two independent reviews are running: one of the time basis, one of the integration.
- **Birth-time window partitions (B2.a).** The independent review reproduced the preregistered gate: 1,000 windows, none missed and none extra. Its findings are fixed on the branch, with a bisection for F-46. The search goes into rc.16 with the uniform calculation API and its frames (P3.2, P2.D).
- **F-22**, the removal of raw Swiss output from the site tree, on its own branch, after this PR.
- **Nutation.** Replacing the five-term truncation with full IAU 2000B, as its own reviewed engine change; not started.

## Next

1. Merge this PR and verify production. Then record the privacy fixes as live.
2. The rc.14 adoption PR. When production serves it, the rc.14 fixes count, and each unit that waited on rc.14 is assessed again.
3. rc.15: act on the two reviews, then its PR.
4. F-22, the opaque calendar feed ids (P1.15), the engine reference at `/developers/engine/reference/` (G1), and the site's CodeQL and Scorecard (G3).
5. rc.16: the calculation API, frames and birth-time windows; then the nutation change.

**To resume.** Read this file, then `DECISIONS-2026-09-28.md`, `LEDGER.md` and `FINDINGS.md`. Check `git log` on site `main` and engine `main` against the identities above, and read the open PRs in both repositories. The conformance suite is described in `conformance/README.md` in the engine repository, and the atlas in `atlas/README.md`.
