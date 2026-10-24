import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function availablePort(preferredPort) {
  const tryPort = (port) => new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', rejectPort);
    probe.listen(port, '127.0.0.1', () => {
      const address = probe.address();
      const selected = typeof address === 'object' && address ? address.port : port;
      probe.close(() => resolvePort(selected));
    });
  });

  try {
    return await tryPort(preferredPort);
  } catch (error) {
    if (error?.code !== 'EADDRINUSE') throw error;
    return tryPort(0);
  }
}

async function waitForPreview(baseURL, processHandle, output) {
  const deadline = Date.now() + 45_000;
  let lastError;

  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Astro preview exited with code ${processHandle.exitCode}.\n${output()}`);
    }
    try {
      const response = await fetch(baseURL, { redirect: 'manual' });
      if (response.status === 200) return;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }

  throw new Error(`Astro preview did not become ready at ${baseURL}: ${lastError ?? 'timeout'}\n${output()}`);
}

async function terminate(processHandle) {
  if (processHandle.exitCode !== null) return;
  processHandle.kill('SIGTERM');
  await Promise.race([
    new Promise((resolveExit) => processHandle.once('exit', resolveExit)),
    delay(5_000),
  ]);
  if (processHandle.exitCode === null) processHandle.kill('SIGKILL');
}

export async function startPreview({ port }) {
  await access(resolve(projectRoot, 'dist/index.html')).catch(() => {
    throw new Error('dist/index.html is missing. Run npm run build before this test.');
  });

  const selectedPort = await availablePort(port);
  const astro = resolve(projectRoot, 'node_modules/astro/bin/astro.mjs');
  const outputChunks = [];
  const processHandle = spawn(
    process.execPath,
    // This harness owns its foreground process and port. Parallel test jobs
    // must not share a CLI discovery lock or replace another local server.
    [astro, 'preview', '--ignore-lock', '--host', '127.0.0.1', '--port', String(selectedPort)],
    {
      cwd: projectRoot,
      // Astro 7 detects agent runners and otherwise daemonizes preview, while
      // this harness owns and terminates the foreground child explicitly. Any
      // non-empty override disables that auto-detection branch.
      env: { ...process.env, NODE_ENV: 'production', ASTRO_PREVIEW_BACKGROUND: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const record = (chunk) => {
    outputChunks.push(chunk.toString());
    if (outputChunks.length > 30) outputChunks.shift();
  };
  processHandle.stdout.on('data', record);
  processHandle.stderr.on('data', record);
  processHandle.on('error', (error) => record(`Preview process error: ${error.message}\n`));

  const baseURL = `http://127.0.0.1:${selectedPort}`;
  await waitForPreview(baseURL, processHandle, () => outputChunks.join(''));

  return {
    baseURL,
    stop: () => terminate(processHandle),
  };
}

export async function withPreview({ port }, callback) {
  const external = process.env.ZODIACS_TEST_BASE_URL;
  if (external) return callback(external.replace(/\/$/, ''));

  const preview = await startPreview({ port });
  try {
    return await callback(preview.baseURL);
  } finally {
    await preview.stop();
  }
}
