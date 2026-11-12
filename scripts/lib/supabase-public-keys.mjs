/*
 * The Supabase keys a build inlines into browser code must be public keys:
 * PUBLIC_SUPABASE_PUBLISHABLE_KEY an `sb_publishable_` key and
 * PUBLIC_SUPABASE_ANON_KEY the legacy `anon` JWT. A legacy service_role JWT
 * has the same `eyJ` shape as the anon one, and an `sb_secret_` key pasted
 * into either name would ship to every visitor. These checks name the
 * variable and the kind of key only. They never print a value, a slice of
 * one, or a decoded claim other than a short role name.
 */
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

export const PUBLIC_SUPABASE_KEY_NAMES = Object.freeze([
  'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'PUBLIC_SUPABASE_ANON_KEY',
]);

const JWT = /^[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]*$/u;
const SAFE_ROLE = /^[a-z_]{1,32}$/u;

function jwtRole(token) {
  const match = JWT.exec(token);
  if (!match) return { jwt: false };
  try {
    const claims = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
    const role = claims && typeof claims === 'object' ? claims.role : undefined;
    return { jwt: true, role: typeof role === 'string' ? role : undefined };
  } catch {
    return { jwt: true, role: undefined };
  }
}

/**
 * What kind of key a value is: 'unset', 'publishable', 'anon-jwt', 'secret',
 * 'privileged-jwt', 'unreadable-jwt' or 'other'. Only the first three may be
 * bundled; 'other' passes because it carries no known secret shape (test
 * placeholders), and Supabase rejects it anyway.
 */
export function classifySupabaseKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!key) return { kind: 'unset', ok: true };
  if (key.startsWith('sb_secret_')) return { kind: 'secret', ok: false };
  if (key.startsWith('sb_publishable_')) return { kind: 'publishable', ok: true };
  const token = jwtRole(key);
  if (!token.jwt) return { kind: 'other', ok: true };
  if (token.role === 'anon') return { kind: 'anon-jwt', ok: true };
  if (token.role === undefined) return { kind: 'unreadable-jwt', ok: false };
  return { kind: 'privileged-jwt', ok: false, role: SAFE_ROLE.test(token.role) ? token.role : 'unrecognised' };
}

/** Failure messages for the PUBLIC_SUPABASE_* values a build would inline. */
export function publicSupabaseKeyProblems(read) {
  const problems = [];
  for (const name of PUBLIC_SUPABASE_KEY_NAMES) {
    const verdict = classifySupabaseKey(read(name));
    if (verdict.ok) continue;
    const detail = verdict.kind === 'secret'
      ? 'an sb_secret_ key'
      : verdict.kind === 'privileged-jwt'
        ? `a JWT with role "${verdict.role}", not "anon"`
        : 'a JWT with no readable role';
    problems.push(`${name} is ${detail}. Browser code inlines this variable; set it to the project's publishable (or anon) key.`);
  }
  return problems;
}

const SECRET_KEY_IN_TEXT = /\bsb_secret_[A-Za-z0-9_-]{16,}/u;
const JWT_IN_TEXT = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu;

/** Kinds of secret Supabase key found in a text: never the keys themselves. */
export function secretSupabaseKeysInText(text) {
  const found = [];
  if (SECRET_KEY_IN_TEXT.test(text)) found.push('an sb_secret_ key');
  for (const match of text.matchAll(JWT_IN_TEXT)) {
    const { role } = jwtRole(match[0]);
    if (role === 'service_role' || role === 'supabase_admin') {
      found.push(`a ${role} JWT`);
      break;
    }
  }
  return found;
}

// Env values reach the site only through bundled scripts and inline page scripts.
const SCANNED = new Set(['.js', '.mjs', '.cjs', '.html']);

async function* scannedFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* scannedFiles(path);
    else if (SCANNED.has(extname(entry.name))) yield path;
  }
}

/** Failure messages for built files that carry a secret Supabase key. */
export async function distSupabaseSecretProblems(distRoot) {
  const problems = [];
  for await (const path of scannedFiles(distRoot)) {
    const kinds = secretSupabaseKeysInText(await readFile(path, 'utf8'));
    for (const kind of kinds) problems.push(`${relative(distRoot, path)} carries ${kind}; it must never be in the built site.`);
  }
  return problems;
}
