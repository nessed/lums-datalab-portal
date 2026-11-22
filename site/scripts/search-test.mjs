// Search acceptance test (DESIGN.md 18.2, A6, and section 10). Run: npm run test:search
//
// Runs the real ranking (src/lib/search.ts, the same file the browser runs)
// over the real index (public/data/<version>/search.json, written by
// `node scripts/prebuild.mjs`). Each A6 query must land on the right series or
// on an honest "not published yet" card. Needs Node 22.18+ (type stripping).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
const file = path.join(siteDir, "public", "data", cfg.version, "search.json");
if (!fs.existsSync(file)) {
  console.error(`search-test: ${file} not found; run node scripts/prebuild.mjs first`);
  process.exit(1);
}
const { buildEngine, runSearch, answerValues, readYears, datedOf, facetsOf, applyFacets, facetChoices, families } = await import(pathToFileURL(path.join(siteDir, "src/lib/search.ts")).href);
const raw = fs.readFileSync(file, "utf8");
const eng = buildEngine(JSON.parse(raw));

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
const first = (r) => r.series[0]?.e.id;
const ids = (r, n = 10) => r.series.slice(0, n).map((h) => h.e.id);

/* ---------- A6 ---------- */

test('A6 "inflaton" lands on inflation, the rate first', () => {
  const r = runSearch(eng, "inflaton");
  assert.equal(r.concept?.id, "inflation");
  assert.equal(first(r), "cpi.national.yoy.general");
  assert.ok(r.concept.a && answerValues(r.concept.a, r.years).vals.length === 1, "answer card has a value");
  assert.equal(r.suggestion, "inflation");
});

test('A6 "unemployment women" lands on the female unemployment rate', () => {
  const r = runSearch(eng, "unemployment women");
  assert.equal(r.concept?.id, "unemployment-women");
  assert.equal(first(r), "lfs.unemployment_rate.female.total");
  assert.ok(r.concept.a, "answer card has a value");
});

test('A6 "health spending" lands on federal health spending', () => {
  const r = runSearch(eng, "health spending");
  assert.equal(r.concept?.id, "health-spending");
  assert.equal(first(r), "fed.exp.current.function.health");
  const v = answerValues(r.concept.a, r.years).vals[0];
  assert.match(v.v, /^Rs [\d.]+ (billion|trillion|million)$/, "short scale");
  assert.ok(v.k && v.pw && v.m && v.o.startsWith("/o/fed.exp.current.function.health~"), "kind, period, source marker and receipt");
});

test('A6 "tax revenue 2023" lands on tax revenue, with 2022-23 and 2023-24', () => {
  const r = runSearch(eng, "tax revenue 2023");
  assert.equal(r.concept?.id, "tax-revenue");
  assert.equal(first(r), "fed.rev.tax");
  assert.deepEqual(r.chips.map((c) => c.kind), ["year"]);
  const { vals, forYears } = answerValues(r.concept.a, r.years);
  assert.ok(forYears, "answer shows the years asked for");
  assert.ok(vals.length >= 1 && vals.every((v) => ["2022-23", "2023-24"].includes(v.p)), `periods ${vals.map((v) => v.p)}`);
});

test('A6 "GDP" gives an honest "not in this release" card', () => {
  const r = runSearch(eng, "GDP");
  assert.equal(r.concept?.id, "gdp");
  assert.ok(r.concept.miss && /not in this release/.test(r.concept.miss), "honest sentence");
  assert.equal(r.concept.a, undefined, "no value");
  assert.equal(r.concept.s.length, 0);
});

/* ---------- section 10 ---------- */

test('"inflation": the inflation rate outranks the index level (10.7)', () => {
  const r = runSearch(eng, "inflation");
  const list = ids(r, 50);
  assert.equal(list[0], "cpi.national.yoy.general");
  assert.ok(list.indexOf("cpi.national.yoy.general") < list.indexOf("cpi.national.general.b2015_16"));
});

test('"cpi" without a concept word still finds CPI National first', () => {
  const r = runSearch(eng, "cpi");
  assert.ok(["cpi.national.general.b2015_16", "cpi.national.yoy.general"].includes(first(r)), first(r));
});

test("synonyms both ways: female unemployment, spending on health, health expenditure", () => {
  assert.equal(first(runSearch(eng, "female unemployment")), "lfs.unemployment_rate.female.total");
  assert.equal(first(runSearch(eng, "spending on health")), "fed.exp.current.function.health");
  assert.equal(first(runSearch(eng, "health expenditure")), "fed.exp.current.function.health");
});

test("typos and stems: helth spendng, unemplyment, educaton budget", () => {
  assert.equal(first(runSearch(eng, "helth spendng")), "fed.exp.current.function.health");
  assert.equal(first(runSearch(eng, "unemplyment")), "lfs.unemployment_rate.total.total");
  assert.equal(first(runSearch(eng, "educaton budget")), "fed.exp.current.function.education_affairs_and_services");
});

test("prefix while typing: unemp, defen", () => {
  assert.equal(first(runSearch(eng, "unemp", { typing: true })), "lfs.unemployment_rate.total.total");
  assert.equal(first(runSearch(eng, "defen", { typing: true })), "fed.exp.current.function.defence_affairs_and_services");
});

test("years: 2023, FY26, FY2025-26, 2025-26, 2026-06", () => {
  assert.deepEqual(readYears("x 2023").years[0].fiscal, ["2022-23", "2023-24"]);
  assert.deepEqual(readYears("fy26").years[0].fiscal, ["2025-26"]);
  assert.deepEqual(readYears("FY2025-26").years[0].fiscal, ["2025-26"]);
  assert.deepEqual(readYears("2025-26").years[0].fiscal, ["2025-26"]);
  assert.deepEqual(readYears("2025/2026").years[0].fiscal, ["2025-26"]);
  assert.deepEqual(readYears("FY2026").years[0].fiscal, ["2025-26"]);
  assert.deepEqual(readYears("cpi 2026-06").years[0].months, ["2026-06"]);
  const r = runSearch(eng, "health spending FY26");
  assert.deepEqual(
    answerValues(r.concept.a, r.years).vals.map((v) => v.p),
    answerValues(r.concept.a, r.years).vals.map(() => "2025-26"),
  );
});

test("visible inference: Punjab becomes a removable province filter", () => {
  const r = runSearch(eng, "labour force punjab");
  assert.deepEqual(r.chips.map((c) => c.kind), ["province"]);
  assert.equal(r.province, "pk-pb");
  assert.ok(r.series.length > 0 && r.series.every((h) => h.e.g === "pk-pb"), "every series is Punjab's");
  const all = runSearch(eng, "labour force punjab", { infer: false });
  assert.equal(all.chips.length, 0);
  assert.ok(all.series.length >= r.series.length);
});

test("a province question about something national gives an honest card, not a wrong answer", () => {
  const r = runSearch(eng, "punjab budget");
  assert.equal(r.concept?.id, "provincial-budgets");
  assert.ok(r.concept.miss);
});

test("never a dead end: zero results offer a spelling suggestion or related topics", () => {
  const r = runSearch(eng, "inflashun rait");
  assert.ok(r.series.length > 0 || r.suggestion || r.related.length, "something to try");
  const z = runSearch(eng, "qwxyz");
  assert.equal(z.series.length + z.docs.length + z.tables.length, 0);
});

test("official names users know: CPI National, Monthly Review, Annual Budget Statement, Demands for Grants, PSDP, SPI, LFS", () => {
  assert.equal(runSearch(eng, "CPI National").concept?.id, "cpi");
  const mr = runSearch(eng, "Monthly Review");
  assert.equal(mr.concept?.id, "monthly-review");
  assert.ok(mr.docs[0]?.e.dt === "cpi_monthly_review", "the Monthly Review documents come first");
  assert.equal(runSearch(eng, "Annual Budget Statement").concept?.id, "abs");
  assert.ok(runSearch(eng, "Demands for Grants").concept?.miss);
  assert.equal(first(runSearch(eng, "PSDP")), "fed.exp.development.psdp_total");
  assert.ok(runSearch(eng, "SPI").concept?.miss);
  assert.equal(runSearch(eng, "LFS").concept?.id, "lfs");
});

test("documents and tables are their own groups", () => {
  const r = runSearch(eng, "summary of expenditure");
  assert.ok(r.tables.length > 0, "tables found");
  assert.ok(r.tables.every((h) => h.e.k === "t"));
  const d = runSearch(eng, "budget statement 2025-26");
  assert.ok(d.docs.some((h) => h.e.id === "abs-fed-2025-26"), "the 2025-26 statement is found");
});

test("results show the answer: every series result with a checked value has value, kind, period, unit and receipt", () => {
  for (const q of ["inflation", "health spending", "unemployment women", "tax revenue"]) {
    for (const h of runSearch(eng, q).series.slice(0, 10)) {
      if (!h.e.c) continue;
      assert.ok(h.e.lv && h.e.lk !== undefined && h.e.lp && h.e.u && h.e.lo?.startsWith("/o/"), `${h.e.id}`);
    }
  }
});

test("candidates (not signed off) never enter the headline layer or an answer card", () => {
  const index = JSON.parse(raw);
  for (const e of index) {
    if (e.k === "s" && e.cand) assert.ok(!e.hl, `${e.id} is a candidate in the headline layer`);
    if (e.k === "c" && e.a) assert.ok(!index.find((s) => s.k === "s" && s.id === e.a.s)?.cand, `${e.id} answers from a candidate`);
  }
});

/* ---------- round 2: current first, filters, families ---------- */

const pos = (r, id) => r.series.findIndex((h) => h.e.id === id);

test('"inflation": CPI Urban 2026 ranks above the 2007-08 base series that ends in 2019', () => {
  const r = runSearch(eng, "inflation");
  const urban = pos(r, "cpi.urban.yoy.general");
  const old = pos(r, "cpi.yoy.general.b2007_08");
  assert.ok(urban >= 0 && old >= 0, "both found");
  assert.ok(urban < old, `urban at ${urban}, 2007-08 base at ${old}`);
  const d = datedOf(eng, r.series[old].e);
  assert.ok(d && d.earlier, "the 2007-08 base series is marked as on an earlier base");
  assert.equal(datedOf(eng, r.series[urban].e), null, "CPI Urban is current");
});

test('"inflation": every current series ranks above every dated one, and the dated family comes last', () => {
  const r = runSearch(eng, "inflation");
  const tiers = r.series.map((h) => h.t ?? 0);
  assert.ok(tiers.every((t, i) => i === 0 || t >= tiers[i - 1]), "no current series below a dated one");
  const fams = families(r.series);
  assert.equal(fams[fams.length - 1].key, "z-dated");
  assert.ok(fams[fams.length - 1].hits.some((h) => h.e.id === "cpi.yoy.general.b2007_08"));
  assert.equal(fams[0].hits[0].e.id, "cpi.national.yoy.general", "the first family starts with the answer");
});

test("a concept's own headline series stays first even when its checked figures stop early (PSDP)", () => {
  const r = runSearch(eng, "PSDP");
  assert.equal(r.series[0].e.id, "fed.exp.development.psdp_total");
  assert.ok(datedOf(eng, r.series[0].e)?.ended, "still says when its figures end");
});

test("filters read from series ids equal the release's own dims, unit and geography, for every series", () => {
  const rel = path.resolve(siteDir, "..", "releases", cfg.version);
  const list = JSON.parse(fs.readFileSync(path.join(rel, "series.json"), "utf8"));
  const byId = new Map(list.map((s) => [s.series_id, s]));
  const DS = { cpi: "cpi", lfs: "lfs", abs: "abs" };
  let n = 0;
  for (const e of eng.series.map((p) => p.e)) {
    const s = byId.get(e.id);
    assert.ok(s, `${e.id} not in the release`);
    const f = facetsOf(e);
    const d = s.dims ?? {};
    assert.equal(f.topic, DS[s.dataset] ?? s.dataset, `${e.id} topic`);
    assert.equal(f.prov, s.geo ?? "pk", `${e.id} province`);
    if (s.dataset === "cpi") {
      const area = d.area === "national" ? "all" : d.area ?? (d.area_as_printed === "none stated" ? "none" : null);
      assert.equal(f.area, area, `${e.id} area`);
      assert.equal(f.measure, d.measure ?? (s.unit === "index" ? "index" : null), `${e.id} measure`);
      assert.equal(f.sex, null);
    } else if (s.dataset === "lfs") {
      assert.equal(f.sex, d.sex, `${e.id} sex`);
      assert.equal(f.area, d.area === "total" ? "all" : d.area, `${e.id} area`);
      assert.equal(f.measure, s.unit === "percent" ? "rate" : "count", `${e.id} measure`);
    } else {
      assert.equal(f.area, null);
      assert.equal(f.sex, null);
      assert.equal(f.measure, null);
    }
    n++;
  }
  assert.ok(n > 900, `${n} series checked`);
});

test('filters: "unemployment" offers women and men, and choosing women leaves only women\'s series', () => {
  const r = runSearch(eng, "unemployment");
  const ch = facetChoices(r.series, {});
  const sex = ch.find((c) => c.key === "sex");
  assert.ok(sex && sex.values.some((v) => v.v === "female") && sex.values.some((v) => v.v === "male"), "sex filter offered");
  const women = applyFacets(r.series, { sex: "female" });
  assert.equal(women.length, sex.values.find((v) => v.v === "female").n, "count equals the filtered list");
  assert.ok(women.length > 0 && women.every((h) => facetsOf(h.e).sex === "female"));
});

test("budget: index at most 40 KB compressed", () => {
  const gz = zlib.gzipSync(raw, { level: 9 }).length;
  assert.ok(gz <= 40 * 1024, `${(gz / 1024).toFixed(1)} KB gzip`);
});

test("budget: results in under 100 ms on a slow phone (25 ms here, a 4x slower phone)", () => {
  const qs = ["inflaton", "unemployment women", "health spending", "tax revenue 2023", "GDP", "labour force punjab", "e", "educaton budget", "qwxyz"];
  for (const q of qs) runSearch(eng, q);
  const t0 = performance.now();
  for (let i = 0; i < 5; i++) for (const q of qs) runSearch(eng, q, { typing: true });
  const per = (performance.now() - t0) / (5 * qs.length);
  console.log(`search-test: ${per.toFixed(1)} ms a query here`);
  assert.ok(per < 25, `${per.toFixed(1)} ms a query`);
});

console.log(`search-test: ${passed} passed, ${failures.length} failed`);
for (const f of failures) console.error(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);
