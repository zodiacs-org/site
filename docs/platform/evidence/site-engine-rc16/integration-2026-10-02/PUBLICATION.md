# rc.16 publication and evidence checkpoint — 2026-10-02

This dated record supersedes the missing-file condition of the earlier
partial carrier `16e8b52728ca1d10dcfd438a01ebec17402f89d2`. That carrier's
`PUBLICATION-STATUS.md` and `PUBLICATION-MISSING.json` remain unchanged
historical records; they do not describe the files present in the complete
October 2 integration.

## Immutable package

Engine version: `0.1.1-rc.16`. Original source:
`ddbbaa0b1d21e16834722f81e8708816849c6726`. Carried archive:
https://raw.githubusercontent.com/zodiacs-org/engine/ef44477f85f28a57d5ec7f61ed6ea6a99c4be563/artifacts/zodiacs-engine-0.1.1-rc.16.tgz

The archive is 266,934 bytes, SHA-256
`43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`.
All 69 installed package files match it. The already verified npm publication
is [release workflow 36858851623](https://github.com/zodiacs-org/engine/actions/runs/36858851623);
`next` is rc.16 and `latest` remains rc.15 at that verification checkpoint.
This evidence-link correction changes no archive, source identity or registry tag.

## Complete integration evidence is public

[PR620](https://github.com/zodiacs-org/site/pull/620) now contains the reviewed
integration on main `faf44b3519dbfc884bb8285577dacf13be1f4b4d`.
Its source commit `6a34a2f8b3b79b4f96cba0ebe6a96faceedb415a` has tree
`ac285c7a2acf35573e636a33077d1a64023ec322`, matching the reviewed local
integration. The previously omitted MCP example record is present at Git blob
`75bb8ec0088c8e07cbd05839249bf19feba4aa0a`; public full AI documentation is
present at `3393e042da0c466f9581fb66874916e0f66253e0`.

The [integration receipt](verification.json) separates preliminary and final
local checks. The [browser receipt](browser-verification.json) binds the
reviewed captures and two scoped Events baselines imported by
`a13562bd026c73866a7a0af50c13991bc5661f6f`. Their original comparison failure
and four existing Explorer failures remain recorded. All earlier numerical
measurements retain their original source identities; this record does not
relabel them as measurements of a later deployment.

## Limits and release state at this checkpoint

This record establishes publication of the complete reviewed source and
referenced evidence. It does not claim final exact-head CI, site deployment
or programme acceptance. Their subsequent outcomes belong to PR620 and the
separately recorded release verification. The engine retains known conformance
results of 267 passed, 192 failed and 41 unsupported. Product parity and finite
catalogue statistics do not certify broader astronomical accuracy. Composite
adoption remains deferred; no acceptance thresholds are changed.
