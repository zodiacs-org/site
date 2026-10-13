# The reviews of the dated tab titles and the pt-BR first of the month

Two review passes, one per language, as for F-86 and F-88 ([reviews.md](reviews.md),
[reviews-f88.md](reviews-f88.md)): each a separate agent reading as a senior
native-register editor, given the sheet below and the code, read-only. Their
verdicts are kept as delivered, apart from headings. What shipped is the sheet
with the one CHANGE applied.

## The sheet

| # | page | server title | dated title |
| --- | --- | --- | --- |
| ES-T1 | /es/today/ | Hoy — el cielo del 12 de octubre de 2026 \| Zodiacs.org | El cielo del 12 de octubre de 2026 \| Zodiacs.org |
| ES-T2 | /es/horoscopes/ | Horóscopos de hoy — 12 de octubre de 2026 \| Zodiacs.org | Horóscopos del 12 de octubre de 2026 \| Zodiacs.org |
| ES-T3 | /es/horoscopes/aries/ (no year) | Horóscopo de Aries hoy, 12 de octubre \| Zodiacs.org | Horóscopo de Aries del 12 de octubre \| Zodiacs.org |
| PT-T1 | /pt/today/ | Hoje — o céu de 12 de outubro de 2026 \| Zodiacs.org | O céu de 12 de outubro de 2026 \| Zodiacs.org |
| PT-T2 | /pt/horoscopes/ | Horóscopos de hoje — 12 de outubro de 2026 \| Zodiacs.org | Horóscopos de 12 de outubro de 2026 \| Zodiacs.org |
| PT-T3 | /pt/horoscopes/aries/ (no year) | Horóscopo de Áries hoje, 12 de outubro \| Zodiacs.org | Horóscopo de Áries de 12 de outubro \| Zodiacs.org |

Every Portuguese date that names its month now writes day 1 as "1º": "1º de
novembro de 2026", "1º de nov. de 2026", "domingo, 1º de novembro", "1º de nov.,
12:00", the daily kicker "Edição diária · 1º de novembro de 2026", the dated
forms ("O céu de 1º de novembro de 2026", "Em 1º de novembro de 2026, a Lua
passa por…", "Áries em 1º de novembro de 2026", "Leitura de 1º de novembro de
2026 →", "Horóscopo de Áries de 1º de novembro"), and the birthday pages
("Astrologia do aniversário de 1º de janeiro", "Nascer em 1º de janeiro", and
the sky line, which the review changed to "1º de janeiro de 1990: Sol … · Lua
em … ao meio-dia UTC"). Numeric dates
("01/11/2026") and days 11, 21 and 31 are unchanged.

## Spanish

All three Spanish dated titles (ES-T1 to ES-T3) pass as written. Nothing needs to change.

| # | Dated title | Verdict | Reason |
| --- | --- | --- | --- |
| ES-T1 | El cielo del 12 de octubre de 2026 \| Zodiacs.org | ACCEPT | Word for word the same as the reviewed heading. "de 2026" without "el" is the year form the RAE prefers. Longest case is 51 characters. |
| ES-T2 | Horóscopos del 12 de octubre de 2026 \| Zodiacs.org | ACCEPT | Word for word the same as the reviewed heading. Reads naturally as a tab or search title. Longest case is 53 characters. |
| ES-T3 | Horóscopo de Aries del 12 de octubre \| Zodiacs.org | ACCEPT | A natural, common shape for a horoscope title. It is the reviewed in-page sign link ("Horóscopo de Aries del 12 de octubre de 2026") without the year, and it uses the same "del" as ES-T1 and ES-T2. Longest case: "Horóscopo de Capricornio del 30 de septiembre \| Zodiacs.org" is 59 characters. The server title is 60. |

Asked afterwards about the Spanish birthday sky line, which had the same
"{date}, {year}" shape as the Portuguese one:

| Item | Verdict | Exact template | Why |
| --- | --- | --- | --- |
| es `sunMoon` | CHANGE | `'{date} de {year}: Sol {sun} · Luna en {moon} al mediodía UTC'` | Spanish links the year to the date with "de" ("1 de enero de 2026"). That is the RAE norm and the form every other Spanish date on the site uses. A comma before the year copies English "January 1, 2026". |

It is the only Spanish template with a comma before the year.

Notes: "Horóscopo de Aries, 12 de octubre" was considered and rejected; the comma
suits the sign heading only because the heading is just the sign name. No year
in ES-T3 is fine: the server title also leaves it out. Spanish needs nothing
like the pt-BR "1º": "del 1 de noviembre" is the neutral norm, and "1.º" is
regional.

## Portuguese

All three dated titles are fine as written. In the "1º" table, 13 of the 14 rows are correct Brazilian usage. The birthday sky line should change: its "1º" is right, but the comma before the year is not standard Portuguese.

| ID | Dated title | Verdict | Reason |
| --- | --- | --- | --- |
| PT-T1 | O céu de 12 de outubro de 2026 \| Zodiacs.org | ACCEPT | Same words as the reviewed heading. "de" plus a date with no article is standard written pt-BR, and the capital "O" is right at the start. 44 characters; 46 at most (fevereiro). |
| PT-T2 | Horóscopos de 12 de outubro de 2026 \| Zodiacs.org | ACCEPT | Same as the reviewed form and natural as a tab or search title. 49 characters; 51 at most. |
| PT-T3 | Horóscopo de Áries de 12 de outubro \| Zodiacs.org | ACCEPT | The reviewed link form without the year. The repeated "de … de" is normal in pt-BR dates. Longest case, "Horóscopo de Capricórnio de 28 de fevereiro \| Zodiacs.org", is 57 characters (the server version is 60). |

| Row | Verdict |
| --- | --- |
| long date; short date "1º de nov. de 2026"; weekday "domingo, 1º de novembro"; date and time "1º de nov., 12:00"; numeric "01/11/2026" unchanged; daily kicker; dated heading; Moon line; sign heading; card link; sign title; birthday page title; birthday page heading (13 rows) | Correct |
| birthday sky line | The "1º" is correct. CHANGE to: **1º de janeiro de 1990: Sol … · Lua em … ao meio-dia UTC** |

Notes: "1º de janeiro, 1990" copies the English "January 1, 1990"; Portuguese
joins the year with "de". The comma was there before this change, so it showed
on every birthday page; the fix is the one template string. "1º" with an
abbreviated month and the lowercase weekday form are correct Brazilian usage.
All "1º" use the ordinal sign "º" (U+00BA), never the degree sign, which
matters beside the degrees on the same line; there is no full stop after the
number, which is right for pt-BR ("1.º" is European Portuguese).
