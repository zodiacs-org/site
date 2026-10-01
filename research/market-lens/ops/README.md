# Private prospective runner

This template is deployed only to a new, empty **private** repository. Never
commit the prepared bundle or its `state/` directory to the public site.
`frozen/` retains the original lockfile, engine archive and calculation files.
Every CLI invocation verifies them against the original protocol receipt.

The workflow runs at 00:17 and 02:17 UTC daily. The second run retries source
or timestamp outages without replacing existing decisions. Record precedes
settlement so an older pending outcome cannot prevent a new decision. Missed
days remain missed. GitHub scheduling may be delayed and has no timing SLA.

Decisions and settlements remain write-once. Each decision hash is sent to
FreeTSA over verified HTTPS and gets a signed RFC 3161 response with a nonce.
OpenSSL verifies both the request and exact decision digest against the pinned
CA obtained from `https://www.freetsa.org/files/cacert.pem`. The signed time
must precede execution by the protocol's 15-minute lead. It proves the hash
existed by that time, not the truth of the record's claimed earlier timestamp
or the source prices. A missing/late witness remains an explicit failure and
cannot be repaired retroactively. Raw prices and actions never go to FreeTSA.

Private Git history stores primary state. Each run also uploads a private
90-day recovery artifact, including runs whose cycle or push fails. These are
two storage paths with one provider; use a separate periodic offline download
for protection against account loss. Only operational counts and hashes enter
Actions logs. A repository-wide private guard and deployment privacy check
prevent uploading to a public target. Do not change visibility later.

Prepare from the site checkout:

```sh
node scripts/prepare-market-lens-paper-ops.mjs \
  --state /private/existing-study-v1 --out /private/new-bundle-directory
```

The owner must create `zodiacs-org/market-lens-paper` with private visibility
and no initial files, then grant this session access. GitHub repository
creation returned `403 Resource not accessible by integration`; no repository
or remote scheduler has been created. The prepared initial protocol/decision
retain their original timestamps and verified signed witness.

From the prepared bundle, an authorized account can run:

```sh
bash ops/deploy-private.sh zodiacs-org/market-lens-paper
gh run list --repo zodiacs-org/market-lens-paper --workflow paper.yml
```

Confirm the bootstrap run, primary private commit and recovery artifact, then
verify October 3 has both the next decision and first settlement. No new API
key is required. Private Actions use the account's included minutes or existing
billing; the job is capped at eight minutes and two scheduled runs per day.
After April 7, 2027 it stops acquisition; disable the workflow after checking
the final report. Failures appear in Actions and should be reviewed daily.

Recover from the latest successful private Git state or backup artifact;
preserve receipt bytes, compare hashes and restore additions only. Never alter
an old receipt, fabricate a missed decision, or reinitialize v1. If frozen
sources fail verification, restore the original files rather than change the
protocol hash. This workflow deploys no website and executes no real trades.
