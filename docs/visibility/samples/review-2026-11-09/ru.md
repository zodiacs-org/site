# Russian copy: independent review, 2026-11-09

Reviewer: a separate AI pass that did not write the copy, reading as a native Russian editor. Not a native human review. Scope: the horoscope sheet `../ru.md`, six pair articles (aries-leo, taurus-scorpio, gemini-sagittarius, cancer-capricorn, libra-aquarius, pisces-pisces) and three rising profiles (leo, scorpio, pisces).

Verdicts: horoscope sheet **mostly** (clean grammar, but long house labels repeat and some calques); pairs **mostly** (lively, a few calques and one agreement error); rising **mostly** (sound, but English imagery). No dashes, and no money, betting, health or romance framing aimed at minors.

## Horoscope sheet (src/lib/locale-expansion/horoscope/ru.ts, lunation/ru.ts, zodiac-dates/ru.ts)

1. "две сферы: с одной стороны ..., с другой ..." runs on: split into two sentences.
2. Several yearly date sentences have no meaning after them (the dedup path drops it): give each its meaning or drop it.
3. THEME[7] "партнёрство и договорённости на равных" is a calque: "партнёрство, брак и договоры". THEME[1] and THEME[12] are too long to repeat: "ваш образ и начинания", "отдых, уединение и скрытые дела".
4. "в центре внимания: ..." with a colon: "в центре внимания окажутся ...".
5. "Второй участок, который требует внимания": "Ещё одна сфера, которая требует внимания".
6. "то, что вы сдаёте" is ambiguous: "реальный объём работы", "из законченной работы".
7. "Хорошая точка старта для семьи": "Хорошее время начать новое в делах семьи".
8. "Дома и в отдыхе": "Дома и в свободное время".
9. "что нужно вам дома": "что вам нужно дома", with a second variant.
10. "Написан по рассчитанному небу": "Составлен по точному расчёту неба".
11. Full Moon "становится точным": "наступает"; "для спокойной настройки": "чтобы спокойно всё поправить".
12. New Moon: "по традиции это время сформулировать скромное и конкретное намерение"; "чтобы понять, что оно значит для вас"; "опираются".
13. Zodiac dates: "у двух людей ... могут быть разные солнечные знаки".

## Pairs (src/content/pairs-i18n/ru/)

14. cancer-capricorn: "обоим важна семья, традиции" to "обоим важны"; "Козерог держит опору" to "служит опорой".
15. pisces-pisces: "честное слово" to "откровенный разговор"; "никто не держит берег" to "и некому удержать их на берегу"; "в гиде" to "в статье о знаке".
16. libra-aquarius: "в прямом смысле" (figurative); "в гидах" to "в статьях о знаках"; "одной из многих" rephrase.
17. gemini-sagittarius: "тонеет" to "слабеет"; "падают в щель между двумя людьми" (calque); "ни один и не просит"; "слушают без увёрток" to "отвечают".
18. aries-leo: "защитит вас в лицо любому"; "живёт благодарностью" to "нужно признание"; "обмен" to "правило"; "по умолчанию" to "от природы"; "огонь накормлен".
19. taurus-scorpio: verbless fragment on rulers; "обычный вторник"; "не играет в игры" to "не хитрит"; "любит телом" to "через прикосновения и заботу".

## Rising (src/content/learn-i18n/ru/rising/)

20. scorpio: "в Льве" to "во Льве".
21. "комната" for "the room" in all three: "люди вокруг", "окружающие".
22. "регистр, в котором с вами знакомятся": "какими вас видят при первой встрече".
23. Calques: "не принимая никакого решения", "обычный вторник", "асцендент выигрывает первую встречу", "оставаться похороненным", "всей схеме", "вслух в полный голос".
24. pisces: unclear "он"; 25. "Середина неба" lower case mid-sentence.

Terms: right (натальная карта, асцендент, дом, новолуние, полнолуние, ретроградный, солнечный знак). Pick one word for mutable: "мутабельный".

Because the review read a sample of pairs and profiles, the fixes apply the same patterns to every Russian pair and profile, not only the ones read.
