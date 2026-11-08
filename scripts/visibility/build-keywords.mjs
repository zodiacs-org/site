#!/usr/bin/env node
// Write the query list for the five high-volume astrology families in every
// locale the site knows, one CSV per locale, ready to paste into Google
// Keyword Planner ("Get search volume and forecasts") or to match against a
// Search Console export. Volumes are left as TBD: nothing here is estimated.
//
//   node scripts/visibility/build-keywords.mjs            # writes docs/visibility/keywords/
//   node scripts/visibility/build-keywords.mjs --check    # fails if the files are stale
//
// Columns: locale, kp_language, kp_locations, family, subfamily, query,
// target_url, coverage, monthly_volume, volume_source, competition, notes.
// Queries are written the way people type them in each language (lowercase,
// accents kept), not translated word for word from English. Arabic and the
// two Chinese lists need a native speaker's review before use (see notes).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { VIS_DIR } from './lib.mjs';

const SLUGS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const pairSlug = (a, b) => (SLUGS.indexOf(a) <= SLUGS.indexOf(b) ? `${a}-${b}` : `${b}-${a}`);

// Coverage on 2026-11-08 (docs/visibility/baseline/2026-11-08/coverage.md).
// full: a page in this language answers it; partial: a page exists but not
// for this period or not in this language; none: no page.
const L = {
  en: {
    prefix: '', lang: 'English', loc: 'United States; United Kingdom; Canada; Australia; India',
    signs: ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'],
    horoscope: { today: (s) => `${s} horoscope today`, tomorrow: (s) => `${s} horoscope tomorrow`, weekly: (s) => `${s} weekly horoscope`, monthly: (s) => `${s} monthly horoscope`, yearly: (s) => `${s} horoscope 2027` },
    pair: (a, b) => `${a} and ${b} compatibility`,
    signQ: [(s) => `${s} traits`, (s) => `${s} zodiac sign`, (s) => `${s} man`, (s) => `${s} woman`, (s) => `${s} dates`, (s) => `${s} personality`],
    chart: ['birth chart', 'natal chart', 'free birth chart', 'birth chart calculator', 'natal chart calculator', 'birth chart reading', 'how to read a birth chart', 'rising sign calculator', 'moon sign calculator', 'big three calculator'],
    sky: [['moon-phase', 'moon phase today'], ['moon-phase', 'moon tonight'], ['full-moon', 'full moon november 2026'], ['new-moon', 'new moon november 2026'], ['mercury-retrograde', 'mercury retrograde 2027'], ['mercury-retrograde', 'is mercury retrograde'], ['retrogrades', 'planets in retrograde now'], ['eclipses', 'eclipse 2027'], ['eclipses', 'solar eclipse 2027'], ['mars-retrograde', 'mars retrograde 2027']],
  },
  es: {
    prefix: '/es', lang: 'Spanish', loc: 'Spain; Mexico; Argentina; Colombia; United States',
    signs: ['aries', 'tauro', 'géminis', 'cáncer', 'leo', 'virgo', 'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis'],
    horoscope: { today: (s) => `horóscopo ${s} hoy`, tomorrow: (s) => `horóscopo ${s} mañana`, weekly: (s) => `horóscopo semanal ${s}`, monthly: (s) => `horóscopo mensual ${s}`, yearly: (s) => `horóscopo ${s} 2027` },
    pair: (a, b) => `compatibilidad ${a} y ${b}`,
    signQ: [(s) => `${s} características`, (s) => `signo ${s}`, (s) => `hombre ${s}`, (s) => `mujer ${s}`, (s) => `${s} fechas`, (s) => `${s} personalidad`],
    chart: ['carta astral', 'carta natal', 'carta astral gratis', 'calcular carta astral', 'carta astral completa', 'cómo leer una carta astral', 'calcular ascendente', 'ascendente calculadora', 'signo lunar', 'sol luna y ascendente'],
    sky: [['moon-phase', 'fase lunar hoy'], ['moon-phase', 'luna hoy'], ['full-moon', 'luna llena noviembre 2026'], ['new-moon', 'luna nueva noviembre 2026'], ['mercury-retrograde', 'mercurio retrógrado 2027'], ['mercury-retrograde', 'mercurio retrógrado hoy'], ['retrogrades', 'planetas retrógrados ahora'], ['eclipses', 'eclipse 2027'], ['eclipses', 'eclipse solar 2027'], ['mars-retrograde', 'marte retrógrado 2027']],
  },
  pt: {
    prefix: '/pt', lang: 'Portuguese', loc: 'Brazil; Portugal',
    signs: ['áries', 'touro', 'gêmeos', 'câncer', 'leão', 'virgem', 'libra', 'escorpião', 'sagitário', 'capricórnio', 'aquário', 'peixes'],
    horoscope: { today: (s) => `horóscopo ${s} hoje`, tomorrow: (s) => `horóscopo ${s} amanhã`, weekly: (s) => `horóscopo semanal ${s}`, monthly: (s) => `horóscopo mensal ${s}`, yearly: (s) => `horóscopo ${s} 2027` },
    pair: (a, b) => `${a} e ${b} combinam`,
    signQ: [(s) => `signo de ${s} características`, (s) => `signo de ${s}`, (s) => `homem de ${s}`, (s) => `mulher de ${s}`, (s) => `${s} signo data`, (s) => `personalidade de ${s}`],
    chart: ['mapa astral', 'mapa astral grátis', 'mapa astral completo', 'calcular mapa astral', 'mapa natal', 'como ler mapa astral', 'calcular ascendente', 'ascendente', 'signo lunar', 'sol lua e ascendente'],
    sky: [['moon-phase', 'fase da lua hoje'], ['moon-phase', 'lua hoje'], ['full-moon', 'lua cheia novembro 2026'], ['new-moon', 'lua nova novembro 2026'], ['mercury-retrograde', 'mercúrio retrógrado 2027'], ['mercury-retrograde', 'mercúrio retrógrado hoje'], ['retrogrades', 'planetas retrógrados agora'], ['eclipses', 'eclipse 2027'], ['eclipses', 'eclipse solar 2027'], ['mars-retrograde', 'marte retrógrado 2027']],
  },
  fr: {
    prefix: '/fr', lang: 'French', loc: 'France; Belgium; Switzerland; Canada (Quebec)',
    signs: ['bélier', 'taureau', 'gémeaux', 'cancer', 'lion', 'vierge', 'balance', 'scorpion', 'sagittaire', 'capricorne', 'verseau', 'poissons'],
    horoscope: { today: (s) => `horoscope ${s} aujourd'hui`, tomorrow: (s) => `horoscope ${s} demain`, weekly: (s) => `horoscope ${s} semaine`, monthly: (s) => `horoscope ${s} mois`, yearly: (s) => `horoscope ${s} 2027` },
    pair: (a, b) => `compatibilité ${a} ${b}`,
    signQ: [(s) => `${s} caractère`, (s) => `signe ${s}`, (s) => `homme ${s}`, (s) => `femme ${s}`, (s) => `${s} dates`, (s) => `${s} personnalité`],
    chart: ['thème astral', 'thème astral gratuit', 'carte du ciel', 'calcul thème astral', 'thème natal', 'lire son thème astral', 'calcul ascendant', 'calculer son ascendant', 'signe lunaire', 'soleil lune ascendant'],
    sky: [['moon-phase', "phase de la lune aujourd'hui"], ['moon-phase', "lune aujourd'hui"], ['full-moon', 'pleine lune novembre 2026'], ['new-moon', 'nouvelle lune novembre 2026'], ['mercury-retrograde', 'mercure rétrograde 2027'], ['mercury-retrograde', 'mercure rétrograde en ce moment'], ['retrogrades', 'planètes rétrogrades en ce moment'], ['eclipses', 'éclipse 2027'], ['eclipses', 'éclipse solaire 2027'], ['mars-retrograde', 'mars rétrograde 2027']],
  },
  it: {
    prefix: '/it', lang: 'Italian', loc: 'Italy; Switzerland',
    signs: ['ariete', 'toro', 'gemelli', 'cancro', 'leone', 'vergine', 'bilancia', 'scorpione', 'sagittario', 'capricorno', 'acquario', 'pesci'],
    horoscope: { today: (s) => `oroscopo ${s} oggi`, tomorrow: (s) => `oroscopo ${s} domani`, weekly: (s) => `oroscopo settimanale ${s}`, monthly: (s) => `oroscopo del mese ${s}`, yearly: (s) => `oroscopo ${s} 2027` },
    pair: (a, b) => `affinità ${a} ${b}`,
    signQ: [(s) => `${s} caratteristiche`, (s) => `segno ${s}`, (s) => `uomo ${s}`, (s) => `donna ${s}`, (s) => `${s} date segno`, (s) => `${s} carattere`],
    chart: ['tema natale', 'tema natale gratis', 'carta natale', 'calcolo tema natale', 'come leggere il tema natale', 'calcolo ascendente', 'ascendente', 'segno lunare', 'calcolo luna natale', 'sole luna ascendente'],
    sky: [['moon-phase', 'fase lunare oggi'], ['moon-phase', 'luna oggi'], ['full-moon', 'luna piena novembre 2026'], ['new-moon', 'luna nuova novembre 2026'], ['mercury-retrograde', 'mercurio retrogrado 2027'], ['mercury-retrograde', 'mercurio retrogrado oggi'], ['retrogrades', 'pianeti retrogradi oggi'], ['eclipses', 'eclissi 2027'], ['eclipses', 'eclissi solare 2027'], ['mars-retrograde', 'marte retrogrado 2027']],
  },
  ru: {
    prefix: '/ru', lang: 'Russian', loc: 'Russia; Kazakhstan; Belarus; Ukraine (Russian speakers); Israel (Russian speakers)',
    signs: ['овен', 'телец', 'близнецы', 'рак', 'лев', 'дева', 'весы', 'скорпион', 'стрелец', 'козерог', 'водолей', 'рыбы'],
    horoscope: { today: (s) => `гороскоп ${s} на сегодня`, tomorrow: (s) => `гороскоп ${s} на завтра`, weekly: (s) => `гороскоп ${s} на неделю`, monthly: (s) => `гороскоп ${s} на месяц`, yearly: (s) => `гороскоп ${s} на 2027 год` },
    pair: (a, b) => `совместимость ${a} и ${b}`,
    signQ: [(s) => `${s} характеристика знака`, (s) => `знак зодиака ${s}`, (s) => `${s} мужчина`, (s) => `${s} женщина`, (s) => `${s} знак зодиака даты`, (s) => `${s} характер`],
    chart: ['натальная карта', 'натальная карта онлайн', 'натальная карта бесплатно', 'натальная карта с расшифровкой', 'как читать натальную карту', 'рассчитать асцендент', 'асцендент', 'лунный знак', 'знак луны рассчитать', 'солнце луна асцендент'],
    sky: [['moon-phase', 'фаза луны сегодня'], ['moon-phase', 'луна сегодня'], ['full-moon', 'полнолуние в ноябре 2026'], ['new-moon', 'новолуние в ноябре 2026'], ['mercury-retrograde', 'ретроградный меркурий 2027'], ['mercury-retrograde', 'ретроградный меркурий сейчас'], ['retrogrades', 'ретроградные планеты сейчас'], ['eclipses', 'затмение 2027'], ['eclipses', 'солнечное затмение 2027'], ['mars-retrograde', 'ретроградный марс 2027']],
  },
  'zh-hans': {
    prefix: '/zh-hans', lang: 'Chinese (simplified)', loc: 'Singapore; Malaysia (Google is little used in mainland China)',
    signs: ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'],
    horoscope: { today: (s) => `${s}今日运势`, tomorrow: (s) => `${s}明日运势`, weekly: (s) => `${s}本周运势`, monthly: (s) => `${s}本月运势`, yearly: (s) => `${s}2027年运势` },
    pair: (a, b) => `${a}和${b}配对`,
    signQ: [(s) => `${s}性格`, (s) => `${s}是几月几号`, (s) => `${s}男`, (s) => `${s}女`, (s) => `${s}日期`, (s) => `${s}特点`],
    chart: ['星盘查询', '个人星盘', '本命盘', '星盘解析', '怎么看星盘', '上升星座查询', '上升星座', '月亮星座查询', '月亮星座', '太阳月亮上升'],
    sky: [['moon-phase', '今日月相'], ['moon-phase', '今天月亮'], ['full-moon', '2026年11月满月'], ['new-moon', '2026年11月新月'], ['mercury-retrograde', '2027水星逆行'], ['mercury-retrograde', '水星逆行'], ['retrogrades', '现在逆行的行星'], ['eclipses', '2027日食'], ['eclipses', '2027月食'], ['mars-retrograde', '2027火星逆行']],
  },
  'zh-hant': {
    prefix: '/zh-hant', lang: 'Chinese (traditional)', loc: 'Taiwan; Hong Kong',
    signs: ['牡羊座', '金牛座', '雙子座', '巨蟹座', '獅子座', '處女座', '天秤座', '天蠍座', '射手座', '摩羯座', '水瓶座', '雙魚座'],
    horoscope: { today: (s) => `${s}今日運勢`, tomorrow: (s) => `${s}明日運勢`, weekly: (s) => `${s}本週運勢`, monthly: (s) => `${s}本月運勢`, yearly: (s) => `${s}2027運勢` },
    pair: (a, b) => `${a}${b}配對`,
    signQ: [(s) => `${s}個性`, (s) => `${s}是幾月幾號`, (s) => `${s}男`, (s) => `${s}女`, (s) => `${s}日期`, (s) => `${s}特質`],
    chart: ['星盤查詢', '個人星盤', '本命盤', '星盤解析', '怎麼看星盤', '上升星座查詢', '上升星座', '月亮星座查詢', '月亮星座', '太陽月亮上升'],
    sky: [['moon-phase', '今日月相'], ['moon-phase', '今天月亮'], ['full-moon', '2026年11月滿月'], ['new-moon', '2026年11月新月'], ['mercury-retrograde', '2027水逆'], ['mercury-retrograde', '水逆'], ['retrogrades', '現在逆行的行星'], ['eclipses', '2027日食'], ['eclipses', '2027月食'], ['mars-retrograde', '2027火星逆行']],
  },
  ar: {
    prefix: '/ar', lang: 'Arabic', loc: 'Saudi Arabia; Egypt; United Arab Emirates; Morocco; Iraq',
    signs: ['الحمل', 'الثور', 'الجوزاء', 'السرطان', 'الأسد', 'العذراء', 'الميزان', 'العقرب', 'القوس', 'الجدي', 'الدلو', 'الحوت'],
    horoscope: { today: (s) => `برج ${s} اليوم`, tomorrow: (s) => `برج ${s} غدا`, weekly: (s) => `برج ${s} الأسبوعي`, monthly: (s) => `برج ${s} الشهري`, yearly: (s) => `برج ${s} 2027` },
    pair: (a, b) => `توافق برج ${a} و${b}`,
    signQ: [(s) => `صفات برج ${s}`, (s) => `برج ${s}`, (s) => `رجل برج ${s}`, (s) => `امرأة برج ${s}`, (s) => `تاريخ برج ${s}`, (s) => `شخصية برج ${s}`],
    chart: ['الخريطة الفلكية', 'خريطة الميلاد', 'خريطة فلكية مجانية', 'حساب الخريطة الفلكية', 'قراءة الخريطة الفلكية', 'حساب الطالع', 'برج الطالع', 'برج القمر', 'حساب برج القمر', 'الشمس والقمر والطالع'],
    sky: [['moon-phase', 'طور القمر اليوم'], ['moon-phase', 'القمر اليوم'], ['full-moon', 'البدر نوفمبر 2026'], ['new-moon', 'المحاق نوفمبر 2026'], ['mercury-retrograde', 'تراجع عطارد 2027'], ['mercury-retrograde', 'تراجع عطارد الآن'], ['retrogrades', 'الكواكب المتراجعة الآن'], ['eclipses', 'كسوف 2027'], ['eclipses', 'خسوف 2027'], ['mars-retrograde', 'تراجع المريخ 2027']],
  },
};

// What the site publishes per locale (from coverage.md); used for target_url and coverage.
const PUBLISHED = {
  en: { horoscope: ['today', 'tomorrow', 'weekly', 'monthly', 'yearly'], compat: true, signs: true, chart: true, sky: ['moon-phase', 'full-moon', 'new-moon', 'mercury-retrograde', 'retrogrades', 'eclipses', 'mars-retrograde'] },
  es: { horoscope: ['today'], compat: true, signs: true, chart: true, sky: ['moon-phase', 'mercury-retrograde', 'retrogrades', 'eclipses'] },
  pt: { horoscope: ['today'], compat: true, signs: true, chart: true, sky: ['moon-phase', 'mercury-retrograde', 'retrogrades', 'eclipses'] },
  fr: { horoscope: [], compat: true, signs: true, chart: true, sky: ['moon-phase', 'mercury-retrograde', 'retrogrades', 'eclipses'] },
  it: { horoscope: [], compat: true, signs: true, chart: true, sky: ['moon-phase', 'mercury-retrograde', 'retrogrades', 'eclipses'] },
  ru: { horoscope: [], compat: false, signs: false, chart: true, sky: ['moon-phase'] },
  'zh-hans': { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
  'zh-hant': { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
  ar: { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
};
const NOTE = { ar: 'native review needed before use; no Arabic pages published', 'zh-hans': 'native review needed before use; only the Chinese zodiac guide is published in Chinese', 'zh-hant': 'native review needed before use; only the Chinese zodiac guide is published in Chinese' };

const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const HEAD = ['locale', 'kp_language', 'kp_locations', 'family', 'subfamily', 'query', 'target_url', 'coverage', 'monthly_volume', 'volume_source', 'competition', 'notes'];

// Which calculator answers a birth chart query. Order matters: "sun, moon and
// rising" is the big three, not the rising sign.
function chartTarget(q) {
  if (/big three|sol luna|sol lua|soleil lune|sole luna|солнце луна|太阳月亮|太陽月亮|الشمس والقمر/.test(q)) return ['big-three', '/big-three/'];
  if (/rising|ascend|асцендент|上升|طالع/.test(q)) return ['rising-sign', '/rising-sign/'];
  if (/moon sign|lunar|lunaire|lunare|luna natale|лунный|луны|月亮|القمر/.test(q)) return ['moon-sign', '/moon-sign/'];
  if (/read|leer|ler |lire|leggere|читать|怎么看|怎麼看|قراءة/.test(q)) return ['how-to-read', '/learn/how-to-read-a-birth-chart/'];
  return ['calculator', '/birth-chart/'];
}

export function rowsFor(locale) {
  const c = L[locale], pub = PUBLISHED[locale], p = c.prefix, rows = [];
  const add = (family, sub, query, url, coverage, note = '') => rows.push([locale, c.lang, c.loc, family, sub, query, url || '', coverage, 'TBD', 'TBD', 'TBD', [note, NOTE[locale]].filter(Boolean).join('; ')]);
  const enHoroPath = { today: '', tomorrow: 'tomorrow/', weekly: 'weekly/', monthly: 'monthly/', yearly: '2027/' };
  SLUGS.forEach((slug, i) => {
    for (const [period, fn] of Object.entries(c.horoscope)) {
      const has = pub.horoscope.includes(period);
      const url = has ? `${p}/horoscopes/${slug}/${locale === 'en' ? enHoroPath[period] : ''}` : `/horoscopes/${slug}/${enHoroPath[period]}`;
      add('horoscope', period, fn(c.signs[i]), url, has ? 'full' : 'partial', has ? '' : 'English page only');
    }
  });
  SLUGS.forEach((a, i) => SLUGS.forEach((b, j) => {
    add('compatibility', i === j ? 'same-sign pair' : 'pair', c.pair(c.signs[i], c.signs[j]), pub.compat ? `${p}/compatibility/${pairSlug(a, b)}/` : `/compatibility/${pairSlug(a, b)}/`, pub.compat ? 'full' : 'partial', pub.compat ? '' : 'English page only');
  }));
  c.chart.forEach((q) => {
    const [sub, route] = chartTarget(q);
    // The how-to-read article exists in English only.
    const has = pub.chart && sub !== 'how-to-read';
    add('birth-chart', sub, q, has ? `${p}${route}` : route, has ? 'full' : 'partial', has ? '' : 'English page only');
  });
  const skyUrl = { 'moon-phase': '/moon-phase/', 'full-moon': '/full-moon/2026-11-24/', 'new-moon': '/new-moon/2026-11-09/', 'mercury-retrograde': '/mercury-retrograde/', retrogrades: '/retrogrades/', eclipses: '/eclipses/', 'mars-retrograde': '/mars-retrograde/' };
  c.sky.forEach(([sub, q]) => {
    const has = pub.sky.includes(sub);
    add('sky-events', sub, q, has ? `${p}${skyUrl[sub]}` : skyUrl[sub], has ? 'full' : 'partial', has ? '' : 'English page only');
  });
  SLUGS.forEach((slug, i) => c.signQ.forEach((fn) => add('signs', 'meaning', fn(c.signs[i]), pub.signs ? `${p}/${slug}/` : `/${slug}/`, pub.signs ? 'full' : 'partial', pub.signs ? '' : 'English page only')));
  return rows;
}

const outDir = path.join(VIS_DIR, 'keywords');

// Keep volumes already filled in (by families.mjs --volumes or by hand): a
// regenerated file never throws real numbers away.
function filled(locale) {
  const f = path.join(outDir, `${locale}.csv`);
  const keep = new Map();
  if (!existsSync(f)) return keep;
  for (const line of readFileSync(f, 'utf8').trim().split('\n').slice(1)) {
    const cells = parseLine(line);
    if (cells[8] !== 'TBD' || cells[9] !== 'TBD' || cells[10] !== 'TBD') keep.set(cells[5], cells.slice(8, 11));
  }
  return keep;
}
export function parseLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

const files = {};
const all = [HEAD.join(',')];
for (const locale of Object.keys(L)) {
  const keep = filled(locale);
  const rows = rowsFor(locale).map((r) => (keep.has(r[5]) ? [...r.slice(0, 8), ...keep.get(r[5]), r[11]] : r));
  files[`${locale}.csv`] = [HEAD.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n') + '\n';
  all.push(...rows.map((r) => r.map(csvCell).join(',')));
}
files['all-locales.csv'] = all.join('\n') + '\n';

if (process.argv.includes('--check')) {
  const stale = Object.entries(files).filter(([f, body]) => !existsSync(path.join(outDir, f)) || readFileSync(path.join(outDir, f), 'utf8') !== body).map(([f]) => f);
  if (stale.length) { console.error(`Stale keyword files: ${stale.join(', ')}`); process.exit(1); }
  console.log('Keyword files are current.');
} else {
  mkdirSync(outDir, { recursive: true });
  for (const [f, body] of Object.entries(files)) writeFileSync(path.join(outDir, f), body);
  console.log(Object.entries(files).map(([f, b]) => `${f}: ${b.trim().split('\n').length - 1} queries`).join('\n'));
}
