# Dated wording on the Spanish and Portuguese daily pages: review sheet

The site's daily pages (/es/today/, /es/horoscopes/, /es/horoscopes/<sign>/ and the /pt/ equivalents) are built once a day for one UTC date, the edition. From 00:00 UTC until the next day's edition deploys (about 05:30 UTC), visitors read an edition that is a day old. In that window the English pages already replace "today" wording with dated wording (English examples: "Today" → "The October 12, 2026 edition"; "Compare today’s sky" → "Compare the October 12, 2026 edition’s sky"; "Read today →" → "Read on October 12, 2026 →"; "What matters most for Aries today." → "What matters most for Aries on October 12, 2026."). The Spanish and Portuguese pages still say "hoy"/"hoje" in that window while their kicker shows the older date. Below is the proposed dated wording for them. Example: edition of 12 October 2026, read on 13 October at 00:17 UTC.

Existing reviewed conventions on these pages: ES title "Hoy — el cielo del 12 de octubre de 2026", description "…calculadas a partir de las posiciones reales del 12 de octubre de 2026", aria label "Posiciones del cielo para el {date} a las 12:00 UTC"; PT title "Hoje — o céu de 12 de outubro de 2026", description "…a partir das posições reais de 12 de outubro de 2026", aria label "Posições no céu em {date}, às 12h UTC". Dates are Intl long dates: es-419 "12 de octubre de 2026", pt-BR "12 de outubro de 2026". Not changed on purpose, matching English, which keeps its "Tomorrow" tab: "Las lecturas de mañana, de la semana y del mes están en la edición en inglés", the button "Mañana, semana y mes", and their Portuguese twins.

## Spanish (neutral Latin American, tú)

### Page copy

| # | where | now | dated |
| --- | --- | --- | --- |
| ES-P1 | /es/today/ — h1 (above it, the kicker reads "Edición diaria · 12 de octubre de 2026") | Hoy | Edición del 12 de octubre de 2026 |
| ES-P2 | /es/today/ — intro paragraph | Elige tu signo solar. Cada nota sale de las posiciones registradas del cielo de hoy, leídas desde las casas solares de tu signo; los comprobantes bajo cada lectura dicen exactamente qué la produjo. | Elige tu signo solar. Cada nota sale de las posiciones registradas del cielo del 12 de octubre de 2026, leídas desde las casas solares de tu signo; los comprobantes bajo cada lectura dicen exactamente qué la produjo. |
| ES-P3 | /es/today/ — link under each sign (twelve, one per sign) | Horóscopo de hoy de Aries | Horóscopo de Aries del 12 de octubre de 2026 |
| ES-P4 | /es/today/ — closing note (the link text "la edición en inglés" follows) | ¿Tienes tu carta natal? La comparación privada con el cielo de hoy vive en | ¿Tienes tu carta natal? La comparación privada con el cielo del 12 de octubre de 2026 vive en |
| ES-P5 | /es/horoscopes/ — h1 | Horóscopos de hoy | Horóscopos del 12 de octubre de 2026 |
| ES-P6 | /es/horoscopes/ — intro paragraph | Busca tu signo para la nota más concreta del cielo de hoy. Lee primero tu signo solar y, si lo conoces, también tu ascendente. | Busca tu signo para la nota más concreta del cielo del 12 de octubre de 2026. Lee primero tu signo solar y, si lo conoces, también tu ascendente. |
| ES-P7 | /es/horoscopes/ — call to action at the foot of each sign card (9 px monospace, upper case) | Leer hoy → | Lectura del 12 de octubre de 2026 → |
| ES-P8 | /es/horoscopes/aries/ — h1 (one per sign) | Aries hoy | Aries el 12 de octubre de 2026 |
| ES-P9 | /es/horoscopes/acuario/ — h1 (longest sign name) | Capricornio hoy | Capricornio el 12 de octubre de 2026 |

### Reading lines (templates in src/lib/i18n/daily-reading.ts; every planet, house and aspect appears in the full list)

| # | now | dated |
| --- | --- | --- |
| ES-R1 | La Luna pasa hoy por tu cuarta casa: el hogar, la familia y la base privada de tu vida. | El 12 de octubre de 2026, la Luna pasa por tu cuarta casa: el hogar, la familia y la base privada de tu vida. |
| ES-R2 | La Luna pasa hoy por tu duodécima casa: el descanso, el retiro y lo que ocurre bajo la superficie. | El 12 de octubre de 2026, la Luna pasa por tu duodécima casa: el descanso, el retiro y lo que ocurre bajo la superficie. |
| ES-R3 | La Luna pasa hoy por tu décima casa: la carrera, la reputación y lo que ve el público. | El 12 de octubre de 2026, la Luna pasa por tu décima casa: la carrera, la reputación y lo que ve el público. |
| ES-R4 | Sol entra hoy en tu cuarta casa y pone el foco en el hogar, la familia y la base privada de tu vida. | Sol entra en tu cuarta casa el 12 de octubre de 2026 y pone el foco en el hogar, la familia y la base privada de tu vida. |
| ES-R5 | Mercurio entra hoy en tu cuarta casa y pone el foco en el hogar, la familia y la base privada de tu vida. | Mercurio entra en tu cuarta casa el 12 de octubre de 2026 y pone el foco en el hogar, la familia y la base privada de tu vida. |
| ES-R6 | Venus entra hoy en tu cuarta casa y pone el foco en el hogar, la familia y la base privada de tu vida. | Venus entra en tu cuarta casa el 12 de octubre de 2026 y pone el foco en el hogar, la familia y la base privada de tu vida. |
| ES-R7 | Marte entra hoy en tu cuarta casa y pone el foco en el hogar, la familia y la base privada de tu vida. | Marte entra en tu cuarta casa el 12 de octubre de 2026 y pone el foco en el hogar, la familia y la base privada de tu vida. |
| ES-R8 | Plutón entra hoy en tu cuarta casa y pone el foco a largo plazo en el hogar, la familia y la base privada de tu vida. | Plutón entra en tu cuarta casa el 12 de octubre de 2026 y pone el foco a largo plazo en el hogar, la familia y la base privada de tu vida. |
| ES-R9 | Júpiter en oposición con Plutón alcanza hoy su punto exacto: es un aspecto de alcance general y el comprobante muestra la hora. | Júpiter en oposición con Plutón alcanza su punto exacto el 12 de octubre de 2026: es un aspecto de alcance general y el comprobante muestra la hora. |
| ES-R10 | Júpiter en sextil con Urano alcanza hoy su punto exacto: es un aspecto de alcance general y el comprobante muestra la hora. | Júpiter en sextil con Urano alcanza su punto exacto el 12 de octubre de 2026: es un aspecto de alcance general y el comprobante muestra la hora. |
| ES-R11 | Un cielo tranquilo hoy. | Un cielo tranquilo el 12 de octubre de 2026. |

All 169 distinct es lines (117 editions since July plus synthetic cases) are in [reading-lines.jsonl](reading-lines.jsonl), one JSON object per line with "text" and "dated", as the sheet proposed them.

## Brazilian Portuguese (você)

### Page copy

| # | where | now | dated |
| --- | --- | --- | --- |
| PT-P1 | /pt/today/ — h1 (above it, the kicker reads "Edição diária · 12 de outubro de 2026") | Hoje | Edição de 12 de outubro de 2026 |
| PT-P2 | /pt/today/ — intro paragraph | Escolha o seu signo solar. Cada nota vem das posições registradas do céu de hoje, lidas a partir das casas solares do seu signo; os registros sob cada leitura dizem exatamente o que a produziu. | Escolha o seu signo solar. Cada nota vem das posições registradas do céu de 12 de outubro de 2026, lidas a partir das casas solares do seu signo; os registros sob cada leitura dizem exatamente o que a produziu. |
| PT-P3 | /pt/today/ — link under each sign (twelve, one per sign) | Horóscopo de hoje de Áries | Horóscopo de Áries de 12 de outubro de 2026 |
| PT-P4 | /pt/today/ — closing note (the link text "edição em inglês" follows) | Já tem o seu mapa astral? A comparação privada com o céu de hoje está na | Já tem o seu mapa astral? A comparação privada com o céu de 12 de outubro de 2026 está na |
| PT-P5 | /pt/horoscopes/ — h1 | Horóscopos de hoje | Horóscopos de 12 de outubro de 2026 |
| PT-P6 | /pt/horoscopes/ — intro paragraph | Encontre o seu signo para a nota mais concreta do céu de hoje. Leia primeiro o seu signo solar e, se souber, o seu ascendente também. | Encontre o seu signo para a nota mais concreta do céu de 12 de outubro de 2026. Leia primeiro o seu signo solar e, se souber, o seu ascendente também. |
| PT-P7 | /pt/horoscopes/ — call to action at the foot of each sign card (9 px monospace, upper case) | Ler hoje → | Leitura de 12 de outubro de 2026 → |
| PT-P8 | /pt/horoscopes/aries/ — h1 (one per sign) | Áries hoje | Áries em 12 de outubro de 2026 |
| PT-P9 | /pt/horoscopes/capricorn/ — h1 (longest sign name) | Capricórnio hoje | Capricórnio em 12 de outubro de 2026 |

### Reading lines (templates in src/lib/i18n/daily-reading.ts; every planet, house and aspect appears in the full list)

| # | now | dated |
| --- | --- | --- |
| PT-R1 | A Lua passa hoje por sua décima casa: a carreira, a reputação e o que o público vê. | Em 12 de outubro de 2026, a Lua passa por sua décima casa: a carreira, a reputação e o que o público vê. |
| PT-R2 | A Lua passa hoje por sua décima primeira casa: as amizades, os grupos e o futuro que você busca construir. | Em 12 de outubro de 2026, a Lua passa por sua décima primeira casa: as amizades, os grupos e o futuro que você busca construir. |
| PT-R3 | A Lua passa hoje por sua décima segunda casa: o descanso, o recolhimento e o que acontece sob a superfície. | Em 12 de outubro de 2026, a Lua passa por sua décima segunda casa: o descanso, o recolhimento e o que acontece sob a superfície. |
| PT-R4 | Sol entra hoje na sua décima casa e coloca o foco na carreira, a reputação e o que o público vê. | Sol entra na sua décima casa em 12 de outubro de 2026 e coloca o foco na carreira, a reputação e o que o público vê. |
| PT-R5 | Mercúrio entra hoje na sua décima casa e coloca o foco na carreira, a reputação e o que o público vê. | Mercúrio entra na sua décima casa em 12 de outubro de 2026 e coloca o foco na carreira, a reputação e o que o público vê. |
| PT-R6 | Vênus entra hoje na sua décima casa e coloca o foco na carreira, a reputação e o que o público vê. | Vênus entra na sua décima casa em 12 de outubro de 2026 e coloca o foco na carreira, a reputação e o que o público vê. |
| PT-R7 | Marte entra hoje na sua décima casa e coloca o foco na carreira, a reputação e o que o público vê. | Marte entra na sua décima casa em 12 de outubro de 2026 e coloca o foco na carreira, a reputação e o que o público vê. |
| PT-R8 | Plutão entra hoje na sua décima primeira casa e coloca o foco de longo prazo nas amizades, os grupos e o futuro que você busca construir. | Plutão entra na sua décima primeira casa em 12 de outubro de 2026 e coloca o foco de longo prazo nas amizades, os grupos e o futuro que você busca construir. |
| PT-R9 | Júpiter em oposição com Plutão chega hoje ao ponto exato: é um aspecto de alcance geral, e o registro mostra o horário. | Júpiter em oposição com Plutão chega ao ponto exato em 12 de outubro de 2026: é um aspecto de alcance geral, e o registro mostra o horário. |
| PT-R10 | Júpiter em sextil com Urano chega hoje ao ponto exato: é um aspecto de alcance geral, e o registro mostra o horário. | Júpiter em sextil com Urano chega ao ponto exato em 12 de outubro de 2026: é um aspecto de alcance geral, e o registro mostra o horário. |
| PT-R11 | Um céu tranquilo hoje. | Um céu tranquilo em 12 de outubro de 2026. |

All 169 distinct pt lines (117 editions since July plus synthetic cases) are in [reading-lines.jsonl](reading-lines.jsonl), one JSON object per line with "text" and "dated", as the sheet proposed them.

## Rules for wording not listed above

For copy added later, the word rules apply after the fixed phrases: ES "de hoy" → "del {date}", "Hoy," → "El {date},", "Hoy" → "El {date}", "hoy" → "el {date}"; PT "de hoje" → "de {date}", "Hoje," → "Em {date},", "Hoje" → "Em {date}", "hoje" → "em {date}".
