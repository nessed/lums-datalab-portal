// Derived figures on series pages (DESIGN.md 6.1 "Gaps travel", 6.3, 8.2, 11).
// Written independently of src/lib/series-derive.ts. Two places are checked:
//
// 1. Every element the HTML scan found with data-num="derived" (collected by
//    check-build.mjs as ctx.derived): data-op names the operation, data-in the
//    input figures (the figure itself first). The inputs must all be published
//    checked figures of a signed-off dataset, compared like with like (same
//    kind of figure; the comparable earlier period; never across a series
//    break), and the text must be the value recomputed here, formatted the same.
// 2. Every /series/<id>/views.json the browser draws derived views from: each
//    point with a value passes the same test, its input values equal the
//    release, and each gap is a real gap (an input that may not be used, no
//    figure to compare with, a break, or a zero base).
import fs from "node:fs";
import path from "node:path";

/* exact decimals, half away from zero */
const T = 10n;
function dec(v) {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(v ?? "").trim());
  if (!m) return null;
  const f = m[3] ?? "";
  const n = BigInt(m[2] + f);
  return { n: m[1] === "-" ? -n : n, s: f.length };
}
function same(a, b) {
  const s = Math.max(a.s, b.s);
  return [a.n * T ** BigInt(s - a.s), b.n * T ** BigInt(s - b.s), s];
}
function str(n, s) {
  const neg = n < 0n;
  let d = (neg ? -n : n).toString();
  if (s > 0) {
    d = d.padStart(s + 1, "0");
    d = `${d.slice(0, d.length - s)}.${d.slice(d.length - s)}`;
  }
  return (neg ? "-" : "") + d;
}
function minus(a, b) {
  const x = dec(a);
  const y = dec(b);
  if (!x || !y) return null;
  const [p, q, s] = same(x, y);
  return str(p - q, s);
}
function hundredTimes(num, den, dp) {
  const x = dec(num);
  const y = dec(den);
  if (!x || !y) return null;
  let [p, q] = same(x, y);
  if (q === 0n) return null;
  if (q < 0n) {
    p = -p;
    q = -q;
  }
  const top = p * 100n * T ** BigInt(dp);
  const abs = top < 0n ? -top : top;
  let r = abs / q;
  if ((abs % q) * 2n >= q) r += 1n;
  return str(top < 0n ? -r : r, dp);
}
const DP = { pct: 1, rev: 1, idx: 1, share: 2 };
function compute(op, a, b) {
  if (op === "chg") return minus(a, b);
  if (op === "pct" || op === "rev") {
    const d = minus(a, b);
    return d === null ? null : hundredTimes(d, b, DP[op]);
  }
  return hundredTimes(a, b, DP[op]);
}
const commas = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function plain(v) {
  const neg = v.startsWith("-");
  const [i, f] = (neg ? v.slice(1) : v).split(".");
  return `${neg ? "−" : ""}${commas(i)}${f !== undefined ? `.${f}` : ""}`;
}
function sign(v) {
  const neg = v.startsWith("-");
  const abs = neg ? v.slice(1) : v;
  const [i, f] = abs.split(".");
  const body = `${commas(i)}${f !== undefined ? `.${f}` : ""}`;
  return /^0*(\.0*)?$/.test(abs) ? body : `${neg ? "−" : "+"}${body}`;
}
function text(op, v) {
  if (op === "pct" || op === "rev") return `${sign(v)}%`;
  if (op === "chg") return sign(v);
  if (op === "share") return `${plain(v)}%`;
  return plain(v);
}

export default function check({ appDir, release, series, allObs, isPub, problem, derived }) {
  const byId = new Map(allObs.map((o) => [o.obs_id, o]));
  const bySeries = new Map();
  for (const o of allObs) {
    if (!bySeries.has(o.series_id)) bySeries.set(o.series_id, []);
    bySeries.get(o.series_id).push(o);
  }
  // Usable in a derived figure: published and checked, in a dataset a person signed off (not a candidate).
  const usable = (o) => !!o && isPub(o) && o.status === "checked" && release.dataset_status?.[series.get(o.series_id)?.dataset]?.state === "published";
  const freq = (o) => series.get(o.series_id)?.frequency;
  function earlier(o) {
    const f = freq(o);
    if (f === "survey_round") {
      const ps = [...new Set((bySeries.get(o.series_id) ?? []).map((x) => x.period))].filter((p) => p < o.period).sort();
      return ps.length ? ps[ps.length - 1] : null;
    }
    const m = /^(\d{4})-(\d{2})$/.exec(o.period);
    if (!m) return /^\d{4}$/.test(o.period) ? String(Number(o.period) - 1) : null;
    if (f === "month") return `${Number(m[1]) - 1}-${m[2]}`;
    return `${Number(m[1]) - 1}-${String(Number(m[1]) % 100).padStart(2, "0")}`;
  }
  const crossesBreak = (o, p) => {
    const [lo, hi] = p < o.period ? [p, o.period] : [o.period, p];
    return (series.get(o.series_id)?.breaks ?? []).some((b) => b.at_period > lo && b.at_period <= hi);
  };

  /** Why a pair of inputs may not make this derived value, or null if it may. */
  function pairProblem(op, a, b, base) {
    if (!a || !b) return "an input is not in the release";
    if (!usable(a) || !usable(b)) return "an input is not a checked, signed-off figure";
    if (op === "pct" || op === "chg") {
      if (a.series_id !== b.series_id || a.vintage !== b.vintage) return "not like with like";
      if (b.period !== earlier(a)) return `compares ${a.period} with ${b.period}, not the comparable earlier period`;
      if (crossesBreak(a, b.period)) return "compares across a series break";
    } else if (op === "idx") {
      if (a.series_id !== b.series_id || a.vintage !== b.vintage) return "not like with like";
      if (base && b.period !== base) return `base ${b.period}, view says ${base}`;
      if (crossesBreak(a, b.period)) return "indexes across a series break";
    } else if (op === "share") {
      if (series.get(a.series_id)?.parent_id !== b.series_id || a.period !== b.period || a.vintage !== b.vintage) return "not a share of the parent in the same period and kind";
    } else if (op === "rev") {
      if (a.series_id !== b.series_id || a.period !== b.period || a.vintage !== "re" || b.vintage !== "be") return "not a revised estimate against the budget estimate of the same year";
    } else return `unknown operation ${op}`;
    return null;
  }

  /* 1. derived values in the HTML */
  let html = 0;
  for (const el of derived ?? []) {
    if (!el.attrs["data-op"]) continue; // another area's derived figure (data-derived)
    el.claimed = true;
    html++;
    const op = el.attrs["data-op"];
    const ids = (el.attrs["data-in"] ?? "").split(",").filter(Boolean);
    const [a, b] = ids.map((id) => byId.get(id));
    const why = ids.length === 2 ? pairProblem(op, a, b, null) : "needs two inputs";
    if (why) {
      problem("derived", el.page, `derived "${el.text}" (${op} of ${ids.join(", ")}): ${why}`);
      continue;
    }
    const v = compute(op, a.value, b.value);
    if (v === null || text(op, v) !== el.text) problem("derived", el.page, `derived "${el.text}" (${op} of ${ids.join(", ")}): recomputed "${v === null ? "none" : text(op, v)}"`);
  }

  /* 2. views.json files */
  const dir = path.join(appDir, "series");
  let files = 0;
  let values = 0;
  let gaps = 0;
  const visible = [...series.values()].filter((s) => ["published", "candidate"].includes(release.dataset_status?.[s.dataset]?.state));
  for (const s of visible) {
    const slug = s.series_id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
    const file = ["views.json.body", "views.json"].map((n) => path.join(dir, slug, n)).find((p) => fs.existsSync(p));
    const where = `/series/${slug}/views.json`;
    if (!file) {
      problem("derived-json", where, "not prerendered");
      continue;
    }
    files++;
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    if (j.release !== release.version) problem("derived-json", where, `release ${j.release}, built from ${release.version}`);
    if (j.series !== s.series_id) problem("derived-json", where, `names series ${j.series}`);
    const own = bySeries.get(s.series_id) ?? [];
    for (const view of j.views ?? []) {
      const op = view.op;
      if (["pct", "chg", "idx", "share"].includes(op) && view.points.length !== own.length) problem("derived-json", where, `${view.id}: ${view.points.length} points for ${own.length} figures`);
      for (const p of view.points) {
        const ins = p.in.map((id) => byId.get(id));
        const a = ins[0];
        if (!a || a.series_id !== s.series_id || a.period !== p.p) {
          problem("derived-json", where, `${view.id} ${p.p}: first input ${p.in[0]} is not this series' figure for ${p.p}`);
          continue;
        }
        if (p.v !== null && p.v !== undefined) {
          values++;
          const why = pairProblem(op, a, ins[1], view.base);
          if (why) {
            problem("derived-json", where, `${view.id} ${p.p}: ${why}`);
            continue;
          }
          const v = compute(op, a.value, ins[1].value);
          if (v !== p.v) problem("derived-json", where, `${view.id} ${p.p}: ${p.v}, recomputed ${v}`);
          if (!p.iv || p.iv[0] !== a.value || p.iv[1] !== ins[1].value) problem("derived-json", where, `${view.id} ${p.p}: input values differ from the release`);
          if (op === "rev" && p.diff !== minus(a.value, ins[1].value)) problem("derived-json", where, `${view.id} ${p.p}: difference ${p.diff}`);
          continue;
        }
        gaps++;
        if (p.iv || p.diff) problem("derived-json", where, `${view.id} ${p.p}: a gap carries input values`);
        if (!p.why) problem("derived-json", where, `${view.id} ${p.p}: a gap without a reason`);
        if (p.gap === "travel") {
          if (ins.every((o) => usable(o))) problem("derived-json", where, `${view.id} ${p.p}: says an input may not be used, but all may`);
        } else if (p.gap === "break") {
          if (!ins[1] || !crossesBreak(a, ins[1].period)) problem("derived-json", where, `${view.id} ${p.p}: no break between the inputs`);
        } else if (p.gap === "zero") {
          if (!ins[1] || compute(op, a.value ?? "0", ins[1].value ?? "0") !== null) problem("derived-json", where, `${view.id} ${p.p}: base is not zero`);
        } else if (p.gap === "none") {
          if (ins.length !== 1) problem("derived-json", where, `${view.id} ${p.p}: "nothing to compare with" but names ${ins.length} inputs`);
          else if (op === "pct" || op === "chg") {
            const e = earlier(a);
            if (e && own.some((o) => o.period === e && o.vintage === a.vintage)) problem("derived-json", where, `${view.id} ${p.p}: says nothing to compare with, but ${e} exists`);
          }
        } else problem("derived-json", where, `${view.id} ${p.p}: unknown gap kind ${p.gap}`);
      }
    }
  }
  return `${html} derived values in pages; ${files} views.json files, ${values} derived values and ${gaps} gaps checked`;
}
