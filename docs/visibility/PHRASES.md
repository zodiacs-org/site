# The fifteen phrases (set 2026-11-08, secondary)

**Status: parked.** On 2026-11-08 Dias re-centred the program on the
high-volume families ([FAMILIES.md](FAMILIES.md)) because these phrases are
low volume. The page edits for PR A below were drafted and saved as
[parked/2026-11-08-fifteen-phrase-page-edits.patch](parked/2026-11-08-fifteen-phrase-page-edits.patch)
(birth chart, moon sign, rising sign, compatibility, big three, transits);
they are not in the open PR. Note that F2 and F5 in FAMILIES.md rewrite some
of the same titles in the language's search form, so the two plans must be
reconciled before either merges.

These are the fifteen phrases picked from the baseline gathered outside the
sandbox on 2026-11-08 (`baseline/2026-11-08/external.json`). They replace the
provisional list this file held earlier the same day. The privacy and
no-signup calculator phrases look the most winnable, so they go first.

## One page per intent

Several of the fifteen are different wordings of the same need. A separate
page for each wording would be a doorway page, so each phrase is given one of
two placements:

- **title**: the phrase owns the page's `<title>`, H1 and opening answer.
- **section**: the phrase gets an H2 using the exact words, a 40 to 60 word
  answer right under it, and the same question as a FAQPage entry, on the
  page that already serves that intent.

Baseline (local build of `main` at f17b7ce2): **none of the fifteen appears
exactly in any title, H1, opening paragraph or H2.**
Search Console: no history (property verified 2026-11-08).
AI and Google: zodiacs.org named in 0 of 100 Claude and Google answers.

| # | Exact phrase | Page | Placement | Change |
|---|---|---|---|---|
| t01 | free birth chart calculator no signup | `/birth-chart/` | title | PR A |
| t02 | private birth chart calculator | `/birth-chart/` | section | PR A |
| t04 | free birth chart with houses | `/birth-chart/` | section | PR A |
| t03 | astrology website that does not save my data | `/privacy/` | section | PR A |
| t09 | free moon sign calculator | `/moon-sign/` | title | PR A |
| t10 | rising sign calculator without birth time | `/rising-sign/` | section | PR A |
| t11 | zodiac compatibility checker | `/compatibility/` | title | PR A |
| t12 | big three calculator sun moon rising | `/big-three/` | title | PR A |
| t13 | free transit chart calculator | `/transits/` | title | PR A |
| t14 | astrology app without subscription | `/tools/` | section | PR A |
| t08 | how accurate are online birth chart calculators | `/methodology/` | title | PR A |
| t07 | most accurate birth chart calculator | `/methodology/` | section | PR A |
| t05 | best birth chart website | proposed `/compare/` | title | PR B, needs Dias's yes |
| t06 | best free astrology website | proposed `/compare/` | section | PR B, needs Dias's yes |
| t15 | best astrology site for compatibility | proposed `/compare/` | section | PR B, needs Dias's yes |

## The three "best" phrases

A site calling itself "the best" is the smug claim the voice rules ban, and
assistants answer "best" questions from third-party lists, not from the
site's own word. So:

1. **Outreach does most of the work** ([OUTREACH.md](OUTREACH.md)): the list
   pages Claude and Google cite are the targets.
2. **Optional PR B:** one fair comparison guide at `/compare/`, titled
   "Best Birth Chart Websites Compared: Free, No Signup, Houses". It compares
   Zodiacs.org with Astro.com, Astro-Seek, Cafe Astrology, CHANI, TimePassages,
   The Pattern and Co-Star on checkable facts only: price, account needed,
   houses shown, house systems, where the chart is calculated, ads. Every cell
   is checked on the day and dated; no claim about another site we cannot see
   for ourselves. Sections for "best free astrology website" and "best astrology
   site for compatibility" answer by criteria ("free, no account, full chart
   comparison"), not by crowning ourselves. getbirthchart.com/compare, one of
   the cited pages, shows this format gets cited. **This page names
   competitors, so it waits for Dias's yes.** It would be 1 of the 10
   net-new pages a week Growth OS allows.

## Copy for PR A

All copy follows the voice rules in `CLAUDE.md` (plain, specific, no boasting),
with no em or en dashes and no token, market or crypto words. Claims are
taken from the methodology page and the November accuracy audit.

### `/birth-chart/`: t01 title, t02 and t04 sections

- Title: `Free Birth Chart Calculator, No Signup: Houses Included | Zodiacs.org`
- H1: `Free birth chart calculator, no signup`
- Opening: "Enter your birth date, time and place to get your full birth chart
  free, with no account and no email: every planet's sign and degree, your
  rising sign, all twelve houses and the aspects between them. The chart is
  calculated in your browser, so your birth details stay on your device."
- H2 `A private birth chart calculator`: what stays on the device, what leaves
  only when you choose (saving to an account, sharing a link, asking the
  assistant), link to `/privacy/`.
- H2 `Free birth chart with houses`: Whole sign or Placidus houses, what
  each house covers, link to `/learn/houses/`.
- FAQ: the three questions first, with the same answers.

### `/privacy/`: t03 section

- Title loses its em dash: `Privacy: How Your Data Is Handled | Zodiacs.org`.
  The H1 and the policy text are unchanged.
- New short section near the top, H2 `An astrology website that does not save
  my data`, answering in plain words with only what the policy already says.
  The legal text stays as written.

### `/moon-sign/`: t09 title

- Title: `Free Moon Sign Calculator: What Is My Moon Sign? | Zodiacs.org`
- H1: `Free moon sign calculator`
- Opening: what the Moon sign is, that the date is usually enough, that the
  birth time settles a day when the Moon changed sign.

### `/rising-sign/`: t10 section

- H2 `Rising sign calculator without birth time`, placed above the existing
  "Why we ask for the time" band. Answer: a rising sign cannot be known
  without a birth time, and the page shows instead which signs rise at each
  hour of the day, so a rough time ("morning") narrows it to two or three.
  Honest, and it points at the day strip the page already draws.

### `/compatibility/`: t11 title

- Title: `Zodiac Compatibility Checker: Compare Two Birth Charts | Zodiacs.org`
- H1: `Zodiac compatibility checker`
- Opening: compare two signs, or two full birth charts, free and without an
  account; links to the 78 sign pair readings.

### `/big-three/`: t12 title

- Title: `Big Three Calculator: Sun, Moon and Rising Signs | Zodiacs.org`
- The H1 comes from shared sharing copy (`sharingText('en', 'bigTitle')`);
  the opening paragraph carries "big three calculator" and "Sun, Moon and
  rising" instead, so the share card text is not touched.

### `/transits/`: t13 title

- Title: `Free Transit Chart Calculator: Transits to Your Chart | Zodiacs.org`
- H1: `Free transit chart calculator`
- Opening: what a transit is and what the page shows, the date slider a year
  either way.

### `/tools/`: t14 section

- H2 `An astrology app without a subscription`: every tool on the site is
  free with no subscription and no account; the site can be added to the home
  screen and works like an app, and saved charts stay on the device.

### `/methodology/`: t08 title, t07 section

- Title: `How Accurate Are Online Birth Chart Calculators? | Zodiacs.org`
- H1: `How accurate are online birth chart calculators?`
- Opening: "Accurate enough that the birth time, not the software, is usually
  what limits your chart. This site's planet positions differ from Swiss
  Ephemeris by a median of 1.6 arcseconds; a sign is 108,000 arcseconds wide.
  Below is how each part is calculated, what we measured, and where precision
  has limits."
- H2 `Most accurate birth chart calculator`: what to check in any calculator
  (ephemeris source, published comparison, how it handles an unknown time and
  old time zones), with this site's own measured figures. No claim to be the
  most accurate; the answer gives the test.

### Links in (contextual, not sitewide)

- `/learn/how-to-read-a-birth-chart/` → `/birth-chart/` with "free birth
  chart calculator, no signup".
- `/learn/houses/` → `/birth-chart/` with "free birth chart with houses".
- `/birth-chart/` results → `/methodology/` with "how accurate are online
  birth chart calculators".
- `/big-three/` → `/rising-sign/` with "rising sign calculator without birth
  time"; `/moon-phase/` → `/moon-sign/` with "free moon sign calculator".

## After PR A

`node scripts/visibility/page-baseline.mjs --dist dist --label <date>` shows
each phrase in its title or H2. Search Console: request indexing for the
eight changed URLs. Week 4 and week 8 re-measures as in the README.
