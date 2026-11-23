// The guides (2026-11-23). Written independently of src/app/guides/.
//
// /guides and /guides/revised-estimate are prerendered. On the revised-estimate
// guide:
//   - the worked example (data-guide-example, -be, -re) is the budget estimate and
//     the revised estimate of one year of that series, and that year is the latest
//     in which the release holds both as published, checked, signed-off figures
//     (the year comes from the data, never from the design);
//   - both figures are printed on the page as values linked to their receipts;
//   - each entry of "Datasets this explains" (data-guide-latest-be) is the latest
//     shown budget estimate of its series;
//   - no figure nobody signed off is on the page.
// The gap between the two figures is a "pct" derived figure, claimed and
// recomputed by home-derived.mjs.
import fs from "node:fs";
import path from "node:path";

export default function check({ appDir, release, series, allObs, isPub, slugify, problem }) {
  const obsById = new Map(allObs.map((o) => [o.obs_id, o]));
  const state = (o) => release.dataset_status?.[series.get(o.series_id)?.dataset]?.state;
  const usable = (o) => !!o && isPub(o) && o.status === "checked" && state(o) === "published";
  const shown = (o) => !!o && isPub(o) && state(o) === "published";
  const read = (rel) => {
    const p = path.join(appDir, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8").replace(/<script[\s\S]*?<\/script>/g, "") : null;
  };
  if (!read("guides.html")) problem("guides", "/guides", "not prerendered");
  const page = "/guides/revised-estimate";
  const html = read(path.join("guides", "revised-estimate.html"));
  if (!html) {
    problem("guides", page, "not prerendered");
    return "guide page missing";
  }
  if (html.includes("data-candidate")) problem("guides", page, "a figure nobody signed off is on the guide");
  const linked = new Set(
    [...html.matchAll(/<a\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((t) => /\sdata-v=""/.test(t))
      .map((t) => /\shref="\/o\/([^"?#]+)"/.exec(t)?.[1])
      .filter(Boolean)
      .map((x) => decodeURIComponent(x)),
  );

  let example = "none";
  const ex = /<[a-z]+[^>]*data-guide-example="([^"]+)"[^>]*>/.exec(html);
  if (ex) {
    const tag = ex[0];
    const sid = ex[1];
    const be = obsById.get(/data-guide-be="([^"]+)"/.exec(tag)?.[1] ?? "");
    const re = obsById.get(/data-guide-re="([^"]+)"/.exec(tag)?.[1] ?? "");
    const beOf = new Map(allObs.filter((o) => o.series_id === sid && o.vintage === "be").map((o) => [o.period, o]));
    const latest = allObs
      .filter((o) => o.series_id === sid && o.vintage === "re" && usable(o) && usable(beOf.get(o.period)))
      .sort((a, b) => b.period.localeCompare(a.period))[0];
    if (!be || !re || be.series_id !== sid || re.series_id !== sid || be.vintage !== "be" || re.vintage !== "re" || be.period !== re.period)
      problem("guides", page, `the worked example is not the budget and revised estimate of one year of ${sid}`);
    else if (!latest || latest.period !== re.period) problem("guides", page, `the worked example is ${re.period}, but the latest year of ${sid} with both figures checked is ${latest?.period ?? "none"}`);
    else example = re.period;
    for (const o of [be, re]) if (o && !linked.has(slugify(o.obs_id))) problem("guides", page, `${o.obs_id} is in the worked example but not printed as a value linked to its receipt`);
  } else {
    // No example is allowed only when the release has no such year.
    const any = allObs.some((o) => o.series_id === "fed.rev.tax" && o.vintage === "re" && usable(o) && usable(obsById.get(`fed.rev.tax:${o.period}:be`)));
    if (any) problem("guides", page, "no worked example, although the release holds a year with both figures checked");
  }

  let rows = 0;
  for (const m of html.matchAll(/data-guide-latest-be="([^"]+)"/g)) {
    rows++;
    const o = obsById.get(m[1]);
    const latest = o
      ? allObs.filter((x) => x.series_id === o.series_id && x.vintage === "be" && shown(x)).sort((a, b) => b.period.localeCompare(a.period))[0]
      : null;
    if (!o || !latest || latest.obs_id !== o.obs_id) problem("guides", page, `"Datasets this explains" shows ${m[1]}, but the latest budget estimate of that series is ${latest?.obs_id ?? "none"}`);
    else if (!linked.has(slugify(o.obs_id))) problem("guides", page, `${o.obs_id} is listed but not printed as a value linked to its receipt`);
  }
  return `worked example ${example}; ${rows} latest budget estimates traced`;
}
