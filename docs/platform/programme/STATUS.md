# Programme status

Checkpoint 4: the conformance results page is live, 2026-09-28. The next session should start here.

**Overall delivery: 13%** — 23 of 182.45 weighted units accepted; blocked on owner or external action: 5% (10).

The figure is computed by `node scripts/programme-ledger.mjs --summary` from [`acceptance-ledger.json`](acceptance-ledger.json). The method is in [README.md](README.md) and the unit list in [LEDGER.md](LEDGER.md).

## What changed since checkpoint 3

- `/developers/conformance/` is live. Production deployment `dpl_DToHaomhWAgA3cA4QGTN4aHBxycm` serves #596 (`2ca93d41`), so B1.c is accepted (1.5 units).
- The site repository has its basics:
  - a rewritten README;
  - a LICENSE file stating that all rights are reserved;
  - SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md and CITATION.cff;
  - a "Wrong chart" issue form that asks for the calculation receipt.

  This is G2's README and the site's part of P3.11. G2's description and topics wait for step 5 below, so its 0.5 units now count as blocked.
- Independent reviews of the Hellenistic and Vedic branches found no errors in the computed techniques. Both branches need corrections before rc.15:
  - Hellenistic: the source claims for two monthly conventions, and evidence that presented self-checks as agreement with the sources.
  - Vedic: a hang when ΔT is pinned very large, wrong whole-sign cusps in `siderealChart`, and ayanamsa documentation that misstates the construction.
  - Both: packaging, which moves to subpath exports.

  The fixes are in progress.

## What changed at checkpoint 3

The conformance suite v0 is on `main` of `zodiacs-org/engine` (`8c4946b1`, PR #9), and its CI workflow is green there:

- 500 vectors in three levels: positions (240), houses and angles (150), and time and calendars (110). Each names an independent arbiter and a tolerance, and none uses Swiss Ephemeris as its arbiter. The files are CC0 1.0.
- A harness, with adapters for this engine and for Swiss Ephemeris through pyswisseph.
- A CI workflow. It validates the vectors, rebuilds them from their generators byte for byte, and re-runs this engine against the committed verdicts.
- A public discrepancy process. An independent review before release withdrew one vector and clarified six points, all recorded in its log.

The results, from `conformance/results/summary.json`:

- **Engine rc.12:** 232 pass, 222 fail and 46 unsupported.
  - Positions: 193 of 240 fail the 1″ tolerance, with a median longitude residual of 2.07″ and a largest of 18.8″.
  - Houses and angles: all 150 pass.
  - Time: 29 fail, 20 of them on tzdb's `backzone` history before 1970.
- **Swiss Ephemeris 2.10.03:** 403 pass, 47 fail and 50 unsupported. All 47 failures are houses and angles, from its long-term sidereal time outside 1850–2050.

This checkpoint's PR publishes the results at `/developers/conformance/`. B1.a, B1.b and B1.d are accepted (8.5 units), and B1.c is validated until the page is verified in production.

The owner's decisions of checkpoint 2 are in [DECISIONS-2026-09-28.md](DECISIONS-2026-09-28.md).

The npm step below now waits for rc.14. The independent review of rc.13 found defects (listed under "In progress"), so rc.13 will not be published.

## Steps that need the owner's accounts

The owner, or Codex working on the owner's computer, can do these. Each says what to report back. None needs a password or token to be shared.

1. **npm: the first publish of `@zodiacs/engine`.** Not yet: this waits for engine rc.14 on `main` of `zodiacs-org/engine`. When it is there, this step will name the archive and its SHA-256. Publish no other file.
   1. Sign in at npmjs.com as `zodiacs`, the account that publishes `@zodiacs/sdk`. Under Account, confirm that two-factor authentication covers authorization and writes.
   2. On any computer with Node 20.19 or later, download the archive named here, and check that `sha256sum` prints the value given here. If it does not, stop.
   3. Publish it:
      - `npm login` (as `zodiacs`)
      - `npm publish <the archive> --access public --tag next`, entering the one-time code when asked.
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
   - In both repositories, open Settings, then Code security, and turn on **Private vulnerability reporting**. SECURITY.md offers it beside email to admin@zodiacs.org.
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

**Site.** `main` = `2ca93d41` (#596). Production serves it: `dpl_DToHaomhWAgA3cA4QGTN4aHBxycm`, READY.

**Engine.** `main` = `8c4946b1` (PR #9, the conformance suite). CI and the Conformance workflow are green on it (runs 36439264630 and 36439264956). The package on `main` is still rc.12.

| archive | SHA-256 | source | status |
| --- | --- | --- | --- |
| rc.10 | `a377cdc8…565c` | `9c4f3fd7`, carried by `d0c5cd0c` | the site vendors it; production serves it |
| rc.11 | `d88e0ff8…7862` | `be3585b3` (merge `537ecaf4`) | merged; not adopted |
| rc.11 (superseded) | `13d637db…` | `00bdae79` | never merged; a second archive under the same version (F-01) |
| rc.12 | `c4cf150f…f7f0` | `a1d0f2c6` (merge `df01d2d7`) | merged; not adopted |
| rc.13 | `12db9dce…b840` | `f05ea02b`, carried by `4eee7002` | reviewed; defects found; never pushed, and not to be published |

**MCP.** `0.1.0-rc.10`, `0405ecf4…3568`, 71,472 bytes; artifact commit `92162624`.

**Registries.** Nothing of the engine or platform is published. npm returns 404 for `@zodiacs/engine` and `@zodiacs/mcp-server`; `@zodiacs/sdk` 1.0.1 is the token SDK. PyPI `zodiacs` and the JSR `@zodiacs` scope do not exist.

## In progress

- **Engine rc.14**, which fixes what the rc.13 review found:
  - the supported Node versions and their CI coverage;
  - the archive-binding check over the full history and every receipt;
  - the Sun's out-of-bounds convention;
  - an exact separation, and far dates outside the documented span refused;
  - the changelog's wording and the reference documentation's canonical address.

  It keeps rc.13's own fixes (F-01, F-02, F-06, F-07, F-13–F-16, and the engine part of F-21). It waits for an independent check before its PR.
- **Site privacy fixes** (F-17, F-18, F-19, F-40, F-26, F-27): implemented in six commits, now under independent review.
- **Engine time steps** (1.1, 1.12, 1.13), the leap-second table and the receipts' time basis, on their own branch.
- **Engine features**, each on its own branch:
  - Hellenistic timing: profections, firdaria, zodiacal releasing and solar arc. Reviewed; the corrections are being made.
  - Vedic core: ayanamsas, nakshatras, vargas, KP and dashas. Four named ayanamsas miss their 0.01″ gate and are recorded as failures. Reviewed; the corrections are being made.
  - The uniform calculation API with its coordinate frames (P3.2, P2.D).
  - Birth-time window partitions (B2.a), checked against dense one-second sampling.
- **The time atlas's first slice** (B3.a): the United States and France before 1920, every rule with a primary citation, under `atlas/` in the engine repository (CC BY 4.0).

## Next

1. Review, push and merge rc.14. Then:
   - the npm first publish (step 1 above);
   - its adoption on the site: progressions through the package, keeping ChartLens's dynamic import;
   - the MCP server, rebuilt under a new version;
   - docs and claims;
   - `/birth-chart/` measured against its 71 KB budget with production's flags;
   - the CI and install-snippet fixes F-03 and F-04 alongside.
3. The site privacy PR, then the decisions' own work:
   - opaque calendar feed ids;
   - the removal of raw Swiss output;
   - the site README and licence statement.
4. Engine rc.15: the time steps, then the Hellenistic and Vedic features. They take the package over its size gate, so they come with subpath exports and a documented budget.

**To resume.** Read this file, then `DECISIONS-2026-09-28.md`, `LEDGER.md` and `FINDINGS.md`. Check `git log` on site `main` and engine `main` against the identities above, and read the open PRs in both repositories. The conformance suite is described in `conformance/README.md` in the engine repository.
