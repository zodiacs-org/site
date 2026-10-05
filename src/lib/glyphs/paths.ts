/**
 * Crafted glyph markup — the site's icon language extended to planets,
 * aspects, and the remaining tools. Each value is the inner SVG of a
 * `0 0 24 24` viewBox, drawn as line-art: stroke presentation (fill:none,
 * stroke:currentColor, round caps) is applied by the renderer
 * (PlanetGlyph / AspectGlyph / ToolGlyph); filled marks carry an inline
 * fill so they survive that. Kept as strings so the same drawing serves an
 * HTML `<svg>` (set:html / dangerouslySetInnerHTML) AND the wheel's own SVG.
 *
 * These replace the thin Unicode `GLYPHS` maps that were duplicated across
 * Wheel.tsx, ChartCalculator, TransitTracker, SynastryCalculator, and the
 * learn indexes.
 */

const DOT = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`;

/** Ten bodies + the lunar nodes, as traditional astrological line-art. */
export const PLANET_GLYPH: Record<string, string> = {
  // ☉ circle + centre dot
  Sun: `<circle cx="12" cy="12" r="7.4"/>${DOT(12, 12, 1.5)}`,
  // ☽ waxing crescent
  Moon: `<path d="M14.7 4.4a8 8 0 1 0 0 15.2 6.5 6.5 0 0 1 0-15.2Z"/>`,
  // ☿ crescent (horns up) · circle · cross
  Mercury: `<path d="M8.7 4.6a3.3 3.3 0 0 0 6.6 0"/><circle cx="12" cy="10.4" r="3.2"/><path d="M12 13.6v6M9 16.6h6"/>`,
  // ♀ circle over a cross
  Venus: `<circle cx="12" cy="8.4" r="4.4"/><path d="M12 12.8v8.2M8.6 17.4h6.8"/>`,
  // ♂ circle with an arrow to the upper right
  Mars: `<circle cx="10.4" cy="13.6" r="4.7"/><path d="M13.8 10.2 19 5"/><path d="M14.7 5H19v4.3"/>`,
  // ♃ hook + stem + crossbar
  Jupiter: `<path d="M7.6 10.2c0-4.2 6.2-4.2 6.2 0v9.6"/><path d="M9.3 16.3h6.6"/>`,
  // ♄ cross at top of a stem curling into a hook
  Saturn: `<path d="M10.2 5v9.4"/><path d="M8 7.6h4.4"/><path d="M10.2 14.4c0 3.4 3.4 3.4 4.6 1.1"/>`,
  // ♅ H-frame with a hanging circle (astronomical Uranus)
  Uranus: `<path d="M8 6v7M16 6v7M8 9.4h8M12 6v6.4"/><circle cx="12" cy="16.4" r="2.1"/><path d="M12 13v1.3"/>`,
  // ♆ trident
  Neptune: `<path d="M6.5 5.6v4.2M17.5 5.6v4.2M12 4.4V20"/><path d="M6.5 9.8a6 6 0 0 0 11 0"/><path d="M9 16.6h6"/>`,
  // ♇ open crescent cradling a circle, over a cross
  Pluto: `<path d="M7 8.8a5 5 0 0 0 10 0"/><circle cx="12" cy="6.6" r="2.2"/><path d="M12 13.6v7M9 17.1h6"/>`,
  // ☊ ascending node — omega, feet down
  'North Node': `<path d="M8 19.2v-3.4a4.3 4.8 0 1 1 8 0v3.4"/>${DOT(8, 19.2, 1.4)}${DOT(16, 19.2, 1.4)}`,
  // ☋ descending node — omega inverted, feet up
  'South Node': `<path d="M8 4.8v3.4a4.3 4.8 0 1 0 8 0V4.8"/>${DOT(8, 4.8, 1.4)}${DOT(16, 4.8, 1.4)}`,
};

/** The five major aspects the engine draws. */
export const ASPECT_GLYPH: Record<string, string> = {
  // ☌ circle with a radiating arm
  conjunction: `<circle cx="10.4" cy="13.6" r="4"/><path d="M13.2 10.8 18.4 5.6"/>`,
  // ⚹ six-rayed star
  sextile: `<path d="M12 4.5v15M5.5 8.25l13 7.5M18.5 8.25l-13 7.5"/>`,
  // □ square
  square: `<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="0.6"/>`,
  // △ triangle
  trine: `<path d="M12 5.4 19 18.2H5Z"/>`,
  // ☍ two circles joined by a bar
  opposition: `<circle cx="6.6" cy="12" r="2.6"/><circle cx="17.4" cy="12" r="2.6"/><path d="M9.2 12h5.6"/>`,
};

/**
 * Tool-card kinds. birth/moon/rising/compat carry over from ToolGlyph's
 * original inline set; the rest are new. sun/saturn reuse the planet forms.
 */
export const TOOL_GLYPH: Record<string, string> = {
  // natal wheel
  birth: `<circle cx="12" cy="12" r="8.25"/><circle cx="12" cy="12" r="3.25"/><path d="M12 3.75v3M12 17.25v3M3.75 12h3M17.25 12h3"/>${DOT(12, 12, 0.65)}`,
  // filled crescent
  moon: `<path d="M15.6 4.3a8.2 8.2 0 1 0 4.2 9.2 6.7 6.7 0 0 1-4.2-9.2Z" fill="currentColor" stroke="none"/>`,
  // sun cresting the horizon (ascendant)
  rising: `<path d="M2.75 17h18.5"/><path d="M7.5 17a4.5 4.5 0 0 1 9 0"/><path d="M12 5.4v2.3M6.2 8.2l1.5 1.5M17.8 8.2l-1.5 1.5"/>`,
  // two interlocking rings
  compat: `<circle cx="9" cy="12" r="5.3"/><circle cx="15" cy="12" r="5.3"/>`,
  // ☉ sun
  sun: PLANET_GLYPH.Sun,
  // ♄ saturn
  saturn: PLANET_GLYPH.Saturn,
  // reversing orbit loop (transits / retrogrades)
  transit: `<path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3"/><path d="M3.4 8.2 4.5 12l3.8-1.1"/>`,
  retrograde: `<path d="M19.5 12a7.5 7.5 0 1 0-2.2 5.3"/><path d="M20.6 8.2 19.5 12l-3.8-1.1"/>`,
  // half-lit phase disc
  moonphase: `<circle cx="12" cy="12" r="8.2"/><path d="M12 3.8a8.2 8.2 0 0 1 0 16.4Z" fill="currentColor" stroke="none"/>`,
  // filled full-moon disc
  fullmoon: `<circle cx="12" cy="12" r="8.2" fill="currentColor" stroke="none"/>`,
  // eclipse — a disc with a shadow bite
  eclipse: `<circle cx="12" cy="12" r="8.2"/><path d="M15 4.6a8.2 8.2 0 1 1 0 14.8 8.2 8.2 0 0 0 0-14.8Z" fill="currentColor" stroke="none"/>`,
  // sparkle — the baby / due-date tool
  baby: `<path d="M12 3.5c.4 4.4 1.6 5.6 6 6-4.4.4-5.6 1.6-6 6-.4-4.4-1.6-5.6-6-6 4.4-.4 5.6-1.6 6-6Z"/>`,
  // a ruled 3×3 table — the numerology letter grid, stroked like the other tools
  numerology: `<rect x="4.5" y="4.5" width="15" height="15" rx="1.5"/><path d="M4.5 9.5h15M4.5 14.5h15M9.5 4.5v15M14.5 4.5v15"/>`,
  // a plain conversation bubble for the site assistant
  assistant: `<path d="M5 5.5h14v10H10l-4.5 3v-3H5Z"/><path d="M8.5 9.3h7M8.5 12h4.5"/>`,
  // three small discs in a ring — a group of charts
  group: `<circle cx="12" cy="7.2" r="3.2"/><circle cx="7" cy="15.6" r="3.2"/><circle cx="17" cy="15.6" r="3.2"/>`,
  // a ring sending an arc to a second ring — an invitation
  invite: `<circle cx="7.5" cy="15" r="3.6"/><circle cx="16.5" cy="9" r="3.6"/><path d="M10.4 12.6 13.6 11"/>`,
  // a calendar sheet with one marked day
  calendar: `<rect x="4.5" y="5.5" width="15" height="14" rx="1.5"/><path d="M4.5 9.5h15M8.5 3.8v3.4M15.5 3.8v3.4"/>${DOT(12, 14.5, 1.1)}`,
  // a page with a small wheel — a printable chart
  document: `<path d="M6.5 3.8h8l3 3v13.4h-11Z"/><circle cx="12" cy="13.2" r="3.4"/>`,
};

export const GLYPH_VIEWBOX = '0 0 24 24';
