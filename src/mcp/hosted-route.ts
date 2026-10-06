/**
 * The few names the hosted MCP endpoint shares with api/compatibility.ts and
 * vercel.json. Kept in a module of its own so that the shared function can
 * recognise an MCP request without loading the server: everything else under
 * src/mcp/hosted-*.ts is bundled into api/_mcp/remote.mjs and loaded only
 * when one is asked for.
 */

/** The query parameter vercel.json's /mcp rewrites add. */
export const MCP_ROUTE_PARAM = '__zodiacs_mcp';

/** Its two values: the protocol endpoint, and the health check. */
export const MCP_ROUTES = Object.freeze({ protocol: '1', health: 'health' } as const);

/** The public address of the endpoint, as hosts and registries name it. */
export const MCP_URL = 'https://zodiacs.org/mcp';

/**
 * `ZODIACS_MCP_ENABLED=1` turns the endpoint on; unset or any other value
 * leaves it off. The opposite default from COMPUTE_API_ENABLED on purpose:
 * the endpoint ships dark and is switched on only after its preview has been
 * seen.
 */
export const MCP_SWITCH_ENV = 'ZODIACS_MCP_ENABLED';

/**
 * One exact preview hostname the endpoint also answers on, set by an
 * administrator for a preview deployment. Never derived from a header.
 */
export const MCP_STAGING_HOST_ENV = 'ZODIACS_MCP_STAGING_HOST';
