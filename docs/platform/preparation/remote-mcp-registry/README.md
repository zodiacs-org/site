# Unpublished remote MCP Registry descriptor

`server.json` describes the existing anonymous Streamable HTTP endpoint at https://zodiacs.org/mcp. Its implementation version 0.4.0 was observed by official conformance producer [37971225643](https://github.com/zodiacs-org/site/actions/runs/37971225643); this does not create an engine or package version. The source is the site's authored `src/ai-tools/` implementation.

The proposed name `io.github.zodiacs-org/zodiacs` uses the GitHub organization namespace. Publication requires verified namespace ownership and publisher authentication. Public repository cross-links do not prove that authority. No publisher authentication, Registry write or listing is performed here.

The validation script checks this descriptor against the published 2025-12-11 JSON schema and the current draft from upstream Registry source `970df037919faa70456dde08c295473002d850e5`, using isolated, pinned AJV dependencies and five negative controls per schema. A passing generic schema does not establish official Registry acceptance, full MCP conformance or scientific accuracy. The actual producer report must be retained before citing a pass.

Official references:
- [Generic server.json format](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/docs/reference/server-json/generic-server-json.md)
- [Official Registry requirements](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/docs/reference/server-json/official-registry-requirements.md)

The six-tool Inspector observation and two official conformance scenarios remain bounded observations. Fourteen Inspector schema warnings remain recorded. Full conformance, a resolving Registry entry, affected release/staged private clearance and publication prerequisites remain open; P3.6 is unaccepted.
