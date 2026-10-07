---
name: test-astrology-integration
description: Add meaningful synthetic tests and CI checks for an astrology integration's versions, timezones, unknown time, receipts and computation bounds.
---

Read the repository's test conventions and existing checks. Choose tests for
observed risks, not assertions that repeat the implementation. Pin the accepted
engine version; compare against a separately accepted reference when accuracy
is the claim. Engine self-parity establishes adapter consistency only.

Use synthetic records. Cover UTC/offset equivalence, actual calendar validation,
DST folds/gaps, timezone-dependent dates, unknown birth time, polar house
refusals, requested versus used houses, engine-version drift, and bounded event
searches where those features apply. Preserve receipts and completeness flags.
Run the package's existing suite and report pre-existing failures separately.

For a remote boundary, test malformed and oversized bodies, disallowed origins
and hosts, strict schemas, budget exhaustion, disabled operation and limiter
failure. Use canaries to prove error bodies, application logs and URLs do not
repeat personal fields. Hosting-layer retention and real host behavior require
separate evidence; do not mark them passed from unit tests.

Run `npm test` in this plugin to exercise the published-engine recipes. Review
the privacy boundaries and time assumptions before finishing. Produce reviewable
changes in the authorized repository; no unsolicited contributions elsewhere.
