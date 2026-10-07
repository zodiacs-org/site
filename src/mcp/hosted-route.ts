/**
 * The names the hosted sky MCP endpoint (https://zodiacs.org/api/v1/mcp) is
 * reached and switched by. vercel.json rewrites to MCP_ROUTE_PARAM, and
 * api/compatibility.ts repeats it literally to keep its branch small;
 * tests/api/mcp-remote-vercel.test.ts holds the three equal. Every name here
 * differs from those of pull request #618's server at /mcp, which keeps its own
 * (__zodiacs_ai, ZODIACS_MCP_ENABLED, ZODIACS_MCP_STAGING_HOST).
 */

/** The query parameter vercel.json's /mcp rewrites add. */
export const MCP_ROUTE_PARAM = '__zodiacs_mcp';

/** Its two values: the protocol endpoint, and the health check. */
export const MCP_ROUTES = Object.freeze({ protocol: '1', health: 'health' } as const);

/** The public address of the endpoint, as hosts and registries name it. */
export const MCP_URL = 'https://zodiacs.org/api/v1/mcp';

/**
 * `ZODIACS_SKY_MCP_ENABLED=1` turns the endpoint on; unset or any other value
 * leaves it off. The opposite default from COMPUTE_API_ENABLED on purpose:
 * the endpoint ships dark and is switched on only after its preview has been
 * seen.
 */
export const MCP_SWITCH_ENV = 'ZODIACS_SKY_MCP_ENABLED';

/**
 * One exact preview hostname the endpoint also answers on, set by an
 * administrator for a preview deployment. Never derived from a header.
 */
export const MCP_STAGING_HOST_ENV = 'ZODIACS_SKY_MCP_STAGING_HOST';
