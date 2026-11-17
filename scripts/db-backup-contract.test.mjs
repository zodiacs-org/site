import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('database backup and restore contract', () => {
  it('keeps credentials off argv and preserves snapshot, ACL, and atomic restore semantics', async () => {
    const [
      exporter,
      restore,
      workflow,
      manifest,
      acceptance,
      prelude,
      authBoundary,
      authColumns,
      manifestInit,
      manifestSnapshot,
      publicSchemaAcl,
      finalGuard,
      targetAuthState,
    ] = await Promise.all([
      readFile(resolve(root, 'scripts/export-db-backup.sh'), 'utf8'),
      readFile(resolve(root, 'scripts/restore-db-backup.sh'), 'utf8'),
      readFile(resolve(root, '.github/workflows/db-backup.yml'), 'utf8'),
      readFile(resolve(root, 'scripts/db-backup-manifest.sql'), 'utf8'),
      readFile(resolve(root, 'scripts/db-restore-acceptance.sql'), 'utf8'),
      readFile(resolve(root, 'scripts/db-restore-prelude.sql'), 'utf8'),
      readFile(resolve(root, 'scripts/db-auth-durable-state-guard.sql'), 'utf8'),
      readFile(resolve(root, 'scripts/db-auth-column-contract.sql'), 'utf8'),
      readFile(resolve(root, 'scripts/db-backup-manifest-init.sql'), 'utf8'),
      readFile(resolve(root, 'scripts/db-backup-manifest-snapshot.sql'), 'utf8'),
      readFile(resolve(root, 'scripts/db-backup-public-schema-acl-snapshot.sql'), 'utf8'),
      readFile(resolve(root, 'scripts/db-restore-final-guard.sql'), 'utf8'),
      readFile(resolve(root, 'scripts/db-auth-restore-target-state-guard.sql'), 'utf8'),
    ]);

    expect(exporter).toContain('--pinentry-mode loopback');
    expect(exporter).toContain('--passphrase-fd 3');
    expect(exporter).not.toMatch(/--passphrase(?:=|\s)/u);
    expect(exporter).toContain('--snapshot="${backup_snapshot}"');
    expect(exporter.match(/--snapshot="\$\{backup_snapshot\}"/gu)).toHaveLength(3);
    expect(exporter).toContain('--set "backup_snapshot=${backup_snapshot}"');
    expect(exporter).toContain("private|living_chart_private)");
    expect(exporter).toContain('"${backup_schema_args[@]}"');
    expect(exporter).toContain('--schema=supabase_migrations');
    expect(exporter).not.toContain('--no-owner');
    expect(exporter).not.toContain('--no-privileges');
    expect(exporter).toContain('${BACKUP_PASSPHRASE:-}');
    expect(exporter.match(/--no-password/gu)?.length).toBeGreaterThanOrEqual(6);
    expect(exporter).not.toMatch(/pg_dump\s+["']?\$\{?(?:SUPABASE_DB_URL|PG_CLIENT_URL)/u);
    expect(exporter).not.toMatch(/^\s*coproc\b/mu);
    expect(exporter).not.toMatch(/exec \{[^}]+\}/u);
    expect(exporter).toContain('GNU tar is required');
    expect(exporter).toContain('db-backup-auth-boundary-snapshot.sql');
    expect(exporter).toContain('db-backup-public-schema-acl-snapshot.sql');
    expect(exporter).toContain('public-schema-acl.sql');
    expect(exporter).toContain('sequence-state');
    expect(exporter).toContain('pg_catalog.setval');
    expect(exporter).toContain('PGHOST PGPORT PGDATABASE PGUSER PGSSLMODE PGPASSFILE');
    expect(exporter).toContain('require|verify-ca|verify-full');
    expect(exporter).toContain('PGSSLMODE must require TLS');
    expect(exporter).toContain('between 32 and 1024 bytes');
    expect(exporter).toContain('must contain exactly one line');

    expect(restore).toContain('--pinentry-mode loopback');
    expect(restore).toContain('--passphrase-fd 3');
    expect(restore).not.toMatch(/--passphrase(?:=|\s)/u);
    expect(restore).toContain('production_project_ref="mftpcdpttteuwbolobye"');
    expect(restore).toContain('--single-transaction');
    expect(restore).toContain('--set ON_ERROR_STOP=1');
    expect(restore.match(/--no-password/gu)).toHaveLength(2);
    expect(restore).toContain('-X');
    expect(restore.indexOf('--file="auth-users.sql"')).toBeLessThan(
      restore.indexOf('--file="auth-identities.sql"'),
    );
    expect(restore.indexOf('--file="auth-identities.sql"')).toBeLessThan(
      restore.indexOf('--file="application-data.sql"'),
    );
    expect(restore).toContain('every restored user must reauthenticate');
    expect(restore).not.toContain('mapfile');
    expect(restore).not.toMatch(/\$\{[^}]+,,\}/u);
    expect(restore).toContain('GNU tar is required');
    expect(restore).toContain('--file="public-schema-acl.sql"');
    expect(restore).toContain('--file="${restore_script_dir}/db-restore-final-guard.sql"');
    expect(restore.indexOf('db-restore-final-guard.sql')).toBeLessThan(
      restore.indexOf('db-restore-prelude.sql'),
    );
    expect(manifest).toContain("'private', 'living_chart_private', 'supabase_migrations'");
    expect(manifest).toContain("'application-content|'");
    expect(manifest).toContain("'sequence-state|'");
    expect(manifest).toContain("'sequence-definition|'");
    expect(manifest).toContain('sequence_record.seqincrement');
    expect(manifest).toContain('default_acl.defaclnamespace = 0');
    expect(manifest).toContain("'global-default-acl|'");
    expect(manifest).toContain('db-auth-column-contract.sql');
    expect(manifest).toContain('set local search_path = pg_catalog');
    expect(manifest).toContain('pg_catalog.aclexplode');
    expect(manifest).toContain('and not trigger_record.tgisinternal');
    expect(manifest).toContain("'internal-trigger|'");
    expect(publicSchemaAcl).toContain('pg_catalog.aclexplode');
    expect(publicSchemaAcl).toContain('set role %I');
    expect(publicSchemaAcl).toContain('reset role;');
    expect(finalGuard).toContain('lock table auth.users, auth.identities in access exclusive mode');
    expect(finalGuard).toContain('Final fresh-project guard');
    expect(finalGuard).toContain('db-auth-durable-state-guard.sql');
    expect(finalGuard).toContain('db-auth-restore-target-state-guard.sql');
    expect(acceptance).toContain('db-auth-restore-target-state-guard.sql');
    expect(targetAuthState).toContain("relation.relname not in (");
    expect(targetAuthState).toContain("'schema_migrations'");
    expect(targetAuthState).toContain("'instances'");
    expect(targetAuthState).toContain('Fresh-project guard refused residual excluded Auth state');
    expect(acceptance).toContain('requires an uninitialized migration ledger');
    expect(acceptance).toContain('Auth column contract is incompatible');
    expect(acceptance).toContain('global default ACLs differ');
    expect(acceptance).toContain('Restore manifest category % differs');
    expect(authBoundary).toContain("'mfa_factors'");
    expect(authBoundary).toContain("'webauthn_credentials'");
    expect(authBoundary).toContain("'sso_providers'");
    expect(authBoundary).toContain("'sso_domains'");
    expect(authBoundary).toContain("'saml_providers'");
    expect(authBoundary).toContain("'custom_oauth_providers'");
    expect(authBoundary).toContain("'oauth_clients'");
    expect(authBoundary).toContain("'oauth_consents'");
    expect(authColumns).toContain("relation.relname in ('users', 'identities')");
    expect(manifestInit).toContain('create temporary table zodiacs_backup_manifest');
    expect(manifestInit).toContain('create temporary table zodiacs_application_owners');
    expect(manifestInit).toContain('create temporary table zodiacs_auth_column_contract');
    expect(manifest).not.toMatch(/create temporary table/iu);
    expect(authColumns).not.toMatch(/create temporary table/iu);
    expect(manifestSnapshot.indexOf('db-backup-manifest-init.sql')).toBeLessThan(
      manifestSnapshot.indexOf('begin isolation level repeatable read read only'),
    );
    expect(prelude).not.toMatch(/\bcascade\b/iu);
    expect(prelude).not.toMatch(/create schema public/iu);

    expect(workflow).toContain('bash scripts/export-db-backup.sh');
    expect(workflow).not.toMatch(/pg_dump\s+["']?\$SUPABASE_DB_URL/u);
    expect(workflow).not.toMatch(/--passphrase(?:=|\s)/u);
    expect(workflow).toContain('between 32 and 1024 random bytes');

    for (const wrapper of ['export-db-backup.sh', 'restore-db-backup.sh']) {
      const syntax = spawnSync('/bin/bash', ['-n', resolve(root, 'scripts', wrapper)], {
        encoding: 'utf8',
      });
      expect(syntax.status, syntax.stderr).toBe(0);
    }
  });

  it('selects PostgreSQL 17 over a newer runner default for this and later steps', async () => {
    const workflow = await readFile(resolve(root, '.github/workflows/db-backup.yml'), 'utf8');
    const selection = workflow.slice(workflow.indexOf('          export PATH="/usr/lib/postgresql/17/bin:'), workflow.indexOf('          gpg --version'));
    expect(selection).toContain('>> "$GITHUB_PATH"');
    expect(selection).toContain('for client in pg_dump pg_restore psql; do');
    const directory = await mkdtemp(resolve(tmpdir(), 'zodiacs-pg17-selection-'));
    const pinned = resolve(directory, 'pg17');
    const defaults = resolve(directory, 'default');
    const githubPath = resolve(directory, 'github-path');
    await mkdir(pinned);
    await mkdir(defaults);
    for (const client of ['pg_dump', 'pg_restore', 'psql']) {
      for (const [bin, version] of [[pinned, '17.12'], [defaults, '18.6']]) {
        await writeFile(resolve(bin, client), `#!/bin/sh\necho '${client} (PostgreSQL) ${version}'\n`, { mode: 0o700 });
      }
    }
    const env = { PATH: `${defaults}:/usr/bin:/bin`, GITHUB_PATH: githubPath };
    const result = spawnSync('/bin/bash', ['-euo', 'pipefail', '-c', selection.replaceAll('/usr/lib/postgresql/17/bin', pinned)], { encoding: 'utf8', env });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.match(/17\.12/gu)).toHaveLength(3);
    expect(result.stdout).not.toContain('18.6');
    expect(await readFile(githubPath, 'utf8')).toBe(`${pinned}\n`);
    const nextStep = spawnSync('/bin/bash', ['-c', 'pg_dump --version; pg_restore --version; psql --version'], {
      encoding: 'utf8', env: { PATH: `${(await readFile(githubPath, 'utf8')).trim()}:${env.PATH}` },
    });
    expect(nextStep.status, nextStep.stderr).toBe(0);
    expect(nextStep.stdout.match(/17\.12/gu)).toHaveLength(3);
  });

  it('rejects weak and multiline backup passphrases before any database access', async () => {
    async function runExporter(passphrase) {
      const directory = await mkdtemp(resolve(tmpdir(), 'zodiacs-backup-passphrase-'));
      const binDirectory = resolve(directory, 'bin');
      const passphraseFile = resolve(directory, 'passphrase');
      await mkdir(binDirectory);
      await writeFile(passphraseFile, passphrase, { mode: 0o600 });

      for (const command of ['pg_dump', 'pg_restore', 'psql', 'gpg', 'mkfifo']) {
        await writeFile(resolve(binDirectory, command), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
      }
      await writeFile(
        resolve(binDirectory, 'gtar'),
        '#!/bin/sh\necho "GNU tar 1.35"\n',
        { mode: 0o700 },
      );

      return spawnSync('/bin/bash', [resolve(root, 'scripts/export-db-backup.sh')], {
        encoding: 'utf8',
        env: {
          PATH: `${binDirectory}:${process.env.PATH}`,
          LC_ALL: 'C',
          BACKUP_OUTPUT_DIR: directory,
          BACKUP_PASSPHRASE_FILE: passphraseFile,
        },
      });
    }

    const weak = await runExporter('one-byte-is-still-weak\n');
    expect(weak.status).not.toBe(0);
    expect(weak.stderr).toContain('between 32 and 1024 bytes');
    expect(weak.stderr).not.toContain('one-byte-is-still-weak');

    const multiline = await runExporter(`${'A'.repeat(32)}\nsecond-line-secret\n`);
    expect(multiline.status).not.toBe(0);
    expect(multiline.stderr).toContain('must contain exactly one line');
    expect(multiline.stderr).not.toContain('second-line-secret');
  });

  it('converts a protected URL file into mode-0600 libpq files', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'zodiacs-pg-client-'));
    const urlFile = resolve(directory, 'url');
    const passfile = resolve(directory, 'pgpass');
    const envFile = resolve(directory, 'env');
    await writeFile(
      urlFile,
      'postgresql://postgres.test:dummy%3Avalue@db.test.supabase.co:5432/postgres?sslmode=require\n',
      { mode: 0o600 },
    );

    const result = spawnSync(
      process.execPath,
      [resolve(root, 'scripts/configure-pg-client.mjs')],
      {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          PG_CLIENT_URL_FILE: urlFile,
          PGPASSFILE: passfile,
          PG_CLIENT_ENV_FILE: envFile,
        },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(passfile, 'utf8')).toBe(
      'db.test.supabase.co:5432:postgres:postgres.test:dummy\\:value\n',
    );
    expect((await stat(passfile)).mode & 0o777).toBe(0o600);
    expect((await stat(envFile)).mode & 0o777).toBe(0o600);
    expect(await readFile(envFile, 'utf8')).not.toContain('dummy');
  });

  it('rejects a decoded newline in the password', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'zodiacs-pg-client-newline-'));
    const urlFile = resolve(directory, 'url');
    await writeFile(
      urlFile,
      'postgresql://postgres.test:dummy%0Ainjected@db.test.supabase.co/postgres\n',
      { mode: 0o600 },
    );
    const result = spawnSync(
      process.execPath,
      [resolve(root, 'scripts/configure-pg-client.mjs')],
      {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          PG_CLIENT_URL_FILE: urlFile,
          PGPASSFILE: resolve(directory, 'pgpass'),
          PG_CLIENT_ENV_FILE: resolve(directory, 'env'),
        },
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Database password must be one line.');
    expect(result.stderr).not.toContain('dummy');
  });

  it('rejects database URLs that permit plaintext or opportunistic TLS', async () => {
    for (const sslmode of ['disable', 'allow', 'prefer']) {
      const directory = await mkdtemp(resolve(tmpdir(), `zodiacs-pg-client-${sslmode}-`));
      const urlFile = resolve(directory, 'url');
      await writeFile(
        urlFile,
        `postgresql://postgres.test:top-secret@db.test.supabase.co/postgres?sslmode=${sslmode}\n`,
        { mode: 0o600 },
      );
      const result = spawnSync(
        process.execPath,
        [resolve(root, 'scripts/configure-pg-client.mjs')],
        {
          encoding: 'utf8',
          env: {
            PATH: process.env.PATH,
            PG_CLIENT_URL_FILE: urlFile,
            PGPASSFILE: resolve(directory, 'pgpass'),
            PG_CLIENT_ENV_FILE: resolve(directory, 'env'),
          },
        },
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Database URL must require TLS');
      expect(result.stderr).not.toContain('top-secret');
    }
  });

  it('preserves certificate-verifying TLS modes for libpq', async () => {
    for (const sslmode of ['verify-ca', 'verify-full']) {
      const directory = await mkdtemp(resolve(tmpdir(), `zodiacs-pg-client-${sslmode}-`));
      const urlFile = resolve(directory, 'url');
      const envFile = resolve(directory, 'env');
      await writeFile(
        urlFile,
        `postgresql://postgres.test:dummy@db.test.supabase.co/postgres?sslmode=${sslmode}\n`,
        { mode: 0o600 },
      );
      const result = spawnSync(
        process.execPath,
        [resolve(root, 'scripts/configure-pg-client.mjs')],
        {
          encoding: 'utf8',
          env: {
            PATH: process.env.PATH,
            PG_CLIENT_URL_FILE: urlFile,
            PGPASSFILE: resolve(directory, 'pgpass'),
            PG_CLIENT_ENV_FILE: envFile,
          },
        },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(await readFile(envFile, 'utf8')).toContain(`export PGSSLMODE='${sslmode}'`);
    }
  });

  it('makes same-count content and sequence tampering change acceptance records', () => {
    function foldedDigest(rows) {
      let digest = createHash('sha256')
        .update('zodiacs-application-content-v1')
        .digest();
      const rowHashes = rows
        .map((row) => createHash('sha256').update(row).digest())
        .sort(Buffer.compare);
      for (const rowHash of rowHashes) {
        digest = createHash('sha256').update(Buffer.concat([digest, rowHash])).digest();
      }
      return digest.toString('hex');
    }

    const sourceRows = ['{"id":1,"digest_opt_in":true}', '{"id":2,"digest_opt_in":true}'];
    const tamperedRows = ['{"id":1,"digest_opt_in":false}', '{"id":2,"digest_opt_in":true}'];
    expect(tamperedRows).toHaveLength(sourceRows.length);
    expect(foldedDigest(tamperedRows)).not.toBe(foldedDigest(sourceRows));

    const sourceSequence = 'sequence-state|public.events_id_seq|42|t';
    const tamperedSequence = 'sequence-state|public.events_id_seq|41|t';
    expect(tamperedSequence).not.toBe(sourceSequence);
  });

  it('redacts malformed password-bearing URL input from errors', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'zodiacs-pg-client-invalid-'));
    const urlFile = resolve(directory, 'url');
    await writeFile(urlFile, 'not-a-url-top-secret-password\n', { mode: 0o600 });
    const result = spawnSync(
      process.execPath,
      [resolve(root, 'scripts/configure-pg-client.mjs')],
      {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          PG_CLIENT_URL_FILE: urlFile,
          PGPASSFILE: resolve(directory, 'pgpass'),
          PG_CLIENT_ENV_FILE: resolve(directory, 'env'),
        },
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Database URL is invalid.');
    expect(result.stderr).not.toContain('top-secret-password');
    expect(result.stderr).not.toContain('not-a-url');
  });
});
