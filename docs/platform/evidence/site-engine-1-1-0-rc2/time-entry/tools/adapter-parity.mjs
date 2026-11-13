// S1b (the engine's time-entry PREREGISTRATION.md, section 8, at 806f76b): the
// calendar function's adapter before and after. Two temporary copies of the
// checkout's src/lib/engine/server-ephemeris.ts, one importing the committed
// module (src/lib/engine/time-basis.mjs, refused unless its SHA-256 is the
// pin) and one importing @zodiacs/engine/time in its place, are each bundled
// with the site's esbuild for Node, packages left external as Vercel leaves
// them, and must give the same bodyLongitude and longitudeSpeed (Object.is)
// for the 12 bodies at the K1 instants (./corpora.mjs): 14,765 instants,
// 177,180 values of each.
//
// Control (--control): a third copy importing the module with its first
// nutation coefficient -172064161 read as -172064160 (T4's control b) is
// compared with the first copy instead, and must differ at most instants.
//
// Run after vendoring and before any import changes, while the committed
// module is still in place. Nothing of the checkout is changed: the copies,
// their bundles and links to the checkout's installed packages live in a
// temporary directory that is removed however the run ends.
//
//   node adapter-parity.mjs [--control] [--out <file>]
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

import { k1 } from "./corpora.mjs";
import { finish, options } from "./load.mjs";

const opts = options();
if (opts.control !== undefined && opts.control !== true) throw new Error("--control takes no value");
const control = opts.control === true;
const SITE = fileURLToPath(new URL("../../../../../../", import.meta.url));
const MODULE_SHA256 = "5857c888df07dd5a1695273797632ea8736f37a26aad2fe908b3d857d2333f40";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const replaceOnce = (text, needle, replacement, what) => {
  if (text.split(needle).length !== 2) throw new Error(`expected ${needle} once in ${what}`);
  return text.replace(needle, replacement);
};

const adapterBytes = readFileSync(join(SITE, "src/lib/engine/server-ephemeris.ts"));
const moduleBytes = readFileSync(join(SITE, "src/lib/engine/time-basis.mjs"));
if (sha256(moduleBytes) !== MODULE_SHA256) {
  throw new Error(`src/lib/engine/time-basis.mjs has SHA-256 ${sha256(moduleBytes)}, not the pin ${MODULE_SHA256}`);
}
const adapter = adapterBytes.toString("utf8");
const moduleText = moduleBytes.toString("utf8");
const IMPORT = "from './time-basis.mjs';";
const copies = {
  module: { adapter: replaceOnce(adapter, IMPORT, IMPORT, "server-ephemeris.ts"), module: moduleText },
  package: { adapter: replaceOnce(adapter, IMPORT, "from '@zodiacs/engine/time';", "server-ephemeris.ts"), module: null }
};
if (control) {
  copies.altered = { adapter, module: replaceOnce(moduleText, "-172064161,", "-172064160,", "time-basis.mjs") };
}
const compared = control ? ["module", "altered"] : ["module", "package"];

const BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "North Node", "South Node"];
const work = mkdtempSync(join(tmpdir(), "s1b-adapter-parity-"));
let report;
try {
  // The bundles resolve the checkout's installed packages through links beside them.
  mkdirSync(join(work, "node_modules/@zodiacs"), { recursive: true });
  symlinkSync(join(SITE, "node_modules/@zodiacs/engine"), join(work, "node_modules/@zodiacs/engine"), "dir");
  symlinkSync(join(SITE, "node_modules/astronomy-engine"), join(work, "node_modules/astronomy-engine"), "dir");
  const loaded = {};
  const bundles = {};
  for (const name of compared) {
    const dir = join(work, name);
    mkdirSync(dir);
    writeFileSync(join(dir, "server-ephemeris.ts"), copies[name].adapter);
    if (copies[name].module !== null) writeFileSync(join(dir, "time-basis.mjs"), copies[name].module);
    const outfile = join(work, `${name}.mjs`);
    const result = await esbuild.build({
      entryPoints: [join(dir, "server-ephemeris.ts")],
      outfile,
      absWorkingDir: work,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      packages: "external",
      logLevel: "error",
      metafile: true
    });
    const inputs = Object.keys(result.metafile.inputs).sort();
    const external = [...new Set(Object.values(result.metafile.outputs).flatMap((output) => output.imports.filter((item) => item.external).map((item) => item.path)))].sort();
    bundles[name] = {
      inputs: Object.fromEntries(inputs.map((input) => [input, sha256(readFileSync(join(work, input)))])),
      external,
      sha256: sha256(readFileSync(outfile))
    };
    loaded[name] = await import(pathToFileURL(outfile).href);
  }

  const outcome = (run) => {
    try {
      return { ok: true, value: run() };
    } catch (error) {
      return { ok: false, error: `${error?.constructor?.name ?? typeof error}: ${String(error?.message ?? error)}` };
    }
  };
  const same = (x, y) => x.ok === y.ok && (x.ok ? Object.is(x.value, y.value) : x.error === y.error);
  const [first, second] = compared.map((name) => loaded[name]);
  const instants = k1();
  let longitudes = 0;
  let speeds = 0;
  let errors = 0;
  let differences = 0;
  let instantsWithDifferences = 0;
  const examples = [];
  for (const ms of instants) {
    let differs = false;
    for (const body of BODIES) {
      for (const [what, fn] of [["bodyLongitude", "bodyLongitude"], ["longitudeSpeed", "longitudeSpeed"]]) {
        const x = outcome(() => first[fn](body, new Date(ms)));
        const y = outcome(() => second[fn](body, new Date(ms)));
        if (what === "bodyLongitude") longitudes += 1;
        else speeds += 1;
        if (!x.ok || !y.ok) errors += 1;
        if (!same(x, y)) {
          differences += 1;
          differs = true;
          if (examples.length < 20) examples.push({ ms, body, what, [compared[0]]: x, [compared[1]]: y });
        }
      }
    }
    if (differs) instantsWithDifferences += 1;
  }
  const pass = !control && differences === 0 && errors === 0 && instants.length === 14_765 && longitudes === 177_180 && speeds === 177_180;
  report = {
    check: "S1b",
    tool: "adapter-parity.mjs",
    adapter: { path: "src/lib/engine/server-ephemeris.ts", sha256: sha256(adapterBytes) },
    module: { path: "src/lib/engine/time-basis.mjs", sha256: sha256(moduleBytes) },
    package: JSON.parse(readFileSync(join(SITE, "node_modules/@zodiacs/engine/package.json"), "utf8")).version,
    esbuild: esbuild.version,
    compared,
    bundles: Object.fromEntries(Object.entries(bundles).map(([name, bundle]) => [name, { ...bundle, inputs: Object.fromEntries(Object.entries(bundle.inputs).map(([path, digest]) => [relative(".", path), digest])) }])),
    control,
    controlBehaved: control ? instants.length === 14_765 && instantsWithDifferences > instants.length / 2 : null,
    counts: { instants: instants.length, bodyLongitude: longitudes, longitudeSpeed: speeds, errors },
    differences: { values: differences, instantsWithDifferences },
    examples,
    node: process.version,
    pass
  };
} finally {
  rmSync(work, { recursive: true, force: true });
}
await finish(report, opts.out);
