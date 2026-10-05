# Engine API reference

**@zodiacs/engine {{VERSION}}**, generated from the declarations in the exact
released package. [Engine overview and limitations](/developers/engine/#limits)
· [Support matrix](/developers/support/)

Browse the [module index](/developers/engine/reference/modules.html) for
exported functions, parameter and return types, and
the release's own documentation comments. The **engine** module is the root
`@zodiacs/engine` import. Other module names are import subpaths, for example
`@zodiacs/engine/calc`. This reference includes `/crossings` and `/deltat`,
which are public standalone imports as well as root re-exports.
`/internal` and `/internal/math` are site compatibility entries outside the
public API promise, may change without notice, and are deliberately excluded.

This is a release candidate. Signatures describe the implementation, not proof
of accuracy or event-search completeness. Keep the limitations and failed or
partial measurements in the [engine overview](/developers/engine/#accuracy),
[release README](/developers/engine/reference/release/README.txt) and
[pinned source documentation]({{SOURCE}}/docs) alongside this reference.
The release README is preserved verbatim as a historical document; its registry
availability statements describe the release's original snapshot. See the
[installation record](/developers/engine/#install) for the site's verified
publication state.

## Source and licences

Source: [{{COMMIT}}]({{SOURCE}}). Distribution: [immutable rc16 archive]({{ARCHIVE}}).
Archive SHA-256: `{{SHA256}}`.

The distribution's licence expression is **MIT AND CC-BY-4.0**: both apply.
Keep the unchanged [LICENSE](/developers/engine/reference/release/LICENSE.txt),
[LICENSING.md](/developers/engine/reference/release/LICENSING.txt) and [NOTICE](/developers/engine/reference/release/NOTICE.txt).
`LICENSING.md` preserves the release's authority condition and unsettled data
terms; this reference does not resolve them. NOTICE includes Astronomy Engine
by Don Cross, the ΔT data attribution and the other named sources.

Documentation comments come from the released Zodiacs engine declarations.
The site generates this reference with TypeDoc; no individual human author or
reviewer is asserted. TypeDoc’s generated presentation is covered by its
[Apache-2.0 licence](/developers/engine/reference/release/TYPEDOC-LICENSE.txt). [Editorial policy](/about/#editorial-system).
[Machine-readable provenance and API inventory](/developers/engine/reference/provenance.json).
