# Unpublished remote MCP Registry descriptor

`server.json` describes the existing anonymous Streamable HTTP endpoint at https://zodiacs.org/mcp. Its implementation version 0.4.0 was observed by official conformance producer [37971225643](https://github.com/zodiacs-org/site/actions/runs/37971225643); this does not create an engine or package version. The source is the site's authored `src/ai-tools/` implementation.

The proposed name `io.github.zodiacs-org/zodiacs` uses the GitHub organization namespace. Publication requires verified namespace ownership and publisher authentication. Public repository cross-links do not prove that authority. No publisher authentication, Registry write or listing is performed here.

The validation script checks this descriptor against the published 2025-12-11 JSON schema and the current draft from upstream Registry source `970df037919faa70456dde08c295473002d850e5`, using isolated, pinned AJV dependencies and five negative controls per schema. A passing generic schema does not establish official Registry acceptance, full MCP conformance or scientific accuracy. The actual producer report must be retained before citing a pass.

Official references:
- [Generic server.json format](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/docs/reference/server-json/generic-server-json.md)
- [Official Registry requirements](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/docs/reference/server-json/official-registry-requirements.md)

The six-tool Inspector observation and two official conformance scenarios remain bounded observations. Fourteen Inspector schema warnings remain recorded. Full conformance, a resolving Registry entry, affected release/staged private clearance and publication prerequisites remain open; P3.6 is unaccepted.

Actual validation [37975481986](https://github.com/zodiacs-org/site/actions/runs/37975481986), source `c3b7cd3fe6295f7ea50dad68b7e85e7860e03a0e`, passed both schemas and all five negative controls per schema on Node 22.23.3. The verified report is 4992 bytes, SHA-256 `06e86f1378c09ac1a8f62318a43c476b12a232c0d70124695dbafd5f24617b69`; the descriptor is 588 bytes, SHA-256 `778427f6d305f3eda7f35e232491a42257f295fc32d619ffe03ea4f7bd4b0b71`. This records generic schema validation only; publication and namespace ownership remain unverified.
