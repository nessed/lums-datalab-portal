// Unit tests of the compare page's transforms (src/components/compare/transform.ts),
// run by check-build, and a sweep over every compare file of the release: each
// derived value is recomputed here, independently, and must use only checked
// inputs; anything that would use another figure must be held back.
// Run alone: node scripts/checks/take-transforms.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The rounding rule for derived figures (DECISIONS.md, round 2), written again
// here, not imported from the site: the exact value x ÷ b × 100 (or that minus
// 100 for a change) from the stored decimal strings, to one decimal; to two
// when its magnitude is below 1; a value that is not zero but would read 0.00
// to its first significant digit; halves away from zero. Shown with commas, the
// true minus sign, and a plus sign on a change above zero.
function frac(v) {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(v).trim());
  if (!m) return null;
  const n = BigInt(m[2] + (m[3] ?? ""));
  return { n: m[1] === "-" ? -n : n, d: 10n ** BigInt((m[3] ?? "").length) };
}
function ruleText(x, b, change) {
  const X = frac(x);
  const B = frac(b);
  let num = (X.n * B.d - (change ? B.n * X.d : 0n)) * 100n;
  let den = X.d * B.n;
  if (den < 0n) [num, den] = [-num, -den];
  const neg = num < 0n;
  const a = neg ? -num : num;
  const digits = (k) => {
    const q = a * 10n ** BigInt(k);
    return q / den + ((q % den) * 2n >= den ? 1n : 0n);
  };
  let n;
  let k;
  if (a === 0n) [n, k] = [0n, 2];
  else if (digits(2) >= 100n) [n, k] = [digits(1), 1];
  else if (digits(2) > 0n) [n, k] = [digits(2), 2];
  else {
    k = 3;
    while (a * 10n ** BigInt(k) < den) k++;
    n = digits(k);
    if (n === 10n) [n, k] = [1n, k - 1];
  }
  const t = n.toString().padStart(k + 1, "0");
  const body = `${t.slice(0, t.length - k).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${t.slice(t.length - k)}`;
  return `${n === 0n ? "" : neg ? "−" : change ? "+" : ""}${body}`;
}

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
  });
  test("the rounding rule: one decimal, two below 1, exact halves away from zero", () => {
    assert.equal(T.ruledPercent("112.345", "100"), "112.3");
    assert.equal(T.ruledPercent("1.12345", "1"), "112.3");
    assert.equal(T.ruledPercent("-12.35", "100"), "-12.4", "a negative half goes away from zero");
    assert.equal(T.ruledPercent("-1234.5", "100"), "-1234.5");
    assert.equal(T.ruledPercent("100.125", "100", true), "0.13", "a half at the second decimal goes away from zero");
    assert.equal(T.ruledPercent("101.05", "100", true), "1.1", "1.05 exactly is a half: away from zero (floating point gives 1.0)");
    assert.equal(T.ruledPercent("98.95", "100", true), "-1.1", "a negative half goes away from zero too");
    assert.equal(T.ruledPercent("100.995", "100", true), "1.0", "0.995 rounds to 1.00, so it is shown to one decimal");
    assert.equal(T.ruledPercent("100.994", "100", true), "0.99", "just below 1: two decimals");
    assert.equal(T.ruledPercent("99.005", "100", true), "-1.0", "-0.995 rounds to -1.00: one decimal");
    assert.equal(T.ruledPercent("99.006", "100", true), "-0.99");
    assert.equal(T.ruledPercent("101", "100", true), "1.0", "exactly 1: one decimal");
    assert.equal(T.ruledPercent("100", "100", true), "0.00", "a change of exactly zero");
    assert.equal(T.ruledPercent("0", "100"), "0.00", "a share of exactly zero");
    assert.equal(T.ruledPercent("1", "68557"), "0.001", "a share below 0.005%: its first significant digit, not 0.00");
    assert.equal(T.ruledPercent("3", "100000"), "0.003");
    assert.equal(T.ruledPercent("96", "10000000"), "0.001", "0.00096 rounds up to 0.0010, shown as 0.001");
    assert.equal(T.ruledPercent("5", "0"), null);
    assert.equal(ruleText("101.05", "100", true), "+1.1");
    assert.equal(ruleText("1", "68557", false), "0.001");
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
    assert.equal(T.indexTo([pt("2020-21", "200"), pt("2021-22", "1.5")], "2020-21", "fiscal_year")[1].text, "0.75", "an index below 1: two decimals");
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
    const z = T.pctChange([pt("2020-21", "250"), pt("2021-22", "250"), pt("2022-23", "250.5")], "fiscal_year");
    assert.equal(z[1].text, "0.00%", "no change: no sign, two decimals");
    assert.equal(z[2].text, "+0.20%");
    assert.equal(s[2].y, null, "2022-23 is missing, so 2023-24 has no change");
    const h = T.pctChange([pt("2020-21", null, 0, "not-printed"), pt("2021-22", "250")], "fiscal_year");
    assert.equal(h[1].y, null);
    assert.match(h[1].held, /a year earlier .*not printed/);
    const m = T.pctChange([pt("2025-06", "80"), pt("2026-06", "60")], "month");
    assert.equal(m[1].y, -25);
    assert.equal(m[1].text, "−25.0%");
  });
  test("never across a series break (tester finding: health 2011-12 devolution)", () => {
    const br = [{ p: "2011-12", note: "devolution" }];
    const c = T.pctChange([pt("2010-11", "7283"), pt("2011-12", "2646"), pt("2012-13", "3000")], "fiscal_year", br);
    assert.equal(c[1].y, null, "2010-11 to 2011-12 spans the break");
    assert.match(c[1].held, /break/);
    assert.notEqual(c[2].y, null, "2011-12 to 2012-13 is after the break");
    const i = T.indexTo([pt("2010-11", "7283"), pt("2011-12", "2646"), pt("2012-13", "3000")], "2011-12", "fiscal_year", br);
    assert.equal(i[0].y, null, "an index on a base after the break holds the years before it");
    assert.equal(i[1].y, 100);
  });
  test("share of a total", () => {
    const tot = [pt("2020-21", "1000"), pt("2021-22", null, 0, "disputed")];
    const s = T.shareOf([pt("2020-21", "250"), pt("2021-22", "300")], tot, "Total", "fiscal_year");
    assert.equal(s[0].y, 25);
    assert.equal(s[0].text, "25.0%");
    const small = T.shareOf([pt("2020-21", "2.36")], [pt("2020-21", "1000")], "Total", "fiscal_year");
    assert.equal(small[0].text, "0.24%", "a share below 1%: two decimals, no plus sign");
    const tiny = T.shareOf([pt("2020-21", "1")], [pt("2020-21", "68557")], "Total", "fiscal_year");
    assert.equal(tiny[0].text, "0.001%", "a share below 0.005% never reads as zero");
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
  test("default base period: common, checked, and not across a break", () => {
    const a = { sd: { br: [{ p: "2011-12" }] }, pts: [pt("2009-10", "1"), pt("2011-12", "2"), pt("2015-16", "3")] };
    const b = { sd: { br: [] }, pts: [pt("2009-10", "1"), pt("2011-12", "2", 0, "held"), pt("2015-16", "3")] };
    assert.equal(T.defaultBase([a, b]), "2015-16");
    assert.equal(T.defaultBase([{ sd: { br: [] }, pts: [pt("2009-10", "1")] }]), "2009-10");
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
  // Index (on the first checked figure), % change, and share of the parent
  // total where the parent is in the same unit: each value's position is
  // recomputed in floating point and its text exactly under the rounding rule,
  // both independently of the transform code.
  const dir = path.join(siteDir, "public", "data", cfg.version, "compare");
  let derived = 0;
  let held = 0;
  let texts = 0;
  if (fs.existsSync(dir)) {
    const files = new Map();
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json") || name === "index.json") continue;
      const sd = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      files.set(sd.id, { name, sd });
    }
    for (const { name, sd } of files.values()) {
      const parent = sd.parent ? files.get(sd.parent)?.sd : null;
      const shareable = !!parent && T.excluded(sd, "share", parent) === null;
      for (const kind of [...new Set(sd.pts.map((x) => x.k))]) {
        const pts = T.pointsOf(sd, kind);
        const byO = new Map(pts.map((x) => [x.o, x]));
        const tot = shareable ? T.pointsOf(parent, kind) : [];
        const totO = new Map(tot.map((x) => [x.o, x]));
        const base = pts.find((x) => x.d === 1)?.p;
        const runs = [
          ...(base ? [["index", T.indexTo(pts, base, sd.f, sd.br)]] : []),
          ["change", T.pctChange(pts, sd.f, sd.br)],
          ...(shareable ? [["share", T.shareOf(pts, tot, parent.n, sd.f)]] : []),
        ];
        for (const [what, list] of runs) {
          for (const s of list) {
            if (s.y === null) {
              held++;
              continue;
            }
            derived++;
            const ins = s.inputs.map((i) => byO.get(i.o) ?? (what === "share" ? totO.get(i.o) : undefined));
            if (ins.some((i) => !i || i.d !== 1 || i.v === null)) {
              problem("take-transforms", `${name} ${what} ${s.p}`, "a derived value uses a figure that is not checked");
              continue;
            }
            // Independently of the transform code: no derived value spans a series break.
            const ps = [s.p, ...s.inputs.map((i) => i.p)].sort();
            if ((sd.br ?? []).some((b) => ps[0] < b.p && b.p <= ps[ps.length - 1])) problem("take-transforms", `${name} ${what} ${s.p}`, `a derived value spans the series break at ${(sd.br ?? []).find((b) => ps[0] < b.p && b.p <= ps[ps.length - 1]).p}`);
            const x = byO.get(s.o);
            const other = what === "index" ? pts.find((q) => q.p === base) : what === "change" ? byO.get(s.inputs[1]?.o) : tot.find((q) => q.p === s.p);
            if (!x || x.p !== s.p || !other || other.v === null || (what !== "index" && s.inputs[1]?.o !== other.o)) {
              problem("take-transforms", `${name} ${what} ${s.p}`, "the inputs are not the figures they should be");
              continue;
            }
            const want = what === "change" ? (Number(x.v) / Number(other.v) - 1) * 100 : (Number(x.v) / Number(other.v)) * 100;
            if (Math.abs(want - s.y) > 1e-9 * Math.max(1, Math.abs(want))) problem("take-transforms", `${name} ${what} ${s.p}`, `${s.y}, recomputed ${want}`);
            const wantText = `${ruleText(x.v, other.v, what === "change")}${what === "index" ? "" : "%"}`;
            if (s.text !== wantText) problem("take-transforms", `${name} ${what} ${s.p}`, `shows "${s.text}", the rounding rule gives "${wantText}"`);
            else texts++;
          }
        }
      }
    }
  }
  return `${passed} unit tests passed; ${derived} derived values recomputed from checked inputs (${texts} texts equal to the rounding rule), ${held} held back or without an input`;
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
