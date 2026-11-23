// The inflation calculator (/inflation-calculator, 2026-11-23). Written
// independently of src/components/pages/cpi-worth.ts.
//
// 1. Every figure marked data-derived="cpi-worth" on any page is recomputed here
//    from the release and claimed:
//      worth = amount × index (later input) ÷ index (earlier input)
//    in whole rupees, halves away from zero, with thousands separators, where the
//    amount is data-amount (a whole number of rupees) and the two inputs
//    (data-inputs, in the order "from to") are published, checked, signed-off
//    figures of one price index series (unit "index"), of the same kind.
// 2. The calculator page itself: its default result is there; every month its
//    two lists offer is a checked figure of that same series that the page also
//    prints as a value linked to its receipt (so the browser works only from
//    values the page shows); the default inputs are the earliest and the latest
//    month offered; and the rate in the heading is the latest checked figure of
//    the national year-on-year series.
import fs from "node:fs";
import path from "node:path";

const RATE = "cpi.national.yoy.general";

function dec(v) {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(v).trim());
  if (!m) return null;
  const f = m[3] ?? "";
  const n = BigInt(m[2] + f);
  return { n: m[1] === "-" ? -n : n, s: f.length };
}
function worth(amount, from, to) {
  const a = dec(from);
  const b = dec(to);
  if (!a || !b || a.n <= 0n || b.n < 0n) return null;
  const num = BigInt(amount) * b.n * 10n ** BigInt(a.s);
  const den = a.n * 10n ** BigInt(b.s);
  let q = num / den;
  if ((num % den) * 2n >= den) q += 1n;
  return q.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function check({ appDir, release, series, allObs, isPub, slugify, problem, derived }) {
  const obsById = new Map(allObs.map((o) => [o.obs_id, o]));
  const state = (o) => release.dataset_status?.[series.get(o.series_id)?.dataset]?.state;
  const usable = (o) => !!o && isPub(o) && o.status === "checked" && state(o) === "published";
  let n = 0;
  const onPage = [];
  for (const d of derived ?? []) {
    if (d.attrs["data-derived"] !== "cpi-worth") continue;
    d.claimed = true;
    n++;
    if (d.page === "/inflation-calculator") onPage.push(d);
    const ids = (d.attrs["data-inputs"] ?? "").split(/\s+/).filter(Boolean);
    const ins = ids.map((id) => obsById.get(id));
    if (ids.length !== 2 || !ins.every(usable)) {
      problem("calc-inflation", d.page, `"${d.text}": needs two checked, signed-off index values (${ids.join(", ") || "none named"})`);
      continue;
    }
    const [a, b] = ins;
    if (a.series_id !== b.series_id || a.vintage !== b.vintage || series.get(a.series_id)?.unit !== "index") {
      problem("calc-inflation", d.page, `"${d.text}": ${a.obs_id} and ${b.obs_id} are not two months of one price index`);
      continue;
    }
    const amt = d.attrs["data-amount"] ?? "";
    if (!/^[1-9]\d*$/.test(amt)) {
      problem("calc-inflation", d.page, `"${d.text}": data-amount "${amt}" is not a whole number of rupees`);
      continue;
    }
    const want = worth(amt, a.value, b.value);
    if (want !== d.text) problem("calc-inflation", d.page, `"${d.text}" (cpi-worth of Rs ${amt}, ${a.obs_id} to ${b.obs_id}) should read "${want}"`);
  }

  // 2. The page.
  const file = path.join(appDir, "inflation-calculator.html");
  if (!fs.existsSync(file)) {
    problem("calc-inflation", "/inflation-calculator", "not prerendered");
    return `${n} worth figures recomputed; calculator page missing`;
  }
  const html = fs.readFileSync(file, "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  // Value links (data-v) to receipts, whatever the order of their attributes.
  const valueLinks = (h) =>
    [...h.matchAll(/<a\s[^>]*>/g)]
      .map((m) => m[0])
      .filter((t) => /\sdata-v=""/.test(t))
      .map((t) => /\shref="\/o\/([^"?#]+)"/.exec(t)?.[1])
      .filter(Boolean)
      .map((x) => decodeURIComponent(x));
  const linked = new Set(valueLinks(html));
  const offered = {};
  for (const which of ["from", "to"]) {
    const sel = new RegExp(`<select[^>]*data-calc="${which}"[^>]*>([\\s\\S]*?)</select>`).exec(html);
    offered[which] = sel ? [...sel[1].matchAll(/<option[^>]*value="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&")) : [];
  }
  let months = 0;
  if (onPage.length) {
    if (onPage.length !== 1) problem("calc-inflation", "/inflation-calculator", `${onPage.length} default results, expected one`);
    if (!offered.from.length || !offered.to.length) problem("calc-inflation", "/inflation-calculator", "the month lists are missing");
    const [fromId, toId] = (onPage[0].attrs["data-inputs"] ?? "").split(/\s+/);
    const sid = obsById.get(fromId)?.series_id;
    for (const id of new Set([...offered.from, ...offered.to])) {
      months++;
      const o = obsById.get(id);
      if (!usable(o) || o.series_id !== sid) problem("calc-inflation", "/inflation-calculator", `month ${id} is offered but is not a checked figure of ${sid}`);
      else if (!linked.has(slugify(id))) problem("calc-inflation", "/inflation-calculator", `month ${id} is offered but its index value is not printed on the page`);
    }
    const byPeriod = (ids) => ids.map((id) => obsById.get(id)).filter(Boolean).sort((x, y) => x.period.localeCompare(y.period));
    const f = byPeriod(offered.from);
    const t = byPeriod(offered.to);
    if (f.length && f[0].obs_id !== fromId) problem("calc-inflation", "/inflation-calculator", `the default "from" month is ${fromId}, not the earliest offered (${f[0].obs_id})`);
    if (t.length && t[t.length - 1].obs_id !== toId) problem("calc-inflation", "/inflation-calculator", `the default "worth in" month is ${toId}, not the latest offered (${t[t.length - 1].obs_id})`);
  } else if (offered.from.length && !/<span[^>]*data-derived="cpi-worth"/.test(html)) {
    // The number audit runs without check-build's HTML scan (no derived list), so look at the page itself.
    problem("calc-inflation", "/inflation-calculator", "the calculator has no default result");
  }

  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "";
  const rateLink = valueLinks(h1)[0];
  if (rateLink) {
    const latest = allObs
      .filter((o) => o.series_id === RATE && isPub(o) && state(o) === "published")
      .sort((a, b) => b.period.localeCompare(a.period))[0];
    if (!latest || slugify(latest.obs_id) !== rateLink) problem("calc-inflation", "/inflation-calculator", `the heading quotes ${rateLink}, but the latest checked figure of ${RATE} is ${latest?.obs_id ?? "none"}`);
  }
  return `${n} worth figures recomputed; ${months} months offered on the calculator, each printed on the page`;
}
