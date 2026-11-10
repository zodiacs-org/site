/** Differences and statistics as the preregistration fixes them. */
export const ARCSEC = 3600;

/** Signed longitude difference a − b in degrees, wrapped to (−180°, 180°]. */
export function wrap(a, b) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Linear interpolation between order statistics, as compare.mjs does. */
export function quantile(values, q) {
  const sorted = [...values].sort((x, y) => x - y);
  if (sorted.length === 0) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export const max = (values) => (values.length ? Math.max(...values) : null);

/** Great-circle angle between two (lon, lat) directions in degrees, in degrees. */
export function separation(lon1, lat1, lon2, lat2) {
  const r = Math.PI / 180;
  const u = [Math.cos(lat1 * r) * Math.cos(lon1 * r), Math.cos(lat1 * r) * Math.sin(lon1 * r), Math.sin(lat1 * r)];
  const w = [Math.cos(lat2 * r) * Math.cos(lon2 * r), Math.cos(lat2 * r) * Math.sin(lon2 * r), Math.sin(lat2 * r)];
  const cross = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  return Math.atan2(Math.hypot(...cross), u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / r;
}

/** max and p50 of |Δlon| and max of |Δlat|, in arcseconds, over rows of { dLon, dLat } in arcseconds. */
export function summary(rows) {
  const lon = rows.map((row) => Math.abs(row.dLon));
  const lat = rows.map((row) => Math.abs(row.dLat));
  return { n: rows.length, lonMax: max(lon), lonP50: quantile(lon, 0.5), lonP95: quantile(lon, 0.95), latMax: max(lat) };
}
