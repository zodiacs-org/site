# Zodiacs Sky Card

Today's sky in your GitHub profile, updated every morning: the Moon's phase
and sign, whether Mercury is retrograde, and the horoscope Zodiacs publishes
for your sign, with a link to read the rest on zodiacs.org.

```text
### Today's sky, 8 November 2026

🌑 New Moon in Scorpio · ☿ Mercury is retrograde

Scorpio today: Today, make your own position visible before reacting to the room. Reading confidence 40%

Read the full Scorpio horoscope on Zodiacs
```

Every day's update is a new commit to your profile README, made under your
own name, so it also shows on your contribution calendar.

## Set it up

1. In your profile repository (the one named after your username), add these
   two lines to `README.md` where the card should go. Without them, the card
   is added at the end the first time.

   ```markdown
   <!-- zodiacs-sky:start -->
   <!-- zodiacs-sky:end -->
   ```

2. Add `.github/workflows/zodiacs-sky.yml`:

   ```yaml
   name: Zodiacs sky card
   on:
     schedule:
       - cron: "17 6 * * *"
     workflow_dispatch:
   permissions:
     contents: write
   jobs:
     sky:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: zodiacs-org/sky-card@v1
           with:
             sign: scorpio
             timezone: Asia/Bangkok
   ```

   Pick your own sign and time zone, and any minute in the hour, so that not
   every card asks at once.

3. Run it once from the Actions tab (Run workflow) to see the card.

| Input | What it does | Default |
| --- | --- | --- |
| `sign` | Your Sun sign: aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius or pisces | required |
| `timezone` | The time zone that decides "today" | `UTC` |
| `readme` | The file the card goes in | `README.md` |
| `commit` | Commit and push the change; `false` only writes the file | `true` |
| `commit-message` | The commit message | `Update today's sky` |

## What it sends

Only your sign and time zone, to the public Zodiacs server at
https://zodiacs.org/mcp, which needs no key. No birth details, names or other
information about you are sent. If Zodiacs cannot answer, your README is
left as it is and the run still succeeds.

## Good to know

- The horoscope is the one Zodiacs publishes for your sign, the same as on
  zodiacs.org. Its Reading confidence label says how specific the reading
  is (a Sun sign alone is 40%), never the odds that something happens.
- The card's link adds `utm_source=github-sky-card`, so Zodiacs can count
  visits from cards. It carries nothing about you.
- To stop, delete the workflow file. The last card stays until you remove
  it.
