# Independent Solar Term source acquisition

The readonly [native producer](https://github.com/zodiacs-org/site/actions/runs/38045122431) at 8da723c03aec367f27a672fb34f811f02b5e9509 returned all 120 requested rows in four bounded anonymous GET requests. The retained JSON replies are the exact upstream bytes, verified against the producer's sizes and SHA-256 digests. They identify NASA/JPL Horizons API 1.2, DE441, the Sun, Earth geocentre, airless apparent longitude, UT output and the source's EOP file. No engine was loaded.

The PMO 2026 calendar supplies minute-resolution search centres. Its rounding rule is unspecified; those values cannot establish the programme's two-second event gate. PMO's official explanation describes Beijing time, IERS models and a one-second requirement for calendar date decisions over 1900–2100. The full GB/T 33661-2017 normative text remains unread. The programme threshold is unchanged.

Horizons quantity 31 uses IAU76/80 apparent ecliptic of date. Equivalence to the carried engine's coordinate frame has not been established. These replies are source preparation, without interpolation, engine comparison, independent accuracy acceptance, calendar conformance or publication clearance. The private Solar Term prototype still reports unvalidated accuracy and unproven completeness.

The original plan overstated screenshot inspection. This connector returned text placeholders instead of image pixels; minute values were read from the primary PDF's extracted text. `source-review-correction.json` explicitly withdraws the visual-inspection claim while retaining the original producer plan and JPL source replies.
