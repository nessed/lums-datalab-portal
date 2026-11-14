// Contract tests for the data adapters (DESIGN.md 5.1). Run: npm run test:contract
//
// Fixtures are cut from the real release at run time (one figure of each
// status), written to a temporary folder, and read back through the adapter.
// Two cases the release does not contain are made by changing one field of a
// real row inside the temporary copy, never in the release: a dataset whose
// state is "candidate", and a status this code does not know. Nothing here is
// ever read by the site build.
//
// Needs Node 22.18+ (TypeScript type stripping).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
const relDir = path.resolve(siteDir, "..", "releases", cfg.version);
const { loadDatalab } = await import(pathToFileURL(path.join(siteDir, "src/lib/adapter/datalab.ts")).href);
const { shortScale } = await import(pathToFileURL(path.join(siteDir, "src/lib/words.ts")).href);

const read = (n) => JSON.parse(fs.readFileSync(path.join(relDir, n), "utf8"));
const release = read("release.json");
const series = read("series.json");
const obs = read("observations.json");
const cells = read("cells.json");
const checks = read("checks.json");
const sources = read("sources.json");

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

/* ---------- fixtures from the real release ---------- */
const pick = (pred, what) => {
  const o = obs.find(pred);
  if (!o) throw new Error(`fixture missing: ${what}`);
  return o;
};
const fx = {
  checked: pick((o) => o.status === "checked" && o.published && !o.notes && o.series_id.startsWith("fed.exp"), "checked ABS"),
  note: pick((o) => o.status === "checked" && o.published && o.notes, "checked with a note"),
  dash: pick((o) => o.gap_kind === "not_in_source", "printed dash"),
  pending: pick((o) => o.gap_kind === "not_yet_verified", "not yet verified"),
  held: pick((o) => o.gap_kind === "failed_checks", "failed checks"),
  disputed: pick((o) => o.status === "disputed", "disputed"),
  cpi: pick((o) => o.status === "checked" && o.published && o.series_id.startsWith("cpi.") && o.series_id.includes("yoy"), "CPI y/y"),
  lfs: pick((o) => o.status === "checked" && o.published && o.series_id.startsWith("lfs."), "LFS round"),
};
// Two invented-state cases, made from real rows in the temporary copy only.
const unknownRow = { ...fx.pending, obs_id: `${fx.pending.obs_id}~contract-unknown`, status: "unchecked", gap_kind: "some_future_kind", published: false, value: null };
const inconsistent = { ...fx.pending, obs_id: `${fx.pending.obs_id}~contract-inconsistent`, published: true, value: "123" };

function writeRelease(dir, rows, datasetStates = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const ds = structuredClone(release.dataset_status ?? {});
  for (const [k, v] of Object.entries(datasetStates)) ds[k] = { ...(ds[k] ?? { name: k }), state: v };
  const sids = new Set(rows.map((o) => o.series_id));
  const cids = new Set(rows.flatMap((o) => [o.primary_cell_id, ...(o.supporting_cell_ids ?? [])]).filter(Boolean));
  const kids = new Set(rows.flatMap((o) => o.check_ids ?? []));
  const w = (n, v) => fs.writeFileSync(path.join(dir, n), JSON.stringify(v));
  w("release.json", { ...release, dataset_status: ds });
  w("series.json", series.filter((s) => sids.has(s.series_id)));
  w("observations.json", rows);
  w("cells.json", cells.filter((c) => cids.has(c.cell_id)));
  w("checks.json", checks.filter((c) => kids.has(c.check_id)));
  w("sources.json", sources);
  w("coverage.json", []);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "datalab-contract-"));
const rows = [...Object.values(fx), unknownRow, inconsistent];
writeRelease(path.join(tmp, "main"), rows);
const d = loadDatalab(path.join(tmp, "main"));
const get = (o) => d.obsById.get(o.obs_id);

/* ---------- datalab adapter ---------- */
test("checked: value shown, unmarked, usable in derived values", () => {
  const o = get(fx.checked);
  assert.equal(o.reader.key, "checked");
  assert.equal(o.value, fx.checked.value);
  assert.equal(o.published, true);
  assert.equal(o.reader.showsValue, true);
  assert.equal(o.reader.usableInDerived, true);
  assert.equal(o.reader.word, "");
  assert.match(o.reader.reason, /^Checked by /);
  assert.ok(["be", "re"].includes(o.kind));
});
test("checked with a note: value shown with the word 'note'", () => {
  const o = get(fx.note);
  assert.equal(o.reader.key, "checked-note");
  assert.equal(o.reader.word, "note");
  assert.equal(o.value, fx.note.value);
});
test("printed dash: no value, 'not printed', printed text kept, never 0", () => {
  const o = get(fx.dash);
  assert.equal(o.reader.key, "not-printed");
  assert.equal(o.value, null);
  assert.equal(o.published, false);
  assert.equal(o.reader.usableInDerived, false);
  assert.notEqual(o.printed_text, "0");
  assert.match(o.reader.reason, /do not read a dash as zero/);
});
test("not yet verified: no value", () => {
  const o = get(fx.pending);
  assert.equal(o.reader.key, "not-checked");
  assert.equal(o.value, null);
  assert.equal(o.published, false);
});
test("failed checks: held back, no value", () => {
  const o = get(fx.held);
  assert.equal(o.reader.key, "held");
  assert.equal(o.value, null);
  assert.equal(o.reader.word, "held back");
});
test("disputed: no single value", () => {
  const o = get(fx.disputed);
  assert.equal(o.reader.key, "disputed");
  assert.equal(o.value, null);
  assert.equal(o.published, false);
});
test("unknown status: no value, never dressed as checked", () => {
  const o = d.obsById.get(unknownRow.obs_id);
  assert.equal(o.reader.key, "unknown");
  assert.equal(o.value, null);
  assert.equal(o.published, false);
});
test("a row marked published without passing checks: no value", () => {
  const o = d.obsById.get(inconsistent.obs_id);
  assert.notEqual(o.reader.key, "checked");
  assert.equal(o.value, null);
  assert.equal(o.published, false);
});
test("kinds of figure: CPI change and LFS survey round", () => {
  assert.equal(get(fx.cpi).kind, "change_yoy");
  assert.equal(get(fx.lfs).kind, "survey_round");
});
test("release info names the release and its source", () => {
  assert.equal(d.info.id, release.version);
  assert.equal(d.info.builtFrom, "LUMS DataLab pipeline");
  assert.equal(d.info.isPrototype, true);
  assert.deepEqual(d.batchGaps, []);
});

// A dataset nobody has signed off (decision 17.1).
const ds = series.find((s) => s.series_id === fx.checked.series_id).dataset;
writeRelease(path.join(tmp, "candidate"), [fx.checked, fx.held], { [ds]: "candidate" });
const dc = loadDatalab(path.join(tmp, "candidate"));
test("candidate: value shown, marked 'not signed off', kept out of derived values", () => {
  const o = dc.obsById.get(fx.checked.obs_id);
  assert.equal(o.reader.key, "candidate");
  assert.equal(o.signoff, "candidate");
  assert.equal(o.reader.word, "not signed off");
  assert.equal(o.value, fx.checked.value);
  assert.equal(o.reader.showsValue, true);
  assert.equal(o.reader.usableInDerived, false);
});
test("candidate: a held figure in it stays held, with no value", () => {
  const o = dc.obsById.get(fx.held.obs_id);
  assert.equal(o.reader.key, "held");
  assert.equal(o.value, null);
});

/* ---------- short scale (DESIGN.md 6.3) ---------- */
test("short scale", () => {
  assert.equal(shortScale("37438", "PKR", 1000000), "Rs 37.4 billion");
  assert.equal(shortScale("25164008", "PKR", 1000000), "Rs 25.2 trillion");
  assert.equal(shortScale("60245", "PKR", 1000000), "Rs 60.2 billion");
  assert.equal(shortScale("999", "PKR", 1000000), "Rs 999 million");
  assert.equal(shortScale("-1250", "PKR", 1000000), "−Rs 1.3 billion");
  assert.equal(shortScale("37450", "PKR", 1000000), "Rs 37.5 billion");
  assert.equal(shortScale("37000", "PKR", 1000000), "Rs 37 billion");
  assert.equal(shortScale("71.83", "persons", 1000000), "71.8 million persons");
  assert.equal(shortScale("0.45", "persons", 1000000), "450,000 persons");
  assert.equal(shortScale("6.9", "percent", 1), "6.9%");
  assert.equal(shortScale("312.64", "index", 1), "312.64");
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`contract tests: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
