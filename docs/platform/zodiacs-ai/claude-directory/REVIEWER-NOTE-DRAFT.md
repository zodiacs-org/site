# Note to the directory reviewers: sent 14 November 2026

**Sent at 13:00 UTC on 14 November 2026 with Dias's yes, as a reply on ticket #145701231 from admin@zodiacs.org to mcp-review@anthropic.com, after the portal re-sync that day. What went out differs from the text below in three ways: the TO CONFIRM line became "We have re-synced the tools in the directory editor so your copy matches 0.6.7.", the sign-off was "Thank you, Dias, Zodiacs LLC", and the reply kept the thread's own subject instead of the Subject line below. Everything under this paragraph was written before sending and is kept as it was; see [LISTING.md](LISTING.md).**

Written 11 November 2026 and brought up to date on 13 November, after 0.6.7
went live. Nothing in this file has been sent, pasted into the
portal or shown to a reviewer. If Dias says yes, it goes from
admin@zodiacs.org as a reply on ticket #145701231 to
mcp-review@anthropic.com, the thread the earlier notes used, and the same
facts go into the listing's additional notes in the portal.

## Why one note

The records in [LISTING.md](LISTING.md) show that the reviewers hold several
messages that do not agree with each other or with the live server:

| Sent | Where | What it said that no longer holds |
| --- | --- | --- |
| 15 October | Email, first note | Zodiacs never chooses or ranks dates, scores relationships or predicts outcomes. Withdrawn the same day. |
| 15 October, 18:01 UTC | Email, correction | Share links carry first names. Since 0.6.1 no link carries a name. |
| 6 November | Email, reply | The thirteen reviewed tools are unchanged. 0.6.5 changed one the next day. |
| 7 November | Email, short note | Names 0.6.5 as the version. The server reported 0.6.6 from 7 November and has reported 0.6.7 since 13 November. |

The portal's additional notes, saved on 8 November, name 0.6.6. Whether they
also say links never carry names is not on record here, so read them in the
portal before sending. Either way the email thread stops at 0.6.5 and still
holds the 15 October sentence about first names. This note states the
current facts once and replaces all four email statements above.

## Finish these before sending

1. Both changes this note waited for landed on 13 November: the fix for
   love readings asked for someone under 18 (PR #970) and the plainer tool
   descriptions (PR #971). The live server reported 0.6.7 that day. Every
   tool's description changed, and so did the server's instructions, so the reviewers'
   copy of the tools needs a new sync in the portal before or with this note;
   ask for that sync in the same yes.
2. Check the live server on the day: `initialize` reports the version named
   here and `tools/list` gives the tool count named here.
3. Open the portal and read what the reviewer instructions, additional notes
   and description say now. There is no dated record of the 6 November reply
   or of the listing description after 28 October, so do not rely on memory
   of either.
4. Fill in the line marked TO CONFIRM.

## The note

> Subject: Re: Zodiacs connector (zodiacs.org/mcp): current version and behaviour, in one place
>
> Hello,
>
> This is one summary of the Zodiacs connector at https://zodiacs.org/mcp (slug zodiacs, ticket #145701231) as it is today. Please read it in place of our earlier notes of 15 October (both the first note and the correction sent at 18:01 UTC), 6 November and 7 November. Where any of those differs from this one, this one is right.
>
> Version and tools. The server reports version 0.6.7 and offers 19 tools. All are read-only and need no sign-in. Thirteen are the tools first reviewed; one of them, get_occasion_sky, changed in 0.6.5 and no longer offers the baby's arrival or coming-of-age occasions. The other six are get_natal_chart, get_horoscope_period, get_chinese_zodiac, get_personal_transits, explain_astrology and find_birthplace. In 0.6.7 every tool has a plainer description that says only what it does, what it fits and its limits, and the server's instructions were reworded; no name, input or annotation changed, and get_horoscope's panel moved to a new address. TO CONFIRM before sending: the date of the last sync in the directory editor.
>
> Children and teenagers. Zodiacs is not directed at children under 13. Any call that carries a birth date less than 13 years ago is refused before anything is calculated, and so is a birthday card for a day in those years. For anyone under 18, Zodiacs gives no romance, attraction or sexual framing: get_compatibility gives no reading when either person is under 18 and points to a friendship reading of the two Sun signs. Asked for a love reading with a birth date under 18, get_horoscope gives the general reading with a note saying why.
>
> Birth details and links. Zodiacs never stores or logs birth details. Links never carry a birth year, a birth time, a birthplace or the names you give. A birthday link carries only the month and day. This corrects our 15 October message, which said share links carry first names: they do not. A card link for a wedding or another day that is not a birthday carries that day's time, time zone and coordinates rounded to two decimals, as our privacy page says. Anonymous daily usage totals hold only the tool name, the day, the deployment and the assistant family.
>
> What Zodiacs will not do. It gives no betting tips, sports picks, investment timing, election forecasts or health predictions, and it guarantees no outcome. It does not schedule anything and gives no financial or medical advice.
>
> What it does give. Compatibility scores and date ratings out of 100, horoscopes and transit forecasts, each stated plainly as astrology's reading with its astrological reasons. Each forecast carries a label such as "Reading confidence 55%". The number says how specific the details were (a Sun sign alone, a date, or a date with a time and place). It is never the odds that an event happens.
>
> Privacy policy: https://zodiacs.org/privacy/
> Documentation: https://zodiacs.org/developers/ai/
>
> Thank you,
> Zodiacs LLC
> admin@zodiacs.org

## After sending

Add a dated entry to [LISTING.md](LISTING.md) with what was sent, where and
when, and update its "Where the listing stands" section. Delete this file or
mark it sent in the same change.
