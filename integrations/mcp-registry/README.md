# Official MCP Registry entry

Zodiacs is listed in the official MCP Registry as `io.github.zodiacs-org/zodiacs`:
https://registry.modelcontextprotocol.io/v0/servers?search=zodiacs

`server.json` is the entry as published on 8 November 2026, version 0.6.6.
Its title, one-line description and icon are the ones approved for the Claude
directory listing, and it points to the live server at https://zodiacs.org/mcp.
Apps and catalogues that read the registry can pick it up from there.

## Updating it

A version can be published only once. When the server's version changes, set
`version` here to match `src/ai-tools`, then publish again with the owner's yes:

```sh
brew install mcp-publisher
cd integrations/mcp-registry
mcp-publisher validate
mcp-publisher login github   # the owner enters GitHub's one-time code as zodiacs-org
mcp-publisher publish
mcp-publisher logout
```
