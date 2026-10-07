# Pinned HTTP cache policy security fix

This is a local, explicitly named fork of `http-cache-semantics` 4.2.0.
It is not a published or maintainer-approved upstream release.

- Advisory: https://github.com/advisories/GHSA-ch52-4w7c-c8xp (CVE-2026-93748).
- Upstream fix under review: https://github.com/kornelski/http-cache-semantics/pull/58.
- Source commit: `14a8c2ad51740dc39bf3e8f1a11c845a5003f217`.
- Original npm 4.2.0 `index.js` SHA-256: `01b7d66c854b2fe53ac05c98feb6e0d64722ab8898a778e2d2426a8b468d178f`.
- Patched `index.js` SHA-256: `fc7b3f0265b7a7d0fee83bafa47186a66495720d3179801c2be3083de6d0cf76`.
- The only source changes centralize response reuse restrictions and apply them before honoring client stale directives. Ordinary cache expiration and explicit public cookie opt-ins remain supported.
- Original BSD-2-Clause copyright/license is preserved in LICENSE.

Astro uses this dependency to calculate remote build-image cache lifetimes. The site does not use it as an account or user-response cache. The dependency audit still blocks vulnerable packages; there is no advisory suppression or relaxed severity. Behavioral regression tests prove that cookie/private/revalidation restrictions survive attacker-controlled max-stale values and serialized cache restoration, and preserve ordinary public caching.

Remove this override when a verified upstream fixed release is available. Until then this checked-in source needs explicit review for any upstream changes. Do not claim that npm audit independently verifies a local fork's security; its behavior and source hash are checked separately.
