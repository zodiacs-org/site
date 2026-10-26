# Primary integrator handoff

These patches are proposals, not applied shared-file edits. The page, checker,
evidence adapter and tests are self-contained on `codex/astrofolio-verification`.

1. Review `phase1-allowance.patch`. It uses the existing Phase 1 exception
   mechanism with the exact base and one protected route. It changes no guard.
   Recompute its base and the complete protected-path list if integrating with
   platform PR #415 or another pending change; never overwrite its allowance.
2. Review `registry-context-link.patch`. It adds one contextual link below the
   existing Registry checker introduction. Apply to the generator, then run
   `node scripts/build-registry-hub.mjs` and commit generated
   `public/registry/index.html` with that source. Those shared files are not
   modified by this workstream. Inspect the existing checker separately before
   deciding whether to retire it: it retains addresses in URLs and has broader
   normalization rules than this new explicitly scoped comparison.
3. Keep this page's `noindex` during review. A production indexing decision is a
   separate integration change to the route and sitemap. Do not publish the raw
   facts at another endpoint without reviewing caching and crawler headers. The
   current JSON lives inside the same noindex HTML as the human view.

Patch validation (does not apply a patch):

```sh
git apply --check docs/astrofolio-trust/integration/phase1-allowance.patch
git apply --check docs/astrofolio-trust/integration/registry-context-link.patch
```

Source maintenance: `evidence.ts` pins the exact Registry, disclosure and receipt
bytes to immutable references. A changed source intentionally fails the build
until this local adapter is reviewed and repinned. Do not reset attestation or
chain-observation dates to the rebuild date. Base comparison is explicitly byte
membership without mixed-case checksum validation, and differs from SDK 1.0.1
transaction-address validation. No SDK behaviour is changed.

No production deployment, package publication, root AI guide, navigation/footer,
canonical identity, engine, SDK, API or developer-platform change is included.
