# Independent Swiss true-node and polar references

The engine test imports six independently acquired Swiss Ephemeris cases:
three traditional osculating lunar ascending nodes and three polar locations.
The raw JSON and acceptance policy were reviewed before the application was
evaluated. They are copied without changing any bytes, including historical
scratch paths and retrieval receipts. The tests run offline against constants;
Swiss Ephemeris is not an application dependency.

| Artifact | SHA-256 |
| --- | --- |
| `src/lib/engine/fixtures/swiss-node-polar.fixture.json` | `022fbc030185b84aa0954411aab266577cd75f50a1947dc4717e92d8a9db9260` |
| `src/lib/engine/fixtures/swiss-node-polar-policy.json` | `7742cb2bc7cd0932a344ddcb708e45dad07b91cb653ea1f55538c2d73fa18e96` |
| `generate-references.py` | `9ba915b5e600ecc2b1412e37a0c8f49743c35b8f7387cc6472fa6a72a0b672c4` |

The provider is the unmodified [pyswisseph 2.10.3.2 distribution](https://pypi.org/project/pyswisseph/2.10.3.2/),
which reports Swiss Ephemeris **2.10.03**. The actual loaded files report
**DE441**, independently of older package descriptions. Both official
Astrodienst files came from repository commit
`3fd0f956d73898b91cc4f67cf18b21af656d1342`:

| Input | SHA-256 |
| --- | --- |
| Python source distribution | `c54c305e83dbd5d2b71e58d8a69d8ee41de24c4d3328ce09e2af860a3537624d` |
| `semo_18.se1` | `1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7` |
| `sepl_18.se1` | `ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66` |

Exact download URLs, HTTP receipts, loaded coverage ranges and hashes are
embedded in the fixture and copied in `receipts/acquisition.json`. The
`receipts/runtime-install.json` records the isolated Python 3.12.13 runtime,
GCC/G++ 13.3.0 build, wheel and loaded extension. Provider source and ephemeris
binaries are not redistributed here; use the recorded official URLs and
observe the provider's licensing terms.

## Coordinate and time conventions

Node calls use `swe.calc(jdTT, swe.TRUE_NODE, swe.FLG_SWIEPH | swe.FLG_SPEED)`:
tropical geocentric ecliptic of date with Swiss's default nutation convention,
longitude in degrees and speed in degrees per day. The definition is the
traditional osculating ascending lunar node, never the mean or interpolated
node. Every reference actually returned flags **258**, ephemeris mask **2**,
and an empty C warning buffer. The recipe calls the raw C entry point before
the wrapper to preserve warnings; this avoids wrapper/cache information loss.

The UTC instants are converted with `swe.utc_to_jd(..., swe.GREG_CAL)`.
Positions use its TT value; houses use its model-derived UT1 value. The latter
is not a separately observed IERS DUT1 measurement. Raw TT, UT1 and Delta-T
values are retained. No optional leap-second or Delta-T files were installed.

The polar locations are Tromsø, Longyearbyen and the southern-latitude mirror
of Longyearbyen. Longitude is east positive. Tropical whole houses use
`swe.houses_ex(jdUT1, latitude, longitude, b'W', 0)`. ASC is `ascmc[0]`, MC is
`ascmc[1]`; the twelve returned cusps are preserved. Separate Placidus calls
return C status **-1**, with Swiss's conventional **Porphyry** fallback arrays.
Those arrays document the provider error contract. Product Placidus requests
instead fall back to **whole** houses and expose `polar-fallback`, so both
product house modes are compared with the independent Swiss **W** tuples.
See the provider's [API documentation](https://www.astro.com/swisseph/swephprg.htm)
and [technical conventions](https://www.astro.com/swisseph/swisseph.htm).

## Frozen engineering gates and scope

The node longitude gate is 0.10°, and its speed gate is 0.02°/day. Direction
agreement is required only when **both** absolute speeds exceed 0.02°/day.
The 2020 node case deliberately falls inside that deadband. ASC/MC gates are
0.1°, and the whole-house cusp gate is 0.2°, retained from existing independent
house tests. These are product acceptance limits, not provider accuracy
guarantees or a complete model-error envelope. Raw printed digits do not
imply equivalent accuracy. Failures require diagnosis, not widened gates or
application-generated expected values.

Initial comparison used clean application commit
`a395549a36991c031b48a1d104b706e9df935f41`, Node 22.23.2,
`@zodiacs/engine` 0.1.0 and `astronomy-engine` 2.1.19. All six references passed;
maximum node longitude residual was 0.001685457°, speed residual
0.000350604°/day, polar angle residual 0.000434825°, and all whole cusps matched
exactly. Existing mean-node/geometric sanity tests remain separate.

An additional eight-case validation covers representative 1800/2000/
2199 epochs, two conditioned station pairs, a JPL-derived progression mapping,
a full natal-to-solar return and seven Saturn return crossings. It is separate
evidence with compact regression fixtures and an exact extraction map; see
`../swiss-eight-cases/README.md`. Historical/future nominal UT1 transport,
lunar correction differences, independently derived broad timing bands and
returned-chart applicability limits remain explicit there.

## Reproduction

Use a new scratch directory; never regenerate the committed fixture in place.
Copy the byte-preserved `acquire.py`, `generate-references.py` and `receipts/`
contents there. Copy the committed policy to `comparison-policy.json` there.
`acquire.py` downloads only the pinned provider sources/files and records
their hashes. The original isolated build commands were:

```sh
python3 -m venv env
mkdir -p downloads ephe
python3 acquire.py
CC=gcc CXX=g++ LDSHARED='g++ -shared' python3 -m pip wheel --no-index --no-deps --no-build-isolation --no-cache-dir --wheel-dir downloads downloads/pyswisseph-2.10.3.2.tar.gz
env/bin/python -m pip install --no-index --no-deps downloads/pyswisseph-2.10.3.2-cp312-cp312-linux_x86_64.whl
env/bin/python generate-references.py
```

Verify both acquired ephemeris hashes against the table above before running
the generation recipe. The original source wheel was built using the recorded environment's
preinstalled setuptools/wheel tools. A different compiler, Python ABI or
build toolchain can change the binary hash and must receive a new runtime
receipt; never silently relabel it as the recorded build. The generation
script refuses to overwrite a prior raw result. Acquisition-time timestamps
and scratch paths naturally differ in a new receipt. Compare scientific
tuples, flags, conventions and pinned source hashes separately from receipt
metadata, and retain both original and new raw evidence.

## Addition, 2026-09-28: the fixture left the tree

Under [DECISIONS-2026-09-28 §3](../../platform/programme/DECISIONS-2026-09-28.md)
Swiss's raw output left the current tree, and with it
`src/lib/engine/fixtures/swiss-node-polar.fixture.json`, SHA-256
`022fbc030185b84aa0954411aab266577cd75f50a1947dc4717e92d8a9db9260`
as in the table above. Commit `2ca93d41` still has it
(`git show 2ca93d41:src/lib/engine/fixtures/swiss-node-polar.fixture.json`),
and the recipe under Reproduction regenerates it in a scratch directory, which
is where it should stay. The policy stays. `engine.test.ts` and
`scripts/platform-engine-report.mjs` hold the same six cases to its unchanged
gates against NASA JPL Horizons and ERFA
([`../independent-references/`](../independent-references/README.md)). The
maxima above are this pack's, measured against Swiss. The record of
everything removed is [`../SWISS-OUTPUT-REMOVAL.md`](../SWISS-OUTPUT-REMOVAL.md).
