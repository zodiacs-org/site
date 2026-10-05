# Zodiacs profile metadata — 5 October 2026

Eight custom ChatGPT profiles were updated to version 1.0.1 and their visible
profile pages verified: Shared Sky (Private Trial), Shared Sky, Staging Review,
Staging Final, Staging Acceptance, Staging Patched, Staging Verified and Staging
October 5. The latter remains Connected.

Each now includes the official website, Zodiacs LLC developer identity, company
and support contact, privacy policy, terms, calculation documentation, branded
plugin icons, capabilities and starter prompts. Descriptions distinguish shared
snapshots, historical previews and current private staging. No verified-publisher
badge, tester endorsement, public listing or OpenAI approval is claimed.

Official company/contact information: https://zodiacs.org/about/
Website: https://zodiacs.org/
Support: admin@zodiacs.org
Documentation: https://zodiacs.org/developers/
Privacy: https://zodiacs.org/privacy/
Terms: https://zodiacs.org/terms/
These destinations returned HTTP 200 on 5 October 2026.

## Packages and remaining cloud profile

Both source packages and local installed plugins are refreshed to 0.1.1.
`npm run ai:check` passes. The Sky homepage previously pointed to
`https://zodiacs.org/developers/ai/`, which returns 404; it now points to the
homepage. Developer retains the valid developer documentation URL.

The original portable cloud profile named **Zodiacs** still has its old metadata.
Its web page offers only **Open in desktop app**. Computer Use blocks control of
that desktop app, so its cloud update could not be completed automatically.
Open that original profile in the desktop app and update it with
`zodiacs-sky-0.1.1.zip`. Then verify Website is https://zodiacs.org/, Developer
is Zodiacs LLC and Version is 0.1.1. The prepared archive is in `integrations/packages/`.

The eight small 1.0.1 ZIPs reference their existing ChatGPT apps. They preserve
app IDs and access. They contain metadata and icons, not preview credentials.
Underlying app-card icons on older connections may retain their original globe;
their plugin profile icons have been updated.

`integrations/packages/manifest.json` records both 0.1.1 portable archives and
member digests. Prior 0.1.0 archives remain historical evidence. Current profile
screenshots and receipts are preserved in the local review outputs. Runtime code
and MCP configurations are unchanged; complete Site Check and Browser Evidence
passed on the preceding source `c1977043bbe814f05dd12c5ac3e16ee1c36ad58e`.
That CI result does not establish checks on a later metadata commit. No submission, PR merge or production activation occurred.
