// Built by scripts/build-precision-preview.mjs from src/precision-preview/app.src.mjs. Do not edit.

// src/precision-preview/app.src.mjs
var seq = 0;
var pending = /* @__PURE__ */ new Map();
var inFlight = 0;
var gen = { places: 0, search: 0 };
var spawn = () => {
  const w = new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" });
  w.onmessage = (e) => {
    const fn = pending.get(e.data.id);
    if (fn) {
      pending.delete(e.data.id);
      inFlight = Math.max(0, inFlight - 1);
      fn(e.data.payload ?? e.data);
    }
  };
  return w;
};
var worker = spawn();
var ask = (msg) => new Promise((res) => {
  const id = ++seq;
  pending.set(id, res);
  inFlight += 1;
  worker.postMessage({ ...msg, id });
});
function hardStop() {
  worker.terminate();
  for (const [, res] of pending) res({ ok: false, refused: "cancelled", detail: "the worker was stopped" });
  pending = /* @__PURE__ */ new Map();
  inFlight = 0;
  gen.places += 1;
  gen.search += 1;
  worker = spawn();
}
var $ = (x) => document.getElementById(x);
var text = (el, s, cls, state = "settled") => {
  el.textContent = s;
  el.className = cls ?? "";
  el.dataset.state = state;
};
var esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function renderInfo(info) {
  $("pp-synthetic").hidden = !info.synthetic;
  const rows = [
    ["source", info.synthetic ? "synthetic fixture, built in this tab" : `a pack you supplied (${info.source})`],
    ["digest", info.integrity.digest],
    ["self-consistent", String(info.integrity.selfConsistent)],
    ["authenticity", info.integrity.authenticity],
    ["coverage", `${info.coverage.startUtcApprox} .. ${info.coverage.stopUtcApprox}`],
    ["usable margin", `${info.coverage.usableMarginHours} h at each end, for light-time lookback and the derivative step`],
    ["bodies", info.bodies.join(", ")],
    ["system barycentres, not centres", info.systemBarycentresNotCentres.join(", ")],
    ["apparent output", info.conventions.apparent],
    ["clock", info.conventions.clock],
    ["result contract", info.conventions.resultContract]
  ];
  if (info.pack.compiler) rows.push(["compiler", info.pack.compiler]);
  if (info.pack.inputFile) rows.push(["compiled from", `${info.pack.inputFile} (${String(info.pack.inputSha256).slice(0, 16)}\u2026)`]);
  $("pp-info").innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  $("pp-corrections").innerHTML = `<ul>${info.conventions.corrections.map((c) => `<li>${esc(c)}</li>`).join("")}</ul><p class="pp-dim">Not modelled: ${esc(info.conventions.notModelled.join("; "))}.</p>`;
  for (const el of document.querySelectorAll("[data-needs-pack]")) el.disabled = false;
  fitInputsTo(info.coverage);
}
function fitInputsTo(coverage) {
  const lo = Date.parse(coverage.startUtcApprox);
  const hi = Date.parse(coverage.stopUtcApprox);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return;
  const margin = coverage.usableMarginHours * 36e5 * 1.5;
  const day = 864e5;
  const mid = (lo + hi) / 2;
  const clamp = (t) => Math.min(hi - margin, Math.max(lo + margin, t));
  const iso = (t) => new Date(Math.round(clamp(t) / 1e3) * 1e3).toISOString().replace(/\.\d+Z$/, "Z");
  $("pp-instant").value = iso(mid);
  const span = Math.min(365 * day, (hi - lo) / 3);
  $("pp-from").value = iso(mid - span / 2);
  $("pp-to").value = iso(mid + span / 2);
}
async function load(msg, label) {
  text($("pp-pack-state"), `${label} \u2026`, "", "busy");
  const r = await ask(msg);
  if (!r.ok) {
    text($("pp-pack-state"), `refused: ${r.refused}, ${r.detail}`, "pp-bad");
    $("pp-info").innerHTML = "";
    return;
  }
  text($("pp-pack-state"), r.info.synthetic ? "synthetic fixture ready" : "pack loaded and verified", "pp-ok");
  renderInfo(r.info);
}
$("pp-synthetic-btn").addEventListener("click", () => load({ type: "load-synthetic" }, "building the synthetic fixture"));
$("pp-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  await load({ type: "load-pack", buffer }, `reading ${file.name} (${file.size} bytes)`);
});
$("pp-unload").addEventListener("click", async () => {
  await ask({ type: "unload" });
  text($("pp-pack-state"), "disposed. Nothing is loaded, and every calculation will be refused.");
  $("pp-info").innerHTML = "";
  $("pp-corrections").innerHTML = "";
  $("pp-places-out").innerHTML = "";
  $("pp-search-out").innerHTML = "";
  $("pp-synthetic").hidden = true;
  $("pp-file").value = "";
  for (const el of document.querySelectorAll("[data-needs-pack]")) el.disabled = true;
});
$("pp-places").addEventListener("click", async () => {
  const mine = ++gen.places;
  text($("pp-places-state"), "working \u2026", "", "busy");
  const r = await ask({ type: "places", iso: $("pp-instant").value.trim() });
  if (mine !== gen.places) return;
  if (!r.ok) {
    text($("pp-places-state"), `refused: ${r.refused}, ${r.detail}`, "pp-bad");
    $("pp-places-out").innerHTML = "";
    return;
  }
  text($("pp-places-state"), r.synthetic ? "synthetic fixture. These are not planetary positions" : "apparent geocentric, ecliptic of date");
  $("pp-places-out").innerHTML = `<table><tr><th>body</th><th class="num">longitude \xB0</th><th class="num">latitude \xB0</th><th class="num">distance km</th><th>note</th></tr>${r.rows.map((x) => `<tr><td>${esc(x.body)}</td><td class="num">${x.lon.toFixed(6)}</td><td class="num">${x.lat.toFixed(6)}</td><td class="num">${x.distKm.toExponential(6)}</td><td class="pp-dim">${x.isSystemBarycentre ? "system barycentre" : ""}</td></tr>`).join("")}</table>`;
});
function explain(v) {
  const parts = [];
  if (v.execution.status !== "finished") {
    parts.push(`The run did not finish: ${esc(v.execution.status)}${v.execution.reason ? `, ${esc(v.execution.reason)}` : ""}. What is listed is what it found before it stopped.`);
  } else if (v.completeness.established) {
    parts.push("Every part of the interval was accounted for by bounds that are true of the stored polynomial, so this list is complete for the function the pack defines. That is a statement about the pack, not about the sky.");
  } else if (v.completeness.support === "conditional") {
    parts.push("The run finished and accounted for the whole interval, but only if the assumptions below hold. They were measured on a grid, not proved, so this is not a guarantee that nothing else is there.");
  } else {
    parts.push("Nothing about completeness was established. There may be events here that this run did not find.");
  }
  if (v.accounting.unresolved.length) {
    parts.push(`${v.accounting.unresolved.length} stretch${v.accounting.unresolved.length === 1 ? "" : "es"} of the interval could not be decided.`);
  }
  if (v.assumptions.length) {
    parts.push(`Unverified assumptions: ${v.assumptions.map((a) => esc(a.id)).join(", ")}.`);
  }
  return parts.join(" ");
}
$("pp-search").addEventListener("click", async () => {
  const mine = ++gen.search;
  text($("pp-search-state"), "working \u2026", "", "busy");
  const mode = document.querySelector('input[name="pp-mode"]:checked').value;
  const r = await ask({
    type: "search",
    mode,
    body: $("pp-body").value,
    targetDeg: Number($("pp-target").value),
    fromIso: $("pp-from").value.trim(),
    toIso: $("pp-to").value.trim(),
    epsilonDeg: 1 / 3600,
    maxRateDegPerDay: Number($("pp-rate").value) || void 0
  });
  if (mine !== gen.search) return;
  if (!r.ok) {
    text($("pp-search-state"), `refused: ${r.refused}, ${r.detail}`, "pp-bad");
    $("pp-search-out").innerHTML = "";
    return;
  }
  const v = r.verdict;
  text($("pp-search-state"), `${v.mode} \xB7 ${v.execution.status} \xB7 ${v.eventCount.found} event${v.eventCount.found === 1 ? "" : "s"}`, r.synthetic ? "pp-warn" : "");
  const claim = [
    ["events found", String(v.eventCount.found)],
    ["run finished", String(v.execution.finished)],
    ["completeness established", String(v.completeness.established)],
    ["support", v.completeness.support],
    ["exact total available", String(v.eventCount.isExactTotal)],
    ...v.eventCount.conditionalTotal !== null && v.eventCount.conditionalTotal !== void 0 ? [["total, IF the assumptions hold", String(v.eventCount.conditionalTotal)]] : [],
    ["interval processed", `${(v.interval.processedFraction * 100).toFixed(4)}%`],
    ["evaluations", String(v.execution.evaluations)]
  ];
  $("pp-search-out").innerHTML = `<dl class="pp-claim">${claim.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${esc(x)}</dd>`).join("")}</dl><p class="pp-explain">${explain(v)}</p>` + (r.events.length ? `<table><tr><th>#</th><th>instant (UTC)</th><th class="num">bracket width s</th><th>direction</th></tr>${r.events.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.utc)}</td><td class="num">${e.bracketWidthSec.toExponential(3)}</td><td class="pp-dim">${esc(e.direction ?? e.kind ?? "")}</td></tr>`).join("")}</table>` : '<p class="pp-dim">No events in this interval.</p>') + (r.synthetic ? '<p class="pp-warn">Synthetic fixture. These instants describe a circle this page invented, not a planet.</p>' : "");
});
$("pp-cancel").addEventListener("click", () => {
  if (inFlight === 0) {
    text($("pp-search-state"), "nothing is running, so there is nothing to cancel.");
    return;
  }
  hardStop();
  text($("pp-search-state"), "cancelled. Stopping a calculation means stopping the worker, which drops the loaded data. Load it again below.", "pp-warn");
  text($("pp-pack-state"), "nothing loaded: the worker was stopped to cancel a calculation.");
  $("pp-info").innerHTML = "";
  $("pp-corrections").innerHTML = "";
  $("pp-places-out").innerHTML = "";
  $("pp-search-out").innerHTML = "";
  $("pp-synthetic").hidden = true;
  $("pp-file").value = "";
  for (const el of document.querySelectorAll("[data-needs-pack]")) el.disabled = true;
});
window.__precisionPreview = { ask, generations: gen, get worker() {
  return worker;
}, get inFlight() {
  return inFlight;
} };
