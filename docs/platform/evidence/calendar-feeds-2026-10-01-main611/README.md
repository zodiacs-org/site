# Calendar candidate merge of main #611, 1 October 2026

Merge `e9c6e1bfc2333442323e43d50790f2d840117ebc` incorporates main
`4e6005445e9ccf41cfccc1300a24d5533dc318e5` into the calendar candidate
`fa9e156671b6426ddc985dd036b862f71d55d2bc`. A read-only remote lookup
confirmed that exact main head before the merge. Nothing was published.

The owner's icon-only Guide and all 47 non-conflicting main paths are preserved
byte-for-byte, including generated pages and main's existing capture artifacts.
There were two conflicts:

- The calendar allowance remains limited to four translated privacy pages,
  re-pinned to the actual main commit. Main's completed Guide allowance is not
  carried forward as extra permission for the calendar change.
- Both branches independently corrected the same historical rc.15 browser
  binding to immutable rc.15 validation. The calendar row is retained: its
  binding equals main's, and it also explicitly lists that validation file as
  evidence. No claim, browser version or acceptance result is relabeled.

Calendar source and browser-driver/workflow changes are unchanged from the
previous reviewed candidate. Guide frontend work belongs to the owner’s separate
session: this programme adds no Guide browser-contract, focus-trap or Guide
driver repair. Any unrelated Guide CI failure must be reported separately.
Future compute integration remains limited to the API/engine/calendar scope.

Independent review verifies main preservation and the merge's parentage. The
focused merged-tree run passes 283 tests across 15 suites, including calendar
recovery, Guide, thesis, claims, scope guard and browser-evidence control.
The final sequential build and typecheck pass, with unchanged budgets and zero
type errors/warnings. The full suite passes 6,497 tests; the sole failing test
is the required stale capture check. `validation.json` records exact counts
and source hashes.

The merged source digest is
`5b439b798af466d2a52ce780ae41f72eb974412ecb40d6456628a7eb7909a4f7`.
The inherited main captures describe
`9bca416a1be803a78f73e16f74d6e5368aa27c7ff0f8228410e91d11c6dfb9a7`,
so they remain stale for this calendar tree. They have not been recaptured or
relabeled. Native browser execution remains unavailable in this executor;
use the existing supported CI routes after the final source/main integration.

The previous candidate records remain historical, unchanged evidence. This is
local preparation, not deployment or P1.15 acceptance. The release-day check,
SQL/browser CI, final captures and authorized production verification remain
as the calendar release runbook specifies. The programme figure stays 23%
(42.5 of 182.45), blocked 2% (4).
