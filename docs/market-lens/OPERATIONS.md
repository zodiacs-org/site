# Operational handoff — 2026-10-01

## Revised protected preview

- Application source `bdda5cee` passes all 19 hosted CI checks; the two
  event-gated browser-evidence checks skip. [Site Check](https://github.com/zodiacs-org/site/actions/runs/36895191166)
  completes successfully. The subsequent operations commit triggers a fresh
  run; its template also has the local validation recorded below.
- [Preview](https://zodiacs-2j7skv6o5-zodiacsofficial.vercel.app/terminal/lens/)
  deployed successfully from `51836f28`, the application at `bdda5cee` plus a
  temporary allowance for `codex/lens-preview-20261001`.
- GitHub deployment `6790444415`, ready 2026-10-01T17:09:08Z. The branch
  restores the original main-only controls at `8d5c10dd`; the review PR's
  controls are unchanged. One preview build, no production deployment.
- [Existing trusted-main function smoke](https://github.com/zodiacs-org/site/actions/runs/36897272617)
  passes. It checks existing functions, not the new Lens API/browser paths.
- Actual Lens deployed acceptance returns HTTP 302 from Vercel Authentication
  before the handler. No secure bypass value is present. Prices remain
  disabled pending written display rights. [BETA-REVIEW.md](BETA-REVIEW.md)
  provides the protected trader-review tasks; no participants were contacted.

The saved cloud `start_skill` now includes the new preview and study operations.
Updating the existing bypass requirement's domain scope failed with a draft
conflict; a read confirms its old domains and absent binding. In environment
settings, supply `VERCEL_AUTOMATION_BYPASS_SECRET` securely and add
`zodiacs-2j7skv6o5-zodiacsofficial.vercel.app` and
`zodiacs-org-git-codex-lens-preview-20261001-zodiacsofficial.vercel.app` to its
allowed domains. After propagation:

```sh
BASE_URL=https://zodiacs-2j7skv6o5-zodiacsofficial.vercel.app \
  NODE_OPTIONS=--use-env-proxy node tests/market-lens-deployed-drive.mjs
```

## Prospective state and independent witness

The original protocol hash remains
`c9185d2a42d8fcbb2ba2a9358340406e03367f7b486ef773e3727fd513ad0ca5`.
The original October 2 decision hash remains
`099203259f5d6d48ea83e2054d2ffec484d3f75d672dbe29593a91aaa1204a1d`.

[Signed first-decision evidence](paper-first-witness/receipt.json) establishes
that this digest existed at 2026-10-01T17:05:49Z, before October 2 execution
and its 15-minute lead deadline. The signed request/response and CA are public;
they contain the already published digest and cryptographic metadata, no
prices or actions. It does not attest the claimed earlier 12:26 recording
time or the truth of source prices. Verification passes both checks:

```sh
openssl ts -verify -queryfile docs/market-lens/paper-first-witness/decision.tsq \
  -in docs/market-lens/paper-first-witness/decision.tsr \
  -CAfile docs/market-lens/paper-first-witness/freetsa-ca.pem
openssl ts -verify \
  -digest 099203259f5d6d48ea83e2054d2ffec484d3f75d672dbe29593a91aaa1204a1d \
  -in docs/market-lens/paper-first-witness/decision.tsr \
  -CAfile docs/market-lens/paper-first-witness/freetsa-ca.pem
```

The deployable runner is documented in
[ops/README.md](../../research/market-lens/ops/README.md). Its private seed is
retained outside this public checkout. Fresh pinned installation and two
operational cycles pass: one unchanged/witnessed decision, zero outcomes,
zero operational errors. Original protocol, decision and witness bytes remain
identical after both cycles. Negative controls verify public-output rejection,
public-remote rejection and changed-source rejection before acquisition.

The workflow provides daily 00:17/02:17 UTC execution/retry, serialized jobs,
private append-only Git storage, private 90-day recovery artifacts and verified
RFC 3161 decision timestamps. It uses the existing public market endpoint;
no X, LLM or new paid API key. GitHub Actions scheduling has no timing SLA and
uses the owner's private-runner quota/billing. FreeTSA sends/receives hashes
only and has no availability guarantee. The owner should review failures and
keep a separate offline backup.

Remote activation remains blocked: the correct `POST /user/repos` endpoint
returns GitHub HTTP 403 `Resource not accessible by integration`. The account
is a GitHub user; an earlier organization-endpoint 404 was not an access test.
Create an empty **private** `zodiacs-org/market-lens-paper` and grant this task
access. Then deploy the prepared private seed and verify its bootstrap run,
private persistence and backup artifact before relying on scheduling.

No remote repository, active schedule or durable remote backup has been
created. The local archive is a transfer/recovery package, not proof of a
managed 180-day service. The frozen calculation, consumed holdout, public
forecast policy and trading-execution policy are unchanged.

## Licensing contact

[DATA-RIGHTS.md](DATA-RIGHTS.md) contains the complete request. The owner
provided the reply address and the CoinAPI contact form accepted the inquiry
at 2026-10-01T17:27:19.349Z (HTTP 200, “Success! Check your email!”). Its
[redacted receipt](provider-contact.json) records the request hash. Coinbase's
contact page is unavailable here. No license was obtained, feed enabled or
service purchased. The written grant must cover the listed display, caching,
browser delivery and derived/research uses.
