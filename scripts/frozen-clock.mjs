/*
 * Pins the wall clock of a Node process to one instant, so two builds render
 * the same "now" (F-97: .github/workflows/sitemap-dates.yml).
 *
 *   ZODIACS_FROZEN_CLOCK=2026-10-14T12:00:00Z \
 *     NODE_OPTIONS="--import=/absolute/path/to/frozen-clock.mjs" npm run build
 *
 * NODE_OPTIONS reaches every Node process the build starts. Some pages print
 * the time they were built (the void-of-course Moon's "As of …" line) or a
 * body's position at that time (the rising-sign pages' chart rulers), so two
 * builds of the same source a few minutes apart differ there. With this
 * module preloaded, `Date.now()`, `new Date()` and `Date()` read the pinned
 * instant; a date built from an argument is unchanged, as are the monotonic
 * clocks timers and durations use (`performance.now()`, `process.hrtime`).
 * Without ZODIACS_FROZEN_CLOCK the module changes nothing.
 */
const pinned = process.env.ZODIACS_FROZEN_CLOCK;

if (pinned) {
  const instant = Date.parse(pinned);
  if (!Number.isFinite(instant)) {
    throw new Error(`frozen-clock: ZODIACS_FROZEN_CLOCK is not a date: ${pinned}`);
  }
  const RealDate = Date;
  function FrozenDate(...args) {
    // Called without `new`, Date returns the current time as a string.
    if (!new.target) return new RealDate(instant).toString();
    return args.length === 0 ? new RealDate(instant) : new RealDate(...args);
  }
  // Every date keeps the real prototype, so `instanceof Date` holds for dates
  // made before and after the swap.
  FrozenDate.prototype = RealDate.prototype;
  FrozenDate.now = () => instant;
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  Object.defineProperty(FrozenDate, 'name', { value: 'Date' });
  Object.defineProperty(FrozenDate, 'length', { value: 7 });
  globalThis.Date = FrozenDate;
}
