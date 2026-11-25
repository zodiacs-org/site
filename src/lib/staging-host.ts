/**
 * The staging site's hostname, as the administrator configured it (ZODIACS_MCP_STAGING_HOST): an exact lower-case
 * hostname, never a header-derived wildcard. The hosted MCP (src/ai-tools/http.ts) accepts calls on it and links its
 * pages and share cards there, and the share handlers (src/server/chart-preview.ts requestOrigin) build their image,
 * redirect and story addresses on it, so a share opened on the staging site stays on the staging site. Null when it
 * is unset or not a valid hostname.
 */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function configuredStagingHost(env: Readonly<Record<string, string | undefined>>): string | null {
  const host = env.ZODIACS_MCP_STAGING_HOST;
  return host && host.length <= 253 && host.includes('.') && host.split('.').every((label) => LABEL.test(label)) ? host : null;
}
