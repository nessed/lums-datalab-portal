// /catalogue.json is drawn in the browser, so the HTML scan never sees its
// numbers. Check it here instead: every row is a visible series, every "latest"
// value is the stored value of a checked figure of that series, formatted the
// way the site formats it, linked to that figure's receipt; counts equal the
// release's counts.
import fs from "node:fs";
import path from "node:path";

// Written independently of src/lib/format.ts (formatDecimalString): same rule.
const fmt = (v) => {
  const s = String(v).trim();
  const m = /^([+-]?)(\d+)(\.\d+)?$/.exec(s);
  if (!m) return s;
  return `${m[1] === "-" ? "−" : ""}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${m[3] ?? ""}`;
};

export default function check({ appDir, release, seriesList, allObs, isPub, slugify, problem }) {
  const file = ["catalogue.json.body", "catalogue.json"].map((n) => path.join(appDir, n)).find((p) => fs.existsSync(p));
  if (!file) {
    problem("catalogue-json", "/catalogue.json", "not prerendered");
    return "missing";
  }
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  if (j.release !== release.version) problem("catalogue-json", "/catalogue.json", `release ${j.release}, built from ${release.version}`);
  const visible = seriesList.filter((s) => release.dataset_status?.[s.dataset]?.state === "published");
  const byId = new Map(visible.map((s) => [s.series_id, s]));
  if (j.rows.length !== visible.length) problem("catalogue-json", "/catalogue.json", `${j.rows.length} rows, ${visible.length} visible series`);
  const obsById = new Map(allObs.map((o) => [o.obs_id, o]));
  let values = 0;
  for (const r of j.rows) {
    if (!byId.has(r.id)) {
      problem("catalogue-json", r.id, "row for a series that is not visible");
      continue;
    }
    const mine = allObs.filter((o) => o.series_id === r.id);
    if (r.n !== mine.filter(isPub).length) problem("catalogue-json", r.id, `checked count ${r.n}`);
    if (r.all !== mine.length) problem("catalogue-json", r.id, `figure count ${r.all}`);
    if (r.latest) {
      const o = obsById.get(r.latest.obs);
      if (!o || o.series_id !== r.id || !isPub(o)) problem("catalogue-json", r.id, `latest ${r.latest.obs} is not a checked figure of this series`);
      else {
        values++;
        if (r.latest.v !== fmt(o.value)) problem("catalogue-json", r.id, `latest shows ${r.latest.v}, release stores ${o.value}`);
        if (r.latest.href !== `/o/${slugify(o.obs_id)}`) problem("catalogue-json", r.id, `latest links to ${r.latest.href}`);
      }
    }
  }
  return `${j.rows.length} rows, ${values} values checked`;
}
