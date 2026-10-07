# OpenAI portal snapshot before deployment — 6 October 2026

Business verification is approved for Zodiacs LLC. The daily identity monitor is paused.
This approval is separate from plugin-directory approval.

The [Zodiacs draft](https://platform.openai.com/plugins/manage/plugin_asdk_app_6ac51614dd288191b38dd3b9c0cf191e?tab=details&version=appsub_6ac51614dd548191b711404446f2c323) was created under the verified Business identity in the
Personal organization / Default project. Plugin ID:
plugin_asdk_app_6ac51614dd288191b38dd3b9c0cf191e.

## Package and automated findings

Sky **0.3.3** is uploaded to the existing draft. Its SHA-256 is
11a965dd8c3e761a3c5fcd204342fb8b4dc9c3bda4b1199640bbed76d72c7eab. The portal rejected the earlier Lifestyle category.
Education & Research is supported by the current [submission-error reference](https://developers.openai.com/plugins/deploy/submission-errors#listing-and-interface-errors)
and fits public-sky exploration and reproducible calculations. The category finding
is now cleared. A local package guard checks supported categories for both plugins.

The explore-the-sky skill shows **Checks passed**. All **five positive** and
**three negative** review cases show complete. Release notes are imported.
Country availability shows all supported countries; no availability edit was made.
The icon, Zodiacs LLC, official website, support, privacy and terms fields imported.

The remaining privacy finding says the automated assessment could not be completed
and permits submission for additional review. The public privacy page returned HTTP
200. This is not a finding that the policy passed, and no compliance claim is made.

## Connection and remaining review work

The draft retains the stable public URL https://zodiacs.org/mcp with No Auth.
The public health endpoint and domain-challenge URL returned HTTP 404 during
this review. Production remains unmodified by this work.

The exact 43-byte domain challenge is now included at
`public/.well-known/openai-apps-challenge`, without an added newline. Its Vercel
route declares plain text and no caching. No existing challenge was overwritten.
This is a public domain-control proof, not an authentication credential; it stays
outside the plugin ZIP. After deployment, verify HTTP 200 and exact response
bytes before selecting Verify Domain. Tool discovery and automated tool findings
cannot be evaluated until the stable public server is reachable. The temporary
authenticated Watch host is not a substitute for this public URL.

The uploaded 0.3.3 walkthrough URL remains empty. Sky 0.3.4 is now prepared with
a 248-second actual native recording of all five positive and three negative
scenarios on the current private preview. Its extra Watch capability is clearly
outside public Sky scope. See [WALKTHROUGH.md](./WALKTHROUGH.md). The video URL
and exact public resource must be verified after deployment before this new ZIP
is uploaded; the historical rc.15 reel is not current evidence.

Status: **not submitted / not published**. Domain verification and tool scan are
incomplete. No policy attestations, paid upgrades, production activation or merge
were performed. Developer 0.3.2 remains a local stdio package; private Watch profiles
remain separate. Consenting human feedback for the 9/10 target is still absent.

## Verification

Sky 0.3.3 and Developer 0.3.2 package-contract and archive checks pass. The
runtime bundles are unchanged by the listing correction. The current branch
includes main a4903dd3, preserving the translated compatibility pages and the
sharp mobile homepage poster. Both branches patched the MCP test-client advisory;
this candidate retains the verified 2.3.1 client, its lock and regenerated daily
provenance. The Phase 1 source fingerprint and its reviewed captures are unchanged.

The newly published sharp advisory was resolved with sharp 0.35.5 / libvips 1.3.4
(librsvg 2.63.2). The production dependency audit reports zero vulnerabilities;
the full-tree high/critical gate passes, with two moderate Vitest development
findings still reported. See the [maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).

The final render-source capture [0a56bac0](https://github.com/zodiacs-org/site/commit/0a56bac0928b6dcdd2ea7eb308afc9cbd91d9fce)
passed the site build, all 18 captures, capture-receipt validation and visual
comparisons in [Browser Evidence 37507840107](https://github.com/zodiacs-org/site/actions/runs/37507840107).
All 19 capture files were imported unchanged after matching CI SHA-256 hashes;
the five local evidence tests pass. That run was cancelled during Lighthouse to
retrieve the new receipt, so it is not full browser acceptance. The final commit
still requires complete Site Check and Browser Evidence. Follow
[PR #618](https://github.com/zodiacs-org/site/pull/618) for their final result.

The newly listed MCP client advisory GHSA-6qxp-vccf-f47h was fixed by updating
the development test client to 2.3.1. Its stdio integration drive passed. Production
audit remains zero and the full high/critical gate passes; the two moderate
Vitest development findings remain. No client OAuth credentials were used.
