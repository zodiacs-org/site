# DE440 comparison with live NASA JPL Horizons

The official service answered the requests in requests.json on 18 November
2026. The record includes each full URL, retrieval time and response digest.
On 23 November 2026 the same recorded answers were compared again, offline,
with the site engine at version 2.1.0 with DE440 selected. Its archive
SHA-256 and time model digest are in results.json. The Horizons values and
requests are unchanged from the 1.1.0 record in
`docs/platform/evidence/site-engine-1-1-0/claims-horizons`.

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
  is fixed beyond the prediction interval. Since 2.0.0 the engine also reads
  an instant after 2 October 2027 as UTC with TT = UTC + 69.184 s, taking
  UT1 from its ΔT model, so the two clocks now agree to milliseconds. The clock comparison uses 36,524 daily
  readings of Horizons quantity 30 from 2100 to 2199 and the engine's
  own offsets for the same calendar labels. The DE440 and DE441 positions
  at matched TT remove the effect of that difference.
- The Moon ingress comparison solves each published crossing on a ten-minute
  Horizons grid with the repository's nine-point interpolator, then compares
  that UTC time with the table shipped by the branch. The catalog comparison
  uses the same interpolator for longitude crossings and its derivative for
  stations. The event limits retain their existing thresholds. For 2.1.0 the
  Horizons event instants are the 18 November ones; each row's `at` is the
  instant the branch's catalog publishes.

The fresh solar eclipse vector comparison is pending. The eclipse check
continues to use its earlier evidence. The Moon ingress result applies to
sign crossings, where the void ends. The event comparison treats slow planet
crossings separately.

## Replay offline

`horizons-values.json.gz` holds the Julian day and the Horizons fields used
for each row of the position, clock and lunar ingress comparisons. The
compressed file contains apparent longitudes, clock offsets and lunar state
vectors, with the original numerical precision. The acquisition receipts in
`requests.json` identify the raw responses.

With the locked Node dependencies and the same Python dependencies as the
independent reference rebuild installed, run this command from the site root.

```sh
python3 docs/platform/evidence/site-engine-2-1-0/claims-horizons/comparison.py --check
```

The replay evaluates the vendored engine again, applies the matched TT
interpolation and ERFA node rotation, solves each Moon crossing, then checks
`results.json` and the figures printed on the methodology and void-of-course
pages. Use `--extract-raw DIRECTORY` to regenerate the compact file from the
original responses if they are available. The parser verifies each response
digest before retaining its fields.
