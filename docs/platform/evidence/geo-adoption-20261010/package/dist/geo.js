import {
  GREGORIAN_ADOPTION,
  GREGORIAN_ADOPTION_SOURCES,
  TZDB,
  ZoneHistoryNotLoadedError,
  calendarNote,
  gregorianAdoption,
  offsetAt,
  prepareLocalTime,
  resolveBirth,
  resolveLocalBirth,
  resolveLocalToUtc,
  zoneOffsetAt
} from "./chunk-YIITY7Q7.js";
import {
  gregorianToJulian,
  julianToGregorian
} from "./chunk-KFTJMMG7.js";
import "./chunk-PFGUCNOK.js";

// src/geo/geonames.ts
var fold = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
function joinedUrl(baseUrl, file) {
  return `${baseUrl.replace(/\/$/u, "")}/${file}`;
}
function invalidData(resource) {
  throw new TypeError(`Invalid GeoNames ${resource} data.`);
}
function nonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function nonnegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function stringTable(value, nonempty = false) {
  if (!Array.isArray(value)) invalidData("index");
  const table = [];
  for (const item of value) {
    if (typeof item !== "string" || nonempty && !nonemptyString(item)) invalidData("index");
    table.push(item);
  }
  return table;
}
function validateIndex(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalidData("index");
  const own = (key) => Object.getOwnPropertyDescriptor(value, key)?.value;
  const version = own("version");
  const source = own("source");
  const count = own("count");
  if (version !== 1 || !nonemptyString(source) || !nonnegativeInteger(count)) invalidData("index");
  const tz = stringTable(own("tz"), true);
  const admin1 = stringTable(own("admin1"));
  const countries = stringTable(own("countries"));
  const shards = stringTable(own("shards"));
  if (shards.some((key) => key.length !== 1 || !/^[a-z0]$/u.test(key)) || new Set(shards).size !== shards.length) {
    invalidData("index");
  }
  return { version, source, count, tz, admin1, countries, shards };
}
function tableIndex(value, table) {
  return nonnegativeInteger(value) && value < table.length;
}
function coordinate(value, maximum) {
  return typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= maximum;
}
function validateShard(value, index) {
  if (!Array.isArray(value)) invalidData("shard");
  const rows = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== 8) invalidData("shard");
    const [name, ascii, admin1, country, latitude, longitude, timeZone, population] = row;
    if (!nonemptyString(name) || ascii !== 0 && !nonemptyString(ascii) || !tableIndex(admin1, index.admin1) || !tableIndex(country, index.countries) || !coordinate(latitude, 9e3) || !coordinate(longitude, 18e3) || !tableIndex(timeZone, index.tz) || !nonnegativeInteger(population)) {
      invalidData("shard");
    }
    rows.push([name, ascii, admin1, country, latitude, longitude, timeZone, population]);
  }
  return rows;
}
function createGeoNamesClient(options) {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error("A fetch implementation is required.");
  if (!options.baseUrl.trim()) throw new RangeError("baseUrl is required.");
  let indexPromise;
  const shardCache = /* @__PURE__ */ new Map();
  async function fetchJson(url) {
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`GeoNames fetch failed: ${response.status}`);
    return response.json();
  }
  function index() {
    if (!indexPromise) {
      const request = fetchJson(joinedUrl(options.baseUrl, "index.json")).then(validateIndex).catch((error) => {
        if (indexPromise === request) indexPromise = void 0;
        throw error;
      });
      indexPromise = request;
    }
    return indexPromise;
  }
  function shard(key, loaded) {
    let request = shardCache.get(key);
    if (!request) {
      request = fetchJson(joinedUrl(options.baseUrl, `${key}.json`)).then((value) => validateShard(value, loaded)).catch((error) => {
        if (shardCache.get(key) === request) shardCache.delete(key);
        throw error;
      });
      shardCache.set(key, request);
    }
    return request;
  }
  return {
    async preload() {
      const loaded = await index();
      return {
        version: loaded.version,
        source: loaded.source,
        count: loaded.count,
        timeZones: [...loaded.tz],
        shards: [...loaded.shards]
      };
    },
    async searchCities(query, limit = 8) {
      if (!Number.isInteger(limit) || limit < 1) {
        throw new RangeError("limit must be a positive integer.");
      }
      const needle = fold(query.trim());
      if (needle.length < 2) return [];
      const loaded = await index();
      const key = /^[a-z]/u.test(needle) ? needle[0] ?? "0" : "0";
      if (!loaded.shards.includes(key)) return [];
      const rows = await shard(key, loaded);
      const starts = [];
      const contains = [];
      for (const row of rows) {
        const searchable = fold(typeof row[1] === "string" ? row[1] : row[0]);
        if (searchable.startsWith(needle)) starts.push(row);
        else if (needle.length >= 3 && searchable.includes(needle)) {
          contains.push(row);
        }
        if (starts.length >= limit * 3) break;
      }
      return [...starts, ...contains].slice(0, limit).flatMap((row) => {
        const timeZone = loaded.tz[row[6]];
        if (!timeZone) return [];
        return [
          {
            name: row[0],
            admin1: loaded.admin1[row[2]] ?? "",
            country: loaded.countries[row[3]] ?? "",
            latitude: row[4] / 100,
            longitude: row[5] / 100,
            timeZone,
            population: row[7]
          }
        ];
      });
    }
  };
}
export {
  GREGORIAN_ADOPTION,
  GREGORIAN_ADOPTION_SOURCES,
  TZDB,
  ZoneHistoryNotLoadedError,
  calendarNote,
  createGeoNamesClient,
  gregorianAdoption,
  gregorianToJulian,
  julianToGregorian,
  offsetAt,
  prepareLocalTime,
  resolveBirth,
  resolveLocalBirth,
  resolveLocalToUtc,
  zoneOffsetAt
};
