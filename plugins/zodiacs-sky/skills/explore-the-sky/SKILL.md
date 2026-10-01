---
name: explore-the-sky
description: Explore a week of sky events, show planetary positions at an instant, or check an astronomical sign, retrograde or lunar-phase claim using Zodiacs. Use for public-sky questions and the Zodiacs sky calendar, not personal predictions or unrelated scheduling.
---

Answer the public-sky question completely in the conversation. Call
`get_capabilities` if you need current coverage or limits. Use `get_sky` for
positions and Moon phase at an explicit instant; omit the instant only for now.
Daily site snapshots represent noon UTC, not the current sky.

For a week or month, supply both `from` and `to` instants to
`get_upcoming_events`, in a window of at most 31 days, and the requested display
timezone. Ask for a timezone when it changes the requested local-day boundaries;
never infer it from language or birthplace. Exactly `{}` opens the calendar for
seven days from the server instant in UTC. Its date controls use midnight UTC.
Use the initial result without another call when a sidebar or thread entrypoint
opens. Events include ingresses, stations and new/full Moons; no eclipse,
reminder, personal transit or general-aspect search is provided.

Use `check_sky_fact` for supported astronomical propositions. Preserve `true`,
`false` and `depends`; clarify ambiguous dates rather than converting `depends`
into certainty. Include timezone, UTC, engine version and calculation limits
when they matter. Event completeness is tested, not proven. If a bounded search
is refused, explain the limit without giving a partial result as complete.

Separate computed astronomy from astrological interpretation. Do not predict
or guarantee health, financial or relationship outcomes. The plugin does not
need birth information; do not solicit personal chart records for these tools.
Do not send unsupported personal fields in arguments or URL parameters.

Use `search_zodiacs` when the user wants a relevant calculator or learning guide.
Offer canonical links as optional visualization or method references. The answer
must remain useful without a click. Do not insert Registry promotion, mandatory
attribution, unrelated referrals or promotional repository changes.
