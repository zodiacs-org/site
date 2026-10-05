# Consenting beta review kit

Refreshed 2026-10-05. The owner confirms there are no testers. No invitations
have been sent and no feedback is recorded.
Use only after exact-head CI, staging quota/capacity and retention gates pass.
The temporary staging share expires after 23 hours and is not a public launch URL.

## Panel and tasks

The proposed panel is six to ten adults, including at least three developers.
No participant has been recruited. Invitations require the owner's instruction.
Invite only people who explicitly agree to test and provide aggregate feedback.
Do not collect names, birth details, chart files or identifiable activity trails
in the review dataset. Keep any contact list outside this repository.

| Task | Useful outcome |
| --- | --- |
| General public sky | Current instant or bounded week, explicit UTC and display zone, receipt and coverage |
| Ambiguous sky claim | `depends` preserved and timezone ambiguity explained |
| Developer integration | Published engine dependency, local capability check, synthetic example, runnable tests |
| Native calendar | Open global/thread panels, change display zone, refuse an invalid zone and recover |
| Unsupported request | Clear limit or refusal without an invented calculation |

Ask each participant whether the answer completed their task, whether they would
use it again, and what caused confusion. Collect only aggregate counts by task,
coarse error categories and voluntarily reported second use. Separate generated
interpretation from astronomical facts and independently check unexpected outputs.

## Acceptance record

Record panel size, consent confirmed, task completion counts, aggregate usefulness,
second-use counts and unresolved bugs. Do not substitute the agent's synthetic
40-case evaluation or ChatGPT acceptance walkthrough for human usefulness evidence.
Public activation requires an explicit review of these observed results.

## Consent text for the owner to use

“You are invited to a voluntary review of an unpublished Zodiacs Sky or Zodiacs
Developer candidate. Use the supplied public-sky dates and synthetic chart only.
Do not enter your birth details, chart files, identity documents or other private
information. You can skip a task or stop at any time. We ask only whether each
task worked, whether it was useful and whether you would use it again.

“The assistant host receives prompts, tool arguments and results under its own
account/privacy terms. Hosted sky tools run on Zodiacs infrastructure; its
reviewed runtime metadata retention is thirty days. The service does not save
calculation requests/results and its quota stores bounded aggregate counters.
The local developer server calculates on your machine, while your assistant
provider can still receive its arguments/results. Temporary staging access
expires after 23 hours and should not be forwarded.

“Your contact details will remain outside the repository. The review record
contains task totals and coarse issue categories, with no names, participant
IDs, raw chats or personal chart data. Tell the organizer before aggregation if
you wish to withdraw feedback; a contribution cannot be identified after
aggregation. Participation is optional and creates no promise about personal
outcomes. Do you agree to this limited test and aggregate feedback?”

The owner records consent before giving access. Do not preselect or infer it.
Participants handle their own host sign-in and privacy settings. A participant
who declines is not asked to complete tasks.

## Task cards

1. Ask for positions at `2026-10-01T06:00:00Z` in Bangkok. Identify the UTC
   instant, display timezone, engine version and one method link.
2. Ask for lunations from October 1 to October 8, 2026. Explain the exclusive
   start and inclusive end. Open the native calendar, change display zone,
   try an invalid zone and return to UTC. Record completion separately for
   conversation output and native UI.
3. Ask whether the Sun entered Libra on September 23, 2026, first without a
   zone and then in Bangkok. Preserve `depends` and the UTC ingress evidence.
4. Request an eclipse search and a guaranteed personal outcome. A useful
   refusal should state the limit without inventing a calculation. Recover
   with a supported sky question.
5. Developers: build a Moon endpoint with the explicitly pinned published
   engine. Use a synthetic timestamp, reproduce its receipt, test malformed
   inputs and unknown-time semantics. Do not call the hosted compute API
   or publish a real person's chart.

The synthetic personal-week file remains an offline concept, not a shipped
personal tool or a participant task. Stagger testing within the global preview
40-request/10-event minute ceilings. A 429 is recorded as capacity refusal, not
an astronomical or UI error. Do not increase counters to hide it.

## Aggregate worksheet and proposed decision criteria

| Field | To be filled after a consenting test |
| --- | --- |
| Consented/completed panel totals | Not measured |
| Per-task attempted/completed/useful totals | Not measured |
| Conversation/native/developer totals | Not measured |
| Voluntarily reported second use within seven days | Not measured |
| Capacity refusals / calculation / UI / routing issues | Not measured |
| Open reproducible defects and fixes | Not measured |

Proposed criteria for owner review: at least six consenting completions, at
least three developer completions, at least 80% completion and usefulness on
each applicable supported task, correct ambiguity/refusal in every observed
case, and no unresolved privacy, accessibility or quota defect. At least half
the completing panel should voluntarily report a second use within seven days.
These are proposed small-panel decision rules, not validated product metrics.
Missing follow-up is recorded as missing rather than assumed repeat use.
The owner accepts or revises the criteria before recruitment and explicitly
reviews actual results before release.
