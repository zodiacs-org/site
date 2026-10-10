# Public adoption baseline: partial observation

Read-only [run 38049209045](https://github.com/zodiacs-org/site/actions/runs/38049209045), source `042e420925d91ecb6b41ba4120bfdb6c04e2aa49`, returned seven public responses on 2026-10-10. The original response bytes and SHA-256 identities are retained, with no build, browser, engine checkout/execution or publication.

- npm reports **139 downloads** of `@zodiacs/engine` for **2026-10-02 through 2026-10-08**. These include repeat and CI downloads; they do not identify users.
- The MCP package download endpoint returns **404**. Its count is **unavailable**, not zero.
- Third-party PyPIStats reports `zodiacs` last day **0**, last week **11**, last month **128**, using its provider-defined windows.
- Public GitHub repository metadata reports engine **0 stars / 0 forks** and site **0 stars / 1 fork**.
- GitHub's anonymous engine dependency page explicitly displays **0 repositories / 0 packages**. This is an indexed count, not proof of no usage; the site uses a vendored archive.
- The official MCP Registry query `search=zodiacs&limit=100&version=latest` returns **0 entries**, no next cursor. This is the named search, not a complete global or alternative-name inventory.

`observation.json` is the original native collector report. `review.json` records the separate dependency-count extraction and limited citation discovery. The original collector correctly left the dependency HTML unparsed; the review adds its explicit displayed values without altering that original report.

Citation discovery remains incomplete. Search returned automatic package mirrors at [npm.io](https://npm.io/package/@zodiacs/engine) and [Safety CLI](https://data.safetycli.com/packages/pypi/zodiacs/changelog); these are not evidence of editorial adoption. Distribution registries, token SDK/social mirrors, domain lookup results and unrelated same-name services are excluded. No complete citing-domain or paper count is claimed.

**P0.7a remains unfinished and adds no accepted weight.** Owner-controlled remote sessions, API request/caller counts and private analytics were not accessed. No telemetry value is inferred from these downloads or network observations.
