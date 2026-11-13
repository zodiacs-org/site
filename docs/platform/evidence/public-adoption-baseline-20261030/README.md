# Public adoption baseline, 30 October 2026: P0.7a accepted

P0.7a's gate reads "registry downloads, repository stars/forks/dependents,
MCP Registry entries, citing domains recorded with date and method". The
first baseline ([public-adoption-baseline-20261010](../public-adoption-baseline-20261010/README.md))
left it partial for two reasons: its MCP Registry figure came from one named
search, not an inventory, and its citation discovery was three web queries.
This record measures every figure again on 30 October, inventories the whole
official Registry, and counts citing domains in named public indexes.

The collector is [`tools/collect.py`](tools/collect.py) (Python standard
library, anonymous HTTPS GETs only). It ran from 15:16:58Z to 15:35:45Z
(22:16 to 22:35 Bangkok time). The GitHub searches ran at 15:18:03Z,
authenticated because GitHub's code search requires it, and three web
searches ran the same evening. Every response's URL, status, time, size and
SHA-256 is in [observation.json](observation.json); the responses kept in
[raw/](raw/) are named there.

## The figures

| measure | value | method |
| --- | --- | --- |
| npm `@zodiacs/engine` downloads | 906 in the last month, 58 in the last week; by day in `raw/npm-range-zodiacs_engine.json` | npm downloads API, `point/last-month`, `point/last-week`, `range/2026-09-28:2026-10-29` |
| npm `@zodiacs/mcp-server`, `cli`, `ai-tools`, `wheel` | not published (404), so no count | the same API |
| PyPI `zodiacs` 0.1.0a1 | 0 last day, 8 last week, 128 last month; 153 without mirrors over the 15 days pypistats lists | pypistats `recent` and `overall?mirrors=false` |
| GitHub `zodiacs-org/engine` | 0 stars, 0 forks, 0 watchers | GitHub REST `repos/zodiacs-org/engine` |
| GitHub `zodiacs-org/site` | 0 stars, 1 fork, 0 watchers | GitHub REST `repos/zodiacs-org/site` |
| Engine dependents | 0 repositories, 0 packages | GitHub's anonymous dependents page, both views, as displayed |
| Official MCP Registry | 0 entries from zodiacs.org among 53,123 servers (latest versions) | every page of `v0/servers?limit=100&version=latest`, following `nextCursor` (532 pages); plus `search=zodiacs`, 0 |
| Citing domains | 0 found | the census below |

The 532 Registry pages, 47 MB, are kept outside the repository; their
combined SHA-256 is
`0e87518b43e50b81ebdb5bc7e8f80dbddc1b641b66ae937e11ebcf9f40d65855`. Two
entries contain the string "zodiacs", and neither concerns zodiacs.org: one
names an API key from another site, `12Zodiacs.com`, and the other computes
charts "in both zodiacs".

## Citing domains: the census

A citing domain is a site other than zodiacs.org, its repositories, its
packages and their automatic mirrors that links to or names zodiacs.org or
the engine. Each index below was searched for `zodiacs.org` (and its
subdomains where the index allows):

| index | searched | found |
| --- | --- | --- |
| Wikipedia external links | `list=exturlusage` for `zodiacs.org` and `*.zodiacs.org`, https and http, in 20 editions (en, de, fr, es, it, pt, ru, ja, zh, nl, pl, sv, uk, ko, tr, hi, fa, ar, id, vi) and Wikidata | 0 links |
| Hacker News | Algolia search, URL field and full text | 0 |
| Papers | OpenAlex works, full-text filter and search | 0 |
| GitHub code outside the organisation | `"zodiacs.org" -org:zodiacs-org` | 29 files in 20 repositories, none citing this site: 7 copy lists of expired domain names (dated 2012 to 2022), 12 copy one old Wikipedia article that linked the domain then, and 1 is a security simulator's sample list of URLs |
| GitHub code, the package name | `"@zodiacs/engine" -org:zodiacs-org` | 0 |
| GitHub issues and pull requests | `"zodiacs.org" -org:zodiacs-org` | 0 |
| Web search, one engine | `"zodiacs.org" -site:zodiacs.org`; `"@zodiacs/engine" astrology`; `"zodiacs.org" astrology engine OR API OR MCP -site:zodiacs.org -site:github.com` | no third-party page naming zodiacs.org or the engine; the only related result is the project's own PyPI package |
| Reddit | `search.json?q=url:zodiacs.org` | not measured: 403 to an anonymous request |

The site's own pages, repositories and packages, automatic package mirrors
(as in the first baseline) and unrelated uses of the word are not citations.

## What this does not establish

- Use. Downloads include release days, continuous integration and the
  programme's own installs, and no count identifies a person. Zero displayed
  dependents is GitHub's index, not proof that nobody uses the engine.
- Every citation on the web. The census covers the named indexes above, at
  one moment. GitHub's code search covers indexed default branches; OpenAlex
  holds full text for part of its papers; the web search was one engine,
  top results only; Reddit refused the request.
- The measures that need the owner's accounts (Search Console, Bing,
  analytics, the assistant panel). Those are P0.7b.

## Verdict

Every measure the gate names is recorded with its date and method, and the
two gaps the first baseline left are closed: the Registry is inventoried, not
searched, and citing domains are counted in named indexes. **P0.7a is
accepted** (0.25 weighted units). The figures are the baseline for the brief's
§9 adoption measures.
