# DRAFT letter to the CDS (Strasbourg). Not sent. Do not send without the owner's yes.

**Status: draft for review (ZOD-108). Nothing has been sent to the CDS, to
ESA or to any journal by this job.**

Two things the owner should know before deciding:

1. **The CDS's site is degraded.** Its home page carries a notice, "Last
   updated November 09, 2026", of "a cybersecurity incident within its
   network of servers located in Strasbourg". `[T-CDS-HOME]` Both of its
   legal pages return 404 today. `[T-CDS-404]` This draft quotes its terms
   from dated archive copies. A reply may be slow; waiting until the pages
   are back is an option.
2. **A correction to what jobs 2 and the issue say about the A&A rule.**
   The sentence "Tabular data, spectra or images coming from A&A (J/A+A) are
   free for a scientific usage" is in the archived page's source, but inside
   an HTML comment, so the page does not show it to a reader. `[T-WB-VIZIER]`
   It was already commented out in the archive's copy of 4 September 2021.
   `[T-WB-VIZIER-2021]` What the page shows for A&A catalogues is two links to
   A&A's own policy pages `[T-WB-VIZIER]`, which refused automated reading
   here. `[T-AANDA]` Job 2's second-session review read the sentence as a
   displayed list entry. `[J2-BREAKER]` (S3) The letter below therefore asks
   the CDS whether that sentence is still its rule, and does not state it as
   one.

The bracketed keys are citations for the reviewing session. They point to
`SOURCES.md` and come out before anything is sent.

---

**To:** CDS support team, Centre de Données astronomiques de Strasbourg,
cds-question@unistra.fr (the contact address on the CDS's General Terms and
on its current notice) `[T-WB-LEGALS]` `[T-CDS-HOME]`

**From:** Zodiacs.org (Zodiacs LLC), admin@zodiacs.org `[J3-ABOUT]`

**Subject:** Use of 20 single values obtained through VizieR and SIMBAD in open-source software

Dear CDS support team,

We know your services are recovering from an incident, and this is not
urgent. `[T-CDS-HOME]`

**What we are asking**

Whether using 20 single published values, obtained through VizieR and
SIMBAD, in open-source software that anyone may reuse needs anything beyond
the citations we already give, and which rules apply to each value's origin.

**What we carry**

- Our package is `@zodiacs/engine`, open source, with the licence expression
  `MIT AND CC-BY-4.0`. `[E-LIC-SPDX]` Two of its entries carry 22 published
  values for four objects, which it uses to compute four star-based
  ayanamsas. `[E-LIC-STARS]` `[E-NOTICE-STARS]`
- Twenty of the 22 were obtained through VizieR and SIMBAD
  `[E-NOTICE-STARS]`:
  - from F. van Leeuwen 2007, A&A 474, 653 (VizieR I/311, Hipparcos, the New
    Reduction): the positions, proper motions and parallaxes of Spica,
    zeta Psc A and delta Cnc; `[E-NOTICE-STARS]`
  - from G. A. Gontcharov 2006, Astronomy Letters 32, 759 (VizieR III/252):
    the radial velocity of zeta Psc A; `[E-NOTICE-STARS]`
  - from B. Famaey et al. 2005, A&A 430, 165 (VizieR J/A+A/430/165): the
    radial velocity of delta Cnc; `[E-NOTICE-STARS]`
  - from SIMBAD: the radial velocity of Spica, and the ICRS position of
    Sgr A*. `[E-NOTICE-STARS]`
- The other two values, the proper motion of Sgr A*, come from Reid and
  Brunthaler 2004 (ApJ 616, 872, table 2) and not from the CDS; we are not
  asking you about them. `[E-NOTICE-STARS]` `[E-LIC-CDS]`
- No catalogue file and no table is redistributed, only these single values
  as constants in the code. `[E-LIC-STARS]`
- Our notice file cites each source, the VizieR service by its DOI
  (10.26093/cds/vizier), the catalogue DOI for J/A+A/430/165, and the SIMBAD
  paper (Wenger et al. 2000). `[E-NOTICE-STARS]`

**What we have read of your terms**

Your General Terms and the VizieR rules page return an error at their usual
addresses today, so we quote the Internet Archive's copies of 9 September
and 25 October 2026. `[T-CDS-404]` `[T-WB-LEGALS]` `[T-WB-VIZIER]`

- The General Terms (updated 7 January 2026) say: "The Data Sets must be
  cited in any work or product that uses them", with the DOI where there is
  one and the CDS service that supplied them. `[T-WB-LEGALS]` They also say
  that datasets containing only public information are distributed under an
  Open Licence, ODbL or CC-BY, and that a dataset under a contributor's own
  licence shows that licence on its page. `[T-WB-LEGALS]`
- The VizieR rules say the data "are free of usage in a scientific context"
  with the original authors and publication cited, and: "The commercial usage
  of the data is subject to rules depending of the origin". `[T-WB-VIZIER]`
- For catalogues from A&A the page links to A&A's open-access policy and
  copyright pages. `[T-WB-VIZIER]` The page's source also contains, inside a
  comment and so not displayed, the sentence "Tabular data, spectra or images
  coming from A&A (J/A+A) are free for a scientific usage." `[T-WB-VIZIER]`
- Our record of 29 September 2026 is that none of the three catalogues'
  ReadMe files, nor VizieR's record of them, states a licence of its own.
  `[E-LIC-CDS]`
- For Hipparcos, ESA's page for the 1997 catalogues says "The Hipparcos and
  Tycho Catalogues are distributed under the CC BY-NC 3.0 IGO licence".
  `[T-ESA-HIP]` ESA's page for the new reduction states no licence and says
  the data "is also available from CDS in VizieR". `[T-ESA-HIP2]`

**Our questions**

1. Our package's licence lets anyone reuse it, including in commercial
   products, so we cannot say that every use of these 20 values will be in a
   scientific context. Is citation, as we give it, enough for single values
   used this way?
2. Which of the licences your General Terms name applies to each of I/311,
   III/252 and J/A+A/430/165, and to the SIMBAD values?
3. For J/A+A/430/165: is the commented-out sentence above still your rule
   for data from A&A, or should we go by A&A's own policy pages?
4. For I/311: do you regard the new reduction, as VizieR serves it, as under
   ESA's terms for Hipparcos data, under the author's or the journal's, or
   under your General Terms? If the answer lies with ESA, we will ask ESA.
5. Is there a wording of acknowledgement you would prefer to the one we use?

[Optional paragraph, only if the owner decides to raise it now.] We are also
considering a larger set: about 411 stars taken from the Hipparcos new
reduction with SIMBAD radial velocities. `[E-STARS-BRANCH]` Would your
answers be the same for a set of that size?

Thank you for VizieR and SIMBAD.

Yours sincerely,

[name], for Zodiacs.org
admin@zodiacs.org

---

## What this draft deliberately does not say

- It does not say the CDS's terms allow or forbid the use. The engine's
  record says only that "whether a commercial use needs more than attribution
  is not settled by these sources". `[E-LIC-CDS]`
- It does not say "ESA's terms for Hipparcos are non-commercial" as a finding
  about the values we carry. What was read is that the 1997 catalogues are
  under CC BY-NC 3.0 IGO and that ESA's page for the 2007 reduction states no
  licence. `[T-ESA-HIP]` `[T-ESA-HIP2]` Whether ESA's terms reach values
  taken from VizieR I/311 is an open question (`04-lawyer-brief.md`,
  question 4), as job 2's second session said. `[J2-BREAKER]` (S4)
- It does not state the A&A sentence as the CDS's current rule (see the note
  at the top).
- It does not ask the CDS about Reid and Brunthaler's values, which are not
  the CDS's to license. `[E-LIC-CDS]`

## Open points for the owner

- Whether to send now or after the CDS's pages are back. `[T-CDS-HOME]`
- Whether to include the optional paragraph on the 411-star branch. That
  branch is an unmerged draft (engine pull request 80) and calls these
  sources "each free to use with acknowledgement", which is looser than
  `main`'s reading of the same terms. `[E-STARS-BRANCH]` `[J2-LIC]` (C7)
- Whether a separate letter to ESA (data.licences@esa.int is the address its
  terms give for a commercial-use request `[T-ESA-TERMS]`) should go at the
  same time, or wait for the CDS's answer to question 4, or wait for the
  lawyer. No letter to ESA was drafted: the issue names NAIF, IERS and CDS.
- The three catalogues' ReadMe files were not read in this job (VizieR is
  degraded). `[T-CDS-HOME]`
