import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifySupabaseKey,
  distSupabaseSecretProblems,
  publicSupabaseKeyProblems,
  secretSupabaseKeysInText,
} from './lib/supabase-public-keys.mjs';

// Made-up keys, assembled at run time so no key-shaped literal sits in the repo.
const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = (claims) => `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ iss: 'supabase', ...claims })}.${'s'.repeat(43)}`;
const ANON = jwt({ role: 'anon' });
const SERVICE = jwt({ role: 'service_role' });
const NO_ROLE = jwt({ sub: 'x' });
const SECRET = ['sb', 'secret', 'Q'.repeat(32)].join('_');
const PUBLISHABLE = ['sb', 'publishable', 'Q'.repeat(32)].join('_');

describe('classifySupabaseKey', () => {
  it('passes public keys, unset values and unknown placeholders', () => {
    expect(classifySupabaseKey(undefined)).toMatchObject({ kind: 'unset', ok: true });
    expect(classifySupabaseKey('  ')).toMatchObject({ kind: 'unset', ok: true });
    expect(classifySupabaseKey(PUBLISHABLE)).toMatchObject({ kind: 'publishable', ok: true });
    expect(classifySupabaseKey(ANON)).toMatchObject({ kind: 'anon-jwt', ok: true });
    expect(classifySupabaseKey('publishable-test-key')).toMatchObject({ kind: 'other', ok: true });
  });

  it('fails secret keys and JWTs that are not anon', () => {
    expect(classifySupabaseKey(SECRET)).toMatchObject({ kind: 'secret', ok: false });
    expect(classifySupabaseKey(SERVICE)).toMatchObject({ kind: 'privileged-jwt', ok: false, role: 'service_role' });
    expect(classifySupabaseKey(NO_ROLE)).toMatchObject({ kind: 'unreadable-jwt', ok: false });
    expect(classifySupabaseKey(jwt({ role: 'x'.repeat(80) }))).toMatchObject({ ok: false, role: 'unrecognised' });
  });
});

describe('publicSupabaseKeyProblems', () => {
  it('names the variable and the kind of key, never the value', () => {
    const env = { PUBLIC_SUPABASE_PUBLISHABLE_KEY: SECRET, PUBLIC_SUPABASE_ANON_KEY: SERVICE };
    const problems = publicSupabaseKeyProblems((name) => env[name]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/^PUBLIC_SUPABASE_PUBLISHABLE_KEY is an sb_secret_ key\./u);
    expect(problems[1]).toMatch(/^PUBLIC_SUPABASE_ANON_KEY is a JWT with role "service_role"/u);
    for (const problem of problems) {
      expect(problem).not.toContain(SECRET.slice(10));
      expect(problem).not.toContain(SERVICE.split('.')[1].slice(0, 12));
    }
  });

  it('is quiet for the public keys', () => {
    const env = { PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE, PUBLIC_SUPABASE_ANON_KEY: ANON };
    expect(publicSupabaseKeyProblems((name) => env[name])).toEqual([]);
    expect(publicSupabaseKeyProblems(() => undefined)).toEqual([]);
  });
});

describe('built-site scan', () => {
  it('finds secret keys in text without returning them', () => {
    expect(secretSupabaseKeysInText(`const k="${SECRET}";`)).toEqual(['an sb_secret_ key']);
    expect(secretSupabaseKeysInText(`x("${SERVICE}")`)).toEqual(['a service_role JWT']);
    expect(secretSupabaseKeysInText(`x("${ANON}", "${PUBLISHABLE}")`)).toEqual([]);
    expect(secretSupabaseKeysInText('Server keys start sb_secret_ and stay on the server.')).toEqual([]);
  });

  it('reports the file and the kind of key only', async () => {
    const dist = await mkdtemp(join(tmpdir(), 'zodiacs-dist-keys-'));
    try {
      await mkdir(join(dist, '_astro'));
      await writeFile(join(dist, '_astro', 'client.js'), `export const k="${SERVICE}";`);
      await writeFile(join(dist, 'index.html'), `<script>var k="${ANON}"</script>`);
      await writeFile(join(dist, 'image.png'), SECRET);
      const problems = await distSupabaseSecretProblems(dist);
      expect(problems).toEqual([`${join('_astro', 'client.js')} carries a service_role JWT; it must never be in the built site.`]);
    } finally {
      await rm(dist, { recursive: true, force: true });
    }
  });
});
