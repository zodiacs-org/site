# Sources opened in the 13 November 2026 rerun

Every source below was fetched on 2026-11-13 between 08:54 and 09:10 UTC
(15:54 to 16:10 in Bangkok) from the job's own machine, with `curl`, public
JSON APIs, public RPC endpoints, a headless Chromium for the rendered page,
and the local clone of `zodiacs-org/site` at `origin/main` `210622bfe`.
Nothing is taken from the claims file, a Linear issue, or the verdicts of the
11 Nov report. Ids R1 to R17 reopen the sources that the 11 Nov report called
S1 to S17 (and S19); R20 and R21 are new.

`records/fetch-log.tsv` lists each web fetch with its time, HTTP status and
size. `records/verify-web-output.txt` is the output of the script that looked
for each quoted sentence in the fetched pages (`records/tools/verify_web.py`).
Large third-party pages are not committed; the small raw records are.

## R1. The live page and its published files

- https://zodiacs.org/thesis/ fetched 2026-11-13T08:54:17Z, HTTP 200,
  422,437 bytes, SHA-256
  `6db6abf8e088fdba81515fa6140645ea59d3f2bd2db7780922b5ee86c08e1615`.
  Capture: `records/live-thesis-20261113.html`. Headers:
  `records/live-headers.txt`. (A first attempt seconds earlier ended in a TLS
  error and returned nothing.)
- Text extract, keeping `aria-label`, `title`, `alt`, `meta`, `link` and
  `application/ld+json`: `records/live-thesis-extract.txt`, made by
  `records/tools/extract2.py`. The same extractor was run on the 11 Nov
  capture and the two extracts compared line by line; the differences are the
  three figures and the "Updated" date.
- The live text equals `public/thesis/index.html` at `origin/main`
  `210622bfe`, apart from one flag-gated link ("View a wallet collection")
  that the build adds.
- Published JSON beside the page, each fetched live at 08:58Z and
  byte-identical to `origin/main` (`records/thesis-json-sha256.txt`):
  `thesis-seasons.json` (new), `thesis-charts.json`, `thesis-claims.json`
  (29 entries, `reviewedAt` 2026-11-11, unchanged by PR 995),
  `thesis-candidacy.json`, `thesis-candidacy-evidence.json`,
  `thesis-disclosure.json`, `thesis-test.json`, `thesis-history.json`
  (`reviewedAt` 2026-07-31, seven events), and `thesis-attention.json`, which
  is still published but no longer linked from the page.
- Between the 11 Nov capture and this one, two files under `public/thesis/`
  changed on `main`: `index.html` and the new `thesis-seasons.json`
  (`git diff --stat 47fee79f8 origin/main -- public/thesis`).
- Dot counts in the saved figures: each drawing of the first figure has 200
  circles, 117 lit and 83 unlit; each drawing of the coin field has 85 lit
  circles over a dot pattern; the ring has 12 circles; the four buttons carry
  1868, 585, 367 and 85.
- Share image https://zodiacs.org/assets/og/v2/thesis.png fetched and read:
  "The Thesis / Why Zodiacs Matter / ZODIACS · ORG / The Registry · An essay
  on twelve zodiac coins · N° 10". No "2026".

## R2. YouGov

- https://yougov.com/en-us/articles/42292-one-four-americans-say-they-believe-astrology
  HTTP 200. The drawer's `today.yougov.com` link answers 301 to it.
- "When asked if they know what their astrological sign is and offered the 12
  signs as options, 90% of Americans select one of them, while 10% say they
  aren't sure what their sign is. Even though adults under 30 are more likely
  to say they believe in astrology, people in this age group are also less
  likely to say they know their astrological sign".
- "(27%)" believe; title "One in four Americans say they believe in
  astrology"; "3,472 U.S. adults interviewed online on April 21 - 22, 2022".
- The article gives no figure for the overlap between the 90% and the 27%.

## R3. CoinGecko

- https://www.coingecko.com/research/publications/average-lifespan-of-pumpfun-tokens
  HTTP 200. "The Average Lifespan of Pump.fun Memecoins Is Less Than a Day".
  "Updated June 23 2026".
- "68.67% (12.8M) of all tokens launched on Pump.fun since January 2024
  recorded their last trade on the same day they were created ... We examined
  over 18.67M tokens launched on the platform, excluding only tokens that had
  no trading activity at all since inception."
- "same-day and 1-day deaths account for 14.99M tokens, or 80.37% of all
  launches." "4.55%" survived longer than 90 days. Table total 18,675,645.
  "January 14, 2024 to June 18, 2026".
- "our 90+ days survival figures are likely understated, as we only track
  Pump.fun bonding curve trades and not external DEX activity such as
  Raydium. Tokens launched before PumpSwap that graduated and are still
  actively trading on Raydium would be incorrectly classified into an earlier
  bucket."
- Arithmetic for the dot field: 18,675,645 / 10,000 = 1,867.6, so 1,868
  dots; 31.33% of 1,868 = 585.2; 19.63% = 366.7; 4.55% = 85.0.

## R4. Posts on X

Read through X's public syndication endpoint; records `records/tweet-*.json`.

- Portnoy, id 1891528769770279114, 2025-02-17T16:42:56Z: "Anybody wanna buy
  some fake Libra? Warning. This is a meme coin. I bought it by accident. It
  will be volatile. It will eventually go to zero. It may rip. It may tank.
  Don't put on more than you can lose!!! It's a collectible
  7Zt2KUh5mkpEpPGcNcFy51aGkh9Ycb5ELcqRH1n2GmAe". Views 3,140,977 from
  `api.fxtwitter.com` on 13 Nov (`records/fx-portnoy.json`), the same figure
  as on 11 Nov.
- Portnoy, id 1891546878350618936, 2025-02-17T17:54:53Z, quoting "Did portnoy
  really ape the wrong libra coin while trying to trade the Milei retweet".
- @wantonwallet, id 1812520143638962302, 2024-07-14T16:10:51Z: "Bubblemaps is
  FUD btw. The '97% cluster' is literally false. ..."
- @0xfriggin, ids 1809610788296093843 (2024-07-06T15:30:07Z, "Coins are up
  about 2x") and 1810351665045975133 (2024-07-08T16:34:06Z, "$88k if you
  count $ZODIAC").
- The second Portnoy post (id 1891545382481432591) was not fetched again.

## R5. Smithsonian Magazine

- https://www.smithsonianmag.com/history/how-are-horoscopes-still-thing-180957701/
  HTTP 200. Found again: "August 24, 1930"; "widely credited"; "wasn't the
  first of its kind"; "Following the interest the public showed"; "the first
  real newspaper horoscope column, was born"; "By 1937".

## R6. Zodiacs.org disclosure page

- https://zodiacs.org/disclosure/ HTTP 200. Found again: "Operator update
  (2026-08-23)"; "does not establish who controls token deployment"; "The
  operator attests (2026-08-02) to holding positions in one or more of the
  twelve Registry assets, and to receiving no referral, platform-fee,
  liquidity, or marketplace compensation for any trade reached through the
  site"; "not enumerated"; "All twelve receipts are dated 5 July 2024";
  "does not connect wallets, request signatures"; "astrofolio.xyz redirects
  to that page"; "Registry classification only".
- Not on the page: "Wormhole", "fees", "confirmation", "10 Nov 2026",
  "2026-11-10".

## R7. Registry file

- https://zodiacs.org/registry/zodiacs.registry.json HTTP 200. "Zodiacs
  Official Registry", version 0.2.0, twelve assets, each with a Solana
  address and a Base representation. Leo
  `8Cd7wXoPb5Yt9cUGtmHNqAEmpMDrhfcVqnGbLC48b8Qm`; Libra
  `7Zt2KUh5mkpEpPGcNcFy51aGkh9Ycb5ELcqRH1n2GmAe`.

## R8. Zodiacs.org home, apps, about, Fomo page and locales

- https://zodiacs.org/ : "Free birth charts, moon signs, compatibility, and
  horoscopes"; navigation "Official Zodiac token collection"; `hreflang` en,
  es, fr, it, pt-BR, ru, x-default.
- https://zodiacs.org/apps/ : "Made for ChatGPT and Claude. Directory
  listings are currently in review."
- https://zodiacs.org/about/ : "formed on August 11, 2026"; "Zodiacs LLC owns
  and operates this website"; "maintained by automated systems, without a
  traditional human editorial staff".
- https://zodiacs.org/fomo/ : "no referral deal with fomo and earns nothing
  when you trade there"; "Zodiacs.org adds nothing and receives nothing."
- `/fr/horoscopes/`: title "Contenu en anglais", heading "Cette page n'est
  pas encore traduite.", `noindex`. `/it/horoscopes/`: "Contenuto in
  inglese", "Questa pagina non è ancora tradotta.", `noindex`.
  `/es/horoscopes/`: "Horóscopos de hoy, 13 de noviembre de 2026".
  `/pt/horoscopes/`: "Horóscopos de hoje, 13 de novembro de 2026".
  `/horoscopes/`: "Daily Horoscopes | November 13, 2026". `/ru/` HTTP 200;
  `/ru/horoscopes/` HTTP 404.

## R9. Astrofolio, its old domain, and Solflare

- https://zodiacs.org/astrofolio/ HTTP 200: "may fall to zero"; thirteen
  links of the form `fomo.family/coin?address=...&chainId=...`, no other
  parameter.
- `curl -I https://astrofolio.xyz/` and `https://www.astrofolio.xyz/`: both
  `HTTP/2 301`, `location: https://zodiacs.org/`
  (`records/redirect-*.txt`).
- Solflare page for the Leo mint: title "LEO Price USD | Live Leo Chart &
  Market Data | Solflare".

## R10. The public ledger

Read from `api.mainnet-beta.solana.com`, `solana-rpc.publicnode.com` and
`mainnet.base.org` at 2026-11-13T09:01Z. Record: `records/onchain.json`
(script `records/tools/chain3.py`).

- `getAccountInfo` on the twelve mints: `mintAuthority` null and
  `freezeAuthority` null on all twelve; owner program SPL Token; the twelve
  supplies match the page to six decimals and sum to 11,998,193,931.511.
- `getTransaction` on the twelve origin signatures listed on the disclosure
  page: block times 2024-07-05T17:54:34Z to 18:38:08Z; fee payer of all
  twelve `DUK1VN3WatYKsVLwRX2JxfJfaKX6bDXvijpPtT28ed13`; programs called:
  System, Associated Token, SPL Token, Metaplex Token Metadata, Compute
  Budget. The Pump.fun program (`6EF8rrec...F6P`) is in none of them.
- That wallet: a system account holding 0.0269 SOL.
- `getSignaturesForAddress` on the twelve pool addresses: the newest
  transaction on each falls between 2026-11-13T06:26:57Z and 06:47:43Z.
- Four newest transactions opened. Capricorn: logs a swap, also touches the
  Virgo pool. Leo: logs a swap, also touches the Libra pool. Virgo: logs a
  swap. Taurus: also touches the Scorpio pool; no log line containing "swap"
  was found in it. Four different signers.
- `eth_call symbol()` on the twelve Base contracts: ARIES, TAURUS, GEMINI,
  CANCER, LEO, VIRGO, LIBRA, SCORPIO, SAGIT, CAPRICORN, AQUARIUS, PISCES.
- `getTokenLargestAccounts` was refused again (HTTP 403), so top-ten shares
  could not be read.

## R11. The site's own data files

- https://zodiacs.org/assets/distribution.json : `generatedAt`
  2026-08-24T07:41:56Z, `capturedAt` 2026-08-03; `top10Pct` 22.53 (Gemini)
  to 31.80 (Capricorn), median 27.3; four signs observed 24 Aug, eight
  carried from 3 Aug; "Token accounts are not verified people or unique
  wallet owners". Record: `records/distribution.json`.
- https://zodiacs.org/assets/pulse.json : `capturedAt` 2026-11-09;
  `twelveAvgDay` 14,089; Trends averages 64, 7, 36, 44; `estimates` dated
  "2026-06", "Editorial estimates from public cumulative hashtag and
  search-volume figures". Record: `records/pulse.json`.
- https://zodiacs.org/archive/feed.json : nine entries, 2024-01-01 to
  2025-10-29.

## R12. Market data

- Dexscreener, `api.dexscreener.com/tokens/v1/solana/<12 mints>`,
  2026-11-13T09:05:04Z: twelve Raydium pairs at the twelve pool addresses the
  page lists. Liquidity $9,883 to $18,379. 24-hour volume $16.16 (Gemini) to
  $384.95 (Scorpio); five of twelve under $50; total $1,793.45. Trades in 24
  hours 2 to 13 per coin, 77 in all. Market value $44,260 to $125,258 per
  coin, $673,422 for all twelve. Pair creation 2024-07-05T19:03:20Z to
  19:08:47Z. Record: `records/dexscreener-tokens.json`.
- Jupiter token index, `lite-api.jup.ag/tokens/v2/search`, same minute.
  Holder counts: Leo 2,818; range 2,341 (Pisces) to 6,681 (Libra).
  `topHoldersPercentage` 17.4% to 23.3%. `devMints` is now 1 for ten of the
  twelve and 24 for Aries and Capricorn; on 11 Nov it was 24 for each. That
  field moved in two days and its definition was not looked up. Record:
  `records/jup-tokens.json`.

## R13. Wikimedia, the old chart's peak

- Pageviews API, `Virgo_(astrology)`, user traffic, daily, 20 to 25 Mar
  2026: 1,095; 1,177; 1,775; 22,543; 5,626; 1,675
  (`records/wm-20260323-virgo.json`). The chart that printed this peak is
  gone (F7).

## R14. npm and the Internet Archive

- `api.npmjs.org/downloads/point/2026-10-11:2026-11-09/@zodiacs/sdk`: 593.
  `.../last-month/`: 564 for 2026-10-13 to 2026-11-11.
- `registry.npmjs.org/@zodiacs/sdk`: created 2026-06-05; versions 1.0.0-rc.1,
  1.0.0 (both 2026-06-05) and 1.0.1 (2026-06-07).
- Wayback CDX for `zodiacs.org` from 2024-01-01, one row a day
  (`records/wayback-cdx.json`): 13 rows; the ten from 20240726 to 20250719
  share the digest `7HMQKXUYPBZDUEQGHND5JINF6WGD5MPJ`; 20260610, 20260710 and
  20261011 each have their own (16,351, 26,463 and 66,063 bytes compressed).
  Largest gap 20250719 to 20260610, 326 days.
- Capture 20240726200056 opened again: 114 bytes,
  `<script>window.onload=function(){window.location.href="/lander"}</script>`
  (`records/wb-20240726200056.html`).
- Captures 20250719223440 and 20260610083004: the Archive answered HTTP 429
  to both. Not retried. See "Not opened" below.
- CDX for `zodiacs.org/thesis/`: first capture 20260713122037.

## R15. Reference sources

- USNO, `aa.usno.navy.mil/api/seasons?year=2026`: Equinox 20 Mar 14:46;
  Solstice 21 Jun 08:24; Equinox 23 Sep 00:05; Solstice 21 Dec 20:50 (UT).
- Pew Research Center, 2025-05-21: "at least once or twice a year (28%)";
  survey "Oct. 21 to 27, 2024".
- Unicode `DerivedAge.txt` (17.0.0): "261A..266F ; 1.1"; publication dates:
  "1.1.0 1993 June".
- Sensor Tower: "The top 10 astrology and zodiac-based apps of 2019 earned
  nearly $40 million in the U.S. during 2019".
- NASA's eclipse tables were not reopened: the eclipse markers are off the
  page (F9).

## R16. Wikipedia, "Zodiac"

- Wikitext of revision 1383120905 (2026-11-01T02:25:28Z), through the
  MediaWiki API. "Around the end of the fifth century BC, Babylonian
  astronomers divided the ecliptic into 12 equal 'signs'"; "introduced
  between 409 and 398 BC"; "probably within a very few years of 401 BC";
  "The Dendera zodiac, a relief dating to c. 50 BC, is the first known
  depiction of the classical zodiac of twelve signs" (tagged "citation
  needed", May 2025).

## R17. Repository history, `zodiacs-org/site`

Read from the local clone after `git fetch origin main`; `origin/main` was
`210622bfe` (2026-11-13 15:38 +07).

- First commit `6370da541`, 2026-05-27, "Initial zodiacs.org repo".
- `thesis/index.html` (the page's path before July): first commit
  `b28116008`, 2026-06-10T13:04:42Z; seven more commits by 2026-06-11.
- `public/thesis/index.html`: newest commit `f9f3f5f15`, "Thesis graphics:
  people as dots, the coin field, and each sign's own season (#995)", merged
  2026-11-12T17:44:03Z (`gh pr view 995`); before it `47fee79f8`, 11 Nov.
- `public/assets/distribution.json`: eight commits, 2026-07-05 to
  2026-08-24, none later.
- `public/assets/pulse.json`: "Refresh pulse data" on 2026-07-13, 07-27,
  08-10, 08-24 and 11-09.
- `public/thesis/thesis-test.json` at `99a2c2eb` (2026-07-23) against today:
  `preregisteredAt` 2026-07-23; cohort, `uniqueClaimant`, `exclusions`,
  thresholds and verdict rule identical; only the start row, the comment and
  a `startMissed` note differ.

## R20. The season chart's data, recomputed

- Reduced file: https://zodiacs.org/thesis/thesis-seasons.json (live,
  byte-identical to `origin/main`). `years` 2016 to 2025; `signYears` 120;
  `liftedYears` 118; `liftRange` 45 to 80; per sign a `lift`, a
  `yearsLifted`, a 73-point `curve` and a `season` span. Its comment: "Each
  curve is one sign article on a typical day of the year (median across the
  years of views divided by that sign-year median day), in 73 five-day bins
  from 1 January. lift compares the mean of that ratio inside the sign's own
  season with the rest of the year; seasons are the Sun's solved sign entries
  each year (astronomy-engine), taken at noon UTC."
- Raw file on `main`: `docs/thesis-evidence/2026-11-12/wikimedia-per-sign.json`,
  `fetchedAt` 2026-11-12T14:17:37.367Z, SHA-256 `4d7d41ae...2165`, the hash
  the reduced file names. Twelve request URLs of the form
  `.../per-article/en.wikipedia/all-access/user/<Sign>_%28astrology%29/daily/2016010100/2026111100`.
- Builder: `scripts/build-thesis-figures.mjs` on `main`, read. The per-year
  rule for `yearsLifted` is `median(in-season days) > median(out-of-season
  days)` within a calendar year.
- Fetched again in this run, 2026-11-13T08:57Z: the same twelve API queries
  to 2026-11-12, HTTP 200 each (`records/wikimedia-per-sign-sha256.txt`).
  All 43,836 daily values for 2016 to 2025 equal the raw file's; no day is
  missing.
- Recomputed with `records/tools/seasons_check.py`, which takes the Sun's
  sign at noon UTC from a low-precision solar-longitude formula (Meeus,
  *Astronomical Algorithms*, ch. 25), not from the site's engine. Output:
  `records/seasons-check-output.txt`.

| Sign | Page | Recomputed, file's measure | Plain read counts | By medians | Years lifted | Own window's rank of 12 | Highest typical day |
|---|---|---|---|---|---|---|---|
| Aries | 51 | 51.04 | 48.15 | 47.40 | 9 | 1 | 21 Mar |
| Taurus | 50 | 49.81 | 47.62 | 48.66 | 10 | 1 | 20 Apr |
| Gemini | 45 | 45.19 | 44.17 | 42.44 | 10 | 1 | 21 May |
| Cancer | 53 | 52.95 | 54.11 | 49.17 | 10 | 1 | 21 Jun |
| Leo | 71 | 70.93 | 69.95 | 74.95 | 10 | 1 | 23 Jul |
| Virgo | 64 | 64.10 | 66.11 | 61.09 | 10 | 1 | 23 Aug |
| Libra | 63 | 62.84 | 64.90 | 58.48 | 10 | 1 | 23 Sep |
| Scorpio | 61 | 60.68 | 61.46 | 59.53 | 10 | 1 | 23 Oct |
| Sagittarius | 52 | 52.13 | 53.41 | 50.79 | 10 | 1 | 22 Nov |
| Capricorn | 77 | 77.01 | 72.15 | 72.10 | 10 | 1 | 22 Dec |
| Aquarius | 80 | 80.15 | 71.53 | 73.55 | 9 | 1 | 20 Jan |
| Pisces | 76 | 75.66 | 67.00 | 74.48 | 10 | 1 | 19 Feb |

  "File's measure": mean of (day's reads / that year's median day) in season
  over the same out of season, minus one. "Plain read counts": mean reads a
  day in season over mean reads a day out of season, all ten years pooled.
  "By medians": the first measure with medians in place of means.
- Sign-years lifted: 118 of 120 by the file's median rule; the misses are
  Aries 2020 (in-season median 3,691, out-of-season 4,802) and Aquarius 2016
  (2,804 against 2,928). 119 of 120 if means are compared.
- Curves rebuilt: maximum difference from the live file 0.000 on all twelve.
  Season spans: the formula gives the same first and last day of 2025 for
  all twelve. Highest five-day step: inside the season for ten signs;
  Aries (17 to 21 Mar) and Leo (20 to 24 Jul) have two of five days inside.
- The page's script table of sign entries, 2026, against the formula:
  Aquarius 01:44 / 01:41; Aries 14:45 / 14:37; Cancer 08:25 / 08:20; Libra
  00:05 / 00:09; Scorpio 09:38 / 09:40; Sagittarius 07:23 / 07:23; Capricorn
  20:50 / 20:49 (UTC). The formula is good to a few minutes; R15 is the
  better check for the four seasons.

## R21. The page as a browser draws it

- Headless Chromium (Playwright), reduced motion, 1280 by 900, loaded
  https://zodiacs.org/thesis/ at 2026-11-13T08:56:15Z, HTTP 200. Record:
  `records/live-thesis-rendered.json`; pictures `records/rendered-*.png`.
- Season readout after load: "Today the Sun is in Scorpio. Scorpio's article
  is read 61% more in its own season than in the rest of the year."
- Each of the twelve rows chosen in turn: "<Sign>'s article is read N% more
  in its own season than in the rest of the year." with N = 77, 80, 76, 51,
  50, 45, 53, 71, 64, 63, 61, 52.
- Coin field buttons pressed in turn: "1,868 of 1,868 dots still lit",
  "585 of 1,868 ...", "367 of 1,868 ...", "85 of 1,868 ...".
- Requests made by the page: its own fonts and three of its JSON files. The
  Pulse block in the drawer was not exercised.

## Not opened in this run

| Source | What happened | Effect |
|---|---|---|
| Internet Archive captures 20250719223440 and 20260610083004 | HTTP 429 ("flagged as suspected abusive bot traffic"). Not retried. | I11 rests on the index (same digests as before) and on one reopened capture. The title of the 2026-06-10 capture was read in the earlier round, not in this one. |
| Solscan token page | HTTP 200 with an empty application shell, no figures | Holder count from Jupiter (R12); pool burns and top-ten shares stay NOT VERIFIED. |
| Allied Market Research, Axios | HTTP 403, one attempt each | Not opened. The page prints no figure from them (L6). |
| `x.com/search?q=astrofolio dead bag` | Needs a login | Not opened. Still the only receipt for the "dead bag" entry. |
| Google Trends | Not opened | Pulse search figures stay NOT VERIFIED (M4). |
| Basescan, Wormhole documentation | Not opened | Bridge mechanism stays NOT VERIFIED (K11, Q10). |
| The web searches behind "no qualifying results" | Not rerun | H11, I3, I4, I8, Q3 stay NOT VERIFIED. |
| The operator "statement of 10 Nov 2026" named in the claims file | Not published anywhere found | The dated public statements are still 2 Aug and 23 Aug 2026 (R6). |
| YouGov's full survey tables | Not looked for | P6 is checked against the article only. |
