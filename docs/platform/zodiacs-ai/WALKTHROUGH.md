# Native ChatGPT walkthroughs

## 0.4.0 — 7 October 2026

Video: `public/assets/ai/review/zodiacs-sky-0.4.0.mp4`
SHA-256: `a271ce1ffb90372b343567dfe793f1fc74506bf58d8715826a45b967bd04bee6`

Recorded by Claude in ChatGPT on the web, in one conversation, on the
admin@zodiacs.org account (Bangkok time zone). The plugin was a private
test copy, “Zodiacs Preview” (`plugin_asdk_app_6ac6158f5c148191ae156fea7ebc9dac`),
connected to the protected 0.4.0 test server at commit `a6d24dc0`. It ran
runtime 0.4.0 and engine 0.1.1-rc.17. The test copy was attached with
“Try in chat” for the first message only. The other seven prompts relied
on ChatGPT keeping Zodiacs available in the conversation.

How it was made: real screenshots of the ChatGPT page, taken every one to
five seconds while each step ran. Each frame is held for 1.5–6 seconds,
and a title card plus one card per case are inserted. It is silent,
524 × 1088 (the browser panel's portrait size, ChatGPT's narrow web
layout), 2 min 44 s. Nothing on screen was edited. This is ChatGPT on
the web at a narrow width, not the ChatGPT phone app.

| Time | Case |
| --- | --- |
| 0:00 | title |
| 0:07 | sky calendar for this week, Bangkok times |
| 0:25 | Mercury retrograde and where it is |
| 0:39 | what Zodiacs can check; Libra ingress depends on the time zone |
| 0:58 | Leo horoscope, then Love, This week, and Change sign to Virgo |
| 1:31 | Chart Studio opens on birth details; unknown birth time path |
| 2:03 | declines: calendar change |
| 2:13 | declines: stock pick |
| 2:26 | declines: guaranteed relationship outcome |

What it shows:

- All five handled cases called Zodiacs. The calendar, horoscope and Chart
  Studio panels rendered inside ChatGPT, with times and dates for Bangkok.
- Signs switched inside the horoscope panel and stayed switched. This
  failed earlier the same day and was fixed in `34f45d8e`.
- None of the three declined requests called Zodiacs; in each, ChatGPT
  said what Zodiacs can't do. An earlier run, before `2b357c44`, showed the
  horoscope sign picker for the relationship prompt.
- Chart Studio's chart header still shows `1992-03-14 · 12:00 UTC` (the
  made-up date), not a plain date.

## 0.3.4 — 6 October 2026

The 0.3.4 recording is actual browser capture from a fresh synthetic ChatGPT conversation. It is silent, 1280 × 720, 248.07 seconds, with inactive gaps between segments trimmed. Individual segments preserve captured frame timing (maximum two-second frame interval); the final frame of each segment is held for two seconds. No UI output was fabricated.

The recording uses **Zodiacs Sky Watch Preview**, runtime **0.3.0**, engine **0.1.1-rc.17**. The preview exposes additional Watch capabilities. These are excluded from the public Sky package. No subscriptions, other apps, real birth records or calendar writes were used. This proves the observed private-host flow, not public-domain connection, public scan approval, delivery of Watch events or human usefulness. The stable public endpoint and its exact Studio resource still need release acceptance.

Video: `public/assets/ai/review/zodiacs-sky-0.3.4.mp4`
SHA-256: `fb5bf969612b325a69d38b4ae4d392a0ff4183a531b2c1d938deb13fdbaa7a13`

## Observed cases

- Studio opens with synthetic data; Placidus/whole-sign comparison changes houses while preserving positions.
- Synthetic 2026-11-01 01:30 America/New_York input presents the DST fold. Earlier occurrence gives 2026-11-01T05:30:00.000Z.
- Calculation record copy fallback exposes the complete local JSON. Manual copy matched the 5,628-byte visible record; prior clipboard contents were restored.
- Sharing requires a review and explicit Share these facts action. The assistant received Sun longitude 218.8058294789911° and engine rc.17. It correctly said the exact timestamp was absent from the minimized selection rather than inferring it.
- Capabilities and 2026-10-01T06:00:00Z sky calculation return rc.17, 13:00 Asia/Bangkok and a receipt. The private profile additionally names Watch; public acceptance must confirm exactly six tools.
- The October 1–8 UTC lunation search returns an honest empty window, New York boundary times and the calendar.
- The Libra ingress claim without a timezone returns depends and 2026-09-23T00:05:45.548Z, with September 22 in New York.
- Calculator search returns https://zodiacs.org/moon-sign/ without personal query data.
- All three negative cases decline the unsupported calendar write, astrology-based stock selection and guaranteed relationship outcome. No tools or other apps were invoked for those responses.

## Chapters

| Time | Recorded interaction |
| --- | --- |
| 0:00 | open studio |
| 0:20 | studio render |
| 0:34 | house comparison |
| 0:42 | input review |
| 0:50 | synthetic local input |
| 1:00 | local time review |
| 1:09 | apply reviewed time |
| 1:16 | calculation record |
| 1:25 | copy record recovery |
| 1:33 | manual record copy |
| 1:42 | review selected facts |
| 1:51 | explicit share |
| 1:59 | shared facts response |
| 2:14 | capabilities and sky |
| 2:30 | moon event window |
| 2:45 | timezone sensitive fact |
| 3:00 | canonical calculator search |
| 3:15 | unsupported calendar write |
| 3:31 | no stock predictions |
| 3:46 | no relationship guarantees |
| 4:00 | final result |
