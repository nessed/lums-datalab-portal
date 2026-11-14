// Unit tests for the derived views of a series page (src/lib/series-derive.ts).
// Run: node --no-warnings scripts/series-derive-test.mjs   (Node 22.18+, type stripping)
// Hand-made inputs only; no figure here comes from or goes to the release.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = await import(pathToFileURL(path.join(siteDir, "src/lib/series-derive.ts")).href);

let passed = 0;
const failures = [];
const test = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

const rec = (period, kind, value, usable = true, extra = {}) => ({ id: `s:${period}:${kind}`, period, kind, value: usable ? value : null, usable, word: usable ? "" : "held back", reason: usable ? "" : "It failed a check.", st: usable ? "checked" : "withheld", ...extra });
const meta = { frequency: "fiscal_year", unit: "PKR", breaks: [{ at_period: "2011-12", kind: "devolution" }], kindWords: { be: "budget estimate", re: "revised estimate", na: "figure" } };

test("exact subtraction", () => {
  assert.equal(D.decSub("37438", "31975"), "5463");
  assert.equal(D.decSub("3.23", "11.07"), "-7.84");
  assert.equal(D.decSub("6.9", "6.30"), "0.60");
  assert.equal(D.decSub("1", "1"), "0");
});
test("percent change rounds half away from zero", () => {
  assert.equal(D.decPctChange("37438", "31975", 1), "17.1");
  assert.equal(D.decPctChange("60245", "31975", 1), "88.4");
  assert.equal(D.decPctChange("100", "200", 1), "-50.0");
  assert.equal(D.decPctChange("1.0005", "1", 2), "0.05"); // 0.05 exactly
  assert.equal(D.decPctChange("100.05", "100", 1), "0.1"); // 0.05 -> 0.1
  assert.equal(D.decPctChange("99.95", "100", 1), "-0.1"); // -0.05 -> -0.1 (away from zero)
  assert.equal(D.decPctChange("5", "0", 1), null);
});
test("ratio", () => {
  assert.equal(D.decPercent("37438", "17500000", 2), "0.21");
  assert.equal(D.decPercent("2", "3", 1), "66.7");
  assert.equal(D.decPercent("1", "3", 1), "33.3");
});
test("signed", () => {
  assert.equal(D.signed("17.1"), "+17.1");
  assert.equal(D.signed("-7.84"), "−7.84");
  assert.equal(D.signed("0.0"), "0.0");
  assert.equal(D.signed("5463"), "+5,463");
});
test("previous period", () => {
  assert.equal(D.previousPeriod("2025-26", "fiscal_year", []), "2024-25");
  assert.equal(D.previousPeriod("2000-01", "fiscal_year", []), "1999-00");
  assert.equal(D.previousPeriod("2026-06", "month", []), "2025-06");
  assert.equal(D.previousPeriod("2024-25", "survey_round", ["2017-18", "2020-21", "2024-25"]), "2020-21");
  assert.equal(D.previousPeriod("2017-18", "survey_round", ["2017-18"]), null);
});
test("like with like: a budget estimate is compared with the previous budget estimate", () => {
  const v = D.changeView("pct", meta, [rec("2025-26", "be", "31975"), rec("2025-26", "re", "60245"), rec("2026-27", "be", "37438")]);
  const p = v.points.find((x) => x.p === "2026-27" && x.k === "be");
  assert.equal(p.v, "17.1");
  assert.deepEqual(p.in, ["s:2026-27:be", "s:2025-26:be"]);
  const re = v.points.find((x) => x.p === "2025-26" && x.k === "re");
  assert.equal(re.v, null);
  assert.equal(re.gap, "none");
});
test("gaps travel: a held-back input makes the derived value a gap with its reason", () => {
  const v = D.changeView("pct", meta, [rec("2024-25", "be", "1", false), rec("2025-26", "be", "31975")]);
  const p = v.points.find((x) => x.p === "2025-26");
  assert.equal(p.v, null);
  assert.equal(p.gap, "travel");
  assert.equal(p.st, "withheld");
  assert.match(p.why, /held back/);
  assert.equal(p.iv, undefined);
});
test("never across a break", () => {
  const v = D.changeView("chg", meta, [rec("2010-11", "be", "7283"), rec("2011-12", "be", "2646")]);
  assert.equal(v.points.find((x) => x.p === "2011-12").gap, "break");
  const i = D.indexView(meta, [rec("2010-11", "be", "7283"), rec("2011-12", "be", "2646"), rec("2015-16", "be", "11010")], "2011-12");
  assert.equal(i.points.find((x) => x.p === "2010-11").gap, "break");
  assert.equal(i.points.find((x) => x.p === "2011-12").v, "100.0");
  assert.equal(i.points.find((x) => x.p === "2015-16").v, "416.1");
});
test("share of parent: same period and kind", () => {
  const s = D.shareView(meta, [rec("2026-27", "be", "37438"), rec("2026-27", "re", "1")], [{ ...rec("2026-27", "be", "17500000"), id: "p:2026-27:be" }], "Parent");
  assert.equal(s.points.find((x) => x.k === "be").v, "0.21");
  assert.equal(s.points.find((x) => x.k === "re").gap, "none");
});
test("revision view", () => {
  const r = D.revisionView(meta, [rec("2025-26", "be", "31975"), rec("2025-26", "re", "60245"), rec("2026-27", "be", "37438")]);
  const a = r.points.find((x) => x.p === "2025-26");
  assert.equal(a.v, "88.4");
  assert.equal(a.diff, "28270");
  assert.deepEqual(a.in, ["s:2025-26:re", "s:2025-26:be"]);
  const b = r.points.find((x) => x.p === "2026-27");
  assert.equal(b.v, null);
  assert.equal(b.gap, "none");
});
test("best available figure per year", () => {
  const recs = [
    { period: "2024-25", vintage: "be", published: true, value: "1" },
    { period: "2024-25", vintage: "re", published: true, value: "2" },
    { period: "2025-26", vintage: "be", published: true, value: "3" },
    { period: "2025-26", vintage: "re", published: false, value: null },
  ];
  const b = D.bestPerPeriod(recs);
  assert.equal(b[0].best.vintage, "re");
  assert.equal(b[1].best.vintage, "be");
  assert.equal(b[1].top.vintage, "re");
});

if (failures.length) {
  console.error(`series-derive: ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`series-derive: ${passed} tests passed`);
