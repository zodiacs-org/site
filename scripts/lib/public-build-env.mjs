/*
 * The PUBLIC_* values a plain Node build script should see: the shell first,
 * then the same .env files Vite (and so Astro and every island) reads for the
 * build's mode. A flag set only in a .env file used to reach the islands
 * through import.meta.env while these scripts read process.env alone and saw
 * it unset, so one layer ran a feature the other had off. Reading through here
 * keeps the halves on one value. Only names starting PUBLIC_ are taken from
 * files; server variables still come from the shell alone.
 */
import { loadEnv } from 'vite';

/** Astro builds in production mode and serves `astro dev` in development mode. */
export function publicBuildMode(env = process.env) {
  return env.npm_lifecycle_event === 'predev' ? 'development' : 'production';
}

/**
 * A reader for PUBLIC_* names. The shell wins over a file, as it does in Vite.
 * `root` is the directory holding the .env files (the repo root).
 */
export function publicBuildEnv({ root, mode = publicBuildMode(), env = process.env } = {}) {
  if (!root) throw new Error('publicBuildEnv needs the repo root');
  const fileEnv = loadEnv(mode, root, 'PUBLIC_');
  return (name) => {
    if (!name.startsWith('PUBLIC_')) throw new Error(`${name} is not a PUBLIC_ name`);
    return env[name] ?? fileEnv[name];
  };
}
