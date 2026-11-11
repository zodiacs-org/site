# DRAFT letter to NAIF. Not sent. Do not send without the owner's yes.

**Status: draft for review (ZOD-108). Nothing has been sent to NAIF by this
job.**

Three things the owner should know before deciding:

1. **The site's record says not to resend.** "The question was sent once, on
   2026-09-30 at 10:54 UTC, to the manager the contact page names for general
   requests. No answer yet. Do not resend it." `[S-NAIF-SENT]` This draft is
   written as a follow-up that refers to that message. Whether a follow-up
   goes out is the owner's call.
2. NAIF's own contact page says: "If you've not received an answer to an
   earlier request, don't hesitate to write again". `[T-NAIF-CONTACT]`
3. The text of the 30 September message is in neither repository, and the
   mailbox was not opened in this job (`SOURCES.md`, "What was not opened").
   Compare this draft with what was sent before using it, and attach or quote
   the first message.

The bracketed keys are citations for the reviewing session. They point to
`SOURCES.md` and come out before anything is sent.

---

**To:** The NAIF Manager, Navigation and Ancillary Information Facility,
Jet Propulsion Laboratory (the contact NAIF's page names when the writer does
not already know a specific person; by email, which the page prefers)
`[T-NAIF-CONTACT]`

**From:** Zodiacs.org (Zodiacs LLC), admin@zodiacs.org `[J3-ABOUT]`

**Subject:** Follow-up: may a compact refit of de440.bsp be redistributed?

Dear NAIF Manager,

We wrote to you on 30 September 2026 with a question about coefficients
derived from DE440, and we have not yet had an answer. `[S-NAIF-SENT]` We are
writing once more, with the facts set out more fully, in case the first
message was unclear or went astray.

**What we are asking**

Whether we may publish a small data file that we compute from `de440.bsp`,
and under what conditions. The file is in a format of our own and is not
DE440's own series. `[E-DE440-PACK]` We have held it back until we hear from
you. `[E-DE440-PACK]` `[S-NAIF-HELD]`

**What we have read**

We read your Rules page on 11 November 2026. `[T-NAIF-RULES]` It says that
"Redistribution of SPICE kernels distributed by NAIF is permitted as long as
they have not been modified", and that when a kernel has been modified the
attribution of the original producer "must be replaced with the name and
institution of whomever has made the last modification". `[T-NAIF-RULES]` It
also says of a modified kernel that "The file name must also be changed to
help avoid confusion", and that "Use of SPICE components in commercial
products is allowed" with "No fees or licensing are required".
`[T-NAIF-RULES]` We did not find a sentence on that page about data that is
computed from a kernel and published in another form. `[T-NAIF-RULES]` That
is the case we have, so we are asking and not assuming.

**The facts**

- We publish an open-source astronomy package, `@zodiacs/engine`. Its licence
  expression is `MIT AND CC-BY-4.0`. `[E-LIC-SPDX]` The CC BY part covers 32
  values from a paper on the Earth's rotation by Stephenson, Morrison and
  Hohenkerk (2016); it has nothing to do with NAIF or JPL. `[E-LIC-SPDX]`
- By default the package does not use a JPL ephemeris. It computes positions
  from the open-source library astronomy-engine. `[J2-ACC]` (finding A5,
  resting on `[E-DE440-HOSTED]` and `[E-NOTICE-DE440]`)
- The package has an optional entry that reads a "pack" supplied by the
  caller. `[E-NOTICE-DE440]` A pack is made by a compiler of ours that refits
  `de440.bsp` (SHA-256
  `a4ce9bf9b3282becc9f4b2ac3cebe03a2ae7599981aabd7265fd8482fff7c4b5`) body by
  body as Chebyshev series on records of its own and stores the coefficients
  quantised. `[E-DE440-PACK]` Compiled for the years 1790 to 2210, the pack is
  2,489,664 bytes. `[E-DE440-PACK]` Your server lists `de440.bsp` at 114M.
  `[T-NAIF-DIR]`
- In a pack, Mars to Pluto are planetary-system barycentres, not planet
  centres. `[E-DE440-BARY]`
- The pack's header names its producer, the source kernel, a citation and the
  fact of modification. `[S-PACK-HEADER]`
- **Nothing derived from DE440 is distributed today.** The published package
  holds no JPL ephemeris value and no coefficient fitted to one.
  `[E-LIC-JPL]` `[E-NOTICE-DE440]` No kernel and no pack is committed to our
  repositories. `[S-NAIF-HELD]` `[S-PR943]` Our documentation says: "Whether a
  pack derived from DE440 may be redistributed is a question put to NAIF;
  until it is answered, no pack is distributed, and a caller compiles one
  from its own copy of the kernel." `[E-DE440-PACK]`
- One thing computed from the kernel is in our public repository as test
  evidence: apparent places of ten bodies at 200 instants from 1800 to 2200,
  computed from `de440.bsp` with the ERFA library and used to check our own
  code. `[E-DE440-200]` `[E-DE440-ORACLES]` These files are not part of the
  published package. `[E-DE440-ORACLES]`

**Our questions**

1. May we redistribute a pack as described above, that is a refit of
   `de440.bsp` in our own format, under our own file name, with our name as
   its producer and DE440 named as its source?
2. If so, what wording do you ask for in the file and in our documentation?
   We would state the producer, the source kernel and its digest, and that
   the file is a refit and not JPL's own series, which is what we understand
   your rule for a modified kernel to ask. `[T-NAIF-RULES]`
3. Does the same answer apply to a small set of numbers computed from the
   kernel, such as the 200 instants of positions we keep as test evidence?
4. Does the answer change if a pack is used in a product that is offered
   commercially, or served from a hosted service? Your page allows commercial
   use of SPICE components; we would like to know whether that reaches a file
   derived from a kernel. `[T-NAIF-RULES]`
5. If NAIF is not the right office for a question about data derived from a
   JPL development ephemeris, whom should we ask? We have seen that the JPL
   Solar System Dynamics site says of its own pages that "The data provided
   on this site are considered public domain". `[T-SSD-FAQ]` We have not
   assumed that this sentence covers the kernels on NAIF's server.

We will keep holding the pack back until we hear from you. Thank you for
SPICE and for the kernels.

Yours sincerely,

[name], for Zodiacs.org
admin@zodiacs.org

---

## What this draft deliberately does not say

Following job 2's notes for this letter (`[J2-ACC]`, "What the letters to
NAIF, IERS and CDS must not get wrong", and `[J2-LIC]`, the same heading):

- It does not say the package's positions come from DE440 or from JPL.
- It does not call a pack "DE440".
- It does not say a pack is distributed, or describe NAIF's answer as given.
- It does not call NAIF's kernels "public domain". The site's own record
  says: "NAIF never says public domain, and what it grants is a permission
  with conditions." `[S-PA-NOTICE]`
- It quotes no accuracy figure.
- It does not say the hosted service uses DE440. The engine's guide says so
  in the present tense `[E-DE440-HOSTED]`, and the live service reports
  astronomy-engine `[L-CAPS]`; see `06-how-we-calculate.md`.

## Open points for the owner

- Whether to send at all, given "Do not resend it". `[S-NAIF-SENT]`
- The signatory, and whether "Zodiacs LLC" is the right sender.
- Question 4 names commercial use. Leave it out if the owner would rather not
  raise it; the lawyer brief (`04-lawyer-brief.md`, question 5) carries it
  either way.
- This job did not check how the compiler reads `de440.bsp` (with the SPICE
  Toolkit or with a reader of our own). If it uses the Toolkit, the Toolkit's
  rules on the same page apply as well and the letter should say so.
