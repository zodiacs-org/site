# P1.15 in production, 2026-10-13

P1.15 asks that share links and their precision be described truthfully where
the site describes them. Site #730 corrected `llms.txt` and `llms-full.txt`:
they no longer describe the retired preview service and personal calendar feeds
as live, and name the one exception, a preview link made before they were
retired, which still opens and sends its code in the query string.

[`tools/production-check.mjs`](tools/production-check.mjs) reads the two files
from https://zodiacs.org and compares each with the merge commit's copy, byte for
byte; it then requires that neither describes a retired path as live (the
phrases `scripts/trust-privacy-boundary.test.mjs` forbids) and that
`llms-full.txt` carries the two corrected sentences. Its first check is what
Vercel reported for the `zodiacs.org` alias just before: the deployment, its
state, its target and the commit it was built from. Nothing else from that
reply is recorded.

- [`control-before.json`](control-before.json): the same check against
  production before the merge, `dpl_F93raokP8a1Sc3rK49cniZxeU4B9`, built from
  `127e0767`, with #730's head as the expected commit. 1 of 7 checks pass:
  the deployment was not built from that commit, neither file was #730's, and
  `llms-full.txt` still described a retired path as live and lacked both
  sentences; `llms.txt` named no retired path either way.
- [`production.json`](production.json): after the merge, `zodiacs.org` at
  `dpl_FF8v9Lp4xeRCaGMYPyAgmMPqRW3N`, built from `7d12c0f1`. All 7 checks pass.

The post-merge Site Check run on main:
[38381457494](https://github.com/zodiacs-org/site/actions/runs/38381457494).
