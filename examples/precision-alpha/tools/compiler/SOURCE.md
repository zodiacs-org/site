# Where this compiler came from

A copy of the pack compiler from the research tree, vendored so a
consumer of this package has a tested route from their own kernel to a
local pack without needing the website checkout.

Source: `docs/platform/evidence/precision-2026-09-20/compiler/` in
ZodiacsOfficial/site at `2f07212bfb6fbe07c4b55f8583c460acd50e1b63`, as
compiler 1.1.0.

## Compiler 2.0.0 (31 October 2026)

Version 1's M2.1 asked the compiler to take its span from the kernel, to
refuse a pack whose proven bounds exceed their budgets, to require
`--kernel`, write to the working directory by default and handle `--help`,
and to write a header with checked convention tokens and a provenance
block. Four files changed to do it: `compile.mjs`, `cheb.mjs`,
`sources.mjs` and `spkref.mjs`. The research tree keeps their 1.1.0 copies
as the record of what 1.1.0 measured; what 2.0.0 measured is in
`docs/platform/evidence/pack-compiler-20261031/`.

The files as they stand here:

| file | sha256 |
| --- | --- |
| `compile.mjs` | `aec996119b2c8721d728a34b4f4d6029513a32e7ac8a0a27979e17e848e32353` |
| `cheb.mjs` | `a8110c7748968618816acc21f668bc796ccf8bb1433718a4ed71001cfe4fc5a5` |
| `format.mjs` | `7f509db1f0d69448c26894936c066c6f9a10fbc3f78d68a209f123ab799782db` |
| `sources.mjs` | `7019bc476b111a9aba62f9002074b210d1f5edc3655fb8f809a4a083e7c01186` |
| `spkref.mjs` | `08a5b4866c69edb574e7ef3c4d48dab0f5a09fc3e40cc905dca15a013ac53b4a` |
| `runtime.mjs` | `3d7f7aca14153e9ac15cbda239ef12ed695fbef5c19877d8e71f8b9d19bc987d` |

The 1.1.0 copies that 2.0.0 replaced, as they stand in the research tree:

| file | sha256 |
| --- | --- |
| compile.mjs (1.1.0) | a5cb5f13ab6b3cb593e12d1590794f72dd12893d8500162d96a365fb4b1bc472 |
| cheb.mjs (1.1.0) | e3d1793ad9db89df925d7e14493420bdb4cda0f3d29645c9c13577e2f47fbb65 |
| sources.mjs (1.1.0) | 4fbf3098d970b3ddfb5f8d0acf92b6d3fe4e2979cb9073fe00673261dab18d68 |
| spkref.mjs (1.1.0) | eda035a677c9f3898c4039c3156202ce6f812b394d1c89fd5d401b448c307c68 |

`runtime.mjs` (sha256 `3d7f7aca14153e9ac15cbda239ef12ed695fbef5c19877d8e71f8b9d19bc987d`) is vendored too, and is the one file here
that nothing imports. The compiler stamps a hash of its own source set into
every pack header and `runtime.mjs` is in that set, so the file has to be
present for the hash to be computable; it is the research track's own
reader and **this package does not use it**. The numerical core is
`src/core/`, and a test asserts nothing under `src/` reaches into this
directory.

It also needs one data file, `raw/choice.json` (sha256 `bd433a11cb062e46cf00ca7c1fa63383c28deba0f15956597d47a159c8c99d14`),
which is the per-body interval and degree choice the sweep settled on. It
contains settings and fitted error figures, no coefficients and nothing
derived from a kernel. Since 2.0.0 it is where each body's fit starts; the
compiler adds coefficients from there until the fit is proven inside half
the body's budget.

`test/tier-a/vendored-compiler.nodetest.mjs` re-hashes these. When the
research tree is present beside them, it checks that `format.mjs`,
`runtime.mjs` and `raw/choice.json` have not drifted from it, and that the
1.1.0 hashes above are the research tree's. In a packed archive the
research tree is absent and the hash tables above are what remains
checkable.

It reads a SPICE SPK kernel and writes a `ZODEPH01` pack;
`tools/seal.mjs` converts that to the `ZODEPH02` this runtime accepts.
No coefficient data is included here: only the program that produces it
from a kernel you supply.
