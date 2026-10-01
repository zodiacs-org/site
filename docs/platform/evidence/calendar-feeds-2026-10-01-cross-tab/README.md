# Calendar feed cross-tab erasure follow-up, 1 October 2026

This follows the local candidate at `e3d1cd97454abf7450ee7fbdcf29f0e9fbed1fd1`.
The earlier [candidate evidence](../calendar-feeds-2026-10-01/README.md) is
preserved unchanged. This record does not claim deployment, acceptance of
P1.15, or completed browser/SQL gates.

Source checkpoint: `339ecfc42c92e372f101289a6049370a16879f24`.

## Defect and unchanged erasure contract

The previous candidate fenced successful clear-all only within one Document.
A POST already in flight in a second same-origin tab could restore its removal
key after the first tab cleared site data. Listening to storage events alone
would not fix delayed, suspended or unmounted readers. Comparing the existing
nullable profile-revocation token also has an absent → token → absent ambiguity:
clear-all removes that token.

The clear-all invariant remains “removes every Zodiacs-owned local/session
key” in `src/lib/account-v2/profile-boundary.ts`. The account panel still says
that clear-all deletes this browser's calendar removal keys. This change adds
no retained post-clear calendar marker and changes neither that function nor
its caller's contract. The existing Living Chart deletion retry marker is
unrelated and unchanged.

## Removable fence and local commit ordering

An explicit subscription can establish a random, content-free value under
`zodiacs.calendar-feeds.fence.v1`. It is not a chart digest, feed identifier,
removal key, timestamp or account identifier. Merely mounting or reading a
calendar view cannot create it. Ordinary clear-all removes it with every other
calendar-owned local key.

Both establishment and final local persistence acquire the existing profile
shared Web Lock, plus a calendar-specific exclusive lock to serialize two
calendar tabs' read/modify/write operations. Clear-all uses the profile
exclusive lock through its existing coordinator. The final commit rereads and
compares the non-null starting fence while holding those locks. A missing or
freshly replaced fence invalidates the old result; it cannot equal the new
random value merely because storage was briefly empty. No network request
holds these locks.

If the request cannot establish a fence, it can retain a returned removal key
in the current document's existing volatile recovery list, but that request
can never upgrade to persistence when storage recovers. Failed final reads or
unavailable locks also prohibit persistence. The session notices a changed
known fence on reads, notifications and page resume, without recreating it.
A canceled operation that knew an earlier fence does not create a replacement.

The ordering boundary is established preflight before POST, not the instant of
the button click: a never-fenced request queued behind an already-held clear
lock sends nothing before erasure. It may establish its new fence and send a
new POST after the clear lock is released. The pending-pre-clear-POST controls
wait until the POST has actually begun.

## Verification scope and limits

Five original cross-document negative controls fail on the previous candidate.
The 17 new deterministic tests use separately activated Documents sharing storage
and an ordered lock manager; signals can be withheld or delivered later. They
cover missed delivery, random-fence replacement, offline and unmounted readers,
BFCache resume, storage refusal, concurrent subscriptions and exact lock
ordering. Existing real-client hook remount tests remain in the affected gate.

`tests/calendar-feed-cross-tab-drive.mjs` independently bundles the production
client, clear-all function and profile coordinator without source overrides.
It uses two real same-origin browser documents, native Storage and native Web
Locks. Only synthetic POST settlement and explicit storage/event faults are
controlled. Eight cases cover delivered/missed events, offline unmount/remount,
fence replacement, storage recovery without persistence upgrade, denied final
reads, a response blocked by the actual exclusive lock, independent concurrent
subscriptions, and fresh preflight after clear. The receipt records every
source-input hash, bundle hash, browser, exact Git head and outcome; external
requests are blocked and asserted absent.

The native drive is wired into Site Check and the head-bound Browser Evidence
compare workflow, with outcome/provenance and artifact collection. The existing
full `tests/transit-ring-drive.mjs` UI drive is now a separate required step in
both routes as well. Independent AST review confirms its saved-chart fixture
and all 27 check calls are unchanged. The runner now uses the shared Chromium
discovery and preview-readiness/cleanup helpers, checks the current build receipt
and its intended account-v2 flag-off configuration, and emits a head/source/build
receipt plus screenshots. Screenshot failure now fails the drive instead of
being silently ignored. Locally,
only its syntax and source bundling are checked: this executor's browser
socket restriction still prevents native execution. CI must run it on the
final release head; no browser pass is claimed here.

A wholly storage-inaccessible document that never established or observed a
shared fence cannot prove that another tab cleared its already-volatile
memory if all signals are missed. Those keys remain memory-only until that
Document is left. They never become persistent through storage recovery.
This record proves no all-tab volatile-memory erasure guarantee.

## Local gate at the source checkpoint

Node 22.22.2 is used throughout. The full sequential build and typecheck pass:
4,343 generated pages, 4,446 checked HTML files, all unchanged bundle budgets,
and 1,183 typechecked files with zero errors, zero warnings and 18 hints.
The calendar UI driver’s `--check-build` validates the exact current build
receipt and intended flag-off configuration; it does not run Chromium.

The focused source run passes 209 tests in 12 files. Independent review
reruns 112 tests in six suites and finds no blocker in the source; separate
AST review confirms the full UI fixture and all 27 assertions are unchanged.
The final full suite passes 6,497 tests (508 files), with four skipped tests
and only the required stale Phase 1 capture test failing. Claims inventory
has zero unlisted sentences and zero orphans; the four-page protected-scope
guard and programme ledger validation pass. The ledger remains 23%
(42.5 of 182.45), blocked 2% (4), with no acceptance/status change.
`validation.json` records exact counts, scope and old/new source hashes.

The metadata-only local Vercel CLI build also exits successfully. The packaged
calendar import runs with module-syntax detection disabled, checks three
method guards and produces twelve synthetic events with zero fetch attempts.
Its entry hash is byte-identical to the prior candidate. The CLI still emits
its pre-existing import/type diagnostics and a failed npm metadata lookup;
the separate clean typecheck remains the type gate. `packaged-calendar.json`
records the runtime check, not live credentials or a database operation.

## Remaining release sequence

The final compute checkpoint must still be merged from updated main, with the
scope allowance re-pinned. Confirm the actual UTC deployment day; re-date the
legacy 60-day window and all bound privacy/sitemap dates if it slips. Rebuild
and retake Phase 1 captures only after the last source change and main merge.

The PostgreSQL 17 Calendar feed SQL job, native browser drive and existing
full calendar UI drive remain required on the release candidate. The latter
is the separate `tests/transit-ring-drive.mjs` CI step; it is not implicitly
covered by the protocol fixture. Required CI, authorized production migration/deployment, manual
sweep, synthetic CDN/removal and rate-limit checks, and redacted log review
remain as the earlier runbook specifies. Live feed addresses and removal keys
must not be committed or included in public reports.
