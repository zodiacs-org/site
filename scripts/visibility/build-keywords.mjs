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
  // Candidates for the next locale (Part 5 of the 2026-11 locale expansion):
  // nothing is published in these languages; the volumes decide which one
  // is built first. Written the way people search in each language.
  de: {
    prefix: '/de', lang: 'German', loc: 'Germany; Austria; Switzerland',
    signs: ['widder', 'stier', 'zwillinge', 'krebs', 'löwe', 'jungfrau', 'waage', 'skorpion', 'schütze', 'steinbock', 'wassermann', 'fische'],
    horoscope: { today: (s) => `horoskop ${s} heute`, tomorrow: (s) => `horoskop ${s} morgen`, weekly: (s) => `wochenhoroskop ${s}`, monthly: (s) => `monatshoroskop ${s}`, yearly: (s) => `horoskop 2027 ${s}` },
    pair: (a, b) => `${a} und ${b}`,
    // "sternzeichen" first: krebs, jungfrau and waage are everyday words too.
    signQ: [(s) => `sternzeichen ${s} eigenschaften`, (s) => `sternzeichen ${s}`, (s) => `sternzeichen ${s} mann`, (s) => `sternzeichen ${s} frau`, (s) => `sternzeichen ${s} datum`, (s) => `sternzeichen ${s} charakter`],
    chart: ['geburtshoroskop', 'geburtshoroskop kostenlos', 'geburtshoroskop berechnen', 'radix horoskop', 'geburtshoroskop deuten', 'aszendent berechnen', 'aszendent', 'mondzeichen berechnen', 'mondzeichen', 'sonne mond aszendent'],
    sky: [['moon-phase', 'mondphase heute'], ['moon-phase', 'mond heute'], ['full-moon', 'vollmond november 2026'], ['new-moon', 'neumond november 2026'], ['mercury-retrograde', 'merkur rückläufig 2027'], ['mercury-retrograde', 'merkur rückläufig aktuell'], ['retrogrades', 'rückläufige planeten aktuell'], ['eclipses', 'mondfinsternis 2027'], ['eclipses', 'sonnenfinsternis 2027'], ['mars-retrograde', 'mars rückläufig 2027']],
  },
  pl: {
    prefix: '/pl', lang: 'Polish', loc: 'Poland',
    signs: ['baran', 'byk', 'bliźnięta', 'rak', 'lew', 'panna', 'waga', 'skorpion', 'strzelec', 'koziorożec', 'wodnik', 'ryby'],
    horoscope: { today: (s) => `horoskop ${s} dzisiaj`, tomorrow: (s) => `horoskop ${s} jutro`, weekly: (s) => `horoskop tygodniowy ${s}`, monthly: (s) => `horoskop miesięczny ${s}`, yearly: (s) => `horoskop ${s} 2027` },
    pair: (a, b) => `${a} i ${b} związek`,
    // "znak zodiaku" with the sign: rak, lew, byk and ryby are everyday words too.
    signQ: [(s) => `${s} znak zodiaku cechy`, (s) => `znak zodiaku ${s}`, (s) => `${s} znak zodiaku mężczyzna`, (s) => `${s} znak zodiaku kobieta`, (s) => `${s} znak zodiaku daty`, (s) => `${s} znak zodiaku charakter`],
    chart: ['horoskop urodzeniowy', 'kosmogram', 'kosmogram online', 'horoskop urodzeniowy za darmo', 'jak czytać horoskop urodzeniowy', 'oblicz ascendent', 'ascendent kalkulator', 'znak księżyca', 'znak księżyca kalkulator', 'słońce księżyc ascendent'],
    sky: [['moon-phase', 'faza księżyca dzisiaj'], ['moon-phase', 'księżyc dzisiaj'], ['full-moon', 'pełnia księżyca listopad 2026'], ['new-moon', 'nów listopad 2026'], ['mercury-retrograde', 'retrogradacja merkurego 2027'], ['mercury-retrograde', 'retrogradacja merkurego teraz'], ['retrogrades', 'planety w retrogradacji'], ['eclipses', 'zaćmienie księżyca 2027'], ['eclipses', 'zaćmienie słońca 2027'], ['mars-retrograde', 'retrogradacja marsa 2027']],
  },
  tr: {
    prefix: '/tr', lang: 'Turkish', loc: 'Turkey',
    signs: ['koç', 'boğa', 'ikizler', 'yengeç', 'aslan', 'başak', 'terazi', 'akrep', 'yay', 'oğlak', 'kova', 'balık'],
    horoscope: { today: (s) => `${s} burcu günlük yorumu`, tomorrow: (s) => `${s} burcu yarın`, weekly: (s) => `${s} burcu haftalık`, monthly: (s) => `${s} burcu aylık`, yearly: (s) => `${s} burcu 2027 yorumu` },
    pair: (a, b) => `${a} ${b} uyumu`,
    signQ: [(s) => `${s} burcu özellikleri`, (s) => `${s} burcu`, (s) => `${s} erkeği`, (s) => `${s} kadını`, (s) => `${s} burcu hangi tarihler`, (s) => `${s} burcu karakteri`],
    chart: ['doğum haritası', 'doğum haritası hesaplama', 'ücretsiz doğum haritası', 'natal harita', 'doğum haritası nasıl okunur', 'yükselen burç hesaplama', 'yükselen burç', 'ay burcu hesaplama', 'ay burcu', 'güneş ay yükselen'],
    sky: [['moon-phase', 'ay takvimi'], ['moon-phase', 'bugün ay hangi evrede'], ['full-moon', 'dolunay kasım 2026'], ['new-moon', 'yeni ay kasım 2026'], ['mercury-retrograde', 'merkür retrosu 2027'], ['mercury-retrograde', 'merkür retrosu ne zaman'], ['retrogrades', 'retro gezegenler'], ['eclipses', 'ay tutulması 2027'], ['eclipses', 'güneş tutulması 2027'], ['mars-retrograde', 'mars retrosu 2027']],
  },
  ja: {
    prefix: '/ja', lang: 'Japanese', loc: 'Japan',
    signs: ['おひつじ座', 'おうし座', 'ふたご座', 'かに座', 'しし座', 'おとめ座', 'てんびん座', 'さそり座', 'いて座', 'やぎ座', 'みずがめ座', 'うお座'],
    horoscope: { today: (s) => `${s} 今日の運勢`, tomorrow: (s) => `${s} 明日の運勢`, weekly: (s) => `${s} 今週の運勢`, monthly: (s) => `${s} 今月の運勢`, yearly: (s) => `${s} 2027年 運勢` },
    pair: (a, b) => `${a} ${b} 相性`,
    signQ: [(s) => `${s} 性格`, (s) => `${s} 特徴`, (s) => `${s} 男性`, (s) => `${s} 女性`, (s) => `${s} いつから`, (s) => `${s} どんな人`],
    chart: ['ホロスコープ 無料', 'ネイタルチャート', 'ホロスコープ 出生', 'ホロスコープ 作成', 'ホロスコープ 読み方', 'アセンダント 調べ方', 'アセンダント', '月星座 調べ方', '月星座', '月星座 太陽星座'],
    sky: [['moon-phase', '今日の月齢'], ['moon-phase', '今日の月'], ['full-moon', '2026年11月 満月'], ['new-moon', '2026年11月 新月'], ['mercury-retrograde', '水星逆行 2027'], ['mercury-retrograde', '水星逆行 いつ'], ['retrogrades', '逆行 惑星 今'], ['eclipses', '日食 2027'], ['eclipses', '月食 2027'], ['mars-retrograde', '火星逆行 2027']],
  },
  hi: {
    prefix: '/hi', lang: 'Hindi', loc: 'India',
    signs: ['मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या', 'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुंभ', 'मीन'],
    // "कल" means both yesterday and tomorrow: read the tomorrow volumes as ambiguous.
    horoscope: { today: (s) => `${s} राशि आज का राशिफल`, tomorrow: (s) => `कल का राशिफल ${s}`, weekly: (s) => `${s} साप्ताहिक राशिफल`, monthly: (s) => `${s} मासिक राशिफल`, yearly: (s) => `${s} राशिफल 2027` },
    pair: (a, b) => `${a} और ${b} की जोड़ी`,
    signQ: [(s) => `${s} राशि के लोग कैसे होते हैं`, (s) => `${s} राशि`, (s) => `${s} राशि पुरुष`, (s) => `${s} राशि महिला`, (s) => `${s} राशि नाम अक्षर`, (s) => `${s} राशि स्वभाव`],
    chart: ['जन्म कुंडली', 'जन्म कुंडली ऑनलाइन', 'फ्री कुंडली', 'जन्म पत्रिका', 'कुंडली कैसे देखें', 'लग्न कैसे पता करें', 'लग्न राशि', 'चंद्र राशि कैसे पता करें', 'चंद्र राशि', 'सूर्य राशि'],
    sky: [['moon-phase', 'आज की तिथि'], ['moon-phase', 'आज का चंद्रमा'], ['full-moon', 'पूर्णिमा कब है नवंबर 2026'], ['new-moon', 'अमावस्या नवंबर 2026'], ['mercury-retrograde', 'बुध वक्री 2027'], ['mercury-retrograde', 'बुध वक्री कब है'], ['retrogrades', 'वक्री ग्रह'], ['eclipses', 'चंद्र ग्रहण 2027'], ['eclipses', 'सूर्य ग्रहण 2027'], ['mars-retrograde', 'मंगल वक्री 2027']],
  },
};

// What the site publishes per locale (from coverage.md); used for target_url and coverage.
const PUBLISHED = {
  en: { horoscope: ['today', 'tomorrow', 'weekly', 'monthly', 'yearly'], compat: true, signs: true, chart: true, sky: ['moon-phase', 'full-moon', 'new-moon', 'mercury-retrograde', 'retrogrades', 'eclipses'] },
  es: { horoscope: ['today'], compat: true, signs: true, chart: true, sky: ['moon-phase', 'mercury-retrograde', 'retrogrades', 'eclipses'] },
  pt: { horoscope: ['today'], compat: true, signs: true, chart: true, sky: ['moon-phase', 'mercury-retrograde', 'retrogrades', 'eclipses'] },
  fr: { horoscope: [], compat: true, signs: true, chart: true, sky: ['moon-phase', 'mercury-retrograde', 'retrogrades', 'eclipses'] },
  it: { horoscope: [], compat: true, signs: true, chart: true, sky: ['moon-phase', 'mercury-retrograde', 'retrogrades', 'eclipses'] },
  ru: { horoscope: [], compat: false, signs: false, chart: true, sky: ['moon-phase'] },
  'zh-hans': { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
  'zh-hant': { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
  ar: { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
  de: { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
  pl: { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
  tr: { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
  ja: { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
  hi: { horoscope: [], compat: false, signs: false, chart: false, sky: [] },
};

// Built but held by the locale expansion (src/data/locale-expansion-publication.json,
// PRs for parts 1 and 2): the page exists in the language and waits for its
// release batch. Coverage "held" names the localized URL it will have.
const HELD = {
  es: { horoscope: ['tomorrow', 'weekly', 'monthly', 'yearly'], sky: ['full-moon', 'new-moon'] },
  pt: { horoscope: ['tomorrow', 'weekly', 'monthly', 'yearly'], sky: ['full-moon', 'new-moon'] },
  fr: { horoscope: ['today', 'tomorrow', 'weekly', 'monthly', 'yearly'], sky: ['full-moon', 'new-moon'] },
  it: { horoscope: ['today', 'tomorrow', 'weekly', 'monthly', 'yearly'], sky: ['full-moon', 'new-moon'] },
  ru: { horoscope: ['today', 'tomorrow', 'weekly', 'monthly', 'yearly'], sky: ['full-moon', 'new-moon'], compat: true, signs: true },
};
const HELD_NOTE = 'built in this language and held until its release batch';
const CANDIDATE_NOTE = 'candidate locale: nothing published in this language; native review of the query wording needed before use';
const NOTE = { de: CANDIDATE_NOTE, pl: CANDIDATE_NOTE, tr: CANDIDATE_NOTE, ja: `${CANDIDATE_NOTE}; no spaces in Japanese queries except where people type them`, hi: `${CANDIDATE_NOTE}; much Hindi astrology search is sidereal (Vedic) while the site is tropical`, ar: 'native review needed before use; no Arabic pages published', 'zh-hans': 'native review needed before use; only the Chinese zodiac guide is published in Chinese', 'zh-hant': 'native review needed before use; only the Chinese zodiac guide is published in Chinese' };

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
  const c = L[locale], pub = PUBLISHED[locale], held = HELD[locale] ?? {}, p = c.prefix, rows = [];
  const add = (family, sub, query, url, coverage, note = '') => rows.push([locale, c.lang, c.loc, family, sub, query, url || '', coverage, 'TBD', 'TBD', 'TBD', [note, NOTE[locale]].filter(Boolean).join('; ')]);
  const enHoroPath = { today: '', tomorrow: 'tomorrow/', weekly: 'weekly/', monthly: 'monthly/', yearly: '2027/' };
  SLUGS.forEach((slug, i) => {
    for (const [period, fn] of Object.entries(c.horoscope)) {
      const has = pub.horoscope.includes(period);
      const isHeld = !has && (held.horoscope ?? []).includes(period);
      const url = has ? `${p}/horoscopes/${slug}/${locale === 'en' ? enHoroPath[period] : ''}`
        : isHeld ? `${p}/horoscopes/${slug}/${enHoroPath[period]}` : `/horoscopes/${slug}/${enHoroPath[period]}`;
      add('horoscope', period, fn(c.signs[i]), url, has ? 'full' : isHeld ? 'held' : 'partial', has ? '' : isHeld ? HELD_NOTE : 'English page only');
    }
  });
  SLUGS.forEach((a, i) => SLUGS.forEach((b, j) => {
    const status = pub.compat ? 'full' : held.compat ? 'held' : 'partial';
    add('compatibility', i === j ? 'same-sign pair' : 'pair', c.pair(c.signs[i], c.signs[j]), status === 'partial' ? `/compatibility/${pairSlug(a, b)}/` : `${p}/compatibility/${pairSlug(a, b)}/`, status, status === 'full' ? '' : status === 'held' ? HELD_NOTE : 'English page only');
  }));
  c.chart.forEach((q) => {
    const [sub, route] = chartTarget(q);
    // The how-to-read article exists in English only.
    const has = pub.chart && sub !== 'how-to-read';
    add('birth-chart', sub, q, has ? `${p}${route}` : route, has ? 'full' : 'partial', has ? '' : 'English page only');
  });
  const skyUrl = { 'moon-phase': '/moon-phase/', 'full-moon': '/full-moon/2026-11-24/', 'new-moon': '/new-moon/2026-11-09/', 'mercury-retrograde': '/mercury-retrograde/', retrogrades: '/retrogrades/', eclipses: '/eclipses/', 'mars-retrograde': '/retrogrades/' };
  c.sky.forEach(([sub, q]) => {
    // There is no /mars-retrograde/ hub, only dated window pages; the
    // retrogrades page lists every Mars window, so it answers the query.
    const page = sub === 'mars-retrograde' ? 'retrogrades' : sub;
    const has = pub.sky.includes(page);
    const isHeld = !has && (held.sky ?? []).includes(page);
    add('sky-events', sub, q, has || isHeld ? `${p}${skyUrl[sub]}` : skyUrl[sub], has ? 'full' : isHeld ? 'held' : 'partial', has ? '' : isHeld ? HELD_NOTE : 'English page only');
  });
  const signStatus = pub.signs ? 'full' : held.signs ? 'held' : 'partial';
  SLUGS.forEach((slug, i) => c.signQ.forEach((fn) => add('signs', 'meaning', fn(c.signs[i]), signStatus === 'partial' ? `/${slug}/` : `${p}/${slug}/`, signStatus, signStatus === 'full' ? '' : signStatus === 'held' ? HELD_NOTE : 'English page only')));
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
