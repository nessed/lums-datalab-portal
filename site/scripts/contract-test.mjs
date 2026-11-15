// Contract tests for the data adapters (DESIGN.md 5.1). Run: npm run test:contract
//
// Fixtures are cut from the real release at run time (one figure of each
// status), written to a temporary folder, and read back through the adapter.
// Two cases the release does not contain are made by changing one field of a
// real row inside the temporary copy, never in the release: a dataset whose
// state is "candidate", and a status this code does not know. Nothing here is
// ever read by the site build.
//
// The golden section (at the end) reads the real tag golden-2026.11.11 of Ahmad's repository from a clone named by
// GOLDEN_REPO, and is skipped with a message when there is none.
//
// Needs Node 22.18+ (TypeScript type stripping).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

/* ---------- plain titles (DESIGN.md 6.4, round 2): editorial, never data ---------- */
const titlesFile = path.join(siteDir, "editorial", "titles.json");
const titlesJson = JSON.parse(fs.readFileSync(titlesFile, "utf8"));
test("titles: a release folder without a titles file keeps the printed name as the title, and says so", () => {
  // The temporary release lives outside site/, so the default file next to it does not exist.
  for (const s of d.series) {
    assert.equal(s.title, s.name);
    assert.equal(s.summary, null);
    assert.equal(s.titleStatus, "printed");
  }
});
const dt = loadDatalab(path.join(tmp, "main"), { titlesFile });
test("titles: with the editorial file, every series gets its title, summary and draft status; the printed name is unchanged", () => {
  for (const s of dt.series) {
    const e = titlesJson.series[s.series_id];
    assert.ok(e, `no entry for ${s.series_id}`);
    assert.equal(s.title, e.title);
    assert.equal(s.summary, e.summary);
    assert.equal(s.titleStatus, e.status === "approved" ? "approved" : "draft");
    assert.equal(s.name, series.find((x) => x.series_id === s.series_id).name, "printed name changed");
  }
});
test("titles: the editorial file changes no figure, id or status", () => {
  assert.equal(dt.observations.length, d.observations.length);
  for (const o of d.observations) {
    const t = dt.obsById.get(o.obs_id);
    assert.equal(t.value, o.value);
    assert.equal(t.reader.key, o.reader.key);
  }
  assert.deepEqual(dt.series.map((s) => s.series_id), d.series.map((s) => s.series_id));
});
test("titles: the real release loads with the default editorial file next to it", () => {
  const real = loadDatalab(relDir);
  const inflation = real.seriesById.get("cpi.national.yoy.general");
  assert.equal(inflation.title, titlesJson.series["cpi.national.yoy.general"].title);
  assert.equal(inflation.name, series.find((x) => x.series_id === "cpi.national.yoy.general").name);
  assert.ok(real.series.every((s) => s.titleStatus !== "printed"), "a series of the release has no title");
});
test("titles: a missing entry falls back to the printed name; titlesFile null reads nothing", () => {
  const none = loadDatalab(path.join(tmp, "main"), { titlesFile: null });
  assert.ok(none.series.every((s) => s.titleStatus === "printed" && s.title === s.name));
  const partial = path.join(tmp, "titles-partial.json");
  const first = dt.series[0].series_id;
  fs.writeFileSync(partial, JSON.stringify({ provisional: true, series: { [first]: { title: "A plain title", summary: "One sentence.", status: "approved" } } }));
  const p = loadDatalab(path.join(tmp, "main"), { titlesFile: partial });
  assert.equal(p.seriesById.get(first).title, "A plain title");
  assert.equal(p.seriesById.get(first).titleStatus, "approved");
  for (const s of p.series.filter((x) => x.series_id !== first)) assert.equal(s.titleStatus, "printed");
});
const { seriesTitle, printedLine, seriesSummary } = await import(pathToFileURL(path.join(siteDir, "src/lib/titles.ts")).href);
test("titles: helpers name a series by its title and give the printed line only when it differs", () => {
  assert.equal(seriesTitle({ name: "CPI National: General", title: "Inflation" }), "Inflation");
  assert.equal(printedLine({ name: "CPI National: General", title: "Inflation" }), "CPI National: General");
  assert.equal(seriesTitle({ name: "Sales tax", title: "" }), "Sales tax");
  assert.equal(printedLine({ name: "Sales tax", title: "sales tax" }), null);
  assert.equal(seriesSummary({ name: "x", summary: null }), null);
});

fs.rmSync(tmp, { recursive: true, force: true });

/* ---------- golden adapter (DESIGN.md 5.2, 5.3; task A8) ----------
 * Read against the real tag of Ahmad's repository, never against typed values. The tag is extracted with read-only
 * git commands (ls-tree, cat-file) into a temporary folder; the clone is never changed. Fixture rows are picked from
 * the extracted CSVs by what they are (a checked row, a misprint ...) and the adapter's output for exactly those rows
 * is tested. The clone's path is machine-specific: GOLDEN_REPO overrides it; without a clone or the tag the golden
 * tests are skipped with a message, not failed. */
const GOLDEN_TAG = "golden-2026.11.11";
const goldenRepo =
  process.env.GOLDEN_REPO ??
  "C:\\Users\\Ali\\AppData\\Local\\Temp\\claude\\0b8ae8e8ff611a14\\c6e9eb34-e25b-40bc-a926-c5d981539576\\scratchpad\\golden-repo";
const git = (...args) => execFileSync("git", ["-C", goldenRepo, ...args], { maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
let goldenSkip = null;
if (!fs.existsSync(path.join(goldenRepo, ".git"))) goldenSkip = `no clone of Ahmad's repository at ${goldenRepo} (set GOLDEN_REPO to one)`;
else {
  try {
    git("rev-parse", "--verify", "--quiet", `refs/tags/${GOLDEN_TAG}`);
  } catch {
    goldenSkip = `the clone at ${goldenRepo} has no tag ${GOLDEN_TAG} (git fetch --tags)`;
  }
}
if (goldenSkip) {
  console.log(`golden adapter tests SKIPPED: ${goldenSkip}`);
} else {
  const ga = await import(pathToFileURL(path.join(siteDir, "src/lib/adapter/golden.ts")).href);
  const gtmp = fs.mkdtempSync(path.join(os.tmpdir(), "golden-contract-"));
  /** Extract paths of one commit-ish into dest, file by file (git cat-file: the raw blob, no line-ending change). */
  const extract = (rev, dest, paths) => {
    const names = git("ls-tree", "-r", "--name-only", rev, "--", ...paths).toString("utf8").split("\n").filter(Boolean);
    for (const n of names) {
      const out = path.join(dest, ...n.split("/"));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, git("cat-file", "blob", `${rev}:${n}`));
    }
    return names.length;
  };
  extract(GOLDEN_TAG, gtmp, ["golden", "query/series_breaks.csv", "registry/signoffs.csv"]);
  const gdir = path.join(gtmp, "golden");
  const gcat = JSON.parse(fs.readFileSync(path.join(gdir, "catalogue.json"), "utf8"));
  const grel = JSON.parse(fs.readFileSync(path.join(gdir, "RELEASE.json"), "utf8"));
  const entry = (ds) => gcat.find((e) => e.dataset_id === ds && e.layer === "golden");
  const rowsOf = new Map();
  const csvRows = (ds) => {
    if (!rowsOf.has(ds)) rowsOf.set(ds, ga.parseCsv(fs.readFileSync(path.join(gdir, entry(ds).path), "utf8")));
    return rowsOf.get(ds);
  };
  const excOf = (ds) => ga.parseCsv(fs.readFileSync(path.join(gdir, ds, "exceptions.csv"), "utf8"));
  const pickRow = (ds, pred, what) => {
    const i = csvRows(ds).findIndex(pred);
    if (i < 0) throw new Error(`golden fixture missing: ${what}`);
    return { ds, i, r: csvRows(ds)[i] };
  };
  const dec = (v) => {
    let t = String(v).trim().replace(/^\+/, "");
    if (t.includes(".")) t = t.replace(/0+$/, "").replace(/\.$/, "");
    return /^-0+$/.test(t) ? "0" : t;
  };
  const tokens = (r) => r.exception.split(";").filter(Boolean);
  const golden = gcat.filter((e) => e.layer === "golden" && e.status === "golden").map((e) => e.dataset_id);
  const candidates = gcat.filter((e) => e.layer === "golden" && e.status !== "golden").map((e) => e.dataset_id);
  const fedAbs = ["abs_federal_functional", "abs_federal_economic", "abs_federal_receipts"];
  /** Exception line with the same key as the row (exact match only, so the expected text is unambiguous). */
  const exactExc = (ds, r, type) => {
    const ex = excOf(ds).filter((x) => x.type === type);
    const meta = new Set(["id", "type", "value", "other_doc_fy", "other_value", "delta", "classification", "evidence", "status"]);
    const keys = ex.length ? Object.keys(ex[0]).filter((k) => !meta.has(k) && k in r) : [];
    const hits = ex.filter((x) => keys.every((k) => x[k] === r[k]));
    return hits.length === 1 ? hits[0] : null;
  };
  const fnDs = golden.find((d) => d === "abs_federal_functional");
  const candBudget = candidates.find((d) => fedAbs.includes(d));
  const gx = {
    checked: pickRow(fnDs, (r) => !r.exception && Number(r.value_rs_million) !== 0, "checked federal functional row"),
    restated: pickRow(fnDs, (r) => r.exception === "restated*" && exactExc(fnDs, r, "restated"), "restated* with its exceptions line"),
    memo: pickRow(fnDs, (r) => r.exception === "memo*" && Number(r.value_rs_million) !== 0 && exactExc(fnDs, r, "memo"), "memo* (non-zero) with its exceptions line"),
    misprint: pickRow(fnDs, (r) => r.exception === "misprint*" && exactExc(fnDs, r, "misprint"), "misprint* with its exceptions line"),
    absZero: pickRow(fnDs, (r) => !r.exception && Number(r.value_rs_million) === 0, "federal ABS stored 0"),
    candidate: pickRow(candBudget, (r) => !r.exception && Number(r.value_rs_million) !== 0, "row of a candidate dataset"),
    candRestated: pickRow(candBudget, (r) => r.exception === "restated*" && exactExc(candBudget, r, "restated"), "restated* in a candidate dataset"),
    pesMisprint: pickRow("pes_headline_indicators", (r) => tokens(r).includes("misprint*"), "Economic Survey misprint"),
    kpDash: pickRow("kp_abs_summary", (r) => r.printed_value.trim() === "-", "KP printed dash"),
    unpublished: pickRow("lfs_indicators", (r) => r.exception === "unpublished*", "survey figure PBS never printed"),
    recomputed: pickRow("lfs_indicators", (r) => !r.exception && r.check_status === "matched" && r.published_source, "recomputed survey figure, matched"),
    assumption: pickRow("lfs_indicators", (r) => r.exception === "assumption*" && exactExc("lfs_indicators", r, "assumption"), "assumption*"),
    smallSample: pickRow("pslm_education_health", (r) => r.exception === "small_sample*", "small_sample* in a candidate survey dataset"),
    dfgActual: pickRow("fed_dfg", (r) => r.estimate_type === "ACTUAL", "DFG actual"),
    kpAc: pickRow("kp_abs_summary", (r) => r.estimate_type === "AC", "KP accounts"),
    pesPart: pickRow("pes_headline_indicators", (r) => r.partial_period !== "", "Survey part-year"),
    pesF: pickRow("pes_headline_indicators", (r) => !r.partial_period && r.col_flag === "F", "Survey column F"),
    pesR: pickRow("pes_headline_indicators", (r) => !r.partial_period && r.col_flag === "R", "Survey column R"),
    pesP: pickRow("pes_headline_indicators", (r) => !r.partial_period && r.col_flag === "P", "Survey column P"),
  };
  // A second printing of the checked row's line (same series, another document), for the series id rule.
  const sameLine = (a, b) => ["table", "row_type", "row_instance", "code"].every((c) => a[c] === b[c]);
  gx.otherPrinting = pickRow(fnDs, (r) => sameLine(r, gx.checked.r) && r.doc_fy !== gx.checked.r.doc_fy, "second printing of the checked line");
  // A page size for the checked row's page only, made from that row's own box (no typed value): the box must become fractions.
  const ck = gx.checked.r;
  const sized = { w: Number(ck.bbox_x1) * 2, h: Number(ck.bbox_bottom) * 2 };
  const pageSize = (sha, page) => (sha === ck.source_sha256 && page === Number(ck.page) ? { width: sized.w, height: sized.h } : null);
  gx.unsized = pickRow(fnDs, (r) => !r.exception && Number(r.value_rs_million) !== 0 && r.source_sha256 !== ck.source_sha256, "checked row in another document");

  let g = null;
  try {
    g = ga.loadGolden(gdir, { tag: GOLDEN_TAG, pageSize });
  } catch (e) {
    failures.push(`golden: the tag does not load: ${e.message}`);
  }
  const gobs = (f) => g.obsById.get(g.rowObs.get(`${f.ds}#${f.i}`));
  const gev = (f) => g.evidence.get(g.rowObs.get(`${f.ds}#${f.i}`));

  if (g) {
    test("golden: without an editorial titles file every series keeps its printed name as its title, marked printed", () => {
      for (const s of g.series) {
        assert.equal(s.title, s.name);
        assert.equal(s.titleStatus, "printed");
        assert.equal(s.summary, null);
      }
    });
    test("golden: every row of every released dataset is read, once", () => {
      let total = 0;
      for (const [ds, v] of Object.entries(grel.datasets)) {
        total += v.rows;
        assert.equal(csvRows(ds).length, v.rows, ds);
      }
      assert.equal(g.observations.length, total);
      assert.equal(g.obsById.size, total);
      assert.deepEqual(g.notInRelease, []);
    });
    test("golden: release info names the pinned tag and its source", () => {
      assert.equal(g.info.id, GOLDEN_TAG);
      assert.equal(g.info.builtFrom, "Golden data release");
      assert.equal(g.info.isPrototype, false);
      assert.equal(g.release.version, GOLDEN_TAG);
    });
    test("golden: checked row (signed-off dataset): value as printed, unmarked, usable in derived values", () => {
      const o = gobs(gx.checked);
      assert.equal(o.reader.key, "checked");
      assert.equal(o.reader.word, "");
      assert.equal(o.value, dec(gx.checked.r.value_rs_million));
      assert.equal(o.published, true);
      assert.equal(o.reader.usableInDerived, true);
      assert.equal(o.signoff, "signed");
      assert.equal(o.kind, gx.checked.r.estimate_type.toLowerCase());
      assert.equal(o.unit, "PKR");
      assert.equal(o.scale_factor, 1000000);
      assert.match(o.reader.reason, /^Checked by the source's /);
    });
    test("golden: printed-cell evidence; box in points becomes fractions when the page size is known", () => {
      const [ev] = gev(gx.checked);
      assert.equal(ev.kind, "printed-cell");
      assert.equal(ev.page, Number(ck.page));
      const r5 = (x) => Math.round(x * 100000) / 100000;
      assert.deepEqual(ev.box, [r5(ck.bbox_x0 / sized.w), r5(ck.bbox_top / sized.h), r5(ck.bbox_x1 / sized.w), r5(ck.bbox_bottom / sized.h)]);
      assert.equal(ev.boxState, "tentative");
      assert.equal(g.sourceById.get(ev.sourceId).sha256, ck.source_sha256);
      assert.equal(g.cellById.get(ev.cellId).cell_bbox_norm.length, 4);
    });
    test("golden: page size unknown: box kept in points, none drawn, and the reason said", () => {
      const [ev] = gev(gx.unsized);
      const r = gx.unsized.r;
      assert.equal(ev.box, null);
      assert.equal(ev.boxState, "no-image");
      assert.deepEqual(ev.boxPoints, [Number(r.bbox_x0), Number(r.bbox_top), Number(r.bbox_x1), Number(r.bbox_bottom)]);
      assert.match(ev.boxNote, /page size/);
    });
    test("golden: restated* is checked with a note, the exceptions.csv text as the reason", () => {
      const o = gobs(gx.restated);
      assert.equal(o.reader.key, "checked-note");
      assert.equal(o.reader.word, "note");
      assert.equal(o.reader.reason, exactExc(fnDs, gx.restated.r, "restated").evidence);
      assert.equal(o.value, dec(gx.restated.r.value_rs_million));
    });
    test("golden: memo* is checked with a note, the exceptions.csv text as the reason", () => {
      const o = gobs(gx.memo);
      assert.equal(o.reader.key, "checked-note");
      assert.equal(o.reader.reason, exactExc(fnDs, gx.memo.r, "memo").evidence);
    });
    test("golden: misprint* is held back with the source's explanation, and no number anywhere", () => {
      const o = gobs(gx.misprint);
      assert.equal(o.reader.key, "held");
      assert.equal(o.reader.reason, exactExc(fnDs, gx.misprint.r, "misprint").evidence);
      assert.equal(o.value, null);
      assert.equal(o.published, false);
      assert.equal(o.printed_text, null);
      assert.equal(g.cellById.get(o.primary_cell_id).value_raw, null);
      assert.equal(g.cellById.get(o.primary_cell_id).value_parsed, null);
    });
    test("golden: an Economic Survey misprint in a candidate dataset is held, not 'not signed off'", () => {
      const o = gobs(gx.pesMisprint);
      assert.equal(o.reader.key, "held");
      assert.equal(o.value, null);
      assert.equal(o.printed_text, null);
    });
    test("golden: federal ABS 0 is 'dash or zero': no value, never usable in a derived value", () => {
      const o = gobs(gx.absZero);
      assert.equal(o.reader.key, "dash-or-zero");
      assert.equal(o.value, null);
      assert.equal(o.published, false);
      assert.equal(o.printed_text, null);
      assert.equal(o.reader.showsValue, false);
      assert.equal(o.reader.usableInDerived, false);
    });
    test("golden: a printed dash in a document that keeps the printed text is 'not printed', kept as text", () => {
      const o = gobs(gx.kpDash);
      assert.equal(o.reader.key, "not-printed");
      assert.equal(o.value, null);
      assert.equal(o.printed_text, "-");
    });
    test("golden: candidate dataset: value shown, marked 'not signed off', kept out of derived values", () => {
      const o = gobs(gx.candidate);
      assert.equal(o.reader.key, "candidate");
      assert.equal(o.reader.word, "not signed off");
      assert.equal(o.signoff, "candidate");
      assert.equal(o.value, dec(gx.candidate.r.value_rs_million));
      assert.equal(o.reader.usableInDerived, false);
      assert.equal(g.release.dataset_status[candBudget].state, "candidate");
    });
    test("golden: restated* in a candidate dataset stays 'not signed off' and carries the note", () => {
      const o = gobs(gx.candRestated);
      assert.equal(o.reader.key, "candidate");
      assert.ok(o.reader.reason.includes(exactExc(candBudget, gx.candRestated.r, "restated").evidence));
    });
    test("golden: survey figure PBS never printed: not checked yet, no number (decision 17.8)", () => {
      const o = gobs(gx.unpublished);
      assert.equal(o.reader.key, "not-checked");
      assert.equal(o.value, null);
      const [ev] = gev(gx.unpublished);
      assert.equal(ev.kind, "recomputed");
      assert.equal(ev.ourValue, "");
      assert.equal(ev.publishedValue, null);
    });
    test("golden: recomputed survey figure: our value, PBS's printed value, the table and page", () => {
      const o = gobs(gx.recomputed);
      const r = gx.recomputed.r;
      assert.equal(o.reader.key, "checked");
      assert.equal(o.kind, "survey_round");
      assert.equal(o.value, dec(r.value));
      assert.equal(o.primary_cell_id, null);
      const [ev] = gev(gx.recomputed);
      assert.equal(ev.kind, "recomputed");
      assert.equal(ev.ourValue, dec(r.value));
      assert.equal(ev.publishedValue, dec(r.published_value));
      assert.equal(ev.method, r.method);
      assert.ok(Number.isInteger(ev.page) && ev.page > 0, "page of the published table");
      assert.ok(ev.table.length > 0);
      assert.ok(g.sourceById.has(ev.sourceId));
    });
    test("golden: assumption* is checked with a note", () => {
      const o = gobs(gx.assumption);
      assert.equal(o.reader.key, "checked-note");
      assert.ok(o.reader.reason.includes(exactExc("lfs_indicators", gx.assumption.r, "assumption").evidence));
    });
    test("golden: small_sample* in a candidate survey dataset: 'not signed off' with the note", () => {
      const o = gobs(gx.smallSample);
      assert.equal(o.reader.key, "candidate");
      assert.match(o.reader.reason, /The source's note: /);
    });
    test("golden: held batches become batch gaps, with no rows", () => {
      const held = gcat.filter((e) => e.layer === "golden" && e.dataset_id in grel.datasets).flatMap((e) => (e.held_batches ?? []).map((h) => ({ ds: e.dataset_id, ...h })));
      assert.ok(held.length > 0);
      assert.equal(g.batchGaps.length, held.length);
      for (const h of held) {
        const gap = g.batchGaps.find((x) => x.dataset === h.ds && x.batch === h.batch);
        assert.ok(gap, `${h.ds} ${h.batch}`);
        assert.equal(gap.status, "held");
        assert.ok(gap.reason.includes(h.reason));
        assert.ok(!g.observations.some((o) => g.printing.get(o.obs_id).dataset === h.ds && o.period === h.batch), `rows for held ${h.ds} ${h.batch}`);
      }
    });
    test("golden: kinds of figure (6.2)", () => {
      assert.equal(gobs(gx.dfgActual).kind, "actual");
      assert.equal(gobs(gx.kpAc).kind, "ac");
      assert.equal(gobs(gx.pesPart).kind, "part_year");
      assert.equal(gobs(gx.pesF).kind, "final");
      assert.equal(gobs(gx.pesR).kind, "es_revised");
      assert.equal(gobs(gx.pesP).kind, "es_provisional");
    });
    test("golden: series id rule: one item in one group; every printing of the line shares it", () => {
      const a = gobs(gx.checked);
      const b = gobs(gx.otherPrinting);
      const r = gx.checked.r;
      assert.equal(a.series_id, ["golden", fnDs, r.table, r.row_type, r.row_instance, r.code].join("."));
      assert.equal(b.series_id, a.series_id);
      assert.notEqual(b.obs_id, a.obs_id);
      assert.equal(g.seriesBySlug.size, g.series.length);
    });
    test("golden: his series rule picks one figure per year (accounts > revised > budget, then the latest document)", () => {
      const rows = csvRows(fnDs).filter((r) => sameLine(r, gx.checked.r));
      const rank = { ACTUAL: 0, AC: 0, RE: 1, BE: 2 };
      for (const { period, chosen } of ga.chooseByPeriod(g, gobs(gx.checked).series_id)) {
        const cands = rows.filter((r) => r.ref_fy === period);
        const best = Math.min(...cands.map((r) => rank[r.estimate_type]));
        const latest = cands.filter((r) => rank[r.estimate_type] === best).map((r) => r.doc_fy).sort().pop();
        assert.equal(chosen.kind, Object.keys(rank).find((k) => rank[k] === best && cands.some((r) => r.estimate_type === k)).toLowerCase(), period);
        assert.equal(g.printing.get(chosen.obs_id).doc, latest, period);
      }
    });
    test("golden: no number leaks from a figure that shows none (value, printed text, cells, evidence)", () => {
      for (const o of g.observations) {
        if (o.reader.showsValue) continue;
        const dash = (t) => t === null || /^[-‐‑‒–—―]+$/.test(t.trim());
        assert.equal(o.value, null, o.obs_id);
        assert.equal(o.published, false, o.obs_id);
        assert.ok(dash(o.printed_text), o.obs_id);
        for (const ev of g.evidence.get(o.obs_id)) {
          if (ev.kind === "recomputed") assert.ok(ev.ourValue === "" && ev.publishedValue === null, o.obs_id);
          if (ev.kind === "printed-cell") assert.ok(dash(ev.printedText), o.obs_id);
        }
        if (o.primary_cell_id) {
          const c = g.cellById.get(o.primary_cell_id);
          assert.ok(dash(c.value_raw) && c.value_parsed === null, o.obs_id);
        }
      }
    });
    test("golden: only deterministic evidence: no status or reason cites the language-model second reading", () => {
      for (const o of g.observations) assert.doesNotMatch(o.reader.reason, /haiku|second read|language model/i, o.obs_id);
      assert.ok(!g.observations.some((o) => o.reader.key === "candidate" && o.reader.usableInDerived));
    });

    // budget_credibility (derived) is not in golden-2026.11.11; it was added to his repository after the tag. Its
    // mapping is tested on rows of the commit his clone has checked out, against the tagged functional table. Skipped
    // when that commit has no such file.
    let bcRows = null;
    try {
      bcRows = ga.parseCsv(git("cat-file", "blob", "HEAD:golden/budget_credibility/budget_credibility.csv").toString("utf8"));
    } catch {
      console.log("golden budget_credibility test SKIPPED: the clone's HEAD has no golden/budget_credibility/budget_credibility.csv");
    }
    if (bcRows) {
      test("golden: budget_credibility (derived, after the tag): derived evidence; gaps travel from a dash-or-zero input", () => {
        const map = (r) => ga.mapBudgetCredibilityRow(r, true, g.keyObs, g.obsById, GOLDEN_TAG);
        const inputsOf = (r) => [r.budget_source_key, r.revised_source_key].map((k) => g.obsById.get(g.keyObs.get(`abs_federal_functional|${k}`)));
        const ok = bcRows.find((r) => {
          const ins = inputsOf(r);
          return ins.every((o) => o && o.reader.key === "checked");
        });
        assert.ok(ok, "a pair of two checked printings");
        const m = map(ok);
        assert.equal(m.evidence.kind, "derived");
        assert.deepEqual(m.evidence.inputs, inputsOf(ok).map((o) => o.obs_id));
        assert.equal(m.obs.reader.key, "candidate");
        assert.equal(m.obs.value, dec(ok.deviation));
        const zero = bcRows.find((r) => inputsOf(r).some((o) => o && o.reader.key === "dash-or-zero") && inputsOf(r).every(Boolean));
        assert.ok(zero, "a pair with a federal ABS 0");
        const z = map(zero);
        assert.equal(z.obs.reader.key, "dash-or-zero");
        assert.equal(z.obs.value, null);
        assert.equal(z.obs.reader.usableInDerived, false);
      });
    }
  }

  // Fingerprints (task A8): one changed byte, a changed release record, and a wrong pin each stop the load.
  const bad = path.join(gtmp, "tampered");
  fs.cpSync(gdir, bad, { recursive: true });
  const small = gcat.filter((e) => e.layer === "golden" && e.dataset_id in grel.datasets).sort((a, b) => a.rows - b.rows)[0];
  const victim = path.join(bad, ...small.path.split("/"));
  const buf = fs.readFileSync(victim);
  const at = buf.indexOf(0x0a) + 1 + buf.subarray(buf.indexOf(0x0a) + 1).findIndex((b) => b >= 0x30 && b <= 0x39);
  buf[at] = buf[at] === 0x39 ? 0x38 : buf[at] + 1;
  fs.writeFileSync(victim, buf);
  test("golden: a file whose fingerprint differs stops the load, naming the file", () => {
    assert.throws(() => ga.loadGolden(bad, { tag: GOLDEN_TAG }), (e) => e.message.includes(small.path) && /fingerprint/.test(e.message));
  });
  fs.writeFileSync(victim, fs.readFileSync(path.join(gdir, ...small.path.split("/"))));
  const relBad = structuredClone(grel);
  const ds0 = Object.keys(relBad.datasets)[0];
  relBad.datasets[ds0].fingerprint = relBad.datasets[ds0].fingerprint.split("").reverse().join("");
  fs.writeFileSync(path.join(bad, "RELEASE.json"), JSON.stringify(relBad));
  test("golden: a dataset whose RELEASE.json fingerprint differs stops the load", () => {
    assert.throws(() => ga.loadGolden(bad, { tag: GOLDEN_TAG }), (e) => e.message.includes(ds0) && /RELEASE\.json/.test(e.message));
  });
  test("golden: a release other than the pinned tag stops the load", () => {
    assert.throws(() => ga.loadGolden(gdir, { tag: `${GOLDEN_TAG}.2` }), /pinned/);
  });
  fs.rmSync(gtmp, { recursive: true, force: true });
}

console.log(`contract tests: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
