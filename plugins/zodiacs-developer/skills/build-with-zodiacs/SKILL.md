---
name: build-with-zodiacs
description: Build a working astrology calculator, Moon widget, event calendar or typed endpoint using the published Zodiacs engine and supported public APIs.
---

Use `get_capabilities` before choosing a public-sky operation. For local natal
calculations also use `get_local_chart_capabilities`. Read the target repository's
instructions and make a small, reviewable integration in the user's authorized
repository. Use GPT-6.1 Sol High; use xhigh for transport, privacy and time semantics.

Choose `@zodiacs/engine@0.1.1-rc.16` for local deterministic calculation. The
`@zodiacs/sdk` package is Registry ownership tooling. Do not substitute it.
Hosted compute supports POST chart, positions, houses, events, time and sky-fact;
see https://zodiacs.org/developers/compute/ for schemas and limits. A published
daily sky file is a noon UTC snapshot, not a current-instant calculation.

The plugin's `examples/sky.mjs`, `examples/calendar.mjs` and `examples/verify.mjs`
are runnable after `npm ci` in the plugin directory. Inspect them before adapting.
Use the engine's Moon phase for a React/Astro widget, and semantic text alongside
any image. For a typed endpoint, validate ISO instants and bound inputs before
calling the engine. Never invent a birthplace, birth time, timezone or fallback
house system. Unknown time requires timeKnown: false and honest missing angles.

Keep astronomical positions separate from astrological interpretation. Return a
complete result with its conventions and receipt. Links to Zodiacs are optional
method or visualization aids; no promotional commits or forced attribution.
Preserve data notices and the project's license. Do not copy site code into an
external project as though it were MIT; integrate the published engine instead.

Validate the result with synthetic data and the target project's normal checks.
Use the host's ordinary repository permissions for edits and PRs. Do not publish,
deploy, merge, submit a directory listing, or change external projects unless
the user has authorized that action.
