// Home v2, "What it costs you" (2026-11-23). Written independently of
// src/components/hub/HomeV2.tsx.
//
// Every cost figure (data-num="derived", data-derived "cost-now" or "cost-more")
// is recomputed here from the release and claimed:
//   cost-now   amount × (100 + r) ÷ 100
//   cost-more  amount × |r| ÷ 100, and data-dir says "more" when r > 0, "less" when r < 0
// to whole rupees, halves away from zero, with thousands separators, where the
// amount is data-amount (a whole number of rupees) and r is the one input: a
// published, checked, signed-off year-on-year price change (a series in per
// cent whose id holds ".yoy."), the latest such figure of its series.
const abs = (x) => (x < 0n ? -x : x);
function dec(v) {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(v).trim());
  if (!m) return null;
  const f = m[3] ?? "";
  const n = BigInt(m[2] + f);
  return { n: m[1] === "-" ? -n : n, s: f.length };
}
function whole(num, den) {
  const neg = num < 0n !== den < 0n && num !== 0n;
  const a = abs(num);
  const b = abs(den);
  let q = a / b;
  if ((a % b) * 2n >= b) q += 1n;
  const t = q.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg && q !== 0n ? `−${t}` : t;
}

export default function check({ release, series, allObs, isPub, problem, derived }) {
  const obsById = new Map(allObs.map((o) => [o.obs_id, o]));
  const state = (o) => release.dataset_status?.[series.get(o.series_id)?.dataset]?.state;
  const usable = (o) => !!o && isPub(o) && o.status === "checked" && state(o) === "published";
  let n = 0;
  for (const d of derived ?? []) {
    const f = d.attrs["data-derived"];
    if (f !== "cost-now" && f !== "cost-more") continue;
    d.claimed = true;
    n++;
    const ids = (d.attrs["data-inputs"] ?? "").split(/\s+/).filter(Boolean);
    const o = obsById.get(ids[0]);
    if (ids.length !== 1 || !usable(o)) {
      problem("home-cost", d.page, `"${d.text}" (${f}): needs one checked, signed-off input (${ids.join(", ") || "none named"})`);
      continue;
    }
    const s = series.get(o.series_id);
    if (s?.unit !== "percent" || !/\.yoy\./.test(o.series_id)) {
      problem("home-cost", d.page, `"${d.text}" (${f}): ${o.series_id} is not a year-on-year price change in per cent`);
      continue;
    }
    const latest = allObs
      .filter((x) => x.series_id === o.series_id && x.vintage === o.vintage && usable(x))
      .sort((a, b) => b.period.localeCompare(a.period))[0];
    if (latest?.obs_id !== o.obs_id) problem("home-cost", d.page, `"${d.text}" (${f}): uses ${o.obs_id}, but the latest checked figure of that series is ${latest?.obs_id ?? "none"}`);
    const amt = d.attrs["data-amount"] ?? "";
    if (!/^[1-9]\d*$/.test(amt)) {
      problem("home-cost", d.page, `"${d.text}" (${f}): data-amount "${amt}" is not a whole number of rupees`);
      continue;
    }
    const A = BigInt(amt);
    const r = dec(o.value);
    const den = 100n * 10n ** BigInt(r.s);
    let want;
    if (f === "cost-now") want = whole(A * (100n * 10n ** BigInt(r.s) + r.n), den);
    else {
      want = whole(A * abs(r.n), den);
      const dir = r.n > 0n ? "more" : r.n < 0n ? "less" : "same";
      if (want === "0") problem("home-cost", d.page, `"${d.text}" (cost-more): a difference of no rupees is shown as a figure; say "the same" in words`);
      if (d.attrs["data-dir"] !== dir) problem("home-cost", d.page, `"${d.text}" (cost-more): says "${d.attrs["data-dir"]}", the price change says "${dir}"`);
    }
    if (want !== d.text) problem("home-cost", d.page, `"${d.text}" (${f}) should read "${want}"`);
  }
  return `${n} cost figures recomputed`;
}
