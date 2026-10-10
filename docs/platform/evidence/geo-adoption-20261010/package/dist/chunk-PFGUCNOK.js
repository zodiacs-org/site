// src/birth-input.ts
var HOUSE_SYSTEM_NAMES = [
  "whole",
  "placidus",
  "porphyry",
  "equal",
  "equal-mc",
  "vehlow",
  "koch",
  "regiomontanus",
  "campanus",
  "topocentric",
  "alcabitius",
  "morinus",
  "meridian"
];
function validateBirthSettings(birth) {
  const { houseSystem, timeKnown, latitude, longitude } = birth;
  if (houseSystem !== void 0 && !HOUSE_SYSTEM_NAMES.includes(houseSystem)) {
    throw new RangeError(
      `houseSystem must be one of ${HOUSE_SYSTEM_NAMES.map((name) => `"${name}"`).join(", ")}.`
    );
  }
  if (timeKnown !== void 0 && typeof timeKnown !== "boolean") {
    throw new RangeError("timeKnown must be a boolean.");
  }
  const hasLatitude = latitude !== void 0;
  const hasLongitude = longitude !== void 0;
  if (hasLatitude !== hasLongitude) {
    throw new RangeError("latitude and longitude must be supplied together.");
  }
  if (latitude !== void 0 && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    throw new RangeError("latitude must be between -90 and 90 degrees.");
  }
  if (longitude !== void 0 && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    throw new RangeError("longitude must be between -180 and 180 degrees.");
  }
  return {
    ...houseSystem === void 0 ? {} : { houseSystem },
    ...timeKnown === void 0 ? {} : { timeKnown },
    ...latitude === void 0 ? {} : { latitude, longitude }
  };
}
var FLAGS = [
  "dst-gap",
  "dst-fold",
  "lmt",
  "no-time",
  "polar-fallback",
  "outside-reference-span"
];
var DERIVED_FLAGS = ["no-time", "polar-fallback", "outside-reference-span"];
function snapshotFlags(value) {
  const length = Array.isArray(value) ? Object.getOwnPropertyDescriptor(value, "length")?.value : void 0;
  if (typeof length !== "number" || !Number.isInteger(length) || length < 0 || length > 64) {
    throw new RangeError("flags must be an array of at most 64 supported chart flags.");
  }
  const values = [];
  for (let index = 0; index < length; index += 1) {
    const flag = Object.getOwnPropertyDescriptor(value, String(index))?.value;
    if (typeof flag !== "string" || !FLAGS.includes(flag)) {
      throw new RangeError("flags must contain only supported chart flag strings.");
    }
    if (!values.includes(flag)) values.push(flag);
  }
  if (values.includes("dst-gap") && values.includes("dst-fold")) {
    throw new RangeError('flags cannot contain both "dst-gap" and "dst-fold".');
  }
  return { values, hasDuplicates: values.length !== length };
}
function timeFlags(flags) {
  return flags.filter((flag) => !DERIVED_FLAGS.includes(flag));
}
function assertDerivedFlags(supplied, actual) {
  for (const flag of DERIVED_FLAGS) {
    if (supplied.includes(flag) && !actual.includes(flag)) {
      throw new RangeError("flags contradict the birth time or house result.");
    }
  }
}

export {
  validateBirthSettings,
  snapshotFlags,
  timeFlags,
  assertDerivedFlags
};
