# Sources opened in this job

All fetches were made on 2026-11-11 between 15:56 and 16:10 UTC from the
job's own machine, with `curl`, public JSON APIs, public RPC endpoints, the
GitHub API and one web-fetch helper. Nothing here is taken from the claims
file, a Linear issue or an earlier review. Where a cited source could not be
opened, it is listed under S18 and the claim is marked NOT VERIFIED or checked
against a different source that is named.

Small raw records are committed in `records/`; their hashes are in
`records/SHA256SUMS-committed.txt` and can be checked from this folder. Large
HTML captures stay in the job's scratch folder; `records/SHA256SUMS.txt`
lists the hashes of all 48 scratch files by their scratch names, so it cannot
be checked from the committed folder alone.

A fix round on 2026-11-13 reopened the sources behind the breaker review's
findings. Those fetches are S19.

## S1. The live page and its published files

- https://zodiacs.org/thesis/ fetched 2026-11-11T15:56:38Z, HTTP 200,
  `last-modified: Wed, 11 Nov 2026 15:54:37 GMT`, 328,222 bytes, SHA-256
  `29d2e8024c5770eca61ef1f2f44203075256db80376cf39b1d84f2870a21c5c2`.
  Headers: `records/live-headers.txt`. Visible text, including meta tags,
  chart text and hover titles: `records/live-thesis.txt`.
- The live text matches the repository file at `47fee79f` apart from one
  flag-gated link ("View a wallet collection") that the build adds.
- Published JSON beside the page, each fetched live and byte-identical to the
  repository copy: S1a `thesis-attention.json`, S1b `thesis-charts.json`,
  S1c `thesis-claims.json` (29 entries, `reviewedAt` 2026-11-11; most entries carry `checkedAt` 2026-11-10), S1d
  `thesis-candidacy.json`, S1e `thesis-candidacy-evidence.json`, S1f
  `thesis-disclosure.json`, S1g `thesis-test.json`, S1h
  `thesis-history.json` (`reviewedAt` 2026-07-31).
- Share image https://zodiacs.org/assets/og/v2/thesis.png opened and read:
  "The Thesis / Why Zodiacs Matter / ZODIACS · ORG / The Registry · An essay
  on twelve zodiac coins · N° 10".

## S2. YouGov

- https://yougov.com/en-us/articles/42292-one-four-americans-say-they-believe-astrology
  (the `today.yougov.com` link in the drawer redirects to it). HTTP 200.
- Title: "One in four Americans say they believe in astrology".
- "a little more than one-quarter of Americans (27%) ... say that they believe
  in astrology, or that the position of the stars and planets influences
  people's lives. About half of Americans (51%) say they don't believe in
  astrology and 22% are unsure."
- "When asked if they know what their astrological sign is and offered the 12
  signs as options, 90% of Americans select one of them, while 10% say they
  aren't sure what their sign is."
- "Methodology: This Daily Agenda survey was conducted by YouGov using a
  nationally representative sample of 3,472 U.S. adults interviewed online on
  April 21 - 22, 2022."

## S3. CoinGecko

- https://www.coingecko.com/research/publications/average-lifespan-of-pumpfun-tokens
  HTTP 200. Title: "The Average Lifespan of Pump.fun Memecoins Is Less Than a
  Day". Byline: "Updated June 23 2026".
- "68.67% (12.8M) of all tokens launched on Pump.fun since January 2024
  recorded their last trade on the same day they were created ... We examined
  over 18.67M tokens launched on the platform, excluding only tokens that had
  no trading activity at all since inception. Overall, only 4.55% (850K) of
  tokens survived longer than 90+ days."
- "Together, same-day and 1-day deaths account for 14.99M tokens, or 80.37% of
  all launches."
- "our 90+ days survival figures are likely understated, as we only track
  Pump.fun bonding curve trades and not external DEX activity such as Raydium.
  Tokens launched before PumpSwap that graduated and are still actively
  trading on Raydium would be incorrectly classified into an earlier bucket."
- "The dataset covers 18.67 million tokens launched on Pump.fun from January
  14, 2024 to June 18, 2026, out of over 19 million total tokens created on
  the platform." Table total: 18,675,645.
- "Lifespan is defined as the number of calendar days between a token's
  creation date and its last recorded Pump.fun bonding curve trade."

## S4. Posts on X

X's own pages need a login, so each post was read through X's public
syndication endpoint (`cdn.syndication.twimg.com/tweet-result?id=...`), which
returns the post text and time. Records: `records/tweet-*.json`.

- Portnoy, id 1891528769770279114, 2025-02-17T16:42:56Z, full text:
  "Anybody wanna buy some fake Libra? Warning. This is a meme coin. I bought
  it by accident. It will be volatile. It will eventually go to zero. It may
  rip. It may tank. Don't put on more than you can lose!!! It's a collectible
  7Zt2KUh5mkpEpPGcNcFy51aGkh9Ycb5ELcqRH1n2GmAe" plus a video.
  Views: 3,140,977 on 2026-11-11, from `api.fxtwitter.com` (the syndication
  endpoint carries no view count). Record: `records/fx-portnoy.json`.
- Portnoy, id 1891545382481432591, 2025-02-17T17:48:57Z: "I'm in baby. I gotta
  be largest share holder! It's written in the stars!!!! Always been a huge
  astrology guy. Everybody knows this!", quoting @astrofoliosol
  (2025-02-17T17:10:58Z): "Both versions. Website is going to make it
  seamless for people to invest in either $LIBRA, or any of the other 11
  zodiac signs. It was, after all, always written in the stars."
- Portnoy, id 1891546878350618936, 2025-02-17T17:54:53Z: "Or I'm a huge fan of
  astrology and have always thought our fate was written in the stars. Feels
  good to be on the right side of history with this one.", quoting
  @karbonbased: "Did portnoy really ape the wrong libra coin while trying to
  trade the Milei retweet. Bro pumped the astrofolio libra".
- @wantonwallet, id 1812520143638962302, 2024-07-14T16:10:51Z: "Bubblemaps is
  FUD btw. The '97% cluster' is literally false. Bubblemaps does not recognize
  Raydium Vault Authority #2 by default. Should be very obvious if you know
  how to use the Solana blockchain. Learn how to actually use Bubblemaps
  before fudding."
- @0xfriggin, id 1809610788296093843, 2024-07-06T15:30:07Z: "Astrofolio
  update: Coins are up about 2x. $CANCER has emerged as the bluechip ...",
  quoting his own earlier post "Dropping this astrofolio in case we bottomed
  and this becomes a sendooor."
- @0xfriggin, id 1810351665045975133, 2024-07-08T16:34:06Z: "Current top mcap
  signs are: 1) $CANCER - $444k 2) $LEO - $265k 3) $GEMINI - $194k. The rest
  trade from 160k down to $100k, $88k if you count $ZODIAC".

## S5. Smithsonian Magazine

- https://www.smithsonianmag.com/history/how-are-horoscopes-still-thing-180957701/
  HTTP 200.
- "The first real newspaper horoscope column is widely credited to R.H.
  Naylor ... Cheiro, however, wasn't available in August 1930 to do the
  horoscope for the recently born Princess Margaret, so Britain's Sunday
  Express newspaper asked Naylor."
- "On August 24, 1930, three days after the Princess's birth, Naylor's
  published report predicted that her life would be 'eventful'".
- "But though it wasn't the first of its kind, Naylor's article was a tipping
  point ... Following the interest the public showed in the Princess Margaret
  horoscope, the paper decided to run several more forecasts from Naylor."
- "The then-editor of the paper offered Naylor a weekly column ... and 'What
  the Stars Foretell', the first real newspaper horoscope column, was born."
- "By 1937, he'd hit upon the idea using 'star signs', also known as 'sun
  signs', the familiar zodiac signs that we see today."

## S6. Zodiacs.org disclosure page

- https://zodiacs.org/disclosure/ HTTP 200.
- Operator row: "Operator update (2026-08-23): The operator controls the
  zodiacs.org domain, repository, deployments, Registry content, and the
  official Astrofolio consumer experience at zodiacs.org/astrofolio.
  astrofolio.xyz redirects to that page and is not a separate consumer
  surface. This update does not establish who controls token deployment or
  administrative authorities, treasury, liquidity, or market activity."
  Status: "Operator attested, not independently verified".
- Economic interest row: "The operator attests (2026-08-02) to holding
  positions in one or more of the twelve Registry assets, and to receiving no
  referral, platform-fee, liquidity, or marketplace compensation for any
  trade reached through the site." "assets, wallets, amounts, and any lockup,
  vesting, or disposal policy are not enumerated in it". "As of 20 July 2026,
  the top-ten token-account share ranged from 23.0% to 30.6% across the
  twelve assets, with a median of 27.2%."
- Origin row: "All twelve receipts are dated 5 July 2024", with twelve
  Solscan transaction links (signatures re-read on chain in S10).
- Read-only row: "Zodiacs.org does not connect wallets, request signatures,
  or submit transactions."
- "'Official' is a Registry classification only".
- The page has no treasury row.

## S7. Registry file

- https://zodiacs.org/registry/zodiacs.registry.json HTTP 200. Name "Zodiacs
  Official Registry", version 0.2.0, twelve assets, each with a native Solana
  address and a bridged Base address. Leo:
  `8Cd7wXoPb5Yt9cUGtmHNqAEmpMDrhfcVqnGbLC48b8Qm`. Libra:
  `7Zt2KUh5mkpEpPGcNcFy51aGkh9Ycb5ELcqRH1n2GmAe`.

## S8. Zodiacs.org home, apps, about and locales

- https://zodiacs.org/ HTTP 200: "Free birth charts, moon signs,
  compatibility, and horoscopes: accurate, private, and easy to understand."
  Navigation: "Astrofolio: Official Zodiac token collection". `hreflang`
  values: en, es, fr, it, pt-BR, ru.
- `/es/horoscopes/`, `/pt/horoscopes/`, `/fr/horoscopes/`, `/it/horoscopes/`
  each HTTP 200. The first pass did not read the pages; the French and
  Italian ones are untranslated placeholders (S19a). `/ru/` HTTP 200, `/ru/horoscopes/` HTTP 404.
- https://zodiacs.org/apps/ HTTP 200: "Made for ChatGPT and Claude. Directory
  listings are currently in review." Availability list: "ChatGPT: Directory
  listing in review. Claude: Directory listing in review. Grok: Template
  available."
- https://zodiacs.org/about/ HTTP 200: "Zodiacs.org is the official website
  of Zodiacs LLC, a New Mexico limited liability company formed on August 11,
  2026. Zodiacs LLC owns and operates this website". "Zodiacs.org is a
  Zodiacs LLC publication maintained by automated systems, without a
  traditional human editorial staff."

## S9. Astrofolio, its old domain, and Solflare

- https://zodiacs.org/astrofolio/ HTTP 200: "Find yours, then buy it in the
  Fomo app." Buy links have the form
  `https://fomo.family/coin?address=<mint>&chainId=1399811149`, with no
  referral parameter. "Prices can swing sharply and may fall to zero."
- `curl -I https://astrofolio.xyz/` and `https://www.astrofolio.xyz/`: both
  `HTTP/2 301`, `location: https://zodiacs.org/`.
- https://www.solflare.com/prices/leo/8Cd7wXoPb5Yt9cUGtmHNqAEmpMDrhfcVqnGbLC48b8Qm/
  HTTP 200, title "LEO Price USD | Live Leo Chart & Market Data | Solflare".

## S10. The public ledger

Read directly from public RPC endpoints (`api.mainnet-beta.solana.com`,
`solana-rpc.publicnode.com`, `mainnet.base.org`) at 2026-11-11T16:04Z.
Record: `records/onchain.json`.

- `getAccountInfo` on each of the twelve mints: `mintAuthority` null and
  `freezeAuthority` null on all twelve. Supplies match the page to six
  decimals on all twelve; the sum is 11,998,193,931.511.
- `getTransaction` on the twelve origin signatures from S6: block times
  2024-07-05T17:54:34Z to 18:38:08Z. The fee payer of all twelve is
  `DUK1VN3WatYKsVLwRX2JxfJfaKX6bDXvijpPtT28ed13`. Programs called: System,
  Associated Token, SPL Token, Metaplex Token Metadata. No Pump.fun program.
- `getAccountInfo` on that wallet: a system account holding 0.0269 SOL.
- `getSignaturesForAddress` on the twelve pool addresses: newest transaction
  per pool between 2026-11-10T18:09:52Z (Libra) and 2026-11-11T14:05:01Z.
- The newest transaction on three pools was opened. All three call the
  Jupiter aggregator and log a swap. The Taurus one also touches the Cancer
  pool in the same transaction. The Taurus and Leo ones share a signer
  (`2yqDqp...V5W3`).
- `eth_call symbol()` on the twelve Base contracts: ARIES, TAURUS, GEMINI,
  CANCER, LEO, VIRGO, LIBRA, SCORPIO, SAGIT, CAPRICORN, AQUARIUS, PISCES.
- `getTokenLargestAccounts` was refused by all three Solana endpoints tried,
  so top-ten shares could not be re-read.

## S11. The site's own data files

- https://zodiacs.org/assets/distribution.json HTTP 200. `generatedAt`
  2026-08-24T07:41:56Z, `capturedAt` 2026-08-03. Four signs observed on
  2026-08-24, eight "carried-forward" from 2026-08-03. `top10Pct`: Aries
  29.75, Taurus 25.88, Gemini 22.53, Cancer 25.99, Leo 27.87, Virgo 27.45,
  Libra 27.16, Scorpio 25.98, Sagittarius 28.11, Capricorn 31.80, Aquarius
  25.80, Pisces 28.96. Median 27.3. Method note: "Token accounts are not
  verified people or unique wallet owners". Record:
  `records/distribution.json`.
- https://zodiacs.org/assets/pulse.json HTTP 200, `capturedAt` 2026-11-09.
  `estimates.capturedAt` "2026-06", `by` "Editorial estimates from public
  cumulative hashtag and search-volume figures": X about 250K, Instagram about
  80K, TikTok about 100M, Google 10M+. Record: `records/pulse.json`.

## S12. Market data

- Dexscreener, `api.dexscreener.com/tokens/v1/solana/<12 mints>`, fetched
  2026-11-11T16:03:53Z. Twelve Raydium pairs returned, at the twelve pool
  addresses the page lists. Liquidity $10,770 to $19,234. 24-hour volume
  $2.92 (Taurus) to $385.35 (Gemini); eight of twelve under $30; total
  $687.59. Trades in 24 hours: 1 to 12 per coin, 52 in all. Market value
  $50,651 to $130,815 per coin; $731,962 for all twelve. Pair creation times
  2024-07-05T19:03:20Z to 19:08:47Z. Record:
  `records/dexscreener-tokens.json`.
- Jupiter token index, `lite-api.jup.ag/tokens/v2/search`, same time. Holder
  counts: Aries 2,432, Taurus 2,577, Gemini 3,369, Cancer 2,493, Leo 2,819,
  Virgo 2,444, Libra 6,681, Scorpio 2,971, Sagittarius 2,874, Capricorn
  2,967, Aquarius 2,814, Pisces 2,340. Each entry also carries
  `mintAuthorityDisabled: true`, `freezeAuthorityDisabled: true` and
  `devMints: 24`, and a `topHoldersPercentage` of 17.4% to 23.3% across the
  twelve. That field's definition was not looked up; it appears to leave out
  the pool, so it is not comparable with the page's top-ten figure. Record:
  `records/jup-tokens.json`.

## S13. Wikimedia

- Wikimedia REST pageviews API, en.wikipedia, all-access, user traffic, daily,
  2026-03-23, for the twelve articles `Aries_(astrology)` to
  `Pisces_(astrology)`. Sum 38,090. Record: `records/wikimedia-20260323.txt`.

## S14. npm and the Internet Archive

- `api.npmjs.org/downloads/point/2026-10-11:2026-11-09/@zodiacs/sdk`: 593.
  `.../point/last-month/@zodiacs/sdk` on 11 Nov: 567 (2026-10-12 to
  2026-11-10). Record: `records/npm-last-month.json`.
- `registry.npmjs.org/@zodiacs/sdk`: created 2026-06-05; versions 1.0.0-rc.1
  (2026-06-05), 1.0.0 (2026-06-05), 1.0.1 (2026-06-07); maintainer "zodiacs".
- Wayback CDX query from the page's evidence file, rerun: 13 rows, first
  20240726, last 20261011; largest gap 20250719 to 20260610, 326 days.
  Record: `records/wayback-cdx.json`. The first pass did not open the
  captures. See S19b: ten of the thirteen are a parked-domain page.

## S15. Reference sources

- S15a USNO, `aa.usno.navy.mil/api/seasons?year=2026`: Equinox 20 Mar 14:46;
  Solstice 21 Jun 08:24; Equinox 23 Sep 00:05; Solstice 21 Dec 20:50 (UT).
- S15b NASA eclipse tables, `eclipse.gsfc.nasa.gov/SEdecade/SEdecade2021.html`
  and `LEdecade/LEdecade2021.html`: greatest eclipse (Terrestrial Dynamical
  Time) 2026 Feb 17 12:13:05; 2026 Aug 12 17:47:05; 2026 Mar 03 11:34:52;
  2026 Aug 28 04:14:04.
- S15c Pew Research Center, published 2025-05-21,
  https://www.pewresearch.org/religion/2025/05/21/3-in-10-americans-consult-astrology-tarot-cards-or-fortune-tellers/
  : "The share of Americans who say they consult astrology or a horoscope at
  least once or twice a year (28%) parallels the share who say they believe
  in astrology (27%)." Survey "from Oct. 21 to 27, 2024".
- S15d Unicode, https://www.unicode.org/Public/17.0.0/ucd/DerivedAge.txt :
  "261A..266F ; 1.1 # [86] BLACK LEFT POINTING INDEX..MUSIC SHARP SIGN"
  (covers U+2648 to U+2653). https://www.unicode.org/history/publicationdates.html
  : "1.1.0 1993 June".
- S15e Sensor Tower,
  https://sensortower.com/blog/astrology-apps-2019-revenue-downloads : "The
  top 10 astrology and zodiac-based apps of 2019 earned nearly $40 million in
  the U.S. during 2019".

## S16. Wikipedia, "Zodiac"

- https://en.wikipedia.org/wiki/Zodiac , revision reviewed 2026-11-01, read by
  the web-fetch helper. A tertiary source, opened because the page cites none
  for the age of the signs.
- "Around the end of the fifth century BC, Babylonian astronomers divided the
  ecliptic into 12 equal 'signs'". "the zodiac was introduced between 409 and
  398 BC", "probably within a very few years of 401 BC".
- "The Dendera zodiac, a relief dating to c. 50 BC, is the first known
  depiction of the classical zodiac of twelve signs."

## S17. GitHub API, `zodiacs-org/site`

- Repository public, `created_at` 2026-05-27T08:36:12Z. First commit
  2026-05-27T08:35:55Z `6370da541` "Initial zodiacs.org repo". No commits
  before 2026.
- Commits to `public/assets/distribution.json`: eight, on 2026-07-05, 07-06,
  07-13, 07-20, 07-27, 08-03, 08-22 and 08-24. None later. (The first pass
  listed seven and missed 07-05.)
- Commits to `public/thesis/index.html` exist on 2026-07-23 ("thesis:
  amendment: surface-control attestation, reproducible evidence, drift
  gate"), 2026-08-01 and 2026-08-02; latest `47fee79f` on 2026-11-11.
- `public/archive/feed.json` in the repository: nine entries dated 2024-01-01,
  2024-08-29, 2024-11-22, 2024-12-14, 2025-01-19, 2025-01-27, 2025-02-06,
  2025-02-17, 2025-10-29.

## S19. Sources opened in the fix round, 2026-11-13T04:05Z

- S19a. Locale horoscope pages. `https://zodiacs.org/fr/horoscopes/`: title
  "Contenu en anglais | Zodiacs.org", heading "Cette page n'est pas encore
  traduite.", "Disponible en anglais", `robots` `noindex`.
  `https://zodiacs.org/it/horoscopes/`: title "Contenuto in inglese |
  Zodiacs.org", heading "Questa pagina non è ancora tradotta.", `noindex`.
  `https://zodiacs.org/es/horoscopes/`: "Horóscopos de hoy, 13 de noviembre
  de 2026". `https://zodiacs.org/pt/horoscopes/`: "Horóscopos de hoje, 13 de
  novembro de 2026".
- S19b. Internet Archive. The CDX query of S14 rerun with digest and length
  (`records/wayback-cdx-digests.json`): the ten captures from 20240726 to
  20250719 share the digest `7HMQKXUYPBZDUEQGHND5JINF6WGD5MPJ`; the three from
  2026 each have their own. Captures opened: 20240726200056 and
  20250719223440 are each 114 bytes,
  `<script>window.onload=function(){window.location.href="/lander"}</script>`;
  20260610083004 is 78,479 bytes with the title "Zodiacs · The Twelve."
  CDX for `zodiacs.org/thesis/`: first capture 20260713122037.
- S19c. https://zodiacs.org/fomo/ : "It is not part of Zodiacs.org, which has
  no referral deal with fomo and earns nothing when you trade there." and
  "Zodiacs.org adds nothing and receives nothing." No date on the statement.
- S19d. GitHub API, `zodiacs-org/site`. History of `thesis/index.html` (the
  thesis page's path before the July restructure): first commit `b2811600`,
  2026-06-10T13:04:42Z, "Add thesis page, astronomical clock artwork, and
  Astrofolio glyph integration"; four more commits by 2026-06-11.
  `public/assets/pulse.json`: "Refresh pulse data" on 2026-07-13, 07-27,
  08-10, 08-24 and 11-09. `public/assets/distribution.json`: eight commits,
  as corrected in S17. `public/thesis/thesis-test.json` at `99a2c2eb`:
  `preregisteredAt` 2026-07-23, thresholds identical to today's.
- S19e. Wikimedia pageviews API, `Virgo_(astrology)`, user traffic, daily:
  20 Mar 1,095; 21 Mar 1,177; 22 Mar 1,775; 23 Mar 22,543; 24 Mar 5,626;
  25 Mar 1,675.
- S19f. Repository files at the branch head. `src/data/sun-ingresses.json`
  holds the Cancer ingress as 2026-06-21T08:25:14.559Z.
  `src/data/nasa-event-instants.json` has 498 ingress rows, for Mercury,
  Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto; none for the Sun.
- S19g. The saved capture of the live page (S1), read again for what the text
  extractor dropped: the `application/ld+json` block (`datePublished`
  2026-08-01, `dateModified` 2026-11-11, author and publisher "Zodiacs.org")
  and the `aria-label` text of the figures, quoted in rows O12 to O22.
- Checked again in the saved captures: the candidacy evidence file (S1e) has
  one occurrence of "independence" (the policy) and none of
  "economicInterest"; the disclosure page (S6) has no occurrence of "fees",
  "confirmation" or "Wormhole".

## S18. Cited sources that could not be opened

| Source | What happened | Effect |
|---|---|---|
| Solscan token and account pages (cited for holders, supply, authorities, pools) | HTTP 403 to `curl` and to the web-fetch helper | Supply and authorities were read from the ledger instead (S10); the Leo holder count from Jupiter (S12); pool burns and top-ten shares are NOT VERIFIED. |
| Allied Market Research press release | HTTP 403, twice | Not opened. The page prints no figure from it. |
| Axios, Co-Star funding story | HTTP 403, twice | Not opened. The page prints no figure from it. |
| `x.com/search?q=astrofolio dead bag` | Needs a login | Not opened. This is the only receipt for the "dead bag" entry. |
| Google Trends comparison | Not opened | Pulse search figures NOT VERIFIED. |
| Basescan token pages, Wormhole documentation | Not opened | Bridge mechanism NOT VERIFIED; contract existence checked by RPC (S10). |
| https://zodiacs.org/fomo/ | TLS error on the one attempt on 11 Nov | Opened on 13 Nov; see S19c. |
| The operator "statement of 10 Nov 2026" named in the claims file | Not published anywhere found | The dated public statements are 2 Aug and 23 Aug 2026 (S6). |
