/**
 * True obliquity of the ecliptic of date (IAU 2006 mean obliquity + IAU 2000B
 * 77-term nutation in obliquity), self-contained with zero imports so neither
 * the shared browser engine chunk (./full) nor single-chart callers pay any
 * extra chunk bytes or recast planets.
 */
const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86_400_000;

const ARGUMENTS = [
  485868.249036, 1717915923.2178,
  1287104.79305, 129596581.0481,
  335779.526232, 1739527262.8478,
  1072260.70369, 1602961601.209,
  450160.398036, -6962890.5431,
];

const MULTIPLIERS = '2222322404224242222423222234043222222423324242140422403124241224232223122231244432423024232224222444204040224242424324041242342222224222322312243244042204232203212231244324222324440242223424224432142422243324034240402243424232140322203112424220332242234033122202424524242124231424222321144412422214440222333424422231323233222324221240332224122322243412464132332040332443024441222433404';
const DE_COEFF_TEXT = '92052331,9086,15377,5730336,-3015,-4587,978459,-485,1374,-897492,470,-291,73871,-184,-1924,224386,-677,-174,-6750,0,358,200728,18,318,129025,-63,367,-95929,299,132,-68982,-9,39,-53311,32,-4,-1235,0,82,-33228,0,-9,31429,0,-75,25543,-11,66,26366,0,78,-24236,-10,20,-1220,0,29,16452,-11,68,-13870,0,0,477,0,-25,13238,-11,59,-12338,10,-3,-10758,0,-3,-609,0,13,-550,0,11,8551,-2,-45,-8001,0,-1,6850,-42,-5,-167,0,13,6953,0,-14,6415,0,26,5222,0,15,168,-1,10,3268,0,19,104,0,2,-3250,0,-5,3353,0,14,3070,0,4,3272,0,4,-3045,0,-1,-2768,0,-4,3041,0,-5,2695,0,12,2719,0,-3,2720,0,-9,-51,0,4,-2206,0,1,-199,0,2,-1900,0,1,-41,0,3,1313,0,-1,1233,0,7,-81,0,2,1232,0,4,-20,0,-2,1207,0,3,40,0,-2,1129,0,5,1266,0,-4,-1062,0,-3,-1129,0,-2,-9,0,0,35,0,-2,-107,0,1,1073,0,-2,854,0,0,-553,0,-139,-710,0,-2,647,0,4,-700,0,0,672,0,0,663,0,4,-594,0,-2,-610,0,2,-556,0,0';
const DE_OFFSET = 388e-6;
let deCoeffs: number[] | undefined;

/** True obliquity of the ecliptic of date, in degrees (IAU 2006 mean + IAU 2000B nutation). */
export function trueObliquity(utc: Date): number {
  const c = (deCoeffs ??= DE_COEFF_TEXT.split(',').map(Number));
  const u = (utc.getUTCFullYear() + utc.getUTCMonth() / 12 - 1820) / 100;
  const deltaTSeconds = Math.max(-5, -20 + 32 * u * u);
  const t = ((utc.getTime() - J2000_MS) / DAY_MS + deltaTSeconds / 86_400) / 36525;
  const re: number[] = [];
  const im: number[] = [];
  for (let j = 0; j < 5; j += 1) {
    const f = ((ARGUMENTS[2 * j] + t * ARGUMENTS[2 * j + 1]) % 1296e3) * ARCSEC;
    const cos = Math.cos(f);
    const sin = Math.sin(f);
    const o = 7 * j;
    re[o + 1] = cos;
    im[o + 1] = -sin;
    re[o + 2] = 1;
    im[o + 2] = 0;
    for (let k = o + 3; k < o + 7; k += 1) {
      re[k] = re[k - 1] * cos - im[k - 1] * sin;
      im[k] = re[k - 1] * sin + im[k - 1] * cos;
    }
    re[o] = re[o + 4];
    im[o] = -im[o + 4];
  }
  let de = 0;
  for (let i = 76; i >= 0; i -= 1) {
    let cos = 1;
    let sin = 0;
    for (let j = 0; j < 5; j += 1) {
      const k2 = 7 * j + MULTIPLIERS.charCodeAt(5 * i + j) - 48;
      const next = cos * re[k2] - sin * im[k2];
      sin = cos * im[k2] + sin * re[k2];
      cos = next;
    }
    const k = 3 * i;
    de += (c[k] + c[k + 1] * t) * cos + c[k + 2] * sin;
  }
  const meanObl = (84381.406 - 46.836769 * t - 1831e-7 * t * t + 20034e-7 * t ** 3 - 576e-9 * t ** 4 - 434e-10 * t ** 5) / 3600;
  return meanObl + (de * 1e-7 + DE_OFFSET) / 3600;
}
