# Bounded integration review, 1 October 2026

At source head `18fdf260b843cae1395d6edaf8113980c57e351a`, before the later
owner-main merge, a separate reviewer inspected the actual station primitive diff, dated station,
bundle and composite decisions, the registry golden witness, and the composite
adapter against `ed55dacb` at this checkpoint. No blocker was found in that
bounded scope:

- Product-only longitude primitive shares the engine clock/frame, preserving
  the ±0.25-day derivative and scans; the lunation helper was already engine
  native, so removal of the obsolete delta-T side effect is appropriate
- Composite preserves the exact current-base adapter behavior
- Final allowance arithmetic adds only 1,022 B, preserves 250.4 B headroom,
  and leaves route caps unchanged
- The registry golden is an independently attributed 130 ms change in rounded
  generator output, without a tolerance or performance-budget waiver

This is not whole-PR approval, owner signoff, deployment or gate acceptance.
Final checks, source bindings and latest-main preservation remain required.
The earlier private-state and bundle reviews retain their separate scopes and
reproduction evidence in this directory.

The reviewer's supplied artifact is retained as
`bounded-decision-independent-review.md`. Later integration/build results
have separate source identities; this review is not relabelled as theirs.
