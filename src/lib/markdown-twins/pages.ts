/**
 * The twelve Markdown twins. Each sentence is copied from its page (see
 * model.ts); the parity test fails when a sentence here is not on the page,
 * or when the page states a question, answer or dated row the twin lacks.
 * Change the page and its twin together.
 */
import { ASPECTS } from '../engine/aspects';
import { traditionalRuler } from '../rising-example';
import { SIGNS } from '../signs';
import { signDateRange } from '../sign-display';
import { datedEditionText } from '../edition-freshness';
import { horoscopeHubTeaser, pageReadingFromProgram } from '../horoscope-page-data';
import type { HoroscopeProgram } from '../horoscope-program';
import programData from '../../data/horoscope-program.json';
import { t } from '../i18n';
import type { Block, Twin, TwinSlug } from './model';
import { eclipseTable, fullMoonTable, mercuryRetrogradeTable } from './sky-tables';

type Faq = { q: string; a: string; computed?: boolean };

const faqBlocks = (heading: string, faq: Faq[]): Block[] => [
  { h: 2, text: heading },
  ...faq.flatMap(({ q, a, computed }): Block[] => [{ h: 3, text: q, computed }, { p: a, computed }]),
];

const signName = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1);

function birthChart(): Twin {
  return {
    slug: 'birth-chart',
    title: 'Get your free birth chart.',
    description: 'Calculate your free birth chart: sun, moon, rising, planets, houses, and what they mean, computed privately, in your browser.',
    blocks: [
      { p: 'Your Sun, Moon and rising sign, every planet and house, and what each one means.' },
      { h: 2, text: 'No birth time? You still get a chart.' },
      { p: 'Many people don’t know it. Here is exactly what changes, so nothing in your chart is guessed.' },
      { h: 3, text: 'I know it' },
      { p: 'The full chart: rising sign, all twelve houses, and the Moon to the exact degree.' },
      { h: 3, text: 'I know it roughly' },
      { p: 'Enter your best guess. On the result, Check a time window shows which parts could change if the time is a little off.' },
      { h: 3, text: 'I don’t know it' },
      { p: 'You get your Sun, planets and aspects from a noon reference. We leave out the rising sign and houses, and if the Moon changed sign that day we show both options.' },
      { p: 'Where to look: a birth certificate, a baby book, a hospital record, or a parent. You can add the time later and run your chart again.' },
      { h: 2, text: 'Private by design.' },
      { p: 'No account, no signup, and no chart service on our servers.' },
      { h: 3, text: 'Calculated in your browser' },
      { p: 'The whole chart is worked out on your device. There is no server-side chart service to send your details to.' },
      { h: 3, text: 'Saved on this device' },
      { p: 'Save a chart and it stays here. Account sync is a separate choice, and it only happens after you sign in.' },
      { h: 3, text: 'Checked against the sky' },
      { p: 'Positions are tested against NASA JPL reference data, with historical time zones and GeoNames place data. Every result lists its exact inputs.' },
      ...faqBlocks('Questions, answered', [
        { q: 'What is a birth chart?', a: 'A birth chart, or natal chart, is a map of where every planet sat, seen from Earth, at the moment and place you were born. It records your Sun, Moon and rising signs, plus Mercury through Pluto across twelve houses.' },
        { q: 'Do I need my exact birth time?', a: 'For your rising sign and houses, yes: the rising sign changes about every two hours. Without a time we use 12:00 local time as a reference, leave out the rising sign and houses, and show both Moon signs if the Moon changed sign that day.' },
        { q: 'How accurate is this calculator?', a: 'Planet positions come from an astronomical engine tested against NASA JPL reference data to within a few hundredths of a degree. Historical clock changes come from the IANA time zone records. Astrology itself is an interpretive practice, not a scientific prediction.' },
        { q: 'Whole sign or Placidus houses: which should I pick?', a: 'Whole sign is the oldest system and the easiest to read: each house is one full sign. Placidus is the most common modern choice and uses your exact time and place, so house sizes vary. Try both: your planets stay put, only the house lines move.' },
        { q: 'What happens to my birth data?', a: 'The chart is computed entirely in your browser, with no account. A saved chart stays on this device unless you choose account sync.' },
      ]),
      { p: 'Your chart takes about twenty seconds.' },
      { p: 'Birth date, time, and place. Private in your browser.' },
    ],
  };
}

function compatibility(): Twin {
  return {
    slug: 'compatibility',
    title: 'Check your astrology compatibility.',
    description: 'Free astrology compatibility calculator: compare two birth charts privately in your browser, with clear readings and guides to all 78 sign pairings.',
    blocks: [
      { p: 'Compare two birth charts to explore where a relationship flows and where it catches. You don’t need their birth details: send a link and they add their own.' },
      { h: 3, text: 'Send a link to someone' },
      { p: 'Enter your birth details, then send the link. When they add theirs, the comparison opens for both of you.' },
      { list: ['[Make an invite link](https://zodiacs.org/compatibility/invite/)'] },
      { h: 3, text: 'Enter both charts yourself' },
      { p: 'If you already know both birth dates, and the times and places if you have them.' },
      { h: 2, text: 'Start with sun signs' },
      { p: 'If you do not have two birth charts yet, these shorter Sun-sign guides are a useful first look at the dynamic between two signs.' },
      { p: 'Browse all 78 sun-sign pairings' },
      { p: 'Plain-language guides, without a score' },
      ...faqBlocks('Compatibility questions', [
        { q: 'How does astrological compatibility work?', a: 'Astrologers compare two birth charts by measuring the angles between one person’s planets and the other’s, a practice called synastry. Trines and sextiles between charts read as ease; squares and oppositions read as productive friction. Sun-sign compatibility is the one-line summary of a much longer comparison.' },
        { q: 'Is sun-sign compatibility real?', a: 'It is the simplest useful layer. Two people are more than their sun signs. The Moon, Venus, and Mars often matter more in practice. The sun-sign pairing pages here are honest starting points, and the calculator compares two birth charts when you have birth details.' },
        { q: 'Do I need exact birth times for a compatibility reading?', a: 'Times help but are not required. Without one, the calculator uses local noon as a reference and omits the rising sign, angles, and houses. Most planetary signs are stable across a day, but the Moon moves about 13 degrees and its position and nearby aspects remain approximate.' },
      ]),
    ],
  };
}

function moonSign(): Twin {
  const slugs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  return {
    slug: 'moon-sign',
    title: 'Find your moon sign.',
    description: 'Find your moon sign free, in seconds: how you feel, what soothes you, and what you need to feel safe. No signup.',
    blocks: [
      { p: 'The Moon rules how you feel: your inner weather, your comforts, the way you settle yourself. Here is how to find yours.' },
      { h: 2, text: 'What your moon sign describes' },
      { p: 'Most people meet astrology through their sun sign and shrug. The moon sign is where it tends to get uncomfortably accurate, because the Moon describes the private layer: what you\'re like at 2 a.m., mid-argument, or three days into needing a hug you haven\'t asked for.' },
      { p: 'Once you know your moon sign, read its guide. Every sign\'s guide has a section on what that placement means for the Moon specifically. Then get your birth chart: sun, moon, and rising together are the real summary of you.' },
      { h: 3, text: 'Why birth time can change the answer' },
      { p: 'The Moon moves about 13° a day, so people born hours apart can have different Moon signs near a boundary. The calculation uses the birth instant and the historical time zone of the birthplace.' },
      { h: 2, text: 'The twelve moons, read closely' },
      { p: 'A full page on each Moon placement: how it feels, what it needs, where it grows.' },
      { list: slugs.map((slug) => `[Moon in ${signName(slug)}](https://zodiacs.org/learn/placements/moon-in-${slug}/)`), computed: true },
      ...faqBlocks('Questions, answered', [
        { q: 'What is a moon sign?', a: 'Your moon sign is the zodiac sign the Moon occupied at your birth. Where your sun sign describes your core identity, the moon sign describes your emotional life: how you feel, what soothes you, and what you need to feel safe. Many people recognize themselves more in their moon than their sun.' },
        { q: 'Do I need my birth time to find my moon sign?', a: 'Usually not. The Moon spends about two and a half days in each sign, so most days it only occupies one. But it changes signs roughly every 60 hours, so on boundary days the time matters. Without a time, this calculator shows a reference result and marks the Moon sign as unverified instead of guessing.' },
        { q: 'Why is my moon sign different from what another site said?', a: 'A time-zone difference is often the cause, especially for older dates or places with historical clock changes. This calculator uses a pinned release of the IANA clock history for births before 1970 and the IANA/ICU history supplied by your browser or device runtime after that, and shows the UTC instant used in the chart details.' },
        { q: 'Sun, moon, and rising: what’s the difference?', a: 'The classic shorthand: the Sun is who you are, the Moon is how you feel, the Rising is how people first read you. Together they’re called the big three, and they’re the fastest useful summary of a birth chart.' },
      ]),
    ],
  };
}

function risingSign(): Twin {
  return {
    slug: 'rising-sign',
    title: 'Find your rising sign.',
    description: 'Find your rising sign free with your birth time and place: how people first read you, plus the planet that rules your chart.',
    blocks: [
      { p: 'The sign that was coming up on the eastern horizon the moment you were born. It describes how people first meet you, and it sets the shape of your whole chart.' },
      { p: 'No exact time? The moon sign works from your birth date alone.' },
      { h: 2, text: 'Why we ask for the time' },
      { p: 'The rising sign changes about every two hours.' },
      { p: 'The Earth turns once a day, so the eastern horizon passes through all twelve signs of the zodiac every 24 hours. Your rising sign is whichever one was crossing it at the moment you were born.' },
      { p: 'The signs don’t take equal time. Depending on the sign and how far from the equator you were born, one can rise in just over an hour and another in two and a half. That is why we ask for your exact time, and why we never guess it.' },
      { p: 'Where to find your time: a birth certificate is best, then hospital records, then family memory. If it was rounded to exactly 7:00, read the sign either side too.' },
      { h: 2, text: 'What your rising sign shows' },
      { p: 'Three things. The calculator gives you the first two straight away.' },
      { h: 3, text: 'How people first meet you' },
      { p: 'The manner strangers notice before they know your Sun sign: how you walk into a room, and the first impression you leave.' },
      { h: 3, text: 'Your chart ruler' },
      { p: 'The planet that rules your rising sign. Astrologers read its sign and house as one of the main themes of a chart.' },
      { h: 3, text: 'The layout of your houses' },
      { p: 'Your rising sign starts the first house, so it decides which area of life every other planet falls in. The full birth chart shows them all.' },
      { h: 2, text: 'The twelve risings' },
      { p: 'Once you know yours, read what it does to a chart: the manner, the chart ruler, and how the houses fall.' },
      { p: 'Rulers follow the traditional system, the same one the calculator uses.' },
      { table: { head: ['Rising', 'Ruler'], rows: SIGNS.map((sign) => [`${sign.name} rising`, `Ruler ${traditionalRuler(sign)}`]) } },
      ...faqBlocks('Questions, answered', [
        { q: 'What is a rising sign?', a: 'Your rising sign, also called the ascendant, is the zodiac sign that was coming up over the eastern horizon at the moment you were born. In astrology it describes first impressions: how strangers read you before they know your Sun sign. It also sets the layout of your chart’s twelve houses.' },
        { q: 'Why do I need my exact birth time?', a: 'The ascendant moves through all twelve signs every 24 hours, a new sign roughly every two hours and sometimes faster. Near a sign change, even 15 minutes can matter. A birth certificate is the best source; hospital records and family memory come next.' },
        { q: 'What if my birth time is rounded, like exactly 7:00?', a: 'Rounded times are common on birth records. If your result sits in the first or last degree or two of a sign, treat the neighbouring sign as a real possibility and read both. The one that sounds like how strangers see you is usually yours.' },
        { q: 'What is a chart ruler?', a: 'The planet that rules your rising sign is your chart ruler. Astrologers treat its sign and house as a major theme of the chart. The calculator names yours, using the traditional rulerships for consistency.' },
        { q: 'Is the rising sign really that important?', a: 'In chart reading it is arguably the most important single point. It anchors the houses, so it decides which area of life every other planet falls in. It is also why two people born on the same day can have very differently shaped charts.' },
        { q: 'How is the rising sign calculated?', a: 'From the Earth’s rotation at the moment and place of your birth: local sidereal time, the tilt of the Earth’s axis, and some spherical trigonometry. As a check, the rising degree at sunrise matches the Sun’s own position. It all runs privately in your browser.' },
      ]),
    ],
  };
}

function saturnReturn(): Twin {
  return {
    slug: 'saturn-return',
    title: 'Find your Saturn return.',
    description: 'Find your exact Saturn return dates free: every crossing, retrograde passes included, computed from Saturn\'s real motion on your device. Just needs your birth date.',
    blocks: [
      { p: 'Around age 29, Saturn finishes its first lap of your chart and comes home. This calculator finds the exact dates, every pass and retrograde loop included, from your birth date alone.' },
      { h: 2, text: 'What the return actually is' },
      { p: 'Saturn moves slowly: about two and a half years to a sign, 29.4 years to the full circle. Your Saturn return is the stretch when the moving planet stands where it stood at your birth: the end of one complete Saturn cycle and the opening of the next.' },
      { p: 'The folklore says everything falls apart at 29. The more accurate version: whatever you built between 0 and 29 gets load-tested, and only the parts that were holding real weight pass. Jobs kept out of fear, relationships running on inertia, cities you never chose. The return has a way of invoicing all of them in the same year. What survives it tends to survive for decades.' },
      { p: 'Where Saturn sits in your chart says what the audit examines: the sign colors the style, the house names the arena. The calculator reads your natal sign above; for the house, you’ll want your full birth chart with a birth time. And for the planet itself, read what Saturn means in a chart.' },
      ...faqBlocks('Questions, answered', [
        { q: 'What is a Saturn return?', a: 'The moment transiting Saturn comes back to the exact degree it held when you were born. Saturn takes about 29.4 years to lap the zodiac, so the first return lands near age 29, the second near 58, the third near 88. Astrologers read it as an audit: whatever in your life runs on momentum rather than choice comes up for review.' },
        { q: 'When is my Saturn return?', a: 'Enter your birth date above. The calculator scans Saturn’s actual motion and returns the exact dates, including retrograde passes. Most first returns begin between ages 28 and 30; the common "it ruined my 29th year" folklore usually describes the season’s middle stretch.' },
        { q: 'Why does my Saturn return have three dates?', a: 'Saturn retrogrades for about four and a half months every year. When that backward loop crosses your natal degree, the planet hits it three times: once moving forward, once backing over it, once sealing it on the way out. The whole span, often eight to twelve months, is the return.' },
        { q: 'How long does a Saturn return last?', a: 'The exact crossings span a few days to about a year, depending on whether the retrograde loop is involved. The felt experience is wider: astrologers usually count the whole transit of Saturn through your natal Saturn’s sign, roughly two and a half years.' },
        { q: 'Is the Saturn return bad?', a: 'It has the reputation of a demolition and the mechanics of an inspection. Careers, relationships, and living situations that fit get certified and strengthened; the ones held together by habit get billed. People tend to rate it terrible at 29 and formative at 35.' },
      ]),
    ],
  };
}

function mercuryRetrograde(): Twin {
  const table = mercuryRetrogradeTable();
  return {
    slug: 'mercury-retrograde',
    title: 'See when Mercury turns retrograde.',
    description: 'Every Mercury retrograde through 2030, computed from the planet\'s real motion: exact dates, station positions, and what the window actually asks of you.',
    blocks: [
      { p: `Every window below is computed from Mercury’s actual motion, station to station, refined to the hour, through the end of ${table.lastYear}.`, computed: true },
      { p: `As of ${table.asOf}`, computed: true },
      { p: table.status, computed: true },
      { p: `Retrograde today: ${table.retroToday}`, computed: true },
      { h: 2, text: `The windows, ${table.firstYear} to ${table.lastYear}`, computed: true },
      { p: 'Dates in universal time. The position shown is where Mercury stands still each time, the stations.' },
      { table: { head: ['Window', 'Stations retrograde at', 'Stations direct at'], rows: table.rows } },
      { h: 2, text: 'What is actually happening up there' },
      { p: 'Nothing slows down and nothing reverses. Mercury orbits the Sun in 88 days to our 365, and a few times a year it passes us on the inside lane. Watched from a moving Earth, the planet seems to brake, hang motionless for a day or two, and drift backward through the zodiac before resuming course, the same illusion you get when a slower train out the window appears to roll backward. The dates above are that illusion, computed precisely.' },
      { p: 'Astrology reads Mercury as the planet of communication, transit, and paperwork, which is how three weeks of apparent backward motion became shorthand for lost emails and missed trains. The tradition’s actual advice is calmer: treat the window as review season. Finish what’s open, reread before sending, confirm the booking, and hold big launches and signatures for the other forty-five weeks of the year if you can. Not because the sky forbids them, because a scheduled excuse to double-check is genuinely useful.' },
      { p: 'Where a retrograde lands in your chart decides which corner of life does the reviewing. That takes your birth chart. And if you were born with Mercury retrograde (roughly one person in five), astrologers read it as an inward-processing style, not a defect.' },
      ...faqBlocks('Questions, answered', [
        { q: 'When is the next Mercury retrograde?', a: `${table.status} The full table above lists every window through ${table.tableThrough}, computed from Mercury's actual motion and refined to the hour.`, computed: true },
        { q: 'What is Mercury retrograde, actually?', a: 'An optical effect. Mercury laps the Sun faster than Earth does, and three or four times a year it overtakes us on the inside. From our moving viewpoint it appears to slow, stop, and slide backward through the zodiac for about three weeks. Nothing changes direction in space; the appearance is real enough to compute to within a few minutes.' },
        { q: 'How long does Mercury retrograde last?', a: 'About three weeks, three or four times a year. Astrologers also watch the "shadow" (the week or two on either side while Mercury crosses the same degrees at normal speed), but the dated windows here are the retrograde proper, station to station.' },
        { q: 'What does Mercury retrograde mean in astrology?', a: 'Mercury is the planet astrologers assign to communication, travel, and information, so its retrograde picked up a reputation for garbled messages, travel snags, and technology mutiny. The working advice is more boring than the memes: build in margin, confirm the details, and treat the window as review season: finish, revise, and double-check rather than launch.' },
        { q: 'Do other planets go retrograde?', a: 'All of them except the Sun and Moon. The outer planets spend months retrograde every year and astrologers barely blink; Mercury gets the headlines because its retrogrades are frequent, short, and tied to daily-life territory.' },
      ]),
    ],
  };
}

function fullMoonCalendar(): Twin {
  const table = fullMoonTable();
  return {
    slug: 'full-moon-calendar',
    title: `Find every full moon through ${table.lastYear}.`,
    description: 'Every full moon from 2026 through 2030: exact date and universal time, the Moon\'s zodiac sign and degree, and the traditional name, Wolf to Cold, blue moon included.',
    blocks: [
      { p: `Each row below is the exact instant the Moon stands opposite the Sun, timed to within a minute through the end of ${table.lastYear}, with the sign it happens in and the name the almanacs gave it.`, computed: true },
      { p: `As of ${table.asOf}`, computed: true },
      { p: table.status, computed: true },
      ...table.years.flatMap(({ year, rows }, index): Block[] => [
        { h: 2, text: `Full moons of ${year}`, computed: true },
        ...(index === 0 ? [{ p: 'Times are universal time. In the Americas the instant often falls the evening before.' }] : []),
        { table: { head: ['Date', 'Time UTC', 'Moon stands at', 'Name'], rows } },
      ]),
      { h: 2, text: 'What a full moon is' },
      { p: 'Once every 29.5 days the Moon swings around to stand exactly opposite the Sun, its whole face lit from our side. That opposition is a single computable instant (the times above), though the Moon looks essentially full for a night before and after. Because it is an opposition, the pairing of signs is fixed: a full moon in Capricorn can only happen while the Sun is in Cancer, and so on around the wheel.' },
      { p: 'The names are older than the astrology columns that borrowed them. North American almanacs, drawing on Algonquian and colonial seasonal tradition, tied each month’s moon to the working year: wolves in the January cold, sap worms in March, the buck’s new antlers in July. They are calendar poetry, not sky data. The computed column is the sign and degree, which is what an astrologer actually reads. Where that degree lands in your chart takes a birth chart; the monthly horoscopes track each lunation as it comes.' },
      { p: 'Twice a year or so, a full moon lines up closely enough with the Moon’s orbital nodes to pass through Earth’s shadow: a lunar eclipse. Those get their own dated page.' },
      ...faqBlocks('Questions, answered', [
        { q: 'When is the next full moon?', a: `${table.status} Every date on this page is computed from the Moon's actual opposition to the Sun, to within a minute, in universal time.`, computed: true },
        { q: 'Why does the full moon date sometimes differ by a day?', a: 'The full moon is one instant, the moment the Moon stands exactly opposite the Sun, and this page lists that instant in universal time. If it lands at 2 a.m. UTC, it is still the previous evening in the Americas, so a local calendar can honestly print the neighboring date. The Moon looks full to the eye for a night on either side regardless.' },
        { q: 'What is a blue moon?', a: 'The common modern meaning is the second full moon inside one calendar month, which happens every two to three years because lunar months run about 29.5 days. The next one is on May 31, 2026. The older almanac meaning, a fourth full moon in one season, survives mostly in trivia contests. Neither kind looks blue.' },
        { q: 'Where do full moon names come from?', a: 'The Wolf, Snow, Worm sequence comes from North American almanac tradition, which drew on Algonquian and colonial seasonal names. They describe the farming and hunting year, not astrology. The astrological content of a full moon is its zodiac sign and degree, which is why the table lists both.' },
        { q: 'What does a full moon mean in astrology?', a: 'A full moon is the Sun and Moon in exact opposition, so it always pairs two opposite signs. A Capricorn full moon happens in Cancer season. Astrologers read it as a culmination or a coming-to-light in the part of your chart holding the Moon’s sign. Which part that is takes your birth chart.' },
      ]),
    ],
  };
}

function eclipses(): Twin {
  const table = eclipseTable();
  return {
    slug: 'eclipses',
    title: `Find every eclipse through ${table.lastYear}.`,
    description: 'Every solar and lunar eclipse through 2030 with exact peak times and zodiac signs, including the August 12, 2026 total solar eclipse over Iceland and Spain.',
    blocks: [
      { p: 'Find the next solar or lunar eclipse, its peak time in UTC and its Zodiac sign.' },
      { p: `As of ${table.asOf}`, computed: true },
      { p: table.status, computed: true },
      { p: 'Eclipse seasons run twice a year. Solar and lunar arrive about two weeks apart' },
      { h: 3, text: 'How this calendar works' },
      { p: `Every solar and lunar eclipse through ${table.lastYear}, computed from the real geometry: peak instants in universal time, with the sign each one lands in.`, computed: true },
      { h: 2, text: `The eclipses, ${table.firstYear} to ${table.lastYear}`, computed: true },
      { p: 'Peak times in universal time. Solar eclipses are visible along a limited track; lunar eclipses from the whole night side of Earth.' },
      { table: { head: ['Peak', 'UTC', 'Eclipse', 'In', 'Detail'], rows: table.rows } },
      { h: 2, text: 'What an eclipse is' },
      { p: 'Every eclipse is a new or full moon with better aim than usual. The Moon’s orbit tilts about five degrees against the Sun’s path, so most months its shadow misses us and Earth’s shadow misses it. Twice a year the crossing points (the nodes) line up with the Sun, and for a few weeks any lunation lands square in the geometry: a new moon blocks the Sun somewhere on Earth, a full moon slides into Earth’s shadow. That is the whole machinery, and it is why the table above clusters into seasons.' },
      { p: 'The one worth planning around is August 12, 2026, the first total solar eclipse over mainland Europe since 1999. Totality crosses Greenland, western Iceland, and northern Spain in the late afternoon; most of Europe sees a deep partial. A lunar eclipse needs no travel: the March 3, 2026 total lunar eclipse, with the Moon in Virgo, is visible from the entire night side, totality lasting about an hour.' },
      { p: 'Astrology reads eclipses as lunations with the volume turned up, because they happen on the nodal axis the tradition associates with direction: where you’re headed and what you’re leaving. The working advice is unglamorous: watch what surfaces in the lunation cycle those weeks, and read the sign pairing against your own chart rather than the headlines. The monthly horoscopes date each one as it arrives.' },
      ...faqBlocks('Questions, answered', [
        { q: 'When is the next solar eclipse?', a: table.nextSolar, computed: true },
        { q: 'When is the next lunar eclipse?', a: table.nextLunar, computed: true },
        { q: 'What is the difference between a solar and a lunar eclipse?', a: 'A solar eclipse is the Moon passing in front of the Sun at a new moon, visible only along a narrow track, in daylight. A lunar eclipse is the Moon passing through Earth’s shadow at a full moon, visible from anywhere the Moon is up, and safe to watch with bare eyes. Solar eclipses need eye protection at every stage short of totality.' },
        { q: 'Why do eclipses come in pairs?', a: 'The Moon’s orbit is tilted about five degrees, so most new and full moons miss the alignment. Twice a year the geometry lines up for a few weeks, an eclipse season, and inside each season you usually get one solar and one lunar eclipse about two weeks apart. The table shows the rhythm: February to March and August in 2026.' },
        { q: 'What do eclipses mean in astrology?', a: 'Astrologers read eclipses as amplified lunations: a new or full moon that lands close to the Moon’s nodes, the points astrology associates with direction and change. The tradition treats them as accelerants, beginnings and endings arriving faster than usual, in whichever part of your chart holds the eclipse’s degree. Finding that part takes your birth chart.' },
      ]),
    ],
  };
}

function horoscopes(): Twin {
  const program = programData as HoroscopeProgram;
  const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${program.anchorDate}T12:00:00.000Z`));
  const dated = (text: string) => datedEditionText(text, program.anchorDate);
  return {
    slug: 'horoscopes',
    title: 'Daily horoscopes',
    description: `Daily horoscopes for all twelve signs on ${dateLabel}, with a clear theme and one useful move for each sign.`,
    blocks: [
      { p: `Daily edition · ${dateLabel}`, computed: true },
      { p: `Find your sign for ${dated('today’s')} focus, pressure point, and most useful move. Read your Sun sign first, and your rising sign too, if you know it.`, computed: true },
      { h: 2, text: 'A look at today’s readings' },
      ...SIGNS.flatMap((sign): Block[] => {
        const reading = pageReadingFromProgram(program, sign.slug, 'today');
        return [
          { h: 3, text: sign.name, computed: true },
          { list: [
            signDateRange(sign),
            reading.label,
            dated(horoscopeHubTeaser(reading.sections[0]?.body ?? reading.intro)),
            `[${dated('Read today →').replace(/\s*→$/u, '')}](https://zodiacs.org/horoscopes/${sign.slug}/)`,
          ], computed: true },
        ];
      }),
      { h: 3, text: 'Behind these readings' },
      { p: `This is the ${dateLabel} UTC edition; the underlying positions use the recorded noon-UTC sky. Sun-sign horoscopes give the broad view. See the astrology, sources, and checks behind each edition.`, computed: true },
    ],
  };
}

function methodology(): Twin {
  const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
  return {
    slug: 'methodology',
    title: 'How we calculate your chart.',
    description: 'How zodiacs.org computes a chart: ephemeris and house methods, historical timezone handling, NASA JPL accuracy tests, uncertainty rules, and local-first privacy.',
    blocks: [
      { p: 'Here is what a chart on zodiacs.org claims, how each part is calculated, and where its precision has honest limits.' },
      { h: 2, text: 'The ephemeris' },
      { p: 'The engine\'s default ephemeris is JPL DE440. The site uses it for the compute API and sky catalogs. The smaller browser build uses Astronomy Engine. It is designed to stay within one arcminute of NOVAS, its own target.' },
      { p: 'Positions are geocentric tropical longitudes of date, the standard frame of Western astrology. The DE440 calculation applies light-time and aberration. The browser applies both for the planets. For its Moon it rotates a geometric lunar vector into the true ecliptic of date with IAU 2000B nutation. The lunar node is the true node, derived from the Moon\'s instantaneous orbit.' },
      { p: 'Every change to the engine runs an automated accuracy test: positions are compared against NASA JPL Horizons reference data at two dates, 1907 and 2020, with tolerances of 0.05° for the Sun and planets and 0.15° to 0.2° for the Moon. The test suite also checks the sky against itself, with the tolerance each check actually deserves: at solar culmination the computed midheaven sits within 0.2° of the Sun\'s longitude, and at sunrise the ascendant within 2.5°, looser because sunrise is when the Sun\'s upper limb clears a refracted horizon, which is a different instant from the one the ecliptic ascendant marks.' },
      { h: 3, text: 'Agreement with NASA JPL Horizons' },
      { p: 'On 18 November 2026 we compared the default DE440 calculation in engine 1.1.0 with live NASA JPL Horizons DE441. We used the original 18 chart dates and ten bodies. Horizons returned apparent longitudes at Earth\'s centre in the ecliptic of date. Across the 160 measurements from 1801 to 2026, the median disagreement in longitude was 0.05 arcseconds, the 95th percentile was 0.52 arcseconds, and the largest was 0.53 arcseconds (Pluto in 1801). Among the 16 Moon measurements in that span the median was 0.05 arcseconds and the largest was 0.49 arcseconds. The largest of the 20 far-future measurements was 28.88 arcseconds (the Moon in 2190).' },
      { p: 'We also sampled every tenth day from 1800 to 2199 at noon, for the ten bodies and the North Node. Through 2026 that was 91,201 comparisons, with a median of 0.16 arcseconds and a largest of 0.55 arcseconds (the Moon in 1800). A zodiac sign is 30 degrees, which is 108,000 arcseconds. In this sample a difference of that size could change the sign within 0.55 arcseconds of its edge.' },
      { p: 'DE440 and DE441 are related JPL ephemerides. This comparison measures their agreement on the sampled dates. The exact requests, engine archive digest and comparison figures are in the measurement record.' },
      { h: 2, text: 'Angles and houses' },
      { p: 'The ascendant and midheaven are computed from Greenwich apparent sidereal time, your birthplace coordinates, and the true obliquity of the ecliptic of date: the mean obliquity (IAU 2006) plus the nutation in obliquity, the same model the sidereal time uses. We offer whole sign houses (the oldest system: each house is one complete sign) and Placidus (the most common modern system, computed by iterative semi-arc division). Placidus is mathematically undefined inside the polar circle; where the latitude is 90° minus the obliquity or more, about 66.56°, we fall back to whole sign and say so on the chart.' },
      { h: 2, text: 'Natal aspects and orbs' },
      { p: 'Natal charts test every pair from the Sun through Pluto for the five major aspects below. The nodes are not included. An aspect is shown when its distance from exact is at or below the listed orb; any pair containing the Sun or Moon uses the wider luminary orb.' },
      { table: { head: ['Aspect', 'Exact angle', 'Standard orb', 'With Sun or Moon'], rows: ASPECTS.map((aspect) => [cap(aspect.type), `${aspect.angle}°`, `≤ ${aspect.orb}°`, `≤ ${aspect.orbLuminary}°`]) } },
      { p: 'Applying and separating labels use the bodies’ computed longitude speeds. An aspect is applying while its distance from exact is shrinking, judged from the two bodies’ relative speed at that moment, and separating when it is exact or growing. The displayed orb is the current absolute distance from exact. Fixed-chart synastry and composite aspects do not receive applying or separating labels.' },
      { h: 2, text: 'Time zones' },
      { p: 'A birth chart is only as good as its clock conversion. For births from 1970 on, we resolve your birth time with the IANA time-zone history in your browser\'s host ICU data, daylight saving and its regional rules included. For earlier births the history, wartime clock changes included, comes from a pinned release of the IANA database (below); before the date each place adopted a legal time, we read the birthplace\'s own local mean time, which runs to seconds.' },
      { list: [
        'Skipped times (spring-forward gaps) shift forward across the gap, the standard convention, and the chart says so.',
        'Repeated times (fall-back folds) use the earlier pass, flagged on the chart.',
      ] },
      { p: 'Every birth chart result lists its computed UTC instant, so the conversion is yours to check.' },
      { h: 2, text: 'Birthplace search' },
      { p: 'Place lookup runs against a bundled index of ~34,000 cities from GeoNames (CC BY 4.0), each carrying its IANA time zone. Coordinates are stored to ~1 km precision, far finer than a birth chart needs.' },
      { h: 2, text: 'Privacy' },
      { p: 'The entire chart calculation happens in your browser. Your birth date, time, and place are not sent to a chart API, and there is no account requirement or analytics attached to birth data. Charts you save live in your browser\'s local storage first, deletable by you at any time. If you sign in to an account, your saved charts and their birth details upload to your Supabase account and are protected by row-level security. Guide sends each question to Anthropic; if you press “Attach my chart”, which is offered only in the encrypted sync preview, a placements-only summary goes with each message while “Using my chart” remains on. The assistant never attaches the saved name, birth fields, or coordinates, though the summary\'s positions still give the birth date and time, and its ascendant and midheaven, kept to the whole degree, the birthplace roughly. A transit calendar or a compatibility invitation sends a chart\'s positions, which still give the birth date and time; the privacy page lists every case.' },
      { h: 2, text: 'Honest limits' },
      { list: [
        'Chiron and the asteroids aren\'t included yet (the engine\'s remit is major bodies); they\'re planned via public-domain JPL data.',
        'When birth time is unknown, the site uses 12:00 local civil time as a reference for body positions. It omits the rising sign, angles, and houses, and it marks the Moon\'s sign as unverified, because the Moon can change sign during the day. A link, calendar, invitation, or card shared from such a chart carries the positions at 12:00 UTC on the birth date instead, because noon at the birthplace would give away its time zone or, before standard time, its longitude.',
        'Supported birth years: 1800 to 2199.',
        'The JPL checks validate astronomical position calculations, not astrological interpretation. Interpretations here are traditional and reflective, not scientifically validated predictions.',
      ] },
      { p: 'Found a discrepancy? We treat accuracy reports as bugs. The sky is checkable, and so is our arithmetic.' },
    ],
  };
}

function privacy(): Twin {
  return {
    slug: 'privacy',
    title: 'Your birth details leave your device only when you send them.',
    // The page's meta description names the wing's lookups; the twin covers the consumer sections only, so it leaves it out.
    blocks: [
      { h: 2, text: 'What happens when you use a calculator' },
      { p: 'Every chart you calculate here is computed on your own device. When you enter a birth date, time, and place, that information is used by code running in your browser to calculate the chart. It is not transmitted to our servers, logged, or stored by us as part of that calculation. It leaves the device only if you share a link that carries it or put it in an assistant message. This is a deliberate design choice, described in full on our methodology page.' },
      { p: 'Place search downloads from zodiacs.org a city file chosen by the first letter you type, and searches it in your browser. For a birth before 1970, the calculator also downloads a file of historical clock changes chosen by the birthplace\'s time zone. Neither request goes to any other service. Which files are requested shows our host the first letter of the city you typed and, for a birth before 1970, a group of time zones that includes the birthplace\'s. When a page shows the signs of a birth chart, it first requests the pictures of all twelve signs, in the same order for every chart, so those requests do not show which signs the chart has.' },
      { h: 2, text: 'Guide' },
      { p: t('en', 'trustGuideNotice'), computed: true },
      { p: 'When you send a question to Guide, that message, recent Guide messages, and the visible Guide context are sent to Anthropic for an input safety check and to generate a draft reply. That generated draft reply is then sent back to Anthropic for a second safety check before you see it. The current web Guide conversation stays only in this browser session, is not synced to an account, and is not stored as text on Zodiacs.org servers, whether or not you are signed in. Anthropic says it does not use API inputs or outputs to train models by default and deletes them from its backend within 30 days, except when the law or enforcement of its Usage Policy requires longer retention. To enforce the daily limit, we keep a salted one-way identifier derived from your IP address, never the raw IP, with its daily count and a record of each request. Each later quota check deletes counts older than the previous UTC day and request records older than 48 hours. We do not send that identifier to Anthropic or put conversation text in provider metadata. Guide also sets a session cookie holding a random, signed identifier. It is used to limit simultaneous requests from one browser, lasts until the browser session ends, and is not stored with your messages.' },
      { h: 2, text: 'The compute API' },
      { p: 'The compute API is for programs: it computes a chart, positions, houses, events, a local time, a sky fact or the stretches of time in which chosen conditions hold, from what a program sends it. The site\'s own calculators do not use it. It reads the body of each request, which can hold a birth date, time and place, and nothing from the query string. Nothing from a request or its result is written to a log, a file or a database, no error repeats what was sent, and every response is marked so that no cache stores it. When a request ends, including a refused or failed request, the server clears its last calculated frame and epoch-selected ephemeris segments and discards that request\'s time zone lookup maps. Fixed public tables remain available to later calculations. This removes application-held references; it does not guarantee discarded memory is overwritten or describe every log the hosting platform may keep. To enforce the rate limit, the API sends the request\'s headers, which include your IP address, to Vercel\'s firewall, which counts the requests from each address; it never sends the body. Our host\'s logs, described below, keep the full web address of each request, so birth details belong in the body, not in the address.' },
      { h: 2, text: 'Hosting, logs, and analytics' },
      { p: 'The site is hosted on Vercel. Like all web hosts, their servers process the requests your browser makes and may keep short-lived technical logs (such as IP address and browser type) to deliver the site and guard against abuse. We do not run advertising, and we use no cross-site tracking cookies or third-party marketing pixels.' },
      { p: 'We count page views and anonymous feature usage with Plausible, a cookieless analytics service. To avoid counting the same device repeatedly during one day, Plausible briefly processes the IP address and user agent to derive an identifier scoped to this site, device, and day. The raw IP and user agent are not stored; the salt used for that identifier rotates and is deleted every 24 hours.' },
      { h: 2, text: 'Children' },
      { p: 'The site is intended for a general audience and is not directed at children under 13. We do not knowingly collect personal information from them.' },
      { h: 2, text: 'Changes' },
      { p: 'If we change how we handle data, we will update this page and its date. Material changes to the account or email features will be reflected here before they take effect.' },
      { h: 2, text: 'Contact' },
      { p: 'Privacy and deletion requests may be sent to Zodiacs LLC at admin@zodiacs.org.' },
      { p: 'Last updated: 13 November 2026', computed: true },
    ],
  };
}

function about(): Twin {
  return {
    slug: 'about',
    title: 'A straight answer about the sky.',
    description: 'Who runs Zodiacs.org and why: a free astrology reference where charts are computed from real astronomy and kept private on your device.',
    blocks: [
      { p: 'Zodiacs.org is a free astrology reference built on one idea: the astronomy can be exact even when the interpretation is a tradition. Every chart here is computed from the real positions of the planets and kept on your own device.' },
      { h: 2, text: 'Company' },
      { p: 'Zodiacs.org is the official website of Zodiacs LLC, a New Mexico limited liability company formed on August 11, 2026. Zodiacs LLC owns and operates this website and develops Zodiacs: Birth Chart. Company, legal, press, and support inquiries may be sent to admin@zodiacs.org.' },
      { h: 2, text: 'Why it exists' },
      { p: 'Most astrology sites are either beautiful and vague or accurate and unreadable. The calculators that get the math right tend to look like tax software; the ones that feel good tend to hand-wave the numbers. We wanted a third option, a place where you can get your full birth chart in about twenty seconds, see the exact degrees behind every claim, and read what they mean in ordinary words.' },
      { p: 'The reading comes first. Exact degrees, dated sky facts, and sources stay close by for anyone who wants to check them, without turning every page into a technical report.' },
      { h: 2, text: 'Accuracy without the homework' },
      { p: 'When a date, degree, or birth time matters, it is calculated against the actual sky and checked before it appears. If you want the ephemeris, house systems, historical time-zone handling, and accuracy limits, the full methodology is public.' },
      { h: 2, text: 'Your data stays yours' },
      { p: 'The engine runs in your browser, so chart calculation sends no birth fields to a chart API. Charts you save live on your device; if you sign in to a free account, they sync to it with their birth details. If you explicitly attach a chart to Guide, which is offered only in the encrypted sync preview and not on the public site, its placements-only summary, not the saved name or raw birth fields, is sent with your question to Anthropic for that conversation; its positions still give your birth date and time. There are no ads and no cross-site tracking. The full detail is on the privacy page.' },
      { h: 2, text: 'How Zodiacs.org is maintained' },
      { p: 'Zodiacs.org is a Zodiacs LLC publication maintained by automated systems, without a traditional human editorial staff. Articles use the Zodiacs.org organizational byline; there is no invented editor, biography, or set of credentials behind it. The calculators remain free because the core math runs on your device.' },
      { h: 2, text: 'Get in touch' },
      { p: 'Corrections, questions, press, or a request about your data: write to admin@zodiacs.org. If you have spotted an astrological or astronomical error on a page, tell us which page; accuracy reports are the ones we answer first.' },
      { p: 'The support page says what to include and where the policies and developer documentation are.' },
      { p: 'For a correction or removal request concerning a page in the People directory, write to people@zodiacs.org.' },
    ],
  };
}

const BUILDERS: Record<TwinSlug, () => Twin> = {
  'birth-chart': birthChart,
  compatibility,
  'moon-sign': moonSign,
  'rising-sign': risingSign,
  'saturn-return': saturnReturn,
  'mercury-retrograde': mercuryRetrograde,
  'full-moon-calendar': fullMoonCalendar,
  eclipses,
  horoscopes,
  methodology,
  privacy,
  about,
};

/** The twin of one page, built now from the same data and strings as the page. */
export const buildTwin = (slug: TwinSlug): Twin => BUILDERS[slug]();
