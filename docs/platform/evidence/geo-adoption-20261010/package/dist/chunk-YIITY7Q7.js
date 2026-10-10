import {
  civilDateOf,
  format,
  julianDayNumber,
  parseCalendarDate
} from "./chunk-KFTJMMG7.js";
import {
  validateBirthSettings
} from "./chunk-PFGUCNOK.js";

// src/geo/calendar.ts
var GREGORIAN_ADOPTION_SOURCES = /* @__PURE__ */ Object.freeze({
  tzdb: "IANA tzdata 2025c, file calendars, quoting H. Grotefend, Taschenbuch der Zeitrechnung, ed. O. Grotefend (1941), pp. 26-28",
  "grotefend-1891": "H. Grotefend, Zeitrechnung des deutschen Mittelalters und der Neuzeit, vol. 1 (1891), pp. 133-134",
  "grotefend-1898": "H. Grotefend, Taschenbuch der Zeitrechnung des deutschen Mittelalters und der Neuzeit (1898), pp. 23-24"
});
var ROWS = `AT|Austria|Austria|1584-01-17|t|Grotefend 1898: 1583-10-16, with Bavaria. Salzburg 1583-10-16; Styria 1583-12-25.
BE|Belgium|Brabant, Flanders, Hainaut|1583-01-01|t|Grotefend 1891, 1898: 1582-12-25. Bishopric of Li\xE8ge 1583-02-21.
CH|Switzerland|Z\xFCrich, Bern, Basel, Schaffhausen|1701-01-12|t18|Also Geneva and Thurgau. Catholic cantons 1584-01-22 (Grotefend 1891: 1584-01-23); Unterwalden June 1584; Glarus, Appenzell, St. Gallen city 1724; Valais 1655 (Grotefend 1898: 1622); Graub\xFCnden 1760-1812 (Grotefend 1898: to 1811); bishopric of Basel 1583-10-31.
CZ|Czech Republic|Bohemia|1584-01-17|t18|Silesia 1584-01-23. Moravia is not dated.
DE|Germany|Protestant states|1700-03-01|t18|Catholic states from 1583: bishopric of Augsburg 1583-02-24, Bavaria 1583-10-16, the latest listed the bishopric of Hildesheim 1631-03-26.
DK|Denmark|-|1700-03-01|t18|
ES|Spain|-|1582-10-15|t18|
FI|Finland|-|1753-03-01|t|With Sweden; see Sweden. tzdb's list says the Russian empire, Finland included, kept the Julian calendar until 1917.
FR|France|France, Lorraine|1582-12-20|t18|City of Strasbourg 1682-02-16; bishopric of Strasbourg 1583-11-27 (Grotefend 1898: 1583-11-22); Austrian Upper Alsace 1583-10-24. Republican calendar 1793-11-24 to 1805-12-31, in Paris also 1871-05-06 to 1871-05-23: not converted.
GB|Britain (UK)|Great Britain|1752-09-14|t18|
HU|Hungary|-|1587-11-01|t18|The legal change. tzdb's list also gives 1584-02-02, "legally on 21 Oct 1587".
IT|Italy|Italy, with exceptions|1582-10-15|t18|Bishopric of Brixen (Bressanone) 1583-10-16.
NL|Netherlands|Holland|1583-01-01|t|Grotefend 1891, 1898: 1582-12-25. Gelderland 1700-07-12; Zutphen 1700-07-12 (Grotefend 1898: 1700-12-12); Utrecht, Overijssel 1700-12-12; Friesland, Groningen 1701-01-12; Grotefend 1891: 1700-12-12 for all six. Zeeland and Drenthe are not dated.
NO|Norway|-|1700-03-01|t|Grotefend 1891, 1898 name Denmark only.
PL|Poland|Roman Catholics, and Danzig|1582-10-15|t|Grotefend 1898: not everywhere, notably not among Protestants and the Greek Church; Grotefend 1891: 1586. Silesia 1584-01-23; duchy of Prussia 1612-09-02 (Grotefend 1898: 1612-09-01).
PT|Portugal|-|1582-10-15|t18|
RU|Russia|Soviet Russia|1918-02-14|t|Grotefend 1891, 1898: still Julian. Duchy of Prussia, now partly Kaliningrad, 1612-09-02 (Grotefend 1898: 1612-09-01).
SE|Sweden|-|1753-03-01|t18|From 1 March 1700 to 30 February 1712 Swedish dates are one day ahead of the Julian (Grotefend 1898).`;
var SOURCE_KEYS = { t: "tzdb", 1: "grotefend-1891", 8: "grotefend-1898" };
var GREGORIAN_ADOPTION = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ ROWS.split("\n").map((line) => {
    const [code, country, region, firstGregorian, sources, note] = line.split("|");
    const day = julianDayNumber(parseCalendarDate(firstGregorian, "gregorian"), "gregorian");
    return Object.freeze({
      code,
      country,
      region: region === "-" ? null : region,
      firstGregorian,
      lastJulian: format(civilDateOf(day - 1, "julian")),
      sources: Object.freeze([...sources].map((key) => SOURCE_KEYS[key])),
      note
    });
  })
);
function gregorianAdoption(country) {
  return GREGORIAN_ADOPTION.find((row) => row.code === country || row.country === country);
}
function calendarNote(gregorianDate, calendar, country) {
  if (!parseCalendarDate(gregorianDate, "gregorian")) throw new RangeError("gregorianDate must be a valid Gregorian date, YYYY-MM-DD.");
  if (calendar !== "gregorian" && calendar !== "julian") throw new RangeError('calendar must be "gregorian" or "julian".');
  if (typeof country !== "string" || !country.trim()) throw new RangeError("country must be a nonempty string.");
  return noteFor(gregorianDate, calendar, country);
}
function noteFor(gregorianDate, calendar, country) {
  const adoption = gregorianAdoption(country);
  if (!adoption) return null;
  const julian = calendar === "julian";
  if (gregorianDate.length > 10 || gregorianDate >= adoption.firstGregorian) return julian ? { kind: "new-style", adoption } : null;
  return julian ? null : { kind: "old-style", adoption };
}

// src/tzdb/tzdb-2025c.ts
var TZDB = /* @__PURE__ */ Object.freeze({
  version: "2025c",
  sha256: "4aa79e4effee53fc4029ffe5f6ebe97937282ebcdf386d5d2da91ce84142f957",
  form: "main+backzone"
});
var SHARD_LOADERS = [
  () => import("./tzdb-2025c-00-6GVG6RYL.js"),
  () => import("./tzdb-2025c-01-CEYMG3LE.js"),
  () => import("./tzdb-2025c-02-NWQJCVUU.js"),
  () => import("./tzdb-2025c-03-PLHP6VH4.js"),
  () => import("./tzdb-2025c-04-MEKUJA6M.js"),
  () => import("./tzdb-2025c-05-3K5YKZBL.js"),
  () => import("./tzdb-2025c-06-L2VV5XJV.js"),
  () => import("./tzdb-2025c-07-H3GLGJGY.js"),
  () => import("./tzdb-2025c-08-DA7QQIGD.js"),
  () => import("./tzdb-2025c-09-MTXIO3QL.js"),
  () => import("./tzdb-2025c-10-ASL4UW5C.js"),
  () => import("./tzdb-2025c-11-EQEOANYB.js"),
  () => import("./tzdb-2025c-12-NKCCXJ5G.js"),
  () => import("./tzdb-2025c-13-DYTF3UC7.js"),
  () => import("./tzdb-2025c-14-C25H45R5.js"),
  () => import("./tzdb-2025c-15-7OYYZWRY.js")
];
var LATER_CAUSES = "26z1v3r9wo.2lzdo.2092c.51mzc.;4omh4gkhm0.;8i4hw7ji4c.8fno.94cvo.;emnzt8v8m6.;pibsacwtc0.;shzcp6wjs0.609ic.14eec.;qn9anc1rqo.;hr04d6wjeo.609ic.14eec.;iwfdj6f1oo.;jxme485390.;vxtl73htjc.;zmgwf7egs0!;008wxcglro.4g1o.ie6c.3m1o.;xgck2d5eqc!;x90aj50d2u.;e4lpj23xc0.;n97c09emgo.6l9mc.;c1i1b2i6cc.;srkypcglq0.4970.il10.3lyc.1glac.fl5o.6hh0.4ypc.67h0.4t70.6hc1.4yqz.69p1.4yqz.69p1.4vjz.;6bx5p6nh2c.69c80.14eec.fzlo.;d7foo4bvj0.;da48bez4xo.;cc60723xc0.;r2ctm3r9wo.2lzdo.2092c.51mzc.;09xrhgo29o.;23q2c4g4g0.;2fq0m6nh2c.69c80.14eec.nrlo.;73ubg6wji0.609ic.14eec.;glme93r9mo.;iztuh9nq0c.;yksj0kmbc.;94mmz6nh2c.69c80.14eec.195lo.oeuc.;c9gx56mm3c.74rc.3y7yc.l5o.;ftdfk2i6cc.;fyvor6f1oo.;oqbaz9c9u0.;upch43ip7c.;4tlos3ofjo.38450.;bzp0f6wjn0.8fhf0.;cwffa6mm3c.74rc.;lal8k92wc0.;oyxuu31w40.4rwuc!;z0hat2fygi.bwwu.;091etgo29o.;blqvj6wjlc.f49c.5l5ao.14eec.jnto.;tgp36clt30.;9wqor23xc0.;vma32kmbc.;6vjgid5eoo!;agkxx6wji0.609ic.14eec.fznc.;bt63w1yu1o.;6fyvm6dbgo.;93ycg6f1oo.;jenq11pdmo.;kikwv6wjjo.609ic.14eec.;6i87mkmbc.;ktr4c6bdnc.tlnc.3mpic.3w1o.;lnqdp1pdmo.;x5jk0173j0.;ylrpy4bvj0.;yvsdoecogo.10ao0.;51sa56mm3c.74rc.3y7yc.l5o.;imjhpc1rsc.1onac.;xgvkj6tqo0.632mc.;4rg6l6wjd0.609k0.;cx7tr6mm3c.74rc.;e7mcw6wjlc.609ic.14eec.;3se9a6dbgo.;8k2bmkmbc.;nkww16bdnc.hxnc.;sjll11ibsc.856ho.12w0.;tbefcc1rsc.1onac.;v730i4n7yc.;dvg44kmbc.;v977f6mm3c.74rc.3y7yc.ddo.;7egrqe35eo.;lgxqt4g4g0.k8uc.;8hz4v6mm3c.74rc.3y7yc.l5o.;pyva5q8v0.;npf8s6wjn0.a2170.;x1w033is10.3drdo.609ic.58r0.z5p0.;068n925yo0.;kjcdu4m9pu.;b0ken2i6e0.;e0yew2i6cc.;pfxgu6wjn0.609ic.14eec.;4oapw3r3pc.9lic.;9linmuzqo.gvqc.;z70s311v0q6_;zme5q6wjoo.a215c.;oh15y11je0.k8uc.5a80c.88fo.321o.193ac.;blv5h6mjvc.22jc.43cec.l5o.;d7hxtkmbc.;jvnzr6f1oo.;wrz6f32nac.h2ho.;x7xki3r9mo.;0aanqasrbo.8fio.;foc486wjoo.609ic.14eec.;wh9055mw2o.;04yj4kmbc.;31xyt6wjeo.609ic.14eec.gurc.;k0dlb4n7yc.;k4x616wjeo.609k0.14eec.fzlo.;qsklxf141o.b9k0.;d90416wjlc.11sxc.4ygmo.14eec.fzlo.;diqxz9emgo.5klmc.;hqu65r7tc.;r60tt9c9u0.;7hozj7egs0!;n4f883r3pc.bjf0.4vl5o.560rc.;rcx29bn8lc.;tyfb56wjoo.;3mwwdr7tc.;h2j0f6wjoo.;n3exs6wjgc.609ic.14eec.;pf3zccwtc0.14eec.;3wlms4692o.8kazc.;hjhq6852vo.;yded86mm3c.74rc.;cshzubvnvo.2mmo0.;mkxe53htjc.;u226p6mm3c.74rc.;v8ck8774zc.5b2c.;xy1qbcgltc.;s3w2g3ofjo.38450.u8uc.;58co631w1s.4rwuw!;x8ghc1uhio.;y3thu2fygi.bwwu.;u3e1j1qwm9.57t4f.;cga095k1yu.;7xj8c6wjs0.609ic.14eec.;5m66y6wjlc.37w6c.2sddo.14eec.hxlo.;69icl31w40.4rwuc!;mu12m6bdnc.tlnc.3mpic.3w1o.;odp3marwl0.ndo.;otx0189jyu.4r36.2yq8u.;sxc0n6nh2c.69c80.14eec.;mez0y6wjoo.;tsxgk3r9mo.;2447s1zep0.7ms9o.;3s5e6c1rsc.1onac.;983km2uo86.;qbuhn50d2u.;qslwbe5bvo.;u0hxf6wji0.3qpv0.29jlo.58r0.z5p0.;cft6i6borc.dpfc.42jic.1p5o.13cko.jezc.;6o3pl3uzh0.;ertoo6wjs0.609ic.14eec.fzlo.;h5uvn5k1yu.;sa6yk50dkc.;4q92r6bdnc.hxnc.;wfyr46wjoo.;7zfow2rx5i.;j06xje5c0o.;teiet4bvo0.;6v8ej6mjvc.22jc.43bac.1p5o.;ajtnw2x3so.;ttwf6ea8x0.uog0.;o6n0f6wjlc.609k0.;4bqjbaryt0.l5o.;j9sdo38geo.;0hdnqebsg6.;6qmtw6f1qc.177go.68h90.6h8o.;asm1e4n7yc.;kzndtc1rsc.1onac.;mmp3d1kcxo.;pjzkh6wjd0.609k0.";

// src/geo/zone-history.ts
var CAUSES = { d: "dst", l: "legal-change", x: "date-line" };
function nameHash(name) {
  const key = name.toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}
function decode(entry) {
  const times = [];
  let previous = 0;
  if (entry.t) {
    entry.t.split(",").forEach((part, index) => {
      const value = parseInt(part, 36);
      previous = index === 0 ? value : previous + value;
      times.push(previous * 1e3);
    });
  }
  const types = [0];
  const causes = [];
  for (let index = 0; index < entry.k.length; index += 2) {
    types.push(parseInt(entry.k[index], 36));
    causes.push(CAUSES[entry.k[index + 1]]);
  }
  return {
    name: entry.n,
    source: entry.s,
    hostLegal: entry.h === 1,
    zoneEraEnd: entry.f === null ? null : entry.f * 1e3,
    era: entry.e ? entry.e.map(([until, offset]) => [until * 1e3, offset]) : null,
    times,
    types,
    causes,
    offsets: entry.y.map((type) => type[0]),
    dst: entry.y.map((type) => type[1] === 1),
    abbreviations: entry.y.map((type) => type[2])
  };
}
var histories = /* @__PURE__ */ new Map();
var loads = /* @__PURE__ */ new Map();
function loadedHistory(timeZone) {
  return histories.get(timeZone.toLowerCase());
}
function loadHistory(timeZone) {
  const key = timeZone.toLowerCase();
  if (histories.has(key)) return Promise.resolve();
  const bucket = nameHash(timeZone) % SHARD_LOADERS.length;
  let pending = loads.get(bucket);
  if (!pending) {
    const load = SHARD_LOADERS[bucket]().then((module) => module.default);
    loads.set(bucket, load);
    void load.catch(() => {
      if (loads.get(bucket) === load) loads.delete(bucket);
    });
    pending = load;
  }
  const ready = pending.then((zones) => {
    const entry = Object.prototype.hasOwnProperty.call(zones, key) ? zones[key] : void 0;
    histories.set(key, entry ? decode(entry) : null);
  });
  void ready.catch(() => {
  });
  return ready;
}
function typeIndexAt(history, ms) {
  let lo = 0;
  let hi = history.times.length;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (history.times[mid] <= ms) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function transitionAt(history, ms) {
  const index = typeIndexAt(history, ms) - 1;
  return index >= 0 && history.times[index] === ms ? index : -1;
}
var later;
function laterCause(timeZone, ms) {
  if (!later) {
    later = /* @__PURE__ */ new Map();
    for (const row of LATER_CAUSES.split(";")) {
      const causes = /* @__PURE__ */ new Map();
      let at = 0;
      for (const [, digits, mark] of row.slice(5).matchAll(/([0-9a-z]+)([.!_~])/g)) {
        const kind = ".!_~".indexOf(mark);
        at += parseInt(digits, 36) * (kind < 2 ? 6e4 : 1e3);
        causes.set(at, kind % 2 ? "date-line" : "legal-change");
      }
      later.set(parseInt(row.slice(0, 5), 36), causes);
    }
  }
  return later.get(nameHash(timeZone) % 36 ** 5)?.get(ms) ?? "dst";
}

// src/geo/timezone.ts
var offsetFormatters = /* @__PURE__ */ new Map();
function validateTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone.trim().length === 0) {
    throw new RangeError("timeZone must be an explicit nonempty timezone string.");
  }
}
function offsetFormatter(timeZone) {
  validateTimeZone(timeZone);
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      timeZoneName: "longOffset"
    });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
}
function validateInstant(utcMilliseconds) {
  if (typeof utcMilliseconds !== "number" || !Number.isFinite(utcMilliseconds)) {
    throw new RangeError("utcMilliseconds must be a finite epoch-millisecond timestamp.");
  }
}
function offsetAt(timeZone, utcMilliseconds) {
  validateInstant(utcMilliseconds);
  const name = offsetFormatter(timeZone).formatToParts(utcMilliseconds).find((part) => part.type === "timeZoneName")?.value;
  const match = (name ?? "GMT").match(/^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/u);
  if (!match) {
    throw new RangeError(`Could not read UTC offset for timezone: ${timeZone}`);
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) + Number(match[4] ?? 0) / 60);
}
var DAY = 864e5;
var PROBE = 36 * 36e5;
var MAX_DEPARTURE_SECONDS = 180 * 60;
var FIXED_ZONE = /^(?:etc\/)?(?:utc|uct|gmt|gmt0|gmt[+-]0|greenwich|universal|zulu)$|^etc\/gmt[+-]\d{1,2}$/iu;
function hostTzdbVersion() {
  const tz = globalThis.process?.versions?.tz;
  return typeof tz === "string" && /^\d{4}[a-z]$/u.test(tz) ? tz : null;
}
function firstChange(clockAt, lo, hi) {
  const from = clockAt(lo);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (clockAt(mid) === from) lo = mid;
    else hi = mid;
  }
  return hi;
}
function readClock(wallMs, clockAt, samples) {
  const readings = [];
  for (const offset of new Set(samples.map(clockAt))) {
    const utcMs2 = wallMs - offset * 1e3;
    if (clockAt(utcMs2) === offset && !readings.some((reading) => reading.utcMs === utcMs2)) {
      readings.push({ utcMs: utcMs2, offset });
    }
  }
  const [first, second] = readings.sort((a, b) => a.utcMs - b.utcMs);
  if (first) {
    return second ? { chosen: first, kind: "fold", at: firstChange(clockAt, first.utcMs, second.utcMs) } : { chosen: first, kind: null, at: null };
  }
  let lo = wallMs - PROBE - DAY;
  let hi = wallMs + PROBE + DAY;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (mid + clockAt(mid) * 1e3 > wallMs) hi = mid;
    else lo = mid;
  }
  const utcMs = wallMs - clockAt(lo) * 1e3;
  return { chosen: { utcMs, offset: clockAt(utcMs) }, kind: "gap", at: hi };
}
function zoneClock(timeZone, history) {
  return (ms) => {
    const offset = history && ms < 0 ? history.offsets[history.types[typeIndexAt(history, ms)]] : null;
    return offset ?? Math.round(offsetAt(timeZone, ms) * 60);
  };
}
function birthplaceClock(history, wallMs, longitude, zoneAt) {
  const era = history.era;
  if (!era) return null;
  const endMs = era[era.length - 1][0];
  if (wallMs - PROBE > endMs) return null;
  const meanSeconds = Math.round(longitude * 240);
  const eraOffset = (ms) => (era.find(([until]) => ms < until) ?? era[era.length - 1])[1];
  const place = (ms) => meanSeconds + Math.round((eraOffset(ms) - meanSeconds) / 86400) * 86400;
  const sample = Math.min(wallMs, endMs - 1);
  if (Math.abs(place(sample) - eraOffset(sample)) > MAX_DEPARTURE_SECONDS) return null;
  const legalFrom = history.hostLegal && zoneAt(endMs + PROBE) !== zoneAt(endMs) ? firstChange(zoneAt, endMs, endMs + PROBE) : endMs;
  return {
    clockAt: (ms) => ms < endMs ? place(ms) : zoneAt(Math.max(ms, legalFrom)),
    endMs,
    legalFrom,
    /** The era's own line ends before endMs: moves across the date line. */
    lineEnds: era.slice(0, -1).map(([until]) => until)
  };
}
function readOptions(options) {
  if (options === void 0) return { calendar: "gregorian" };
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new RangeError("options must be an object.");
  }
  for (const key of Object.getOwnPropertyNames(options)) {
    if (!["longitude", "calendar", "country"].includes(key)) throw new RangeError(`Unknown local time option "${key}".`);
  }
  const { longitude, calendar = "gregorian", country } = options;
  if (longitude !== void 0 && !(typeof longitude === "number" && Math.abs(longitude) <= 180)) {
    throw new RangeError("longitude must be between -180 and 180 degrees.");
  }
  if (calendar !== "gregorian" && calendar !== "julian") throw new RangeError('calendar must be "gregorian" or "julian".');
  if (country !== void 0 && (typeof country !== "string" || !country.trim())) {
    throw new RangeError("country must be a nonempty string.");
  }
  return { longitude, calendar, country };
}
var pad = (value, width = 2) => String(value).padStart(width, "0");
function resolveLocalToUtc(date, time, timeZone, options) {
  offsetFormatter(timeZone);
  const { longitude, calendar, country } = readOptions(options);
  const written = parseCalendarDate(date, calendar);
  const hhmm = typeof time === "string" ? /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(time) : null;
  if (!written || !hhmm) {
    throw new RangeError(`Local date/time must be a ${calendar === "julian" ? "Julian" : "Gregorian"} date YYYY-MM-DD and a time HH:MM.`);
  }
  const civil = calendar === "julian" ? civilDateOf(julianDayNumber(written, "julian"), "gregorian") : written;
  if (civil.year < 0) throw new RangeError("The Julian date falls before the Gregorian year 0000.");
  const gregorianDate = `${pad(civil.year, 4)}-${pad(civil.month)}-${pad(civil.day)}`;
  const wall = /* @__PURE__ */ new Date(0);
  wall.setUTCFullYear(civil.year, civil.month - 1, civil.day);
  const wallMs = wall.setUTCHours(Number(hhmm[1]), Number(hhmm[2]));
  const loaded = FIXED_ZONE.test(timeZone) ? null : loadedHistory(timeZone);
  if (loaded === void 0 && wallMs < DAY) throw new ZoneHistoryNotLoadedError();
  const history = loaded ?? null;
  const zoneAt = zoneClock(timeZone, history);
  const place = longitude !== void 0 && history ? birthplaceClock(history, wallMs, longitude, zoneAt) : null;
  const samples = [wallMs - PROBE, wallMs, wallMs + PROBE, ...place ? [place.endMs - 1, place.endMs, place.legalFrom] : []];
  const clockAt = place ? place.clockAt : zoneAt;
  const zoneReading = readClock(wallMs, zoneAt, samples);
  const reading = place ? readClock(wallMs, clockAt, samples) : zoneReading;
  const { chosen, kind } = reading;
  const inEra = !!place && chosen.utcMs < place.endMs;
  const count = history && chosen.utcMs < 0 ? typeIndexAt(history, chosen.utcMs) : -1;
  const type = count < 0 ? -1 : history.types[count];
  const shipped = inEra || type >= 0 && history.offsets[type] !== null;
  let applied = reading.at;
  if (applied === null && shipped) {
    const recorded = count > 0 ? history.times[count - 1] : null;
    const marks = place ? [...place.lineEnds, place.endMs, place.legalFrom].filter((at) => at <= chosen.utcMs) : [];
    if (recorded !== null && (!place || recorded >= place.legalFrom)) marks.push(recorded);
    applied = marks.length ? Math.max(...marks) : null;
  }
  let transition = null;
  if (applied !== null) {
    const at = applied;
    const before = clockAt(at - 1);
    const after = clockAt(at);
    const recorded = history && at < 0 ? transitionAt(history, at) : -1;
    transition = {
      at: new Date(at).toISOString(),
      offsetBeforeMinutes: before / 60,
      offsetAfterMinutes: after / 60,
      cause: Math.abs(after - before) >= 43200 ? "date-line" : place && (at === place.endMs || at === place.legalFrom) ? "legal-change" : recorded >= 0 ? history.causes[recorded] : laterCause(timeZone, at)
    };
  }
  const lmt = inEra || !place && history?.zoneEraEnd != null && chosen.utcMs < history.zoneEraEnd;
  const flags = kind ? [kind === "gap" ? "dst-gap" : "dst-fold"] : [];
  if (lmt) flags.push("lmt");
  const localMeanTime = longitude !== void 0 && place && (inEra || kind === "gap" && reading.at === place.endMs) ? { longitude, zoneOffsetMinutes: zoneReading.chosen.offset / 60 } : null;
  const zone = shipped ? {
    source: "tzdb",
    tzdbVersion: TZDB.version,
    dataForm: history.hostLegal ? "main" : "main+backzone",
    abbreviation: inEra ? null : history.abbreviations[type],
    dst: !inEra && history.dst[type]
  } : { source: "intl", tzdbVersion: hostTzdbVersion(), dataForm: "host", abbreviation: null, dst: null };
  const offsetMinutes = chosen.offset / 60;
  return {
    utc: new Date(chosen.utcMs),
    offsetMinutes,
    flags,
    date: gregorianDate,
    writtenDate: date,
    calendar,
    jump: kind && transition ? { kind, cause: transition.cause } : null,
    transition,
    localMeanTime,
    zone,
    intlOffsetMinutes: shipped ? offsetAt(timeZone, chosen.utcMs) : null,
    calendarNote: country === void 0 ? null : noteFor(gregorianDate, calendar, country),
    localResolution: {
      date: gregorianDate,
      time,
      timeZone,
      offsetMinutes,
      gapShiftMinutes: kind === "gap" && transition ? transition.offsetAfterMinutes - transition.offsetBeforeMinutes : 0,
      policy: { fold: "earlier", gap: "shift-forward" },
      calendar,
      writtenDate: date,
      tzdbVersion: zone.tzdbVersion,
      dataForm: zone.dataForm,
      clock: lmt ? "local-mean-time" : "legal",
      transition,
      localMeanTime
    }
  };
}
function prepareLocalTime(date, timeZone) {
  try {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new RangeError("date must be YYYY-MM-DD.");
    offsetFormatter(timeZone);
  } catch (error) {
    return Promise.reject(error);
  }
  return Number(date.slice(0, 4)) > 1970 || FIXED_ZONE.test(timeZone) ? Promise.resolve() : loadHistory(timeZone);
}
function zoneOffsetAt(timeZone, utcMilliseconds) {
  validateInstant(utcMilliseconds);
  offsetFormatter(timeZone);
  const loaded = FIXED_ZONE.test(timeZone) ? null : loadedHistory(timeZone);
  if (loaded === void 0 && utcMilliseconds < 0) throw new ZoneHistoryNotLoadedError();
  return zoneClock(timeZone, loaded ?? null)(utcMilliseconds) / 60;
}
var ZoneHistoryNotLoadedError = class extends Error {
  name = "ZoneHistoryNotLoadedError";
  constructor() {
    super("The zone's history before 1970 is not loaded: await prepareLocalTime(date, timeZone) first.");
  }
};
var LOCAL_BIRTH_KEYS = [
  "date",
  "time",
  "timeZone",
  "latitude",
  "longitude",
  "houseSystem",
  "timeKnown",
  "calendar",
  "country"
];
function resolveLocalBirth(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RangeError("birth must be an object containing a local date and timezone.");
  }
  for (const key of Object.getOwnPropertyNames(input)) {
    if (!LOCAL_BIRTH_KEYS.includes(key)) throw new RangeError(`Unknown local birth field "${key}".`);
  }
  const fields = Object.fromEntries(LOCAL_BIRTH_KEYS.map((key) => [key, input[key]]));
  const settings = validateBirthSettings(fields);
  const time = fields.time;
  const timeKnown = settings.timeKnown ?? time !== void 0;
  if (timeKnown && time === void 0) {
    throw new RangeError("time is required when timeKnown is true.");
  }
  const resolution = resolveLocalToUtc(fields.date, time === void 0 ? "12:00" : time, fields.timeZone, {
    longitude: settings.longitude,
    calendar: fields.calendar,
    country: fields.country
  });
  return {
    birth: {
      utc: resolution.utc,
      timeKnown,
      houseSystem: settings.houseSystem ?? "whole",
      flags: resolution.flags,
      ...settings.latitude === void 0 ? {} : { latitude: settings.latitude, longitude: settings.longitude }
    },
    resolution,
    reference: time === void 0 ? "local-noon" : "supplied-instant"
  };
}
function resolveBirth(input) {
  return resolveLocalBirth(input).birth;
}

export {
  GREGORIAN_ADOPTION_SOURCES,
  GREGORIAN_ADOPTION,
  gregorianAdoption,
  calendarNote,
  TZDB,
  offsetAt,
  resolveLocalToUtc,
  prepareLocalTime,
  zoneOffsetAt,
  ZoneHistoryNotLoadedError,
  resolveLocalBirth,
  resolveBirth
};
