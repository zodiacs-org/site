# Directory rules read for the dry run

Every page below was fetched in this job on 11 November 2026, between 15:57 and
15:58 UTC, with curl (no sign-in), except the OpenAI review requirements page, which
the first pass missed and the fix round fetched on 13 November 2026. The rule lines quoted in `REPORT.md` are copied
from these fetches, not from an earlier review. The full copies are kept outside
the repository, in the job's scratch folder (they are other publishers' pages); the SHA-256 is of the bytes as served, so a later reader can
tell whether a page has changed since.

| Short name | Address fetched | SHA-256 of the served bytes |
|---|---|---|
| Anthropic policy | https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy (page says "Updated over 2 weeks ago") | `d0b3c0b6089fddf60f4392134bd3f0554e9e4c663d7abf1b258ec9b5bbabf9e9` |
| Anthropic checklist | https://claude.com/docs/connectors/building/review-criteria.md ("Connector pre-submission checklist") | `41d6a8a79c32d1105fc0b14190a2016bb21becf98b9538cae500428f1d467bc1` |
| Anthropic submission | https://claude.com/docs/connectors/building/submission.md | `81a8058b886d57ae1350d95cf45d34f549a8eef56e8c9bf135a2fbdcbd617c03` |
| Anthropic after publishing | https://claude.com/docs/connectors/building/after-publishing.md | `883d3181b8b8caf23bc3c047cf3e4c47acb4d000c5cb46ed848a6e43b9424dd9` |
| Anthropic listing edits | https://claude.com/docs/connectors/building/managing-your-listing.md | `f947b716119c080303e85f8cfa02f557e8b2b3a8c7cbd426d81ea3c2800460a3` |
| Anthropic verification | https://claude.com/docs/connectors/verification.md | `c2a026363d8cb442018f13169c4802e4cd236b937150dd7d061b000868a3b67a` |
| Anthropic docs index | https://claude.com/docs/llms.txt | `a6afb58b8f46a5884f693a13fa261329db0c4916dbe29da887d693d8c6bec4ff` |
| OpenAI guidelines | https://developers.openai.com/apps-sdk/app-submission-guidelines, which now redirects to https://developers.openai.com/plugins/plugin-guidelines ("Plugin guidelines") | `4d1e22c59fd2fe663c44ee7ab37ddc8061abf8e707a8d20971629dd9462a6497` |
| OpenAI submission | https://developers.openai.com/apps-sdk/deploy/submission, which now redirects to https://developers.openai.com/plugins/deploy/submission | `1186c96b154c72806a9eb50e66675e39ee5766790639436ee585a281478bbcdb` |
| OpenAI review requirements | https://developers.openai.com/plugins/deploy/app-review ("Remote MCP server review requirements"), fetched in the fix round on 13 November 2026 at 04:04 UTC | `c76f013098591330f6a6e0a627eb3f13376d2659802b4e7192559619f7010dd8` |
| MCP Registry quickstart | https://raw.githubusercontent.com/modelcontextprotocol/registry/main/docs/modelcontextprotocol-io/quickstart.mdx | `e4041720b593caffdeb51d12e3e72efe0e4d5ced6b7c1dbc84a8ca81b35024b4` |
| MCP Registry authentication | the same folder, `authentication.mdx` | `d49ab361f60e3074f7a5f3cb117cac9c0c1c148fe4c55bf8cd9559d43010f85f` |
| MCP Registry moderation | the same folder, `moderation-policy.mdx` | `057a158e103754e1403f1d77924ce933cb70e18bf07b152c72af0c7d7bba560a` |

The three OpenAI pages and the Anthropic policy page are HTML, so their digests
differ on a refetch even if the rules have not changed (the second session's fetch
of the policy page had another digest and the same text); compare the quoted lines
instead.

## The rule lines the report cites

Each has a label used in `REPORT.md`. Quotations are exact.

### Anthropic Software Directory Policy

- **A-1D** (1.D): "Software must prioritize protecting user privacy and the privacy interests of third parties."
- **A-1E** (1.E): "Software must only collect data from the user’s context that is necessary to perform their function."
- **A-2A** (2.A): "Instructional Software must define each tool or capability through narrow, unambiguous natural language that specifies what it does and when it should be invoked."
- **A-2B** (2.B): "Instructional Software tool or capability descriptions must precisely match actual functionality, ensuring the Instructional Software is called at correct and appropriate times. Descriptions must not include unexpected functionality or promise undelivered features."
- **A-2D** (2.D): "Instructional Software must not intentionally call or coerce Claude into calling other external software, tools, databases, or resources unless requested and intended by a user."
- **A-3A** (3.A): "Developers of Software that collects user data or connects to a remote service must provide a clear, accessible privacy policy link explaining data collection, usage, and retention."
- **A-3B** (3.B): "Developers must provide verified contact information and support channels for users with product or security concerns."
- **A-3C** (3.C): "Developers must document how their Software works, its intended purpose, and how users can troubleshoot issues."
- **A-3E** (3.E): "Developers must provide at least three working examples of prompts or use cases that demonstrate core functionality."
- **A-3H** (3.H): "Developers must notify Anthropic of material changes to their Software’s functionality, tool or capability descriptions, data practices, or connected endpoints after inclusion in a Directory. Material changes may be subject to re-review."
- **A-4A** (4.A): "Software that transfers money or other financial assets, or executes financial transactions autonomously on behalf of users, without human-in-the-loop safeguards. We do not generally allow cryptocurrency software in our directory."
- **A-4C** (4.C): "Software that serves advertisements, sponsored content, paid product placements, or exists primarily as an advertising or promotional vehicle."
- **A-5A** (5.A): "MCP servers must gracefully handle errors and provide helpful feedback rather than generic error messages."
- **A-5B** (5.B): "MCP servers must be frugal with their use of tokens. The amount of tokens a given tool call uses should be roughly commensurate with the complexity or impact of the task. When possible, users should be given options to exclude unnecessary text in the response."
- **A-5C** (5.C): "MCP tool names must not exceed 64 characters."
- **A-5E** (5.E): "MCP servers must provide all applicable annotations for their tools, in particular readOnlyHint, destructiveHint, and title."

### Anthropic connector pre-submission checklist

- **AC-desc** ("Write narrow, accurate descriptions"): "Each tool description should state precisely what the tool does and when to invoke it. The description must match the tool's actual behavior."
- **AC-inject** ("Avoid prompt-injection patterns"): "Describe what the tool does, and don't tell Claude how to behave. Tool descriptions are rejected if they:" followed by five items, of which the report uses the first, "Instruct Claude to call external software or tools the user didn't request", and the fifth, "Tell Claude to behave in ways unrelated to the tool's function, attempt to override system instructions, or promote products and services".
- **AC-quality** ("Functional quality"): "Every tool must return a successful response when called with valid parameters, and generic errors such as "Internal Server Error" or "Bad Request" with no detail fail review" and "Validate inputs and return actionable error messages rather than silently accepting invalid data".
- **AC-size** ("Functional quality"): "Keep responses reasonably sized for the task, and don't return a full database dump when a summary was requested".
- **AC-annot** ("Provide tool annotations"): "Every tool must include a `title` and the applicable hint: `readOnlyHint: true` for read-only tools, and `destructiveHint: true` for tools that modify or delete data."
- **AC-docs** ("Gather what to include with your submission"): "Public documentation: required by your publish date."

### Anthropic submission and listing pages

- **AS-docs** (submission, "Requirements for every connector"): "Documentation: provide clear setup and usage instructions".
- **AS-listing** (submission, step 3): the listing takes a "documentation URL, privacy policy URL, support contact".
- **AS-update** (after publishing): "To add, change, or remove tools, deploy the change to your server. The tool names shown on your directory listing are part of the listing details, so update them with a listing edit, which a reviewer approves."

### OpenAI plugin guidelines

- **O-appropriate** ("Appropriateness"): plugins "must be suitable for general audiences, including users aged 13" to "17" (the page writes the range with a dash) and "Plugins may not explicitly target children under 13."
- **O-intent** ("Respect user intent"): "Provide experiences that directly address the user’s request. Do not insert unrelated content, attempt to redirect the interaction, or collect data beyond what is reasonably necessary to fulfill the user’s request and what is consistent with your privacy policy."
- **O-quality** ("Quality and reliability"): "Results should be accurate and relevant to user input. Errors, including unexpected ones, must be handled with clear messaging or fallback behaviors."
- **O-names** ("Clear and accurate tool names"): "Tool names should be human-readable, specific, and descriptive of what the tool actually does."
- **O-desc** ("Descriptions that match behavior"): "Each tool must have a nonempty description that explicitly and accurately explains its purpose and behavior, when to use it, and any relevant limitations or side effects. Descriptions must match the tool’s schema and actual behavior."
- **O-independent** ("Tool independence and exposure"): "Each public tool must operate independently. Do not instruct the model to invoke another plugin or connector to complete its operation; implement required dependencies within your plugin."
- **O-annot** ("Correct annotation"): "Set readOnlyHint, destructiveHint, and openWorldHint to explicit boolean values (true or false) in each tool’s annotations object."
- **O-location** ("Tool data handling"): "Avoid requesting raw location fields (for example, city or coordinates) in your input schema."
- **O-minimal** ("Tool data handling"): "Tool responses must return only data that is directly relevant to the user’s request and the tool’s stated purpose. Do not include diagnostic, telemetry, or internal identifiers" (the sentence goes on to list session, trace and request IDs, timestamps and logging metadata) "unless they are strictly required to fulfill the user’s query."
- **O-privacy** ("Privacy policy"): "Plugin submissions must include a clear, published privacy policy explaining, at minimum, the categories of personal data collected, the purposes of use, the categories of recipients, data retention timelines, and any controls offered to your users."
- **O-support** ("Support contact details"): "You must provide customer support contact details where end users can reach you for help. Keep this information accurate and up to date."
- **O-ads** ("Advertising"): "Plugins must not serve advertisements and must not exist primarily as an advertising vehicle."
- **O-crypto** (prohibited services, which a plugin may not "sell, promote, facilitate, or meaningfully enable"): "Crypto or NFT offerings involving speculation, consumer deception, or financial abuse".
- **O-update** (submission page, "Update to your MCP server"): "After initial publication, OpenAI scans your hosted MCP server daily. Eligible updates become available after automated checks pass" and "New tools remain unavailable until approved; existing tools retain their previously approved metadata when an update is held."

### OpenAI "Remote MCP server review requirements"

- **OR-scan** ("Metadata stored during tool scanning"): "When you select Scan Tools, the dashboard imports metadata advertised by your MCP endpoint into the draft. This includes tool names, titles, and descriptions; input and output schemas; security schemes; _meta fields; tool annotations; linked UI resource metadata, including CSP settings; and MCP server instructions."
- **OR-extraneous** (common rejection reasons): "Ensure that the returned textual output closely adheres to the user’s request, and does not offer extraneous information that is irrelevant to the request, including personal identifiers."
- **OR-audit** (the same list): "Ensure tools return only what’s strictly necessary for the user’s request and remove any unnecessary PII, telemetry/internal identifiers (for example, session, trace, or request IDs; timestamps; internal account IDs; or logs) and any auth secrets (tokens, keys, or passwords)."

### MCP Registry

The connector is not published in the MCP Registry, so none of its rules is tested
here. For the record: a server name under a domain must be in the reverse-DNS form
of that domain and the publisher must prove control of it by DNS or HTTP
(`authentication.mdx`), and the registry removes only "illegal content, malware,
spam, and completely broken servers" (`moderation-policy.mdx`).
