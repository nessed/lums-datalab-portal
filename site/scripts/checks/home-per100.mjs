// Home v2, "Where Rs 100 goes" (2026-11-23). Written independently of
// src/components/hub/HomeV2.tsx.
//
// Every figure (data-num="derived") is recomputed here from the release and claimed:
//   per100       part ÷ total × 100; inputs "part total"
//   per100-rest  (total − the parts shown) ÷ total × 100; inputs "total part part ..."
// in rupees to two decimals, halves away from zero; a figure that is not zero
// but would read 0.00 goes to its first significant digit. Every input is
// published, checked and signed off; every part is of the same year and kind
// as the total; and for every part a column-total or hierarchy-sum check that
// passed holds the part among its members and the total as its target, named
// in data-share-check. A line whose parts do not add up is never shown.
const abs = (x) => (x < 0n ? -x : x);
function dec(v) {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(v).trim());
  if (!m) return null;
  const f = m[3] ?? "";
  const n = BigInt(m[2] + f);
  return { n: m[1] === "-" ? -n : n, s: f.length };
}
function rupees(num, den) {
  if (num === 0n) return "0.00";
  const at = (k) => {
    const q = abs(num) * 10n ** BigInt(k);
    const r = q / abs(den);
    return (q % abs(den)) * 2n >= abs(den) ? r + 1n : r;
  };
  const put = (n, k) => {
    const t = n.toString().padStart(k + 1, "0");
    return `${t.slice(0, t.length - k)}.${t.slice(t.length - k)}`;
  };
  const two = at(2);
  if (two > 0n) return put(two, 2);
  let k = 3;
  while (abs(num) * 10n ** BigInt(k) < abs(den)) k++;
  return put(at(k), k);
}

export default function check({ release, series, allObs, checks, isPub, problem, derived }) {
  const obsById = new Map(allObs.map((o) => [o.obs_id, o]));
  const state = (o) => release.dataset_status?.[series.get(o.series_id)?.dataset]?.state;
  const usable = (o) => !!o && isPub(o) && o.status === "checked" && state(o) === "published";
  const cellsOf = (o) => new Set([o.primary_cell_id, ...(o.supporting_cell_ids ?? [])].filter(Boolean));
  const passedSum = (id, part, total) => {
    const c = checks.get(id);
    if (!c) return false;
    const pc = cellsOf(part);
    const tc = cellsOf(total);
    return (
      (c.check_type === "column_total" || c.check_type === "hierarchy_sum") &&
      (c.result === "pass" || c.result === "pass_within_rounding") &&
      !!c.target_cell_id &&
      tc.has(c.target_cell_id) &&
      (c.member_cell_ids ?? []).some((m) => pc.has(m))
    );
  };
  let n = 0;
  for (const d of derived ?? []) {
    const f = d.attrs["data-derived"];
    if (f !== "per100" && f !== "per100-rest") continue;
    d.claimed = true;
    n++;
    const ids = (d.attrs["data-inputs"] ?? "").split(/\s+/).filter(Boolean);
    const ins = ids.map((id) => obsById.get(id));
    if (ids.length < 2 || ins.some((o) => !usable(o))) {
      problem("home-per100", d.page, `"${d.text}" (${f}): inputs are not all checked, signed-off figures (${ids.join(", ") || "none named"})`);
      continue;
    }
    const total = f === "per100" ? ins[1] : ins[0];
    const parts = f === "per100" ? [ins[0]] : ins.slice(1);
    const sums = (d.attrs["data-share-check"] ?? "").split(/\s+/).filter(Boolean);
    if (sums.length !== parts.length) {
      problem("home-per100", d.page, `"${d.text}" (${f}): names ${sums.length} sum checks for ${parts.length} parts`);
      continue;
    }
    let ok = true;
    parts.forEach((p, i) => {
      if (p.series_id === total.series_id || p.period !== total.period || p.vintage !== total.vintage) {
        problem("home-per100", d.page, `"${d.text}": ${p.obs_id} and ${total.obs_id} are not a part and a total of the same year and kind`);
        ok = false;
      } else if (!passedSum(sums[i], p, total)) {
        problem("home-per100", d.page, `"${d.text}": ${sums[i]} is not a passed sum check holding ${p.obs_id} as a member of ${total.obs_id}`);
        ok = false;
      }
    });
    if (!ok) continue;
    const s = Math.max(...ins.map((o) => dec(o.value).s));
    const up = (o) => dec(o.value).n * 10n ** BigInt(s - dec(o.value).s);
    const T = up(total);
    if (T <= 0n) {
      problem("home-per100", d.page, `"${d.text}": a total at or below zero`);
      continue;
    }
    const P = f === "per100" ? up(parts[0]) : T - parts.reduce((a, p) => a + up(p), 0n);
    if (P < 0n) {
      problem("home-per100", d.page, `"${d.text}": the parts shown are larger than the total`);
      continue;
    }
    const want = rupees(P * 100n, T);
    if (want !== d.text) problem("home-per100", d.page, `"${d.text}" (${f}) should read "${want}"`);
  }
  return `${n} Rs 100 figures recomputed`;
}
