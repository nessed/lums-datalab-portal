// Unit tests of the compare page's transforms (src/components/compare/transform.ts),
// run by check-build, and a sweep over every compare file of the release: each
// derived value is recomputed here, independently, and must use only checked
// inputs; anything that would use another figure must be held back.
// Run alone: node scripts/checks/take-transforms.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pt = (p, v, d = 1, s = "checked") => ({ p, k: "be", v, d, s, o: `x~${p}~be`, r: s === "checked" ? undefined : `reason for ${p}` });

export default async function check({ siteDir, cfg, problem }) {
  const T = await import(pathToFileURL(path.join(siteDir, "src", "components", "compare", "transform.ts")).href);
  let passed = 0;
  const test = (name, fn) => {
    try {
      fn();
      passed++;
    } catch (e) {
      problem("take-transforms", name, e.message);
    }
  };

  /* ---------- unit tests ---------- */
  test("periods a year earlier", () => {
    assert.equal(T.yearEarlier("2025-26", "fiscal_year"), "2024-25");
    assert.equal(T.yearEarlier("2000-01", "fiscal_year"), "1999-00");
    assert.equal(T.yearEarlier("2026-06", "month"), "2025-06");
    assert.equal(T.yearEarlier("2024-25", "survey_round"), "2023-24");
  });
  test("time axis", () => {
    assert.equal(T.timeOf("2025-26", "fiscal_year"), 2026);
    assert.equal(T.timeOf("2026-01", "month"), 2026 + 0.5 / 12);
    assert.ok(T.timeOf("2026-06", "month") < T.timeOf("2026-07", "month"));
  });
  test("decimal formatting never goes through floating point", () => {
    assert.equal(T.fmtDecimal("1234567.891"), "1,234,567.891");
    assert.equal(T.fmtDecimal("-31975"), "−31,975");
    assert.equal(T.fmtDerived(112.345), "112.3");
    assert.equal(T.fmtDerived(-0.04), "0.0");
    assert.equal(T.fmtDerived(-12.35), "−12.3");
  });
  test("as printed keeps stored values and leaves gaps", () => {
    const s = T.asPrinted([pt("2020-21", "100"), pt("2021-22", null, 0, "held")]);
    assert.equal(s[0].y, 100);
    assert.equal(s[0].text, "100");
    assert.equal(s[1].y, null);
    assert.match(s[1].held, /held back: reason for 2021-22/);
  });
  test("index = value / base × 100", () => {
    const s = T.indexTo([pt("2020-21", "200"), pt("2021-22", "250"), pt("2022-23", "180")], "2020-21", "fiscal_year");
    assert.deepEqual(
      s.map((x) => x.y),
      [100, 125, 90],
    );
    assert.equal(s[1].text, "125.0");
    assert.equal(s[1].formula, "250 ÷ 200 × 100");
    assert.deepEqual(
      s[1].inputs.map((i) => i.p),
      ["2021-22", "2020-21"],
    );
  });
  test("index: gaps travel from the base and from the figure", () => {
    const s = T.indexTo([pt("2020-21", null, 0, "held"), pt("2021-22", "250")], "2020-21", "fiscal_year");
    assert.equal(s[1].y, null);
    assert.match(s[1].held, /base figure .*held back/);
    const u = T.indexTo([pt("2020-21", "200"), pt("2021-22", "250", 0, "candidate")], "2020-21", "fiscal_year");
    assert.equal(u[1].y, null, "a figure not usable in derived values gives no index");
    const none = T.indexTo([pt("2021-22", "250")], "2019-20", "fiscal_year");
    assert.equal(none[0].y, null);
  });
  test("% change from a year earlier", () => {
    const s = T.pctChange([pt("2020-21", "200"), pt("2021-22", "250"), pt("2023-24", "300")], "fiscal_year");
    assert.equal(s[0].y, null, "no earlier figure");
    assert.equal(s[1].y, 25);
    assert.equal(s[1].text, "+25.0%");
    assert.equal(s[2].y, null, "2022-23 is missing, so 2023-24 has no change");
    const h = T.pctChange([pt("2020-21", null, 0, "not-printed"), pt("2021-22", "250")], "fiscal_year");
    assert.equal(h[1].y, null);
    assert.match(h[1].held, /a year earlier .*not printed/);
    const m = T.pctChange([pt("2025-06", "80"), pt("2026-06", "60")], "month");
    assert.equal(m[1].y, -25);
    assert.equal(m[1].text, "−25.0%");
  });
  test("share of a total", () => {
    const tot = [pt("2020-21", "1000"), pt("2021-22", null, 0, "disputed")];
    const s = T.shareOf([pt("2020-21", "250"), pt("2021-22", "300")], tot, "Total", "fiscal_year");
    assert.equal(s[0].y, 25);
    assert.equal(s[0].text, "25.0%");
    assert.equal(s[1].y, null);
    assert.match(s[1].held, /the total, Total, .*disputed/);
  });
  test("rates and mismatched totals are left out with a reason", () => {
    const rate = { u: "percent", sf: 1, f: "survey_round", n: "Rate", uw: "per cent" };
    assert.match(T.excluded(rate, "index", null), /rate/);
    assert.equal(T.excluded(rate, "printed", null), null);
    const amt = { u: "PKR", sf: 1000000, f: "fiscal_year", n: "A", uw: "Rs million" };
    assert.equal(T.excluded(amt, "share", { ...amt, n: "T" }), null);
    assert.match(T.excluded(amt, "share", { ...amt, sf: 1000, uw: "Rs thousand", n: "T" }), /Rs thousand/);
  });
  test("comparability sentence", () => {
    const a = { id: "a", u: "PKR", sf: 1, f: "fiscal_year", def: null, base: null };
    const b = { id: "b", u: "index", sf: 1, f: "month", def: null, base: "2015-16" };
    const c = { id: "c", u: "index", sf: 1, f: "month", def: null, base: "2007-08" };
    const k = new Map([
      ["a", "be"],
      ["b", "index"],
      ["c", "index"],
    ]);
    const out = T.notComparable([a, b, c], k, "printed").join(" | ");
    assert.match(out, /different units/);
    assert.match(out, /different frequencies/);
    assert.match(out, /base years/);
    assert.match(out, /different kinds/);
  });

  /* ---------- every compare file of the release ---------- */
  const dir = path.join(siteDir, "public", "data", cfg.version, "compare");
  let derived = 0;
  let held = 0;
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json") || name === "index.json") continue;
      const sd = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      for (const kind of [...new Set(sd.pts.map((x) => x.k))]) {
        const pts = T.pointsOf(sd, kind);
        const byO = new Map(pts.map((x) => [x.o, x]));
        const base = pts.find((x) => x.d === 1)?.p;
        const runs = [...(base ? [["index", T.indexTo(pts, base, sd.f)]] : []), ["change", T.pctChange(pts, sd.f)]];
        for (const [what, list] of runs) {
          for (const s of list) {
            if (s.y === null) {
              held++;
              continue;
            }
            derived++;
            const ins = s.inputs.map((i) => byO.get(i.o));
            if (ins.some((i) => !i || i.d !== 1 || i.v === null)) problem("take-transforms", `${name} ${what} ${s.p}`, "a derived value uses a figure that is not checked");
            const x = byO.get(s.o);
            const want =
              what === "index" ? (Number(x.v) / Number(pts.find((q) => q.p === base).v)) * 100 : (Number(x.v) / Number(byO.get(s.inputs[1].o).v) - 1) * 100;
            if (Math.abs(want - s.y) > 1e-9 * Math.max(1, Math.abs(want))) problem("take-transforms", `${name} ${what} ${s.p}`, `${s.y}, recomputed ${want}`);
          }
        }
      }
    }
  }
  return `${passed} unit tests passed; ${derived} derived values recomputed from checked inputs, ${held} held back or without an input`;
}

// Run alone.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
  const problems = [];
  console.log(await check({ siteDir, cfg, problem: (r, w, m) => problems.push(`${r} ${w}: ${m}`) }));
  for (const p of problems.slice(0, 40)) console.error(p);
  process.exit(problems.length ? 1 : 0);
}
