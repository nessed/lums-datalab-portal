// Home v3 pages set (2026-11-24): publisher counts on the home page (search band
// "N series from N official publishers" and "Where the figures come from").
// Written independently of src/components/hub/HomeV4.tsx.
//
// A series counts for a publisher when it belongs to a visible data type
// (dataset_status state published or candidate) and at least one of its
// published figures has its main printing in a document of that publisher.
//   data-derived="publishers"                        number of such publishers
//   data-derived="publisher-series" data-publisher=P number of such series for P
// Every such count is claimed here and must equal the recomputed number.
export default function check({ release, seriesList, allObs, cells, sourceById, isPub, problem, derived }) {
  const visible = new Set(Object.keys(release.dataset_status ?? {}).filter((k) => ["published", "candidate"].includes(release.dataset_status[k]?.state)));
  const dsOf = new Map(seriesList.map((s) => [s.series_id, s.dataset]));
  const byPub = new Map();
  for (const o of allObs) {
    if (!isPub(o) || !visible.has(dsOf.get(o.series_id)) || !o.primary_cell_id) continue;
    const src = sourceById.get(cells.get(o.primary_cell_id)?.source_id);
    if (!src?.publisher) continue;
    if (!byPub.has(src.publisher)) byPub.set(src.publisher, new Set());
    byPub.get(src.publisher).add(o.series_id);
  }
  let n = 0;
  for (const d of derived ?? []) {
    const k = d.attrs["data-derived"];
    if (k !== "publishers" && k !== "publisher-series") continue;
    d.claimed = true;
    n++;
    const want = k === "publishers" ? byPub.size : byPub.get(d.attrs["data-publisher"] ?? "")?.size;
    if (want === undefined) problem("home-publishers", d.page, `"${d.text}": no published series from publisher "${d.attrs["data-publisher"]}"`);
    else if (d.text.replace(/,/g, "") !== String(want)) problem("home-publishers", d.page, `${k} shows "${d.text}" but the release gives ${want}`);
  }
  return `${byPub.size} publishers, ${n} counts claimed`;
}
