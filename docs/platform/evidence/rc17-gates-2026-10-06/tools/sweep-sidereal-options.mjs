/*
 * P3.2's first clause at run time. The type check (calc-types-cover-vedic.ts)
 * cannot see an option that is declared but refused, as rc.16 refused the
 * sidereal zodiac, so this runs each of calc's four functions with each of
 * the nine built-in ayanamsas and a caller's own with each precession model,
 * a linear rate, a name and the epoch in each of calc's time forms. calc(),
 * houses() and chart() are held to what @zodiacs/engine/vedic's
 * siderealChart() gives for the same definition, where /vedic has the form;
 * events(), which /vedic has no counterpart of, to calc's own sidereal
 * longitude at each instant it finds. It also runs the refusals of the span:
 * an instant outside it, and a caller's ayanamsa carried by precession from an
 * epoch outside it. Synthetic instants and places only. Prints a JSON record;
 * exits 1 when anything inside the span is refused or differs from /vedic, or
 * when the span's refusals are not as recorded.
 *
 *   node docs/platform/evidence/rc17-gates-2026-10-06/tools/sweep-sidereal-options.mjs \
 *     > docs/platform/evidence/rc17-gates-2026-10-06/results/sidereal-options-sweep.json
 */
import { ENGINE_VERSION } from '@zodiacs/engine';
import { CALC_AYANAMSAS, CALC_BODIES, CALC_SPAN, calc, chart, events, houses } from '@zodiacs/engine/calc';
import { ayanamsa, siderealChart, userAyanamsa } from '@zodiacs/engine/vedic';

const TIME = '2026-03-20T12:00:00Z';
const PLACE = { latitude: 40, longitude: -3.7 };
const SYSTEM = 'placidus';
const J2000_TT = 2451545.0;
const J1900_TT = 2415020.0;

/**
 * A caller's ayanamsa in each form calc declares, with the same definition as
 * /vedic's userAyanamsa takes it where /vedic has the form (its TT epoch is
 * { julianDateTT }; it has no UT1 epoch).
 */
const CALLER_FORMS = [
  { form: 'TT epoch, the engine precession', calc: { epoch: { jd: J2000_TT, scale: 'TT' }, value: 23.85 }, vedic: { epoch: { julianDateTT: J2000_TT }, value: 23.85 } },
  { form: 'TT epoch 1900, Newcomb precession', calc: { epoch: { jd: J1900_TT, scale: 'TT' }, value: 22.46, model: 'newcomb' }, vedic: { epoch: { julianDateTT: J1900_TT }, value: 22.46, model: 'newcomb' } },
  { form: 'TT epoch 1900, IAU 1976 precession', calc: { epoch: { jd: J1900_TT, scale: 'TT' }, value: 22.46, model: 'iau1976' }, vedic: { epoch: { julianDateTT: J1900_TT }, value: 22.46, model: 'iau1976' } },
  { form: 'TT epoch 1900, the engine precession', calc: { epoch: { jd: J1900_TT, scale: 'TT' }, value: 22.46 }, vedic: { epoch: { julianDateTT: J1900_TT }, value: 22.46 } },
  { form: 'TT epoch, a linear rate', calc: { epoch: { jd: J2000_TT, scale: 'TT' }, value: 23.85, rate: 50.29 }, vedic: { epoch: { julianDateTT: J2000_TT }, value: 23.85, rate: 50.29 } },
  { form: 'UTC epoch as an ISO string', calc: { epoch: '2000-01-01T12:00:00Z', value: 23.85 }, vedic: { epoch: '2000-01-01T12:00:00Z', value: 23.85 } },
  { form: 'UTC epoch as a Date', calc: { epoch: new Date('2000-01-01T12:00:00Z'), value: 23.85 }, vedic: { epoch: new Date('2000-01-01T12:00:00Z'), value: 23.85 } },
  { form: 'UTC epoch as { iso }', calc: { epoch: { iso: '2000-01-01T12:00:00Z' }, value: 23.85 }, vedic: { epoch: '2000-01-01T12:00:00Z', value: 23.85 } },
  { form: 'UTC epoch as a Julian date', calc: { epoch: { jd: J2000_TT, scale: 'UTC' }, value: 23.85 }, vedic: { epoch: '2000-01-01T12:00:00Z', value: 23.85 } },
  { form: 'UT1 epoch with a pinned ΔT', calc: { epoch: { jd: J2000_TT, scale: 'UT1', deltaT: 64 }, value: 23.85 }, vedic: { epoch: { julianDateTT: J2000_TT + 64 / 86400 }, value: 23.85 } },
  { form: 'a name', calc: { name: 'synthetic-test', epoch: { jd: J2000_TT, scale: 'TT' }, value: 23.85 }, vedic: { name: 'synthetic-test', epoch: { julianDateTT: J2000_TT }, value: 23.85 } },
  { form: 'UT1 epoch (SE_SIDBIT_USER_UT)', calc: { epoch: { jd: J2000_TT, scale: 'UT1' }, value: 23.85 }, vedic: null },
];

const zodiacs = [
  ...CALC_AYANAMSAS.map((name) => ({ label: name, calc: name, vedic: name })),
  ...CALLER_FORMS.map(({ form, calc: definition, vedic }) => ({ label: `caller's: ${form}`, calc: definition, vedic: vedic && userAyanamsa(vedic) })),
];

const arcsec = (degrees) => Math.abs((((degrees % 360) + 540) % 360) - 180) * 3600;
const failures = [];
const fail = (what) => failures.push(what);

function vedicChart(definition) {
  return siderealChart({ utc: TIME, latitude: PLACE.latitude, longitude: PLACE.longitude, houseSystem: SYSTEM }, definition);
}

const rows = [];
for (const zodiac of zodiacs) {
  const request = { sidereal: zodiac.calc };
  const row = { zodiac: zodiac.label, calc: {}, houses: {}, chart: {}, events: {} };
  const reference = zodiac.vedic ? vedicChart(zodiac.vedic) : null;
  const vedicLon = new Map((reference?.bodies ?? []).map((entry) => [entry.body, entry.lon]));

  // calc(): every geocentric body, in both ecliptics of date.
  let calcOk = 0;
  let calcCompared = 0;
  let calcDiffers = 0;
  let framesWorst = 0;
  for (const body of CALC_BODIES.filter((name) => name !== 'Earth')) {
    const result = calc({ body, time: TIME, zodiac: request });
    if (result.status !== 'ok') { fail(`${zodiac.label}: calc ${body} ${result.reason}`); continue; }
    calcOk += 1;
    const mean = calc({ body, time: TIME, zodiac: request, frame: 'ecliptic-mean-of-date' });
    if (mean.status !== 'ok') fail(`${zodiac.label}: calc ${body} mean-of-date ${mean.reason}`);
    else framesWorst = Math.max(framesWorst, arcsec(mean.lon - result.lon));
    if (vedicLon.has(body)) {
      calcCompared += 1;
      if (result.lon !== vedicLon.get(body)) { calcDiffers += 1; fail(`${zodiac.label}: calc ${body} differs from siderealChart`); }
    }
  }
  row.calc = { ok: calcOk, comparedWithVedic: calcCompared, differing: calcDiffers, trueAndMeanOfDateWorstArcsec: framesWorst };

  // houses(): the angles and cusps against siderealChart's.
  const house = houses({ time: TIME, place: PLACE, system: SYSTEM, zodiac: request });
  if (house.status !== 'ok') fail(`${zodiac.label}: houses ${house.reason}`);
  else {
    row.houses.ok = true;
    if (reference) {
      const same = house.angles.asc === reference.ascendant.lon && house.angles.mc === reference.midheaven.lon
        && house.cusps.length === reference.cusps.length && house.cusps.every((cusp, index) => cusp === reference.cusps[index].lon);
      row.houses.sameAsVedic = same;
      if (!same) fail(`${zodiac.label}: houses differ from siderealChart`);
    }
  }

  // chart(): its sidereal part against siderealChart.
  const natal = chart({ time: TIME, place: PLACE, houseSystem: SYSTEM, zodiac: request });
  if (natal.status !== 'ok') fail(`${zodiac.label}: chart ${natal.reason}`);
  else {
    row.chart.ok = true;
    row.chart.ayanamsa = natal.sidereal.ayanamsa.name;
    if (reference) {
      const sidereal = natal.sidereal;
      const same = sidereal.bodies.length === reference.bodies.length
        && sidereal.bodies.every((entry, index) => entry.body === reference.bodies[index].body && entry.lon === reference.bodies[index].lon)
        && sidereal.ascendant === reference.ascendant.lon && sidereal.midheaven === reference.midheaven.lon
        && sidereal.cusps.every((cusp, index) => cusp === reference.cusps[index].lon)
        && sidereal.ayanamsa.name === reference.ayanamsa;
      row.chart.sameAsVedic = same;
      if (!same) fail(`${zodiac.label}: chart differs from siderealChart`);
    }
  }

  // events(): the Sun and the Moon on sidereal 0°, and calc's sidereal longitude at each instant found.
  for (const [body, from, to] of [['Sun', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'], ['Moon', '2026-03-01T00:00:00Z', '2026-04-01T00:00:00Z']]) {
    const found = events({ kind: 'longitude-crossing', body, longitude: 0, from, to, zodiac: request });
    if (found.status !== 'ok') { fail(`${zodiac.label}: events ${body} ${found.reason}`); continue; }
    if (found.events.length === 0) fail(`${zodiac.label}: events ${body} found nothing`);
    let worst = 0;
    for (const event of found.events) {
      const at = calc({ body, time: { jd: event.jdUt1, scale: 'UT1' }, zodiac: request });
      if (at.status !== 'ok') fail(`${zodiac.label}: calc at ${body}'s event ${at.reason}`);
      else worst = Math.max(worst, arcsec(at.lon));
    }
    row.events[body] = { found: found.events.length, worstArcsecFromTarget: worst, timingBound: found.bounds.timing };
  }
  rows.push(row);
}

// The span: an instant outside it, and a caller's ayanamsa carried by precession from an epoch outside it.
const OUTSIDE_EPOCH = { epoch: { jd: 1824800.5, scale: 'TT' }, value: 0 };
const OUTSIDE_EPOCH_VEDIC = userAyanamsa({ epoch: { julianDateTT: 1824800.5 }, value: 0 });
const LINEAR_EPOCH = { ...OUTSIDE_EPOCH, rate: 50.3 };
const LINEAR_EPOCH_VEDIC = userAyanamsa({ epoch: { julianDateTT: 1824800.5 }, value: 0, rate: 50.3 });
const statusOf = (result) => (result.status === 'ok' ? 'ok' : result.reason);
function allFour(zodiac, time = TIME, window = ['2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z']) {
  return {
    calc: statusOf(calc({ body: 'Sun', time, zodiac })),
    houses: statusOf(houses({ time, place: PLACE, zodiac })),
    events: statusOf(events({ kind: 'longitude-crossing', body: 'Sun', longitude: 0, from: window[0], to: window[1], zodiac })),
    chart: statusOf(chart({ time, place: PLACE, zodiac })),
  };
}
const vedicAt = (definition, at) => {
  const value = ayanamsa(definition, at);
  return { mean: value.mean, flags: value.flags };
};
const span = {
  calcSpan: CALC_SPAN,
  instantOutside: {
    at: '1700-06-01T12:00:00Z',
    calc: allFour({ sidereal: 'lahiri' }, '1700-06-01T12:00:00Z', ['1700-01-01T00:00:00Z', '1701-01-01T00:00:00Z']),
    vedic: vedicAt('lahiri', '1700-06-01T12:00:00Z'),
  },
  callerEpochOutside: {
    definition: 'mean ayanamsa 0° at TT Julian date 1824800.5 (284 CE), carried by precession',
    at: TIME,
    calc: allFour({ sidereal: OUTSIDE_EPOCH }),
    vedic: vedicAt(OUTSIDE_EPOCH_VEDIC, TIME),
  },
  callerEpochOutsideLinear: {
    definition: 'the same epoch and value with a rate of 50.3″ a year',
    at: TIME,
    calc: allFour({ sidereal: LINEAR_EPOCH }),
    vedic: vedicAt(LINEAR_EPOCH_VEDIC, TIME),
  },
};
const expect = (label, outcomes, wanted) => {
  for (const [name, outcome] of Object.entries(outcomes)) if (outcome !== wanted) fail(`${label}: ${name} ${outcome}, recorded as ${wanted}`);
};
expect('an instant outside the span', span.instantOutside.calc, 'out-of-range');
expect("a caller's precession-carried ayanamsa from an epoch outside the span", span.callerEpochOutside.calc, 'out-of-range');
expect("the same with a linear rate", span.callerEpochOutsideLinear.calc, 'ok');
if (span.instantOutside.vedic.flags.join() !== 'outside-reference-span') fail('/vedic at an instant outside the span is not flagged');
if (span.callerEpochOutside.vedic.flags.join() !== 'outside-reference-span') fail("/vedic's precession-carried ayanamsa from an early epoch is not flagged");
if (span.callerEpochOutsideLinear.vedic.flags.length !== 0) fail("/vedic's linear ayanamsa from an early epoch is flagged");

const record = {
  schema: 'zodiacs.calc-sidereal-sweep.v1',
  engine: ENGINE_VERSION,
  instant: TIME,
  place: PLACE,
  houseSystem: SYSTEM,
  what: 'Each of calc(), houses(), events() and chart() with each built-in ayanamsa and a caller\'s ayanamsa in twelve forms. calc() is compared with siderealChart() body by body, and in ecliptic-mean-of-date with ecliptic-true-of-date; houses() and chart() with siderealChart()\'s angles, cusps and bodies, exact equality; events() by calc()\'s sidereal longitude at each instant it finds. /vedic has no UT1 epoch, so the plain UT1 form is run without a comparison.',
  zodiacs: rows.length,
  rows,
  span,
  failures,
};
process.stdout.write(`${JSON.stringify(record, null, 1)}\n`);
if (failures.length > 0) process.exitCode = 1;
