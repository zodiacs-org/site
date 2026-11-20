/**
 * Trending on X: match the names people are talking about today to the Year
 * Ahead directory (src/data/year-people.json) and draft one post per match for
 * the marketing team. Names the directory does not have are left out of the
 * report unless the run asks for them (--list-unmatched): trending names
 * include private people, minors and victims.
 *
 * Nothing here publishes anything: it never adds a person to the directory and
 * never posts. Drafts are plain text for a human to read, edit and post by hand.
 * Pure: no network, storage or logging (the X fetch lives in the script).
 */
import { YEAR_PEOPLE, personKey, type YearPerson } from './people';
import { rangeWorthShowing } from './range';

/** A post on X fits in 280 characters; a link counts as 23 of them. */
export const X_POST_LIMIT = 280;
const X_LINK_LENGTH = 23;
const MAX_INPUT_NAMES = 200;

/** "#ElonMusk", "@elonmusk" and "Elon Musk" all compare as "elonmusk". */
export function compactKey(text: string): string {
  return personKey(text.replace(/^[#@]/u, '')).replaceAll(' ', '');
}

const BY_COMPACT = new Map<string, YearPerson>();
for (const person of YEAR_PEOPLE) {
  for (const key of [person.name, person.slug, ...person.aliases]) BY_COMPACT.set(compactKey(key), person);
}

/** What a draft reads from a get_year_score answer (src/ai-tools/features/year-score.ts). */
export interface DraftScore {
  status: 'found' | 'not-in-directory';
  score: number | null;
  label: string | null;
  best: { name: string } | null;
  hardest: { name: string } | null;
  drivers: { title: string }[];
  confidenceLabel: string | null;
  /** Without a birth time: the lowest and highest score across the birth day, as the figure's page shows it. */
  scoreRange?: { low: number; high: number } | null;
}

export interface TrendInput { name: string; volume?: number | null }
export interface TrendMatch { trend: string; volume: number | null; person: YearPerson }
export interface TrendReport { matches: TrendMatch[]; unmatched: TrendInput[] }

/** Words that are never a person's name on their own, so a trend made of them is not offered for review. */
const NOT_A_NAME = /^[#@]?(?:\d+|(?:breaking|news|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|good|happy|national|world)\w*)$/iu;

export function matchTrends(trends: readonly TrendInput[]): TrendReport {
  const matches: TrendMatch[] = [];
  const unmatched: TrendInput[] = [];
  const seen = new Set<string>();
  for (const trend of trends.slice(0, MAX_INPUT_NAMES)) {
    const name = trend.name.trim();
    if (!name || name.length > 80) continue;
    const key = compactKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const person = BY_COMPACT.get(key);
    if (person) {
      if (!matches.some((match) => match.person.slug === person.slug)) matches.push({ trend: name, volume: trend.volume ?? null, person });
    } else if (!NOT_A_NAME.test(name)) unmatched.push({ name, volume: trend.volume ?? null });
  }
  return { matches, unmatched };
}

/**
 * What a draft must never carry (Dias, 9 November 2026): a price, stock or
 * crypto call, a buy or sell signal, a diagnosis or medical timing, a death
 * prediction, a legal win or loss, doom, or the en and em dashes the site's
 * copy leaves out. Money, career, wellbeing and legal themes read the
 * traditional way are fine. A draft that trips this is withheld from the
 * report, never softened silently.
 *
 * Each class is matched by family, not by the one phrase that prompted it:
 * any currency sign or written amount, a price, share or value move, a coin
 * or ticker, and a short or long call on one; any hospital or clinical word
 * and any named condition or procedure; any win or loss, any court word and
 * any legal outcome however it is phrased. A draft's own fixed words (the score,
 * the tier labels, the transit titles, "Reading confidence NN%" and the note)
 * stay clear of every class, which trending.test.ts checks for every figure.
 */
const BANNED_CLASSES = [
  // A price, stock or crypto call: a currency sign or cashtag, a percentage
  // move (the confidence label's own percentage aside), a price, a market, a
  // move in one, or a coin.
  String.raw`[$\u20ac\u00a3\u00a5\u20b9\u20a9\u20bd\u20bf\u00a2]`,
  String.raw`(?<!confidence )\b\d+(?:[.,]\d+)?\s?(?:%|per ?cent\b)`,
  // A written amount: a currency named in words (with or without a number),
  // a number with a currency word or a money scale, or a number a price
  // reaches. The score's own "6.4/10" has no such word beside it.
  String.raw`\b(?:dollars?|euros?|cents?|bucks|quid|rupees?|pesos?|yuan|renminbi|r[ou]bles?|francs?|lira|liras|dirhams?|riyals?|shekels?|ringgits?|bahts?|rands?)\b`,
  String.raw`\b\d[\d,.]*\s?(?:k|m|mn|bn|tn|grand|pounds?|yen|won|million|billion|trillion|sterling)\b`,
  String.raw`\b(?:reach(?:es|ed|ing)?|hit(?:s|ting)?|tops|topped|topping|break(?:s|ing)?|broke|cross(?:es|ed|ing)?|clear(?:s|ed|ing)?|clos(?:es|ed|ing) at|open(?:s|ed|ing)? at|valued at|worth|target(?:s|ed|ing)?)\s+(?:the\s+)?\d`,
  String.raw`\b(?:prices?|priced|pricing|price targets?|valuations?|market caps?|stocks?|share prices?|shareholders?|equit(?:y|ies)|dividends?|ipos?|tickers?|nasdaq|nyse|s&p|dow jones|ftse|nikkei|etfs?|portfolios?|invest\w*|trading|traders?|markets|the market|bull (?:run|market)|bullish|bear market|bearish|rall(?:y|ies|ied|ying)|surg(?:e|es|ed|ing)|soar\w*|plung\w*|plummet\w*|skyrocket\w*|tank(?:s|ed|ing)|pump\w*|dump\w*|slump\w*|nosediv\w*|freefall\w*|to the moon|moonshot|all[- ]time (?:highs?|lows?)|\d+x)\b`,
  // A move in shares or value, whatever the verb: up, down, double, halve, jump, slide.
  String.raw`\b(?:shares?|(?:net )?worth|market value|its value|their value)\s+(?:(?:are|is|were|was|have|has|could|will|may|might|to|set to|should)\s+)?(?:(?:go|be)\s+)?(?:up|down|doubl\w*|tripl\w*|quadrupl\w*|halv\w*|jump\w*|climb\w*|ris(?:e|es|en|ing)|rose|gain\w*|fall\w*|fell|drop\w*|slid\w*|slip\w*|sink\w*|sank|sunk|spik\w*|rebound\w*|recover\w*|hit\w*|reach\w*|tops?|topped|break\w*|broke|lower|higher|\d)`,
  String.raw`\b(?:doubl|tripl|quadrupl)(?:es|ed|ing)\b|\bhalv(?:ed|ing)\b`,
  // A coin or a crypto exchange, by name or by a ticker that is not an
  // ordinary English word (tickers that are words are matched in capitals
  // by DRAFT_BANNED_CASED below).
  String.raw`\b(?:crypto\w*|bitcoin|btc|eth|ether|ethereum|solana|dogecoin|doge|xrp|cardano|binance|coinbase|tether|usdt|usdc|busd|bnb|avax|matic|shib|shiba|trx|tron|ltc|bch|xlm|xmr|monero|polkadot|chainlink|uniswap|hbar|hedera|okx|bybit|ftx|kucoin|altcoins?|memecoins?|stablecoins?|\w*coins?|tokens?|nfts?|defi|web3|blockchain|on-?chain|airdrops?|hodl|satoshis?|wallets?|exchange listing)\b`,
  // A buy or sell signal, including a short or long position in anything.
  String.raw`\b(?:buy\w*|sells?|selling|sell-?offs?|sold|short(?:ing|ed)? (?:the|it|them|on|shares|stock|positions?)|short (?:sellers?|selling|squeeze|positions?)|long positions?|go(?:ing)? (?:long|short)|take profits?|profit[- ]taking|stop[- ]loss|entry point|exit point|accumulate)\b`,
  // A diagnosis or medical timing: any clinical, hospital or treatment word.
  String.raw`\b(?:diagnos\w*|prognos\w*|surger\w*|surgical|operations?|treatments?|medic\w*|illness\w*|ill|sick\w*|diseases?|disorders?|syndromes?|symptoms?|infect\w*|virus\w*|cancer|tumou?rs?|stroke(?! of)|heart attack|cardiac|seizures?|overdos\w*|injur\w*|hospital\w*|clinic\w*|icu|intensive care|emergency room|ambulance|doctors?|physicians?|therap(?:y|ies)|chemo\w*|radiotherap\w*|transplant\w*|vaccin\w*|prescri\w*|rehab\w*|pregnan\w*|miscarr\w*|recover(?:y|ies)|relapse\w*|remission|cure\w*|health (?:scare|crisis|problems?|issues?|news|decline)|mental (?:illness|breakdown)|depression|dementia|alzheimer\w*|diabet\w*|paraly\w*|coma)\b`,
  // Named conditions and procedures, by their clinical endings (-itis,
  // -ectomy, -otomy, -ostomy, -plasty, -oscopy; never dichotomy or
  // horoscopy) and by name.
  String.raw`\b(?:\w+itis|\w+ectom(?:y|ies)|\w+(?<!dich)otom(?:y|ies)|\w+ostom(?:y|ies)|\w+oplast(?:y|ies)|\w+(?<!hor)oscop(?:y|ies))\b`,
  String.raw`\b(?:dialys[ie]s|pneumonia|influenza|flu|covid\w*|coronavirus\w*|measles|malaria|tuberculosis|sepsis|septic|cirrhosis|sclerosis|thrombos[ie]s|psychos[ie]s|neuros[ie]s|osteoporosis|embolism\w*|aneurysms?|ha?emorrhag\w*|concussions?|fractur\w*|sprain\w*|torn (?:acl|ligaments?|muscles?|hamstrings?|achilles|meniscus|rotator cuff)|acl|ligaments?|hamstrings?|broken (?:legs?|arms?|bones?|ankles?|wrists?|hips?|necks?|backs?|ribs?|foot|feet|hands?)|blood (?:clots?|pressure|tests?|transfusions?|cancer)|clots?|heart (?:failure|conditions?|surgery|problems?|disease|trouble|scare)|kidneys?|liver (?:failure|disease)|lungs?|biops(?:y|ies)|autops(?:y|ies)|mri|ct scans?|x-?rays?|ultrasounds?|scans? results?|test results?|outpatients?|inpatients?|amputat\w*|stents?|ivf|c-section|ca?esarean|epidurals?|ana?esthe\w*|intubat\w*|ventilators?|life support|quarantin\w*|pandemic\w*|epidemic\w*|outbreaks?|contagio\w*|leuka?emia|lymphoma|melanoma|carcinoma|sarcoma|myeloma|glaucoma|cataracts?|asthma\w*|allerg\w*|migraines?|insomnia|nausea|autis\w*|adhd|bipolar|schizophren\w*|psychiatr\w*|anorexi\w*|bulimi\w*|addict\w*|alcoholism|opioids?|parkinson\w*|epilep\w*|menopaus\w*|infertil\w*|neurolog\w*|oncolog\w*|cardiolog\w*|nurses?|paramedics?|wards?|bedside|bed rest|sick leave|medical leave)\b`,
  // A death prediction.
  String.raw`\b(?:death\w*|dead|deadly|die[sd]?|dying|deceas\w*|pass(?:es|ed|ing)? away|fatal\w*|funerals?|mortal\w*|obituar\w*|kill\w*|murder\w*|assassinat\w*|suicid\w*|rest in peace)\b`,
  // A legal win or loss, and any other win or loss called in advance.
  String.raw`\b(?:lawsuits?|litigat\w*|su(?:e|es|ed|ing)|verdicts?|jur(?:y|ies)|courts?|courtroom|(?:on|stand|stands|face|faces|facing) trial|trial (?:date|verdict)|indict\w*|convict\w*|acquit\w*|guilty|sentenced|prosecut\w*|plaintiffs?|defendants?|arrest\w*|jail\w*|prison\w*|legal (?:win|victory|loss|defeat|battle|fight|trouble)\w*)\b`,
  String.raw`\b(?:wins?|won|winning|winners?|loses?|losing|losers?|victor(?:y|ies|ious)|defeat\w*|(?:will|going to|set to|about to|bound to|sure to|likely to) (?:win|lose|beat|fall|rise))\b`,
  String.raw`\blost (?:the|a|an|his|her|their) (?:case|suit|lawsuit|appeal|trial|match|final|election|race|fight|battle)\b`,
  // Any legal outcome, however it is phrased: a ruling's verb, a court
  // officer, or a case, appeal, charge or claim with its result.
  String.raw`\b(?:dismiss(?:es|ed|ing|al|als)?|overturn\w*|upheld|uphold\w*|overrul\w*|quash\w*|struck down|strikes? down|thrown out|throws? out|exonerat\w*|pardon\w*|cleared of|found (?:not )?(?:guilty|liable|innocent)|liable|liability|injunctions?|subpoena\w*|testif\w*|testimony|depositions?|plea (?:deals?|bargains?)|pleads?|pleaded|pled|extradit\w*|judges?|judicial|attorneys?|lawyers?|solicitors?|barristers?|tribunals?|magistrates?|prosecutors?|legal (?:case|action|challenge|dispute|ruling)s?|charged with|charges? (?:dropped|filed|laid|brought|cleared)|ruled (?:against|for|in (?:favou?r|(?:his|her|their|its) favou?r))|rules? (?:against|for) (?:him|her|them|it)|in (?:his|her|their|its) favou?r|settl(?:e|es|ed|ing|ements?) (?:(?:of |over |in |with )?(?:the |a |an |his |her |their |its )|out of )?(?:case|suit|lawsuit|claim|dispute|charges?))\b`,
  String.raw`\b(?:appeals?|case|cases|suits?|claims?|charges?|indictments?|convictions?|sentences?|rulings?|judgments?|judgements?|petitions?|motions?|complaints?|hearings?|bids?|challenges?|bans?|suspensions?)\s+(?:(?:is|are|was|were|gets?|got|has been|have been|will be|to be|could be|may be|set to be|likely to be)\s+)?(?:dismissed|denied|rejected|granted|upheld|overturned|thrown out|struck down|dropped|quashed|reversed|vacated|allowed|refused|lifted|fails?|failed|succeeds?|succeeded|settled|won|lost)\b`,
  // Doom, and any guarantee.
  String.raw`\b(?:doom\w*|disasters?|disastrous|ruin\w*|crash\w*|collaps\w*|catastroph\w*|calamit\w*|cataclysm\w*|apocalyp\w*|downfall|meltdown|implo\w*|bankrupt\w*|insolven\w*|tragic|traged(?:y|ies)|devastat\w*|nightmare|worst|scandal\w*|disgrace\w*|fall from grace|cursed?|ill[- ]fated|end of (?:the road|an era|(?:his|her|their) career)|guarantee\w*)\b`,
  // The dashes the site's copy leaves out: figure, en, em, horizontal bar and their wide forms.
  String.raw`[\u2012-\u2015\u2e3a\u2e3b\ufe31\ufe32\ufe58]`,
];
export const DRAFT_BANNED = new RegExp(BANNED_CLASSES.join('|'), 'iu');

/**
 * The part of the guard that reads capitals: a ticker is written in capitals,
 * and several are ordinary words in lower case (SOL, DOT, LINK, NEAR, TON), so
 * they are matched only as written. A short or long call on any ticker ("Short
 * NVDA", "long TSLA"), a coin ticker, or a currency code. No name in the
 * directory is written in capitals, which trending.test.ts checks.
 */
export const DRAFT_BANNED_CASED = new RegExp([
  String.raw`\b(?:[Ss]hort|SHORT|[Ll]ong|LONG)(?:s|ed|ing|S|ED|ING)?\s+\$?[A-Z]{2,5}\b`,
  String.raw`\b[A-Z]{2,5}\s+(?:shorts?|SHORTS?|calls|puts|CALLS|PUTS)\b`,
  String.raw`\b(?:BTC|ETH|BNB|SOL|XRP|ADA|DOGE|DOT|LINK|AVAX|MATIC|POL|SHIB|PEPE|TRX|TON|LTC|BCH|XLM|XMR|ATOM|NEAR|UNI|APT|ARB|OP|SUI|INJ|HBAR|ICP|FIL|ETC|DAI|USDT|USDC|BUSD|CRO|OKB|WIF|BONK|FLOKI|TAO|RNDR|KAS|SEI|TIA|JUP|ENA|ONDO|WLD|MKR|AAVE|STX|IMX|ALGO|EOS|XTZ|SAND|MANA|AXS|GALA|FTM|HYPE)\b`,
  String.raw`\b(?:USD|EUR|GBP|JPY|CNY|CNH|RMB|INR|CHF|AUD|CAD|NZD|HKD|SGD|KRW|BRL|MXN|RUB|ZAR|AED|SAR)\b`,
].join('|'), 'u');

/** True when a draft would carry anything the guard withholds. */
export function draftWithheld(text: string): boolean {
  return DRAFT_BANNED.test(text) || DRAFT_BANNED_CASED.test(text);
}


/**
 * The fixed note every draft ends with. A person trends for a reason the draft
 * cannot see (results day, a final, an arrest), so the draft says what it is.
 */
export const DRAFT_NOTE = 'A reading of a public birth date, not of a company, a team or a result.';

/** A draft post for one match, under X's limit with its link counted as 23 characters, or null if it trips the guard. */
export function draftPost(person: YearPerson, data: DraftScore, url: string): string | null {
  // No score, no wording or no confidence label: no draft, rather than one with a gap in it.
  if (data.status !== 'found' || data.score === null || !data.label || !data.confidenceLabel) return null;
  // The same range, in the same words, as the figure's /year/ page shows beside its score.
  const range = data.scoreRange ?? null;
  const between = rangeWorthShowing(range) ? ` (between ${range.low.toFixed(1)} and ${range.high.toFixed(1)} without a birth time)` : '';
  const headline = `${person.name}'s next twelve months on the Zodiacs Year Ahead Score: ${data.score.toFixed(1)}/10${between}, ${data.label.charAt(0).toLowerCase()}${data.label.slice(1)}.`;
  // No month is named, for anyone: next to a person in the news, a best or
  // hardest month reads as a stock call, a sports pick or worse.
  const transit = data.drivers[0] ? `Main transit: ${data.drivers[0].title.replace(' your ', ` ${person.name.split(' ')[0]}'s `)}.` : null;
  const ending = [`${data.confidenceLabel}.`, DRAFT_NOTE];
  const fits = (text: string) => text.length + 1 + X_LINK_LENGTH <= X_POST_LIMIT;
  const full = [headline, ...(transit ? [transit] : []), ...ending].join(' ');
  // The label is read as given too: the headline lowercases its first letter,
  // which would hide a ticker or currency code that opens it ("EUR 30").
  if (draftWithheld(full) || draftWithheld(data.label)) return null;
  // Too long: the main transit goes first. The confidence label and the note are never dropped.
  const text = fits(full) ? full : [headline, ...ending].join(' ');
  return fits(text) ? `${text}\n${url}` : null;
}

/** What a reviewer must check before posting any draft. Printed under every match. */
export const REVIEW_CHECKLIST = [
  'Before posting, find out why this name is trending.',
  'Do not post if it is a death, an illness or injury, an arrest, charge or trial, an election,',
  'company results or a deal, or a match or contest within seven days.',
] as const;

export interface ReportMatch {
  trend: string;
  volume: number | null;
  slug: string;
  name: string;
  score: number | null;
  label: string | null;
  url: string;
  draft: string | null;
}

export interface ReportInput {
  date: string;
  source: string;
  namesRead: number;
  matches: readonly ReportMatch[];
  unmatched: readonly TrendInput[];
  /** Only with --list-unmatched. Off by default, and the workflow never turns it on. */
  listUnmatched: boolean;
}

/** The Markdown and JSON report for one run. Matches only, unless the run asked for the unmatched names. */
export function buildTrendingReport(input: ReportInput): { markdown: string; json: string } {
  const { date, source, namesRead, matches, unmatched, listUnmatched } = input;
  const lines = [
    `# Trending on X: ${date}`,
    '',
    `Source: ${source}. ${namesRead} names read, ${matches.length} in the Year Ahead directory${listUnmatched ? `, ${unmatched.length} not in it` : ''}.`,
    '',
    'Nothing here has been posted or published. Drafts are for the marketing team to read, edit and post by hand. Check each draft before posting: no price or trading calls, no diagnoses, no death predictions, no legal outcomes.',
    '',
    'Each draft links to the figure\'s /year/ page, which is live only once PUBLIC_YEAR_PEOPLE_ENABLED is on. Open the link before posting.',
    '',
    '## Matches and draft posts',
    '',
    ...(matches.length ? matches.flatMap((match) => [
      `### ${match.name} (trend: ${match.trend}${match.volume ? `, ${match.volume} posts` : ''})`,
      '',
      match.draft ? ['```text', match.draft, '```'].join('\n') : '_No draft: the score could not be worded within the rules or the length. Write one by hand or skip._',
      '',
      ...REVIEW_CHECKLIST.map((line) => `> ${line}`),
      '',
    ]) : ['None today.', '']),
    ...(listUnmatched ? [
      '## Not in the directory (for human review)',
      '',
      'Add a person only after checking: an adult public figure known for their work, a public birth date with a cited source, and no dispute between sources. Never a minor.',
      '',
      ...(unmatched.length ? unmatched.map((row) => `- ${row.name}${row.volume ? ` (${row.volume} posts)` : ''}`) : ['None.']),
      '',
    ] : []),
  ];
  const json = {
    schema: 'zodiacs.trending-x.v1',
    date,
    source,
    matches: matches.map((match) => ({ ...match, matchedTrend: match.trend, reviewRequired: true as const })),
    ...(listUnmatched ? { unmatched } : {}),
    posted: false,
  };
  return { markdown: lines.join('\n'), json: `${JSON.stringify(json, null, 2)}\n` };
}
