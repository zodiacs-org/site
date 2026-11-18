# DE440 comparison with live NASA JPL Horizons

The official service answered the requests in requests.json on 18 November
2026. The record includes each full URL, retrieval time and response digest.
The site engine identifies itself as version 1.1.0 with DE440 selected. Its
archive SHA-256 and time model digest are in results.json.

- Stratified comparison uses the original 18 chart dates and ten bodies.
  For each matching UT label, it compares the apparent geocentric ecliptic
  longitude of date from Horizons observer quantity 31 with the longitude
  returned by the package. It takes the shorter circular distance.
- The longer comparison keeps the ten-day cadence at noon over 1800 to 2199.
  It adds the ascending node of the Moon's osculating orbit from the live
  geometric lunar state vectors. ERFA 2.0.1 rotates the angular momentum
  into the true ecliptic of date. The matched TT comparison evaluates the
  Horizons values at the engine's TT using three nearby TT samples per epoch.
- Horizons reports UT1 before 1962 and UTC from 1962. Its future UTC offset
  is fixed beyond the prediction interval, while the engine uses estimated
  UT1 outside the IERS period. The clock comparison uses 36,524 daily
  readings of Horizons quantity 30 from 2100 to 2199 and the engine's
  own offsets for the same calendar labels. The DE440 and DE441 positions
  at matched TT remove the effect of that difference.
- The Moon ingress comparison solves each published crossing on a ten-minute
  Horizons grid with the repository's nine-point interpolator, then compares
  that UTC time with the table shipped by the branch. The catalog comparison
  uses the same interpolator for longitude crossings and its derivative for
  stations. The event limits retain their existing thresholds.

The fresh solar eclipse vector comparison is pending. The eclipse check
continues to use its earlier evidence. The Moon ingress result applies to
sign crossings, where the void ends. The event comparison treats slow planet
crossings separately.
