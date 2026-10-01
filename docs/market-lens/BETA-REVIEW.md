# Protected beta review

The patched Lens application is ready at
[the protected preview](https://zodiacs-org-git-codex-lens-preview-20261001-zodiacsofficial.vercel.app/terminal/lens/).
It uses application `e7cbc8d5`, which passes all 19 hosted CI jobs. Main's
subsequent consumer changes are integrated into the review branch; refresh
this preview from that integrated source and verify hosted acceptance before
inviting reviewers. See [OPERATIONS.md](OPERATIONS.md) for the current checkpoint.
Vercel Authentication requires an authorized reviewer. Prices remain disabled
while written display rights are unresolved. The calendar, private setup/risk
planner and journal can be reviewed now. No production release occurred.

Invite three to five traders through the owner's existing channel after
granting preview access. No invitations have been sent in this session.
Allow 15–20 minutes per reviewer and ask them to perform these tasks:

1. Open an existing own chart or a synthetic test chart. Find an upcoming
   personal contact and identify its entry, exact contact, exit and uncertainty.
2. Change calendar view, timezone and orb. Explain which items are personal,
   shared sky or economic releases, and inspect an unavailable/stale schedule.
3. Save a hypothetical cash spot setup with confirmation and invalidation;
   compare fees/slippage, cash cap and optional target, then revise the plan.
4. Record a journal hypothesis, reload, find the original and revision, and
   export a private backup. Test a conflicting edit in a second tab.
5. Inspect the optional traditional score and explain what it means. Confirm
   it provides no price probability or direction, then turn it off.

Collect completion, confusing wording, blocked steps, viewport/device and
whether the preparation fits their trading routine. Request reproduction
steps rather than birth data, private journal contents or trading-account
screenshots. The owner keeps feedback private. Fix blocked tasks before
expanding the group; review again after enabling a licensed price feed.

Automated local evidence is in revised-acceptance.json (30 Lens browser
checks), LAUNCH.md (17 native calculator checks) and the synthetic screenshots.
Actual hosted Lens API/browser acceptance still requires the secure
`VERCEL_AUTOMATION_BYPASS_SECRET` binding for this preview host; the current
cloud runtime receives an authentication redirect before reaching the app.
