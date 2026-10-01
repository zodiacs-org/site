# Actual ChatGPT synthetic review

Captured 2026-10-01 UTC / 2026-10-02 Asia/Bangkok using the signed-in ChatGPT web
host and native MCP app UI. All prompts concern synthetic public-sky data.
Screenshots exclude private chat sidebars and credential-bearing settings.

The initial review app used deployment `dpl_7VLS59tqyFxJ1RuUbazvHdgkyjaq`.
The refreshed final app uses `dpl_6tEgUKWfJngQpFtdZNdVxgHZmiE7` and verified the
corrected exclusive-start/inclusive-end date labels and timezone updates.

| Case | Observed result | Evidence |
| --- | --- | --- |
| Capabilities | Actual tool selection; engine rc.15, five operations and limitations | `01-capabilities` |
| Exact sky | October 1 06:00 UTC / 13:00 Bangkok, 12 bodies, receipt | `02-instant-sky` |
| Bounded lunations | Honest empty supported result, explicit interval, receipt | `03-lunar-window.txt` |
| Ambiguous ingress date | `depends` preserved; UTC ingress and local-date ambiguity explained | `04-date-ambiguity` |
| Consumer search | Canonical Moon sign URL | `05-calculator-search.txt` |
| Scheduling negative | Asked which meeting/time; no Zodiacs scheduling action claimed | `06-scheduling-negative.txt` |
| Investment negative | Refused astronomical investment prediction | `07-investment-negative.txt` |
| Relationship negative | Refused certainty/guarantee from astrology | `08-relationship-negative.txt` |
| Unsupported eclipses | Checked capabilities, explained unsupported kind without substituting | `09-unsupported-events.txt` |
| Global entry | Initial seven-day UTC native calendar; no manual date request | `native-global-calendar`, `final-native-global` |
| Thread entry | Native inline calendar from real model invocation, seven-day UTC | `native-thread-calendar` |
| Timezone update | Actual tool result and GMT+7 event display | `native-calendar-bangkok`, `final-native-bangkok` |
| Widget refusals | Invalid timezone and >31-day window clear stale results | `widget-invalid-zone.txt`, `widget-window-limit.txt` |
| Widget recovery | Correct America/New_York GMT−4 event display after refusals | `widget-recovery` |

The portable sky ZIP was imported separately; the web host lists it as
“desktop only.” The hosted MCP app is the actual web model/tool/widget test.
Native entry and rendering are observed. The final CSP-enforced thread displays
two opened calendars with server instants four seconds apart: the host requested
the result twice. The widget source calls computation only after form submission;
it has no automatic calculation fallback. Single model invocation is not
guaranteed and remains a host-routing limitation. The initial thread showed “CSP off.” Enforce CSP for custom apps was then
enabled in the host and left enabled. Final native rendering, timezone refusal
and recovery were tested under enforcement; `csp-enforced-*` records the retest.
This still does not certify platform directory approval.

`host-capture-walkthrough.mp4` is a 40-second labelled reel of eight actual UI
captures, combining the initial and corrected final review. It is explicitly a
selected-state capture reel, not continuous screen recording or a portal-approved
submission video. Its repository raw URL permits review without a host sign-in.

“Zodiacs Staging Verified” is the current patched connected app on deployment
`dpl_2QWjfr3xzkNp2qt4xFg3Lpz2JUrg` (source `a6947f71`). The `patched-native-global`,
`patched-widget-refusal` and `patched-widget-recovery` captures show actual
seven-day entry, stale-result clearing and New York recovery on that deployment.
An immediately issued credential following alias movement produced an installed,
Connected app whose real invocation failed Vercel authentication. A fresh
credential after alias propagation passed real invocation. Connected status alone
is insufficient. Temporary credentials expire after 23 hours and are not recorded.
Superseded test apps are uninstalled recoverably; preexisting user apps are retained.
