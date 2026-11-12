# Sources opened for ZOD-151

Every technique claim in `01-life-chapters-meanings.md` points to a passage
id below (V1 to V24 for Valens, L1 and L2 for Lilly). Quotations are copied
from the files named here. Riley prints his own insertions in angle brackets;
they are shown here in square brackets so that Markdown does not swallow them.
Where a quotation skips words, the gap is marked with three dots.

Nothing here comes from a modern calculator, and nothing comes from the
made-up sample readings on ZOD-60 and ZOD-61.

## What was opened, and what could not be

| Source | Address | Result |
|---|---|---|
| Valens, Book IV, the page linked on ZOD-60 | `https://www.astrologicon.org/vettius-valens/vettius-valens-anthology-4.html` | **Not readable.** Two tries on 2026-11-11 at about 18:56 UTC (a plain download and a page reader) both returned HTTP 200 with a bot check and no book text: "One moment, please... Please wait while your request is being verified...". The Wayback Machine holds no copy of that page. The bot check was left alone. |
| Valens, *Anthologies*, complete, translated by Mark Riley (the translator's own PDF, 2011) | `https://www.csus.edu/indiv/r/rileymt/Vettius%20Valens%20entire.pdf`, read from the Wayback Machine copy of 2025-12-11: `http://web.archive.org/web/20251211055454/https://www.csus.edu/indiv/r/rileymt/Vettius%20Valens%20entire.pdf` | **Opened.** The live university address now returns 404, so the archived copy was used. 2,687,127 bytes, SHA-256 `0581d4cd17ff899becf1915aef3c01a9c2c35a0b2abb1bbcadd9e3f310e40b9c`. PDF metadata: author "Mark Riley", created 2011-01-04. Text taken out with `pdftotext -layout`. Dias approved working from this archived copy on 2026-11-12. |
| Lilly, ch. XIX, as linked on ZOD-61 | `https://neonvagabond.xyz/mirrors/sacred-texts/astro/aia/aia22.htm` | **Opened** 2026-11-11 about 18:56 UTC. SHA-256 `bff433b77f7a6a01556351d34a19132011ee5f80a3dee3826209640999db042f`. |
| Lilly, ch. XXXIII, as linked on ZOD-61 | `https://neonvagabond.xyz/mirrors/sacred-texts/astro/aia/aia36.htm` | **Opened** at the same time. SHA-256 `30e1d5ef8765e5863dbae53f1f756cfc712ea4dd3dab562c7abbff5e98e3d7b4`. |
| Linear ZOD-60, ZOD-61, ZOD-59, ZOD-62, ZOD-46 | Linear | Read in full on 2026-11-11. Used for scope and house rules only, never for technique facts. |
| Site `AGENTS.md`, `CLAUDE.md`, `src/ai-tools/reading-confidence.ts` | this branch | Read for the copy rules, the under-13 and under-18 rules and the confidence label. |

The Riley PDF is the translator's copyrighted work, so it is not committed.
Only short quotations are. The page numbers below are the PDF's own printed
page numbers. The `/160K/` and `/152P/` marks are Riley's references to the
Kroll and Pingree editions of the Greek.

One thing to know about the two Valens addresses: ZOD-60 cites "Book IV ch. 4
and ch. 6 (Riley translation)". In the PDF opened here, Book IV chapter 4 is
the method itself and chapter 6 is the list of years per sign, so the chapter
numbers agree with the ticket. Whether the web page's wording matches the PDF
word for word could not be checked.

The Lilly pages are a mirror of sacred-texts.com. The page title is
"Introduction to Astrology", which is Zadkiel's edition of Lilly's
*Christian Astrology*, the edition ZOD-61 names.

## Valens passages

### Book IV: the method

**V1. IV.4, opening (p. 71, /160K/).** Chapter title: "4. The Distribution of
the Chronocratorships Starting with the Lot of Fortune and with Daimon."

"I will now append this truly powerful method: to begin the vital sector with the Lot of Fortune and with Daimon (which signify the moon and the sun)."

"The sun is the cosmic mind and divinity. It arouses men’s souls to action through its own energy and love-inspiring nature, and it becomes the cause of employment and progress."

**V2. IV.4, Fortune is for the body (pp. 71 to 72, /152P/).**

"So, if we are investigating the chronocratorships with respect to bodily existence, such as critical points of illnesses, hemorrhages, falls, injuries, diseases, and whatever affects the body with respect to strength, enjoyment, pleasure, beauty, or love affairs, then we must begin the vital sector with the Lot of Fortune."

**V3. IV.4, Daimon is for work (p. 72).**

"If on the other hand we are investigating employment or rank, then we will begin the chronocratorships with Daimon as the apheta. We will make our determination according to the benefics or malefics in conjunction or aspect with it."

**V4. IV.4, one Lot stands in for the other (p. 72).**

"Note that if the Lot of Fortune or its ruler are badly situated, the Lot of Daimon will distribute both the bodily and the active qualities. Likewise Fortune will make the distribution of both qualities if the Lot of Daimon or its ruler is unfavorably situated"

**V5. IV.4, both Lots in one sign (p. 72).**

"Whenever Daimon and Fortune are found in the same sign, we will derive forecasts of bodily constitution from that very sign, but the forecasts of activity from the sign immediately following."

**V6. IV.4, men, women and infants (p. 72, /153P/).**

"In addition, for male nativities, the vital sector is usually found to begin at Daimon"

"Similarly for infant nativities it is necessary to begin the vital sector with the Lot of Fortune until [the time when] the nativity can show evidence for its full development or its occupation."

"The active and intellectual qualities come into play later."

**V7. IV.4, the worked pattern: years to the chapter, months to the signs inside it (p. 72).**

"For example: assume that the Lot of Fortune or Daimon is located in Aries. The overall houseruler [of Aries] is Mars."

"Mars itself allots 15 years first, and from this period it assigns itself 15 months. Next (because of Taurus) it assigns 8 months to Venus, next (because of Gemini) 20 months to Mercury, next (because of Cancer) 25 months to the moon, next (because of Leo) 19 months to the sun, next 20 months to Mercury, next 8 months to Venus, next (because of Scorpio) Mars assigns itself 15, next (because of Sagittarius) 12 to Jupiter, next (because of Capricorn) 2 years 3 months to Saturn. Next it assigns to Aquarius the remaining 11 months to fill out the 15 years. Now Venus receives from Mars the overall chronocratorship for 8 years and assigns years to each sign as described."

"Because of Gemini, Mercury receives 20 years after Venus and assigns the years to each sign. Next is the moon with its 25 years, then the sun with its 19."

**V8. IV.4, the jump to the opposite sign (p. 72).**

"Now since the circle of the 12 signs has comprised 17 years 7 months, we will allot the remaining time using the signs in opposition: since Gemini allots 20 years, if the vital sector begins there and if 17 years 7 months have been assigned, the remaining 2 years 5 months are allotted beginning with Sagittarius, giving Sagittarius itself 1 year [=12 months], the rest to Capricorn to complete the 20 years. In a similar manner, if we find the vital sector beginning with Cancer, Leo, Virgo, Capricorn, or Aquarius, after allotting the 17 years 7 months (not counting the intercalary days), we will allot the rest in order, beginning with the sign in opposition."

**V9. IV.4, the other opinion, which Valens rejects (pp. 72 to 73).**

"Some astrologers allot the remaining chronocratorships beginning with the sign in trine, but this does not seem scientific to me."

"As a consequence I believe we should use the method described above for making connections."

**V10. IV.5, what the jump brings (p. 73, /155P/, /164K/).** Chapter title:
"5. Making Connections. The Mutual Transmissions of the Stars." The chapter
ends in Riley with three dots, so it may be incomplete.

"The connections made will have differing effects because of the nature of the stars: the sun and moon when transmitting to Saturn are indicative of setbacks and anxieties, and they bring hostility from the great"

"all this unless a benefic in conjunction or aspect weakens the onset of the crisis."

"Mercury when transmitting the chronocratorship to Jupiter from Virgo or Gemini brings changes in business and innovations in activities. If the places or Mercury itself are afflicted at the nativity, and if the overall chronocratorship is contrary, the connection which is made will turn affairs to the better and will be indicative of employment. On the other hand, if the places are protected by benefics and are bringing a good chronocratorship, after [one] cycle the connection which is made will be disturbing and harmful."

"Saturn making the connection from Capricorn and Aquarius to Leo and Cancer indicates that the chronocratorship will be vigorous: it brings matters from darkness into the light"

**V11. IV.6, the two signs of Saturn (p. 73).** Chapter title: "6. How Many
Years Each Sign Allots. The Maximum Years of Each Star."

"Aquarius allots 30 years, Capricorn 27."

**V12. IV.7, the strongest places (pp. 74 to 75, /158P/).**

"If the distribution goes from Daimon to MC (MC relative to the Lot of Fortune) or to the Lot itself, and if the ruler [of Daimon] is there, with benefics, the sun, or the moon in aspect, and if the basis of the nativity is full of glory, the native will come to power and great rank, and will be distinguished, ruling, and prominent in those chronocratorships."

"A distribution which comes at the Ascendant, at MC, or at the other angles forecasts high rank, but not to the same extent, because the places square with the Lots are most efficacious."

"If the transmissions occur as specified, and if the basis of the nativity is found to be average, the native will be involved in occupations and profits; he will be a friend of great men"

"If malefics are in aspect, the influence of the places will be visible in the manner just described, but because of the malefics in aspect, the native will meet with reverses and penalties"

**V13. IV.7, the four kinds of sign when a work period is under strain (p. 74, /166K/).**

"If a star which is controlling the chronocratorship [of the matters] governed by Daimon [=occupation] is not at an angle and has a malefic in conjunction or in aspect with the houseruler of its sign, the native will act ineffectively"

"If the star controlling such a chronocratorship is found in a fiery sign with malefics in conjunction or in aspect, he will suffer a great nervous breakdown, and will act against his own will"

"If the star is in an airy sign or if the sign or its ruler are afflicted, the native will be distracted and troubled, and will suppose that he is accomplishing something other than what he really is. If the star is in an earthy sign, he will bear the blows of fortune nobly, and will survive most things philosophically because of his endurance. If the star is in a watery sign, the native will have a mind which can be easily reassured, will come into vicissitudes in many affairs, but will manage to succeed and be successful in his dealings."

**V14. IV.7, a period is read against the whole chart (p. 74).**

"It is necessary to take into consideration the activities and the basic character of the nativity (noble, average, fortunate, poverty-stricken, disputed, subject to ups and downs) so that the results of the allotments may be quite obvious."

"In many cases predictions about specific activities are to be derived from Daimon and its houseruler."

**V15. IV.8, Valens's own example of work periods counted from Daimon (p. 75).**

"Now I considered the chronocratorships for occupations, beginning with Scorpio [=Daimon], giving Mars (which was in Scorpio) 15 years, then Sagittarius 12 years, with Saturn in that sign."

"Next Capricorn received the distribution of 27 years; Jupiter was there"

"During this entire chronocratorship he had great success and was entrusted with public and royal affairs."

**V16. IV.9, the year of the method has 360 days (p. 75).**

"Since the universal year has 365 1/4 days, while the year with respect to the distribution has 360, we subtract the 5 intercalary days and the one-fourth of a day, then we find the number of years."

**V17. IV.10, four levels, each a twelfth of the one above (p. 76, /170K/).**

"By taking one-twelfth of the year (or of each period) we can discover how many days each star/sign allots. For example: Aries allots 15 years. One-twelfth of 15 years is 15 months. Next one-twelfth of 15 months is 37 1/2 days. Next one-twelfth of 37 1/2 days is 3 1/3 hours."

"If anyone uses this system, he will find the overall, the yearly, and the monthly chronocrators, as well as the daily and hourly chronocrators."

Riley's table in the same chapter gives, in years, months, days, and days
with hours: Sun 19, 19, 47 1/2, 3 days 23 hours. Moon 25, 25, 62 1/2, 5 days
5 hours. Saturn 30, 30, 75, 6 days 6 hours. Capricorn 27, 27, 67 1/2, 5 days
15 hours. Jupiter 12, 12, 30, 2 days 12 hours. Mars 15, 15, 37 1/2, 3 days
3 hours. Venus 8, 8, 20, 1 day 16 hours. Mercury 20, 20, 50, 4 days 4 hours.

"If we find a nativity it its 50th or 60th year, we begin the zodiacal vital sector of years from the Lot of Fortune or from Daimon, assigning to each star its period as far as it applies. Then we assign the months, then the day and hours."

(The "it its" is the PDF's own typing.)

### Books I to III: the Lots, the rising degree, the planets and the signs

**V18. II.3 and III.14K;11P, the Lot of Fortune is counted from the rising degree (pp. 26 and 68).**

II.3: "it will be necessary (for day nativities) to count accurately the distance from the sun to the moon, then to measure off in the opposite direction an equal distance from the Ascendant"

III.14K;11P: "There are a variety of opinions about this notion. To me it seems best to locate the Lot by determining the distance from the sun to the moon, then counting that distance from the Ascendant"

**V19. II.22K;23P, the Lot of Daimon, with day and night births the other way round (p. 38, /84P/).**

"So it will be necessary to calculate the effects of the Lot of Daimon in the same way we described for the Lot [of Fortune]. For day births, this Lot is found by determining the distance from the moon to the sun (for night births, from the sun to the moon), then counting this distance from the Ascendant."

**V20. II.19K;20P, what each Lot is about (p. 35, /81K/).**

"The former gives information about matters concerning the body and concerning the work of hands. Daimon and its ruler give information about spiritual and intellectual matters and about the activities of giving and receiving."

**V21. I.4, the rising sign depends on the hour (p. 8).**

"If the birth was in the day, either Pisces or Taurus or Cancer must be the Ascendant. If the birth was at night, one of the diametrically opposite signs [must be]. Virgo would be in the Ascendant in the first hour [of the night]."

**V22. I.7K;6P, how fast a sign rises (p. 10).**

"Aries rises in 20 [equatorial times]; now an hour has 15 equatorial times."

"Therefore Aries will rise in 1 1/3 hour."

**V23. I.1, the planets that rule the signs (pp. 1 to 2).**

Sun: "public reputation, action, authority over the masses"

Moon: "housekeeping, the queen, the mistress of the house, possessions, fortune, the city, the assembly of the people, gains, expenses, the household, voyages, travel and wanderings"

Saturn: "It puts into one’s hands great ranks and distinguished positions, supervisions, management of others’ property"

Jupiter: "friendships with great men, prosperity, salaries, great gifts, an abundance of crops, justice, offices, officeholding, ranks"

Mars: "Mars causes commands, campaigns and leadership"; "actions involving fire or iron, craftwork, masonry"

Venus: "friendship, companionship, the acquisition of property, the purchase of ornaments, agreements on favorable terms"; "craftsmanship or trade"

Mercury: "Mercury indicates education, letters, disputation, reasoning, brotherhood, interpretation, embassies, number, accounts, geometry, markets, youth, games, theft, association, communication, service"

All seven: "Saturn the ruler of ignorance and necessity, Jupiter the ruler of rank, crowns and zeal. Mars becomes the ruler of action and effort, Venus the ruler of love, desire, and beauty, Mercury the ruler of law, friendship, and trust."

**V24. I.2, the twelve signs (pp. 2 to 6).** Chapter title: "2. The Nature of
the Twelve Zodiacal Signs." Valens describes each sign and the people born
under it. He also says how to read these lists:

"In general, whatever the houseruler usually produces according to its own nature, whether good or bad, greater or lesser, this it produces in each of the signs according to the operative or inoperative configuration of the houseruler."

Aries: "Aries is the house of Mars, a masculine sign, tropic, terrestrial, governing, fiery, free, upward-trending, semi-vocal, noble, changeable, procuratorial, public, civic, with few offspring, servile, the Midheaven of the universe and the cause of rank"; "bold in thought, boastful, great-hearted, restless, unstable, haughty, inflated, intimidating, quickly changing"

Taurus: "This sign is productive of order, earthy, rustic, related to farming, a freedman, downward-trending, with few offspring, semi-vocal and mute, noble, invariable, energetic, unfinished"; "Men born under this sign are noble, energetic, toilsome, good at keeping things, pleasure-loving, music-loving, generous."

Gemini: "Gemini is male, bicorporeal, articulate, the house of Mercury"; "Under it are born scholars, those working in education and letters, poets"; "also translators, merchants, judges of good and evil, sensible people"

Cancer: "It is the house of the moon, feminine, solstitial, the Ascendant to the universe"; "changeable, public, popular, civic, prolific, amphibious. Men born under this sign are ambitious, popular, constantly changing, theatrical, cheerful, easily downcast, pleasure-loving, party-giving, public."; "not sticking to one activity or (at the most) two, they become wanderers and travelers."

Leo: "Leo is masculine, the house of the sun, free, fiery, temperate, intellectual, kingly, stable, noble, upward-trending, changeable, solid, governing, civic, imperious, irascible"; "distinguished, noble, steady, just, haters of evil, independent, haters of flattery, beneficent"

Virgo: "Virgo is the house of Mercury, feminine, winged, anthropomorphic"; "earthy, common, semi-vocal or mute, concerned with the body, incomplete, changeable, industrious, two-natured. Men born under this sign are noble, modest, religious, burdened with care, leading a quite varied life, administrators of others’ goods, trusted, good stewards, secretaries, accountants"

Libra: "Libra is the house of Venus, masculine, equinoctial, anthropomorphic, upward-trending, airy"; "the supervisor of crops, vineyards, olive groves, aromatics, homesteads, measures, and artisans. Men born under this sign are noble and just"; "living through ups and downs of fortune, being in charge of measures, posts, and the grain supply"

Scorpio: "Scorpio is the house of Mars, feminine, solid, rainy, fecund, destructive, downward-trending, mute, servile, unchangeable"

Sagittarius: "Sagittarius is the house of Jupiter, masculine, fiery, upward-trending, vocal"; "governing, kingly. Men born under this sign are noble, just, great-hearted, judges, generous, loving their brothers and their friends. They lose much of their original possessions but gain them back. They are superior to their enemies, seek a noble reputation, are benefactors, prominent"

Capricorn: "Capricorn is the house of Saturn, feminine, tropic, earthy"; "indicative of misfortune and toil, a sculptor, a farmer."; "They are toilsome, burdened with care, insomniac, fond of jokes, plotters of great deeds"

Aquarius: "Aquarius is the celestial sign which is masculine, solid, anthropomorphic, somewhat damp, single."; "free, upward-trending, feminizing, unchanging, base, with few offspring, the cause of troubles arising from athletic training, carrying burdens, or work in hard materials, an artisan, public."; "self-willed"

Pisces: "It is moist, downward-trending, servile, changeable, with many offspring, bicorporeal, sociable/lewd, with some limbs missing, the cause of wandering, varied. Men born under this sign are unsteady, unreliable, changing from bad fortune to good"; "in conflict with itself because one Fish is northern, the other southern"

The element of each sign comes from the same chapter and from IV.4
(p. 73, "Leo, the fiery sign", "Aquarius, the airy sign", "Cancer, a moist
sign, and Capricorn, an earthy sign", "Virgo, an earthy sign, and Pisces",
and "the signs trine with these are of the same nature").

## Words that are NOT in the Riley text

These were searched for across the whole extracted text (10,323 lines) and
not found. They matter because ZOD-60 uses them.

| Phrase | Result | What Riley has instead |
|---|---|---|
| "loosing of the bond" (also "loosing", "loose the bond") | 0 matches | "making the connection", "the connection which is made", chapter title "Making Connections" (V9, V10) |
| "Lot of Spirit" | 0 matches | "Daimon", "the Lot of Daimon" (V1, V3, V19). In IV.4 the word "spirit" is used of the Moon, not of this Lot. |
| "zodiacal releasing" | 0 matches | "the distribution of the chronocratorships"; "the zodiacal vital sector" (V17) |
| "peak" as a term of the method | 0 matches in Book IV | "most efficacious", "high rank" (V12) |

## Lilly passages (context for the filter only)

**L1. Ch. XIX, "Considerations Before Judgment" (pp. 74 to 75).**

"ALL the ancients that have written of questions do give warning to the astrologer, that before he delivers judgment he well consider whether the figure is radical and capable of judgment"

"when either the first or second degrees of a sign ascend"

"If 27 or more degrees of any sign ascend, it is not safe to give judgment"

"All manner of matters go hardly on (except the principal significators be very strong) when the ☽ is void of course"

"When the testimonies of fortunes and infortunes are equal, defer judgment: it is not possible to know which way the balance will turn; however, defer your opinion till another question better inform you."

**L2. Ch. XXXIII, "The Tenth House and its Questions" (p. 269).**

"THE usual significators are for the querent; and the 10th house, its lord, and the ☉, for the place, preferment, &c., inquired after."

"the querent shall gain the thing sought for, if he use proper endeavours."

Neither chapter says which subjects may be asked about, and neither states a
limit of one question. Those rules in `02-ask-the-sky-filter.md` are product
rules from ZOD-61 and `AGENTS.md`, not Lilly's. No other chapter of Lilly was
opened in this job.
