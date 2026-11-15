// Home, topic and answer pages (DESIGN.md 9.2 to 9.4, 18.3). Written
// independently of src/components/home/derive.ts.
//
// 1. Every derived figure on any page (data-num="derived": a change, an
//    average revision, a count of years compared) is recomputed here from the
//    release files and claimed. Its inputs must be figures that are published,
//    checked and from a dataset a person signed off (not a candidate); a change
//    compares like with like (same series, same kind of figure) or a budget
//    estimate with the revised estimate of the same year.
// 2. Answer sentences are traced: the value in each answer part is the latest
//    checked figure of that series and kind, read from the release.
// 3. No candidate figure appears on the home page, an answer page or a topic's
//    headline cards (decision 17.1).
import fs from "node:fs";
import path from "node:path";

const abs = (x) => (x < 0n ? -x : x);
function dec(v) {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(v).trim());
  if (!m) return null;
  const f = m[3] ?? "";
  const n = BigInt(m[2] + f);
  return { n: m[1] === "-" ? -n : n, s: f.length };
}
function same(a, b) {
  const s = Math.max(a.s, b.s);
  return [a.n * 10n ** BigInt(s - a.s), b.n * 10n ** BigInt(s - b.s), s];
}
// The rounding rule for derived figures (DECISIONS.md, round 2), written again
// here rather than imported from the site: the exact quotient num/den (in per
// cent or percentage points) to one decimal; to two when its magnitude is below
// 1; a figure that is not zero but would read 0.00 to its first significant
// digit; halves away from zero. Returns an unsigned string ("17.1", "0.42").
function rule(num, den) {
  num = abs(num);
  den = abs(den);
  if (num === 0n) return "0.00";
  const at = (k) => {
    const q = num * 10n ** BigInt(k);
    const r = q / den;
    return (q % den) * 2n >= den ? r + 1n : r;
  };
  const put = (n, k) => {
    const t = n.toString().padStart(k + 1, "0");
    return `${t.slice(0, t.length - k).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${t.slice(t.length - k)}`;
  };
  const h = at(2);
  if (h >= 100n) return put(at(1), 1);
  if (h > 0n) return put(h, 2);
  let k = 3;
  while (num * 10n ** BigInt(k) < den) k++;
  const d = at(k);
  return d === 10n ? put(1n, k - 1) : put(d, k);
}
// Percentage of num/den under the rule.
function pct(num, den) {
  const mag = `${rule(num * 100n, den)}%`;
  const sign = num === 0n ? 0 : num < 0n !== den < 0n ? -1 : 1;
  return { mag, sign };
}
function withSign(mag, sign, fmt, unit = "") {
  if (fmt === "plain") return mag + unit;
  if (fmt === "signed") return sign === 0 ? `${mag}${unit}` : `${sign < 0 ? "−" : "+"}${mag}${unit}`;
  return sign === 0 ? "unchanged" : `${sign < 0 ? "down" : "up"} ${mag}${unit}`;
}

export default function check({ appDir, release, series, allObs, isPub, problem, derived }) {
  const obsById = new Map(allObs.map((o) => [o.obs_id, o]));
  const state = (o) => release.dataset_status?.[series.get(o.series_id)?.dataset]?.state;
  const usable = (o) => !!o && isPub(o) && o.status === "checked" && state(o) === "published";
  const mine = new Set(["pct", "pp", "mean-rev", "mean-abs-rev", "n-pairs"]);
  let n = 0;

  for (const d of derived ?? []) {
    const f = d.attrs["data-derived"];
    if (!mine.has(f)) continue;
    d.claimed = true;
    n++;
    const ids = (d.attrs["data-inputs"] ?? "").split(/\s+/).filter(Boolean);
    const ins = ids.map((id) => obsById.get(id));
    const bad = ids.filter((id, i) => !usable(ins[i]));
    if (!ids.length || bad.length) {
      problem("home-derived", d.page, `"${d.text}" (${f}) uses inputs that are not checked, signed-off figures: ${bad.join(", ") || "none named"}`);
      continue;
    }
    const fmt = d.attrs["data-fmt"] ?? "words";
    let want;
    if (f === "pct" || f === "pp") {
      if (ins.length !== 2) {
        problem("home-derived", d.page, `"${d.text}": a change needs two inputs`);
        continue;
      }
      const [a, b] = ins;
      const like = a.series_id === b.series_id && ((a.vintage === b.vintage && a.period < b.period) || (a.vintage === "be" && b.vintage === "re" && a.period === b.period));
      if (!like) problem("home-derived", d.page, `"${d.text}" compares ${a.obs_id} with ${b.obs_id}, which is not like with like`);
      const [x, y, s] = same(dec(a.value), dec(b.value));
      if (f === "pp") {
        if (series.get(a.series_id)?.unit !== "percent") problem("home-derived", d.page, `"${d.text}": percentage points of a series that is not a rate`);
        const diff = y - x;
        const sign = diff === 0n ? 0 : diff < 0n ? -1 : 1;
        want = sign === 0 && fmt === "words" ? "unchanged" : withSign(rule(diff, 10n ** BigInt(s)), sign, fmt, " percentage points");
      } else {
        if (x <= 0n) {
          problem("home-derived", d.page, `"${d.text}": a percentage change from a base at or below zero`);
          continue;
        }
        const r = pct(y - x, x);
        want = withSign(r.mag, r.sign, fmt);
      }
    } else {
      if (ins.length % 2) {
        problem("home-derived", d.page, `"${d.text}": revision inputs are not pairs`);
        continue;
      }
      let num = 0n;
      let numA = 0n;
      let den = 1n;
      let ok = true;
      for (let i = 0; i < ins.length; i += 2) {
        const [be, re] = [ins[i], ins[i + 1]];
        if (be.vintage !== "be" || re.vintage !== "re" || be.period !== re.period || be.series_id !== re.series_id || be.series_id !== ins[0].series_id) ok = false;
        const [x, y] = same(dec(be.value), dec(re.value));
        if (x <= 0n) ok = false;
        num = num * x + (y - x) * den;
        numA = numA * x + abs(y - x) * den;
        den *= x;
      }
      if (!ok) {
        problem("home-derived", d.page, `"${d.text}": inputs are not budget and revised estimates of the same year and series, with a positive budget estimate`);
        continue;
      }
      // Every year of the series that has both figures usable must be in.
      const sid = ins[0].series_id;
      const be = new Map(allObs.filter((o) => o.series_id === sid && o.vintage === "be").map((o) => [o.period, o]));
      const expectYears = allObs.filter((o) => o.series_id === sid && o.vintage === "re" && usable(o) && usable(be.get(o.period)) && dec(be.get(o.period).value).n > 0n).length;
      if (expectYears * 2 !== ins.length) problem("home-derived", d.page, `"${d.text}": ${ins.length / 2} years used, ${expectYears} available`);
      const k = BigInt(ins.length / 2);
      if (f === "n-pairs") want = String(ins.length / 2);
      else if (f === "mean-rev") {
        const r = pct(num, den * k);
        want = withSign(r.mag, r.sign, "signed");
      } else want = pct(numA, den * k).mag;
    }
    if (want !== d.text) problem("home-derived", d.page, `"${d.text}" (${f}) should read "${want}"`);
  }

  // 2 and 3: the built pages.
  const read = (rel) => {
    const p = path.join(appDir, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8").replace(/<script[\s\S]*?<\/script>/g, "") : null;
  };
  const home = read("index.html");
  if (!home) problem("home-page", "/", "not prerendered");
  else if (home.includes("data-candidate")) problem("home-candidate", "/", "a figure nobody signed off is on the home page");

  let traced = 0;
  const ansDir = path.join(appDir, "answers");
  const answerFiles = fs.existsSync(ansDir) ? fs.readdirSync(ansDir).filter((f) => f.endsWith(".html")) : [];
  if (!answerFiles.length) problem("answer", "/answers", "no answer pages were built");
  const kindOk = (o, kind) => (kind === "be" || kind === "re" ? o.vintage === kind : o.vintage === "na");
  for (const f of answerFiles) {
    const page = `/answers/${f.replace(/\.html$/, "")}`;
    const html = read(path.join("answers", f));
    if (html.includes("data-candidate")) problem("answer-candidate", page, "a figure nobody signed off is on an answer page");
    const parts = [...html.matchAll(/<p[^>]*data-answer-part="([^"]+)"[^>]*data-answer-kind="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g)];
    if (!parts.length) problem("answer", page, "no answer sentence");
    if (!/class="ans-first"/.test(html)) problem("answer", page, "no first answer sentence");
    for (const [, sid, kind, body] of parts) {
      const m = /<a[^>]*href="\/o\/([^"?#]+)"[^>]*data-v=""/.exec(body) ?? /<a[^>]*data-v=""[^>]*href="\/o\/([^"?#]+)"/.exec(body);
      if (!m) {
        problem("answer", page, `answer for ${sid} has no value linked to a receipt`);
        continue;
      }
      const slug = decodeURIComponent(m[1]);
      const o = allObs.find((x) => x.obs_id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_") === slug);
      const latest = allObs
        .filter((x) => x.series_id === sid && kindOk(x, kind) && isPub(x) && state(x) === "published")
        .sort((a, b) => b.period.localeCompare(a.period))[0];
      if (!o || !latest || o.obs_id !== latest.obs_id) problem("answer", page, `answer for ${sid} shows ${o?.obs_id ?? slug}, but the latest checked ${kind} figure is ${latest?.obs_id ?? "none"}`);
      else traced++;
    }
  }
  for (const f of fs.existsSync(path.join(appDir, "topics")) ? fs.readdirSync(path.join(appDir, "topics")).filter((x) => x.endsWith(".html")) : []) {
    const html = read(path.join("topics", f));
    const cards = /<ul class="hc-grid">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "";
    if (cards.includes("data-candidate")) problem("topic-candidate", `/topics/${f}`, "a figure nobody signed off is in the headline cards");
  }
  return `${n} derived figures recomputed, ${traced} answer sentences traced over ${answerFiles.length} answer pages`;
}
