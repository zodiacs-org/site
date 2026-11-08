# Daily shorts: a posting plan

Status: proposal for the owner. Nothing here has been posted, and no account
has been connected. Every step that posts, signs up or spends money waits for
the owner's yes.

## What we already have

- The **Daily Shorts** workflow (`.github/workflows/daily-shorts.yml`, run by
  hand) builds twelve vertical videos a day, one per sign, from the published
  horoscope: about 15 seconds each, silent, with the brand end card.
- Each video comes with a caption file and a cover still.
- The workflow posts nothing. The files are a downloadable artifact.

## Where to post

Start with the two places short astrology video already does well, and add a
third once the routine is easy.

1. **TikTok** (one account, all twelve signs). Main bet.
2. **Instagram Reels** (the same video and caption). Reels can be scheduled in
   Meta Business Suite for free.
3. **YouTube Shorts**, after a month, once we know which signs and hours work.

One account per platform, not one per sign. Twelve accounts split the
followers twelve ways and are twelve times the work.

## How many a day

Twelve videos a day is too many for one account: they would bury each other.

- **Weeks 1 to 2:** three a day. Rotate the signs so each sign gets a turn
  every four days.
- **Weeks 3 to 4:** keep the three signs that got the most views each week
  and rotate the rest.
- **After a month:** decide from the numbers. If the account grows, move to
  six a day.

## When

Morning in the main audience's time zone, when people check their horoscope:
07:00 to 09:00 US Eastern for the first test, with one of the three posted at
19:00 to compare.

## The daily routine (about 10 minutes)

1. Run the Daily Shorts workflow (Actions tab, "Run workflow", leave the date
   empty).
2. Download the artifact and pick the day's three signs.
3. Upload each video with its caption file's text. Add a trending, royalty
   free sound in the app if you like: the videos are silent on purpose.
4. Use the cover still as the thumbnail.

## What to measure

Once a week, note for each platform: views, follows gained, and visits to
zodiacs.org from that platform (Vercel Analytics, by referrer). Keep the
numbers in a simple table. After four weeks, keep what works and drop what
doesn't.

## Sky event videos

The **Event Shorts** workflow (`.github/workflows/event-shorts.yml`, run by
hand) builds one video for each of the site's published event pages in a span:
new and full Moons, eclipses, retrogrades, slow planets changing sign, and
exact aspects. Each shows the event's sign art, its name, its UTC day, the
page's own summary and the time the page prints (NASA's, for the planets),
and links the page. The same command runs locally:

```bash
npm run data:event-shorts -- --from 2027-07-01 --days 31
```

Good ones to start with:

- **The eclipse no one will see** (18 July 2027, `--only eclipse-2027-07-18`):
  a penumbral eclipse so slight that no eye or camera will catch it. The
  video says so. A strange fact makes a good hook.
- **Each full Moon**, posted the morning before, with its traditional name
  (the Beaver Moon, the Cold Moon).
- **Mercury and Mars retrograde**, posted a day or two before the station.

Post one event video for every two or three horoscope videos. The event
videos are for everyone, not one sign, so they reach a wider audience.

## Ideas for later

- **Season openers:** a longer video on the day the Sun changes sign, made
  from the season pages.
- **"Your 2027 sky" in December:** a short series on the year's eclipses,
  pointing to the new page and its share card.
- **Comments into Guide:** answer common questions in comments with a link to
  Guide.

## Decisions for the owner

- Which platforms to open accounts on, and under what name.
- Whether to automate posting later. That would need each platform's posting
  API and a stored account token, which needs the owner's approval.
- Whether to pay for any scheduling tool. The free options above are enough
  to start.
