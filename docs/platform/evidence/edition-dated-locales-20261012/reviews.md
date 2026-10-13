# The two reviews of the dated wording

Each review was a separate agent, told to act as a senior native-register copy
editor (neutral Latin American Spanish with "tú"; Brazilian Portuguese with
"você") and to work read-only. Each was given [review-sheet.md](review-sheet.md),
[reading-lines.jsonl](reading-lines.jsonl), the three page templates of its
language and `src/lib/i18n/daily-reading.ts`, but not the authors' reasoning.
The sheet's proposals are the ones reviewed; [README.md](README.md) gives the
wording that ships and why it differs. This is not a human native-speaker
certification. Both reports are kept as delivered, apart from headings.

## Spanish

### Overall verdict

Most of the dated forms can ship. The date grammar is correct everywhere:

- "del" and "el" are used correctly with the dates, and no "de el" or "a el" appears.
- A fronted date takes a comma and the next word stays lowercase.
- The present tense reads correctly both on the day and in the dated window. That matters because the dated text is also what visitors without JavaScript see on the day itself.

Four items need changing:

- **ES-P1:** the h1 repeats the kicker.
- **ES-P8 / ES-P9:** the sign headings use the wrong form for a heading.
- **ES-R4 and its template family:** "Sol"/"Luna" lack their article. This is a pre-existing template error that a native editor would not publish. It affects 30 of the 169 lines.

There is also an error in the sheet: the ES-P9 "where" column is wrong.

Known cost: in the dated window the date repeats a lot. On the 12 October edition every card's teaser is the Moon line, so the /es/horoscopes/ grid shows the date 24 times. Given the brief, that is acceptable.

### Item verdicts

| item | verdict | replacement (if CHANGE) | reason |
|---|---|---|---|
| ES-P1 | CHANGE | El cielo del 12 de octubre de 2026 | The kicker directly above already reads "Edición diaria · 12 de octubre de 2026", so "Edición del 12 de octubre de 2026" repeats both "Edición" and the date on the next line. English has no such echo because its kicker is "Your daily brief". The replacement matches the reviewed title "Hoy — el cielo del…" and is the same length (34 vs 33 characters). |
| ES-P2 | ACCEPT | | "del cielo del 12 de octubre de 2026" is correct, and "leídas" still agrees with "posiciones". |
| ES-P3 | ACCEPT | | Natural word order, better than the current "de hoy de". |
| ES-P4 | ACCEPT | | The dated part is fine. "vive en" and the doubled "inglés" are pre-existing (see below). |
| ES-P5 | ACCEPT | | |
| ES-P6 | ACCEPT | | |
| ES-P7 | ACCEPT | | A noun label is the right fix: "Leer el 12 de octubre…" would read as "read on that date". It works as a card CTA. Length: 35 characters in 9 px uppercase JetBrains Mono is about 214 px, against about 160 px of card width in the 4-column grid (1000 px and wider). It will wrap onto two centred lines; allow that (e.g. `text-wrap: balance`) rather than shortening the words. |
| ES-P8 | CHANGE | Aries, 12 de octubre de 2026 | "Aries el 12 de octubre de 2026" reads like a word-for-word swap. "X hoy" is an established heading pattern, but "X el + fecha" with no verb reads as a sentence fragment. The native form for a name plus a date is the dateline: "Nombre, fecha". The page's own title already uses that comma form ("Horóscopo de Aries hoy, 12 de octubre"). "Horóscopo de Aries del…" would repeat the kicker "Horóscopo diario" and runs to 50 characters with Capricornio. |
| ES-P9 | CHANGE | Capricornio, 12 de octubre de 2026 | Same reason as P8 (34 characters). Sheet error: the page is /es/horoscopes/capricorn/ (slugs are English), not /acuario/. |
| ES-R1–R3 | ACCEPT | | Putting the date first is right. Inside the sentence it would split "pasa … por"; after "casa" it would run into the colon gloss. |
| ES-R4 | CHANGE | El Sol entra en tu cuarta casa el 12 de octubre de 2026 y pone el foco en el hogar, la familia y la base privada de tu vida. | The date placement is fine. Bare "Sol" as a subject is ungrammatical, and the "now" text has the same error. Fix it in the template. |
| ES-R5–R8 | ACCEPT | | Verb, then place, then date is the natural order. |
| ES-R9–R10 | ACCEPT | | Reads cleanly with the date before the colon. |
| ES-R11 | ACCEPT | | A verbless headline is idiomatic here, and this fallback is rare. |
| Moon-line template | ACCEPT | | Every place this line appears (reading line, lead, teaser) starts its text node, so the anchored rule fires. |
| Ingress template | ACCEPT the dating; CHANGE the subject | El Sol entra en tu {n} casa el {date} y … / La Luna entra en tu {n} casa el {date} y … | 24 lines now read "Sol entra…" or "Luna entra…". This also clashes with the house line "La Luna pasa…". |
| Aspect template | ACCEPT the dating; CHANGE the subject | El Sol en cuadratura con Saturno alcanza su punto exacto el {date}: … — and, when the Sun or Moon is the second body, "con el Sol" / "con la Luna" | 6 lines now read "Sol en …". Keep the bare names in the receipts. |
| Quiet-sky template | ACCEPT | | |

### The four generic word rules

They are fine as defaults wherever "hoy" is a plain time adverb or part of a "de hoy" complement. They need some additions before new copy relies on them.

These work:

- "Revisa el cielo de hoy." → "Revisa el cielo del 12 de octubre de 2026."
- "A partir de hoy, Venus avanza." → "A partir del 12 de octubre de 2026, Venus avanza."
- "Hoy, Marte cambia de signo." → "El 12 de octubre de 2026, Marte cambia de signo."
- "Hoy es un buen día para ordenar." → "El 12 de octubre de 2026 es un buen día…" Having no comma is correct here because the date is the subject, so the rules should never add one automatically.
- "Mercurio sigue retrógrado hoy." → "…sigue retrógrado el 12 de octubre de 2026."

These break:

- **"a hoy":** "De ayer a hoy…" becomes "…a el 12 de octubre…". This needs a rule "a hoy" → "al {date}", with a Unicode-aware boundary such as `(?<![\p{L}\p{N}])a hoy\b`. JavaScript's `\b` is ASCII-only, so a plain `\ba hoy` would also match inside "todavía hoy" or "día hoy" and produce "todavíal 12 de octubre…".
- **Idioms meaning "nowadays" or "right now":** "Hoy en día", "hoy por hoy", "hoy mismo", "vive el hoy" and "es todo por hoy" become "El 12 de octubre de 2026 en día…", "el el 12…" and so on. Exclude them.
- **Labels and datelines** should carry the bare date, with no article:
  - "Aries · hoy" (TodayBySign's existing string) becomes "Aries · el 12 de octubre de 2026"; it should be "Aries · 12 de octubre de 2026".
  - A title-case "Horóscopo de Hoy" becomes "Horóscopo de El 12…".
  - `<strong>Hoy</strong>, …` (or any other text node that is exactly "Hoy", such as a tab) hits the whole-node rule and turns into the h1 phrase. Scope that rule to the h1 only.
- **Appositions repeat the date:**
  - "Horóscopos de hoy, 12 de octubre de 2026" becomes "…del 12 de octubre de 2026, 12 de octubre de 2026".
  - "hoy, lunes" becomes "el 12 de octubre de 2026, lunes".
  - The current title "Hoy — el cielo del…" would also double its date.

No rule can fix these, so copywriters need to avoid them:

- Mixed time frames: "hoy y mañana" becomes "el 12 de octubre de 2026 y mañana".
- Imperatives: "Aprovecha hoy para…" becomes an instruction for a day that is already over.
- "hoy" in the middle of a clause gives clunky insertions, like "pasa el 12 de octubre de 2026 por…". Put "hoy" at the start or end of the clause, or add a fixed phrase as was done for the Moon line.

### Pre-existing problems (not caused by the dated forms)

1. **Missing article in the templates (pre-existing).** `eventLineEs` in src/lib/i18n/daily-reading.ts (around lines 188–239) uses bare `planetLabel` as the sentence subject. That gives "Sol entra…", "Luna entra…" and "Sol en cuadratura…", where Spanish needs "El Sol" / "La Luna", and "con el Sol" / "con la Luna" when they are the second body. 30 of the 169 lines are affected.
2. **"Por qué esta lectura" note (pre-existing).** `todaySolarNote` (src/lib/i18n/ui/es.ts:185) is rendered as its own paragraph: "leído desde las casas solares de tu signo." It starts in lowercase, and the masculine "leído" agrees with nothing ("lectura" is feminine). Use "Se lee desde las casas solares de tu signo." The same string is also used in TodayBySign.
3. **Doubled language cue (pre-existing).** The /es/today/ and /es/horoscopes/ notes render "la edición en inglés — por ahora en inglés". Drop the suffix where the link text already says "en inglés", and keep the `hreflang` and `title`.
4. **Calque (pre-existing).** "…con el cielo de hoy vive en…" uses "vive en" for English "lives in". Use "está en".
5. **Note count (pre-existing).** The /es/today/ meta description promises "cuatro notas por signo", but the committed 12 October edition gives every sign 3. Use "hasta cuatro notas por signo". The sign-page description `${n} notas` would print "1 notas" for a one-line reading, and it uses a numeral where /es/today/ spells the number out.
6. **Smaller wording issues (pre-existing).**
   - "Horóscopo de hoy de Aries" has a double "de"; the now form reads better as "Horóscopo de Aries de hoy".
   - "Busca tu signo para la nota más concreta…" → "Busca tu signo y lee la nota más concreta…"
   - "¿Quieres una vista más personal?" uses "vista" as a calque of "view" → "una lectura más personal".
   - The aspect line echoes "alcanza … de alcance general" → "es un aspecto colectivo", as the French and Italian templates do.
   - "Luna nueva en tu cuarta casa: abre un punto de partida en…" → "La Luna nueva en tu cuarta casa abre un punto de partida en…"
7. **Scope gap (pre-existing).** The `<title>`, meta description and og image alt are outside `[data-edition-content]`, so they keep "hoy" in the dated window. For example, the browser tab still reads "Horóscopo de Aries hoy, 12 de octubre" on 13 October.
8. **Missing evidence folder.** The comment in src/lib/edition-freshness.ts points to docs/platform/evidence/edition-dated-locales-20261012/, which doesn't exist; only edition-dated-20261012/ does.

## Portuguese

**Overall verdict:** all 20 Portuguese dated forms can ship as written. None needs a CHANGE.

- **Prepositions** are right throughout: "de {date}" after a noun (edição, céu, horóscopo, leitura) and "em {date}" for "when". "do dia" isn't needed anywhere; it only adds a colloquial tone and length.
- **The sheet matches the code.** I applied the Portuguese rules from `site-edition-locale/src/lib/edition-freshness.ts` to all 178 Portuguese strings (9 page strings and 169 reading lines). The output is identical to the sheet's "dated" column, and no "hoje" is left.
- **Two caveats, both pre-existing** (details in the last section):
  - On the 1st of a month, the date prints "1 de novembro de 2026". Brazilian usage is "1º de novembro de 2026".
  - The ingress, aspect and lunation templates have grammar errors that are already live. These are the missing article on Sol/Lua and the preposition not repeated in lists. A careful editor wouldn't publish them, dated or not.

| item | verdict | replacement (if CHANGE) | reason |
|---|---|---|---|
| PT-P1 h1 "Edição de 12 de outubro de 2026" | ACCEPT | — | Standard written form. It repeats the kicker above it, as EN/ES do, and clearly says this is a dated edition. |
| PT-P2 /today/ intro | ACCEPT | — | Matches the reviewed "o céu de {date}" convention. "lidas" still clearly agrees with "posições" across the longer date. |
| PT-P3 link "Horóscopo de Áries de 12 de outubro de 2026" | ACCEPT | — | Reads well. It's the normal dated form of "Horóscopo de Áries de hoje". The run of "de" is how Portuguese dates work and doesn't trip readers. "do dia 12 de outubro…" is colloquial and longer; "para 12 de outubro" turns it into a forecast. Its word order is better than the current text's (pre-existing 4). |
| PT-P4 closing note | ACCEPT | — | Correct. The repeated "inglês" is pre-existing (6). |
| PT-P5 h1 | ACCEPT | — | Natural headline. |
| PT-P6 /horoscopes/ intro | ACCEPT | — | The date fits. The sentence itself reads a little translated (pre-existing 11). |
| PT-P7 CTA "Leitura de 12 de outubro de 2026 →" | ACCEPT | — | Works as a small call to action; noun-plus-arrow link labels are normal in Brazilian UI. "Ler em 12 de outubro" would mean "read it on that day", and "Ler a leitura" is redundant. It is 35 characters (37 with "fevereiro"). At 9 px monospace caps it will wrap to two lines on the 4-column desktop grid (about 26 characters per line) and at some 2–3-column widths. That's acceptable; `text-wrap: balance` would even out the break. |
| PT-P8 h1 "Áries em 12 de outubro de 2026" | ACCEPT | — | "Sign + em + period" is the standard Brazilian horoscope heading ("Áries em outubro", "Áries em 2026"), so this reads native. "Áries, 12 de outubro de 2026" looks like a letter's place-and-date line ("São Paulo, 12 de outubro de 2026"), with Áries as the place, and saves only two characters. |
| PT-P9 h1 "Capricórnio em 12 de outubro de 2026" | ACCEPT | — | Same reasoning. At 36 characters it wraps on phones like any long heading. |
| PT-R1–R3 and the Moon-line template (12 lines) | ACCEPT | — | Putting the date first is right; after "casa" it would collide with the colon list. The comma after the long date and the lowercase "a Lua" are correct. Present tense with a date is normal almanac style. In Brazil the window is 21:00–02:30 local time, so the edition date is often still the reader's own today; neutral dated wording suits that. |
| PT-R4–R8 and the ingress template (120 lines) | ACCEPT (dating) | — | The date after the house and before "e coloca" is clear, and "décima primeira/segunda" is handled. The sentences still carry pre-existing errors 1 and 2; fix those in the template. |
| PT-R9–R10 and the aspect template (36 lines) | ACCEPT (dating) | — | The date before the colon reads naturally. Sol-led lines lack "O" (pre-existing 1); "oposição com" should be "oposição a" (pre-existing 8). |
| PT-R11 quiet-sky line | ACCEPT | — | Fine as a verbless caption. In practice it never shows, because the Moon line always exists. |

**The four generic word rules:** fine as a safety net, but not as the way to date new copy.

- **"de hoje" → "de {date}":**
  - Works for noun complements and "a partir de / antes de / depois de hoje". Example: "A partir de 12 de outubro de 2026, Mercúrio fica retrógrado."
  - Fails on "O dia de hoje pede calma." → "O dia de 12 de outubro…"; it should be "O dia 12 de outubro de 2026 pede calma."
  - Turns the idiom "Não é de hoje que…" ("it has long been so") into nonsense.
  - Misses a capitalised "De hoje em diante", which then falls to the last rule: "De em 12 de outubro de 2026 em diante".
- **"Hoje," → "Em {date},":** works. "Em 12 de outubro de 2026, a Lua entra em Touro."
- **"Hoje" → "Em {date}":**
  - Only works when "Hoje" opens the sentence as an adverb, and then it drops the comma a long date needs: "Em 12 de outubro de 2026 a Lua entra em Touro."
  - Fails when "Hoje" is the subject: "Hoje é um bom dia para…" → "Em 12 de outubro de 2026 é um bom dia…"; it should be "12 de outubro de 2026 é um bom dia…".
  - Fails in headings: "Hoje no céu" → "Em 12 de outubro de 2026 no céu". The title pattern "Hoje — o céu de {date}" would become "Em {date} — o céu de {date}".
  - Breaks "Hoje em dia" ("nowadays") into "Em 12 de outubro de 2026 em dia".
- **"hoje" → "em {date}":**
  - Works at the end of a clause: "A Lua muda de signo em 12 de outubro de 2026."
  - Fails after a preposition: "Previsões para hoje", "até hoje" and "desde hoje" become "para em…", "até em…" and "desde em…".
  - Is clumsy before another "em": "A Lua entra em 12 de outubro de 2026 em Touro." That is why the ingress line needed its own fixed phrase.
  - Breaks with imperatives: "Leia hoje o seu signo." becomes "Leia em 12 de outubro…", which reads as "read it on that date".
  - Breaks with "hoje" as subject, including the existing UI string "Veja o que hoje significa para {name}" → "Veja o que em 12 de outubro de 2026 significa…".
- **Recommendation:** add these before the four rules:
  - "(para|até|desde) hoje" → "$1 {date}", as the English list already does.
  - "o dia de hoje" → "o dia {date}".
  - "De hoje" → "De {date}".
  - Leave "hoje em dia" and "não é de hoje" untouched.
  - Give every new "hoje" string its own fixed phrase, reviewed by a native editor.

**Pre-existing problems (not caused by the dated forms)**

1. **Grammar: no article on the Sun and Moon.** Thirty lines start "Sol entra…", "Lua entra…" or "Sol em oposição com Netuno…", and the lunation line starts "Lua nova na sua…". They should read "O Sol…", "A Lua…", "A Lua nova… abre…". `planetLabel('pt')` returns the bare noun, so these templates need a subject form. The existing date rules still match after this fix. Spanish has the same bug: "El Sol…", "La Luna…".
2. **Grammar: preposition not repeated in lists.** This affects all 120 ingress lines and both lunation lines, because `emPt` contracts only the first item: "coloca o foco na carreira, a reputação e o que o público vê". These need their own "em" theme list:
   - 1: na sua imagem, nos seus começos e na impressão que você causa
   - 2: no dinheiro, nos bens e no que dá estabilidade a você
   - 3: nas tarefas, nos irmãos, nas mensagens e no seu ambiente próximo
   - 4: no lar, na família e na base privada da sua vida
   - 5: no prazer, no romance, nos filhos e no que você cria por gosto
   - 6: no trabalho em andamento, nos hábitos de saúde e na carga diária
   - 7: nos relacionamentos e nas pessoas do outro lado da mesa
   - 8: no dinheiro compartilhado, nas dívidas, na intimidade e no que se une
   - 9: nas viagens, nos estudos, nas crenças e na visão de longo alcance
   - 10: na carreira, na reputação e no que o público vê
   - 11: nas amizades, nos grupos e no futuro que você busca construir
   - 12: no descanso, no recolhimento e no que acontece sob a superfície

   With fixes 1 and 2, a dated line reads: "O Sol entra na sua décima casa em 12 de outubro de 2026 e coloca o foco na carreira, na reputação e no que o público vê."
3. **Day 1 of the month.** Intl pt-BR prints "1 de novembro de 2026"; Brazilian usage is "1º de novembro de 2026". This affects the kicker, the date stamp, page titles and every dated string ("Em 1º de novembro de 2026, a Lua…"). Fix it the same way in `formatDate` (`src/lib/i18n/dates.ts`) and `editionDateLabel` (`src/lib/edition-freshness.ts`) so the two stay identical.
4. **Current link text "Horóscopo de hoje de Áries"** is a calque of "Today's Aries horoscope". Use "Horóscopo de Áries de hoje". The generic "de hoje" rule then gives the same dated text as now, so the fixed rule for this phrase can go.
5. **Sign page repeats a sentence.** The lead paragraph is `reading.headline`, which is the first reading line, and that line prints again directly below. In the dated window that means the full date twice in a row. Use a real lead like the English one, e.g. "O que mais importa para Áries hoje." The generic rule dates it correctly.
6. **"edição em inglês — por enquanto em inglês"** (closing notes on /pt/today/ and /pt/horoscopes/) says English twice. Drop the visible cue on links whose text already says "em inglês", and keep `hreflang`/`title`.
7. **Text under "Por que esta leitura".** The `todaySolarNote` string renders as its own paragraph: "lido pelas casas solares do seu signo." It starts lowercase, uses the masculine "lido" with nothing to agree with ("leitura" is feminine), and sounds as if the houses do the reading. Suggest "Lida a partir das casas solares do seu signo."
8. **Aspect template.** "em oposição com" should be "em oposição a"; "com" is fine for the other aspects. Optionally, "fica exato" is the usual Brazilian astrology wording instead of "chega ao ponto exato"; if changed, update the fixed rule.
9. **Decimal point in the evidence lines.** "Lua 12.3° Escorpião" should be "12,3°" in pt-BR (`toFixed` in the house, lunation and station lines).
10. **House themes (optional polish).** House 7 "as pessoas do outro lado da mesa" is a calque that suggests a negotiating opponent; use "as pessoas com quem você lida de igual para igual". House 8 "o que se une" is vague; "o que se funde" is clearer. "culminação" → "culminância" is the more usual Brazilian word.
11. **/pt/horoscopes/ intro** reads translated. Suggest "Encontre o seu signo e leia a nota mais concreta sobre o céu de hoje."
12. **/pt/today/ meta description says "quatro notas por signo".** The 12 Oct 2026 edition gives three per sign, because Mercury and Venus share the Moon's house. Use "até quatro notas por signo". Spanish says "cuatro notas" and has the same problem.
13. **Titles and meta stay undated.** The tab title, meta description and image alt text sit outside the dated area, so they still say "hoje" at night: "Horóscopos de hoje — 12 de outubro de 2026", "Horóscopo de Áries hoje, 12 de outubro". The /pt/today/ title is a reviewed convention; the other two pages need the same decision.

**Outside Portuguese scope:** the sheet's ES-P9 row gives the path /es/horoscopes/acuario/ but the heading "Capricornio hoy". The slug is probably capricorn.

### Follow-up question and answer

Asked whether PT-P1 should follow the Spanish change ("O céu de 12 de outubro de 2026" under the kicker "Edição diária · 12 de outubro de 2026"), and whether the four generic word rules can be dropped in favour of ten fixed phrases:

**PT-P1: ship "O céu de 12 de outubro de 2026".** Directly under "Edição diária · 12 de outubro de 2026", the h1 "Edição de 12 de outubro de 2026" repeats both the word and the date on the next line and tells the reader nothing new. "O céu de…" says what the page shows, is the reviewed page title minus "Hoje —" (written "de" + date, not the Spanish "del"), and keeps the Portuguese page in step with the new ES-P1; the kicker above already says it's a dated edition, so it can't read as "today". The intro then repeats "do céu de 12 de outubro de 2026" in body text, which is a normal echo of the heading and fine. This changes my PT-P1 verdict to CHANGE, replacement "O céu de 12 de outubro de 2026".

**Dropping the four generic rules: confirmed.** With only your ten fixed phrases, all 178 Portuguese strings come out identical to the sheet and no "hoje" is left; the only difference is PT-P1's own new text. I checked this in memory with `node -e`, and every "hoje" rendered inside `data-edition-content` on the three pages and in `daily-reading.ts` is one of those phrases.

Scope the test that fails on an unlisted "hoje" to `[data-edition-content]`. The page title, meta description and og:image alt text still contain "hoje" outside that area (e.g. "Horóscopos de hoje — …", "Horóscopo de Áries hoje, 12 de outubro"), so a page-wide test would fail immediately.
