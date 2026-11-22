// The data hub home page (docs/plans/2026-11-23-data-hub.md, sections 5 and 6).
// Written independently of src/components/hub/stories.tsx.
//
// 1. Every share (data-num="derived" data-derived="share") is recomputed from the
//    release: part / total in per cent under the site's rounding rule, both inputs
//    published, checked and signed off, same period and kind, and a column-total
//    or hierarchy-sum check that passed must hold the part among its members and
//    the total as its target. A share whose parts do not add up is never shown.
// 2. Every "rose fastest" claim (data-rank="max") is recomputed: the named figure
//    is the largest of the group, every figure of the group named in
//    editorial/stories.json is checked for that period and is in the comparison.
// 3. Like with like on the home page: a change between two years of a series
//    never crosses a series break, and where a budget estimate is compared with
//    the next year's budget estimate and the earlier one was later revised, the
//    page links that revised estimate too.
// 4. The ticker: a pause switch, and the copy that makes the loop seamless is
//    hidden from assistive technology and without CSS.
// Changes (pct, pp) on the home page are recomputed by home-derived.mjs.
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
  return [a.n * 10n ** BigInt(s - a.s), b.n * 10n ** BigInt(s - b.s)];
}
// The rounding rule for derived figures (DECISIONS.md, round 2), written again
// here: one decimal; two when the magnitude is below 1; a non-zero figure that
// would read 0.00 to its first significant digit; halves away from zero.
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

const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

export default function check({ siteDir, appDir, release, series, allObs, checks, isPub, slugify, problem, derived }) {
  const obsById = new Map(allObs.map((o) => [o.obs_id, o]));
  const state = (o) => release.dataset_status?.[series.get(o.series_id)?.dataset]?.state;
  const usable = (o) => !!o && isPub(o) && o.status === "checked" && state(o) === "published";
  const cellsOf = (o) => new Set([o.primary_cell_id, ...(o.supporting_cell_ids ?? [])].filter(Boolean));
  let shares = 0;

  // 1. Shares.
  for (const d of derived ?? []) {
    if (d.attrs["data-derived"] !== "share") continue;
    d.claimed = true;
    shares++;
    const ids = (d.attrs["data-inputs"] ?? "").split(/\s+/).filter(Boolean);
    const [part, total] = ids.map((id) => obsById.get(id));
    if (ids.length !== 2 || !usable(part) || !usable(total)) {
      problem("home-share", d.page, `"${d.text}": a share needs two checked, signed-off inputs (${ids.join(", ") || "none named"})`);
      continue;
    }
    if (part.series_id === total.series_id || part.period !== total.period || part.vintage !== total.vintage) {
      problem("home-share", d.page, `"${d.text}": ${part.obs_id} and ${total.obs_id} are not a part and a total of the same year and kind`);
      continue;
    }
    const pc = cellsOf(part);
    const tc = cellsOf(total);
    const sum = [...checks.values()].find(
      (c) =>
        (c.check_type === "column_total" || c.check_type === "hierarchy_sum") &&
        (c.result === "pass" || c.result === "pass_within_rounding") &&
        c.target_cell_id &&
        tc.has(c.target_cell_id) &&
        (c.member_cell_ids ?? []).some((m) => pc.has(m)),
    );
    if (!sum) problem("home-share", d.page, `"${d.text}": no passed sum check holds ${part.obs_id} as a member of ${total.obs_id}`);
    const [a, b] = same(dec(part.value), dec(total.value));
    if (a < 0n || b <= 0n) {
      problem("home-share", d.page, `"${d.text}": a share of a total at or below zero`);
      continue;
    }
    const want = `${rule(a * 100n, b)}%`;
    if (want !== d.text) problem("home-share", d.page, `"${d.text}" (share) should read "${want}"`);
  }

  // The home page itself.
  const file = path.join(appDir, "index.html");
  if (!fs.existsSync(file)) {
    problem("home-stories", "/", "not prerendered");
    return `${shares} shares recomputed; home page not built`;
  }
  const html = fs.readFileSync(file, "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  const linked = new Set([...html.matchAll(/href="\/o\/([^"?#]+)"/g)].map((m) => decodeURIComponent(m[1])));
  const isLinked = (o) => linked.has(slugify(o.obs_id));

  // 2. Rankings.
  const storiesFile = JSON.parse(fs.readFileSync(path.join(siteDir, "editorial", "stories.json"), "utf8"));
  const groupSeries = Object.values(storiesFile.groups ?? {}).map((g) => new Set(g.members.map((m) => m.series)));
  let ranks = 0;
  for (const m of html.matchAll(/<[a-z]+\b[^>]*\bdata-rank="max"[^>]*>/g)) {
    ranks++;
    const a = attrsOf(m[0]);
    const pick = obsById.get(a["data-rank-pick"]);
    const of = (a["data-rank-of"] ?? "").split(/\s+/).filter(Boolean).map((id) => obsById.get(id));
    if (!pick || of.some((o) => !usable(o)) || !of.includes(pick)) {
      problem("home-rank", "/", `ranking ${a["data-rank-pick"]}: every figure compared must be checked and include the one named`);
      continue;
    }
    if (of.some((o) => o.period !== pick.period || o.vintage !== pick.vintage)) problem("home-rank", "/", `ranking ${pick.obs_id}: figures of different periods or kinds compared`);
    const grp = groupSeries.find((g) => g.has(pick.series_id));
    const got = new Set(of.map((o) => o.series_id));
    if (!grp || grp.size !== got.size || [...grp].some((s) => !got.has(s))) problem("home-rank", "/", `ranking ${pick.obs_id}: not every series of its group in editorial/stories.json is compared`);
    const top = of.reduce((x, y) => {
      const [p, q] = same(dec(x.value), dec(y.value));
      return q > p ? y : x;
    });
    const [p, q] = same(dec(top.value), dec(pick.value));
    if (p !== q) problem("home-rank", "/", `ranking says ${pick.obs_id} rose fastest, but ${top.obs_id} is larger`);
  }

  // 3. Like with like on the home page.
  let changes = 0;
  for (const d of derived ?? []) {
    if (d.page !== "/" || (d.attrs["data-derived"] !== "pct" && d.attrs["data-derived"] !== "pp")) continue;
    const [x, y] = (d.attrs["data-inputs"] ?? "").split(/\s+/).map((id) => obsById.get(id));
    if (!x || !y) continue;
    changes++;
    const s = series.get(x.series_id);
    const brk = (s?.breaks ?? []).find((b) => x.period < b.at_period && b.at_period <= y.period);
    if (brk) problem("home-like", "/", `"${d.text}" compares ${x.obs_id} with ${y.obs_id} across the series break at ${brk.at_period}`);
    if (x.vintage === "be" && y.vintage === "be") {
      const re = allObs.find((o) => o.series_id === x.series_id && o.period === x.period && o.vintage === "re");
      if (re && usable(re) && !isLinked(re))
        problem("home-like", "/", `"${d.text}" compares two budget estimates; the earlier one (${x.period}) was revised (${re.obs_id}) and the page does not show it`);
    }
  }

  // 4. The ticker.
  const tk = /<section[^>]*class="tk"[\s\S]*?<\/section>/.exec(html)?.[0];
  if (!tk) problem("home-ticker", "/", "no ticker");
  else {
    if (!/id="tk-pause"/.test(tk) || !/for="tk-pause"/.test(tk)) problem("home-ticker", "/", "the ticker has no pause switch");
    const runs = [...tk.matchAll(/<div[^>]*class="tk-run"[^>]*>/g)].map((m) => attrsOf(m[0]));
    if (runs.length !== 2 || !("hidden" in runs[1] || /class="tk-run"[^>]*\bhidden\b/.test(tk)) || runs[1]["aria-hidden"] !== "true")
      problem("home-ticker", "/", "the ticker's second copy must be hidden and aria-hidden");
  }
  return `${shares} shares recomputed, ${ranks} rankings recomputed, ${changes} home changes checked like with like`;
}
