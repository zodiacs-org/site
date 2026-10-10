// src/civil-calendar.ts
var julianLeap = (year) => year % 4 === 0;
var gregorianLeap = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
function parseCalendarDate(value, calendar) {
  if (typeof value !== "string" || value.length !== 10) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const leap = calendar === "julian" ? julianLeap(year) : gregorianLeap(year);
  const days = month === 2 ? leap ? 29 : 28 : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return day <= days ? { year, month, day } : null;
}
function shift(date) {
  const a = Math.floor((14 - date.month) / 12);
  return { y: date.year + 4800 - a, m: date.month + 12 * a - 3 };
}
function julianDayNumber(date, calendar) {
  const { y, m } = shift(date);
  const base = date.day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4);
  return calendar === "julian" ? base - 32083 : base - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}
function fromDayNumber(c, centuries) {
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * centuries + d - 4800 + Math.floor(m / 10)
  };
}
function civilDateOf(jdn, calendar) {
  if (calendar === "julian") return fromDayNumber(jdn + 32082, 0);
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  return fromDayNumber(a - Math.floor(146097 * b / 4), b);
}
function format(date) {
  if (date.year < 0 || date.year > 9999) return null;
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}
function julianToGregorian(value) {
  const date = parseCalendarDate(value, "julian");
  return date ? format(civilDateOf(julianDayNumber(date, "julian"), "gregorian")) : null;
}
function gregorianToJulian(value) {
  const date = parseCalendarDate(value, "gregorian");
  return date ? format(civilDateOf(julianDayNumber(date, "gregorian"), "julian")) : null;
}

export {
  parseCalendarDate,
  julianDayNumber,
  civilDateOf,
  format,
  julianToGregorian,
  gregorianToJulian
};
