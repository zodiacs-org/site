# Candidate locales: reading the Keyword Planner numbers

The five candidate files (`de.csv`, `pl.csv`, `tr.csv`, `ja.csv`, `hi.csv`) hold
296 queries each, phrased the way people search in each country. An
independent check of the wording (2026-11-09, by an AI pass, not a native
speaker) changed the rare or ambiguous forms. Some of these languages split
their demand across spellings that one list cannot hold, so add the variants
below in Keyword Planner and total them before comparing languages. Nothing
here is a volume: every number stays TBD until Keyword Planner returns it.

| Locale | Locations | Add these variants | Read the numbers with care because |
|---|---|---|---|
| de | Germany; Austria; Switzerland | "horoskop {sign} 2027" beside "jahreshoroskop {sign} 2027"; "{a} und {b} liebe" | Three countries together. The sign-meaning queries say "sternzeichen" first, because krebs, jungfrau and waage are everyday words |
| pl | Poland | "horoskop dzienny {sign}" beside "horoskop {sign} dzisiaj" | One country. The sign queries carry "znak zodiaku", because rak, lew, byk and ryby are everyday words |
| tr | Turkey | Every query again without Turkish letters (koc, boga, ikizler, yengec, aslan, basak, terazi, akrep, yay, oglak, kova, balik; "burcu" stays) | Many people type without ç, ğ, ı, ö, ş, ü, and Keyword Planner reports those spellings apart |
| ja | Japan | Every sign query again with the kanji names (牡羊座, 牡牛座, 双子座, 蟹座, 獅子座, 乙女座, 天秤座, 蠍座, 射手座, 山羊座, 水瓶座, 魚座); the generic "12星座占い" and "星座占い 今日" | Demand splits between kana and kanji spellings |
| hi | India | Romanized forms ("mesh rashifal", "aaj ka rashifal") | Hindi astrology is mostly sidereal (Vedic) and Moon-sign based, while the site is tropical and Sun-sign based, so a high volume overstates the audience the site serves. Romanized searches are missing from a Devanagari list, so the list also understates total demand. "कल" means both yesterday and tomorrow |
