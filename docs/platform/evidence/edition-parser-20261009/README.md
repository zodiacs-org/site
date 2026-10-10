# Integrated parser fix: regenerated acceptance evidence

The parser change is carried onto main `cd5c87d78216900f13f1207ca8c45849e148d3e5`
by merge commit `d567181d854ccb5b9878ecd6a463f579ed7958d7`, preserving both
parents and the newer tools, sharing and daily publication changes.

[Actions run 37889199574](https://github.com/zodiacs-org/site/actions/runs/37889199574)
built that exact head, ran the existing Phase 1 capture driver and its
unchanged evidence test, and passed. The 18 generated public screenshots
and manifest replace the older October 8 captures with October 9 payloads
and Chromium 149.0.7827.55. They were recovered from structured job exports;
every byte count and SHA-256 was verified before committing. The source
hash is `c482bc1c785ceefcb3343b61b014fca5079c27d2f63034fde21ccc6aec0dccc7`.

`capture-provenance.json` records every export job and digest. The temporary
contents-read-only workflow is removed from the final tree. It changed
no required gate, assertion, performance ceiling or visual baseline.
The complete unchanged Site Check remains required on the final evidence
commit before merge.

The earlier parser and Lighthouse observations remain in
`../edition-parser-20261008/` and the PR discussion, including the failed
homepage sample. This capture does not clear that performance failure.

Private search inputs from the previous executor remain unavailable.
No new private release search was performed or claimed here. These
screenshots contain public rendered content; release searches remain
required before stable publication.
