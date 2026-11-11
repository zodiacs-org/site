# Note to the directory reviewers: draft

**Draft, not sent. Sending is the owner's decision.**

Written 11 November 2026. Nothing in this file has been sent, pasted into the
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
| 7 November | Email, short note | Names 0.6.5 as the version. The server has reported 0.6.6 since 7 November. |

The portal's additional notes, saved on 8 November, already name 0.6.6 and
say links never carry names. So the email thread stops at 0.6.5 and still
holds the 15 October sentence about first names, while the portal says the
opposite. This note states the current facts once and replaces all four
email statements above.

## Finish these before sending

1. Two changes are in separate pull requests and have not landed: a fix for
   love readings asked for someone under 18, and plainer tool descriptions.
   Finalise this note after both are merged and live. If the tool
   descriptions change, the reviewers' copy of the tools needs a new sync in
   the portal, and the note must say which definitions changed. If the
   reported version changes, replace 0.6.6 below.
2. Check the live server on the day: `initialize` reports the version named
   here and `tools/list` gives the tool count named here.
3. Open the portal and read what the reviewer instructions, additional notes
   and description say now. There is no dated record of the 6 November reply
   or of the listing description after 28 October, so do not rely on memory
   of either.
4. Fill in the two lines marked TO CONFIRM.

## The note

> Subject: Re: Zodiacs connector (zodiacs.org/mcp): current version and behaviour, in one place
>
> Hello,
>
> This is one summary of the Zodiacs connector at https://zodiacs.org/mcp (slug zodiacs, ticket #145701231) as it is today. Please read it in place of our earlier notes of 15 October (both the first note and the correction sent at 18:01 UTC), 6 November and 7 November. Where any of those differs from this one, this one is right.
>
> Version and tools. The server reports version 0.6.6 and offers 19 tools. All are read-only and need no sign-in. Thirteen are the tools first reviewed; one of them, get_occasion_sky, changed in 0.6.5 and no longer offers the baby's arrival or coming-of-age occasions. The other six are get_natal_chart, get_horoscope_period, get_chinese_zodiac, get_personal_transits, explain_astrology and find_birthplace. TO CONFIRM before sending: whether any tool description changed after this draft, and the date of the last sync in the directory editor.
>
> Children and teenagers. Zodiacs is not directed at children under 13. Any call that carries a birth date less than 13 years ago is refused before anything is calculated, and so is a birthday card for a day in those years. For anyone under 18, Zodiacs gives no romance, attraction or sexual framing: get_compatibility gives no reading when either person is under 18 and points to a friendship reading of the two Sun signs. TO CONFIRM before sending: that the fix for love readings under 18 is live.
>
> Birth details and links. Zodiacs never stores or logs birth details. Links never carry a birth year, a birth time, a birthplace or the names you give. A birthday link carries only the month and day. This corrects our 15 October message, which said share links carry first names: they do not. A card link for a wedding or another day that is not a birthday carries that day's time, time zone and coordinates rounded to two decimals, as our privacy page says. Anonymous daily usage totals hold only the tool name, the day and the assistant family.
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
