# OpenAI portal review — 6 October 2026

Business verification is approved for Zodiacs LLC. The daily identity monitor is paused.
This approval is separate from plugin-directory approval.

The [Zodiacs draft](https://platform.openai.com/plugins/manage/plugin_asdk_app_6ac51614dd288191b38dd3b9c0cf191e?tab=details&version=appsub_6ac51614dd548191b711404446f2c323) was created under the verified Business identity in the
Personal organization / Default project. Plugin ID:
plugin_asdk_app_6ac51614dd288191b38dd3b9c0cf191e.

## Package and automated findings

Sky **0.3.3** is uploaded to the existing draft. Its SHA-256 is
11a965dd8c3e761a3c5fcd204342fb8b4dc9c3bda4b1199640bbed76d72c7eab. The portal rejected the earlier Lifestyle category.
Education & Research is supported by the current [submission-error reference](https://developers.openai.com/plugins/deploy/submission-errors#listing-and-interface-errors)
and fits public-sky exploration and reproducible calculations. The category finding
is now cleared. A local package guard checks supported categories for both plugins.

The explore-the-sky skill shows **Checks passed**. All **five positive** and
**three negative** review cases show complete. Release notes are imported.
Country availability shows all supported countries; no availability edit was made.
The icon, Zodiacs LLC, official website, support, privacy and terms fields imported.

The remaining privacy finding says the automated assessment could not be completed
and permits submission for additional review. The public privacy page returned HTTP
200. This is not a finding that the policy passed, and no compliance claim is made.

## Connection and remaining review work

The draft retains the stable public URL https://zodiacs.org/mcp with No Auth.
The public health endpoint and domain-challenge URL both returned HTTP 404.
Production is deployment dpl_8PHCE8ArZ72uLZJK8yENdXjL9ebP on main
3e81989ca7ed07588e21c8a6e7907f9f4ba44e18; the tested PR candidate has not been
promoted or merged by this work.

The portal supplied an exact domain challenge. It is prepared in the task's private
work/submission-domain/ directory, without an added newline. No existing challenge
was overwritten. Deployment must return HTTP 200 and plain text at
https://zodiacs.org/.well-known/openai-apps-challenge. The server must be reachable
before connection, tool discovery and automated tool findings can be evaluated.
The temporary authenticated Watch host is not a substitute for this public URL.

The walkthrough URL remains empty. Record and verify the current public candidate's
five/three scenarios before attaching a recording; the historical rc.15 reel is not
current evidence. OpenAI's portal explicitly reports this missing material.

Status: **not submitted / not published**. Domain verification and tool scan are
incomplete. No policy attestations, paid upgrades, production activation or merge
were performed. Developer 0.3.2 remains a local stdio package; private Watch profiles
remain separate. Consenting human feedback for the 9/10 target is still absent.

## Verification

The AI build, package and package-contract checks passed. Runtime bundles
were unchanged; this release corrects listing metadata and adds a category guard.
The prior full CI result applies to source ede0cb6c6427baab816bbcd5ae0a625d7c173f5b.
